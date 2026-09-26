// Parses a "WIDTHxLENGTH" dimensions string in feet -- e.g. "60x30",
// "60 X 30", "60×30" -- into the derived area. Returns null if the text
// doesn't match a two-number pattern.
const DIMENSIONS_PATTERN = /^\s*(\d+(?:\.\d+)?)\s*[x×X]\s*(\d+(?:\.\d+)?)\s*$/;

export function parseDimensionsArea(text) {
  const match = DIMENSIONS_PATTERN.exec(text || "");
  if (!match) return null;
  const width = Number(match[1]);
  const length = Number(match[2]);
  if (!width || !length) return null;
  return width * length;
}
