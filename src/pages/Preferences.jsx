/**
 * Preferences.jsx
 *
 * Route: /preferences
 * Purpose: Allows users to set reading preferences that influence LLM recommendations.
 *
 * Four preference sections:
 * 1. Genres — checkbox grid (multi-select from 15 fixed genres)
 * 2. Authors — free-text input with removable tags (type name, press Enter)
 * 3. Language — single-select dropdown (15 languages)
 * 4. Reading Level — radio buttons (Beginner / Intermediate / Advanced)
 *
 * Data flow:
 * - On mount: GET /api/preferences?device_id=xxx → populate form
 * - On save: PUT /api/preferences → upsert to DB
 * - On next recommendation generation: generate-recommendations.js reads these
 *   from the DB and injects them into the LLM prompt
 *
 * Dependencies:
 * - useSession: provides the device_id for API calls
 * - useState/useEffect: React state management and lifecycle
 */

import { useState, useEffect } from "react";
import { useSession } from "../contexts/SessionContext";

/**
 * These lists must match exactly what the backend accepts in api/preferences.js.
 * If you add/remove items here, update the backend VALID_* arrays too.
 * Consider having shared lists for a future update
 */

const GENRE_OPTIONS = [
  "Fiction",
  "Non-Fiction",
  "Science Fiction",
  "Fantasy",
  "Mystery / Thriller",
  "Romance",
  "Horror",
  "Historical Fiction",
  "Biography / Memoir",
  "Self-Help",
  "Science / Technology",
  "Philosophy",
  "Poetry",
  "Business / Economics",
  "Young Adult (YA)",
];

const LANGUAGE_OPTIONS = [
  "English",
  "Chinese (Mandarin)",
  "German",
  "French",
  "Spanish",
  "Japanese",
  "Russian",
  "Portuguese",
  "Korean",
  "Italian",
  "Dutch",
  "Swedish",
  "Arabic",
  "Hindi",
  "Turkish",
];

const READING_LEVEL_OPTIONS = ["Beginner", "Intermediate", "Advanced"];
const READING_LEVEL_DESCRIPTIONS = {
  Beginner: "Light, easy-to-follow reads with accessible language",
  Intermediate: "Standard complexity — most popular fiction and non-fiction",
  Advanced: "Complex, literary, or academic works with dense prose",
};

