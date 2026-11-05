/**
 * 3D pipeline test.
 *  1. Server-side content sniffing (src/lib/media-rules.ts) in Node.
 *  2. The real browser converter (src/lib/admin/model-convert.ts), bundled with
 *     esbuild and executed in headless Edge/Chrome against generated fixtures:
 *     STL (ASCII + binary), OBJ, embedded glTF, GLB, 3MF, and invalid inputs.
 *
 * Run: npm run test:3d   (BROWSER_PATH overrides the browser executable)
 */
import { build } from "esbuild";
import { chromium } from "playwright-core";
import { join } from "node:path";
import { zipSync, strToU8 } from "three/examples/jsm/libs/fflate.module.js";
import { modelContentMatches, sniff } from "../src/lib/media-rules";

let passes = 0;
let failures = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) {
    passes++;
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.log(`  ✗ ${name} ${extra}`);
  }
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const cubeTris: number[][][] = (() => {
  const v = [
    [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
  ];
  const f = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [2, 3, 7], [2, 7, 6], [1, 2, 6], [1, 6, 5], [0, 4, 7], [0, 7, 3]];
  return f.map((t) => t.map((i) => v[i]));
})();

const stlAscii = `solid cube\n${cubeTris
  .map((t) => `facet normal 0 0 0\n outer loop\n${t.map((p) => `  vertex ${p.join(" ")}`).join("\n")}\n endloop\nendfacet`)
  .join("\n")}\nendsolid cube\n`;

const stlBinary = (() => {
  const buf = Buffer.alloc(84 + cubeTris.length * 50);
  buf.write("binary stl test", 0);
  buf.writeUInt32LE(cubeTris.length, 80);
  cubeTris.forEach((t, i) => {
    const o = 84 + i * 50;
    t.forEach((p, j) => p.forEach((c, k) => buf.writeFloatLE(c, o + 12 + j * 12 + k * 4)));
  });
  return buf;
})();

const obj = `# cube\n${[[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]].map((p) => `v ${p.join(" ")}`).join("\n")}\nf 1 3 2\nf 1 4 3\nf 5 6 7\nf 5 7 8\nf 1 2 6\nf 1 6 5\n`;

const gltfEmbedded = (() => {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const b64 = Buffer.from(positions.buffer).toString("base64");
  return JSON.stringify({
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: 36, uri: `data:application/octet-stream;base64,${b64}` }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 0] }],
  });
})();

const gltfExternal = JSON.stringify({ asset: { version: "2.0" }, buffers: [{ byteLength: 36, uri: "scene.bin" }] });

const threeMf = (() => {
  const verts = [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0], [0, 0, 10], [10, 0, 10], [10, 10, 10], [0, 10, 10]];
  const tris = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [2, 3, 7], [2, 7, 6], [1, 2, 6], [1, 6, 5], [0, 4, 7], [0, 7, 3]];
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <resources><object id="1" type="model"><mesh>
  <vertices>${verts.map((v) => `<vertex x="${v[0]}" y="${v[1]}" z="${v[2]}"/>`).join("")}</vertices>
  <triangles>${tris.map((t) => `<triangle v1="${t[0]}" v2="${t[1]}" v3="${t[2]}"/>`).join("")}</triangles>
 </mesh></object></resources>
 <build><item objectid="1"/></build>
