# PROJECT_CONTEXT.md — CosmosGeek Radar (signallab). THE PURPOSE BIBLE.
# Outranks every other design file. Read FIRST, every run, before any photo.

## 1. WHY THIS EXISTS
The owner's private arbitrage cockpit makes the money and can never be shown.
THIS is the public proof of craft: a global market-data platform that represents
data better than anyone else. Ambition: what TradingView's Markets section covers,
represented with more taste. It must look like a serious company built it.

## 2. THE #1 DISEASE: BINANCE BIAS. KILL IT.
The site began on Binance data and stayed mentally stuck there ("96 pairs",
Binance-second-everywhere, crypto tape on a global page, dead source selectors).
LAW: this is a GLOBAL, exchange-neutral platform. "Combined" is the only primary
source. Binance is one provider among many. Any surface that leads with Binance,
counts "pairs", or greys out non-Binance sources is broken by definition.

## 3. INFORMATION ARCHITECTURE v2 (owner order 2026-07-05 — REPLACES the old §3 nav)
TOP BAR (left→right): logo · GLOBAL · CRYPTO · [spacer] · search · data health ·
theme · preferences. NOTHING ELSE. No 11-tab strip, no top hairline, no compressed
controls. Category pills got fired: hovering/clicking GLOBAL opens a clean popup
listing Indices / US stocks / World stocks / Futures & commodities / Crypto — click
navigates to that section. CRYPTO opens its popup: Prices / Basis radar / Heatmap /
Bubbles / Funding / Movers.
THE GLOBAL PAGE (the front page, one page): built EXACTLY like tradingview.com/markets
structure — sequential sections, each with a real chart + clean rows: Indices →
US stocks → World stocks → Crypto (ONE section, no memecoin trending scatter, no
majors duplicated below) → Futures & commodities. Charts are OUR charts (theme-
following); never a black embed box in light mode. Nothing "unavailable" renders as
furniture. NEWS lives ONLY on the front page right rail, properly designed
(formatting, spacing, favicons, hierarchy) — crypto tool pages show crypto context,
not the global news dump.
SEARCH: TradingView-style modal — categories (assets, pages), keyboard-first, real
results with logos.
SETTINGS/PREFERENCES: compact side placement; the 1Password-clone menu (General/
Appearance/Data/Security/Privacy/Developer/Labs) is DEAD — we are not a password
manager. Only settings that DO something.
REFERENCES for every sprint-2 card: tradingview.com/markets ·
binance.com/en/markets/overview · coinglass.com · coinmarketcap.com · defillama.com ·
coingecko.com.

## 4. LOGOS ARE NON-NEGOTIABLE
Real index logos (S&P 500, Nasdaq, Dow — never letter-circles "500/100/D").
Token logos at scale — top 6,000 via CoinGecko/CMC/CoinPaprika chains, not 100.
A missing logo is a bug.

## 5. TICKER INTERACTIONS (everywhere)
Hover any ticker → summary card pops (price, chart sliver, key stats, what it is).
Click → full asset page: the best blend of Coinbase's asset page (cleanliness),
TradingView symbol page (interactivity), CMC/CoinGecko (depth: volume, exchanges,
supply). Full chart with all windows. Everything interactive, nothing dead.

## 6. THE OTHER PAGES (names are NOT sacred — rename/merge/kill freely)
Current names (Market/Radar/Heatmap/Bubbles/Funding/Movers) are placeholders, not
law. Rethink them every run; keeping a bad name because it exists is the disease.
- RADAR (purpose): granular per-token microstructure across ALL exchanges —
  combined sources, basis, spreads, coverage counts that mean something. Not a
  Binance monitor.
- HEATMAP: Coinglass/exchange-grade breadth map. Study how Coinglass, Binance,
  and exchanges represent theirs; beat them on clarity.
- BUBBLES: CryptoBubbles-grade — physical, animated, interactive, stocks AND
  crypto. If it doesn't feel alive it isn't done. Study the real one, feel it.
- FUNDING: the owner personally needs this for the arbitrage work: funding rates,
  open interest, liquidations (24h), long/short ratios, per-exchange comparison —
  Coinglass DATA with better-than-Coinglass representation (their UI is cramped;
  ours is dense AND beautiful).

## 7. REPRESENTATION DOCTRINE
Data is never slapped. Every number: hierarchy, units, motion when it changes.
Middle ground: not naked number dumps, not over-graphic toys — a finance pro
reads the state in one glance. References to actually LOOK at each run:
TradingView (global markets structure), Coinbase (cleanliness, asset pages,
charts), Uniswap (token/stock cards), Binance (functional density), Coinglass
(derivatives data), DefiLlama, Dune, CoinGecko, CoinMarketCap. Whitespace +
hairlines carry structure; glass/gloss is a rare accent (check dark mode EVERY
run — the shiny-bullet disease lives there). Thin type by default.

## 8. THE 100-RUN RECOVERY PLAN (how work proceeds)
This site will NOT be rebuilt from scratch and will NOT be fixed in one pass.
Each run, BEFORE any photo: compare one region against the reference sites, fix
what is broken there, and go ONE LEVEL DEEPER than the previous run went
(page → section → component → control → state). Record your depth in TASTE_LOG.
Surface first, deeper every run, 100 runs = the recovery. Hill-climb: try,
keep if better, revert if not. Never leave the site looking the same as you
found it.
