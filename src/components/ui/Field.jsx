export const inputClass =
  "h-11 w-full rounded-[4px] border border-line bg-raised px-3.5 text-[15px] text-ink placeholder:text-ink-muted transition-colors hover:border-ink-muted focus:border-ink";

export default function Field({ id, label, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
