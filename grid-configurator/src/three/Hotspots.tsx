import { Html } from '@react-three/drei';
import { CM, HOTSPOTS, type HotspotId, type ThicknessMm } from '../lib/config';
import { useStore } from '../lib/store';
import { buildLayout } from './Shelf';

export type Point3 = [number, number, number];

/** Точки привязаны к реальной раскладке, а не к магическим числам. */
export function hotspotPoints(
  sections: number,
  tiers: number,
  thickness: ThicknessMm,
): Record<HotspotId, Point3> {
  const L = buildLayout(sections, tiers, thickness);
  const z = L.depth / 2;
  return {
    joint: [L.panelX[1], L.shelfY[1], z - 3],
    foot: [-(L.width / 2 - 4), CM.legH / 2, L.depth / 2 - 4 + 2],
    shelf: [L.sectionX[0], L.shelfY[Math.min(2, tiers)], z + 1.2],
  };
}

/**
 * Маркер — DOM-кружок поверх сцены: цифра остаётся резкой на любом зуме,
 * а подпись при наведении рисуется обычным CSS.
 */
function Marker({ id, pos }: { id: HotspotId; pos: Point3 }) {
  const active = useStore((s) => s.activeHotspot === id);
  const focusHotspot = useStore((s) => s.focusHotspot);
  const closeHotspot = useStore((s) => s.closeHotspot);
  const info = HOTSPOTS.find((h) => h.id === id)!;

  return (
    <Html center position={pos} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div className="hs">
        <button
          type="button"
          className={active ? 'hs-dot is-on' : 'hs-dot'}
          data-testid={`dot-${id}`}
          aria-label={info.category}
          aria-pressed={active}
          onClick={() => (active ? closeHotspot() : focusHotspot(id))}
        >
          {info.index}
        </button>
        <span className="hs-tip">{info.category}</span>
      </div>
    </Html>
  );
}

export function Hotspots() {
  const sections = useStore((s) => s.sections);
  const tiers = useStore((s) => s.tiers);
  const thickness = useStore((s) => s.thickness);
  const exploded = useStore((s) => s.exploded);

  // В разборке точки прячем — детали разъезжаются, привязка теряет смысл.
  if (exploded) return null;

  const points = hotspotPoints(sections, tiers, thickness);

  return (
    <>
      {HOTSPOTS.map((h) => (
        <Marker key={h.id} id={h.id} pos={points[h.id]} />
      ))}
    </>
  );
}
