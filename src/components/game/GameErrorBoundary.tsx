import { Component, type ErrorInfo, type ReactNode } from "react";
import { clearLocal, hasLocalSave } from "@/game";
import { GhostBtn } from "./primitives";
import { isTransientShellError } from "./shell-error";

type Props = { children: ReactNode };
type State = { error: Error | null; info: string };

/**
 * Last line of defense for the game shell. A render throw otherwise unmounts the tree and the
 * player sees a blank page with no way to recover. This keeps the save, shows the error, and
 * offers the two safe exits.
 */
export class GameErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: "" };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info: (info.componentStack ?? "").split("\n").slice(0, 6).join("\n") });
    try {
      localStorage.setItem(
        "threshold.lastCrash",
        JSON.stringify({
          at: new Date().toISOString(),
          message: error.message,
          stack: error.stack,
          component: info.componentStack,
        }),
      );
    } catch {
      /* ignore */
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    const saved = hasLocalSave();
    const transient = isTransientShellError(this.state.error);
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 px-6 py-10 text-ink">
        <div className="font-mono text-micro tracking-widest text-risk">
          {transient ? "THRESHOLD — THIS SECTION DID NOT LOAD" : "THRESHOLD — UNRECOVERABLE RENDER ERROR"}
        </div>
        <p className="text-sm leading-relaxed text-cream">
          {transient
            ? "A floor of the interface failed to load. The run is intact."
            : "The interface hit an error it could not draw its way out of."}{" "}
          {saved ? "Your last committed quarter is still saved; reloading will offer Continue." : "No save was found."}
        </p>
        <pre className="max-h-48 overflow-auto rounded-sm border border-line bg-panel p-3 font-mono text-2xs text-ink-muted">
          {this.state.error.message}
          {this.state.info ? "\n" + this.state.info : ""}
        </pre>
        <div className="flex flex-wrap gap-2">
          <GhostBtn filled tone="chip" onClick={() => window.location.reload()}>
            Reload{saved ? " and continue" : ""}
          </GhostBtn>
          <GhostBtn
            tone="ink"
            onClick={() => {
              clearLocal();
              window.location.reload();
            }}
          >
            Discard save and reload
          </GhostBtn>
        </div>
        <p className="font-mono text-2xs text-ink-faint">
          The error is also stored under localStorage key threshold.lastCrash for a bug report.
        </p>
      </main>
    );
  }
}

type ViewProps = { name: string; children: ReactNode };
type ViewState = { error: Error | null };

/** A thrown tab must not unmount the rest of the run. Switching sections clears it. */
export class ViewErrorBoundary extends Component<ViewProps, ViewState> {
  state: ViewState = { error: null };

  static getDerivedStateFromError(error: Error): Partial<ViewState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    try {
      localStorage.setItem(
        "threshold.lastCrash",
        JSON.stringify({
          at: new Date().toISOString(),
          view: this.props.name,
          message: error.message,
          stack: error.stack,
          component: info.componentStack,
        }),
      );
    } catch {
      /* ignore */
    }
  }

  componentDidUpdate(prev: ViewProps) {
    if (prev.name !== this.props.name && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="rounded-lg border border-line bg-panel p-4" role="alert">
        <div className="font-mono text-micro tracking-widest text-risk">{this.props.name} could not be drawn</div>
        <p className="mt-2 text-sm leading-relaxed text-cream">
          The rest of the run is intact. Switch sections, or try this one again.
        </p>
        <pre className="mt-3 max-h-32 overflow-auto rounded-sm border border-line bg-bg p-3 font-mono text-2xs text-ink-muted">
          {this.state.error.message}
        </pre>
        <div className="mt-3">
          <GhostBtn onClick={() => this.setState({ error: null })}>Try again</GhostBtn>
        </div>
      </section>
    );
  }
}
