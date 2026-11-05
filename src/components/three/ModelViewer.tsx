"use client";

import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, useProgress } from "@react-three/drei";
import { Component, Suspense, useCallback, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { GlbModel, type ModelStats } from "./GlbModel";
import { useInView, useWebGLSupport } from "./useCanvasSupport";

export type ModelViewerLabels = {
  reset: string;
  fullscreen: string;
  hint: string;
  loading: string;
  error: string;
  wireframe?: string;
  autoRotate?: string;
};

class ViewerErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Loader({ label }: { label: string }) {
  const { progress, active } = useProgress();
  if (!active && progress >= 100) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
      <span className="block h-px w-32 bg-current/15">
        <span className="block h-full bg-current/70 transition-[width] duration-300" style={{ width: `${Math.round(progress)}%` }} />
      </span>
      <span className="font-mono text-[0.7rem] tracking-[0.12em] opacity-60">
        {label} · {Math.round(progress)}%
      </span>
    </div>
  );
}

/**
 * Interactive GLB viewer: orbit (rotate), zoom, pan, reset camera,
 * fullscreen, optional wireframe inspection and model statistics.
 */
export default function ModelViewer({
  url,
  labels,
  tone = "light",
  showInspect = false,
  onStats,
  className = "",
}: {
  url: string;
  labels: ModelViewerLabels;
  tone?: "light" | "dark";
  showInspect?: boolean;
  onStats?: (s: ModelStats) => void;
  className?: string;
}) {
  const webgl = useWebGLSupport();
  const wrapper = useRef<HTMLDivElement>(null);
  const controls = useRef<OrbitControlsImpl>(null);
  const inView = useInView(wrapper);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [stats, setStats] = useState<ModelStats | null>(null);

  const handleStats = useCallback(
    (s: ModelStats) => {
      setStats(s);
      onStats?.(s);
    },
    [onStats],
  );

  const reset = () => controls.current?.reset();
  const fullscreen = () => {
    const el = wrapper.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  const dark = tone === "dark";
  const btn = `rounded-full border px-3.5 py-2 text-[0.72rem] backdrop-blur transition-colors ${
    dark ? "border-white/20 bg-black/30 text-white hover:border-white/60" : "border-black/15 bg-white/70 text-black hover:border-black/50"
  }`;

  return (
    <div
      ref={wrapper}
      className={`relative overflow-hidden ${dark ? "bg-[#1d1c1a] text-white" : "bg-[#ebe6dd] text-black"} ${className}`}
    >
      {webgl === false ? (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm opacity-70">{labels.error}</div>
      ) : (
        <ViewerErrorBoundary fallback={<div className="flex h-full items-center justify-center p-6 text-center text-sm opacity-70">{labels.error}</div>}>
          {webgl && (
            <Canvas
              shadows
              dpr={[1, 1.75]}
              frameloop={inView ? "always" : "never"}
              camera={{ fov: 32, position: [6, 4.5, 7], near: 0.05, far: 200 }}
              gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
              onCreated={({ gl }) => {
                gl.toneMapping = THREE.ACESFilmicToneMapping;
              }}
            >
              <hemisphereLight args={["#fffaf0", "#b8b1a5", 0.9]} />
              <directionalLight
                position={[5, 9, 5]}
                intensity={2.2}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-camera-left={-6}
                shadow-camera-right={6}
                shadow-camera-top={6}
                shadow-camera-bottom={-6}
                shadow-bias={-0.0004}
              />
              <Environment resolution={128} frames={1}>
                <Lightformer intensity={1.3} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
                <Lightformer intensity={0.6} position={[-6, 2, 3]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
              </Environment>
              <Suspense fallback={null}>
                <GlbModel url={url} fit={5} wireframe={wireframe} onStats={handleStats} />
              </Suspense>
              <ContactShadows position={[0, -0.001, 0]} opacity={0.35} scale={14} blur={2.4} far={4} resolution={512} />
              <OrbitControls
                ref={controls}
                makeDefault
                enableDamping
                dampingFactor={0.08}
                minDistance={2}
                maxDistance={26}
                maxPolarAngle={Math.PI / 2 - 0.04}
                target={[0, 0.8, 0]}
                autoRotate={autoRotate}
                autoRotateSpeed={0.8}
              />
            </Canvas>
          )}
          <Loader label={labels.loading} />
        </ViewerErrorBoundary>
      )}

      <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2">
        <span className={`hidden text-[0.72rem] sm:block ${dark ? "text-white/60" : "text-black/55"}`}>{labels.hint}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          {showInspect && labels.wireframe && (
            <button type="button" className={btn} aria-pressed={wireframe} onClick={() => setWireframe((v) => !v)}>
              {labels.wireframe}
            </button>
          )}
          {labels.autoRotate && (
            <button type="button" className={btn} aria-pressed={autoRotate} onClick={() => setAutoRotate((v) => !v)}>
              {labels.autoRotate}
            </button>
          )}
          <button type="button" className={btn} onClick={reset}>
            {labels.reset}
          </button>
          <button type="button" className={btn} onClick={fullscreen}>
            {labels.fullscreen}
          </button>
        </div>
      </div>

      {showInspect && stats && (
        <div className={`absolute left-3 top-3 rounded-md px-3 py-2 font-mono text-[0.68rem] leading-relaxed ${dark ? "bg-black/40 text-white/80" : "bg-white/75 text-black/70"}`}>
          <div>{stats.triangles.toLocaleString()} tris · {stats.meshes} meshes</div>
          <div>
            {stats.size.x.toFixed(2)} × {stats.size.y.toFixed(2)} × {stats.size.z.toFixed(2)} (source units)
          </div>
        </div>
      )}
    </div>
  );
}
