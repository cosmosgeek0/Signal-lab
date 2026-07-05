# DESIGN CONTEXT — signallab (craft summary; ../PROJECT_CONTEXT.md at repo root is the FULL purpose bible and OUTRANKS this file)

WHAT THIS IS: CosmosGeek Radar — a PUBLIC market-intelligence terminal. Keyless
public data only, no accounts, research-only. World markets + crypto + spot/perp
basis & funding intelligence + a fast live news wire.

WHO IT IS FOR: finance people. They come for information density done beautifully —
one glance = state of the market. Not a toy, not an art piece, not a Coinbase clone.

THE BAR: craft of Apple/1Password (spacing, hairlines, type discipline, restraint)
carrying the content of the best finance surfaces (TradingView markets pages,
Coinbase clarity, Glassnode/Coinglass charts, DefiLlama boards, Dune dashboards).

CURRENT STATE (honest): good bones — live data everywhere, real logos, world board,
wire desk, gates. Diseases to kill: billboard headlines, word-soup grey subtitle
lines, glossy-box overuse, layouts that never change, dead-feeling controls
(frozen UTC clock), inconsistent weights/spacing when zoomed.

WHAT "DONE" LOOKS LIKE: every region deliberate at 200% zoom; structure from
whitespace + hairlines; numbers tick and flash; every control does something;
TradFi and crypto cleanly separated; a finance pro says "this is the cleanest
data terminal I've seen" — and it still looks unmistakably like a finance product.


## REFERENCE WALL (the EXACT stack — owner-fixed, rescue + forever)
- TradingView — market overview, heatmaps, chart workspace, watchlists. Heatmaps
  use size + color to show data and outliers: what our heatmap/bubbles must learn from.
- Binance Markets — clean market overview: Hot, New, Top Gainer, Top Volume,
  categories, prices, 24h changes.
- Coinbase Explore — clean prices table: asset, price, chart, change, market cap,
  volume, actions.
- Uniswap Explore — separates tokens, pools, transactions; real-time prices,
  volume, TVL, charts, transaction data.
- CoinGlass — derivatives analytics: open interest, funding rates, liquidation
  heatmaps, options/spot/derivatives data.
- Coinalyze — futures analytics: open interest, funding, liquidations, long/short
  ratio, basis, futures statistics.
- DeFiLlama — TVL, fees, revenue, volume, yields, stablecoins, protocols, chains.
- CoinGecko — market/prices data source; simple-price and coins/markets endpoints.
- Pyth Terminal — clean price-feed catalogue across crypto, equities, FX, commodities.
- Kraken Pro / Kraken Desktop — serious trading interface: active-trader layout,
  multi-window market surfaces.
- Hyperliquid — trading venue: perp/spot markets, clean trading surfaces.
LAW: Signal Lab stays PUBLIC-ONLY — no Binance keys, no trading, no execution, no secrets.

## INTERNAL REFERENCES (owner verdicts)
- FUNDING page = internal style BASELINE: big clear title, fewer gimmicks, readable
  grouped sections. Bring other pages toward it.
- BUBBLES: keep the idea, cut the toy-green look — restraint.
- DATA HEALTH drawer: useful info, too noisy — compress hard.
- HEATMAP/LIQUIDATIONS: broken by repeated waiting/warming placeholders — hide/compress.
- INDICES: dash-filled cards — real data or compact source states, never dashes.
- MOVERS: "0 exchange symbols moved" reads broken — stale source ⇒ compact stale
  state, never a fake full dashboard.

## RESCUE RULES
Dead UI is the enemy: every dash, every duplicate LIVE/stale chip, every giant
empty panel is a bug. Missing data = small honest chip, not furniture. Pages are
rescued whole, one per run, in FEATURE_QUEUE.md order.

## SPRINT-2 LAWS (owner, 2026-07-05)
- NO-LINES LAW: stop outlining everything. No competitor draws hairlines around
  every element. Structure = whitespace + type hierarchy; borders only where a
  table genuinely needs row separation. Remove existing line litter on sight.
- NO-BOX-WALL LAW: dark mode must not read as "everything became a box". Sections
  breathe on the canvas; cards are rare and earn their existence. Token/asset page
  is the worst offender — rebuild toward CoinMarketCap/CoinGecko/TradingView symbol
  pages, not box grids.
- HEADER TRUTH: every header control works — currency selector present, live
  status meaningful, tape logos+prices all real and ticking. A dead control in the
  header is a P0 bug.
