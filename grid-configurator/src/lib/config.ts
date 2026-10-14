// Единый источник правды по конфигурации: типы, опции, цены, габариты.

export type SectionsCount = 2 | 3 | 4;
export type TiersCount = 3 | 4 | 5;
export type MaterialId = 'oak' | 'white' | 'metal';
export type BackId = 'none' | 'hdf' | 'mirror';
export type DrawersCount = 0 | 1 | 2;
export type EdgeId = 'sharp' | 'soft' | 'round';
export type ThicknessMm = 16 | 22 | 36;

export interface Config {
  sections: SectionsCount;
  tiers: TiersCount;
  material: MaterialId;
  back: BackId;
  drawers: DrawersCount;
  edge: EdgeId;
  thickness: ThicknessMm;
}

/* ------------------------------------------------------------------ цены */

export const PRICE = {
  /** базовая цена: 2 секции, 3 яруса, ЛДСП, без задней стенки, без ящиков */
  base: 12_900,
  perExtraSection: 4_200,
  perExtraTier: 3_100,
  material: { oak: 0, white: 0, metal: 8_000 } as Record<MaterialId, number>,
  back: { none: 0, hdf: 2_400, mirror: 6_900 } as Record<BackId, number>,
  perDrawer: 3_800,
  edge: { sharp: 0, soft: 2_900, round: 5_400 } as Record<EdgeId, number>,
  thickness: { 16: 0, 22: 1_800, 36: 4_600 } as Record<ThicknessMm, number>,
} as const;

export function calcPrice(c: Config): number {
  return (
    PRICE.base +
    (c.sections - 2) * PRICE.perExtraSection +
    (c.tiers - 3) * PRICE.perExtraTier +
    PRICE.material[c.material] +
    PRICE.back[c.back] +
    c.drawers * PRICE.perDrawer +
    PRICE.edge[c.edge] +
    PRICE.thickness[c.thickness]
  );
}

/** Разложение цены по строкам — для панели «из чего складывается». */
export function priceBreakdown(c: Config): { label: string; value: number }[] {
  return [
    { label: 'Базовый корпус', value: PRICE.base },
    { label: `Секции: ${c.sections}`, value: (c.sections - 2) * PRICE.perExtraSection },
    { label: `Ярусы: ${c.tiers}`, value: (c.tiers - 3) * PRICE.perExtraTier },
    { label: `Материал: ${MATERIALS[c.material].label}`, value: PRICE.material[c.material] },
    { label: `Задняя стенка: ${BACKS[c.back].label}`, value: PRICE.back[c.back] },
    { label: `Ящики: ${c.drawers}`, value: c.drawers * PRICE.perDrawer },
    { label: `Форма корпуса: ${EDGES[c.edge].label}`, value: PRICE.edge[c.edge] },
    { label: `Толщина полок: ${c.thickness} мм`, value: PRICE.thickness[c.thickness] },
  ];
}

export const formatPrice = (v: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v) + ' ₽';

/** Доплата в карточке опции: «+8 000 ₽» либо «без доплаты». */
export const formatSurcharge = (v: number) => (v > 0 ? `+${formatPrice(v)}` : 'без доплаты');

/* -------------------------------------------------------------- геометрия */
// Все размеры в сантиметрах. Сцена рендерится в метрах (group scale = 0.01).

export const CM = {
  /** чистая ширина одной секции */
  sectionW: 40,
  /** чистая высота одного яруса */
  tierH: 36,
  /** глубина корпуса */
  depth: 32,
  /** высота регулируемой ножки */
  legH: 4,
  /** толщина задней стенки (ХДФ 6 мм) */
  backT: 0.6,
} as const;

/** Толщина плиты в сантиметрах — параметр конфигурации, а не константа. */
export const panelT = (thickness: ThicknessMm) => thickness / 10;

/** Радиус скругления рёбер в сантиметрах. */
export const edgeR = (edge: EdgeId) => EDGES[edge].mm / 10;

export interface Dimensions {
  /** габаритная ширина, см */
  width: number;
  /** габаритная высота с ножками, см */
  height: number;
  /** габаритная глубина, см */
  depth: number;
  /** высота корпуса без ножек, см */
  carcassH: number;
}

/**
 * Габариты считаются честно из числа секций, ярусов и толщины плиты.
 * Задняя стенка накладная — она добавляется к габаритной глубине.
 */
export function calcDimensions(
  sections: number,
  tiers: number,
  thickness: ThicknessMm = 16,
  back: BackId = 'none',
): Dimensions {
  const t = panelT(thickness);
  const width = sections * CM.sectionW + (sections + 1) * t;
  const carcassH = tiers * CM.tierH + (tiers + 1) * t;
  return {
    width: round1(width),
    height: round1(carcassH + CM.legH),
    depth: round1(CM.depth + (back === 'none' ? 0 : CM.backT)),
    carcassH: round1(carcassH),
  };
}

const round1 = (v: number) => Math.round(v * 10) / 10;
export const formatCm = (v: number) => String(round1(v)).replace('.', ',');

/* ------------------------------------------------------------- справочники */

export const MATERIALS: Record<
  MaterialId,
  {
    label: string;
    swatch: string;
    color: string;
    roughness: number;
    metalness: number;
    backColor: string;
    env: number;
  }
> = {
  oak: {
    label: 'ЛДСП дуб',
    swatch: '#c49a68',
    color: '#c9a273',
    roughness: 0.72,
    metalness: 0.02,
    backColor: '#8d6b45',
    env: 0.7,
  },
  white: {
    label: 'ЛДСП белый',
    swatch: '#eeeeea',
    color: '#eeeeea',
    roughness: 0.62,
    metalness: 0.02,
    backColor: '#d6d6d1',
    env: 0.8,
  },
  metal: {
    label: 'Металл чёрный',
    swatch: '#33353a',
    color: '#3a3d43',
    roughness: 0.42,
    metalness: 0.82,
    backColor: '#26282c',
    env: 1.6,
  },
};

