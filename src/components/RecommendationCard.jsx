import BookCover from "./ui/BookCover";

export default function RecommendationCard({ book }) {
  const { title = "Unknown title", author = "Unknown author", reason, cover_url, description, categories = [] } = book;
  return (
    <article className="grid grid-cols-[5.5rem_1fr] gap-x-5 gap-y-4 border-t-[1.5px] border-ink py-6 sm:grid-cols-[7.5rem_1fr] md:grid-cols-[7.5rem_minmax(0,1fr)_minmax(0,1.3fr)] md:gap-x-8">
      <BookCover title={title} author={author} src={cover_url} className="row-span-2 md:row-span-1" />
      <div className="min-w-0">
        <h3 className="text-xl font-bold leading-tight">{title}</h3>
        <p className="mt-1 text-[15px] text-ink-muted">{author}</p>
        {categories.length > 0 && (
          <p className="mt-2 line-clamp-1 text-[13px] text-ink-muted">{categories.slice(0, 3).join(" · ")}</p>
        )}
      </div>
      <div className="min-w-0 space-y-3 md:col-start-3">
        {reason && <p className="text-[16px] leading-relaxed">{reason}</p>}
        {description && <p className="line-clamp-3 text-sm leading-relaxed text-ink-muted">{description}</p>}
      </div>
    </article>
  );
}
