import { createContext, useContext, useEffect, useState } from "react";
import { motion } from "motion/react";

// House hues: bookcloth colours for generated covers.
export const HOUSE = ["#8f2d26", "#c46a1e", "#c9a227", "#2f6b45", "#2a5a8f", "#4b3a7a", "#7a2d55"];

// House band shown before a photo exists: a shelf of thin spines in a
// non-spectral order with black and white spines mixed in, so it reads as
// books on a shelf rather than as a rainbow.
const SPINE_NEUTRALS = ["#1d1f24", "#e4e1d8", "#3a3c42"];
export const HOUSE_BAND = Array.from({ length: 60 }, (_, i) =>
  i % 4 === 3 ? SPINE_NEUTRALS[(i >> 2) % 3] : HOUSE[(i * 3) % 7]
);

// Stable generated colour for a title, used for coverless books and for
// scans whose photo is no longer on this device.
export function titleColor(title = "") {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return HOUSE[h % HOUSE.length];
}

// Readable ink for text set on a spine colour.
export function inkOn(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.22 ? "#141518" : "#f7f7f5";
}

const toHex = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

// Spine colours, left to right, from RGBA pixels. Averaging a tall slice mixes
// spines and shelf boards into brown, so instead: find the row that crosses the
// most spines (largest horizontal change), then in each narrow slice of a
// 3-row strip take the 70th-percentile pixel by chroma (the spine's own colour,
// not a foil-title outlier; cream spines stay cream).
export function spectrumFromPixels(data, w, h, count) {
  const lum = (i) => data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
  let bestY = h >> 1;
  let best = -1;
  for (let y = Math.floor(h * 0.1); y < Math.floor(h * 0.9); y++) {
    let score = 0;
    for (let x = 1; x < w; x++) score += Math.abs(lum((y * w + x) * 4) - lum((y * w + x - 1) * 4));
    if (score > best) [best, bestY] = [score, y];
  }
  const slice = w / count;
  const colors = [];
  for (let s = 0; s < count; s++) {
    const px = [];
    for (let y = Math.max(0, bestY - 1); y <= Math.min(h - 1, bestY + 1); y++) {
      for (let x = Math.floor(s * slice); x < Math.floor((s + 1) * slice); x++) {
        const i = (y * w + x) * 4;
        const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
        px.push([r, g, b, Math.max(r, g, b) - Math.min(r, g, b)]);
      }
    }
    px.sort((a, b) => a[3] - b[3]);
    const [r, g, b] = px[Math.floor(px.length * 0.7)];
    colors.push(toHex(r, g, b));
  }
  return colors;
}

// Returns null when the browser cannot decode the file (HEIC outside Safari).
export async function sampleSpectrum(file, count = 64) {
  try {
    const bitmap = await createImageBitmap(file);
    const w = count * 3;
    const h = 96;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    return spectrumFromPixels(ctx.getImageData(0, 0, w, h).data, w, h, count);
  } catch {
    return null;
  }
}

// Per-device memory of a scan's photo spectrum (the photo itself is not stored).
const storeKey = (scanId) => `librescan:spectrum:${scanId}`;

export function saveSpectrum(scanId, colors) {
  try {
    localStorage.setItem(storeKey(scanId), JSON.stringify(colors));
  } catch {
    // storage unavailable: the scan falls back to title colours
  }
}

export function loadSpectrum(scanId) {
  try {
    const v = JSON.parse(localStorage.getItem(storeKey(scanId)));
    return Array.isArray(v) && v.length ? v : null;
  } catch {
    return null;
  }
}

// The scan's spectrum and where it came from, for pages showing a scan.
export function scanSpectrum(scanId, titles = []) {
  const photo = loadSpectrum(scanId);
  if (photo) return { colors: photo, source: "photo" };
  if (titles.length) return { colors: titles.map(titleColor), source: "titles" };
  return { colors: HOUSE_BAND, source: "house" };
}

// Shell band: pages declare what the band under the nav shows.
const BandContext = createContext(null);

export function SpectrumProvider({ children }) {
  const [band, setBand] = useState(null);
  return <BandContext.Provider value={{ band, setBand }}>{children}</BandContext.Provider>;
}

export function useShellBand() {
  return useContext(BandContext).band;
}

export function useBand(colors, reading = false) {
  const { setBand } = useContext(BandContext);
  const sig = colors ? colors.join() : "";
  useEffect(() => {
    setBand(colors ? { colors, reading } : null);
    return () => setBand(null);
  }, [sig, reading]); // eslint-disable-line react-hooks/exhaustive-deps
}

const SWEEP_MS = 2950; // keep in sync with .read-sweep in index.css

// The read-line crossing a surface: a veil slides off the unread side while a
// line travels with its edge. CSS keyframes phase-locked to the wall clock, so
// the band and the photo sweep in step whenever each one mounted. Hidden under
// prefers-reduced-motion by the stylesheet.
export function ReadSweep({ veil = "bg-ground/70" }) {
  const phase = { animationDelay: `-${Date.now() % SWEEP_MS}ms` };
  return (
    <div className="read-sweep pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className={`read-sweep-veil absolute inset-0 ${veil}`} style={phase} />
      <div className="read-sweep-line absolute inset-0" style={phase}>
        <span className="absolute inset-y-0 right-0 w-0.5 bg-white shadow-[1px_0_0_rgb(0_0_0/0.35)]" />
      </div>
    </div>
  );
}

// Deterministic spine thickness, 0.5–1.8x, so stripes read as books.
const spineWidth = (i) => 0.5 + ((i * 37) % 14) / 10;

export function SpectrumBand({ colors = HOUSE_BAND, reading = false, className = "h-7" }) {
  const sig = colors.join();
  return (
    <div className={`relative flex overflow-hidden ${className}`} aria-hidden>
      {colors.map((c, i) => (
        <motion.i
          key={`${sig}-${i}`}
          className="block flex-1 origin-bottom"
          style={{ backgroundColor: c, flexGrow: spineWidth(i) }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.4, delay: i * 0.012, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
      {reading && <ReadSweep />}
    </div>
  );
}
