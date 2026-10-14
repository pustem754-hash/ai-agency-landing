import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';
import {
  CM,
  MATERIALS,
  calcDimensions,
  edgeR,
  panelT,
  type Dimensions,
  type EdgeId,
  type ThicknessMm,
} from '../lib/config';
import { useStore } from '../lib/store';

/** Смещения деталей в режиме разборки, см. */
export const EXPLODE = {
  /** шаг разъезда стоек и секций по X */
  xStep: 30,
  /** дополнительный интервал между полками по Y */
  yStep: 16,
  /** отъезд задней стенки назад */
  backZ: -42,
  /** выдвижение ящика вперёд */
  drawerZ: 26,
  /** опускание ножек */
  legDrop: 11,
  /** подъём всего корпуса, чтобы ножки не ушли под пол */
  lift: 12,
} as const;

/** Габарит разобранного состояния — нужен камере, чтобы всё влезло в кадр. */
export function explodedDimensions(dims: Dimensions, sections: number, tiers: number): Dimensions {
  return {
    width: dims.width + sections * EXPLODE.xStep,
    height: dims.height + tiers * EXPLODE.yStep + EXPLODE.lift,
    depth: dims.depth + EXPLODE.drawerZ - EXPLODE.backZ,
    carcassH: dims.carcassH,
  };
}

/* ------------------------------------------------------- вспомогательные */

/** Группа, плавно доезжающая до целевого смещения (режим разборки). */
function Slide({
  x = 0,
  y = 0,
  z = 0,
  children,
}: {
  x?: number;
  y?: number;
  z?: number;
  children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null!);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const k = 1 - Math.pow(0.004, Math.min(dt, 0.1));
    g.position.x += (x - g.position.x) * k;
    g.position.y += (y - g.position.y) * k;
    g.position.z += (z - g.position.z) * k;
  });
  return <group ref={ref}>{children}</group>;
}

/**
 * Скруглённая коробка. Радиус зажимается половиной меньшей стороны —
 * иначе RoundedBoxGeometry вырождается и деталь схлопывается.
 */
function useRoundedGeometry(
  w: number,
  h: number,
  d: number,
  radius: number,
): THREE.BufferGeometry {
  const geo = useMemo(() => {
    const r = Math.min(radius, Math.min(w, h, d) / 2 - 0.01);
    return r <= 0.03
      ? new THREE.BoxGeometry(w, h, d)
      : new RoundedBoxGeometry(w, h, d, 3, r);
  }, [w, h, d, radius]);

  useEffect(() => () => geo.dispose(), [geo]);
  return geo;
}

function Part({
  geometry,
  position,
  material,
  tag,
}: {
  geometry: THREE.BufferGeometry;
  position: [number, number, number];
  material: THREE.Material;
  /** метка детали — по ней автопроверка ищет пересечения */
  tag?: string;
}) {
  return (
    <mesh
      geometry={geometry}
      position={position}
      material={material}
      userData={tag ? { tag } : undefined}
      castShadow
      receiveShadow
    />
  );
}

/* ------------------------------------------------------------ раскладка */

export interface Layout {
  width: number;
  height: number;
  depth: number;
  carcassH: number;
  /** толщина плиты, см */
  t: number;
  /** x-координаты центров вертикальных стоек, шт. = sections + 1 */
  panelX: number[];
  /** y-координаты центров горизонтальных полок, шт. = tiers + 1 */
  shelfY: number[];
  /** x-координаты центров секций, шт. = sections */
  sectionX: number[];
}

/** Честная раскладка: всё выводится из числа секций, ярусов и толщины. */
export function buildLayout(sections: number, tiers: number, thickness: ThicknessMm): Layout {
  const t = panelT(thickness);
  const { width, height, carcassH } = calcDimensions(sections, tiers, thickness);
  // Глубина корпуса без накладной задней стенки — из неё строятся детали.
  const depth = CM.depth;
  const step = CM.sectionW + t;

  const panelX: number[] = [];
  for (let i = 0; i <= sections; i++) panelX.push(-width / 2 + t / 2 + i * step);

  const sectionX: number[] = [];
  for (let s = 0; s < sections; s++) sectionX.push(panelX[s] + step / 2);

  const shelfY: number[] = [];
  for (let j = 0; j <= tiers; j++) shelfY.push(CM.legH + t / 2 + j * (CM.tierH + t));

  return { width, height, depth, carcassH, t, panelX, shelfY, sectionX };
}

