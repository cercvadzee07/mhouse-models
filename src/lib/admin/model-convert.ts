"use client";

/**
 * Browser-side 3D processing pipeline.
 *
 *  .glb            → validated by parsing; served as-is.
 *  .gltf           → parsed (must be self-contained: embedded buffers/textures) → exported to .glb
 *  .obj .fbx .stl .3mf → parsed with the matching three.js loader → exported to .glb
 *
 * The original file is always uploaded and preserved. If a file cannot be
 * parsed or exported, the error is reported honestly and the model is stored
 * as "not browser-ready" — nothing is pretended.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

export type ConversionResult =
  | { ok: true; glb: Blob; triangles: number; converted: boolean; warnings: string[] }
  | { ok: false; error: string };

const modelMaterial = () => new THREE.MeshStandardMaterial({ color: "#efebe4", roughness: 0.85, metalness: 0 });

function countTriangles(root: THREE.Object3D) {
  let n = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      const g = m.geometry;
      n += Math.floor((g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3);
    }
  });
  return n;
}

function hasGeometry(root: THREE.Object3D) {
  let found = false;
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) found = true;
  });
  return found;
}

/** Z-up formats (STL, 3MF, most CAD exports) → Y-up for the web. */
function zUpToYUp(obj: THREE.Object3D) {
  const wrapper = new THREE.Group();
  obj.rotation.x = -Math.PI / 2;
  wrapper.add(obj);
  return wrapper;
}

function gltfLoader() {
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
  loader.setDRACOLoader(draco);
  return loader;
}

async function parseGltf(data: ArrayBuffer | string): Promise<THREE.Object3D> {
  return new Promise((resolve, reject) => {
    gltfLoader().parse(
      data,
      "",
      (gltf) => resolve(gltf.scene),
      (err) => reject(err instanceof Error ? err : new Error(String((err as { message?: string })?.message ?? err))),
    );
  });
}

async function exportGlb(object: THREE.Object3D): Promise<Blob> {
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(object, { binary: true, onlyVisible: true, maxTextureSize: 4096 });
  if (!(result instanceof ArrayBuffer)) throw new Error("Exporter did not return binary data.");
  return new Blob([result], { type: "model/gltf-binary" });
}

export async function convertModel(file: File): Promise<ConversionResult> {
  const name = file.name.toLowerCase();
  const format = name.split(".").pop() ?? "";
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" ").slice(0, 200));
    originalWarn(...args);
  };
  try {
    let object: THREE.Object3D;
    switch (format) {
      case "glb": {
        object = await parseGltf(await file.arrayBuffer());
        if (!hasGeometry(object)) return { ok: false, error: "The GLB file contains no visible geometry." };
        // Already browser-ready: keep the original file untouched.
        return { ok: true, glb: file, triangles: countTriangles(object), converted: false, warnings };
      }
      case "gltf": {
        const text = await file.text();
        const json = JSON.parse(text) as { buffers?: { uri?: string }[]; images?: { uri?: string }[] };
        const external = [...(json.buffers ?? []), ...(json.images ?? [])].some((b) => b.uri && !b.uri.startsWith("data:"));
        if (external) {
          return {
            ok: false,
            error: "This .gltf references external .bin/texture files. Export as a single .glb (or glTF-Embedded) and upload again.",
          };
        }
        object = await parseGltf(text);
        break;
      }
      case "obj": {
        object = new OBJLoader().parse(await file.text());
        object.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) m.material = modelMaterial();
        });
        break;
      }
      case "fbx": {
        object = new FBXLoader().parse(await file.arrayBuffer(), "");
        break;
      }
      case "stl": {
        const geometry = new STLLoader().parse(await file.arrayBuffer());
        geometry.computeVertexNormals();
        const hasColors = !!geometry.getAttribute("color");
        const material = modelMaterial();
        if (hasColors) material.vertexColors = true;
        object = zUpToYUp(new THREE.Mesh(geometry, material));
        break;
      }
      case "3mf": {
        object = zUpToYUp(new ThreeMFLoader().parse(await file.arrayBuffer()));
        break;
      }
      default:
        return { ok: false, error: `Unsupported format .${format}` };
    }

    if (!hasGeometry(object)) return { ok: false, error: "The file was read but contains no mesh geometry." };
    object.updateMatrixWorld(true);
    const glb = await exportGlb(object);
    return { ok: true, glb, triangles: countTriangles(object), converted: true, warnings };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message.slice(0, 400) || "The file could not be parsed." };
  } finally {
    console.warn = originalWarn;
  }
}
