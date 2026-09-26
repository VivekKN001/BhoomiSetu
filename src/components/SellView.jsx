import { useRef, useState } from "react";
import { ShieldCheck, Upload, ImagePlus, FileText, MapPin, Ruler, Heart } from "lucide-react";
import { LOCALITIES } from "../data/localities.js";
import { PROPERTY_TYPES, EC_DOC, requiredDocLabels } from "../data/propertyTypes.js";
import { pricePerSqft, priceCheck, inr } from "../lib/pricing.js";
import { placeholderImage } from "../lib/image.js";
import { parseDimensionsArea } from "../lib/dimensions.js";
import {
  createListing,
  updateListing,
  addListingImages,
  removeListingImages,
  ensurePrimaryImage,
  replaceListingDocuments,
  deleteListing,
  requestReReview,
} from "../lib/storage.js";
import Badge, { VerificationBadge } from "./Badge.jsx";
import ListingDetail from "./ListingDetail.jsx";

const EMPTY_FORM = {
  title: "",
  location: LOCALITIES[0],
  type: "site",
  unit: "sqft",
  area: "",
  dimensions: "",
  price: "",
  advantagesText: "",
  description: "",
  documentOwnerName: "",
};

// interest: { [listingId]: number of buyers who swiped right } -- counts
// only, buyer identities are never shown to sellers.
export default function SellView({ listings, interest, onChange, setView, user }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingListing, setEditingListing] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [imageFiles, setImageFiles] = useState([]);
  const [removedImageIds, setRemovedImageIds] = useState([]);
  const [typeDocFile, setTypeDocFile] = useState(null);
  const [ecFile, setEcFile] = useState(null);
  const [taxReceiptFile, setTaxReceiptFile] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [detail, setDetail] = useState(null);
  const [reReviewingId, setReReviewingId] = useState(null);
  const fileRef = useRef(null);
  const typeDocRef = useRef(null);
  const ecRef = useRef(null);
  const taxReceiptRef = useRef(null);

  const myListings = listings.filter((l) => l.sellerId === user.id);
  const formVisible = showCreateForm || editingListing !== null;
  const typeInfo = PROPERTY_TYPES.find((p) => p.id === form.type);
  const ownerDocNames = requiredDocLabels(typeInfo).join(" / ");

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleAreaChange = (value) => setForm((f) => ({ ...f, area: value, dimensions: "" }));

  const handleDimensionsChange = (text) => {
    const area = parseDimensionsArea(text);
    setForm((f) => ({ ...f, dimensions: text, area: area != null ? String(area) : f.area }));
  };

  const handleTypeChange = (id) => {
    const prev = PROPERTY_TYPES.find((p) => p.id === form.type);
    const next = PROPERTY_TYPES.find((p) => p.id === id);
    setForm((f) => ({
      ...f,
      type: id,
      unit: next.unit,
      dimensions: next.unit === "sqft" ? f.dimensions : "",
    }));
    if (prev.typeDocType !== next.typeDocType) setTypeDocFile(null);
  };

  const remainingExisting = editingListing
    ? editingListing.imageRecords.filter((r) => !removedImageIds.includes(r.id))
    : [];
  const capRoom = editingListing ? Math.max(0, 3 - remainingExisting.length) : 3;

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []).slice(0, capRoom);
    setImageFiles(files);
  };

  const draft = {
    id: "draft",
    location: form.location,
    unit: form.unit,
    area: form.area,
    price: form.price,
  };
  const canPreview = form.location && form.area && form.price;
  const check = canPreview ? priceCheck(draft, listings) : null;

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setImageFiles([]);
    setRemovedImageIds([]);
    setTypeDocFile(null);
    setEcFile(null);
    setTaxReceiptFile(null);
    setErrorMsg(null);
    setPublished(false);
  };

  const startCreate = () => {
    setEditingListing(null);
    resetForm();
    setShowCreateForm(true);
  };

  const startEdit = (listing) => {
    setEditingListing(listing);
    setShowCreateForm(false);
    setForm({
      title: listing.title,
      location: listing.location,
      type: listing.type,
      unit: listing.unit,
      area: String(listing.area),
      dimensions: listing.dimensions || "",
      price: String(listing.price),
      advantagesText: (listing.advantages || []).join(", "),
      description: listing.description || "",
      documentOwnerName: listing.documentOwnerName || "",
    });
    setImageFiles([]);
    setRemovedImageIds([]);
    setTypeDocFile(null);
    setEcFile(null);
    setTaxReceiptFile(null);
    setErrorMsg(null);
    setPublished(false);
  };

  const cancelForm = () => {
    setEditingListing(null);
    setShowCreateForm(false);
    resetForm();
  };

  const handleDelete = async (listing) => {
    if (!window.confirm(`Delete "${listing.title}"? This can't be undone.`)) return;
    setDeletingId(listing.id);
    try {
      await deleteListing(listing);
      await onChange();
    } catch (e) {
      setErrorMsg(e.message || "Could not delete this listing.");
    }
    setDeletingId(null);
  };

  const handleReReview = async (listing) => {
    setReReviewingId(listing.id);
    try {
      await requestReReview(listing.id);
      await onChange();
    } catch (e) {
      setErrorMsg(e.message || "Could not send this listing for review.");
    }
    setReReviewingId(null);
  };

  const handleSubmit = async () => {
    if (!form.title || !form.area || !form.price) {
      setErrorMsg("Please fill in every field before publishing.");
      return;
    }
    if (!form.documentOwnerName.trim()) {
      setErrorMsg(`Please enter the owner's name exactly as it appears on the ${ownerDocNames}.`);
      return;
    }
    if (!editingListing && !ecFile) {
      setErrorMsg(`Please upload the ${EC_DOC.label} before publishing.`);
      return;
    }
    if (!editingListing && typeInfo.typeDocRequired && !typeDocFile) {
      setErrorMsg(`Please upload the ${typeInfo.typeDocLabel} before publishing.`);
      return;
    }
    setErrorMsg(null);
    setPublishing(true);
    const advantages = form.advantagesText.split(",").map((s) => s.trim()).filter(Boolean);
    const documents = [
      { docType: EC_DOC.docType, file: ecFile },
      { docType: typeInfo.typeDocType, file: typeDocFile },
      { docType: "tax_receipt", file: taxReceiptFile },
    ];
    try {
      if (editingListing) {
        await updateListing(editingListing.id, {
          ...form,
          advantages,
          documentOwnerName: form.documentOwnerName.trim(),
        });
        if (imageFiles.length) await addListingImages(editingListing.id, imageFiles);
        if (removedImageIds.length) {
          await removeListingImages(
            editingListing.imageRecords.filter((r) => removedImageIds.includes(r.id))
          );
        }
        if (imageFiles.length || removedImageIds.length) {
          await ensurePrimaryImage(editingListing.id);
        }
        await replaceListingDocuments(editingListing.id, documents);
        await onChange();
        setEditingListing(null);
        setShowCreateForm(false);
      } else {
        await createListing(
          {
            title: form.title,
            location: form.location,
            type: form.type,
            unit: form.unit,
            area: form.area,
            dimensions: form.dimensions,
            price: form.price,
            advantages,
            description: form.description,
            documentOwnerName: form.documentOwnerName.trim(),
          },
          { id: user.id, fullName: user.fullName, phoneDisplay: user.phoneDisplay },
          imageFiles,
          documents
        );
        await onChange();
        setPublished(true);
      }
    } catch (e) {
      setErrorMsg(e.message || "Something went wrong saving this listing.");
    }
    setPublishing(false);
  };

  if (published) {
    return (
      <div className="panel centerPanel">
        <ShieldCheck size={40} color="#2F6E6E" />
        <h2>Listing published</h2>
        <p>
          Buyers can discover it in Browse right away. We'll check your ownership documents next — your
          number is only shared with interested buyers once that's done.
        </p>
        <button className="btn btnPrimary" onClick={() => { setPublished(false); setShowCreateForm(false); }}>
          Back to your listings
        </button>
        <button className="btn btnGhost" onClick={() => setView("buy")}>See it in Browse</button>
      </div>
    );
  }

  if (!formVisible) {
    return (
      <div className="panel">
        <h2>Your listings</h2>
        {myListings.length === 0 ? (
          <p className="subtext">You haven't listed any land yet.</p>
        ) : (
          <div className="matchList">
            {myListings.map((l) => (
              <div key={l.id} className="matchCard">
                <img src={l.images[0] || placeholderImage(l.id, l.location)} alt="" />
                <div className="matchInfo">
                  <h4>{l.title}</h4>
                  <div className="locRow"><MapPin size={13} /> {l.location}</div>
                  <div className="statsRow small">
                    <span>{inr(l.price)}</span>
                    <span>{l.area} {l.unit}{l.dimensions ? ` (${l.dimensions} ft)` : ""}</span>
                  </div>
                  <div className="interestRow">
                    <Heart size={13} />
                    {interest[l.id]
                      ? `${interest[l.id]} interested buyer${interest[l.id] === 1 ? "" : "s"}`
                      : "No interested buyers yet"}
                  </div>
                  <VerificationBadge status={l.verificationStatus} />
                  {l.verificationStatus === "pending" && (
                    <p className="lockNote">Buyers can shortlist this, but your number stays hidden until we verify your documents.</p>
                  )}
                  {l.verificationStatus === "rejected" && (
                    <p className="lockNote">
                      <span>
                        Hidden from buyers.
                        {l.verificationNote && <><br /><strong>Reason:</strong> {l.verificationNote}<br /></>}{" "}
                        Fix the listing or upload a corrected document, then ask for another review.
                      </span>
                    </p>
                  )}
                  <div className="matchBtns">
                    <button className="btn btnGhost sm" onClick={() => setDetail(l)}>Details</button>
                    <button className="btn btnGhost sm" onClick={() => startEdit(l)}>Edit</button>
                    {l.verificationStatus === "rejected" && (
                      <button
                        className="btn btnGhost sm"
                        disabled={reReviewingId === l.id}
                        onClick={() => handleReReview(l)}
                      >
                        {reReviewingId === l.id ? "Sending…" : "Request review"}
                      </button>
                    )}
                    <button
                      className="btn btnGhost sm"
                      disabled={deletingId === l.id}
                      onClick={() => handleDelete(l)}
                    >
                      {deletingId === l.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {errorMsg && <p style={{ color: "#9A3412", fontSize: 13, margin: "10px 0" }}>{errorMsg}</p>}
        <button className="btn btnPrimary wide" onClick={startCreate}>
          + List new land
        </button>
        {detail && <ListingDetail listing={detail} listings={listings} onClose={() => setDetail(null)} />}
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>{editingListing ? "Edit listing" : "List your land"}</h2>
      <p className="subtext">Fill in the details buyers actually need. We'll check your price against nearby listings before you publish.</p>
      <p className="subtext">Publishing as <strong>{user.fullName}</strong> · {user.phoneDisplay}</p>

      <label className="field">
        <span>Title</span>
        <input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Corner site near Ring Road" />
      </label>

      <div className="fieldRow">
        <label className="field">
          <span>Locality</span>
          <select value={form.location} onChange={(e) => update("location", e.target.value)}>
            {LOCALITIES.map((l) => <option key={l}>{l}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Type</span>
          <select value={form.type} onChange={(e) => handleTypeChange(e.target.value)}>
            {PROPERTY_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
      </div>

      <div className="fieldRow">
        <label className="field">
          <span>Area ({form.unit})</span>
          <input type="number" value={form.area} onChange={(e) => handleAreaChange(e.target.value)} placeholder={form.unit === "acres" ? "2" : "2400"} />
        </label>
        <label className="field">
          <span>Asking price (₹, total)</span>
          <input type="number" value={form.price} onChange={(e) => update("price", e.target.value)} placeholder="9600000" />
        </label>
      </div>

      {form.unit === "sqft" && (
        <label className="field">
          <span><Ruler size={12} style={{ verticalAlign: "-1px" }} /> Dimensions in feet, e.g. 60x30 (optional)</span>
          <input value={form.dimensions} onChange={(e) => handleDimensionsChange(e.target.value)} placeholder="60x30" />
        </label>
      )}

      {canPreview && check && (
        <div className="pricePreview">
          <div className="ppRow">
            <span>Rate</span>
            <strong>₹{Math.round(pricePerSqft(draft)).toLocaleString("en-IN")} / sqft</strong>
          </div>
          <Badge status={check.status} label={check.label} />
        </div>
      )}

      <label className="field">
        <span>Description (optional)</span>
        <textarea
          rows={4}
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Road width, what's nearby, water/electricity, approvals, anything a buyer would ask you on the phone"
        />
      </label>

      <label className="field">
        <span>Advantages (comma separated)</span>
        <input value={form.advantagesText} onChange={(e) => update("advantagesText", e.target.value)} placeholder="Corner plot, wide road, borewell" />
      </label>

      <label className="field">
        <span>Photos (up to 3)</span>
        {editingListing && remainingExisting.length > 0 && (
          <div className="thumbRow">
            {remainingExisting.map((img) => (
              <div key={img.id} className="thumbWrap">
                <img src={img.url} alt="" className="thumb" />
                <button
                  type="button"
                  className="thumbRemove"
                  onClick={() => setRemovedImageIds((ids) => [...ids, img.id])}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="uploadBtn" disabled={capRoom === 0} onClick={() => fileRef.current?.click()}>
          <ImagePlus size={16} /> {imageFiles.length ? `${imageFiles.length} new photo(s) selected` : "Add photos"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
        {imageFiles.length > 0 && (
          <div className="thumbRow">
            {imageFiles.map((f, i) => (
              <img key={i} src={URL.createObjectURL(f)} alt="" className="thumb" />
            ))}
          </div>
        )}
      </label>

      <label className="field">
        <span>Owner name as printed on the {ownerDocNames}</span>
        <input
          value={form.documentOwnerName}
          onChange={(e) => update("documentOwnerName", e.target.value)}
          placeholder="e.g. Ramesh Kumar K."
        />
        <small className="passwordHint">
          We compare this with your document and your account name ({user.fullName}) before sharing your number
          with buyers. Changing it later sends the listing back for review.
        </small>
      </label>

      <div className="docCategoryNote">
        <FileText size={13} /> <strong>{typeInfo.category} property</strong> — required:{" "}
        {requiredDocLabels(typeInfo).join(" + ")}
        {!typeInfo.typeDocRequired && <>; {typeInfo.typeDocLabel} optional</>}
      </div>

      <label className="field">
        <span>
          {editingListing
            ? `Replace ${EC_DOC.label} (optional — leave blank to keep what's on file)`
            : `${EC_DOC.label} (required, private — not shown to buyers)`}
        </span>
        <button type="button" className="uploadBtn" onClick={() => ecRef.current?.click()}>
          <FileText size={16} /> {ecFile ? ecFile.name : "Add document"}
        </button>
        <input ref={ecRef} type="file" accept="image/*,.pdf" hidden onChange={(e) => setEcFile(e.target.files?.[0] || null)} />
      </label>

      <label className="field">
        <span>
          {editingListing
            ? `Replace ${typeInfo.typeDocLabel} (optional — leave blank to keep what's on file)`
            : `${typeInfo.typeDocLabel} (${typeInfo.typeDocRequired ? "required" : "optional"}, private — not shown to buyers)`}
        </span>
        <button type="button" className="uploadBtn" onClick={() => typeDocRef.current?.click()}>
          <FileText size={16} /> {typeDocFile ? typeDocFile.name : "Add document"}
        </button>
        <input ref={typeDocRef} type="file" accept="image/*,.pdf" hidden onChange={(e) => setTypeDocFile(e.target.files?.[0] || null)} />
      </label>

      <label className="field">
        <span>
          {editingListing
            ? "Replace Property Tax Receipt (optional — leave blank to keep what's on file)"
            : "Property Tax Receipt (optional, private — not shown to buyers)"}
        </span>
        <button type="button" className="uploadBtn" onClick={() => taxReceiptRef.current?.click()}>
          <FileText size={16} /> {taxReceiptFile ? taxReceiptFile.name : "Add document"}
        </button>
        <input ref={taxReceiptRef} type="file" accept="image/*,.pdf" hidden onChange={(e) => setTaxReceiptFile(e.target.files?.[0] || null)} />
      </label>

      {errorMsg && <p style={{ color: "#9A3412", fontSize: 13, marginBottom: 10 }}>{errorMsg}</p>}

      <div className="fieldRow">
        <button className="btn btnPrimary wide" onClick={handleSubmit} disabled={publishing}>
          <Upload size={16} /> {publishing ? "Saving…" : editingListing ? "Save changes" : "Publish listing"}
        </button>
        <button type="button" className="btn btnGhost" onClick={cancelForm} disabled={publishing}>
          Cancel
        </button>
      </div>
    </div>
  );
}
