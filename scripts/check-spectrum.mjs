// Check that the shelf sampler returns the shelf's spine colours, not mud.
// Runs the real spectrumFromPixels (lifted from src/spectrum.jsx, which holds
// JSX) on test-image.jpg decoded at the same 192x96 size the browser uses.
// Usage: node scripts/check-spectrum.mjs
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import sharp from "sharp";

const src = readFileSync(new URL("../src/spectrum.jsx", import.meta.url), "utf8");
const start = src.indexOf("const toHex");
const end = src.indexOf("// Returns null when the browser");
const { spectrumFromPixels } = await import(
  "data:text/javascript," + encodeURIComponent(src.slice(start, end))
);

const COUNT = 64;
const W = COUNT * 3;
const H = 96;
const { data } = await sharp(new URL("../test-image.jpg", import.meta.url).pathname)
  .resize(W, H, { fit: "fill" })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const colors = spectrumFromPixels(data, W, H, COUNT);
assert.equal(colors.length, COUNT);

// Hue family per stripe (chromatic only); neutrals counted separately.
const families = new Set();
let neutrals = 0;
for (const hex of colors) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max - min < 40) { neutrals++; continue; }
  const h = max === r ? ((g - b) / (max - min) + 6) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
  families.add(h < 0.5 || h >= 5.5 ? "red" : h < 1.5 ? "orange/yellow" : h < 3.5 ? "green" : "blue/violet");
}

// "Not mud" for any photo: saturated spines survive and the light-to-dark range
// of real spines survives. (This test shelf is warm-lit: its chromatic pixels
// are ~37% red, ~7% orange/yellow, <1% green, 0% blue, so a truthful band is
// reds, tans, creams and near-blacks, not a rainbow.)
const rgb = colors.map((hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));
const chroma = rgb.map(([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b));
const light = rgb.map(([r, g, b]) => r * 0.3 + g * 0.59 + b * 0.11);

console.log(colors.join(" "));
console.log(
  `families: ${[...families].join(", ")} · neutral stripes: ${neutrals}/${COUNT} · ` +
    `max chroma ${Math.max(...chroma)} · lightness ${Math.round(Math.min(...light))}–${Math.round(Math.max(...light))}`
);
assert.ok(families.has("red"), "the shelf's red spines must survive");
assert.ok(Math.max(...chroma) >= 120, "at least one strongly saturated spine must survive (averaging mutes them)");
assert.ok(Math.max(...light) - Math.min(...light) >= 170, "cream-to-near-black spine range must survive (averaging flattens it)");
console.log("ok");
