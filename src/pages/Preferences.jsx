import { useState, useEffect } from "react";
import { useSession } from "../contexts/SessionContext";

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

  const [genres, setGenres] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [authorInput, setAuthorInput] = useState("");
  const [language, setLanguage] = useState("");
  const [readingLevel, setReadingLevel] = useState("");
  const [fetchLoading, setFetchLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!deviceId) return;

    async function fetchPreferences() {
      try {
        const response = await fetch(`/api/preferences?device_id=${deviceId}`);
        const data = await response.json();

        if (data.success && data.preferences) {
          setGenres(data.preferences.genres || []);
          setAuthors(data.preferences.authors || []);
          setLanguage(data.preferences.language || "");
          setReadingLevel(data.preferences.reading_level || "");
        }
      } catch (error) {
        // Network error — form stays empty
      } finally {
        setFetchLoading(false);
      }
    }

    fetchPreferences();
  }, [deviceId]);

  function handleGenreToggle(genre) {
    setGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  }

  function handleAddAuthor() {
    const trimmed = authorInput.trim();
    if (trimmed.length === 0) return;

    const alreadyExists = authors.some(
      (a) => a.toLowerCase() === trimmed.toLowerCase()
    );
    if (alreadyExists) {
      setAuthorInput("");
      return;
    }

    if (authors.length >= 20) {
      setFeedback({ type: "error", message: "Maximum 20 authors allowed" });
      return;
    }

    setAuthors((prev) => [...prev, trimmed]);
    setAuthorInput("");
  }

  function handleAuthorKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddAuthor();
    }
  }

  function handleRemoveAuthor(index) {
    setAuthors((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setFeedback(null);
    setSaving(true);

    try {
      const response = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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
          message: "Preferences saved! They'll be used for your next recommendations.",
        });
      } else {
        setFeedback({
          type: "error",
          message: data.error || "Failed to save preferences",
        });
      }
    } catch (error) {
      setFeedback({
        type: "error",
        message: "Network error. Please check your connection and try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (sessionLoading || fetchLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-bg-surface border-t-accent rounded-full animate-spin" />
          <span className="ml-3 text-text-secondary">Loading preferences...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-display text-4xl font-bold text-text-primary mb-2">
        Your Preferences
      </h1>
      <p className="text-text-secondary mb-8">
        Tell us about your reading preferences to get personalized recommendations.
      </p>

      {feedback && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-success-muted border border-success/30 text-success"
              : "bg-danger-muted border border-danger/30 text-danger"
          }`}
        >
          <span className="text-sm">{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="ml-4 opacity-60 hover:opacity-100 text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      <div className="glass-card p-8 space-y-10">
        {/* Genres */}
        <div>
          <label className="block text-lg font-semibold text-text-primary mb-1">
            Favorite Genres
          </label>
          <p className="text-sm text-text-muted mb-4">
            Select all genres you enjoy reading.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {GENRE_OPTIONS.map((genre) => {
              const isSelected = genres.includes(genre);
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => handleGenreToggle(genre)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-150 text-left ${
                    isSelected
                      ? "bg-accent-muted border-accent text-accent"
                      : "bg-bg-surface border-border text-text-secondary hover:bg-bg-hover hover:border-border-accent hover:text-text-primary"
                  }`}
                >
                  {isSelected && (
                    <svg className="inline w-3 h-3 mr-1.5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {genre}
                </button>
              );
            })}
          </div>
          {genres.length > 0 && (
            <p className="text-sm text-accent mt-2">
              {genres.length} genre{genres.length !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>

        {/* Authors */}
        <div>
          <label className="block text-lg font-semibold text-text-primary mb-1">
            Favorite Authors
          </label>
          <p className="text-sm text-text-muted mb-4">
            Add authors you enjoy. Type a name and press Enter to add.
          </p>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={authorInput}
              onChange={(e) => setAuthorInput(e.target.value)}
              onKeyDown={handleAuthorKeyDown}
              placeholder="e.g. Isaac Asimov"
              className="flex-1 px-4 py-2 border border-border rounded-lg text-sm bg-bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
            <button
              type="button"
              onClick={handleAddAuthor}
              disabled={authorInput.trim().length === 0}
              className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>
          {authors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {authors.map((author, index) => (
                <span
                  key={`${author}-${index}`}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-accent-muted text-accent text-sm rounded-full border border-accent/20"
                >
                  {author}
                  <button
                    type="button"
                    onClick={() => handleRemoveAuthor(index)}
                    className="ml-1 opacity-60 hover:opacity-100 font-bold"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {authors.length === 0 && (
            <p className="text-sm text-text-muted">No authors added yet</p>
          )}
        </div>

        {/* Language */}
        <div>
          <label htmlFor="language-select" className="block text-lg font-semibold text-text-primary mb-1">
            Preferred Language
          </label>
          <p className="text-sm text-text-muted mb-4">
            Choose the language you prefer for book recommendations.
          </p>
          <select
            id="language-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full max-w-sm px-4 py-2 border border-border rounded-lg text-sm bg-bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          >
            <option value="">No preference</option>
            {LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>

        {/* Reading Level */}
        <div>
          <label className="block text-lg font-semibold text-text-primary mb-1">
            Reading Level
          </label>
          <p className="text-sm text-text-muted mb-4">
            What complexity level do you prefer?
          </p>
          <div className="space-y-3">
            {READING_LEVEL_OPTIONS.map((level) => {
              const isSelected = readingLevel === level;
              return (
                <label
                  key={level}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? "bg-accent-muted border-accent"
                      : "bg-bg-surface border-border hover:bg-bg-hover hover:border-border-accent"
                  }`}
                >
                  <input
                    type="radio"
                    name="reading-level"
                    value={level}
                    checked={isSelected}
                    onChange={(e) => setReadingLevel(e.target.value)}
                    className="mt-0.5 accent-[#7c5e36]"
                  />
                  <div>
                    <span className={`font-medium ${isSelected ? "text-accent" : "text-text-primary"}`}>
                      {level}
                    </span>
                    <p className="text-sm text-text-secondary mt-0.5">
                      {READING_LEVEL_DESCRIPTIONS[level]}
                    </p>
                  </div>
                </label>
              );
            })}
            {readingLevel && (
              <button
                type="button"
                onClick={() => setReadingLevel("")}
                className="text-sm text-text-muted hover:text-text-secondary underline"
              >
                Clear selection
              </button>
            )}
          </div>
        </div>

        {/* Save */}
        <div className="pt-4 border-t border-border">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 bg-accent text-white font-semibold rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-bg-primary/40 border-t-bg-primary rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              "Save Preferences"
            )}
          </button>
          <p className="text-sm text-text-muted mt-2">
            Preferences are applied when you next generate recommendations.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Preferences;
