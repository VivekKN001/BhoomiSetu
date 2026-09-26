-- Adds type-based mandatory verification documents (Khata Certificate for
-- site/commercial listings, RTC for agri listings) plus two always-optional
-- slots (Encumbrance Certificate, Property Tax Receipt), replacing the
-- single generic "title deed" document slot. Also adds `listings.dimensions`
-- for the new Dimensions companion field. Run once in: Supabase project ->
-- SQL Editor -> New query -> Run.
--
-- `listing_documents.doc_type` previously had no CHECK constraint (just a
-- 'title_deed' default) and this project already has pre-launch test rows
-- using that value. Remap each to whichever of khata/rtc matches its
-- listing's type -- best-effort recovery of intent, consistent with how
-- sql/migrations/002_add_phone_auth.sql truncated `swipes` for the same "pre-launch test
-- data" reason -- before adding the constraint.
--
-- RLS policies on listing_documents are untouched: ownership scoping is
-- per listing_id via the existing subquery, which is orthogonal to
-- doc_type -- ownership doesn't need to know which doc_type is being
-- written. Nor does this touch the land-documents storage bucket policies.
--
-- No manual dashboard step required for this one.

update listing_documents ld
set doc_type = case l.type when 'agri' then 'rtc' else 'khata' end
from listings l
where l.id = ld.listing_id
  and ld.doc_type = 'title_deed';

alter table listing_documents alter column doc_type drop default;
alter table listing_documents add constraint listing_documents_doc_type_check
  check (doc_type in ('khata', 'rtc', 'ec', 'tax_receipt'));

alter table listings add column dimensions text;
