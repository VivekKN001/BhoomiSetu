import { useCallback, useRef, useState } from "react";
import { Heart, X, MapPin, Ruler, Sparkles, Info, SlidersHorizontal } from "lucide-react";
import { inr, priceCheck } from "../lib/pricing.js";
import { placeholderImage } from "../lib/image.js";
import { LOCALITIES } from "../data/localities.js";
import { PROPERTY_TYPES } from "../data/propertyTypes.js";
import Badge, { VerificationBadge } from "./Badge.jsx";
import ListingDetail from "./ListingDetail.jsx";

const LAKH = 100000;
const PRICE_RANGES = [
  { id: "any", label: "Any price", min: 0, max: Infinity },
  { id: "u25", label: "Under ₹25 L", min: 0, max: 25 * LAKH },
  { id: "25-50", label: "₹25 L – 50 L", min: 25 * LAKH, max: 50 * LAKH },
  { id: "50-100", label: "₹50 L – 1 Cr", min: 50 * LAKH, max: 100 * LAKH },
  { id: "100+", label: "Above ₹1 Cr", min: 100 * LAKH, max: Infinity },
];

const NO_FILTERS = { location: "any", type: "any", price: "any", verifiedOnly: false };

function matchesFilters(l, f) {
  const range = PRICE_RANGES.find((r) => r.id === f.price);
  return (
    (f.location === "any" || l.location === f.location) &&
    (f.type === "any" || l.type === f.type) &&
    Number(l.price) >= range.min &&
    Number(l.price) < range.max &&
    (!f.verifiedOnly || l.verificationStatus === "verified")
  );
}

// Stops a tap on an in-card button from also starting a card drag.
const stop = (e) => e.stopPropagation();

