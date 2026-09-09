import { Component, type ErrorInfo, type ReactNode } from "react";
import { clearLocal, hasLocalSave } from "@/game";
import { GhostBtn } from "./primitives";

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
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 px-6 py-10 text-ink">
        <div className="font-mono text-micro tracking-widest text-risk">THRESHOLD — UNRECOVERABLE RENDER ERROR</div>
        <p className="text-sm leading-relaxed text-cream">
          The interface hit an error it could not draw its way out of.{" "}
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
