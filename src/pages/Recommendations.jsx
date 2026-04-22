import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import RecommendationCard from "../components/RecommendationCard";
import SkeletonCard from "../components/SkeletonCard";
import LoginGate from "../components/LoginGate";

export default function Recommendations() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setRecommendations(null);
    setSaved(null);
    setRetryCount((prev) => prev + 1);
  };

  useEffect(() => {
    if (authLoading || !user) return;

    async function loadRecommendations() {
      try {
        setLoading(true);
        setError(null);

        const getResponse = await fetch(`/api/recommendations/${scanId}`, {
          credentials: "include",
        });

        if (getResponse.ok) {
          const getData = await getResponse.json();
          setRecommendations(getData.recommendations);
          setSaved(getData.saved || false);
          setLoading(false);
          return;
        }

        if (getResponse.status !== 404) {
          const errorData = await getResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `Server error: ${getResponse.status}`);
        }

        setLoading(false);
        setGenerating(true);

        const postResponse = await fetch("/api/generate-recommendations", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scan_id: scanId }),
        });

        if (!postResponse.ok) {
          const errorData = await postResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `Generation failed: ${postResponse.status}`);
        }

        const postData = await postResponse.json();
        setRecommendations(postData.recommendations);
        setGenerating(false);
        setSaved(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
        setGenerating(false);
      }
    }

    loadRecommendations();
  }, [scanId, user, authLoading, retryCount]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/saved", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scan_id: scanId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Save failed: ${response.status}`);
      }

      setSaved(true);
    } catch {
      // save failed silently — recommendations still visible
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch("/api/saved", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scan_ids: [scanId] }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Delete failed: ${response.status}`);
      }

      navigate("/saved");
    } catch {
      setShowDeleteDialog(false);
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-bg-surface border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <LoginGate
        title="Sign in to view recommendations"
        description="Personalized recommendations require an account so we can learn your reading preferences."
      />
    );
  }

  const books = recommendations?.recommendations || [];
  const metadata = recommendations?.metadata || {};

  return (
    <div>
      {/* Header */}
      <div className="glass-card px-6 py-5 mb-8">
        <button
          onClick={() => navigate(`/results/${scanId}`)}
          className="flex items-center text-text-muted hover:text-accent transition-colors mb-3 text-sm"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Scan Results
        </button>
        <h1 className="font-display text-3xl font-semibold text-text-primary">Your Recommendations</h1>
        <p className="text-text-secondary text-sm mt-1">Personalized picks based on your bookshelf</p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full border-4 border-bg-surface border-t-accent animate-spin" />
          <h2 className="text-xl font-semibold text-text-primary mt-6">Generating Recommendations...</h2>
          <p className="text-text-secondary mt-2 text-center max-w-md text-sm">
            Our AI is analyzing your bookshelf and finding personalized picks.
            This usually takes 10–30 seconds.
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 bg-danger-muted rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-text-primary">Something went wrong</h2>
          <p className="text-text-secondary mt-2 text-center max-w-md text-sm">{error}</p>
          <div className="flex gap-4 mt-6">
            <button
              onClick={handleRetry}
              className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate(`/results/${scanId}`)}
              className="px-6 py-2 bg-bg-surface text-text-secondary border border-border hover:border-border-accent rounded-lg transition-all"
            >
              Back to Results
            </button>
          </div>
        </div>
      )}

      {/* Success state */}
      {!loading && !generating && !error && books.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-6">
            <p className="text-text-secondary text-sm">
              {books.length} recommendation{books.length !== 1 ? "s" : ""}{" "}
              based on {metadata.prompt_books_count || "your"} book
              {(metadata.prompt_books_count || 0) !== 1 ? "s" : ""}
            </p>
            {metadata.processing_time_ms && (
              <p className="text-text-muted text-xs">
                Generated in {(metadata.processing_time_ms / 1000).toFixed(1)}s
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {books.map((book, index) => (
              <div key={`${book.title}-${index}`} style={{ animationDelay: `${index * 80}ms` }}>
                <RecommendationCard book={book} />
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            {saved === false && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    Save Recommendations
                  </>
                )}
              </button>
            )}
            {saved === true && (
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="flex items-center gap-2 px-6 py-2 bg-danger text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Remove from Saved
              </button>
            )}
            <button
              onClick={() => navigate(`/results/${scanId}`)}
              className="px-6 py-2 bg-bg-surface text-text-secondary border border-border hover:border-border-accent hover:text-text-primary rounded-lg transition-all"
            >
              Back to Scan Results
            </button>
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && !generating && !error && books.length === 0 && recommendations !== null && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 bg-bg-surface rounded-full flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-text-primary">No Recommendations Generated</h2>
          <p className="text-text-secondary mt-2 text-center max-w-md text-sm">
            The AI wasn't able to generate recommendations from your scan.
            Try scanning a clearer photo with more visible book spines.
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-6 px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium"
          >
            Scan Another Bookshelf
          </button>
        </div>
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
              Permanently Delete This Scan?
            </h3>
            <p className="text-text-secondary text-sm text-center mt-3">
              This will permanently delete your scan data and all {books.length}{" "}
              recommendation{books.length !== 1 ? "s" : ""} associated with it.
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
