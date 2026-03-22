import { useState } from "react";
import BookIcon from "./BookIcon.jsx";

function getConfidenceBadge(confidence) {
  const percent = Math.round(confidence * 100);
  if (percent >= 95) return { label: "High Confidence", colors: "bg-success-muted text-success border-success/30" };
  if (percent >= 85) return { label: "Good Confidence", colors: "bg-accent-muted text-accent border-accent/30" };
  if (percent >= 75) return { label: "Moderate", colors: "bg-accent-muted text-accent border-accent/30" };
  return { label: "Low Confidence", colors: "bg-bg-surface text-text-muted border-border" };
}

export default function BookCard({ book }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const {
    title = "Unknown Title",
    author = "Unknown Author",
    confidence = 0,
    cover_url = null,
    categories = [],
  } = book;

  const badge = getConfidenceBadge(confidence);
  const showRealCover = cover_url && imageLoaded && !imageError;

  return (
    <div className="glass-card glass-card-hover overflow-hidden flex flex-col animate-fade-in-up">
      <div className="h-64 bg-bg-surface flex items-center justify-center relative">
        <div className={`transition-opacity duration-300 ${showRealCover ? "opacity-0" : "opacity-100"}`}>
          <BookIcon title={title} size={120} />
        </div>
        {cover_url && !imageError && (
          <img
            src={cover_url}
            alt={`Cover of ${title}`}
            className={`absolute inset-0 w-full h-full object-contain p-2 transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-semibold text-text-primary line-clamp-2">{title}</h3>
        <p className="text-sm text-text-secondary line-clamp-1 mt-1">{author}</p>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {categories.slice(0, 3).map((category, idx) => (
              <span
                key={idx}
                className="text-xs bg-accent-muted text-accent rounded-full px-2 py-0.5"
              >
                {category}
              </span>
            ))}
          </div>
        )}

        <div className="flex-1" />

        <div className="mt-3">
          <span className={`inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2 py-1 ${badge.colors}`}>
            {badge.label} · {Math.round(confidence * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
