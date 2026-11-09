import { useEffect, useRef, useState } from "react";
import { Camera, Check, ImagePlus, ScanLine } from "lucide-react";
import { useSession } from "../contexts/SessionContext.jsx";
import { ReadSweep, useReading } from "../reading";
import Button from "./ui/Button";
import Notice from "./ui/Notice";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/heic"];

function Step({ n, label, state }) {
  const tag = { done: "Done", now: "Now", working: "Working", next: "Next", later: "Later" }[state];
  const active = state === "now" || state === "working";
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-[15px] transition-colors ${
        active ? "border-line bg-raised shadow-card" : "border-transparent"
      } ${state === "later" || state === "next" ? "text-ink-muted" : ""}`}
      aria-current={active ? "step" : undefined}
    >
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-[11px] border font-display text-[15px] transition-transform ${
          state === "done" || active ? "border-accent bg-accent text-accent-ink" : "border-line"
        } ${active ? "-rotate-6" : ""}`}
      >
        {state === "done" ? <Check className="size-4.5" strokeWidth={3} aria-hidden /> : n}
      </span>
      <span className={`flex-1 ${active ? "font-semibold" : ""}`}>{label}</span>
      {state === "working" ? (
        <span className="flex items-center gap-1.5 text-[13px] font-semibold">
          <span className="size-2 animate-pulse rounded-full bg-coral motion-reduce:animate-none" aria-hidden />
          {tag}
        </span>
      ) : (
        <span className="text-[13px] font-semibold text-ink-muted">{tag}</span>
      )}
    </li>
  );
}

export default function CameraCapture({ onUploadSuccess }) {
  const { deviceId } = useSession();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  useReading(uploading);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  function takeFile(next) {
    if (!next) return;
    if (next.size > MAX_BYTES) return setError("That photo is over 10 MB. Choose a smaller one.");
    if (!ALLOWED.includes(next.type)) return setError("That file type isn't supported. Use a JPEG, PNG or HEIC photo.");
    setError(null);
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setPreviewFailed(false);
  }

  async function upload() {
    if (!deviceId) return setError("Your session isn't ready yet. Refresh the page and try again.");
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("image", file);
    formData.append("device_id", deviceId);
    let response;
    try {
      response = await fetch("/api/upload-image", { method: "POST", credentials: "include", body: formData });
    } catch {
      setUploading(false);
      return setError("Couldn't reach LibreScan. Check your connection and try again.");
    }
    if (!response.ok) {
      // Recovery depends on the cause: 400 = the file couldn't be read (a
      // different photo helps); 429 = daily API limit (server gives the reason);
      // 5xx = server fault (the photo is not the problem).
      const data = await response.json().catch(() => ({}));
      const reason = (data.error || "Upload failed").replace(/\.?$/, ".");
      const recovery = {
        400: " Try a different photo.",
        429: "",
      }[response.status] ?? " Something went wrong on our side. Try again in a moment.";
      setUploading(false);
      return setError(reason + recovery);
    }
    try {
      const data = await response.json();
      onUploadSuccess(data.scan_id);
    } catch {
      setUploading(false);
      setError("The server sent an unexpected response. Something went wrong on our side. Try again in a moment.");
    }
  }

  const choose = () => inputRef.current?.click();

  const steps = [
    ["Choose a shelf photo", file ? "done" : "now"],
    ["Read the spines", uploading ? "working" : file ? "next" : "later"],
    ["Match covers on Google Books", uploading ? "working" : "later"],
    ["Recommendations, when you want them", "later"],
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:grid-rows-[auto_1fr] lg:gap-x-14 lg:gap-y-8">
      <section className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
        <h1 className="type-display text-6xl sm:text-7xl lg:text-[5.25rem]">
          {uploading ? "Reading your " : "Scan your "}
          <span className="text-coral">shelf</span>
        </h1>
        <p className="mt-4 max-w-[60ch] text-[17px] leading-relaxed text-ink-muted">
          {uploading
            ? "The vision model is reading every spine in your photo, then Google Books matches the covers. This takes a few seconds."
            : "One photo of the books you own. LibreScan reads the spines, finds the covers and recommends what to read next. No account needed."}
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg, image/jpg, image/png, image/heic"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            takeFile(e.target.files[0]);
            e.target.value = "";
          }}
        />

        <div
          className={`relative mt-8 aspect-[3/2] overflow-hidden rounded-photo border shadow-card transition-colors ${
            preview && !previewFailed
              ? "border-line"
              : dragging
                ? "border-dashed border-accent bg-highlight/30"
                : "border-dashed border-ink-muted/40 bg-raised hover:border-ink-muted"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            if (!uploading) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!uploading) takeFile(e.dataTransfer.files[0]);
          }}
        >
          {preview && !previewFailed ? (
            <img
              src={preview}
              alt="Your shelf photo"
              className="absolute inset-0 size-full object-cover"
              onError={() => setPreviewFailed(true)}
            />
          ) : (
            <button
              type="button"
              onClick={choose}
              disabled={uploading}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
            >
              <span className="mb-2 grid size-17 -rotate-6 place-items-center rounded-[20px] bg-highlight text-highlight-ink shadow-sticker">
                <ImagePlus className="size-7.5" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="type-display text-xl sm:text-2xl">
                {file ? "Preview unavailable in this browser" : "Drop a shelf photo here, or choose one"}
              </span>
              <span className="text-sm text-ink-muted">JPEG, PNG or HEIC · up to 10 MB</span>
            </button>
          )}
          {uploading && <ReadSweep />}
        </div>

        <div className="mt-3 flex min-h-5 justify-between gap-4 px-2 text-[13px] text-ink-muted">
          {file && (
            <>
              <span className="truncate">{file.name}</span>
              <span className="shrink-0">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
            </>
          )}
        </div>
      </section>

      {/* Actions sit right under the photo on phones, under the steps on desktop. */}
      <div className="flex flex-col gap-4 lg:col-start-2 lg:row-start-2 lg:self-start">
        <div className="flex flex-wrap gap-3">
          {file ? (
            <>
              <Button size="lg" icon={ScanLine} loading={uploading} onClick={upload}>
                {uploading ? "Reading…" : "Read this shelf"}
              </Button>
              <Button size="lg" variant="secondary" onClick={choose} disabled={uploading}>
                Choose another
              </Button>
            </>
          ) : (
            <Button size="lg" icon={Camera} onClick={choose}>
              Take or choose a photo
            </Button>
          )}
        </div>
        <Notice tone="error" message={error} onDismiss={() => setError(null)} />
      </div>

      <aside className="lg:col-start-2 lg:row-start-1 lg:pt-3">
        <ol className="space-y-1.5">
          {steps.map(([label, state], i) => (
            <Step key={label} n={i + 1} label={label} state={state} />
          ))}
        </ol>
      </aside>
    </div>
  );
}
