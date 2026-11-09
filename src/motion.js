// Shared motion grammar: lively but settled springs, quick staggers. Transform/opacity only.
export const easeOut = [0.16, 1, 0.3, 1];
export const spring = { type: "spring", stiffness: 440, damping: 30, mass: 0.8 };

export const page = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeOut } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
};

export const list = (stagger = 0.05) => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger } },
});

export const rise = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
};

// Cards pop in: a small scale-up with overshoot.
export const pop = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 380, damping: 22 } },
};
