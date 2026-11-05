"use client";

/**
 * An original, procedurally generated architectural scale model:
 * a residential complex on a podium with surrounding townhouses, streets,
 * trees and scale figures — mounted on a basswood board and an exhibition plinth.
 *
 * All repeated elements (floor slabs, facade fins, windows, trees, figures)
 * are instanced so the whole model renders in a handful of draw calls.
 */
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// Material palette — card, basswood, acrylic, felt — like a physical model.
const C = {
  card: "#f3f0ea",
  cardShade: "#e6e1d8",
  basswood: "#d9c9ad",
  plinth: "#34322e",
  road: "#bdb7ad",
  roadLine: "#f3f0ea",
  pavement: "#e3ddd2",
  lawn: "#b9b79c",
  glass: "#aab6b5",
  lamp: "#ffc879",
  treeA: "#c9b994",
  treeB: "#a9ac8a",
  treeC: "#d8cfb6",
};

const FLOOR = 0.105;
const rand = mulberry32(7);

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Tower = { x: number; z: number; w: number; d: number; floors: number; base: number };

const PODIUM_H = 0.16;
const BOARD_TOP = 0.06;

const towers: Tower[] = [
  { x: -0.05, z: -0.95, w: 0.78, d: 0.78, floors: 15, base: BOARD_TOP + PODIUM_H },
  { x: 1.15, z: -1.05, w: 0.66, d: 0.96, floors: 11, base: BOARD_TOP + PODIUM_H },
  { x: 2.2, z: -0.25, w: 0.8, d: 0.7, floors: 17, base: BOARD_TOP + PODIUM_H },
  { x: 0.95, z: 0.55, w: 1.75, d: 0.42, floors: 6, base: BOARD_TOP + PODIUM_H },
];