</model>`;
  return Buffer.from(
    zipSync({
      "[Content_Types].xml": strToU8(
        `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`,
      ),
      "_rels/.rels": strToU8(
        `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`,
      ),
      "3D/3dmodel.model": strToU8(model),
    }),
  );
})();

// Minimal ASCII FBX 7.4: one quad (→ 2 triangles).
const fbxAscii = [
  "; FBX 7.4.0 project file",
  "FBXHeaderExtension:  {",
  "\tFBXHeaderVersion: 1003",
  "\tFBXVersion: 7400",
  "}",
  "GlobalSettings:  {",
  "\tVersion: 1000",
  "\tProperties70:  {",
  '\t\tP: "UpAxis", "int", "Integer", "",1',
  '\t\tP: "UnitScaleFactor", "double", "Number", "",1',
  "\t}",
  "}",
  "Objects:  {",
  '\tGeometry: 1000, "Geometry::Quad", "Mesh" {',
  "\t\tVertices: *12 {",
  "\t\t\ta: 0,0,0,1,0,0,1,1,0,0,1,0",
  "\t\t}",
  "\t\tPolygonVertexIndex: *4 {",
  "\t\t\ta: 0,1,2,-4",
  "\t\t}",
  "\t\tGeometryVersion: 124",
  "\t}",
  '\tModel: 2000, "Model::Quad", "Mesh" {',
  "\t\tVersion: 232",
  "\t\tProperties70:  {",
  "\t\t}",
  "\t}",
  "}",
  "Connections:  {",
  '\tC: "OO",1000,2000',
  '\tC: "OO",2000,0',
  "}",
  "",
].join("\n");

const fixtures: { name: string; file: string; bytes: Buffer; expect: "ok" | "fail"; triangles?: number }[] = [
  { name: "STL (ASCII)", file: "cube.stl", bytes: Buffer.from(stlAscii), expect: "ok", triangles: 12 },
  { name: "STL (binary)", file: "cube-bin.stl", bytes: stlBinary, expect: "ok", triangles: 12 },
  { name: "OBJ", file: "cube.obj", bytes: Buffer.from(obj), expect: "ok", triangles: 6 },
  { name: "glTF (embedded)", file: "tri.gltf", bytes: Buffer.from(gltfEmbedded), expect: "ok", triangles: 1 },
  { name: "glTF (external buffers) is rejected honestly", file: "ext.gltf", bytes: Buffer.from(gltfExternal), expect: "fail" },
  { name: "FBX (ASCII)", file: "quad.fbx", bytes: Buffer.from(fbxAscii), expect: "ok", triangles: 2 },
  { name: "3MF", file: "cube.3mf", bytes: threeMf, expect: "ok", triangles: 12 },
  { name: "Corrupt GLB is rejected", file: "broken.glb", bytes: Buffer.from("glTF\x02\x00\x00\x00garbage"), expect: "fail" },
  { name: "Empty OBJ is rejected", file: "empty.obj", bytes: Buffer.from("# nothing here\n"), expect: "fail" },
];

async function main() {
  console.log("Server-side content sniffing");
  ok("detects JPEG", sniff(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])) === "jpeg");
  ok("detects PNG", sniff(new Uint8Array(Buffer.from("\x89PNG\r\n\x1a\n", "binary"))) === "png");
  ok("detects MP4", sniff(new Uint8Array(Buffer.from("\x00\x00\x00\x18ftypmp42", "binary"))) === "mp4");
  ok("detects WebM", sniff(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])) === "webm");
  ok("STL ASCII content matches", modelContentMatches("stl", new Uint8Array(Buffer.from(stlAscii))));
  ok("STL binary content matches", modelContentMatches("stl", new Uint8Array(stlBinary)));
  ok("3MF content matches (zip)", modelContentMatches("3mf", new Uint8Array(threeMf.subarray(0, 64))));
  ok("glTF content matches (json)", modelContentMatches("gltf", new Uint8Array(Buffer.from(gltfEmbedded))));
  ok("FBX ASCII content matches", modelContentMatches("fbx", new Uint8Array(Buffer.from(fbxAscii))));
  ok("OBJ rejects binary content", !modelContentMatches("obj", new Uint8Array(stlBinary)));
  ok("GLB rejects a renamed JPEG", !modelContentMatches("glb", new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])));
  ok("3MF rejects a renamed OBJ", !modelContentMatches("3mf", new Uint8Array(Buffer.from(obj))));

  console.log("\nBrowser conversion (three.js loaders → GLTFExporter)");
  const bundle = await build({
    entryPoints: [join(__dirname, "..", "src", "lib", "admin", "model-convert.ts")],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "Convert",
    platform: "browser",
    target: "es2020",
    logLevel: "silent",
    define: { "process.env.NODE_ENV": JSON.stringify("production"), "import.meta.url": JSON.stringify("https://test.local/bundle.js") },
  });
  const code = bundle.outputFiles[0].text;

  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  });
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log("  [page error]", e.message));
  await page.setContent("<!doctype html><html><body>3d test</body></html>");
  await page.addScriptTag({ content: code });
  // Some bundlers emit `var Convert` inside a block; expose it explicitly.
  await page.evaluate(() => void 0);

  let glbFromObj: number[] | null = null;
  for (const f of fixtures) {
    const result = await page.evaluate(
      async ({ name, data }) => {
        const file = new File([new Uint8Array(data)], name);
        // @ts-expect-error injected global
        const r = await window.Convert.convertModel(file);
        if (!r.ok) return { ok: false, error: r.error };
        const buf = new Uint8Array(await r.glb.arrayBuffer());
        const magic = String.fromCharCode(...buf.slice(0, 4));
        return { ok: true, triangles: r.triangles, converted: r.converted, magic, size: buf.length, bytes: Array.from(buf) };
      },
      { name: f.file, data: Array.from(f.bytes) },
    );
    if (f.expect === "ok") {
      ok(
        `${f.name} → GLB`,
        !!result.ok && result.magic === "glTF" && (f.triangles === undefined || result.triangles === f.triangles),
        JSON.stringify({ ...result, bytes: undefined }),
      );
      if (f.file === "cube.obj" && result.ok) glbFromObj = result.bytes ?? null;
    } else {
      ok(f.name, !result.ok, JSON.stringify({ ...result, bytes: undefined }));
    }
  }

  if (glbFromObj) {
    const r = await page.evaluate(async (data) => {
      const file = new File([new Uint8Array(data)], "roundtrip.glb");
      // @ts-expect-error injected global
      const res = await window.Convert.convertModel(file);
      return res.ok ? { ok: true, converted: res.converted, triangles: res.triangles } : { ok: false, error: res.error };
    }, glbFromObj);
    ok("GLB is accepted as-is (no re-conversion, original preserved)", r.ok === true && r.converted === false && r.triangles === 6, JSON.stringify(r));
    ok("exported GLB passes server-side sniffing", sniff(new Uint8Array(glbFromObj.slice(0, 16))) === "glb");
  }

  await browser.close();
  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
