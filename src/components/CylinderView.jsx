import { useRef } from "react";

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
      <div className="urth-cyl" style={{ transform: `rotateY(${rotation}deg)` }}>
        {faces}
      </div>
    </div>
  );
}