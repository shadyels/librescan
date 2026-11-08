import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, BookOpen, Bookmark, BookmarkCheck, CircleAlert, RotateCcw, ScanLine, Trash2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { scanSpectrum, useBand } from "../spectrum";
import { list, rise } from "../motion";
import RecommendationCard from "../components/RecommendationCard";
import AccountCta from "../components/ui/AccountCta";
import Button from "../components/ui/Button";
import Dialog from "../components/ui/Dialog";
import Notice from "../components/ui/Notice";
import StatusView from "../components/ui/StatusView";

function Elapsed() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setS((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="type-display text-[5rem] leading-none sm:text-[6rem]" aria-hidden>
      {s}
      <span className="text-[0.45em]"> s</span>
    </span>
  );
}

export default function Recommendations() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const deviceId = searchParams.get("device_id");

  const [phase, setPhase] = useState("loading"); // loading | generating | ready | error
  const [error, setError] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [actionError, setActionError] = useState(null);

  useBand(scanSpectrum(scanId).colors, phase === "generating");

  useEffect(() => {
    if (authLoading) return;
    let live = true;

    async function loadRecommendations() {
      try {
        setPhase("loading");
        setError(null);
        const anon = !user && deviceId;

        const getResponse = await fetch(
          anon ? `/api/recommendations/${scanId}?device_id=${deviceId}` : `/api/recommendations/${scanId}`,
          { credentials: "include" }
        );
        if (getResponse.ok) {
          const data = await getResponse.json();
          if (!live) return;
          setRecommendations(data.recommendations);
          setSaved(data.saved || false);
          setPhase("ready");
          return;
        }
        if (getResponse.status !== 404) {
          const data = await getResponse.json().catch(() => ({}));
          throw new Error(data.error || `Server error ${getResponse.status}`);
        }

        if (!live) return;
        setPhase("generating");
        const postResponse = await fetch("/api/generate-recommendations", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(anon ? { scan_id: scanId, device_id: deviceId } : { scan_id: scanId }),
        });
        if (!postResponse.ok) {
          const data = await postResponse.json().catch(() => ({}));
          throw new Error(data.error || `Generation failed (${postResponse.status})`);
        }
        const data = await postResponse.json();
        if (!live) return;
        setRecommendations(data.recommendations);
        setSaved(false);
        setPhase("ready");
      } catch (err) {
        if (!live) return;
        setError(err.message);
        setPhase("error");
      }
    }

    loadRecommendations();
    return () => {
      live = false;
    };
  }, [scanId, deviceId, user, authLoading, retryCount]);

  async function handleSave() {
    setSaving(true);
    setActionError(null);
    try {
      const response = await fetch("/api/saved", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scan_id: scanId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Save failed (${response.status})`);
      }
      setSaved(true);
    } catch (err) {
      setActionError(`Couldn't save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const response = await fetch("/api/saved", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scan_ids: [scanId] }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Delete failed (${response.status})`);
      }
      navigate("/saved");
    } catch (err) {
      setShowDeleteDialog(false);
      setActionError(`Couldn't delete: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  }

  const resultsUrl = user ? `/results/${scanId}` : `/results/${scanId}?device_id=${encodeURIComponent(deviceId || "")}`;
  const books = recommendations?.recommendations || [];
  const meta = recommendations?.metadata || {};
  const back = (
    <Button to={resultsUrl} variant="ghost" size="sm" icon={ArrowLeft} className="-ml-3">
      Back to your shelf
    </Button>
  );

  if (phase === "error") {
    return (
      <StatusView
        icon={CircleAlert}
        tone="error"
        title="Couldn't get recommendations"
        actions={
          <>
            <Button icon={RotateCcw} onClick={() => setRetryCount((n) => n + 1)}>
              Try again
            </Button>
            <Button to={resultsUrl} variant="secondary">
              Back to your shelf
            </Button>
          </>
        }
      >
        {error}
      </StatusView>
    );
  }

  if (phase === "generating") {
    return (
      <section className="py-6" aria-live="polite">
        {back}
        <div className="mt-6 grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <h1 className="type-display text-6xl sm:text-7xl">Choosing your next reads</h1>
            <p className="mt-4 max-w-[56ch] text-[17px] leading-relaxed text-ink-muted">
              A language model is going through the books on your shelf{user ? " and your reading preferences" : ""}{" "}
              to pick titles you don't own yet, each with a reason. This usually takes 10–30 seconds and only happens
              once per scan.
            </p>
          </div>
          <Elapsed />
        </div>
      </section>
    );
  }

  if (phase === "loading") {
    return (
      <div aria-busy="true" aria-label="Loading recommendations">
        <div className="h-16 w-2/3 max-w-lg animate-pulse rounded-photo bg-surface" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="mt-8 flex gap-6 border-t-[1.5px] border-line pt-6">
            <div className="aspect-[2/3] w-28 animate-pulse rounded-photo bg-surface" />
            <div className="h-6 w-1/3 animate-pulse rounded-photo bg-surface" />
          </div>
        ))}
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <StatusView
        icon={BookOpen}
        title="No recommendations this time"
        actions={
          <Button to="/" icon={ScanLine}>
            Scan another shelf
          </Button>
        }
      >
        The model couldn't find recommendations for this scan. A clearer photo with more readable spines usually
        helps.
      </StatusView>
    );
  }

  const basis = meta.prompt_books_count ? `${meta.prompt_books_count} books on your shelf` : "your shelf";
  const facts = [
    `${books.length} pick${books.length !== 1 ? "s" : ""} based on ${basis}`,
    meta.processing_time_ms && `generated in ${(meta.processing_time_ms / 1000).toFixed(1)} s`,
    meta.model_used,
  ].filter(Boolean);

  return (
    <div>
      {back}
      <header className="mt-4 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="type-display text-6xl sm:text-7xl">What to read next</h1>
          <p className="mt-3 text-[15px] text-ink-muted">{facts.join(" · ")}</p>
        </div>
        {user && (
          <div className="flex flex-wrap items-center gap-3">
            {saved ? (
              <>
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <BookmarkCheck className="size-4" strokeWidth={1.75} aria-hidden /> Saved
                </span>
                <Button variant="secondary" icon={Trash2} onClick={() => setShowDeleteDialog(true)}>
                  Remove from saved
                </Button>
              </>
            ) : (
              <Button size="lg" icon={Bookmark} loading={saving} onClick={handleSave}>
                {saving ? "Saving…" : "Save these picks"}
              </Button>
            )}
          </div>
        )}
      </header>

      <Notice tone="error" message={actionError} onDismiss={() => setActionError(null)} className="mt-6" />

      <motion.div className="mt-10" variants={list(0.07)} initial="hidden" animate="show">
        {books.map((book, i) => (
          <motion.div key={`${book.title}-${i}`} variants={rise}>
            <RecommendationCard book={book} />
          </motion.div>
        ))}
      </motion.div>

      <div className="mt-12 space-y-10">
        {!user && (
          <AccountCta title="Keep these picks">
            Sign up now and this scan and its recommendations move straight into your new account.
          </AccountCta>
        )}
        <div className="flex flex-wrap gap-3">
          <Button to={resultsUrl} variant="secondary" icon={ArrowLeft}>
            Back to your shelf
          </Button>
          <Button to="/" variant="ghost" icon={ScanLine}>
            Scan another shelf
          </Button>
        </div>
      </div>

      <Dialog
        open={showDeleteDialog}
        busy={deleting}
        onClose={() => setShowDeleteDialog(false)}
        title="Delete this scan for good?"
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
        This permanently deletes the scan and all {books.length} recommendation{books.length !== 1 ? "s" : ""} with it.
        You can't undo this.
      </Dialog>
    </div>
  );
}
