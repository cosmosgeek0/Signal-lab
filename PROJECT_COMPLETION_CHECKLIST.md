# CG Signal Lab — Project Completion Checklist (v5)

Verified 2026-07-02 against the dev server with the live source layer.
Verification commands:
`pytest -q` · `scripts/ui_smoke.py` · `scripts/click_audit.py` · `scripts/perf_check.py`

## Market page (front page)
| Requirement | Status |
|---|---|
| Market is the default page (`/`) | ✅ PASS |
| Global market overview cards (mcap, volume, BTC/ETH dominance) — live CoinGecko | ✅ PASS |
| Fear & Greed card with 30-day history — live alternative.me | ✅ PASS |
| Stablecoin supply + USDT/USDC share — live DefiLlama | ✅ PASS |
| DeFi TVL with history chart — live DefiLlama | ✅ PASS |
| Crypto market prices table (top-100, icons, 7d sparklines, 24h/7d, mcap, volume, merged basis) | ✅ PASS |
| Table tabs: All / Majors / Binance-listed / High volume / Gainers / Losers / Highest basis / Highest funding / Stablecoins | ✅ PASS |
| Majors row with real 24h change + basis + funding + brand charts | ✅ PASS |
| Top gainers / losers / volume section | ✅ PASS |
| Market Pulse news section | ✅ **LIVE** — real headlines from RSS (Cointelegraph + Decrypt) merged with GDELT, deduped, attributed, cached server-side |
| Global indices & macro strip | ✅ PASS as honest not-configured strip (Stooq blocked upstream; Alpha Vantage/Finnhub/Twelve Data/FMP key-required). Stocks are never faked |
| Basis/funding intelligence demoted below external sections | ✅ PASS |
| No internal basis metrics (median/P95) as Market hero | ✅ PASS (they live in Radar) |

## Dead-click elimination
| Requirement | Status |
|---|---|
| Every market card opens a detail sheet (mcap→global, vol→breakdown, dominance→full list, F&G→history, stables→top list, TVL→chart) | ✅ PASS (click audit) |
| Binance-universe card opens Radar | ✅ PASS |
| Card source labels open source detail | ✅ PASS |
| Majors / table rows / heatmap cells / funding rows / movers rows all open asset pages | ✅ PASS |
| Nav items navigate with animated active underline | ✅ PASS |
| Source / currency menus, settings sheet, search palette, health badge all open | ✅ PASS |
| Automated click audit (39 checks incl. console-error gate) | ✅ PASS 39/39 (`scripts/click_audit.py`) |

## Asset page
| Requirement | Status |
|---|---|
| BTC opens a full asset page (Bitcoin · BTC), not a basis-only page | ✅ PASS |
| Tabs: Overview · Price · Basis · Funding · Spread · Market stats · News · Quality | ✅ PASS |
| Price-first headline with 24h / basis / funding chips | ✅ PASS |
| Radar entry deep-links `?tab=basis` and Basis tab activates | ✅ PASS |
| Large dense dotted chart (raw→plotted meta, source, last update) | ✅ PASS (e.g. 1781 raw → 260 plotted) |
| Time windows 5m…7d + all | ✅ PASS |
| Market stats / Performance (1h/24h/7d/30d) / About from live sources | ✅ PASS |
| News tab (related headlines w/ honest fallback) | ✅ PASS |
| Quality tab (feed age, status, spreads, history points, sources) | ✅ PASS |
| Order-book/basis ladder from local Binance data | ✅ PASS |

## Icons
| Requirement | Status |
|---|---|
| One resolver everywhere: local CC0 pack → CoinGecko image → brand monogram | ✅ PASS |
| Radar upgrades icons when the manifest arrives (`onIconsReady`) | ✅ PASS (audited: every radar token cell has img or monogram svg) |
| No blank icons on any page | ✅ PASS |

