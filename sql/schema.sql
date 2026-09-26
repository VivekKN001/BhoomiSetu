-- BhoomiSetu database schema
-- Run this once in: Supabase project -> SQL Editor -> New query -> Run

create extension if not exists "pgcrypto";

-- ---------- Tables ----------

create table listings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  location text not null,
  type text not null check (type in ('site', 'agri', 'commercial')),
  unit text not null check (unit in ('sqft', 'acres')),
  area numeric not null,
  -- Raw "WIDTHxLENGTH" text as typed by the seller (e.g. "60x30"), shown
  -- to buyers alongside area. Only meaningful for sqft-unit listings
  -- (site/commercial) -- null for agri and whenever the seller typed area
  -- directly instead of dimensions. See src/lib/dimensions.js.
  dimensions text,
  price numeric not null,
  advantages text[] not null default '{}',
  description text,
  -- Nullable: rows created before real auth existed (e.g. seed.sql) have
  -- no owner. Every row the app creates always sets this -- enforced by
  -- the "own insert listings" RLS policy below, not by a NOT NULL here.
  seller_id uuid references auth.users(id) on delete set null,
  seller_name text not null,
  -- Owner verification: the seller declares the owner name printed on the
  -- Khata/RTC; an admin compares it against the document and the seller's
  -- account name. Only admins can move a listing out of 'pending' -- see
  -- guard_listing_verification() below. The seller's phone deliberately
  -- lives in listing_contacts, not here, so it's never publicly readable.
  document_owner_name text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  verification_note text,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- Readable only by the seller, admins, and buyers who swiped right on a
-- VERIFIED listing -- see the "read listing_contacts" policy below.
create table listing_contacts (
  listing_id uuid primary key references listings(id) on delete cascade,
  seller_phone text not null
);

-- Admins are added by hand in the SQL Editor:
--   insert into admins (user_id)
--     select id from auth.users where email = '91XXXXXXXXXX@bhoomisetu.local';
create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Forgot-password recovery codes. Only the account-recovery Edge Function
-- (service role) ever touches this -- RLS on, no policies. Stores a
-- SHA-256 hash, never the code itself.
create table recovery_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  login_email text not null unique,
  code_hash text not null,
  created_at timestamptz not null default now()
);

create table listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  storage_path text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

-- Verification documents. Kept in a private bucket (see below) -- sellers
-- can upload but only admins can read them back, via the in-app Review
-- page (is_admin() policies below). 'ec' is required for every listing;
-- 'khata' (E-Khata, optional, site/commercial) and 'rtc' (required, agri)
-- are the type-specific doc, mutually exclusive per listing (see
-- src/data/propertyTypes.js); 'tax_receipt' is always optional.
-- Deliberately no personal-ID document type -- see chat: property-proof
-- only, never Aadhaar/PAN.
create table listing_documents (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  storage_path text not null,
  doc_type text not null check (doc_type in ('khata', 'rtc', 'ec', 'tax_receipt')),
  created_at timestamptz not null default now()
);

create table swipes (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  direction text not null check (direction in ('left', 'right')),
  created_at timestamptz not null default now(),
  unique (buyer_id, listing_id)
);

-- ---------- Storage buckets ----------

insert into storage.buckets (id, name, public)
  values ('land-images', 'land-images', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('land-documents', 'land-documents', false)
  on conflict (id) do nothing;

-- ---------- Functions & triggers ----------

create function is_admin() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from admins where user_id = auth.uid()) $$;

-- Sellers can never mark their own listing verified. Non-admin inserts
-- always start pending; non-admin updates keep the existing status, except
-- that changing what the documents are supposed to prove (locality, type,
-- area, dimensions, declared owner name) -- or explicitly asking for
-- re-review -- sends the listing back to pending. Price/title/description
-- edits don't.
create function guard_listing_verification() returns trigger
  language plpgsql set search_path = public
  as $$
begin
  if is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.verification_status := 'pending';
    new.verification_note := null;
    new.verified_at := null;
    return new;
  end if;
  if new.verification_status = 'pending'
     or (new.location, new.type, new.area, new.dimensions, new.document_owner_name)
        is distinct from
        (old.location, old.type, old.area, old.dimensions, old.document_owner_name) then
    new.verification_status := 'pending';
    new.verification_note := null;
    new.verified_at := null;
  else
    new.verification_status := old.verification_status;
    new.verification_note := old.verification_note;
    new.verified_at := old.verified_at;
  end if;
  return new;
end $$;

create trigger listings_guard_verification
  before insert or update on listings
  for each row execute function guard_listing_verification();

-- Uploading a new EC/Khata/RTC means the old verification no longer covers it.
create function reset_verification_on_proof_doc() returns trigger
  language plpgsql set search_path = public
  as $$
begin
  update listings set verification_status = 'pending'
    where id = new.listing_id and verification_status <> 'pending';
  return new;
end $$;

