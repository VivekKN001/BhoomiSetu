// Horizontal counterpart of SideRail, for narrow screens where the side
// rails are hidden (see .marquee / .sideRail in index.css).
export default function Marquee({ images, reverse = false, speed = 30 }) {
  const loop = [...images, ...images]; // duplicated for a seamless loop
  return (
    <div className="marquee">
      <div
        className={`marqueeTrack ${reverse ? "marqueeReverse" : ""}`}
        style={{ animationDuration: `${speed}s` }}
      >
        {loop.map((src, i) => (
          <div className="marqueeItem" key={i}>
            <img src={src} alt="" />
          </div>
        ))}
      </div>
    </div>
  );
}