/* ------------------------------------------------------------- материалы */

function useMaterials() {
  const material = useStore((s) => s.material);
  const back = useStore((s) => s.back);

  const mats = useMemo(() => {
    const m = MATERIALS[material];
    const body = new THREE.MeshStandardMaterial({
      color: m.color,
      roughness: m.roughness,
      metalness: m.metalness,
      envMapIntensity: m.env,
    });
    const backMat = new THREE.MeshStandardMaterial({
      color: back === 'mirror' ? '#6c7379' : m.backColor,
      roughness: back === 'mirror' ? 0.3 : 0.85,
      metalness: back === 'mirror' ? 0.6 : 0.02,
    });
    const hardware = new THREE.MeshStandardMaterial({
      color: '#4a4d53',
      roughness: 0.32,
      metalness: 0.9,
      envMapIntensity: 1.3,
    });
    return { body, backMat, hardware };
  }, [material, back]);

  useEffect(
    () => () => {
      mats.body.dispose();
      mats.backMat.dispose();
      mats.hardware.dispose();
    },
    [mats],
  );

  return mats;
}

/**
 * Радиус скругления доводится плавно: переключение формы корпуса
 * не должно быть рывком. Геометрия пересобирается по квантованному
 * значению, поэтому лишних пересборок не набегает.
 */
function useAnimatedRadius(edge: EdgeId) {
  const target = edgeR(edge);
  const [r, setR] = useState(target);
  const cur = useRef(target);

  useFrame((_, dt) => {
    const k = 1 - Math.pow(0.004, Math.min(dt, 0.1));
    cur.current += (target - cur.current) * k;
    if (Math.abs(target - cur.current) < 0.005) cur.current = target;
    const q = Math.round(cur.current * 40) / 40;
    setR((prev) => (Math.abs(prev - q) > 1e-6 ? q : prev));
  });

  return r;
}

/* ---------------------------------------------------------------- ящик */

function Drawer({
  layout,
  x,
  material,
  hardware,
  radius,
  pulled,
}: {
  layout: Layout;
  x: number;
  material: THREE.Material;
  hardware: THREE.Material;
  radius: number;
  pulled: boolean;
}) {
  const { depth, shelfY, t } = layout;
  // Ящик живёт в нижнем ярусе: между полкой 0 и полкой 1.
  const bottom = shelfY[0] + t / 2;
  const top = shelfY[1] - t / 2;
  const h = top - bottom;
  const w = CM.sectionW - 0.8;
  const boxH = h - 1.2;
  const cy = bottom + h / 2;
  const d = depth - 3;

  const front = useRoundedGeometry(w, boxH, 1.8, radius);
  const handle = useRoundedGeometry(w * 0.42, 1.4, 1.4, 0.6);
  const floor = useRoundedGeometry(w - 2, 0.9, d - 2, 0);
  const side = useRoundedGeometry(0.9, boxH - 2, d - 2, 0);
  const rear = useRoundedGeometry(w - 2, boxH - 2, 0.9, 0);

  return (
    <Slide z={pulled ? EXPLODE.drawerZ : 0}>
      <group position={[x, cy, 0]}>
        <Part geometry={front} position={[0, 0, d / 2]} material={material} tag="drawer" />
        <Part geometry={handle} position={[0, 0, d / 2 + 1.6]} material={hardware} />
        <Part geometry={floor} position={[0, -boxH / 2 + 0.6, -0.9]} material={material} tag="drawer" />
        <Part geometry={side} position={[-(w - 2) / 2, 0, -0.9]} material={material} tag="drawer" />
        <Part geometry={side} position={[(w - 2) / 2, 0, -0.9]} material={material} tag="drawer" />
        <Part geometry={rear} position={[0, 0, -d / 2 + 0.4]} material={material} tag="drawer" />
      </group>
    </Slide>
  );
}

