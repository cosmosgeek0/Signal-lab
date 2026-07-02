// Number / price / time formatting. Everything tabular-friendly.

const QUOTES = ["USDT", "USDC", "BUSD", "FDUSD", "TUSD", "USD"];

export function baseOf(symbol) {
  const s = String(symbol || "").toUpperCase();
  for (const q of QUOTES) if (s.endsWith(q) && s.length > q.length) return s.slice(0, -q.length);
  return s;
}
export function quoteOf(symbol) {
  const s = String(symbol || "").toUpperCase();
  for (const q of QUOTES) if (s.endsWith(q) && s.length > q.length) return q;
  return "";
}

const commas = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---- display currency -------------------------------------------------------
// USD/USDT is the native quote. Other currencies apply ONLY when a live FX
// rate exists (set from /api/fx) — the UI never pretends to convert.
const CUR_SYM = { USD: "", INR: "₹", EUR: "€", GBP: "£", JPY: "¥" };
let _fx = { cur: "USD", rate: 1 };
export function setDisplayCurrency(cur, rate) {
  if (cur === "USD" || !isFinite(rate) || rate <= 0) _fx = { cur: "USD", rate: 1 };
  else _fx = { cur, rate };
}
export function displayCurrency() { return _fx.cur; }

// Adaptive price precision, exchange-style. Applies the display currency.
export function fmtPrice(v) {
  const n = Number(v) * _fx.rate;
  if (!isFinite(n) || n === 0) return "—";
  const a = Math.abs(n);
  let d;
  if (a >= 1000) d = 2;
  else if (a >= 1) d = a >= 100 ? 2 : 3;
  else if (a >= 0.1) d = 4;
  else if (a >= 0.001) d = 6;
  else d = 8;
  return (CUR_SYM[_fx.cur] || "") + n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtUsd(v) {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return "$" + fmtPrice(n);
}

// Compact money for market cap / volume (currency-aware).
export function fmtMoney(v) {
  const n = Number(v) * _fx.rate;
  if (!isFinite(n)) return "—";
  const sym = CUR_SYM[_fx.cur] || "$";
  const prefix = _fx.cur === "USD" ? "$" : sym;
  return prefix + Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(n);
}

// Basis points, 1–2 decimals depending on size.
export function fmtBps(v, withSign = false) {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  const d = Math.abs(n) >= 100 ? 1 : 2;
  const s = n.toFixed(d);
  return (withSign && n > 0 ? "+" : "") + s;
}

// Funding rate stored as per-interval fraction -> percent.
export function fmtFunding(rate, withSign = true) {
  const n = Number(rate);
  if (!isFinite(n)) return "—";
  const pct = n * 100;
  const s = pct.toFixed(4);
  return (withSign && pct > 0 ? "+" : "") + s + "%";
}

export function fmtPct(v, digits = 2, withSign = true) {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  const s = n.toFixed(digits);
  return (withSign && n > 0 ? "+" : "") + s + "%";
}

export function fmtScore(v) {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return n.toFixed(1);
}

export function fmtAge(sec) {
  const n = Number(sec);
  if (!isFinite(n)) return "—";
  if (n < 1) return "<1s";
  if (n < 60) return Math.round(n) + "s";
  if (n < 3600) return Math.round(n / 60) + "m";
  return (n / 3600).toFixed(1) + "h";
}

export function fmtCompact(v) {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

const pad = (x) => String(x).padStart(2, "0");
export function fmtClock(ts_ms) {
  if (!ts_ms) return "—";
  const d = new Date(Number(ts_ms));
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}
export function fmtTimeShort(ts_ms) {
  const d = new Date(Number(ts_ms));
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
export function fmtDateTime(ts_ms) {
  if (!ts_ms) return "—";
  const d = new Date(Number(ts_ms));
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()];
  return `${mon} ${d.getUTCDate()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
export function ago(sec) {
  const n = Number(sec);
  if (!isFinite(n)) return "—";
  if (n < 2) return "just now";
  if (n < 60) return Math.round(n) + "s ago";
  if (n < 3600) return Math.round(n / 60) + "m ago";
  return (n / 3600).toFixed(1) + "h ago";
}

// "3m ago" style relative time from an ISO string.
export function timeAgo(iso) {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!isFinite(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 90) return "now";
  if (s < 3600) return Math.round(s / 60) + "m ago";
  if (s < 86400) return Math.round(s / 3600) + "h ago";
  return Math.round(s / 86400) + "d ago";
}

export function signClass(v) {
  const n = Number(v);
  if (!isFinite(n) || n === 0) return "";
  return n > 0 ? "up" : "down";
}

// The signed basis for a row: positive = perp rich vs spot.
export function signedBasis(row) {
  return Number(row.mid_spread_bps ?? row.spot_to_perp_bps ?? 0);
}

// Basis display honors the user's unit preference (bps default, % optional).
import { getSettings } from "./settings.js";
export function basisUnit() { return getSettings().basisUnit === "pct" ? "%" : "bps"; }
export function fmtBasisVal(bps, withSign = false) {
  const n = Number(bps);
  if (!isFinite(n)) return "—";
  if (getSettings().basisUnit === "pct") {
    const p = n / 100;
    return (withSign && p > 0 ? "+" : "") + p.toFixed(Math.abs(p) >= 1 ? 2 : 3);
  }
  return fmtBps(n, withSign);
}
