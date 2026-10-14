import type { Object3D } from 'three';
import { GLTFExporter } from 'three-stdlib';
import { saveBlob } from './capture';

let model: Object3D | null = null;

/** Регистрируется из сцены — экспортировать надо сам стеллаж, без пола и подсказок. */
export function registerModel(next: Object3D | null) {
  model = next;
  if (typeof window !== 'undefined') window.__gridModel = next ?? undefined;
}

/**
 * Экспорт модели в .glb — бинарный glTF.
 * Это настоящая 3D-геометрия: открывается в «Просмотре 3D» Windows,
 * Blender, Figma, на любом веб-вьювере. PNG остаётся отдельной кнопкой,
 * он нужен для карточки товара, а не для работы с моделью.
 */
export async function downloadGLB(filename: string): Promise<boolean> {
  if (!model) return false;

  const buffer = await new Promise<ArrayBuffer | null>((resolve) => {
    try {
      new GLTFExporter().parse(
        model as Object3D,
        (result) => resolve(result instanceof ArrayBuffer ? result : null),
        () => resolve(null),
        { binary: true, onlyVisible: true },
      );
    } catch {
      resolve(null);
    }
  });

  // Пустой или неполучившийся экспорт — это провал, а не «сохранено».
  if (!buffer || buffer.byteLength < 1000) return false;

  const name = filename.toLowerCase().endsWith('.glb') ? filename : `${filename}.glb`;
  saveBlob(new Blob([buffer], { type: 'model/gltf-binary' }), name);
  return true;
}

declare global {
  interface Window {
    __gridModel?: Object3D;
  }
}
