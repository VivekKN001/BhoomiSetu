export default function TrussDivider({ flip }) {
  return (
    <svg
      viewBox="0 0 400 28"
      preserveAspectRatio="none"
      className="truss"
      style={{ transform: flip ? "scaleY(-1)" : "none" }}
    >
      <polyline
        points="0,26 25,2 50,26 75,2 100,26 125,2 150,26 175,2 200,26 225,2 250,26 275,2 300,26 325,2 350,26 375,2 400,26"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line x1="0" y1="26" x2="400" y2="26" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
