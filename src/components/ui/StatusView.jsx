// Full-width error / empty / gate state: one icon, a display title, a line of
// explanation, and the actions that recover from it.
export default function StatusView({ icon: Icon, tone = "neutral", title, children, actions }) {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-start py-16 sm:py-24">
      {Icon && (
        <Icon
          className={`size-8 ${tone === "error" ? "text-danger" : "text-ink-muted"}`}
          strokeWidth={1.5}
          aria-hidden
        />
      )}
      <h1 className="type-display mt-5 text-5xl sm:text-6xl">{title}</h1>
      {children && <div className="mt-4 text-[17px] leading-relaxed text-ink-muted">{children}</div>}
      {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
    </section>
  );
}
