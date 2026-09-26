-- Adds real auth (phone+password) on top of the schema.sql that's already
-- been run against this project. Run once in: Supabase project -> SQL
-- Editor -> New query -> Run.
--
-- Preserves `listings` (seller_id is left NULL on existing/seed rows).
-- Truncates `swipes` -- old buyer_anon_id values were random per-browser
-- strings with no relationship to a real account, so there's nothing
-- meaningful to migrate them to. This is pre-launch test data only.
--
-- Also requires a manual dashboard step this file can't do: go to
-- Authentication -> Providers -> Email and turn OFF "Confirm email".
-- Without that, signUp() will wait forever on confirming a synthetic
-- email address (see src/lib/auth.js) that's never actually sent anywhere.

alter table listings add column seller_id uuid references auth.users(id) on delete set null;

drop policy "public insert listings" on listings;
create policy "own insert listings" on listings for insert with check (auth.uid() = seller_id);

drop policy "public read swipes" on swipes;
drop policy "public insert swipes" on swipes;
drop policy "public update swipes" on swipes;
drop policy "public delete swipes" on swipes;

truncate table swipes;
alter table swipes drop column buyer_anon_id;
alter table swipes add column buyer_id uuid not null references auth.users(id) on delete cascade;
alter table swipes add constraint swipes_buyer_id_listing_id_key unique (buyer_id, listing_id);

create policy "own read swipes" on swipes for select using (auth.uid() = buyer_id);
create policy "own insert swipes" on swipes for insert with check (auth.uid() = buyer_id);
create policy "own update swipes" on swipes for update using (auth.uid() = buyer_id);
create policy "own delete swipes" on swipes for delete using (auth.uid() = buyer_id);
