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
    <article>
      <BookCover title={title} author={author} src={cover_url} />
      <h3 className="mt-3 line-clamp-2 font-semibold leading-snug">{title}</h3>
      <p className="mt-0.5 line-clamp-1 text-sm text-ink-muted">{author}</p>
      <p className={`type-label mt-2 text-[13px] ${confidence < 0.75 ? "text-ink" : "text-ink-muted"}`}>
        {confidenceLabel(confidence)}
      </p>
      {categories[0] && <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-muted">{categories[0]}</p>}
    </article>
  );
}
