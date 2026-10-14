import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { type Dimensions } from '../lib/config';
import { registerRenderer } from '../lib/capture';
import { registerModel } from '../lib/exportModel';
import { useDimensions, useStore } from '../lib/store';
import { EXPLODE, Shelf, explodedDimensions } from './Shelf';
import { Hotspots, hotspotPoints } from './Hotspots';

/** Стартовый ракурс: три четверти, чуть сверху. */
const HOME = { theta: 0.58, phi: 1.24 };
/** Ракурс подлёта к точке-подсказке: ближе обычного, но узел виден в контексте. */
const FOCUS = { theta: 0.62, phi: 1.18, factor: 0.78, min: 1.3, max: 3.2 };
const focusRadius = (fit: number) =>
  Math.min(Math.max(fit * FOCUS.factor, FOCUS.min), FOCUS.max);

/** Дистанция, при которой модель целиком влезает в кадр. */
function fitDistance(dims: Dimensions, fovDeg: number, aspect: number) {
  const w = dims.width / 100;
  const h = dims.height / 100;
  const d = dims.depth / 100;
  const vFov = (fovDeg * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const distV = h / 2 / Math.tan(vFov / 2);
  const distH = w / 2 / Math.tan(hFov / 2);
  // Запас: ракурс «три четверти» проецирует ближний край крупнее расчётного.
  return (Math.max(distV, distH) + d / 2) * 1.3;
}

interface Goal {
  radius: number;
  phi: number;
  theta: number;
  target: THREE.Vector3;
}

/**
 * Держит кадр честным: подгоняет дистанцию под текущие габариты,
 * возвращает стартовый ракурс и подлетает к выбранной точке.
 */
function CameraRig({ controls }: { controls: React.RefObject<OrbitControlsImpl | null> }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const dims = useDimensions();
  const sections = useStore((s) => s.sections);
  const tiers = useStore((s) => s.tiers);
  const thickness = useStore((s) => s.thickness);
  const exploded = useStore((s) => s.exploded);
  const resetToken = useStore((s) => s.resetToken);
  const focusToken = useStore((s) => s.focusToken);
  const activeHotspot = useStore((s) => s.activeHotspot);

  const framed = useMemo(
    () => (exploded ? explodedDimensions(dims, sections, tiers) : dims),
    [exploded, dims, sections, tiers],
  );

  const fit = useMemo(
    () => fitDistance(framed, camera.fov, Math.max(size.width / size.height, 0.4)),
    [framed, camera.fov, size.width, size.height],
  );

  const goal = useRef<Goal | null>(null);
  const sph = useRef(new THREE.Spherical());
  const off = useRef(new THREE.Vector3());

  // В разборке детали уезжают вверх — центр кадра поднимается вместе с ними.
  const homeTarget = useMemo(
    () =>
      new THREE.Vector3(0, exploded ? (tiers * EXPLODE.yStep + EXPLODE.lift) / 200 : 0, 0),
    [exploded, tiers],
  );

  // Стартовый кадр, «Вернуть обзор», вход и выход из разборки.
  useEffect(() => {
    goal.current = {
      radius: fit,
      phi: HOME.phi,
      theta: HOME.theta,
      target: homeTarget,
    };
    // fit намеренно не в зависимостях: пересчёт кадра живёт в эффекте ниже
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken]);

  // Подлёт к точке-подсказке: и по клику в панели, и по клику на модели.
  useEffect(() => {
    if (!focusToken || !activeHotspot) return;
    const p = hotspotPoints(sections, tiers, thickness)[activeHotspot];
    const floorY = -dims.height / 200;
    goal.current = {
      radius: focusRadius(fit),
      phi: FOCUS.phi,
      theta: FOCUS.theta,
      target: new THREE.Vector3(p[0] / 100, floorY + p[1] / 100, p[2] / 100),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken]);

  // Конфигурация выросла — отъезжаем, чтобы модель не вылезала за кадр.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    c.minDistance = Math.min(fit * 0.42, focusRadius(fit) * 0.7);
    c.maxDistance = fit * 1.7;
    // Габариты изменились — кадр пересобираем всегда, угол обзора сохраняем.
    if (activeHotspot) return;
    off.current.copy(camera.position).sub(c.target);
    sph.current.setFromVector3(off.current);
    goal.current = {
      radius: fit,
      phi: sph.current.phi,
      theta: sph.current.theta,
      target: homeTarget,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit, camera, controls]);

  useFrame((_, dt) => {
    const g = goal.current;
    const c = controls.current;
    if (!g || !c) return;
    const k = 1 - Math.pow(0.002, Math.min(dt, 0.1));

    c.target.lerp(g.target, k);
    off.current.copy(camera.position).sub(c.target);
    sph.current.setFromVector3(off.current);
    const s = sph.current;
    s.radius += (g.radius - s.radius) * k;
    s.phi += (g.phi - s.phi) * k;
    s.theta += (g.theta - s.theta) * k;
    off.current.setFromSpherical(s);
    camera.position.copy(c.target).add(off.current);
    camera.lookAt(c.target);

    if (
      Math.abs(g.radius - s.radius) < 0.003 &&
      Math.abs(g.phi - s.phi) < 0.003 &&
      Math.abs(g.theta - s.theta) < 0.003 &&
      c.target.distanceTo(g.target) < 0.003
    ) {
      goal.current = null;
    }
  });

  // Ручное вращение отменяет доводку — управление у пользователя.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const stop = () => {
      goal.current = null;
    };
    c.addEventListener('start', stop);
    return () => c.removeEventListener('start', stop);
  }, [controls]);

  return null;
}

