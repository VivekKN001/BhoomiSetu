-- Encumbrance Certificate is now the required proof document for every
-- listing (RTC stays required for agri; E-Khata becomes optional for
-- site/commercial -- enforced in SellView, see src/data/propertyTypes.js).
-- Since the EC is now proof of ownership, uploading a new one must send the
-- listing back for review, same as a new Khata/RTC. Run once in: Supabase
-- project -> SQL Editor -> New query -> Run.

drop trigger listing_documents_reset_verification on listing_documents;

create trigger listing_documents_reset_verification
  after insert on listing_documents
  for each row when (new.doc_type in ('khata', 'rtc', 'ec'))
  execute function reset_verification_on_proof_doc();
