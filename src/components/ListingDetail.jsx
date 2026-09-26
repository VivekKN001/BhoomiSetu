import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, MapPin, Ruler, CalendarDays } from "lucide-react";
import { inr, pricePerSqft, priceCheck } from "../lib/pricing.js";
import { placeholderImage } from "../lib/image.js";
import { PROPERTY_TYPES } from "../data/propertyTypes.js";
import Badge, { VerificationBadge } from "./Badge.jsx";

// Full-screen detail sheet for one listing: every photo, the full
// description, and the numbers behind the price badge. Opened from Browse,
// Matches, and the seller's own dashboard -- `children` is the footer
// action row, which differs per caller.
export default function ListingDetail({ listing, listings, onClose, children }) {
  const [imgIdx, setImgIdx] = useState(0);
  const images = listing.images.length ? listing.images : [placeholderImage(listing.id, listing.location)];
  const check = priceCheck(listing, listings);
  const typeLabel = PROPERTY_TYPES.find((t) => t.id === listing.type)?.label || listing.type;
  const rate = Math.round(pricePerSqft(listing));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setImgIdx((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft") setImgIdx((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [images.length, onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="detailSheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={listing.title}>
        <button className="detailClose" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="gallery">
          <img src={images[imgIdx]} alt="" className="galleryMain" />
          {images.length > 1 && (
            <>
              <button
                className="galleryNav galleryPrev"
                onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
                aria-label="Previous photo"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                className="galleryNav galleryNext"
                onClick={() => setImgIdx((i) => (i + 1) % images.length)}
                aria-label="Next photo"
              >
                <ChevronRight size={20} />
              </button>
              <span className="galleryCount">{imgIdx + 1} / {images.length}</span>
            </>
          )}
        </div>
        {images.length > 1 && (
          <div className="thumbRow galleryThumbs">
            {images.map((src, i) => (
              <button key={i} className={`galleryThumb ${i === imgIdx ? "on" : ""}`} onClick={() => setImgIdx(i)}>
                <img src={src} alt="" className="thumb" />
              </button>
            ))}
          </div>
        )}

        <div className="detailBody">
          <VerificationBadge status={listing.verificationStatus} />
          <h2>{listing.title}</h2>
          <div className="locRow"><MapPin size={14} /> {listing.location} · {typeLabel}</div>

          <div className="detailFacts">
            <div>
              <span>Asking price</span>
              <strong>{inr(listing.price)}</strong>
            </div>
            <div>
              <span><Ruler size={12} /> Area</span>
              <strong>
                {listing.area} {listing.unit}
                {listing.dimensions ? ` (${listing.dimensions} ft)` : ""}
              </strong>
            </div>
            {rate > 0 && (
              <div>
                <span>Rate</span>
                <strong>₹{rate.toLocaleString("en-IN")} / sqft</strong>
              </div>
            )}
          </div>

          <Badge status={check.status} label={check.label} />

          {listing.description && <p className="detailDesc">{listing.description}</p>}

          {listing.advantages?.length > 0 && (
            <div className="chips">
              {listing.advantages.map((a, i) => <span key={i} className="chip">{a}</span>)}
            </div>
          )}

          <p className="detailMeta">
            <CalendarDays size={12} /> Listed by {listing.sellerName} on{" "}
            {new Date(listing.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>

          {children && <div className="detailActions">{children}</div>}
        </div>
      </div>
    </div>
  );
}
