import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { LoaderCircle } from "lucide-react";

const MotionLink = motion.create(Link);

const base =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-colors duration-150";
// Busy reads as working, not as unavailable: only a plain disabled button dims.
const inertCls = { busy: "cursor-wait", disabled: "disabled:cursor-not-allowed disabled:opacity-45" };

const sizes = {
  sm: "h-8 px-3.5 text-[13px]",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

const variants = {
  primary: "bg-accent text-accent-ink hover:bg-accent/85",
  secondary: "text-ink shadow-[inset_0_0_0_1.5px_var(--color-ink)] hover:bg-ink/8",
  danger: "bg-danger text-ground hover:bg-danger/88",
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
        Icon && <Icon className="size-4" strokeWidth={1.75} aria-hidden />
      )}
      {children}
    </>
  );

  if (to) {
    return (
      <MotionLink to={to} className={cls} whileTap={{ scale: 0.97 }} {...props}>
        {content}
      </MotionLink>
    );
  }

  return (
    <motion.button
      type="button"
      className={cls}
      disabled={inert}
      aria-busy={loading || undefined}
      whileTap={inert ? undefined : { scale: 0.97 }}
      {...props}
    >
      {content}
    </motion.button>
  );
}