/** Отдаёт рендерер наружу — для «Сохранить PNG». */
function RendererBridge() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    registerRenderer({ gl, scene, camera });
  }, [gl, scene, camera]);
  return null;
}

function Stage() {
  const dims = useDimensions();
  const exploded = useStore((s) => s.exploded);
  const closeHotspot = useStore((s) => s.closeHotspot);
  const activeHotspot = useStore((s) => s.activeHotspot);

  // Модель строится в сантиметрах от пола; здесь переводим в метры и центрируем.
  const floorY = -dims.height / 200;

  return (
    <>
      <color attach="background" args={['#f4f3f0']} />

      <ambientLight intensity={0.5} />
      <directionalLight
        position={[3.2, 5, 3.4]}
        intensity={2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3.2}
        shadow-camera-bottom={-3.2}
        shadow-camera-near={0.5}
        shadow-camera-far={18}
      />
      <directionalLight position={[-4, 2.4, -2.6]} intensity={0.6} />

      {/* Окружение генерируется процедурно: ни одного сетевого запроса. */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={4} position={[0, 4, 2]} scale={[8, 4, 1]} />
        <Lightformer form="rect" intensity={1.6} position={[-4, 1.5, 1]} scale={[4, 4, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[4, 1, -2]} scale={[4, 4, 1]} />
        <Lightformer form="ring" intensity={2} position={[0, -3, 0]} scale={6} />
      </Environment>

      {/* Клик по пустому месту закрывает подсказку. */}
      <mesh
        position={[0, 0, -6]}
        onClick={() => {
          if (activeHotspot) closeHotspot();
        }}
        visible={false}
      >
        <planeGeometry args={[80, 80]} />
      </mesh>

      <group position={[0, floorY, 0]} scale={0.01}>
        {/* Отдельная группа: в .glb уезжает только стеллаж, без точек-подсказок. */}
        <group ref={registerModel}>
          <Shelf />
        </group>
        <Hotspots />
      </group>

      <ContactShadows
        position={[0, floorY + 0.002, 0]}
        opacity={exploded ? 0.25 : 0.8}
        // Тень масштабируем по модели, иначе на широкой раскладке она бледнеет.
        scale={(Math.max(dims.width, dims.depth) / 100) * 1.8}
        blur={1.4}
        far={exploded ? EXPLODE.lift / 100 + 0.1 : 0.6}
        resolution={1024}
      />
    </>
  );
}

export function Viewer() {
  const controls = useRef<OrbitControlsImpl | null>(null);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [1.6, 1.1, 2.4], fov: 32, near: 0.05, far: 100 }}
      // preserveDrawingBuffer обязателен: без него toDataURL отдаёт пустой PNG.
      gl={{ preserveDrawingBuffer: true, antialias: true }}
    >
      <RendererBridge />
      <CameraRig controls={controls} />
      <Suspense fallback={null}>
        <Stage />
      </Suspense>
      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minPolarAngle={0.3}
        maxPolarAngle={Math.PI / 2 - 0.03}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}
