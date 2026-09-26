import { supabase } from "./supabaseClient.js";

const IMAGE_BUCKET = "land-images";
const DOC_BUCKET = "land-documents";

function formatListing(row) {
  const imageRecords = (row.listing_images || [])
    .slice()
    .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
    .map((img) => ({
      id: img.id,
      storagePath: img.storage_path,
      isPrimary: img.is_primary,
      url: supabase.storage.from(IMAGE_BUCKET).getPublicUrl(img.storage_path).data.publicUrl,
    }));
  return {
    id: row.id,
    sellerId: row.seller_id,
    title: row.title,
    location: row.location,
    type: row.type,
    unit: row.unit,
    area: row.area,
    dimensions: row.dimensions,
    price: row.price,
    advantages: row.advantages || [],
    description: row.description || "",
    sellerName: row.seller_name,
    documentOwnerName: row.document_owner_name || "",
    verificationStatus: row.verification_status,
    verificationNote: row.verification_note,
    images: imageRecords.map((r) => r.url),
    imageRecords,
    createdAt: row.created_at,
  };
}

export async function fetchListings() {
  const { data, error } = await supabase
    .from("listings")
    .select("*, listing_images(id, storage_path, is_primary)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(formatListing);
}

async function uploadImages(listingId, files, { firstIsPrimary }) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const path = `${listingId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file);
    if (upErr) throw upErr;
    const { error: rowErr } = await supabase
      .from("listing_images")
      .insert({ listing_id: listingId, storage_path: path, is_primary: firstIsPrimary && i === 0 });
    if (rowErr) throw rowErr;
  }
}

async function uploadDocument(listingId, docType, file) {
  const path = `${listingId}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from(DOC_BUCKET).upload(path, file);
  if (upErr) throw upErr;
  const { error: rowErr } = await supabase
    .from("listing_documents")
    .insert({ listing_id: listingId, storage_path: path, doc_type: docType });
  if (rowErr) throw rowErr;
}

// imageFiles: array of File objects from <input type="file">
// documents: [{ docType, file }] -- entries with no file are skipped.
// seller: { id, fullName, phoneDisplay } -- the logged-in user (see lib/auth.js)
export async function createListing(form, seller, imageFiles = [], documents = []) {
  const { data: row, error } = await supabase
    .from("listings")
    .insert({
      title: form.title,
      location: form.location,
      type: form.type,
      unit: form.unit,
      area: Number(form.area),
      dimensions: form.dimensions || null,
      price: Number(form.price),
      advantages: form.advantages,
      description: form.description || null,
      document_owner_name: form.documentOwnerName,
      seller_id: seller.id,
      seller_name: seller.fullName,
    })
    .select()
    .single();
  if (error) throw error;

  const { error: contactErr } = await supabase
    .from("listing_contacts")
    .insert({ listing_id: row.id, seller_phone: seller.phoneDisplay });
  if (contactErr) throw contactErr;

  await uploadImages(row.id, imageFiles, { firstIsPrimary: true });

  for (const { docType, file } of documents) {
    if (file) await uploadDocument(row.id, docType, file);
  }

  return row.id;
}

export async function updateListing(listingId, form) {
  const { error } = await supabase
    .from("listings")
    .update({
      title: form.title,
      location: form.location,
      type: form.type,
      unit: form.unit,
      area: Number(form.area),
      dimensions: form.dimensions || null,
      price: Number(form.price),
      advantages: form.advantages,
      description: form.description || null,
      document_owner_name: form.documentOwnerName,
    })
    .eq("id", listingId);
  if (error) throw error;
}

// A rejected listing goes back into the review queue. Sellers can only
// ever move a listing TO 'pending' -- the guard_listing_verification
// trigger ignores any other status a non-admin tries to set.
export async function requestReReview(listingId) {
  const { error } = await supabase
    .from("listings")
    .update({ verification_status: "pending" })
    .eq("id", listingId);
  if (error) throw error;
}

// Keeps the denormalized seller_name on the user's own listings in step
// with a profile name change.
export async function updateSellerName(sellerId, fullName) {
  const { error } = await supabase
    .from("listings")
    .update({ seller_name: fullName })
    .eq("seller_id", sellerId);
  if (error) throw error;
}

// Never sets is_primary here -- see ensurePrimaryImage below.
export async function addListingImages(listingId, imageFiles) {
  await uploadImages(listingId, imageFiles, { firstIsPrimary: false });
}

// images: the subset of a listing's imageRecords staged for removal.
// Storage object removed first, then the DB row -- a partial failure
// leaves a stale row (safe to retry), never an orphaned storage object
// with no DB trace.
export async function removeListingImages(images) {
  if (!images.length) return;
  const { error: storageErr } = await supabase.storage
    .from(IMAGE_BUCKET)
    .remove(images.map((img) => img.storagePath));
  if (storageErr) throw storageErr;
  const { error: rowErr } = await supabase
    .from("listing_images")
    .delete()
    .in("id", images.map((img) => img.id));
  if (rowErr) throw rowErr;
}

