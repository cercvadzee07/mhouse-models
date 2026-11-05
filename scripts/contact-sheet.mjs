// QA helper: tile screenshots into contact sheets. Usage: node scripts/contact-sheet.mjs <dir> <prefix> [cols=2] [scale=0.5]
import sharp from "sharp";
import { readdirSync } from "node:fs";
import { join } from "node:path";
const [dir, prefix, cols = "2", scale = "0.5"] = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(".png") && !f.startsWith("sheet")).sort();
const per = Number(cols) * 3;
for (let s = 0; s * per < files.length; s++) {
  const batch = files.slice(s * per, s * per + per);
  const metas = await Promise.all(batch.map((f) => sharp(join(dir, f)).metadata()));
  const w = Math.round(metas[0].width * Number(scale));
  const h = Math.round(metas[0].height * Number(scale));
  const rows = Math.ceil(batch.length / Number(cols));
  const tiles = await Promise.all(batch.map((f) => sharp(join(dir, f)).resize(w, h).toBuffer()));
  const out = join(dir, `sheet-${prefix}-${s}.png`);
  await sharp({ create: { width: w * Number(cols) + 8 * (Number(cols) - 1), height: h * rows + 8 * (rows - 1), channels: 3, background: "#ff00ff" } })
    .composite(tiles.map((input, i) => ({ input, left: (i % Number(cols)) * (w + 8), top: Math.floor(i / Number(cols)) * (h + 8) })))
    .png()
    .toFile(out);
  console.log(out);
}
