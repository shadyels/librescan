import { useState } from "react";

// Bookcloth tones for generated covers: navy, coral, sage, mustard, linen,
// brick, slate. Muted mid-tones so a grid of them reads as books, not candy.
const CLOTH = ["#23395d", "#d2603f", "#6e8b74", "#c9a55c", "#e9e1d2", "#8c4a3c", "#4f5d75"];

// Stable generated colour for a title.
export function titleColor(title = "") {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return CLOTH[h % CLOTH.length];
}

// Readable ink for text set on a cloth colour.
function inkOn(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.2 ? "#1e2433" : "#fbf8f2";
}

// A book's cover, never tinted. Without one, the book is "bound" in its
// generated cloth colour with the title set in the display face.
export default function BookCover({ title = "Unknown title", author, src, className = "" }) {
  const [state, setState] = useState(src ? "loading" : "none");
  const bg = titleColor(title);

  return (
    <div
      className={`relative aspect-[2/3] overflow-hidden rounded-[10px] shadow-[inset_-6px_0_0_rgb(0_0_0/0.08),0_1px_2px_rgb(0_0_0/0.08)] ${className}`}
      style={{ backgroundColor: bg }}
    >
      {state !== "loaded" && (
        <div className="absolute inset-0 flex flex-col justify-between p-3" style={{ color: inkOn(bg) }} aria-hidden>
          <span className="type-display line-clamp-5 text-lg leading-tight break-words hyphens-auto">{title}</span>
          {author && <span className="line-clamp-2 text-[11px] font-semibold opacity-85">{author}</span>}
        </div>
      )}
      {src && state !== "error" && (
        <img
          src={src}
          alt={`Cover of ${title}`}
          loading="lazy"
          onLoad={() => setState("loaded")}
          onError={() => setState("error")}
          className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${
            state === "loaded" ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}
