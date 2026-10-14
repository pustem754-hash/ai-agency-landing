import { HOTSPOTS } from '../lib/config';
import { useConfig, useStore } from '../lib/store';

/**
 * Карточка узла. Место фиксированное — левый нижний угол сцены,
 * чтобы она не прыгала вслед за точкой и не перекрывала модель.
 */
export function HotspotCard() {
  const activeHotspot = useStore((s) => s.activeHotspot);
  const closeHotspot = useStore((s) => s.closeHotspot);
  const cfg = useConfig();

  if (!activeHotspot) return null;
  const info = HOTSPOTS.find((h) => h.id === activeHotspot)!;

  return (
    <article className="hs-card" data-testid={`card-${info.id}`}>
      <button
        type="button"
        className="hs-card-close"
        aria-label="Закрыть подсказку"
        data-testid="card-close"
        onClick={closeHotspot}
      >
        ×
      </button>

      <div className="hs-card-top">
        <span className="hs-card-num">{info.index}</span>
        <span className="hs-card-cat">{info.category}</span>
      </div>

      <h3 className="hs-card-title">{info.title}</h3>
      <p className="hs-card-text">{info.text}</p>

      <hr className="hs-card-rule" />
      <p className="hs-card-spec">{info.spec(cfg)}</p>
    </article>
  );
}