create trigger listing_documents_reset_verification
  after insert on listing_documents
  for each row when (new.doc_type in ('khata', 'rtc', 'ec'))
  execute function reset_verification_on_proof_doc();

-- Sellers see how many buyers swiped right on each of their listings --
-- a count only, never who.
create function my_listing_interest()
  returns table (listing_id uuid, interested bigint)
  language sql stable security definer set search_path = public
  as $$
    select s.listing_id, count(*)
    from swipes s
    join listings l on l.id = s.listing_id
    where l.seller_id = auth.uid() and s.direction = 'right'
    group by s.listing_id
  $$;
grant execute on function my_listing_interest() to authenticated;

-- ---------- Row Level Security ----------
-- Real auth exists (phone+password, backed by Supabase's email+password
-- auth under a synthetic address -- see src/lib/auth.js). Listings and
-- swipes are scoped to auth.uid() below. Listing images/documents are
-- scoped to "does this listing belong to me" via a subquery against
-- listings.seller_id -- see the insert/delete policies below.

alter table listings enable row level security;
alter table listing_images enable row level security;
alter table listing_documents enable row level security;
alter table swipes enable row level security;
alter table listing_contacts enable row level security;
alter table admins enable row level security;
alter table recovery_codes enable row level security;

-- Users can only check whether THEY are an admin.
create policy "own read admins" on admins for select using (auth.uid() = user_id);

-- Reads stay public: Home shows a live listing count with no login, and
-- Browse itself is not gated (see App.jsx) -- only publishing/swiping is.
create policy "public read listings" on listings for select using (true);
create policy "own insert listings" on listings for insert with check (auth.uid() = seller_id);
create policy "own update listings" on listings for update
  using (auth.uid() = seller_id) with check (auth.uid() = seller_id);
create policy "own delete listings" on listings for delete using (auth.uid() = seller_id);
-- Admins can update any listing (to set verification status/note).
create policy "admin update listings" on listings for update
  using (is_admin()) with check (is_admin());

create policy "read listing_contacts" on listing_contacts for select
  using (
    is_admin()
    or exists (
      select 1 from listings
      where listings.id = listing_contacts.listing_id
        and listings.seller_id = auth.uid()
    )
    or (
      exists (
        select 1 from listings
        where listings.id = listing_contacts.listing_id
          and listings.verification_status = 'verified'
      )
      and exists (
        select 1 from swipes
        where swipes.listing_id = listing_contacts.listing_id
          and swipes.buyer_id = auth.uid()
          and swipes.direction = 'right'
      )
    )
  );
create policy "own insert listing_contacts" on listing_contacts for insert
  with check (
    exists (
      select 1 from listings
      where listings.id = listing_contacts.listing_id
        and listings.seller_id = auth.uid()
    )
  );

create policy "public read listing_images" on listing_images for select using (true);
create policy "own insert listing_images" on listing_images for insert
  with check (
    exists (
      select 1 from listings
      where listings.id = listing_images.listing_id
        and listings.seller_id = auth.uid()
    )
  );
create policy "own delete listing_images" on listing_images for delete
  using (
    exists (
      select 1 from listings
      where listings.id = listing_images.listing_id
        and listings.seller_id = auth.uid()
    )
  );

-- Documents: readable ONLY by admins (the in-app Review page) -- never by
-- the seller who uploaded them, and never by buyers. Insert/delete are
-- scoped to whoever owns the parent listing.
create policy "admin read listing_documents" on listing_documents for select
  using (is_admin());
create policy "own insert listing_documents" on listing_documents for insert
  with check (
    exists (
      select 1 from listings
      where listings.id = listing_documents.listing_id
        and listings.seller_id = auth.uid()
    )
  );
create policy "own delete listing_documents" on listing_documents for delete
  using (
    exists (
      select 1 from listings
      where listings.id = listing_documents.listing_id
        and listings.seller_id = auth.uid()
    )
  );

create policy "own read swipes" on swipes for select using (auth.uid() = buyer_id);
create policy "own insert swipes" on swipes for insert with check (auth.uid() = buyer_id);
create policy "own update swipes" on swipes for update using (auth.uid() = buyer_id);
create policy "own delete swipes" on swipes for delete using (auth.uid() = buyer_id);

-- ---------- Storage object policies ----------
-- Bucket-level only, not ownership-scoped -- storage.objects has no
-- visibility into the app's listing_id relationships, so the real
-- ownership check happens at the table level above (listing_images /
-- listing_documents RLS). This matches the existing upload policies'
-- precedent below.

create policy "public read land-images" on storage.objects for select
  using (bucket_id = 'land-images');
create policy "public upload land-images" on storage.objects for insert
  with check (bucket_id = 'land-images');
create policy "public delete land-images" on storage.objects for delete
  using (bucket_id = 'land-images');

create policy "public upload land-documents" on storage.objects for insert
  with check (bucket_id = 'land-documents');
create policy "admin read land-documents" on storage.objects for select
  using (bucket_id = 'land-documents' and public.is_admin());
