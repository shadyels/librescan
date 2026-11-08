import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, ScanLine } from "lucide-react";
import { useSession } from "../contexts/SessionContext.jsx";
import { HOUSE_BAND, ReadSweep, sampleSpectrum, saveSpectrum, useBand } from "../spectrum";
import Button from "./ui/Button";
import Notice from "./ui/Notice";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/heic"];

function Step({ n, label, state }) {
  const tag = { done: "Done", now: "Now", working: "Working", next: "Next", later: "Later" }[state];
  const active = state === "now" || state === "working";
  return (
    <li
      className={`grid grid-cols-[2rem_1fr_auto] items-center border-t-[1.5px] py-4 text-[15px] ${
        state === "later" ? "border-line text-ink-muted" : "border-ink"
      }`}
      aria-current={active ? "step" : undefined}
    >
      <span className="type-label text-lg">{n}</span>
      <span className={active ? "font-semibold" : ""}>{label}</span>
      <span className={`type-label text-[13px] ${state === "working" ? "animate-pulse" : ""}`}>{tag}</span>
    </li>
  );
}

export default function CameraCapture({ onUploadSuccess }) {
  const { deviceId } = useSession();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [colors, setColors] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  useBand(colors || HOUSE_BAND, uploading);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  function takeFile(next) {
    if (!next) return;
    if (next.size > MAX_BYTES) return setError("That photo is over 10 MB. Choose a smaller one.");
    if (!ALLOWED.includes(next.type)) return setError("That file type isn't supported. Use a JPEG, PNG or HEIC photo.");
    setError(null);
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setPreviewFailed(false);
    setColors(null);
    sampleSpectrum(next).then(setColors);
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
      if (colors) saveSpectrum(data.scan_id, colors);
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
          {uploading ? "Reading your shelf" : "Scan your shelf"}
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
          className={`relative mt-8 aspect-[3/2] overflow-hidden rounded-photo border-[1.5px] transition-colors ${
            dragging ? "border-ink bg-ink/6" : "border-line bg-surface"
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
              <ImagePlus className="size-9 text-ink-muted" strokeWidth={1.5} aria-hidden />
              <span className="text-[17px] font-semibold">
                {file ? "Preview unavailable in this browser" : "Drop a shelf photo here, or choose one"}
              </span>
              <span className="text-sm text-ink-muted">JPEG, PNG or HEIC · up to 10 MB</span>
            </button>
          )}
          {uploading && <ReadSweep />}
        </div>

        <div className="mt-3 flex min-h-5 justify-between gap-4 text-[13px] text-ink-muted">
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
        <ol>
          {steps.map(([label, state], i) => (
            <Step key={label} n={i + 1} label={label} state={state} />
          ))}
        </ol>
        <p className="mt-4 text-[13px] leading-relaxed text-ink-muted">
          {colors
            ? "The band above is your shelf, sampled from the photo."
            : "Choose a photo and the band above turns into your shelf's colours."}
        </p>
      </aside>
    </div>
  );
}