/* --------------------------------------------------------------- стеллаж */

export function Shelf() {
  const sections = useStore((s) => s.sections);
  const tiers = useStore((s) => s.tiers);
  const back = useStore((s) => s.back);
  const drawers = useStore((s) => s.drawers);
  const edge = useStore((s) => s.edge);
  const thickness = useStore((s) => s.thickness);
  const exploded = useStore((s) => s.exploded);

  const layout = useMemo(
    () => buildLayout(sections, tiers, thickness),
    [sections, tiers, thickness],
  );
  const { body, backMat, hardware } = useMaterials();
  const radius = useAnimatedRadius(edge);

  const { width, carcassH, depth, panelX, shelfY, sectionX, t } = layout;
  const panelCY = CM.legH + carcassH / 2;

  const panelGeo = useRoundedGeometry(t, carcassH, depth, radius);
  const shelfGeo = useRoundedGeometry(CM.sectionW, t, depth, radius);
  const backGeo = useRoundedGeometry(width, carcassH, CM.backT, Math.min(radius, 0.28));
  const legGeo = useMemo(() => new THREE.CylinderGeometry(1.5, 1.9, CM.legH, 20), []);
  useEffect(() => () => legGeo.dispose(), [legGeo]);

  /** Смещение по X в разборке: одинаковый шаг для стоек и секций. */
  const spread = (idx: number) => (exploded ? (idx - sections / 2) * EXPLODE.xStep : 0);

  return (
    <Slide y={exploded ? EXPLODE.lift : 0}>
      {/* вертикальные стойки — расходятся в стороны */}
      {panelX.map((x, i) => (
        <Slide key={`panel-${i}`} x={spread(i)}>
          <Part geometry={panelGeo} position={[x, panelCY, 0]} material={body} tag="panel" />
        </Slide>
      ))}

      {/* полки: каждая едет отдельно, интервалы одинаковые, крышка уходит выше всех */}
      {sectionX.map((x, s) =>
        shelfY.map((y, j) => (
          <Slide
            key={`shelf-${s}-${j}`}
            x={spread(s + 0.5)}
            y={exploded ? j * EXPLODE.yStep : 0}
          >
            <Part geometry={shelfGeo} position={[x, y, 0]} material={body} tag="shelf" />
          </Slide>
        )),
      )}

      {/* ящики — выдвигаются вперёд */}
      {sectionX.slice(0, drawers).map((x, s) => (
        <Slide key={`drawer-${s}`} x={spread(s + 0.5)}>
          <Drawer
            layout={layout}
            x={x}
            material={body}
            hardware={hardware}
            radius={radius}
            pulled={exploded}
          />
        </Slide>
      ))}

      {/* задняя стенка — отъезжает назад */}
      {back !== 'none' && (
        <Slide z={exploded ? EXPLODE.backZ : 0}>
          <Part
            geometry={backGeo}
            position={[0, panelCY, -depth / 2 - CM.backT / 2]}
            material={backMat}
            tag="back"
          />
          {/* Зеркало — настоящее отражение: процедурного окружения для него мало. */}
          {back === 'mirror' && (
            <mesh position={[0, panelCY, -depth / 2 + 0.04]}>
              <planeGeometry args={[width, carcassH]} />
              <MeshReflectorMaterial
                resolution={512}
                mixBlur={0.35}
                mixStrength={2.4}
                blur={[80, 40]}
                mirror={0.85}
                color="#dfe6ea"
                metalness={0.5}
                roughness={0.25}
              />
            </mesh>
          )}
        </Slide>
      )}

      {/* регулируемые ножки — опускаются вниз */}
      {([-1, 1] as const).map((sx) =>
        ([-1, 1] as const).map((sz) => (
          <Slide
            key={`leg-${sx}-${sz}`}
            x={spread(sx < 0 ? 0 : sections)}
            y={exploded ? -EXPLODE.legDrop : 0}
          >
            <mesh
              geometry={legGeo}
              position={[sx * (width / 2 - 4), CM.legH / 2, sz * (depth / 2 - 4)]}
              material={hardware}
              castShadow
            />
          </Slide>
        )),
      )}
    </Slide>
  );
}
