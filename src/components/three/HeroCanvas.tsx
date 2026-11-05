"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, PresentationControls } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { ProceduralCity } from "./ProceduralCity";
import { GlbModel } from "./GlbModel";
import { useInView, useLowPower, useWebGLSupport } from "./useCanvasSupport";

type Props = {
  mode: "procedural" | "model";
  modelUrl?: string | null;
  autoRotate: boolean;
  lightsDefault: boolean;
  labels: { interact: string; lightsOn: string; lightsOff: string; loading: string };
  fallback: ReactNode;
};

/** Scroll progress through the first viewport (0 → 1). */
function useHeroScroll() {
  const progress = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      progress.current = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.95)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return progress;
}

function Rig({
  children,
  autoRotate,
  reduce,
  scroll,
}: {
  children: ReactNode;
  autoRotate: boolean;
  reduce: boolean;
  scroll: React.RefObject<number>;
}) {
  const group = useRef<THREE.Group>(null);
  const { camera, pointer, size } = useThree();
  const base = useRef(new THREE.Vector3());
  const intro = useRef(reduce ? 1 : 0);
  const narrow = size.width < 768;

  useEffect(() => {
    base.current.set(narrow ? 12 : 10.8, narrow ? 9.6 : 7.8, narrow ? 13.6 : 11.8);
    camera.position.copy(base.current);
    camera.lookAt(0.25, 0.3, 0);
  }, [camera, narrow]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const s = reduce ? 0 : scroll.current ?? 0;
    // Intro: the model rises and turns into place once on load.
    intro.current = Math.min(1, intro.current + dt * 0.45);
    const e = 1 - Math.pow(1 - intro.current, 4);

    // A slow exhibition-turntable sway rather than a full spin keeps the composition.
    const spin = autoRotate && !reduce ? Math.sin(state.clock.elapsedTime * 0.11) * 0.42 : 0;
    g.rotation.y = -0.55 + (1 - e) * -0.6 + spin + s * 0.55;
    g.position.y = (1 - e) * -0.35 - s * 0.25;

    // Pointer parallax + scroll dolly
    const px = reduce ? 0 : pointer.x * 0.35;
    const py = reduce ? 0 : pointer.y * 0.2;
    const dolly = 1 - s * 0.22;
    const target = new THREE.Vector3(base.current.x * dolly + px, base.current.y * dolly + py - s * 0.6, base.current.z * dolly);
    camera.position.lerp(target, reduce ? 1 : 1 - Math.pow(0.001, dt));
    camera.lookAt(0.25, 0.3 - s * 0.2, 0);
  });

  return <group ref={group}>{children}</group>;
}

/** Fires once the first frame has rendered (robust to StrictMode remounts, unlike onCreated). */
function ReadySignal({ onReady }: { onReady: () => void }) {
  const { gl } = useThree();
  const done = useRef(false);
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 0.92;
  }, [gl]);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    requestAnimationFrame(onReady);
  });
  return null;
}

function Lights({ lightsOn }: { lightsOn: boolean }) {
  const key = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  useFrame((_, dt) => {
    if (key.current) key.current.intensity = THREE.MathUtils.damp(key.current.intensity, lightsOn ? 1.7 : 2.6, 2.5, dt);
    if (hemi.current) hemi.current.intensity = THREE.MathUtils.damp(hemi.current.intensity, lightsOn ? 0.45 : 0.7, 2.5, dt);
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={["#fffaf0", "#9d9486", 0.85]} />
      <directionalLight
        ref={key}
        position={[5.5, 9, 4.5]}
        intensity={2.4}
        color="#fff4e3"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-camera-near={1}
        shadow-camera-far={25}
      />
      <directionalLight position={[-6, 4, -5]} intensity={0.45} color="#dfe6ea" />
    </>
  );
}

export default function HeroCanvas({ mode, modelUrl, autoRotate, lightsDefault, labels, fallback }: Props) {
  const webgl = useWebGLSupport();
  const reduce = !!useReducedMotion();
  const lowPower = useLowPower();
  const wrapper = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapper);
  const scroll = useHeroScroll();
  const [lightsOn, setLightsOn] = useState(lightsDefault);
  const [ready, setReady] = useState(false);

  if (webgl === false) return <>{fallback}</>;

  return (
    <div ref={wrapper} className="relative h-full w-full">
      <div
        className={`absolute inset-0 transition-opacity duration-[1600ms] ease-[var(--ease-architect)] ${ready ? "opacity-100" : "opacity-0"}`}
      >
        {webgl && (
          <Canvas
            shadows={!lowPower}
            dpr={lowPower ? [1, 1.25] : [1, 1.75]}
            frameloop={inView ? (reduce ? "demand" : "always") : "never"}
            camera={{ fov: 28, near: 0.1, far: 120, position: [10.2, 7.4, 11.2] }}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            aria-label={labels.interact}
            role="img"
          >
            <ReadySignal onReady={() => setReady(true)} />
            <Lights lightsOn={lightsOn} />
            <Environment resolution={128} frames={1} environmentIntensity={0.55}>
              <Lightformer intensity={1.4} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
              <Lightformer intensity={0.6} position={[-6, 2, 3]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
              <Lightformer intensity={0.5} position={[6, 2, -3]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} color="#f2e6d4" />
            </Environment>
            <PresentationControls
              global={false}
              cursor
              snap
              speed={1.2}
              polar={[-0.08, 0.18]}
              azimuth={[-0.7, 0.7]}
              damping={0.25}
            >
              <Rig autoRotate={autoRotate} reduce={reduce} scroll={scroll}>
                <Suspense fallback={null}>
                  {mode === "model" && modelUrl ? (
                    <group>
                      <mesh position={[0, -0.6, 0]} castShadow receiveShadow>
                        <boxGeometry args={[6.2, 1.2, 4.6]} />
                        <meshStandardMaterial color="#2a2926" roughness={0.6} />
                      </mesh>
                      <group position={[0, 0.001, 0]}>
                        <GlbModel url={modelUrl} fit={5.4} />
                      </group>
                    </group>
                  ) : (
                    <ProceduralCity lightsOn={lightsOn} />
                  )}
                </Suspense>
              </Rig>
            </PresentationControls>
            <ContactShadows position={[0, -1.21, 0]} opacity={0.32} scale={16} blur={2.8} far={3} resolution={512} color="#3b352c" />
          </Canvas>
        )}
      </div>

      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-live="polite">
          <div className="flex flex-col items-center gap-3">
            <span className="block h-px w-24 overflow-hidden bg-ink/10">
              <span className="block h-full w-1/2 animate-[loadbar_1.4s_ease-in-out_infinite] bg-ink/60" />
            </span>
            <span className="eyebrow text-graphite">{labels.loading}</span>
          </div>
        </div>
      )}

      {mode === "procedural" && (
        <button
          type="button"
          onClick={() => setLightsOn((v) => !v)}
          aria-pressed={lightsOn}
          className="group absolute bottom-4 right-4 z-10 flex items-center gap-2.5 rounded-full border border-ink/15 bg-paper/70 px-4 py-2.5 text-[0.75rem] text-ink backdrop-blur-md transition-colors hover:border-ink/40 md:bottom-8 md:right-8"
        >
          <span
            aria-hidden
            className={`h-2 w-2 rounded-full transition-all duration-700 ${lightsOn ? "bg-lamp shadow-[0_0_12px_3px_rgba(233,184,119,0.8)]" : "bg-concrete"}`}
          />
          {lightsOn ? labels.lightsOff : labels.lightsOn}
        </button>
      )}
    </div>
  );
}
