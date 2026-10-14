import { useEffect, useState } from 'react';
import {
  BACKS,
  EDGES,
  MATERIALS,
  buildSku,
  buildSpecText,
  calcDimensions,
  calcPrice,
  formatCm,
  formatPrice,
  priceBreakdown,
} from '../lib/config';
import { downloadText } from '../lib/capture';
import { downloadGLB } from '../lib/exportModel';
import { useConfig, useStore } from '../lib/store';

type Status = { kind: 'ok' | 'err'; text: string } | null;

/** Панель заказа: состав, габариты, разбивка цены и три действия. */
export function CartSheet() {
  const open = useStore((s) => s.cartOpen);
  const setCartOpen = useStore((s) => s.setCartOpen);
  const cfg = useConfig();
  const [status, setStatus] = useState<Status>(null);
  const [sent, setSent] = useState(false);

  // Закрытие по Escape — панель модальная.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCartOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setCartOpen]);

  useEffect(() => {
    if (!open) {
      setStatus(null);
      setSent(false);
    }
  }, [open]);

  if (!open) return null;

  const price = calcPrice(cfg);
  const dims = calcDimensions(cfg.sections, cfg.tiers, cfg.thickness, cfg.back);
  const sku = buildSku(cfg);
  const rows = priceBreakdown(cfg).filter((r) => r.value > 0);
  const spec = buildSpecText(cfg);

  const copySpec = async () => {
    try {
      // clipboard API работает только в защищённом контексте; иначе — запасной путь
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(spec);
      } else {
        const ta = document.createElement('textarea');
        ta.value = spec;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      setStatus({ kind: 'ok', text: 'Спецификация скопирована в буфер' });
    } catch {
      setStatus({ kind: 'err', text: 'Буфер обмена недоступен — скачайте файлом' });
    }
  };

  const saveSpec = () => {
    downloadText(`${sku}.txt`, spec);
    setStatus({ kind: 'ok', text: `Файл сохранён: ${sku}.txt` });
  };

  const saveModel = async () => {
    const ok = await downloadGLB(sku);
    setStatus(
      ok
        ? { kind: 'ok', text: `Модель сохранена: ${sku}.glb — открывается в «Просмотре 3D», Blender, Figma` }
        : { kind: 'err', text: 'Не удалось собрать .glb — модель не готова' },
    );
  };

  const submit = () => {
    // Бэкенда у прототипа нет: заявка складывается локально и честно
    // помечается как неотправленная наружу.
    setSent(true);
    setStatus({ kind: 'ok', text: 'Заявка собрана. Прототип — наружу ничего не уходит' });
  };

  return (
    <div className="cart-backdrop" onClick={() => setCartOpen(false)}>
      <aside
        className="cart"
        role="dialog"
        aria-modal="true"
        aria-label="Заказ"
        data-testid="cart"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cart-head">
          <div>
            <span className="cart-label">Заказ</span>
            <h2>Модульный стеллаж GRID</h2>
            <span className="cart-sku" data-testid="cart-sku">
              {sku}
            </span>
          </div>
          <button
            type="button"
            className="cart-close"
            aria-label="Закрыть"
            data-testid="cart-close"
            onClick={() => setCartOpen(false)}
          >
            ×
          </button>
        </header>

        <div className="cart-body">
          <section>
            <h3>Конфигурация</h3>
            <dl className="cart-list">
              <div>
                <dt>Секции</dt>
                <dd>{cfg.sections}</dd>
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
              <div>
                <dt>Габариты Ш×В×Г</dt>
                <dd data-testid="cart-dims">
                  {formatCm(dims.width)} × {formatCm(dims.height)} × {formatCm(dims.depth)} см
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h3>Расчёт цены</h3>
            <ul className="cart-price" data-testid="cart-breakdown">
              {rows.map((r) => (
                <li key={r.label}>
                  <span>{r.label}</span>
                  <b>{formatPrice(r.value)}</b>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Низ панели закреплён: итог и действия видны без прокрутки. */}
        <footer className="cart-foot">
          <div className="cart-total">
            <span>Итого</span>
            <b data-testid="cart-total">{formatPrice(price)}</b>
          </div>

          <div className="cart-actions">
            <button type="button" className="btn" data-testid="cart-copy" onClick={copySpec}>
              Скопировать
            </button>
            <button type="button" className="btn" data-testid="cart-save" onClick={saveSpec}>
              Скачать .txt
            </button>
            <button type="button" className="btn" data-testid="cart-glb" onClick={saveModel}>
              Скачать 3D
            </button>
          </div>

          <button
            type="button"
            className={sent ? 'btn is-primary is-done' : 'btn is-primary'}
            data-testid="cart-submit"
            onClick={submit}
            disabled={sent}
          >
            {sent ? 'Заявка собрана' : 'Оформить заявку'}
          </button>

          {status && (
            <p
              className={status.kind === 'ok' ? 'cart-status' : 'cart-status is-err'}
              data-testid="cart-status"
            >
              {status.text}
            </p>
          )}
        </footer>
      </aside>
    </div>
  );
}
