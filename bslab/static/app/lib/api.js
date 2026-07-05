// Thin fetch layer over the existing backend JSON API. No contract changes.

function xhrJson(url, { signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.setRequestHeader("accept", "application/json");
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`${xhr.status} ${url}`));
        return;
      }
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch (e) {
        reject(new Error(`invalid json ${url}`));
      }
    };
    xhr.onerror = () => reject(new Error(`network ${url}`));
    xhr.ontimeout = () => reject(new Error(`timeout ${url}`));
    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        reject(new Error(`aborted ${url}`));
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    xhr.send();
  });
}

async function json(url, { signal } = {}) {
  if (typeof fetch === "function") {
    const res = await fetch(url, { signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json();
  }
  if (typeof XMLHttpRequest === "function") return xhrJson(url, { signal });
  throw new Error(`No browser HTTP client available for ${url}`);
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
  coinHistory: (base, days = "1", symbol = "", opt) =>
    json(`/api/coin-history/${encodeURIComponent(base)}?${qs({ days, symbol })}`, opt),
  newsContext: (limit = 42, opt) => json(`/api/news-context?${qs({ limit })}`, opt),
  fx: (opt) => json("/api/fx", opt),
  iconManifest: (opt) => json("/api/icon-manifest", opt),
  sources: (opt) => json("/api/sources", opt),
  binanceCoverage: (opt) => json("/api/binance-coverage", opt),
  pages: (params, opt) => json(`/api/pages/markets?${qs(params)}`, opt),
  symbol: (sym, opt) => json(`/api/symbol/${encodeURIComponent(sym)}`, opt),
  history: (sym, window = "1h", opt) =>
    json(`/api/symbol/${encodeURIComponent(sym)}/history?${qs({ window })}`, opt),
  detail: (symbol, minutes = 60, opt) => json(`/api/detail?${qs({ symbol, minutes })}`, opt),
  heatmap: (mode = "basis", limit = 320, opt) => json(`/api/heatmap?${qs({ mode, limit })}`, opt),
  derivatives: (window = "4h", limit = 120, opt) => json(`/api/derivatives?${qs({ window, limit })}`, opt),
  funding: (opt) => json("/api/funding", opt),
  movers: (minutes = 5, opt) => json(`/api/movers?${qs({ minutes })}`, opt),
  bubbles: (asset = "crypto", window = "24h", limit = 100, opt) =>
    json(`/api/bubbles?${qs({ asset, window, limit })}`, opt),
  opportunities: (opt) => json("/api/opportunities", opt),
  search: (q, limit = 12, opt) => json(`/api/search?${qs({ q, limit })}`, opt),
  health: (opt) => json("/api/health", opt),
  perf: (opt) => json("/api/perf", opt),
};
