export const SANDBOX_LOAD_ERROR = "The expansion sandbox could not be loaded.";
export const SANDBOX_DEMO_URL = "/expansion-demo.json";

export type SandboxFetchResult =
  | { status: "ready"; text: string }
  | { status: "ignored" }
  | { status: "error"; reason: string };

export type SandboxFetch = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<{ ok: boolean; text: () => Promise<string> }>;

function isAbortError(err: unknown) {
  return !!err && typeof err === "object" && "name" in err && (err as { name: string }).name === "AbortError";
}

/** In-flight sandbox download. Cancelled or superseded requests never commit. */
export class SandboxLoader {
  private gen = 0;
  private abort: AbortController | null = null;
  private fetchImpl: SandboxFetch;
  private url: string;

  constructor(fetchImpl: SandboxFetch, url = SANDBOX_DEMO_URL) {
    this.fetchImpl = fetchImpl;
    this.url = url;
  }

  get generation() {
    return this.gen;
  }

  /** Begin, continue, import, and Cancel all call this so a late download cannot commit. */
  cancel() {
    this.gen += 1;
    this.abort?.abort();
    this.abort = null;
  }

  async load(): Promise<SandboxFetchResult> {
    const gen = ++this.gen;
    this.abort?.abort();
    const ac = new AbortController();
    this.abort = ac;
    try {
      const fetchImpl = this.fetchImpl;
      const res = await fetchImpl(this.url, { signal: ac.signal });
      if (gen !== this.gen) return { status: "ignored" };
      if (!res.ok) return { status: "error", reason: SANDBOX_LOAD_ERROR };
      const text = await res.text();
      if (gen !== this.gen) return { status: "ignored" };
      return { status: "ready", text };
    } catch (err) {
      if (gen !== this.gen) return { status: "ignored" };
      if (isAbortError(err)) return { status: "ignored" };
      return { status: "error", reason: SANDBOX_LOAD_ERROR };
    }
  }
}
