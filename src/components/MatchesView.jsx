import { useState } from "react";
import { Users, MapPin, Phone, Clock, ShieldX } from "lucide-react";
import { inr } from "../lib/pricing.js";
import { placeholderImage } from "../lib/image.js";
import { VerificationBadge } from "./Badge.jsx";
import ListingDetail from "./ListingDetail.jsx";

// tel: links only accept digits and a leading "+" -- strip the spaces we
// store the number with for display (e.g. "+91 90000 00001").
function telHref(phone) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

// contacts: { [listingId]: phone } -- the database only returns a phone
// for VERIFIED listings this buyer swiped right on (listing_contacts RLS),
// so a missing entry here means "not unlocked yet", not a bug.
function ContactRow({ listing, phone }) {
  if (phone) {
    return (
      <>
        <div className="sellerRow"><span>{listing.sellerName} · {phone}</span></div>
        <a className="btn btnPrimary sm" href={telHref(phone)}>
          <Phone size={14} /> Call seller
        </a>
      </>
    );
  }
  if (listing.verificationStatus === "rejected") {
    return (
      <p className="lockNote">
        <ShieldX size={13} /> This listing failed ownership verification, so the seller's contact won't be shared.
      </p>
    );
  }
  if (listing.verificationStatus === "verified") {
    // Approved after this page loaded -- the contact arrives on next refresh.
    return (
      <p className="lockNote">
        <Clock size={13} /> Ownership just verified — reopen the app to see the seller's number.
      </p>
    );
  }
  return (
    <p className="lockNote">
      <Clock size={13} /> Contact unlocks once we've verified {listing.sellerName} owns this land.
    </p>
  );
}

export default function MatchesView({ listings, swipes, contacts, onUnmatch }) {
  const [detail, setDetail] = useState(null);
  const liked = listings.filter((l) => swipes.liked.includes(l.id));

  if (liked.length === 0) {
    return (
      <div className="panel centerPanel">
        <Users size={36} color="#2F6E6E" />
        <h2>No matches yet</h2>
        <p>Swipe right on land you're interested in — the seller's contact unlocks here once their ownership is verified.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>Your matches</h2>
      <p className="subtext">
        Contact is only shared once you've shown interest <em>and</em> we've checked the seller's ownership documents.
      </p>
      <div className="matchList">
        {liked.map((l) => (
          <div key={l.id} className="matchCard">
            <img src={l.images[0] || placeholderImage(l.id, l.location)} alt="" onClick={() => setDetail(l)} className="clickable" />
            <div className="matchInfo">
              <h4>{l.title}</h4>
              <div className="locRow"><MapPin size={13} /> {l.location}</div>
              <div className="statsRow small">
                <span>{inr(l.price)}</span>
                <span>{l.area} {l.unit}{l.dimensions ? ` (${l.dimensions} ft)` : ""}</span>
              </div>
              <VerificationBadge status={l.verificationStatus} />
              <ContactRow listing={l} phone={contacts[l.id]} />
              <div className="matchBtns">
                <button className="btn btnGhost sm" onClick={() => setDetail(l)}>Details</button>
                <button className="btn btnGhost sm" onClick={() => onUnmatch(l.id)}>Remove</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {detail && <ListingDetail listing={detail} listings={listings} onClose={() => setDetail(null)} />}
    </div>
  );
}