function useInstances(build: (dummy: THREE.Object3D, push: (color?: THREE.Color) => void) => void) {
  return useMemo(() => {
    const matrices: THREE.Matrix4[] = [];
    const colors: THREE.Color[] = [];
    const dummy = new THREE.Object3D();
    build(dummy, (color) => {
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
      if (color) colors.push(color);
    });
    return { matrices, colors };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function Instanced({
  data,
  geometry,
  material,
  castShadow = true,
  receiveShadow = true,
}: {
  data: { matrices: THREE.Matrix4[]; colors: THREE.Color[] };
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    data.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    if (data.colors.length) data.colors.forEach((c, i) => mesh.setColorAt(i, c));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [data]);
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, data.matrices.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
}

export function ProceduralCity({ lightsOn }: { lightsOn: boolean }) {
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const canopy = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const figureGeo = useMemo(() => new THREE.CapsuleGeometry(0.0075, 0.03, 2, 6), []);

  const mats = useMemo(
    () => ({
      card: new THREE.MeshStandardMaterial({ color: C.card, roughness: 0.92 }),
      cardShade: new THREE.MeshStandardMaterial({ color: C.cardShade, roughness: 0.95 }),
      basswood: new THREE.MeshStandardMaterial({ color: C.basswood, roughness: 0.85 }),
      plinth: new THREE.MeshStandardMaterial({ color: C.plinth, roughness: 0.6, metalness: 0.05 }),
      road: new THREE.MeshStandardMaterial({ color: C.road, roughness: 1 }),
      line: new THREE.MeshStandardMaterial({ color: C.roadLine, roughness: 1 }),
      pavement: new THREE.MeshStandardMaterial({ color: C.pavement, roughness: 1 }),
      lawn: new THREE.MeshStandardMaterial({ color: C.lawn, roughness: 1 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: C.glass,
        roughness: 0.18,
        metalness: 0.05,
        transparent: true,
        opacity: 0.62,
        clearcoat: 0.6,
      }),
      tree: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, flatShading: true }),
      lamp: new THREE.MeshBasicMaterial({ color: C.lamp, transparent: true, opacity: 0, toneMapped: false }),
    }),
    [],
  );

  // Fade window lights in/out.
  const target = useRef(lightsOn ? 1 : 0);
  target.current = lightsOn ? 1 : 0;
  useFrame((_, dt) => {
    const m = mats.lamp;
    m.opacity = THREE.MathUtils.damp(m.opacity, target.current, 3.2, dt);
    m.visible = m.opacity > 0.01;
  });

  // ---- Floor slabs + balconies -------------------------------------------------
  const slabs = useInstances((d, push) => {
    for (const t of towers) {
      for (let f = 1; f <= t.floors; f++) {
        const y = t.base + f * FLOOR;
        const deep = f % 2 === 0 ? 0.07 : 0.045; // alternating balcony depth gives the facade rhythm
        d.position.set(t.x, y, t.z);
        d.scale.set(t.w + deep, 0.012, t.d + deep);
        d.rotation.set(0, 0, 0);
        push();
      }
      // roof parapet + plant room
      d.position.set(t.x, t.base + t.floors * FLOOR + 0.03, t.z);
      d.scale.set(t.w * 0.42, 0.06, t.d * 0.38);
      push();
    }
  });

  // ---- Vertical fins / mullions ------------------------------------------------
  const fins = useInstances((d, push) => {
    for (const t of towers) {
      const h = t.floors * FLOOR;
      const y = t.base + h / 2 + 0.005;
      const step = 0.095;
      const nx = Math.max(2, Math.round(t.w / step));
      const nz = Math.max(2, Math.round(t.d / step));
      for (let i = 0; i <= nx; i++) {
        const x = t.x - t.w / 2 + (i * t.w) / nx;
        for (const side of [-1, 1]) {
          d.position.set(x, y, t.z + (side * t.d) / 2);
          d.scale.set(0.009, h, 0.024);
          push();
        }
      }
      for (let i = 0; i <= nz; i++) {
        const z = t.z - t.d / 2 + (i * t.d) / nz;
        for (const side of [-1, 1]) {
          d.position.set(t.x + (side * t.w) / 2, y, z);
          d.scale.set(0.024, h, 0.009);
          push();
        }
      }
    }
  });

  // ---- Lit windows (only visible when lights are on) -------------------------------
  const windows = useInstances((d, push) => {
    for (const t of towers) {
      const step = 0.095;
      const nx = Math.max(2, Math.round(t.w / step));
      const nz = Math.max(2, Math.round(t.d / step));
      for (let f = 0; f < t.floors; f++) {
        const y = t.base + f * FLOOR + FLOOR / 2 + 0.006;
        for (let i = 0; i < nx; i++) {
          const x = t.x - t.w / 2 + ((i + 0.5) * t.w) / nx;
          for (const side of [-1, 1]) {
            if (rand() > 0.42) continue;
            d.position.set(x, y, t.z + side * (t.d / 2 - 0.012));
            d.scale.set((t.w / nx) * 0.82, FLOOR * 0.7, 0.006);
            push();
          }
        }
        for (let i = 0; i < nz; i++) {
          const z = t.z - t.d / 2 + ((i + 0.5) * t.d) / nz;
          for (const side of [-1, 1]) {
            if (rand() > 0.42) continue;
            d.position.set(t.x + side * (t.w / 2 - 0.012), y, z);
            d.scale.set(0.006, FLOOR * 0.7, (t.d / nz) * 0.82);
            push();
          }
        }
      }
    }
    // podium shopfront glow
    for (let i = 0; i < 14; i++) {
      d.position.set(-0.75 + i * 0.25, BOARD_TOP + PODIUM_H * 0.45, 0.9);
      d.scale.set(0.18, PODIUM_H * 0.6, 0.006);
      push();
    }
  });

  // ---- Surrounding townhouses ----------------------------------------------------
  const houses = useInstances((d, push) => {
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 4; i++) {
        const h = 0.18 + rand() * 0.16;
        d.position.set(-2.62 + row * 0.5, BOARD_TOP + h / 2, -1.6 + i * 0.62);
        d.scale.set(0.34, h, 0.44);
        push();
      }
    }
    for (let i = 0; i < 6; i++) {
      const h = 0.14 + rand() * 0.1;
      d.position.set(-0.6 + i * 0.62, BOARD_TOP + h / 2, 1.88);
      d.scale.set(0.44, h, 0.22);
      push();
    }
  });

  // ---- Road markings ---------------------------------------------------------------
  const marks = useInstances((d, push) => {
    for (let x = -2.9; x < 3; x += 0.22) {
      d.position.set(x, BOARD_TOP + 0.007, 1.32);
      d.scale.set(0.1, 0.002, 0.012);
      push();
    }
    for (let z = -2; z < 1.1; z += 0.22) {
      d.position.set(-1.38, BOARD_TOP + 0.007, z);
      d.scale.set(0.012, 0.002, 0.1);
      push();
    }
    // zebra crossing
    for (let i = 0; i < 6; i++) {
      d.position.set(-1.0 + i * 0.05, BOARD_TOP + 0.007, 1.32);
      d.scale.set(0.025, 0.002, 0.32);
      push();
    }
  });

  // ---- Trees ---------------------------------------------------------------------------
  const trees = useInstances((d, push) => {
    const palette = [C.treeA, C.treeB, C.treeC].map((c) => new THREE.Color(c));
    const place = (x: number, z: number, s = 1) => {
      const r = (0.07 + rand() * 0.04) * s;
      d.position.set(x, BOARD_TOP + r * 1.55, z);
      d.rotation.set(rand() * Math.PI, rand() * Math.PI, 0);
      d.scale.set(r, r * (1.05 + rand() * 0.25), r);
      push(palette[Math.floor(rand() * palette.length)].clone().offsetHSL(0, 0, (rand() - 0.5) * 0.05));
    };
    for (let x = -2.85; x < 2.9; x += 0.34) place(x + (rand() - 0.5) * 0.05, 1.62);
    for (let x = -2.85; x < 2.9; x += 0.42) place(x + (rand() - 0.5) * 0.05, 1.02 + (rand() - 0.5) * 0.04, 0.85);
    for (let z = -1.9; z < 0.9; z += 0.36) place(-1.1, z, 0.8);
    // courtyard park
    for (let i = 0; i < 16; i++) place(-0.85 + rand() * 0.6, -0.2 + rand() * 0.9, 0.9);
    for (let i = 0; i < 10; i++) place(2.4 + rand() * 0.45, 0.4 + rand() * 0.45, 0.8);
  });

  const trunks = useMemo(() => {
    // trunks are matched to canopies (same order)
    const matrices = trees.matrices.map((m) => {
      const p = new THREE.Vector3().setFromMatrixPosition(m);
      const h = p.y - BOARD_TOP;
      return new THREE.Matrix4().compose(
        new THREE.Vector3(p.x, BOARD_TOP + h / 2, p.z),
        new THREE.Quaternion(),
        new THREE.Vector3(0.008, h, 0.008),
      );
    });
    return { matrices, colors: [] as THREE.Color[] };
  }, [trees]);

  // ---- Scale figures --------------------------------------------------------------
  const figures = useInstances((d, push) => {
    for (let i = 0; i < 26; i++) {
      d.position.set(-0.9 + rand() * 3.6, BOARD_TOP + 0.024, 1.08 + rand() * 0.12);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
      push();
    }
    for (let i = 0; i < 12; i++) {
      d.position.set(-0.8 + rand() * 0.5, BOARD_TOP + PODIUM_H + 0.024, -0.1 + rand() * 0.5);
      push();
    }
  });

  // ---- Street lamps ----------------------------------------------------------------
  const lampPosts = useInstances((d, push) => {
    for (let x = -2.7; x < 2.9; x += 0.55) {
      d.position.set(x, BOARD_TOP + 0.06, 1.08);
      d.scale.set(0.006, 0.12, 0.006);
      push();
    }
  });
  const lampHeads = useInstances((d, push) => {
    for (let x = -2.7; x < 2.9; x += 0.55) {
      d.position.set(x, BOARD_TOP + 0.125, 1.08);
      d.scale.set(0.018, 0.008, 0.018);
      push();
    }
  });

  return (
    <group>
      {/* Exhibition plinth */}
      <mesh position={[0, -0.6, 0]} material={mats.plinth} castShadow receiveShadow>
        <boxGeometry args={[6.5, 1.2, 4.6]} />
      </mesh>
      {/* Basswood presentation board */}
      <mesh position={[0, BOARD_TOP / 2, 0]} material={mats.basswood} castShadow receiveShadow>
        <boxGeometry args={[6.25, BOARD_TOP, 4.35]} />
      </mesh>

      {/* Streets & pavements */}
      <mesh position={[0, BOARD_TOP + 0.003, 1.32]} material={mats.road} receiveShadow>
        <boxGeometry args={[6.25, 0.006, 0.42]} />
      </mesh>
      <mesh position={[-1.38, BOARD_TOP + 0.003, -0.45]} material={mats.road} receiveShadow>
        <boxGeometry args={[0.36, 0.006, 3.15]} />
      </mesh>
      <mesh position={[0, BOARD_TOP + 0.005, 1.7]} material={mats.pavement} receiveShadow>
        <boxGeometry args={[6.25, 0.01, 0.3]} />
      </mesh>
      <mesh position={[0.95, BOARD_TOP + 0.005, 1.0]} material={mats.pavement} receiveShadow>
        <boxGeometry args={[4.4, 0.01, 0.2]} />
      </mesh>
      {/* Lawns */}
      <mesh position={[-0.55, BOARD_TOP + 0.006, 0.25]} material={mats.lawn} receiveShadow>
        <boxGeometry args={[0.85, 0.012, 1.35]} />
      </mesh>
      <mesh position={[2.6, BOARD_TOP + 0.006, 0.62]} material={mats.lawn} receiveShadow>
        <boxGeometry args={[0.75, 0.012, 0.6]} />
      </mesh>

      {/* Podium */}
      <mesh position={[1.05, BOARD_TOP + PODIUM_H / 2, -0.35]} material={mats.cardShade} castShadow receiveShadow>
        <boxGeometry args={[3.0, PODIUM_H, 2.4]} />
      </mesh>
      <mesh position={[1.05, BOARD_TOP + PODIUM_H + 0.006, -0.35]} material={mats.card} castShadow receiveShadow>
        <boxGeometry args={[3.06, 0.012, 2.46]} />
      </mesh>
      <mesh position={[1.05, BOARD_TOP + PODIUM_H * 0.45, 0.86]} material={mats.glass}>
        <boxGeometry args={[2.9, PODIUM_H * 0.8, 0.01]} />
      </mesh>

      {/* Tower glass cores */}
      {towers.map((t, i) => (
        <mesh
          key={i}
          position={[t.x, t.base + (t.floors * FLOOR) / 2, t.z]}
          material={mats.glass}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[t.w - 0.03, t.floors * FLOOR, t.d - 0.03]} />
        </mesh>
      ))}
      {/* Inner cores give the glass depth */}
      {towers.map((t, i) => (
        <mesh key={`core-${i}`} position={[t.x, t.base + (t.floors * FLOOR) / 2, t.z]} material={mats.cardShade}>
          <boxGeometry args={[t.w * 0.36, t.floors * FLOOR, t.d * 0.36]} />
        </mesh>
      ))}

      <Instanced data={slabs} geometry={box} material={mats.card} />
      <Instanced data={fins} geometry={box} material={mats.card} />
      <Instanced data={windows} geometry={box} material={mats.lamp} castShadow={false} receiveShadow={false} />
      <Instanced data={houses} geometry={box} material={mats.card} />
      <Instanced data={marks} geometry={box} material={mats.line} castShadow={false} />
      <Instanced data={trees} geometry={canopy} material={mats.tree} />
      <Instanced data={trunks} geometry={box} material={mats.basswood} />
      <Instanced data={figures} geometry={figureGeo} material={mats.card} />
      <Instanced data={lampPosts} geometry={box} material={mats.cardShade} />
      <Instanced data={lampHeads} geometry={box} material={mats.lamp} castShadow={false} receiveShadow={false} />
    </group>
  );
}
