-- Adds, on top of an already-provisioned project (schema.sql + 002-004):
--   * listings.description                -- free-text shown on the detail view
--   * owner verification                  -- admins table, is_admin(), per-listing
--                                            verification status + review note,
--                                            seller-declared document owner name
--   * listing_contacts                    -- seller phone moved OUT of the
--                                            publicly-readable listings table;
--                                            readable only by the seller, admins,
--                                            and buyers who swiped right on a
--                                            VERIFIED listing
--   * my_listing_interest()               -- sellers see how many buyers swiped
--                                            right, never who
--   * recovery_codes                      -- forgot-password via one-time
--                                            recovery code (Edge Function only)
--
-- Run once in: Supabase project -> SQL Editor -> New query -> Run.
-- Wrapped in a transaction: if anything fails, nothing is applied.
--
-- After running, make yourself an admin (see the bottom of this file).

begin;

-- ---------- Listing description ----------

alter table listings add column description text;

-- ---------- Admins ----------

create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table admins enable row level security;
-- Users can only check whether THEY are an admin. No insert policy: admins
-- are added by hand in the SQL Editor.
create policy "own read admins" on admins for select using (auth.uid() = user_id);

create function is_admin() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from admins where user_id = auth.uid()) $$;

-- ---------- Owner verification ----------

alter table listings add column document_owner_name text;
alter table listings add column verification_status text not null default 'pending'
  check (verification_status in ('pending', 'verified', 'rejected'));
alter table listings add column verification_note text;
alter table listings add column verified_at timestamptz;

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

-- Uploading a new Khata/RTC means the old verification no longer covers it.
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
  for each row when (new.doc_type in ('khata', 'rtc'))
  execute function reset_verification_on_proof_doc();

-- Admins can update any listing (to set verification status/note).
create policy "admin update listings" on listings for update
  using (is_admin()) with check (is_admin());

-- Admins can read documents -- the deliberate verification flow CLAUDE.md
-- said to build before ever adding a read policy here. Still no read
-- access for anyone else.
create policy "admin read listing_documents" on listing_documents for select
  using (is_admin());
create policy "admin read land-documents" on storage.objects for select
  using (bucket_id = 'land-documents' and public.is_admin());

-- ---------- Seller contact, moved out of listings ----------

create table listing_contacts (
  listing_id uuid primary key references listings(id) on delete cascade,
  seller_phone text not null
);
insert into listing_contacts (listing_id, seller_phone)
  select id, seller_phone from listings;
alter table listings drop column seller_phone;

alter table listing_contacts enable row level security;
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

-- ---------- Seller interest counts ----------

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

-- ---------- Password recovery codes ----------
-- RLS on, no policies: only the account-recovery Edge Function (service
-- role) can touch this table. Stores a SHA-256 hash, never the code.
create table recovery_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  login_email text not null unique,
  code_hash text not null,
  created_at timestamptz not null default now()
);
alter table recovery_codes enable row level security;

commit;

-- ---------- Make yourself an admin ----------
-- Sign up in the app first, then run this separately (NOT together with
-- the migration above). Replace all ten X's with your 10-digit mobile
-- number -- digits only, keep the leading 91, e.g.
-- '919000000001@bhoomisetu.local':
--
--   insert into admins (user_id)
--     select id from auth.users where email = '91XXXXXXXXXX@bhoomisetu.local'
--   on conflict (user_id) do nothing;
--
-- Check it worked (should return one row with your name):
--
--   select u.email, u.raw_user_meta_data->>'full_name' as full_name
--   from admins a join auth.users u on u.id = a.user_id;
