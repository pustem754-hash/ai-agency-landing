import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { downloadPNG, pngFilename } from './lib/capture';
import { useConfig, useStore } from './lib/store';
import { CartSheet } from './ui/CartSheet';
import { HotspotCard } from './ui/HotspotCard';
import { Panel } from './ui/Panel';
import { Viewer } from './three/Viewer';

function Toolbar() {
  const exploded = useStore((s) => s.exploded);
  const toggleExploded = useStore((s) => s.toggleExploded);
  const resetView = useStore((s) => s.resetView);
  const cfg = useConfig();
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const savePNG = async () => {
    const name = pngFilename(cfg);
    const ok = await downloadPNG(name);
    flash(ok ? `Снимок сохранён: ${name}` : 'Не удалось снять кадр');
  };

  return (
    <>
      <div className="toolbar">
        <button type="button" className="tool" onClick={resetView} data-testid="reset-view">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12a8 8 0 1 1 2.6 5.9" />
            <path d="M4 18v-6h6" />
          </svg>
          Вернуть обзор
        </button>
        <button
          type="button"
          className={exploded ? 'tool is-on' : 'tool'}
          onClick={toggleExploded}
          aria-pressed={exploded}
          data-testid="explode"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v5" />
            <path d="M12 16v5" />
            <path d="M5 10.5h14" />
            <path d="M5 13.5h14" />
          </svg>
          {exploded ? 'Собрать' : 'Разборка'}
        </button>
        <button type="button" className="tool" onClick={savePNG} data-testid="save-png">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4v10" />
            <path d="m8 11 4 4 4-4" />
            <path d="M5 19h14" />
          </svg>
          Сохранить PNG
        </button>
      </div>
      {toast && (
        <div className="toast" data-testid="toast">
          {toast}
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <div className="app">
      <div className="stage">
        <div className="stage-canvas">
          <Viewer />
        </div>
        <HotspotCard />
        <Toolbar />
      </div>
      <Panel />
      <CartSheet />
    </div>
  );
}
