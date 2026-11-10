import BookCover from "./ui/BookCover";

function confidenceLabel(c) {
  const p = Math.round(c * 100);
  if (p >= 95) return `${p}% · high`;
  if (p >= 85) return `${p}% · good`;
  if (p >= 75) return `${p}% · moderate`;
  return `${p}% · low, worth a check`;
}

export default function BookCard({ book }) {
  const { title = "Unknown title", author = "Unknown author", confidence = 0, cover_url, categories = [] } = book;
  return (
    <article className="group h-full rounded-2xl border border-line bg-raised p-3 transition-shadow hover:shadow-card">
      <BookCover
        title={title}
        author={author}
        src={cover_url}
        className="transition-transform duration-300 ease-out group-hover:-translate-y-1 group-hover:-rotate-1 motion-reduce:transition-none"
      />
      <h3 className="mt-3 line-clamp-2 font-semibold leading-snug">{title}</h3>
      <p className="mt-0.5 line-clamp-1 text-sm text-ink-muted">{author}</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            confidence < 0.75
              ? "rotate-1 border border-dashed border-current text-accent"
              : "-rotate-2 bg-highlight text-highlight-ink"
          }`}
        >
          {confidenceLabel(confidence)}
        </span>
        {categories[0] && (
          <span className="max-w-full truncate rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold text-ink-muted">
            {categories[0]}
          </span>
        )}
      </div>
    </article>
  );
}
