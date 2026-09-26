export function toSqft(area, unit) {
  const a = Number(area) || 0;
  return unit === "acres" ? a * 43560 : a;
}

export function inr(n) {
  const num = Number(n) || 0;
  return "₹" + num.toLocaleString("en-IN");
}

export function pricePerSqft(listing) {
  const sqft = toSqft(listing.area, listing.unit);
  if (!sqft) return 0;
  return Number(listing.price) / sqft;
}

// Compares one listing's rate against other listings in the same locality.
// This is a real (if rough) local-average comparison, NOT a certified
// valuation — see README "What's missing" for the honest limits of this.
export function priceCheck(listing, all) {
  const comparable = all.filter(
    (l) => l.id !== listing.id && l.location === listing.location
  );
  if (comparable.length < 2) {
    return {
      status: "insufficient",
      label: "Not enough listings yet in this locality to compare",
    };
  }
  const avg =
    comparable.reduce((sum, l) => sum + pricePerSqft(l), 0) / comparable.length;
  const mine = pricePerSqft(listing);
  const ratio = avg > 0 ? mine / avg : 1;

  if (ratio > 1.3) {
    return {
      status: "high",
      label: `${Math.round((ratio - 1) * 100)}% above the ${listing.location} average`,
      avg,
    };
  }
  if (ratio < 0.65) {
    return {
      status: "low",
      label: `${Math.round((1 - ratio) * 100)}% below the ${listing.location} average — double-check the listing`,
      avg,
    };
  }
  return { status: "fair", label: `Close to the ${listing.location} average`, avg };
}