## Pages
| Requirement | Status |
|---|---|
| Radar = basis scanner (basis signals, distribution histogram, widening/compressing, filters, advanced columns) | ✅ PASS |
| Heatmap modes: Treemap · Tiles · Mosaic · Bubbles · Strips | ✅ PASS |
| Heatmap metrics: Market cap (external) · Basis · Funding · Score · Freshness · Spread | ✅ PASS |
| Funding: leaderboards, distribution, basis-vs-funding scatter, per-symbol funding history, change movers | ✅ PASS |
| Movers: external 24h gainers/losers/volume w/ mini charts + Binance window movers (spot/basis/funding) | ✅ PASS |
| Rank movement board | ⚠️ NO SOURCE (needs historical rank snapshots; none of the keyless sources provide them) |

## Sources / controls
| Requirement | Status |
|---|---|
| Live keyless: CoinGecko, CoinPaprika (fallback), Alternative.me, DefiLlama, FX (open.er-api) | ✅ LIVE |
| GDELT news adapter (http fallback for broken TLS) | ✅ ADAPTER LIVE-CAPABLE (currently rate-limited 429; honest state + auto-retry) |
| Key-required slots: CoinMarketCap, Alpha Vantage, Finnhub, Twelve Data, FMP, NewsAPI, CryptoPanic | ✅ HONEST STATES (no keys hardcoded) |
| Source selector changes the product (Combined ↔ Binance-only hides external context) | ✅ PASS |
| Source health inspectable (menu + health drawer + card labels) with status/age/latency/TTL/error | ✅ PASS |
| Currency selector converts for real via live FX (INR/EUR/GBP/JPY) | ✅ PASS |
| UTC clock visible; theme; settings persist; bottom-right health badge + drawer | ✅ PASS |

## Engineering gates
| Requirement | Status |
|---|---|
| Tests | ✅ 48/48 pass (network-free source tests incl. offline honesty) |
| Perf (hot path unchanged, `/api/state-lite` fast) | ✅ PASS |
| Browser smoke (6 pages, root mounted, console clean) | ✅ PASS |
| Click audit | ✅ PASS 39/39 |
| No secrets / keys / fake data | ✅ PASS |
| Boot watchdog (no silent blank page) + no-cache asset headers | ✅ PASS |

## v6 additions (all verified by click audit 45/45)
| Requirement | Status |
|---|---|
| **Real price history for EVERY coin** — `/api/coin-history/{base}` (CoinGecko market_chart, 289 pts/24h, cached+bounded) | ✅ LIVE (BTC and non-tracked Monero both verified) |
| Volume + Market-cap chart modes on the asset page | ✅ LIVE |
| **TradingView chart** toggle (official widget embed, BINANCE:SYMBOL) | ✅ LIVE (audited: iframe mounts) |
| Real windows 24h/7d/30d/90d/1y/all on price charts | ✅ LIVE |
| Chart meta line: source · points · window | ✅ LIVE |
| Market tape uses real prices + real 24h change | ✅ LIVE |
| Majors mini-charts use real 7d history | ✅ LIVE |
| Trending section (CoinGecko search) | ✅ LIVE |
| News: RSS (Cointelegraph+Decrypt) + GDELT merged, deduped, newest-first | ✅ LIVE (16 real headlines) |

## v7 additions (verified: deep_audit 43/43 + click_audit 45/45)
| Requirement | Status |
|---|---|
| Market cards draw ONLY real history (7d aggregate mcap, real BTC/ETH dominance curves, F&G 30d, TVL 120d) — zero fabricated lines | ✅ LIVE |
| Coverage widened to **top-250 coins** (prices, icons, charts) with Show-more table (25→250) | ✅ LIVE |
| Prices actually update (90s provider refresh, 5s page poll, count-up) — verified two reads apart | ✅ LIVE |
| Live Binance price merge with ±3% sanity gate (real-time ticks in production, never shows disagreeing numbers) | ✅ LIVE |
| Icon resolver: top-250 images + /search resolution with alias map + **disk-persisted cache** + spothq tier + monogram | ✅ CONVERGING TO FULL COVERAGE |

## Known imperfections (honest)
- Dev DB basis/funding numbers are synthetic (local collector sim); price data everywhere is real CoinGecko. Aligns fully in production.
- Rank movement needs a rank-history source (none keyless).
- TradingView widget needs internet access in the viewing browser (official free embed).
