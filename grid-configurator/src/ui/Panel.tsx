import {
  BACKS,
  DRAWER_OPTIONS,
  EDGES,
  EDGE_OPTIONS,
  HOTSPOTS,
  MATERIALS,
  PRICE,
  SECTION_OPTIONS,
  THICKNESSES,
  THICKNESS_OPTIONS,
  TIER_OPTIONS,
  buildSku,
  calcDimensions,
  calcPrice,
  formatCm,
  formatPrice,
  formatSurcharge,
  priceBreakdown,
  type BackId,
  type EdgeId,
  type MaterialId,
  type ThicknessMm,
} from '../lib/config';
import { useConfig, useStore } from '../lib/store';

/* ------------------------------------------------------------ примитивы */

function Row({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="row">
      <div className="row-head">
        <span className="row-title">{title}</span>
        {hint && <span className="row-hint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  name,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          role="radio"
          aria-checked={o === value}
          className={o === value ? 'seg-btn is-on' : 'seg-btn'}
          onClick={() => onChange(o)}
        >
          {String(o)}
        </button>
      ))}
    </div>
  );
}

interface OptItem<T> {
  id: T;
  label: string;
  hint?: string;
  swatch?: string;
  extra: number;
}

/** Карточка опции: слева название, справа доплата — как в референсе. */
function Options<T extends string | number>({
  name,
  value,
  items,
  onChange,
}: {
  name: string;
  value: T;
  items: OptItem<T>[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="opts" role="radiogroup" aria-label={name}>
      {items.map((it) => (
        <button
          key={String(it.id)}
          type="button"
          role="radio"
          aria-checked={it.id === value}
          className={it.id === value ? 'opt is-on' : 'opt'}
          onClick={() => onChange(it.id)}
        >
          {it.swatch && <span className="opt-dot" style={{ background: it.swatch }} />}
          <span className="opt-text">
            <span className="opt-label">{it.label}</span>
            {it.hint && <span className="opt-hint">{it.hint}</span>}
          </span>
          <span className={it.extra > 0 ? 'opt-extra is-paid' : 'opt-extra'}>
            {formatSurcharge(it.extra)}
          </span>
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- панель */

export function Panel() {
  const cfg = useConfig();
  const setSections = useStore((s) => s.setSections);
  const setTiers = useStore((s) => s.setTiers);
  const setMaterial = useStore((s) => s.setMaterial);
  const setBack = useStore((s) => s.setBack);
  const setDrawers = useStore((s) => s.setDrawers);
  const setEdge = useStore((s) => s.setEdge);
  const setThickness = useStore((s) => s.setThickness);
  const exploded = useStore((s) => s.exploded);
  const activeHotspot = useStore((s) => s.activeHotspot);
  const focusHotspot = useStore((s) => s.focusHotspot);
  const closeHotspot = useStore((s) => s.closeHotspot);
  const setCartOpen = useStore((s) => s.setCartOpen);

  const price = calcPrice(cfg);
  const dims = calcDimensions(cfg.sections, cfg.tiers, cfg.thickness, cfg.back);
  const sku = buildSku(cfg);
  const breakdown = priceBreakdown(cfg).filter((r) => r.value > 0);

  return (
    <aside className="panel">
      <div className="panel-scroll">
        <header className="panel-head">
          <div className="badge">Модульный стеллаж</div>
          <h1>GRID</h1>
          <p className="lead">
            Соберите свой размер: от 2 до 4 секций, от 3 до 5 ярусов. Цена и габариты
            пересчитываются сразу.
          </p>
        </header>

        <Row title="Секции по ширине" hint={`+${formatPrice(PRICE.perExtraSection)} за секцию`}>
          <Segmented
            name="Секции"
            value={cfg.sections}
            options={SECTION_OPTIONS}
            onChange={setSections}
          />
        </Row>

        <Row title="Ярусы по высоте" hint={`+${formatPrice(PRICE.perExtraTier)} за ярус`}>
          <Segmented name="Ярусы" value={cfg.tiers} options={TIER_OPTIONS} onChange={setTiers} />
        </Row>

        <Row title="Материал корпуса">
          <Options<MaterialId>
            name="Материал корпуса"
            value={cfg.material}
            onChange={setMaterial}
            items={(Object.keys(MATERIALS) as MaterialId[]).map((id) => ({
              id,
              label: MATERIALS[id].label,
              swatch: MATERIALS[id].swatch,
              extra: PRICE.material[id],
            }))}
          />
        </Row>

        <Row title="Форма корпуса">
          <Options<EdgeId>
            name="Форма корпуса"
            value={cfg.edge}
            onChange={setEdge}
            items={EDGE_OPTIONS.map((id) => ({
              id,
              label: EDGES[id].label,
              hint: EDGES[id].hint,
              extra: PRICE.edge[id],
            }))}
          />
        </Row>

        <Row title="Толщина полок">
          <Options<ThicknessMm>
            name="Толщина полок"
            value={cfg.thickness}
            onChange={setThickness}
            items={THICKNESS_OPTIONS.map((id) => ({
              id,
              label: THICKNESSES[id].label,
              hint: THICKNESSES[id].hint,
              extra: PRICE.thickness[id],
            }))}
          />
        </Row>

        <Row title="Задняя стенка">
          <Options<BackId>
            name="Задняя стенка"
            value={cfg.back}
            onChange={setBack}
            items={(Object.keys(BACKS) as BackId[]).map((id) => ({
              id,
              label: BACKS[id].label,
              hint: BACKS[id].hint,
              extra: PRICE.back[id],
            }))}
          />
        </Row>

        <Row title="Ящики" hint="в нижнем ярусе">
          <Options<number>
            name="Ящики"
            value={cfg.drawers}
            onChange={(v) => setDrawers(v as 0 | 1 | 2)}
            items={DRAWER_OPTIONS.map((id) => ({
              id: id as number,
              label: id === 0 ? 'Без ящиков' : `${id} ${id === 1 ? 'ящик' : 'ящика'}`,
              extra: id * PRICE.perDrawer,
            }))}
          />
        </Row>

        <section className="hotspots-block">
          <div className="row-head">
            <span className="row-title">Точки на модели</span>
            <span className="count">{HOTSPOTS.length}</span>
          </div>
          <div className="chips">
            {HOTSPOTS.map((h) => (
              <button
                key={h.id}
                type="button"
                className={h.id === activeHotspot ? 'chip is-on' : 'chip'}
                data-testid={`chip-${h.id}`}
                aria-pressed={h.id === activeHotspot}
                onClick={() => (h.id === activeHotspot ? closeHotspot() : focusHotspot(h.id))}
              >
                <span className="chip-num">{h.index}</span>
                {h.category}
              </button>
            ))}
          </div>
        </section>

        <section className="summary">
          <h2>Ваша конфигурация</h2>
          <dl>
            <div>
              <dt>Секции</dt>
              <dd data-testid="sum-sections">
                {cfg.sections}
                {exploded && <span className="tag"> · разобрано</span>}
              </dd>
            </div>
            <div>
              <dt>Ярусы</dt>
              <dd>{cfg.tiers}</dd>
            </div>
            <div>
              <dt>Материал</dt>
              <dd>{MATERIALS[cfg.material].label}</dd>
            </div>
            <div>
              <dt>Форма корпуса</dt>
              <dd>{EDGES[cfg.edge].label}</dd>
            </div>
            <div>
              <dt>Толщина полок</dt>
              <dd>{cfg.thickness} мм</dd>
            </div>
            <div>
              <dt>Задняя стенка</dt>
              <dd>{BACKS[cfg.back].label}</dd>
            </div>
            <div>
              <dt>Ящики</dt>
              <dd>{cfg.drawers}</dd>
            </div>
            <div className="dims">
              <dt>Габариты Ш×В×Г</dt>
              <dd data-testid="dims">
                {formatCm(dims.width)} × {formatCm(dims.height)} × {formatCm(dims.depth)} см
              </dd>
            </div>
            <div className="sku">
              <dt>Артикул</dt>
              <dd data-testid="sku">{sku}</dd>
            </div>
          </dl>
        </section>

        <details className="breakdown">
          <summary>Из чего складывается цена</summary>
          <ul>
            {breakdown.map((r) => (
              <li key={r.label}>
                <span>{r.label}</span>
                <b>{formatPrice(r.value)}</b>
              </li>
            ))}
          </ul>
        </details>
      </div>

      <footer className="pricebar">
        <div className="pricebar-text">
          <span className="pricebar-label">Условная цена</span>
          <span className="pricebar-value" data-testid="price">
            {formatPrice(price)}
          </span>
          <span className="pricebar-note">
            {formatPrice(PRICE.base)} база. Прототип, цена условная
          </span>
        </div>
        <button
          type="button"
          className="cta"
          data-testid="cta"
          onClick={() => setCartOpen(true)}
        >
          В корзину
        </button>
      </footer>
    </aside>
  );
}