export const BACKS: Record<BackId, { label: string; hint: string }> = {
  none: { label: 'Нет', hint: 'Открытый насквозь' },
  hdf: { label: 'ХДФ', hint: 'Глухая панель' },
  mirror: { label: 'Зеркало', hint: 'Визуально шире' },
};

export const EDGES: Record<EdgeId, { label: string; hint: string; mm: number }> = {
  sharp: { label: 'Прямой', hint: 'Острые углы', mm: 0 },
  soft: { label: 'Мягкий', hint: 'Радиус 12 мм', mm: 12 },
  round: { label: 'Округлый', hint: 'Радиус 30 мм', mm: 30 },
};

export const THICKNESSES: Record<ThicknessMm, { label: string; hint: string }> = {
  16: { label: '16 мм', hint: 'Базовая плита' },
  22: { label: '22 мм', hint: 'Полки толще' },
  36: { label: '36 мм', hint: 'Массивный вид' },
};

export const SECTION_OPTIONS: SectionsCount[] = [2, 3, 4];
export const TIER_OPTIONS: TiersCount[] = [3, 4, 5];
export const DRAWER_OPTIONS: DrawersCount[] = [0, 1, 2];
export const EDGE_OPTIONS: EdgeId[] = ['sharp', 'soft', 'round'];
export const THICKNESS_OPTIONS: ThicknessMm[] = [16, 22, 36];

/* ------------------------------------------------------------------ артикул */

const MATERIAL_SKU: Record<MaterialId, string> = { oak: 'OAK', white: 'WHT', metal: 'MTL' };
const BACK_SKU: Record<BackId, string> = { none: 'NOB', hdf: 'HDF', mirror: 'MIR' };

/** Артикул собирается из выбранного: GRID-3S-4Y-MTL-HDF-2D-T22-R12 */
export function buildSku(c: Config): string {
  return [
    'GRID',
    `${c.sections}S`,
    `${c.tiers}Y`,
    MATERIAL_SKU[c.material],
    BACK_SKU[c.back],
    `${c.drawers}D`,
    `T${c.thickness}`,
    `R${EDGES[c.edge].mm}`,
  ].join('-');
}

/** Спецификация текстом — для копирования и для файла заказа. */
export function buildSpecText(c: Config): string {
  const d = calcDimensions(c.sections, c.tiers, c.thickness, c.back);
  const lines = [
    'Модульный стеллаж GRID',
    `Артикул: ${buildSku(c)}`,
    '',
    `Секции: ${c.sections}`,
    `Ярусы: ${c.tiers}`,
    `Материал: ${MATERIALS[c.material].label}`,
    `Форма корпуса: ${EDGES[c.edge].label}`,
    `Толщина полок: ${c.thickness} мм`,
    `Задняя стенка: ${BACKS[c.back].label}`,
    `Ящики: ${c.drawers}`,
    `Габариты Ш×В×Г: ${formatCm(d.width)} × ${formatCm(d.height)} × ${formatCm(d.depth)} см`,
    '',
    'Расчёт цены:',
    ...priceBreakdown(c)
      .filter((r) => r.value > 0)
      .map((r) => `  ${r.label} — ${formatPrice(r.value)}`),
    `Итого: ${formatPrice(calcPrice(c))}`,
    '',
    'Прототип конфигуратора, цена условная.',
  ];
  return lines.join('\n');
}

/* ---------------------------------------------------------------- подсказки */

export type HotspotId = 'joint' | 'foot' | 'shelf';

export interface HotspotInfo {
  id: HotspotId;
  index: number;
  /** категория заглавными — она же подпись чипа и всплывашки у точки */
  category: string;
  title: string;
  text: string;
  /** техническая строка мелким шрифтом под линией */
  spec: (c: Config) => string;
}

export const HOTSPOTS: HotspotInfo[] = [
  {
    id: 'joint',
    index: 1,
    category: 'Крепление полки',
    title: 'Скрытый эксцентрик',
    text: 'Полка садится в паз боковины и стягивается эксцентриком изнутри. Снаружи крепёж не виден, полку можно переставить по высоте без инструмента.',
    spec: () => 'паз 8 мм · эксцентрик Ø15 · шаг перестановки 32 мм',
  },
  {
    id: 'foot',
    index: 2,
    category: 'Регулируемая ножка',
    title: 'Компенсация неровного пола',
    text: 'Винтовая ножка с резиновой пятой. Выкручивается на 15 мм, чтобы стеллаж не качался на неровном полу и не царапал покрытие.',
    spec: () => 'ход 15 мм · резьба М8 · пята Ø30 мм',
  },
  {
    id: 'shelf',
    index: 3,
    category: 'Толщина панели',
    title: 'Несущая способность',
    text: 'От толщины зависит, сколько выдержит полка без прогиба. 22 мм держит книги по всей длине, 16 мм — только лёгкое.',
    spec: () => '16/22/36 мм · нагрузка до 25 кг на полку',
  },
];

export const HOTSPOT_BY_ID = Object.fromEntries(HOTSPOTS.map((h) => [h.id, h])) as Record<
  HotspotId,
  HotspotInfo
>;

export const DEFAULT_CONFIG: Config = {
  sections: 3,
  tiers: 4,
  material: 'oak',
  back: 'hdf',
  drawers: 1,
  edge: 'soft',
  thickness: 22,
};
