import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import LoginGate from "../components/LoginGate";

export default function Saved() {
  const navigate = useNavigate();
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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
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

  const toggleSelection = (scanId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(scanId)) {
        next.delete(scanId);
      } else {
        next.add(scanId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === savedSets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(savedSets.map((s) => s.scan_id)));
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const scanIdsArray = Array.from(selectedIds);

      const response = await fetch("/api/saved", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scan_ids: scanIdsArray }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Delete failed: ${response.status}`);
      }

      const data = await response.json();

      const deletedSet = new Set(data.deleted_scan_ids);
      setSavedSets((prev) => prev.filter((s) => !deletedSet.has(s.scan_id)));

      setSelectedIds(new Set());
      setShowDeleteDialog(false);

      setFeedback(
        `Deleted ${data.deleted_count} saved scan${data.deleted_count !== 1 ? "s" : ""} and their recommendations.`
      );
      setTimeout(() => setFeedback(null), 4000);
    } catch {
      setShowDeleteDialog(false);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-bg-surface border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto">
        <LoginGate
          title="Sign in to see your saved scans"
          description="Your saved recommendations are stored with your account and accessible from any device."
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-text-primary">Saved Scans</h1>
        <p className="text-text-secondary mt-2">Your collection of saved book recommendations.</p>
      </div>

      {/* Feedback bar */}
      {feedback && (
        <div className="mb-6 p-4 bg-success-muted border border-success/30 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-success text-sm">{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-success/60 hover:text-success">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-bg-surface rounded-full animate-spin border-t-accent" />
          <p className="text-text-secondary mt-4 text-sm">Loading saved scans...</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 bg-danger-muted rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-text-primary">Something went wrong</h2>
          <p className="text-text-secondary mt-2 text-center max-w-md text-sm">{error}</p>
          <button
            onClick={fetchSavedSets}
            className="mt-6 px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && savedSets.length === 0 && (
        <div className="glass-card">
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 bg-bg-surface rounded-full flex items-center justify-center mb-5">
              <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <h2 className="font-display text-xl font-semibold text-text-primary">
              No Saved Recommendations Yet
            </h2>
            <p className="text-text-secondary mt-2 text-center max-w-md text-sm">
              Scan your bookshelf and save the recommendations you like to see them here.
            </p>
            <button
              onClick={() => navigate("/")}
              className="mt-6 px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium"
            >
              Scan a Bookshelf
            </button>
          </div>
        </div>
      )}

      {/* List state */}
      {!loading && !error && savedSets.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={selectedIds.size === savedSets.length && savedSets.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-border accent-[#7c5e36]"
                />
                {selectedIds.size === savedSets.length ? "Deselect All" : "Select All"}
              </label>
              {selectedIds.size > 0 && (
                <span className="text-sm text-text-muted">({selectedIds.size} selected)</span>
              )}
            </div>

            <button
              onClick={() => setShowDeleteDialog(true)}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-danger text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Selected
            </button>
          </div>

          <div className="space-y-3">
            {savedSets.map((set) => (
              <div
                key={set.scan_id}
                className={`glass-card border-2 transition-all duration-150 animate-fade-in-up ${
                  selectedIds.has(set.scan_id)
                    ? "border-accent bg-accent-muted"
                    : "border-transparent hover:border-border-accent"
                }`}
              >
                <div className="flex items-center gap-4 p-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(set.scan_id)}
                    onChange={() => toggleSelection(set.scan_id)}
                    className="w-4 h-4 rounded border-border accent-[#7c5e36] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      Scanned {formatDate(set.scan_date)}
                    </p>
                    <p className="text-sm text-text-secondary mt-1 truncate">
                      {set.recognized_books_preview.join(", ")}
                      {set.recognized_books_count > set.recognized_books_preview.length && (
                        <span className="text-text-muted">
                          {" "}+{set.recognized_books_count - set.recognized_books_preview.length} more
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      {set.recommendation_count} recommendation{set.recommendation_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Link
                    to={`/recommendations/${set.scan_id}`}
                    className="shrink-0 px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !deleting && setShowDeleteDialog(false)}
          />
          <div className="relative glass-card max-w-md w-full mx-4 p-6">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-danger-muted rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
            <h3 className="font-display text-lg font-semibold text-text-primary text-center">
              Permanently Delete {selectedIds.size} Saved Scan{selectedIds.size !== 1 ? "s" : ""}?
            </h3>
            <p className="text-text-secondary text-sm text-center mt-3">
              This will permanently delete {selectedIds.size} saved scan{selectedIds.size !== 1 ? "s" : ""} and all
              recommendations associated with {selectedIds.size !== 1 ? "them" : "it"}.
              This action cannot be undone.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-bg-surface text-text-secondary border border-border rounded-lg hover:border-border-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-danger text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  "Yes, Delete Permanently"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