// Idempotent: if the listing already has exactly one is_primary image,
// does nothing. If it has none (e.g. the old primary was just removed, or
// new photos were just added to a listing that had none), promotes the
// oldest remaining image. Call this once after any image add/remove --
// having the add and remove paths each guess independently can leave two
// images flagged primary at once.
export async function ensurePrimaryImage(listingId) {
  const { data, error } = await supabase
    .from("listing_images")
    .select("id, is_primary")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!data.length || data.some((r) => r.is_primary)) return;
  const { error: promoteErr } = await supabase
    .from("listing_images")
    .update({ is_primary: true })
    .eq("id", data[0].id);
  if (promoteErr) throw promoteErr;
}

// documents: [{ docType, file }] -- entries with no file are left
// completely untouched (that slot's existing row, if any, survives).
// Each entry WITH a file blind-deletes the existing row(s) for that
// specific listing_id + doc_type (still no select policy on
// listing_documents, by design -- the client can never SELECT them back)
// then uploads + inserts a fresh one. The OLD file in the land-documents
// bucket is NOT removed for any replaced slot -- without a select policy
// there's no way to learn its storage_path. Accepted, documented
// limitation.
export async function replaceListingDocuments(listingId, documents) {
  for (const { docType, file } of documents) {
    if (!file) continue;
    const { error: delErr } = await supabase
      .from("listing_documents")
      .delete()
      .eq("listing_id", listingId)
      .eq("doc_type", docType);
    if (delErr) throw delErr;
    await uploadDocument(listingId, docType, file);
  }
}

// listing: a formatted listing object (needs .id and .imageRecords). Known
// image storage objects are removed first; the listings row delete then
// cascades via FK to remove its listing_images/listing_documents/swipes
// rows automatically. Any file in the land-documents bucket is NOT
// cleaned up -- same blind-spot reason as replaceListingDocument.
export async function deleteListing(listing) {
  const paths = (listing.imageRecords || []).map((img) => img.storagePath);
  if (paths.length) {
    const { error: storageErr } = await supabase.storage.from(IMAGE_BUCKET).remove(paths);
    if (storageErr) throw storageErr;
  }
  const { error } = await supabase.from("listings").delete().eq("id", listing.id);
  if (error) throw error;
}

export async function fetchSwipes(buyerId) {
  const { data, error } = await supabase
    .from("swipes")
    .select("listing_id, direction")
    .eq("buyer_id", buyerId);
  if (error) throw error;
  return {
    liked: data.filter((s) => s.direction === "right").map((s) => s.listing_id),
    skipped: data.filter((s) => s.direction === "left").map((s) => s.listing_id),
  };
}

export async function recordSwipe(buyerId, listingId, direction) {
  const { error } = await supabase
    .from("swipes")
    .upsert(
      { buyer_id: buyerId, listing_id: listingId, direction },
      { onConflict: "buyer_id,listing_id" }
    );
  if (error) throw error;
}

export async function removeMatch(buyerId, listingId) {
  const { error } = await supabase
    .from("swipes")
    .delete()
    .eq("buyer_id", buyerId)
    .eq("listing_id", listingId);
  if (error) throw error;
}

// Returns { [listingId]: phone } for every contact the current user is
// allowed to see -- RLS limits this to their own listings, plus VERIFIED
// listings they swiped right on (and everything, for admins).
export async function fetchContacts() {
  const { data, error } = await supabase.from("listing_contacts").select("listing_id, seller_phone");
  if (error) throw error;
  return Object.fromEntries(data.map((c) => [c.listing_id, c.seller_phone]));
}

// Returns { [listingId]: count } of right-swipes on the current user's own
// listings. Counts only -- buyer identities are never exposed to sellers.
export async function fetchMyListingInterest() {
  const { data, error } = await supabase.rpc("my_listing_interest");
  if (error) throw error;
  return Object.fromEntries(data.map((r) => [r.listing_id, Number(r.interested)]));
}

export async function fetchIsAdmin(userId) {
  const { data, error } = await supabase.from("admins").select("user_id").eq("user_id", userId);
  if (error) throw error;
  return data.length > 0;
}

// Admin-only (RLS returns nothing for anyone else). Each document comes
// with a short-lived signed URL, since land-documents is a private bucket.
export async function fetchListingDocuments(listingId) {
  const { data, error } = await supabase
    .from("listing_documents")
    .select("id, doc_type, storage_path, created_at")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!data.length) return [];
  const { data: signed, error: signErr } = await supabase.storage
    .from(DOC_BUCKET)
    .createSignedUrls(data.map((d) => d.storage_path), 60 * 10);
  if (signErr) throw signErr;
  return data.map((d, i) => ({
    id: d.id,
    docType: d.doc_type,
    uploadedAt: d.created_at,
    url: signed[i]?.signedUrl || null,
  }));
}

// Admin-only: the "admin update listings" policy + guard trigger reject
// this for anyone else.
export async function setListingVerification(listingId, status, note) {
  const { error } = await supabase
    .from("listings")
    .update({
      verification_status: status,
      verification_note: note || null,
      verified_at: status === "verified" ? new Date().toISOString() : null,
    })
    .eq("id", listingId);
  if (error) throw error;
}
