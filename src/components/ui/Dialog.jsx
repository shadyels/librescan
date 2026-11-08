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
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg bg-raised p-0 text-ink"
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0, transition: spring }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
    >
      <div className="p-6">
        <h2 id="dialog-title" className="text-lg font-bold">
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
