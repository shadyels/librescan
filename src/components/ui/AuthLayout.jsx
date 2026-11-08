import { Link } from "react-router-dom";
import Notice from "./Notice";

export default function AuthLayout({ title, lede, error, onDismissError, onSubmit, children, footer }) {
  return (
    <div className="mx-auto grid max-w-5xl gap-10 py-6 md:grid-cols-[1fr_400px] md:gap-16 md:py-14">
      <div>
        <h1 className="type-display text-6xl md:text-7xl">{title}</h1>
        <p className="mt-4 max-w-md text-[17px] leading-relaxed text-ink-muted">{lede}</p>
      </div>
      <div>
        <Notice tone="error" message={error} onDismiss={onDismissError} className="mb-5" />
        <form onSubmit={onSubmit} className="space-y-5">
          {children}
        </form>
        <p className="mt-6 text-sm text-ink-muted">
          {footer.text}{" "}
          <Link to={footer.to} className="font-semibold text-ink underline">
            {footer.link}
          </Link>
        </p>
      </div>
    </div>
  );
}
