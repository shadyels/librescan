import { useLayoutEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { spring } from "../../motion";

// Native <dialog> via showModal(): the browser provides the focus trap, Esc
// handling and inert background. AnimatePresence keeps it open during exit.
function Panel({ title, children, actions, onClose, busy }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    ref.current?.showModal();
  }, []);

  const close = () => {
    if (!busy) onClose();
  };

  return (
    <motion.dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => e.target === ref.current && close()}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-line bg-raised p-0 text-ink shadow-[0_24px_60px_rgb(21_24_33/0.25)]"
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0, transition: spring }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
    >
      <div className="p-7">
        <h2 id="dialog-title" className="type-display text-2xl">
          {title}
        </h2>
        <div className="mt-2 text-sm leading-relaxed text-ink-muted">{children}</div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{actions}</div>
      </div>
    </motion.dialog>
  );
}

export default function Dialog({ open, ...props }) {
  return <AnimatePresence>{open && <Panel {...props} />}</AnimatePresence>;
}
