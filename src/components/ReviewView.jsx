import { useState } from "react";
import { ShieldCheck, ShieldX, FileText, MapPin, AlertTriangle, CheckCircle2 } from "lucide-react";
import { inr } from "../lib/pricing.js";
import { namesMatch } from "../lib/nameMatch.js";
import { PROPERTY_TYPES, EC_DOC } from "../data/propertyTypes.js";
import { fetchListingDocuments, setListingVerification } from "../lib/storage.js";
import { VerificationBadge } from "./Badge.jsx";
import ListingDetail from "./ListingDetail.jsx";

const DOC_LABELS = {
  khata: "E-Khata",
  rtc: "RTC",
  ec: "Encumbrance Certificate",
  tax_receipt: "Property Tax Receipt",
};

const TABS = [
  { id: "pending", label: "Pending" },
  { id: "rejected", label: "Rejected" },
  { id: "verified", label: "Verified" },
];

// One listing in the queue. Documents are fetched on demand (signed URLs
// expire after 10 minutes, so fetching them all up front would go stale).
function ReviewCard({ listing, phone, onOpenDetail, onChange }) {
  const [docs, setDocs] = useState(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [note, setNote] = useState(listing.verificationNote || "");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const typeInfo = PROPERTY_TYPES.find((t) => t.id === listing.type);
  const ownerName = listing.documentOwnerName;
  const match = ownerName && namesMatch(ownerName, listing.sellerName);
  const missingDocs = docs
    ? [EC_DOC, typeInfo?.typeDocRequired && { docType: typeInfo.typeDocType, label: typeInfo.typeDocLabel }]
        .filter(Boolean)
        .filter((req) => !docs.some((d) => d.docType === req.docType))
    : [];

  const loadDocs = async () => {
    setLoadingDocs(true);
    setErrorMsg(null);
    try {
      setDocs(await fetchListingDocuments(listing.id));
    } catch (e) {
      setErrorMsg(e.message || "Could not load documents.");
    }
    setLoadingDocs(false);
  };

  const decide = async (status) => {
    if (status === "rejected" && !note.trim()) {
      setErrorMsg("Add a reason — the seller sees it and needs to know what to fix.");
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      await setListingVerification(listing.id, status, status === "rejected" ? note.trim() : null);
      await onChange();
    } catch (e) {
      setErrorMsg(e.message || "Could not save the decision.");
      setSaving(false);
    }
  };

  return (
    <div className="reviewCard">
      <div className="reviewHead">
        <div>
          <h4>{listing.title}</h4>
          <div className="locRow"><MapPin size={13} /> {listing.location} · {typeInfo?.label} · {inr(listing.price)}</div>
        </div>
        <VerificationBadge status={listing.verificationStatus} />
      </div>

      <dl className="reviewFacts">
        <dt>Account name</dt>
        <dd>{listing.sellerName}{phone ? ` · ${phone}` : ""}{!listing.sellerId && " (seed data, no account)"}</dd>
        <dt>Owner on document</dt>
        <dd>{ownerName || <em>not provided</em>}</dd>
      </dl>
      {ownerName ? (
        match ? (
          <p className="okText"><CheckCircle2 size={13} /> Names look alike — still check them against the document.</p>
        ) : (
          <p className="errorText"><AlertTriangle size={13} /> Names differ — possible agent or family member listing. Check carefully.</p>
        )
      ) : (
        <p className="errorText"><AlertTriangle size={13} /> Seller hasn't declared the owner name yet.</p>
      )}

      {docs === null ? (
        <button className="btn btnGhost sm" onClick={loadDocs} disabled={loadingDocs}>
          <FileText size={14} /> {loadingDocs ? "Loading…" : "Show documents"}
        </button>
      ) : docs.length === 0 ? (
        <p className="errorText">No documents uploaded.</p>
      ) : (
        <ul className="docList">
          {docs.map((d) => (
            <li key={d.id}>
              <FileText size={13} />{" "}
              {d.url ? (
                <a href={d.url} target="_blank" rel="noreferrer">{DOC_LABELS[d.docType] || d.docType}</a>
              ) : (
                DOC_LABELS[d.docType] || d.docType
              )}{" "}
              <span className="muted">· {new Date(d.uploadedAt).toLocaleDateString("en-IN")}</span>
            </li>
          ))}
        </ul>
      )}
      {missingDocs.length > 0 && (
        <p className="errorText"><AlertTriangle size={13} /> Missing the required {missingDocs.map((d) => d.label).join(" and ")}.</p>
      )}

      <label className="field" style={{ marginTop: 10 }}>
        <span>Reason (required to reject — shown to the seller)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Owner name on the EC doesn't match" />
      </label>
      {errorMsg && <p className="errorText">{errorMsg}</p>}
      <div className="matchBtns">
        <button className="btn btnGhost sm" onClick={onOpenDetail}>Details</button>
        {listing.verificationStatus !== "verified" && (
          <button className="btn btnPrimary sm" disabled={saving} onClick={() => decide("verified")}>
            <ShieldCheck size={14} /> Approve
          </button>
        )}
        {listing.verificationStatus !== "rejected" && (
          <button className="btn btnGhost sm" disabled={saving} onClick={() => decide("rejected")}>
            <ShieldX size={14} /> Reject
          </button>
        )}
      </div>
    </div>
  );
}

export default function ReviewView({ listings, contacts, onChange }) {
  const [tab, setTab] = useState("pending");
  const [detail, setDetail] = useState(null);
  const shown = listings.filter((l) => l.verificationStatus === tab);
  const counts = Object.fromEntries(TABS.map((t) => [t.id, listings.filter((l) => l.verificationStatus === t.id).length]));

  return (
    <div className="panel">
      <h2>Ownership review</h2>
      <p className="subtext">
        Approving a listing unlocks the seller's phone number for buyers who shortlisted it. Rejected listings are
        hidden from Browse.
      </p>
      <div className="chips typeChips">
        {TABS.map((t) => (
          <button key={t.id} className={`chip chipBtn ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>
            {t.label} ({counts[t.id]})
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="subtext" style={{ marginTop: 16 }}>Nothing here.</p>
      ) : (
        <div className="matchList" style={{ marginTop: 14 }}>
          {shown.map((l) => (
            <ReviewCard
              key={`${l.id}-${l.verificationStatus}`}
              listing={l}
              phone={contacts[l.id]}
              onOpenDetail={() => setDetail(l)}
              onChange={onChange}
            />
          ))}
        </div>
      )}
      {detail && <ListingDetail listing={detail} listings={listings} onClose={() => setDetail(null)} />}
    </div>
  );
}
