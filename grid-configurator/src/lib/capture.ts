import type { Camera, Scene, WebGLRenderer } from 'three';
import type { Config } from './config';

interface RenderCtx {
  gl: WebGLRenderer;
  scene: Scene;
  camera: Camera;
}

let ctx: RenderCtx | null = null;

/** Вызывается из сцены — даёт доступ к рендереру снаружи Canvas. */
export function registerRenderer(next: RenderCtx) {
  ctx = next;
  if (typeof window !== 'undefined') {
    window.__gridScene = next.scene;
    window.__gridCamera = next.camera;
  }
}

/** Имя файла собирается из конфигурации: grid-2s-5y-white-2d.png */
export function pngFilename(c: Config): string {
  return `grid-${c.sections}s-${c.tiers}y-${c.material}-${c.drawers}d.png`;
}

/**
 * Снимок текущего кадра.
 * Работает только потому, что рендерер создан с preserveDrawingBuffer: true —
 * иначе браузер очищает буфер после композитинга и снимок придёт пустым.
 * Перед снимком форсируем render, чтобы кадр гарантированно соответствовал UI.
 */
export function captureDataURL(): string | null {
  if (!ctx) return null;
  ctx.gl.render(ctx.scene, ctx.camera);
  return ctx.gl.domElement.toDataURL('image/png');
}

/**
 * Сохранение снимка.
 * Через blob: URL, а не data: URL — Chrome игнорирует атрибут download
 * у длинных data-ссылок и кладёт файл без имени и расширения.
 */
export async function downloadPNG(filename: string): Promise<boolean> {
  if (!ctx) return false;
  ctx.gl.render(ctx.scene, ctx.camera);
  const canvas = ctx.gl.domElement;

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png'),
  );
  if (!blob || blob.size < 1000) return false;

  const name = filename.toLowerCase().endsWith('.png') ? filename : `${filename}.png`;
  saveBlob(blob, name);
  return true;
}

/** Спецификация заказа текстом — рядом со снимком, чтобы было что переслать. */
export function downloadText(filename: string, text: string) {
  saveBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), filename);
}

/**
 * Сохранение файла — только ссылка с download на blob: URL.
 *
 * Системный диалог (showSaveFilePicker) отсюда убран сознательно: он кидает
 * AbortError, когда его перехватывает автоматизация или когда пользователь
 * закрывает окно, и тогда файл молча не сохраняется. Ссылка работает везде.
 */
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Хуки для автотестов: непустой PNG и доступ к сцене для проверки геометрии.
declare global {
  interface Window {
    __captureDataURL?: () => string | null;
    __gridScene?: Scene;
    __gridCamera?: Camera;
  }
}
if (typeof window !== 'undefined') {
  window.__captureDataURL = captureDataURL;
}
