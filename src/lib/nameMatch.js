// Rough "is this plausibly the same person" check between the owner name
// a seller typed from their EC/RTC and their account name. Advisory only
// -- it flags listings for a closer look on the admin Review page, it never
// approves or rejects anything by itself. Ignores case, punctuation, and
// single-letter initials, and treats the shorter name as a subset (so
// "Ramesh Kumar" matches "Ramesh Kumar K."). Names written in Kannada
// script will simply show as "differs" -- the admin reads the document.
function tokens(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export function namesMatch(a, b) {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return false;
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return shorter.every((t) => longer.includes(t));
}
