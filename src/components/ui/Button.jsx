import { Link } from "react-router-dom";
import { LoaderCircle } from "lucide-react";

const base =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[translate,box-shadow,background-color,border-color,color] duration-150 motion-reduce:transition-none";
// Busy reads as working, not as unavailable: only a plain disabled button dims.
const inertCls = { busy: "cursor-wait", disabled: "disabled:cursor-not-allowed disabled:opacity-45" };

// Filled pills lift on hover and settle on press.
const lift = "shadow-lift hover:-translate-y-px active:translate-y-px active:shadow-none";

const sizes = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base",
};

const variants = {
  primary: `${lift} bg-accent text-accent-ink`,
  secondary: "border border-line bg-raised text-ink hover:border-ink-muted active:translate-y-px",
  danger: `${lift} bg-danger text-white dark:text-ground`,
  ghost: "text-ink-muted hover:bg-ink/8 hover:text-ink",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon: Icon,
  to,
  className = "",
  disabled,
  children,
  ...props
}) {
  const cls = `${base} ${loading ? inertCls.busy : inertCls.disabled} ${sizes[size]} ${variants[variant]} ${className}`;
  const inert = disabled || loading;
  const content = (
    <>
      {loading ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
      ) : (
        Icon && <Icon className="size-4" strokeWidth={2.25} aria-hidden />
      )}
      {children}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={cls} {...props}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={cls} disabled={inert} aria-busy={loading || undefined} {...props}>
      {content}
    </button>
  );
}
