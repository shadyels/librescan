import { createContext, useContext, useEffect, useState } from "react";

// Shell reading state: pages say when a read is running and the rule under
// the nav turns into a progress bar.
const ReadingContext = createContext(null);

export function ReadingProvider({ children }) {
  const [reading, setReading] = useState(false);
  return <ReadingContext.Provider value={{ reading, setReading }}>{children}</ReadingContext.Provider>;
}

export function useShellReading() {
  return useContext(ReadingContext).reading;
}

export function useReading(reading) {
  const { setReading } = useContext(ReadingContext);
  useEffect(() => {
    setReading(reading);
    return () => setReading(false);
  }, [reading, setReading]);
}

// Hairline under the nav; while reading, an indeterminate navy-to-coral fill.
export function ReadRule({ reading }) {
  return (
    <div
      className="relative h-1 bg-line"
      {...(reading ? { role: "progressbar", "aria-label": "Reading your shelf" } : { "aria-hidden": true })}
    >
      {reading && (
        <div className="read-progress absolute inset-0 origin-left rounded-r-full bg-gradient-to-r from-accent to-coral" />
      )}
    </div>
  );
}

const SWEEP_MS = 2950; // keep in sync with .read-sweep in index.css

// One coral scan line crossing the photo while a veil slides off the unread
// side. Phase-locked to the wall clock so remounts don't restart it. Hidden
// under prefers-reduced-motion by the stylesheet.
export function ReadSweep() {
  const phase = { animationDelay: `-${Date.now() % SWEEP_MS}ms` };
  return (
    <div className="read-sweep pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="read-sweep-veil absolute inset-0 bg-ground/55" style={phase} />
      <div className="read-sweep-line absolute inset-0" style={phase}>
        <span className="absolute inset-y-0 right-0 w-[3px] bg-coral shadow-[0_0_18px_var(--color-coral)]" />
      </div>
    </div>
  );
}
