import BookCover from "./ui/BookCover";

export default function RecommendationCard({ book }) {
  const { title = "Unknown title", author = "Unknown author", reason, cover_url, description, categories = [] } = book;
  return (
    <article className="grid grid-cols-[5.5rem_1fr] gap-x-5 gap-y-4 rounded-photo border border-line bg-raised p-5 shadow-card sm:grid-cols-[7.5rem_1fr] sm:p-6 md:grid-cols-[7.5rem_minmax(0,1fr)_minmax(0,1.3fr)] md:gap-x-8">
      <BookCover title={title} author={author} src={cover_url} className="row-span-2 md:row-span-1" />
      <div className="min-w-0">
        <h3 className="type-display text-2xl">{title}</h3>
        <p className="mt-1 text-[15px] text-ink-muted">{author}</p>
        {categories.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {categories.slice(0, 3).map((c) => (
              <li key={c} className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold text-ink-muted">
                {c}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="min-w-0 space-y-3 md:col-start-3">
        {reason && <p className="text-[16px] leading-relaxed">{reason}</p>}
        {description && <p className="line-clamp-3 text-sm leading-relaxed text-ink-muted">{description}</p>}
      </div>
    </article>
  );
}
