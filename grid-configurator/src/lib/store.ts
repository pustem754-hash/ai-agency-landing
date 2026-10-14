import { useMemo } from 'react';
import { create } from 'zustand';
import {
  DEFAULT_CONFIG,
  calcDimensions,
  calcPrice,
  type BackId,
  type Config,
  type DrawersCount,
  type EdgeId,
  type HotspotId,
  type MaterialId,
  type SectionsCount,
  type ThicknessMm,
  type TiersCount,
} from './config';

export type { HotspotId };

interface StoreState extends Config {
  exploded: boolean;
  activeHotspot: HotspotId | null;
  /** счётчик-триггер: увеличивается по кнопке «Вернуть обзор» */
  resetToken: number;
  /** счётчик-триггер: камера подлетает к активной точке */
  focusToken: number;
  /** открыта ли панель заказа */
  cartOpen: boolean;

  setSections: (v: SectionsCount) => void;
  setTiers: (v: TiersCount) => void;
  setMaterial: (v: MaterialId) => void;
  setBack: (v: BackId) => void;
  setDrawers: (v: DrawersCount) => void;
  setEdge: (v: EdgeId) => void;
  setThickness: (v: ThicknessMm) => void;
  toggleExploded: () => void;
  /** выбрать точку: панель и модель ведут себя одинаково */
  focusHotspot: (v: HotspotId) => void;
  closeHotspot: () => void;
  resetView: () => void;
  setCartOpen: (v: boolean) => void;
}

export const useStore = create<StoreState>((set) => ({
  ...DEFAULT_CONFIG,
  exploded: false,
  activeHotspot: null,
  resetToken: 0,
  focusToken: 0,
  cartOpen: false,

  setSections: (sections) => set({ sections }),
  setTiers: (tiers) => set({ tiers }),
  setMaterial: (material) => set({ material }),
  setBack: (back) => set({ back }),
  setDrawers: (drawers) => set({ drawers }),
  setEdge: (edge) => set({ edge }),
  setThickness: (thickness) => set({ thickness }),

  // Разборка и подсказки — взаимоисключающие режимы просмотра.
  toggleExploded: () =>
    set((s) => ({
      exploded: !s.exploded,
      activeHotspot: null,
      resetToken: s.resetToken + 1,
    })),

  focusHotspot: (id) =>
    set((s) => ({
      activeHotspot: id,
      exploded: false,
      focusToken: s.focusToken + 1,
    })),

  closeHotspot: () => set((s) => ({ activeHotspot: null, resetToken: s.resetToken + 1 })),

  resetView: () => set((s) => ({ resetToken: s.resetToken + 1, activeHotspot: null })),

  setCartOpen: (cartOpen) => set({ cartOpen }),
}));

// Хук для автотестов: детерминированная установка конфигурации без кликов.
declare global {
  interface Window {
    __gridStore?: typeof useStore;
  }
}
if (typeof window !== 'undefined') window.__gridStore = useStore;

/** Текущая конфигурация как plain-объект (для расчётов вне React). */
export const selectConfig = (s: StoreState): Config => ({
  sections: s.sections,
  tiers: s.tiers,
  material: s.material,
  back: s.back,
  drawers: s.drawers,
  edge: s.edge,
  thickness: s.thickness,
});

/**
 * Конфигурация как объект внутри компонента.
 * Селектор берёт только примитивы: селектор, возвращающий новый объект,
 * в zustand v5 (useSyncExternalStore) даёт бесконечный ре-рендер.
 */
export const useConfig = (): Config => {
  const sections = useStore((s) => s.sections);
  const tiers = useStore((s) => s.tiers);
  const material = useStore((s) => s.material);
  const back = useStore((s) => s.back);
  const drawers = useStore((s) => s.drawers);
  const edge = useStore((s) => s.edge);
  const thickness = useStore((s) => s.thickness);
  return useMemo(
    () => ({ sections, tiers, material, back, drawers, edge, thickness }),
    [sections, tiers, material, back, drawers, edge, thickness],
  );
};

export const usePrice = () => calcPrice(useConfig());

export const useDimensions = () => {
  const sections = useStore((s) => s.sections);
  const tiers = useStore((s) => s.tiers);
  const thickness = useStore((s) => s.thickness);
  const back = useStore((s) => s.back);
  return useMemo(
    () => calcDimensions(sections, tiers, thickness, back),
    [sections, tiers, thickness, back],
  );
};
