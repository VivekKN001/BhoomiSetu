-- Adds seller listing management (edit/delete a published listing) on top
-- of schema.sql + 002_add_phone_auth.sql, both already run against this project.
-- Run once in: Supabase project -> SQL Editor -> New query -> Run.
--
-- Adds update/delete policies on `listings` (previously insert-only -- once
-- published, a listing could not be changed or removed at all). Also
-- tightens `listing_images`/`listing_documents` insert from a fully-open
-- `with check (true)` to ownership-scoped (auth.uid() must own the parent
-- listing), and adds matching delete policies on both. Also adds a delete
-- policy on the land-images storage bucket -- none existed before, and the
-- app now calls storage.remove() for the first time (to clean up image
-- files when a photo is removed or a listing is deleted).
--
-- `listing_documents` deliberately still has NO select policy -- that's
-- unchanged, by design (see schema.sql comment); this migration does not
-- touch it, and does not add a delete policy on the land-documents
-- storage bucket either (replacing/deleting a document orphans the old
-- file in storage -- an accepted, documented limitation, see
-- src/lib/storage.js).
--
-- No manual dashboard step required for this one.

create policy "own update listings" on listings for update
  using (auth.uid() = seller_id) with check (auth.uid() = seller_id);
create policy "own delete listings" on listings for delete
  using (auth.uid() = seller_id);

drop policy "public insert listing_images" on listing_images;
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

drop policy "public insert listing_documents" on listing_documents;
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

create policy "public delete land-images" on storage.objects for delete
  using (bucket_id = 'land-images');
