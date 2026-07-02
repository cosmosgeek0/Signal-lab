// Thin fetch layer over the existing backend JSON API. No contract changes.

async function json(url, { signal } = {}) {
  const res = await fetch(url, { signal, headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const qs = (obj) =>
  Object.entries(obj)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

export const api = {
  stateLite: (opt) => json("/api/state-lite", opt),
  radar: (filter = "all", limit = 500, opt) => json(`/api/radar?${qs({ filter, limit })}`, opt),
  sparks: (opt) => json("/api/sparks", opt),
  overview: (opt) => json("/api/overview", opt),
  marketOverview: (opt) => json("/api/market-overview", opt),
  coinProfile: (sym, opt) => json(`/api/coin-profile/${encodeURIComponent(sym)}`, opt),
  coinHistory: (base, days = "1", opt) => json(`/api/coin-history/${encodeURIComponent(base)}?${qs({ days })}`, opt),
  newsContext: (opt) => json("/api/news-context", opt),
  fx: (opt) => json("/api/fx", opt),
  iconManifest: (opt) => json("/api/icon-manifest", opt),
  sources: (opt) => json("/api/sources", opt),
  pages: (params, opt) => json(`/api/pages/markets?${qs(params)}`, opt),
  symbol: (sym, opt) => json(`/api/symbol/${encodeURIComponent(sym)}`, opt),
  history: (sym, window = "1h", opt) =>
    json(`/api/symbol/${encodeURIComponent(sym)}/history?${qs({ window })}`, opt),
  detail: (symbol, minutes = 60, opt) => json(`/api/detail?${qs({ symbol, minutes })}`, opt),
  heatmap: (mode = "basis", limit = 320, opt) => json(`/api/heatmap?${qs({ mode, limit })}`, opt),
  funding: (opt) => json("/api/funding", opt),
  movers: (minutes = 5, opt) => json(`/api/movers?${qs({ minutes })}`, opt),
  opportunities: (opt) => json("/api/opportunities", opt),
  search: (q, limit = 12, opt) => json(`/api/search?${qs({ q, limit })}`, opt),
  health: (opt) => json("/api/health", opt),
  perf: (opt) => json("/api/perf", opt),
};
