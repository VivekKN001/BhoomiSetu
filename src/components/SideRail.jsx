export default function SideRail({ images, side, speed = 34 }) {
  const loop = [...images, ...images]; // duplicated for a seamless loop
  return (
    <div className={`sideRail sideRail-${side}`}>
      <div className="sideRailTrack" style={{ animationDuration: `${speed}s` }}>
        {loop.map((src, i) => (
          <div className="sideRailItem" key={i}>
            <img src={src} alt="" />
          </div>
        ))}
      </div>
    </div>
  );
}