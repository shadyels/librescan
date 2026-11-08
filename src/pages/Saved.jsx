import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bookmark, CircleAlert, RotateCcw, ScanLine, Trash2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { scanSpectrum, SpectrumBand } from "../spectrum";
import { easeOut, spring } from "../motion";
import AccountCta from "../components/ui/AccountCta";
import Button from "../components/ui/Button";
import Dialog from "../components/ui/Dialog";
import Notice from "../components/ui/Notice";
import StatusView from "../components/ui/StatusView";

const checkbox = "size-[18px] shrink-0 cursor-pointer accent-ink";

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const plural = (n, word) => `${n} ${word}${n !== 1 ? "s" : ""}`;

export default function Saved() {
  const { user, loading: authLoading } = useAuth();
  const [savedSets, setSavedSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function fetchSavedSets() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/saved", { credentials: "include" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Server error ${response.status}`);
      }
      const data = await response.json();
      setSavedSets(data.saved || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !user) return;
    fetchSavedSets();
  }, [user, authLoading]);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(t);
  }, [feedback]);

  const toggle = (scanId) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(scanId) ? next.delete(scanId) : next.add(scanId);
      return next;
    });

  const allSelected = savedSets.length > 0 && selectedIds.size === savedSets.length;
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(savedSets.map((s) => s.scan_id)));

  async function handleDelete() {
    setDeleting(true);
    try {
      const response = await fetch("/api/saved", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scan_ids: Array.from(selectedIds) }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Delete failed (${response.status})`);
      }
      const data = await response.json();
      const deleted = new Set(data.deleted_scan_ids);
      setSavedSets((prev) => prev.filter((s) => !deleted.has(s.scan_id)));
      setSelectedIds(new Set());
      setFeedback({ tone: "success", message: `Deleted ${plural(data.deleted_count, "saved scan")} and their recommendations.` });
    } catch (err) {
      setFeedback({ tone: "error", message: `Couldn't delete: ${err.message}` });
    } finally {
      setShowDeleteDialog(false);
      setDeleting(false);
    }
  }

  if (authLoading) {
    return (
      <div aria-busy="true" aria-label="Loading">
        <div className="h-16 w-2/3 max-w-lg animate-pulse rounded-photo bg-surface" />
        <div className="mt-10 h-48 animate-pulse rounded-photo bg-surface" />
      </div>
    );
  }

  if (!user) {
    return (
      <AccountCta variant="gate" title="Sign in to see saved scans">
        Saved recommendations are kept with your account, so you can open them from any device.
      </AccountCta>
    );
  }

  if (!loading && error) {
    return (
      <StatusView
        icon={CircleAlert}
        tone="error"
        title="Couldn't load saved scans"
        actions={
          <Button icon={RotateCcw} onClick={fetchSavedSets}>
            Try again
          </Button>
        }
      >
        {error}
      </StatusView>
    );
  }

  if (!loading && savedSets.length === 0) {
    return (
      <>
        <Notice tone={feedback?.tone} message={feedback?.message} onDismiss={() => setFeedback(null)} />
        <StatusView
          icon={Bookmark}
          title="Nothing saved yet"
          actions={
            <Button to="/" icon={ScanLine}>
              Scan a shelf
            </Button>
          }
        >
          Scan a bookshelf, open its recommendations and save the ones you want to come back to.
        </StatusView>
      </>
    );
  }

  const count = selectedIds.size;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="type-display text-6xl sm:text-7xl">Saved</h1>
      <p className="mt-3 text-[15px] text-ink-muted">Recommendation sets you kept, newest first.</p>

      <Notice
        tone={feedback?.tone}
        message={feedback?.message}
        onDismiss={() => setFeedback(null)}
        className="mt-6"
      />

      <div className="mt-8 flex min-h-12 items-center justify-between gap-4 border-b-[1.5px] border-ink pb-3">
        <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
          <input type="checkbox" className={checkbox} checked={allSelected} onChange={toggleAll} disabled={loading} />
          {count > 0 ? `${count} selected` : "Select all"}
        </label>
        <Button variant="danger" size="sm" icon={Trash2} disabled={count === 0} onClick={() => setShowDeleteDialog(true)}>
          Delete
        </Button>
      </div>

      {loading ? (
        <div aria-busy="true" aria-label="Loading saved scans">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-24 animate-pulse border-b border-line bg-surface/60" />
          ))}
        </div>
      ) : (
        <ul>
          <AnimatePresence initial={false}>
            {savedSets.map((set, i) => {
              const selected = selectedIds.has(set.scan_id);
              const preview = set.recognized_books_preview || [];
              const more = set.recognized_books_count - preview.length;
              const id = `saved-${set.scan_id}`;
              return (
                <motion.li
                  key={set.scan_id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.04, ease: easeOut } }}
                  exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
                  transition={spring}
                  className={`flex items-center gap-4 border-b border-line px-2 py-5 transition-colors sm:gap-5 ${
                    selected ? "bg-ink/6" : ""
                  }`}
                >
                  <input type="checkbox" id={id} className={checkbox} checked={selected} onChange={() => toggle(set.scan_id)} />
                  <SpectrumBand
                    colors={scanSpectrum(set.scan_id, preview).colors}
                    className="hidden h-14 w-20 shrink-0 rounded-photo sm:flex"
                  />
                  <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block font-semibold">Scanned {formatDate(set.scan_date)}</span>
                    <span className="mt-1 block truncate text-sm text-ink-muted">
                      {preview.join(", ")}
                      {more > 0 && ` and ${more} more`}
                    </span>
                    <span className="type-label mt-1 block text-[13px] text-ink-muted">
                      {plural(set.recognized_books_count, "book")} · {plural(set.recommendation_count, "recommendation")}
                    </span>
                  </label>
                  <Button to={`/recommendations/${set.scan_id}`} variant="secondary" size="sm">
                    View
                  </Button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <Dialog
        open={showDeleteDialog}
        busy={deleting}
        onClose={() => setShowDeleteDialog(false)}
        title={`Delete ${plural(count, "saved scan")} for good?`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteDialog(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              {deleting ? "Deleting…" : "Delete permanently"}
            </Button>
          </>
        }
      >
        This permanently deletes {count === 1 ? "the scan" : `${count} scans`} and every recommendation that came with{" "}
        {count === 1 ? "it" : "them"}. You can't undo this.
      </Dialog>
    </div>
  );
}
