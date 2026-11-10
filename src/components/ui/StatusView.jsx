// Full-width error / empty / gate state: one icon on a tilted sticker, a
// display title, a line of explanation, and the actions that recover from it.
export default function StatusView({ icon: Icon, tone = "neutral", title, children, actions }) {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-start py-16 sm:py-24">
      {Icon && (
        <span
          className={`grid size-16 -rotate-6 place-items-center rounded-[20px] ${
            tone === "error" ? "bg-danger/12 text-danger" : "bg-highlight text-highlight-ink shadow-sticker"
          }`}
        >
          <Icon className="size-8" strokeWidth={2} aria-hidden />
        </span>
      )}
      <h1 className="type-display mt-6 text-5xl sm:text-6xl">{title}</h1>
      {children && <div className="mt-4 text-[17px] leading-relaxed text-ink-muted">{children}</div>}
      {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
    </section>
  );
}
