import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { easeOut } from "../../motion";

const tones = {
  success: { icon: CircleCheck, cls: "bg-success/12", iconCls: "text-success", role: "status" },
  error: { icon: CircleAlert, cls: "bg-danger/12", iconCls: "text-danger", role: "alert" },
};

export default function Notice({ tone = "error", message, onDismiss, className = "" }) {
  const t = tones[tone];
  const Icon = t.icon;
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div
          key={message}
          role={t.role}
          className={`flex items-start gap-3 rounded-[4px] px-4 py-3 text-sm text-ink ${t.cls} ${className}`}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: easeOut } }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
        >
          <Icon className={`mt-px size-4 shrink-0 ${t.iconCls}`} strokeWidth={2} aria-hidden />
          <p className="flex-1">{message}</p>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="-m-1 rounded-full p-1 text-ink-muted hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
