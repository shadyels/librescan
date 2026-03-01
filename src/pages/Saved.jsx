/**
 * Saved.jsx
 *
 * Page component at route: /saved
 *
 * Purpose:
 * Displays all saved recommendation sets for the current device. Each set
 * represents one bookshelf scan whose recommendations the user chose to keep.
 *
 * Features:
 * - Fetches saved sets on mount via GET /api/saved?device_id=xxx
 * - Card per saved set: scan date, recognized book title preview, recommendation count
 * - "View" link navigates to /recommendations/:scanId to see full recommendations
 * - Multi-select checkboxes for bulk deletion
 * - "Delete Selected" button with confirmation dialog
 * - Loading, empty, and error states
 *
 * Data flow:
 *   On mount → GET /api/saved?device_id=xxx
 *     → 200: display list of saved sets (or empty state if array is empty)
 *     → 500: show error state with retry
 *   On delete → DELETE /api/saved { scan_ids: [...], device_id }
 *     → 200: remove deleted items from local state, show feedback
 *
 * Phase 5 implementation.
 */

// ─── Imports ────────────────────────────────────────────────────────────────────

// useState: manages component state (savedSets, loading, error, selectedIds, etc.)
// useEffect: triggers data fetching on mount when deviceId becomes available
import { useState, useEffect } from "react";

// Link: declarative navigation for the "View" button on each card.
// Using Link (not navigate()) because "View" is a standard navigation link
// to a known URL — the same pattern Results.jsx uses for its recommendation CTA.
// useNavigate: programmatic navigation for the "Scan a Bookshelf" CTA button.
import { Link, useNavigate } from "react-router-dom";

// useSession: provides deviceId from IndexedDB-backed session context.
// deviceId is required for both GET (query param) and DELETE (request body).
import { useSession } from "../contexts/SessionContext";

// ─── Component ──────────────────────────────────────────────────────────────────

/**
 * Saved page component.
 *
 * Renders one of several states:
 *   - Loading: spinner while fetching saved sets
 *   - Empty: no saved recommendations, CTA to scan a bookshelf
 *   - Error: error message with retry button
 *   - List: cards for each saved set with multi-select and delete
 *
 * @returns {JSX.Element} The rendered saved page
 */
