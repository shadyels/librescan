// Shared motion grammar: exponential ease-out, short staggers, one spring.
export const easeOut = [0.16, 1, 0.3, 1];
export const spring = { type: "spring", stiffness: 420, damping: 36, mass: 0.8 };

export const page = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeOut } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
};

export const list = (stagger = 0.06) => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger } },
});

export const rise = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
};
