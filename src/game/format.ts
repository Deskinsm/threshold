export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export function money(n: number | null | undefined) {
  if (n === undefined || n === null || Number.isNaN(n)) return "$0";
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e12) return sign + "$" + (a / 1e12).toFixed(2) + "T";
  if (a >= 1e9) return sign + "$" + (a / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return sign + "$" + (a / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return sign + "$" + (a / 1e3).toFixed(0) + "K";
  return sign + "$" + Math.round(a);
}

export function num(n: number | null | undefined) {
  if (n === undefined || n === null || Number.isNaN(n)) return "0";
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e9) return sign + (a / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return sign + (a / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return sign + (a / 1e3).toFixed(1) + "K";
  return sign + Math.round(a).toLocaleString();
}

export function mw(n: number) {
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(2) + " GW";
  return n.toFixed(n >= 10 ? 0 : 1) + " MW";
}

export function pct(n: number, digits = 1) {
  return (n * 100).toFixed(digits) + "%";
}

export function clone<T>(x: T): T {
  return structuredClone(x);
}

export function finite(n: number) {
  return Number.isFinite(n) && !Number.isNaN(n);
}

export function formatSeed(n: number) {
  return (n >>> 0).toString(16).padStart(8, "0");
}

export function parseSeed(input: string): number | null {
  const t = input.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{1,8}$/.test(t)) return null;
  const n = Number.parseInt(t, 16);
  if (!Number.isFinite(n)) return null;
  return n >>> 0;
}

export function randomSeed() {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0]!;
  }
  return (Math.random() * 0xffffffff) >>> 0;
}