export default function BuyView({ listings, swipes, onSwipe }) {
  const [drag, setDrag] = useState({ x: 0, active: false });
  const [imgIdx, setImgIdx] = useState(0);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const startX = useRef(0);

  const seen = new Set([...swipes.liked, ...swipes.skipped]);
  // Listings that failed ownership verification never reach buyers.
  const unseen = listings.filter((l) => !seen.has(l.id) && l.verificationStatus !== "rejected");
  const queue = unseen.filter((l) => matchesFilters(l, filters));
  const current = queue[0];
  const activeFilterCount =
    (filters.location !== "any") + (filters.type !== "any") + (filters.price !== "any") + filters.verifiedOnly;

  const setFilter = (k, v) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setImgIdx(0);
  };

  const commit = useCallback(
    (direction) => {
      if (!current) return;
      onSwipe(current.id, direction);
      setDrag({ x: 0, active: false });
      setImgIdx(0);
      setDetailOpen(false);
    },
    [current, onSwipe]
  );

  const onDown = (e) => {
    startX.current = e.touches ? e.touches[0].clientX : e.clientX;
    setDrag({ x: 0, active: true });
  };
  const onMove = (e) => {
    if (!drag.active) return;
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - startX.current;
    setDrag({ x, active: true });
  };
  const onUp = () => {
    if (Math.abs(drag.x) > 110) {
      commit(drag.x > 0 ? "right" : "left");
    } else {
      setDrag({ x: 0, active: false });
    }
  };

  const filterBar = (
    <div className="filterBox">
      <button className="filterToggle" onClick={() => setShowFilters((s) => !s)}>
        <SlidersHorizontal size={15} /> Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
      </button>
      {activeFilterCount > 0 && (
        <button className="linkBtn" onClick={() => setFilters(NO_FILTERS)}>Clear all</button>
      )}
      {showFilters && (
        <div className="filterPanel">
          <div className="fieldRow">
            <label className="field">
              <span>Locality</span>
              <select value={filters.location} onChange={(e) => setFilter("location", e.target.value)}>
                <option value="any">All localities</option>
                {LOCALITIES.map((l) => <option key={l}>{l}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Price</span>
              <select value={filters.price} onChange={(e) => setFilter("price", e.target.value)}>
                {PRICE_RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </label>
          </div>
          <div className="chips typeChips">
            {[{ id: "any", label: "All types" }, ...PROPERTY_TYPES].map((t) => (
              <button
                key={t.id}
                className={`chip chipBtn ${filters.type === t.id ? "on" : ""}`}
                onClick={() => setFilter("type", t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="checkRow">
            <input
              type="checkbox"
              checked={filters.verifiedOnly}
              onChange={(e) => setFilter("verifiedOnly", e.target.checked)}
            />
            Owner-verified listings only
          </label>
        </div>
      )}
    </div>
  );

  if (!current) {
    const filteredOut = unseen.length > 0;
    return (
      <div className="panel buyPanel">
        <h2>Browse land in Mysuru</h2>
        {filterBar}
        <div className="centerPanel">
          <Sparkles size={36} color="#C9A227" />
          {filteredOut ? (
            <>
              <h2>No listings match these filters</h2>
              <p>{unseen.length} listing{unseen.length === 1 ? "" : "s"} you haven't seen yet {unseen.length === 1 ? "is" : "are"} hidden by your filters.</p>
              <button className="btn btnGhost" onClick={() => setFilters(NO_FILTERS)}>Clear filters</button>
            </>
          ) : (
            <>
              <h2>You've seen every listing in Mysuru</h2>
              <p>Check back later, or list your own land while you wait.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const check = priceCheck(current, listings);
  const rotate = drag.x / 14;
  const overlayOpacity = Math.min(Math.abs(drag.x) / 100, 1);
  const images = current.images.length ? current.images : [placeholderImage(current.id, current.location)];

  return (
    <div className="panel buyPanel">
      <h2>Browse land in Mysuru</h2>
      {filterBar}
      <div className="cardStack">
        <div
          className="swipeCard"
          style={{ transform: `translateX(${drag.x}px) rotate(${rotate}deg)` }}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={() => drag.active && onUp()}
          onTouchStart={onDown}
          onTouchMove={onMove}
          onTouchEnd={onUp}
        >
          <div
            className="cardImg"
            style={{ backgroundImage: `url(${images[imgIdx % images.length]})` }}
            onClick={() => setImgIdx((i) => i + 1)}
          >
            <div className="cardVerify"><VerificationBadge status={current.verificationStatus} /></div>
            <button
              className="detailsBtn"
              onMouseDown={stop}
              onTouchStart={stop}
              onClick={(e) => {
                e.stopPropagation();
                setDetailOpen(true);
              }}
            >
              <Info size={14} /> Details
            </button>
            {images.length > 1 && (
              <div className="dots">
                {images.map((_, i) => (
                  <span key={i} className={i === imgIdx % images.length ? "dot on" : "dot"} />
                ))}
              </div>
            )}
            {drag.x > 20 && <div className="stamp stampLike" style={{ opacity: overlayOpacity }}>INTERESTED</div>}
            {drag.x < -20 && <div className="stamp stampPass" style={{ opacity: overlayOpacity }}>PASS</div>}
          </div>
          <div className="cardBody">
            <h3>{current.title}</h3>
            <div className="locRow"><MapPin size={14} /> {current.location}</div>
            <div className="statsRow">
              <span><Ruler size={14} /> {current.area} {current.unit}{current.dimensions ? ` (${current.dimensions} ft)` : ""}</span>
              <span>{inr(current.price)}</span>
            </div>
            <Badge status={check.status} label={check.label} />
            {current.advantages?.length > 0 && (
              <div className="chips">
                {current.advantages.map((a, i) => <span key={i} className="chip">{a}</span>)}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="swipeBtns">
        <button className="round roundX" onClick={() => commit("left")}><X size={26} /></button>
        <button className="round roundHeart" onClick={() => commit("right")}><Heart size={24} /></button>
      </div>
      <p className="hint">{queue.length - 1} more after this one</p>

      {detailOpen && (
        <ListingDetail listing={current} listings={listings} onClose={() => setDetailOpen(false)}>
          <button className="btn btnGhost" onClick={() => commit("left")}><X size={16} /> Pass</button>
          <button className="btn btnPrimary" onClick={() => commit("right")}><Heart size={16} /> Interested</button>
        </ListingDetail>
      )}
    </div>
  );
}
