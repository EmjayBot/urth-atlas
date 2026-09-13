import { useMemo, useRef } from "react";

const FACES = 32;
const RADIUS = 170;
const MAP_W = 11232;
const MAP_H = 7525;

export default function CylinderView({ imageUrl, cx, W, onRotateWorld }) {
  const sceneRef = useRef(null);

  const circ = 2 * Math.PI * RADIUS;
  const faceW = circ / FACES;
  const height = circ * (MAP_H / MAP_W);
  const rotation = -(cx / (W || MAP_W)) * 360;

  const stars = useMemo(() => {
    const arr = [];
    let seed = 7;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 130; i++) {
      arr.push({
        left: rnd() * 100,
        top: rnd() * 100,
        size: rnd() < 0.8 ? 1 : rnd() < 0.5 ? 1.5 : 2,
        o: 0.35 + rnd() * 0.65,
        tw: rnd() < 0.22,
        hue: rnd() < 0.15 ? (rnd() < 0.5 ? "#8ab4f8" : "#f4c38b") : "#ffffff",
      });
    }
    return arr;
  }, []);

  const faces = [];
  for (let i = 0; i < FACES; i++) {
    faces.push(
      <div
        key={i}
        className="urth-cyl-face"
        style={{
          left: -faceW / 2,
          top: -height / 2,
          width: faceW,
          height,
          backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
          backgroundSize: `${circ}px ${height}px`,
          backgroundPosition: `${-i * faceW}px 0`,
          transform: `rotateY(${(i * 360) / FACES}deg) translateZ(${RADIUS}px)`,
        }}
      />
    );
  }

  const onPointerDown = (e) => {
    e.preventDefault();
    sceneRef.current?.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startCx = cx;
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const worldDx = (dx / circ) * W;
      onRotateWorld(startCx + worldDx);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div ref={sceneRef} className="urth-cyl-scene" onPointerDown={onPointerDown}>
      <div className="urth-space-stars" aria-hidden="true">
        {stars.map((s, i) => (
          <span
            key={i}
            className={`urth-star${s.tw ? " tw" : ""}`}
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              opacity: s.o,
              background: s.hue,
            }}
          />
        ))}
      </div>
      <div className="urth-nebula urth-nebula-a" aria-hidden="true" />
      <div className="urth-nebula urth-nebula-b" aria-hidden="true" />
      <div className="urth-sun-drift" aria-hidden="true" />

      {/* The cylinder (Urth) */}
      <div className="urth-cyl-wrap">
        <div className="urth-cyl" style={{ transform: `rotateY(${rotation}deg)` }}>
          {faces}
          <div className="urth-cyl-cap urth-cyl-cap-top" style={{ top: -height / 2 }} />
          <div className="urth-cyl-cap urth-cyl-cap-bottom" style={{ top: height / 2 }} />
        </div>
      </div>
    </div>
  );
}