function Preferences() {
  const { deviceId, loading: sessionLoading } = useSession();

  // ---- Form state ----
  // Each piece of state corresponds to one column in the preferences table.

  // genres: array of selected genre strings (e.g., ["Fiction", "Fantasy"])
  const [genres, setGenres] = useState([]);

  // authors: array of author name strings (e.g., ["Isaac Asimov", "Ursula K. Le Guin"])
  const [authors, setAuthors] = useState([]);

  // authorInput: the current text in the author input field (before pressing Enter)
  // This is separate from the authors array because we need to track what the user
  // is typing before they confirm it as a tag.
  const [authorInput, setAuthorInput] = useState("");

  // language: single selected language string, or "" for no preference
  const [language, setLanguage] = useState("");

  // readingLevel: single selected level string, or "" for no preference
  const [readingLevel, setReadingLevel] = useState("");

  // ---- UI state ----
  // fetchLoading: true while fetching existing preferences from the API on mount
  const [fetchLoading, setFetchLoading] = useState(true);

  // saving: true while the PUT request is in flight (disables the Save button)
  const [saving, setSaving] = useState(false);

  // feedback: success or error message shown after save attempt
  // { type: "success" | "error", message: string }
  const [feedback, setFeedback] = useState(null);

  // ---- Load existing preferences on mount ----
  // Runs once when the component mounts AND the deviceId is available.
  // If the user has previously saved preferences, we populate the form with them.
  useEffect(() => {
    if (!deviceId) return;

    async function fetchPreferences() {
      try {
        const response = await fetch(`/api/preferences?device_id=${deviceId}`);
        const data = await response.json();

        if (data.success && data.preferences) {
          // Populate form with saved preferences
          setGenres(data.preferences.genres || []);
          setAuthors(data.preferences.authors || []);
          setLanguage(data.preferences.language || "");
          setReadingLevel(data.preferences.reading_level || "");
        }
        // If data.preferences is null, form stays empty (no preferences saved yet)
      } catch (error) {
        // Network error fetching preferences — form stays empty, user can still fill it
        console.error("Failed to fetch preferences:", error);
      } finally {
        // Always stop the loading spinner, even on error
        setFetchLoading(false);
      }
    }

    fetchPreferences();
  }, [deviceId]); // Re-run if deviceId changes (shouldn't happen, but safe)

  // ---- Genre toggle handler ----
  /**
   * Adds or removes a genre from the selected genres array.
   * Called when the user clicks a genre checkbox.
   *
   * @param {string} genre - The genre string that was clicked
   */
  function handleGenreToggle(genre) {
    setGenres((prev) => {
      // If the genre is already selected, remove it (uncheck)
      if (prev.includes(genre)) {
        return prev.filter((g) => g !== genre);
      }
      // Otherwise, add it (check)
      return [...prev, genre];
    });
  }

  // ---- Author tag handlers ----

  /**
   * Adds the current authorInput text as a new author tag.
   * Called when the user presses Enter or clicks the Add button.
   * Prevents duplicates (case-insensitive comparison).
   */
  function handleAddAuthor() {
    const trimmed = authorInput.trim();

    // Don't add empty strings
    if (trimmed.length === 0) return;

    // Don't add duplicates (case-insensitive check)
    // e.g., "Isaac Asimov" and "isaac asimov" are considered the same
    const alreadyExists = authors.some(
      (a) => a.toLowerCase() === trimmed.toLowerCase(),
    );
    if (alreadyExists) {
      setAuthorInput(""); // Clear input even if duplicate
      return;
    }

    // Cap at 20 authors (matches backend limit)
    if (authors.length >= 20) {
      setFeedback({
        type: "error",
        message: "Maximum 20 authors allowed",
      });
      return;
    }

    // Add the new author and clear the input
    setAuthors((prev) => [...prev, trimmed]);
    setAuthorInput("");
  }

  /**
   * Handles keydown events on the author input field.
   * Enter key adds the current text as a tag.
   *
   * @param {KeyboardEvent} e - The keyboard event
   */
  function handleAuthorKeyDown(e) {
    if (e.key === "Enter") {
      // Prevent form submission (we don't use a real <form> submit, but just in case)
      e.preventDefault();
      handleAddAuthor();
    }
  }

  /**
   * Removes an author from the tags array by index.
   * Called when the user clicks the "×" button on a tag.
   *
   * @param {number} index - Index of the author to remove
   */
  function handleRemoveAuthor(index) {
    setAuthors((prev) => prev.filter((_, i) => i !== index));
  }

  // ---- Save handler ----
  /**
   * Sends all preferences to the backend via PUT /api/preferences.
   * The backend performs validation and upserts into the preferences table.
   */
  async function handleSave() {
    // Clear any previous feedback message
    setFeedback(null);
    // Show saving state (disables button, shows spinner)
    setSaving(true);

    try {
      const response = await fetch("/api/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device_id: deviceId,
          genres,
          authors,
          language,
          reading_level: readingLevel,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setFeedback({
          type: "success",
          message:
            "Preferences saved! They'll be used for your next recommendations.",
        });
      } else {
        // Backend returned an error (validation failure, DB error, etc.)
        setFeedback({
          type: "error",
          message: data.error || "Failed to save preferences",
        });
      }
    } catch (error) {
      // Network error (server down, no internet, etc.)
      setFeedback({
        type: "error",
        message: "Network error. Please check your connection and try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  // ---- Loading state ----
  // Show a spinner while the session is initializing or preferences are being fetched.
  // We need the deviceId before we can fetch, and we need fetched data before rendering the form.
  if (sessionLoading || fetchLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center py-20">
          {/* Animated spinner — matches the purple theme */}
          <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
          <span className="ml-3 text-gray-600">Loading preferences...</span>
        </div>
      </div>
    );
  }

  // ---- Main render ----
  return (
    <div className="max-w-4xl mx-auto">
      {/* ================================================================
          PAGE HEADER
          ================================================================ */}
      <h1 className="text-4xl font-bold text-gray-900 mb-2">
        Your Preferences
      </h1>
      <p className="text-gray-600 mb-8">
        Tell us about your reading preferences to get personalized
        recommendations. These will be used the next time you generate
        recommendations from a scan.
      </p>

      {/* ================================================================
          FEEDBACK MESSAGE
          Shows success or error after saving. Dismissed by clearing feedback state.
          ================================================================ */}
      {feedback && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <span>{feedback.message}</span>
          {/* Dismiss button — sets feedback to null to hide the message */}
          <button
            onClick={() => setFeedback(null)}
            className="ml-4 text-lg font-bold opacity-50 hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}

      {/* ================================================================
          MAIN FORM CARD
          White card with shadow, matching the existing app design.
          We don't use a <form> element because we handle submission via
          the Save button's onClick — there's no native form submission.
          ================================================================ */}
      <div className="bg-white rounded-lg shadow-md p-8 space-y-10">
        {/* ==============================================================
            SECTION 1: GENRES (Checkbox Grid)
            ==============================================================
            Users can select multiple genres from the fixed list.
            Each genre is a styled checkbox + label pair.
            Layout: responsive grid (2 cols on mobile, 3 on medium, 4 on large).
        */}
        <div>
          <label className="block text-lg font-semibold text-gray-800 mb-1">
            Favorite Genres
          </label>
          <p className="text-sm text-gray-500 mb-4">
            Select all genres you enjoy reading. This helps the AI recommend
            books in styles you like.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {GENRE_OPTIONS.map((genre) => {
              // Check if this genre is currently selected
              const isSelected = genres.includes(genre);

              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => handleGenreToggle(genre)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors text-left ${
                    isSelected
                      ? "bg-purple-100 border-purple-400 text-purple-800"
                      : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300"
                  }`}
                >
                  {/* Checkmark indicator + genre name */}
                  <span className="mr-1.5">{isSelected ? "✓" : ""}</span>
                  {genre}
                </button>
              );
            })}
          </div>
          {/* Selection count feedback */}
          {genres.length > 0 && (
            <p className="text-sm text-purple-600 mt-2">
              {genres.length} genre{genres.length !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>

        {/* ==============================================================
            SECTION 2: AUTHORS (Free-text Tags)
            ==============================================================
            Users type an author name and press Enter (or click Add) to add it
            as a tag. Each tag has an "×" button to remove it.
            This is free-text because there are too many possible authors
            to present as a fixed list.
        */}
        <div>
          <label className="block text-lg font-semibold text-gray-800 mb-1">
            Favorite Authors
          </label>
          <p className="text-sm text-gray-500 mb-4">
            Add authors you enjoy. Type a name and press Enter to add.
          </p>

          {/* Input row: text field + Add button */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={authorInput}
              onChange={(e) => setAuthorInput(e.target.value)}
              onKeyDown={handleAuthorKeyDown}
              placeholder="e.g. Isaac Asimov"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            <button
              type="button"
              onClick={handleAddAuthor}
              disabled={authorInput.trim().length === 0}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>

          {/* Tags display: each author shown as a removable pill */}
          {authors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {authors.map((author, index) => (
                <span
                  key={`${author}-${index}`}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 text-purple-700 text-sm rounded-full border border-purple-200"
                >
                  {author}
                  {/* Remove button — calls handleRemoveAuthor with this tag's index */}
                  <button
                    type="button"
                    onClick={() => handleRemoveAuthor(index)}
                    className="ml-1 text-purple-400 hover:text-purple-700 font-bold"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Empty state hint */}
          {authors.length === 0 && (
            <p className="text-sm text-gray-400">No authors added yet</p>
          )}
        </div>

        {/* ==============================================================
            SECTION 3: LANGUAGE (Dropdown Select)
            ==============================================================
            Single selection from 15 languages. The default empty option
            means "no preference" (recommendations can be in any language).
        */}
        <div>
          <label
            htmlFor="language-select"
            className="block text-lg font-semibold text-gray-800 mb-1"
          >
            Preferred Language
          </label>
          <p className="text-sm text-gray-500 mb-4">
            Choose the language you prefer for book recommendations.
          </p>
          <select
            id="language-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full max-w-sm px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            {/* Default option: no preference */}
            <option value="">No preference</option>
            {LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>

        {/* ==============================================================
            SECTION 4: READING LEVEL (Radio Buttons)
            ==============================================================
            Single selection from 3 levels. Each option shows the level name
            and a short description to help users self-assess.
        */}
        <div>
          <label className="block text-lg font-semibold text-gray-800 mb-1">
            Reading Level
          </label>
          <p className="text-sm text-gray-500 mb-4">
            What complexity level do you prefer?
          </p>
          <div className="space-y-3">
            {READING_LEVEL_OPTIONS.map((level) => {
              const isSelected = readingLevel === level;

              return (
                <label
                  key={level}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-purple-50 border-purple-400"
                      : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {/* Hidden native radio input — styled via the parent label */}
                  <input
                    type="radio"
                    name="reading-level"
                    value={level}
                    checked={isSelected}
                    onChange={(e) => setReadingLevel(e.target.value)}
                    className="mt-0.5 accent-purple-600"
                  />
                  <div>
                    <span className="font-medium text-gray-800">{level}</span>
                    <p className="text-sm text-gray-500">
                      {READING_LEVEL_DESCRIPTIONS[level]}
                    </p>
                  </div>
                </label>
              );
            })}

            {/* Clear selection option — only shown when a level is selected */}
            {readingLevel && (
              <button
                type="button"
                onClick={() => setReadingLevel("")}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Clear selection
              </button>
            )}
          </div>
        </div>

        {/* ==============================================================
            SAVE BUTTON
            ==============================================================
            Calls handleSave() which PUTs to /api/preferences.
            Disabled while saving (prevents double-clicks).
        */}
        <div className="pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                {/* Inline spinner inside the button */}
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Saving...
              </span>
            ) : (
              "Save Preferences"
            )}
          </button>
          <p className="text-sm text-gray-500 mt-2">
            Preferences are applied when you next generate recommendations from
            a scan.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Preferences;