export default function Saved() {
  // ── Routing ──
  // navigate() for the "Scan a Bookshelf" CTA in the empty state.
  const navigate = useNavigate();

  // ── Session context ──
  // deviceId needed for GET query param and DELETE request body.
  // sessionLoading: true while IndexedDB is being read for the device ID.
  const { deviceId, loading: sessionLoading } = useSession();

  // ── Component state ──

  // savedSets: array of saved recommendation set summaries from the API.
  // Each item: { scan_id, scan_date, saved_at, recognized_books_count,
  //              recognized_books_preview, recommendation_count }
  const [savedSets, setSavedSets] = useState([]);

  // loading: true during the initial GET fetch. Shows a spinner.
  const [loading, setLoading] = useState(true);

  // error: error message string, or null if no error.
  const [error, setError] = useState(null);

  // selectedIds: Set of scan_ids that the user has checked for deletion.
  // Using a Set for O(1) add/delete/has operations. Stored as state so
  // React re-renders when the selection changes.
  const [selectedIds, setSelectedIds] = useState(new Set());

  // showDeleteDialog: controls visibility of the bulk delete confirmation dialog.
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // deleting: true while DELETE /api/saved is in flight. Disables the confirm
  // button to prevent double-clicks.
  const [deleting, setDeleting] = useState(false);

  // feedback: success message shown after a successful delete operation.
  // null when no feedback to show. Auto-dismissed after 4 seconds.
  const [feedback, setFeedback] = useState(null);

  // ── Data fetching ──

  /**
   * Fetches saved recommendation sets from the API.
   *
   * Called on mount (via useEffect) and can be called after errors (retry).
   * Extracted as a named function so it can be reused by the retry button.
   */
  async function fetchSavedSets() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/saved?device_id=${deviceId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      // data.saved is the array of saved set summaries.
      // Always an array (empty [] if no saved sets, never null).
      setSavedSets(data.saved || []);
    } catch (err) {
      console.error(`[Saved] Fetch error: ${err.message}`);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Fetch on mount once session is ready.
  // Dependencies: deviceId (needed for the query param), sessionLoading
  // (re-run when session finishes loading).
  useEffect(() => {
    if (sessionLoading) return;
    if (!deviceId) return;
    fetchSavedSets();
  }, [deviceId, sessionLoading]);

  // ── Selection handlers ──

  /**
   * Toggles a single scan_id in/out of the selectedIds Set.
   *
   * Creates a new Set each time (immutable update) so React detects the state
   * change and re-renders. Mutating the existing Set in-place would not trigger
   * a re-render because React uses Object.is() for state comparison, and a
   * mutated Set is still the same reference.
   *
   * @param {string} scanId - The scan_id to toggle
   */
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

  /**
   * Toggles between "select all" and "deselect all".
   *
   * If all visible items are selected → deselect all (empty Set).
   * Otherwise → select all visible items.
   */
  const toggleSelectAll = () => {
    if (selectedIds.size === savedSets.length) {
      // All selected → deselect all
      setSelectedIds(new Set());
    } else {
      // Not all selected → select all
      setSelectedIds(new Set(savedSets.map((s) => s.scan_id)));
    }
  };

  // ── Delete handler ──

  /**
   * Deletes all selected scans and their cascade-deleted recommendations.
   *
   * Sends DELETE /api/saved with the array of selected scan_ids.
   * On success:
   *   - Removes deleted items from local state (avoids a re-fetch)
   *   - Clears selection
   *   - Shows feedback message (auto-dismissed after 4 seconds)
   * On error:
   *   - Closes dialog, logs error
   *   - Does NOT modify local state (data is still intact in DB)
   */
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const scanIdsArray = Array.from(selectedIds);

      const response = await fetch("/api/saved", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scan_ids: scanIdsArray, device_id: deviceId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Delete failed: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[Saved] Deleted ${data.deleted_count} scan(s)`);

      // Remove deleted items from local state. Filter by the set of IDs
      // actually deleted (from the API response), not the requested IDs,
      // in case some failed due to ownership mismatch.
      const deletedSet = new Set(data.deleted_scan_ids);
      setSavedSets((prev) => prev.filter((s) => !deletedSet.has(s.scan_id)));

      // Clear selection and close dialog.
      setSelectedIds(new Set());
      setShowDeleteDialog(false);

      // Show feedback with actual deleted count from API response.
      setFeedback(
        `Deleted ${data.deleted_count} saved scan${data.deleted_count !== 1 ? "s" : ""} and their recommendations.`,
      );

      // Auto-dismiss feedback after 4 seconds.
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error(`[Saved] Delete error: ${err.message}`);
      setShowDeleteDialog(false);
    } finally {
      setDeleting(false);
    }
  };

  // ── Date formatting helper ──

  /**
   * Formats an ISO date string into a human-readable format.
   *
   * Example: "2026-02-28T14:30:00.000Z" → "Feb 28, 2026, 2:30 PM"
   *
   * Uses Intl.DateTimeFormat (via toLocaleDateString) for locale-aware formatting.
   * Falls back to the raw ISO string if parsing fails.
   *
   * @param {string} dateStr - ISO 8601 date string from the database
   * @returns {string} Formatted date string
   */
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

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Saved Scans</h1>
        <p className="text-gray-600 mt-2">
          Your collection of saved book recommendations.
        </p>
      </div>

      {/* ── Feedback bar ── */}
      {/* Shown after a successful delete. Green background, same pattern as
          Preferences.jsx success feedback. Auto-dismissed after 4 seconds
          or manually closed via the X button. */}
      {feedback && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Checkmark icon */}
            <svg
              className="w-5 h-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-green-800 text-sm">{feedback}</span>
          </div>
          {/* Dismiss button */}
          <button
            onClick={() => setFeedback(null)}
            className="text-green-600 hover:text-green-800"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* ── Loading state ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          {/* Spinning purple ring, same animation style as Recommendations.jsx */}
          <div className="w-10 h-10 border-4 border-purple-200 rounded-full animate-spin border-t-purple-600"></div>
          <p className="text-gray-500 mt-4">Loading saved scans...</p>
        </div>
      )}

      {/* ── Error state ── */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-16">
          {/* Red circle with exclamation, same pattern as Recommendations.jsx error */}
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800">
            Something went wrong
          </h2>
          <p className="text-gray-500 mt-2 text-center max-w-md">{error}</p>
          <button
            onClick={fetchSavedSets}
            className="mt-6 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── Empty state ── */}
      {/* Shown when fetch succeeded but the array is empty (no saved sets). */}
      {!loading && !error && savedSets.length === 0 && (
        <div className="bg-white rounded-lg shadow-md">
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <span className="text-4xl mb-4">📚</span>
            <h2 className="text-xl font-semibold text-gray-800">
              No Saved Recommendations Yet
            </h2>
            <p className="text-gray-500 mt-2 text-center max-w-md">
              Scan your bookshelf and save the recommendations you like to see
              them here.
            </p>
            <button
              onClick={() => navigate("/")}
              className="mt-6 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Scan a Bookshelf
            </button>
          </div>
        </div>
      )}

      {/* ── List state: saved sets exist ── */}
      {!loading && !error && savedSets.length > 0 && (
        <>
          {/* ── Toolbar: select all + delete selected ── */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {/* Select All / Deselect All checkbox.
                  Checked when all items are selected. The onChange toggles
                  between all-selected and none-selected. */}
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={
                    selectedIds.size === savedSets.length &&
                    savedSets.length > 0
                  }
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                {/* Dynamic label */}
                {selectedIds.size === savedSets.length
                  ? "Deselect All"
                  : "Select All"}
              </label>

              {/* Selection count: only shown when at least one item is selected */}
              {selectedIds.size > 0 && (
                <span className="text-sm text-gray-400">
                  ({selectedIds.size} selected)
                </span>
              )}
            </div>

            {/* Delete Selected button: disabled when nothing is selected.
                Opens the confirmation dialog — does NOT delete immediately. */}
            <button
              onClick={() => setShowDeleteDialog(true)}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {/* Trash icon */}
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Delete Selected
            </button>
          </div>

          {/* ── Saved set cards ── */}
          {/* Each card has: checkbox, scan info (date + book preview + rec count), View link.
              Cards highlight purple when selected to give visual feedback. */}
          <div className="space-y-3">
            {savedSets.map((set) => (
              <div
                key={set.scan_id}
                className={`bg-white rounded-lg shadow-sm border-2 transition-colors ${
                  selectedIds.has(set.scan_id)
                    ? "border-purple-400 bg-purple-50"
                    : "border-transparent hover:border-gray-200"
                }`}
              >
                <div className="flex items-center gap-4 p-4">
                  {/* ── Checkbox ── */}
                  <input
                    type="checkbox"
                    checked={selectedIds.has(set.scan_id)}
                    onChange={() => toggleSelection(set.scan_id)}
                    className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 shrink-0"
                  />

                  {/* ── Card content ── */}
                  {/* flex-1 fills remaining space. min-w-0 allows text truncation
                      to work inside a flex container (without it, the child would
                      overflow rather than truncate). */}
                  <div className="flex-1 min-w-0">
                    {/* Scan date */}
                    <p className="text-sm font-medium text-gray-900">
                      Scanned {formatDate(set.scan_date)}
                    </p>

                    {/* Recognized book title preview.
                        Shows up to 4 titles from recognized_books_preview,
                        then "+N more" if there are additional books beyond those 4.
                        The truncate class adds "..." if the text overflows. */}
                    <p className="text-sm text-gray-500 mt-1 truncate">
                      {set.recognized_books_preview.join(", ")}
                      {set.recognized_books_count >
                        set.recognized_books_preview.length && (
                        <span className="text-gray-400">
                          {" "}
                          +
                          {set.recognized_books_count -
                            set.recognized_books_preview.length}{" "}
                          more
                        </span>
                      )}
                    </p>

                    {/* Recommendation count */}
                    <p className="text-xs text-gray-400 mt-1">
                      {set.recommendation_count} recommendation
                      {set.recommendation_count !== 1 ? "s" : ""}
                    </p>
                  </div>

                  {/* ── View button ── */}
                  {/* Links to /recommendations/:scanId. Uses <Link> for
                      declarative navigation (same pattern as Results.jsx). */}
                  <Link
                    to={`/recommendations/${set.scan_id}`}
                    className="shrink-0 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Delete confirmation dialog ── */}
      {/* Same visual pattern as Recommendations.jsx dialog: red warning icon,
          warning text, confirmation question, Cancel/Confirm buttons.
          Rendered as a fixed overlay covering the viewport. */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop: clicking cancels (unless delete is in flight) */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !deleting && setShowDeleteDialog(false)}
          />

          {/* Dialog card */}
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            {/* Warning icon */}
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
            </div>

            {/* Title: includes count */}
            <h3 className="text-lg font-semibold text-gray-900 text-center">
              Permanently Delete {selectedIds.size} Saved Scan
              {selectedIds.size !== 1 ? "s" : ""}?
            </h3>

            {/* Warning text */}
            <p className="text-gray-600 text-sm text-center mt-3">
              This will permanently delete {selectedIds.size} saved scan
              {selectedIds.size !== 1 ? "s" : ""} and all recommendations
              associated with {selectedIds.size !== 1 ? "them" : "it"}. This
              action cannot be undone.
            </p>

            {/* Confirmation question */}
            <p className="text-gray-800 font-medium text-sm text-center mt-3">
              Are you sure you want to proceed?
            </p>

            {/* Action buttons */}
            <div className="flex gap-3 mt-6">
              {/* Cancel */}
              <button
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              {/* Confirm delete */}
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
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
