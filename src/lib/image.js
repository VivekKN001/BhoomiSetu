const PALETTE = ["#8B3A2B", "#2F6E6E", "#C9A227", "#4B5563", "#6E4A2E", "#3D5A80"];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return h;
}

// Generates a small SVG "photo" locally so seed/demo listings don't depend
// on fetching real images from the internet. Real listings (via the Sell
// form) use actual uploaded photos instead — see components/SellView.jsx.
export function placeholderImage(seed, location) {
  const color = PALETTE[Math.abs(hash(seed)) % PALETTE.length];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='0' y2='1'>
        <stop offset='0%' stop-color='${color}'/>
        <stop offset='100%' stop-color='#1B2430'/>
      </linearGradient>
    </defs>
    <rect width='400' height='300' fill='url(#g)'/>
    <g opacity='0.35' stroke='#EDE3D0' stroke-width='2'>
      <line x1='0' y1='230' x2='400' y2='170'/>
      <line x1='0' y1='190' x2='400' y2='260'/>
    </g>
    <text x='24' y='262' font-family='Georgia, serif' font-size='22' fill='#EDE3D0'>${location}</text>
  </svg>`;
  return "data:image/svg+xml;base64," + btoa(svg);
}
