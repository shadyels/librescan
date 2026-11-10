import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { CircleAlert, ScanLine, SearchX, Sparkles } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { list, pop, spring } from "../motion";
import BookCard from "../components/BookCard";
import Button from "../components/ui/Button";
import StatusView from "../components/ui/StatusView";
import AccountCta from "../components/ui/AccountCta";

const SORTS = [
  ["confidence", "Confidence", (a, b) => b.confidence - a.confidence],
  ["title", "Title", (a, b) => a.title.localeCompare(b.title)],
  ["author", "Author", (a, b) => a.author.localeCompare(b.author)],
];

function SortControl({ value, onChange }) {
  return (
    <div role="group" aria-label="Sort books" className="inline-flex rounded-full bg-surface p-1">
      {SORTS.map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={`relative h-8 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
            value === key ? "text-accent-ink" : "text-ink-muted hover:text-ink"
          }`}
        >
          {value === key && (
            <motion.span layoutId="sort-active" transition={spring} className="absolute inset-0 rounded-full bg-accent" />
          )}
          <span className="relative">{label}</span>
        </button>
      ))}
    </div>
  );
}

export default function Results() {
  const { scanId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const deviceId = searchParams.get("device_id");

  const [scan, setScan] = useState(null);
  const [books, setBooks] = useState(null);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("confidence");

  useEffect(() => {
    let live = true;
    async function fetchScan() {
      try {
        setError(null);
        const url = deviceId
          ? `/api/scan/${scanId}?device_id=${encodeURIComponent(deviceId)}`
          : `/api/scan/${scanId}`;
        const response = await fetch(url, { credentials: "include" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Server error ${response.status}`);
        if (!data.success || !data.scan) throw new Error("The server sent an unexpected response.");
        if (!live) return;
        setScan(data.scan);
        // Stable keys so a re-sort animates tiles into place instead of remounting them.
        setBooks((data.scan.recognized_books?.books || []).map((b, i) => ({ ...b, _key: i })));
      } catch (err) {
        if (live) setError(err.message);
      }
    }
    fetchScan();
    return () => {
      live = false;
    };
  }, [scanId, deviceId]);

  const sorted = useMemo(() => {
    if (!books) return [];
    const compare = SORTS.find(([key]) => key === sortBy)[2];
    return [...books].sort(compare);
  }, [books, sortBy]);

  if (error) {
    return (
      <StatusView
        icon={CircleAlert}
        tone="error"
        title="Couldn't open this scan"
        actions={<Button to="/">Back to scan</Button>}
      >
        {error}
      </StatusView>
    );
  }

  if (!books) {
    return (
      <div aria-busy="true" aria-label="Loading scan">
        <div className="h-16 w-2/3 max-w-lg animate-pulse rounded-photo bg-surface" />
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <StatusView
        icon={SearchX}
        title="No books found"
        actions={
          <Button to="/" icon={ScanLine}>
            Scan another shelf
          </Button>
        }
      >
        The model couldn't read any spines in this photo. Try again with a sharp, well-lit photo taken straight on,
        spines facing the camera.
      </StatusView>
    );
  }

  const recsUrl = user ? `/recommendations/${scanId}` : `/recommendations/${scanId}?device_id=${deviceId || ""}`;
  const seconds = scan.processing_time ? (scan.processing_time / 1000).toFixed(1) : null;
  const facts = [
    `${scan.total_books ?? books.length} books recognised`,
    seconds && `read in ${seconds} s`,
    scan.model_used && scan.model_used !== "unknown" && scan.model_used,
  ].filter(Boolean);

  return (
    <div>
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="type-display text-6xl sm:text-7xl">
            Your <span className="text-coral">shelf</span>
          </h1>
          <p className="mt-3 text-[15px] text-ink-muted">{facts.join(" · ")}</p>
        </div>
        <Button to={recsUrl} size="lg" icon={Sparkles}>
          Recommend what to read next
        </Button>
      </header>

      <div className="mt-10 flex items-center justify-between gap-4 border-t border-line pt-4">
        <span className="text-sm font-semibold">Sort by</span>
        <SortControl value={sortBy} onChange={setSortBy} />
      </div>

      <motion.ul
        className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        variants={list(0.06)}
        initial="hidden"
        animate="show"
      >
        {sorted.map((book) => (
          <motion.li key={book._key} layout transition={spring} variants={pop}>
            <BookCard book={book} />
          </motion.li>
        ))}
      </motion.ul>

      <div className="mt-16 space-y-10">
        {!user && (
          <AccountCta title="Keep this scan">
            Create a free account and this scan and its recommendations move into it, so you can come back to them
            from any device.
          </AccountCta>
        )}
        <div className="flex flex-wrap gap-3">
          <Button to={recsUrl} icon={Sparkles}>
            Recommend what to read next
          </Button>
          <Button to="/" variant="secondary" icon={ScanLine}>
            Scan another shelf
          </Button>
        </div>
      </div>
    </div>
  );
}
