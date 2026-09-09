import type { ErrorComponentProps } from "@tanstack/react-router";
import { isTransientShellError } from "@/components/game/shell-error";
import { GhostBtn } from "@/components/game/primitives";

const FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  const message = errorMessage(error);
  const transient = isTransientShellError(error instanceof Error ? error : { message });
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 bg-bg px-6 py-10 text-ink">
      <div className="font-mono text-micro tracking-widest text-risk">
        {transient ? "THRESHOLD — THIS SECTION DID NOT LOAD" : "THRESHOLD — THE INTERFACE STOPPED"}
      </div>
      <p className="text-sm leading-relaxed text-cream">
        {transient
          ? "A piece of the interface failed to load. Your run is still in the browser if you had begun."
          : "The interface hit an error before it could draw. Reloading usually restores a saved run."}
      </p>
      <pre className="max-h-48 overflow-auto rounded-sm border border-line bg-panel p-3 text-left font-mono text-2xs text-ink-muted">
        {message}
      </pre>
      <div>
        <GhostBtn filled tone="chip" onClick={() => window.location.reload()}>
          Reload
        </GhostBtn>
      </div>
    </main>
  );
}
