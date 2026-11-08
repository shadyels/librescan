import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { spring } from "../motion";
import AccountCta from "../components/ui/AccountCta";
import Button from "../components/ui/Button";
import Notice from "../components/ui/Notice";
import { inputClass } from "../components/ui/Field";

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

const READING_LEVELS = [
  ["Beginner", "Light, easy-to-follow reads with accessible language"],
  ["Intermediate", "Standard complexity: most popular fiction and non-fiction"],
  ["Advanced", "Complex, literary or academic works with dense prose"],
];

const MAX_AUTHORS = 20;

function Section({ title, hint, children, htmlFor }) {
  const Title = htmlFor ? "label" : "h2";
  return (
    <section className="grid gap-4 border-t-[1.5px] border-ink py-8 md:grid-cols-[16rem_1fr] md:gap-10">
      <div>
        <Title htmlFor={htmlFor} className="block text-lg font-bold">
          {title}
        </Title>
        <p className="mt-1 text-sm text-ink-muted">{hint}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

export default function Preferences() {
  const { user, loading: authLoading } = useAuth();
  const [genres, setGenres] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [authorInput, setAuthorInput] = useState("");
  const [language, setLanguage] = useState("");
  const [readingLevel, setReadingLevel] = useState("");
  const [fetchLoading, setFetchLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (authLoading || !user) return;
    fetch("/api/preferences", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.preferences) {
          setGenres(data.preferences.genres || []);
          setAuthors(data.preferences.authors || []);
          setLanguage(data.preferences.language || "");
          setReadingLevel(data.preferences.reading_level || "");
        }
      })
      .catch(() => setFeedback({ tone: "error", message: "Couldn't load your saved preferences. You can still edit and save." }))
      .finally(() => setFetchLoading(false));
  }, [user, authLoading]);

  const toggleGenre = (genre) =>
    setGenres((prev) => (prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]));

  function addAuthor() {
    const name = authorInput.trim();
    if (!name) return;
    if (authors.some((a) => a.toLowerCase() === name.toLowerCase())) return setAuthorInput("");
    if (authors.length >= MAX_AUTHORS) {
      return setFeedback({ tone: "error", message: `You can add up to ${MAX_AUTHORS} authors. Remove one to add another.` });
    }
    setAuthors((prev) => [...prev, name]);
    setAuthorInput("");
  }

  async function handleSave() {
    setFeedback(null);
    setSaving(true);
    try {
      const response = await fetch("/api/preferences", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genres, authors, language, reading_level: readingLevel }),
      });
      const data = await response.json();
      setFeedback(
        data.success
          ? { tone: "success", message: "Preferences saved. They'll shape your next recommendations." }
          : { tone: "error", message: data.error || "Couldn't save your preferences." }
      );
    } catch {
      setFeedback({ tone: "error", message: "Network error. Check your connection and try again." });
    } finally {
      setSaving(false);
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
      <AccountCta variant="gate" title="Preferences need an account">
        Create a free account to save your reading preferences. They're added to every recommendation request.
      </AccountCta>
    );
  }

  if (fetchLoading) {
    return (
      <div aria-busy="true" aria-label="Loading preferences">
        <div className="h-16 w-2/3 max-w-lg animate-pulse rounded-photo bg-surface" />
        <div className="mt-10 h-48 animate-pulse rounded-photo bg-surface" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="type-display text-6xl sm:text-7xl">Preferences</h1>
      <p className="mt-3 max-w-[60ch] text-[15px] text-ink-muted">
        These are written into the recommendation prompt as plain language, so the model weighs them rather than
        filtering by them.
      </p>

      <div className="mt-10">
        <Section title="Favourite genres" hint={genres.length ? `${genres.length} selected` : "Pick any you enjoy."}>
          <div className="flex flex-wrap gap-2">
            {GENRE_OPTIONS.map((genre) => {
              const on = genres.includes(genre);
              return (
                <motion.button
                  key={genre}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleGenre(genre)}
                  whileTap={{ scale: 0.96 }}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors ${
                    on
                      ? "bg-accent text-accent-ink"
                      : "text-ink shadow-[inset_0_0_0_1.5px_var(--color-line)] hover:shadow-[inset_0_0_0_1.5px_var(--color-ink)]"
                  }`}
                >
                  {on && <Check className="size-3.5" strokeWidth={2.5} aria-hidden />}
                  {genre}
                </motion.button>
              );
            })}
          </div>
        </Section>

        <Section title="Favourite authors" hint={`Type a name and press Enter. Up to ${MAX_AUTHORS}.`} htmlFor="author-input">
          <div className="flex max-w-md gap-2">
            <input
              id="author-input"
              type="text"
              value={authorInput}
              onChange={(e) => setAuthorInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAuthor();
                }
              }}
              placeholder="e.g. Ursula K. Le Guin"
              className={inputClass}
            />
            <Button variant="secondary" icon={Plus} onClick={addAuthor} disabled={!authorInput.trim()} className="h-11">
              Add
            </Button>
          </div>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Added authors">
            <AnimatePresence initial={false}>
              {authors.map((author) => (
                <motion.li
                  key={author}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
                  transition={spring}
                  className="inline-flex h-9 items-center gap-1 rounded-full bg-surface pl-3.5 pr-1.5 text-sm font-semibold"
                >
                  {author}
                  <button
                    type="button"
                    onClick={() => setAuthors((prev) => prev.filter((a) => a !== author))}
                    aria-label={`Remove ${author}`}
                    className="rounded-full p-1 text-ink-muted hover:bg-ink/8 hover:text-ink"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {authors.length === 0 && <p className="text-sm text-ink-muted">No authors added yet.</p>}
        </Section>

        <Section title="Language" hint="The language you'd like recommendations in." htmlFor="language-select">
          <div className="relative max-w-xs">
            <select
              id="language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={`${inputClass} cursor-pointer appearance-none pr-10`}
            >
              <option value="">No preference</option>
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-3.5 size-4 text-ink-muted" aria-hidden />
          </div>
        </Section>

        <Section title="Reading level" hint="How demanding you like your books.">
          <fieldset className="grid gap-2 sm:grid-cols-3">
            <legend className="sr-only">Reading level</legend>
            {READING_LEVELS.map(([level, description]) => {
              const on = readingLevel === level;
              return (
                <label
                  key={level}
                  className={`flex cursor-pointer flex-col gap-1 rounded-[4px] p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
                    on ? "bg-accent text-accent-ink" : "shadow-[inset_0_0_0_1.5px_var(--color-line)] hover:shadow-[inset_0_0_0_1.5px_var(--color-ink)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="reading-level"
                    value={level}
                    checked={on}
                    onChange={(e) => setReadingLevel(e.target.value)}
                    className="sr-only"
                  />
                  <span className="font-bold">{level}</span>
                  <span className={`text-sm ${on ? "opacity-85" : "text-ink-muted"}`}>{description}</span>
                </label>
              );
            })}
          </fieldset>
          {readingLevel && (
            <button type="button" onClick={() => setReadingLevel("")} className="mt-3 text-sm text-ink-muted underline hover:text-ink">
              Clear reading level
            </button>
          )}
        </Section>

        <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t-[1.5px] border-ink bg-ground px-4 py-5 sm:flex-row sm:items-center">
          <Button size="lg" loading={saving} onClick={handleSave}>
            {saving ? "Saving…" : "Save preferences"}
          </Button>
          <Notice tone={feedback?.tone} message={feedback?.message} onDismiss={() => setFeedback(null)} className="flex-1" />
        </div>
      </div>
    </div>
  );
}
