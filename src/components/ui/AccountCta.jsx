import { Lock } from "lucide-react";
import Button from "./Button";
import StatusView from "./StatusView";

// Offered only where there is something to keep. "inline" sits under anon
// results; "gate" replaces a login-only page.
export default function AccountCta({ variant = "inline", title, children }) {
  const actions = (
    <>
      <Button to="/signup">Create account</Button>
      <Button to="/login" variant="secondary">
        Log in
      </Button>
    </>
  );

  if (variant === "gate") {
    return (
      <StatusView icon={Lock} title={title} actions={actions}>
        {children}
      </StatusView>
    );
  }

  return (
    <section className="flex flex-col gap-5 border-t-[1.5px] border-ink pt-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-xl">
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">{children}</p>
      </div>
      <div className="flex shrink-0 gap-3">{actions}</div>
    </section>
  );
}
