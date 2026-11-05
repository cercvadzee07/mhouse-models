"use client";

import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";

export interface ModelStats {
  triangles: number;
  meshes: number;
  size: THREE.Vector3;
}

/** Count triangles & meshes of a loaded object. */
export function computeStats(root: THREE.Object3D): ModelStats {
  let triangles = 0;
  let meshes = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry) {
      meshes++;
      const g = mesh.geometry;
      const count = g.index ? g.index.count : g.attributes.position?.count ?? 0;
      const instances = (mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh).count : 1;
      triangles += Math.floor(count / 3) * instances;
    }
  });
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  return { triangles, meshes, size };
}

/**
 * Loads a GLB, centres it on the origin, rests it on y=0 and scales it so its
 * largest horizontal dimension equals `fit` scene units.
 */
export function GlbModel({
  url,
  fit = 5,
  wireframe = false,
  onStats,
}: {
  url: string;
  fit?: number;
  wireframe?: boolean;
  onStats?: (s: ModelStats) => void;
}) {
  const { scene } = useGLTF(url);
  const object = useMemo(() => scene.clone(true), [scene]);

  const transform = useMemo(() => {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const largest = Math.max(size.x, size.z, size.y * 0.8) || 1;
    const scale = fit / largest;
    return { scale, offset: new THREE.Vector3(-center.x, -box.min.y, -center.z) };
  }, [object, fit]);

  useLayoutEffect(() => {
    object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          if (m && "wireframe" in m) (m as THREE.MeshStandardMaterial).wireframe = wireframe;
        });
      }
    });
  }, [object, wireframe]);

  useLayoutEffect(() => {
    onStats?.(computeStats(object));
  }, [object, onStats]);

  return (
    <group scale={transform.scale}>
      <primitive object={object} position={transform.offset} />
    </group>
  );
}
