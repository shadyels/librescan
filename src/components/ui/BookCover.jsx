import { useState } from "react";
import { inkOn, titleColor } from "../../spectrum";

// A book's cover, never tinted. Without one, the book is "bound" in its
// generated spine colour with the title set in spine lettering.
export default function BookCover({ title = "Unknown title", author, src, className = "" }) {
  const [state, setState] = useState(src ? "loading" : "none");
  const bg = titleColor(title);

  return (
    <div className={`relative aspect-[2/3] overflow-hidden rounded-photo ${className}`} style={{ backgroundColor: bg }}>
      {state !== "loaded" && (
        <div className="absolute inset-0 flex flex-col justify-between p-3" style={{ color: inkOn(bg) }} aria-hidden>
          <span className="type-display line-clamp-5 text-xl break-words">{title}</span>
          {author && <span className="type-label line-clamp-2 text-xs opacity-85">{author}</span>}
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
