// Market — the landing page, rebuilt as a true global market overview.
// Order: Global category + market-size cards → live chart/tape → news wire →
// active market board → crypto/derivatives only when that section is selected.
// Every panel is labeled with its source and degrades honestly when a source is down.

import { h, mount } from "../lib/dom.js";
import { icon, tokenIcon, coinIcon, brandColor, starIcon, onIconsReady } from "../lib/icons.js";
import { api } from "../lib/api.js";
import { store, onLive, onTheme, navigate, linkTo } from "../lib/store.js";
import { getSettings, setSetting, onSettings } from "../lib/settings.js";
import {
  baseOf, fmtPrice, fmtMoney, fmtBps, fmtBasisVal, basisUnit, fmtFunding, fmtScore,
  fmtPct, signClass, fmtCompact, timeAgo,
} from "../lib/format.js";
import { sparkline, sparkArea } from "../lib/chart.js";
import { countUp } from "../lib/motion.js";
import { buildCoinsTape } from "../ui/tape.js";
import { attachPopover, popRow } from "../ui/popover.js";
import { openDetailSheet, sheetRow, sheetNote, sheetChart, sheetTitle } from "../ui/sheets.js";
import { openDataSheet } from "../ui/drawer.js";
import { openSettingsSheet } from "../ui/settings.js";

// Card mini-charts use ONLY real history (7d aggregate mcap/dominance, F&G
// 30d, TVL 120d). Cards without an honest series show no line at all.

const TABS = [
  { id: "all", label: "All assets" },
  { id: "majors", label: "Majors" },
  { id: "stocks", label: "Stocks" },
  { id: "binance", label: "Exchange listed" },
  { id: "volume", label: "High volume" },
  { id: "gainers", label: "Top gainers" },
  { id: "losers", label: "Top losers" },
  { id: "basis", label: "Highest basis" },
  { id: "funding", label: "Highest funding" },
  { id: "stable", label: "Stablecoins" },
];
// Basis is Radar's specialty — on the Market page it only appears on the tabs
// where it IS the point (Exchange-listed / basis / funding).
const BASIS_TABS = new Set(["binance", "basis", "funding"]);
const MAJOR_BASES = new Set(["BTC", "ETH", "BNB", "SOL", "XRP", "DOGE"]);
const STABLE_BASES = new Set(["USDT", "USDC", "DAI", "FDUSD", "USDS", "USDE", "TUSD", "PYUSD", "USD1"]);
const ATLAS_RANGES = [
  ["1D", "1D"], ["1M", "1M"], ["3M", "3M"], ["12M", "1Y"], ["60M", "5Y"], ["ALL", "All"],
];
const MARKET_ATLAS_CATEGORIES = [
  {
    id: "global",
    label: "Global",
    title: "Global markets",
    lead: "World indices, stocks, FX, rates, futures, bonds and crypto context in one exchange-neutral surface.",
    primary: "FOREXCOM:SPXUSD",
    range: "12M",
    symbols: [
      { s: "FOREXCOM:SPXUSD", d: "S&P 500", short: "SPX", badge: "500", wordLogo: "S&P 500", logo: "indices/s-and-p-500", yahoo: "^GSPC", tone: "red" },
      { s: "NASDAQ:NDX", d: "Nasdaq 100", short: "NDX", badge: "100", wordLogo: "Nasdaq 100", logo: "indices/nasdaq-100", yahoo: "^IXIC", tone: "blue" },
      { s: "DJ:DJI", d: "Dow 30", short: "DJI", badge: "30", wordLogo: "Dow Jones", logo: "indices/dow-30", yahoo: "^DJI", tone: "cyan" },
      { s: "TVC:DXY", d: "US Dollar index", short: "DXY", badge: "$", logo: "indices/u-s-dollar-index", yahoo: "DX-Y.NYB", tone: "green" },
      { s: "TVC:US10Y", d: "US 10Y yield", short: "US10Y", badge: "10Y", logo: "country/US", yahoo: "^TNX", tone: "green" },
      { s: "TVC:GOLD", d: "Gold", short: "GOLD", badge: "Au", logo: "metal/gold", yahoo: "GC=F", tone: "gold" },
      { s: "NYMEX:CL1!", d: "WTI crude oil", short: "WTI", badge: "Oil", logo: "crude-oil", yahoo: "CL=F", tone: "ink" },
      { s: "TVC:NI225", d: "Japan 225", short: "NI225", badge: "225", wordLogo: "Nikkei 225", logo: "indices/nikkei-225", tone: "navy" },
    ],
    groups: [
      ["Index spine", ["FOREXCOM:SPXUSD", "NASDAQ:NDX", "DJ:DJI", "TVC:NI225"]],
      ["Macro pressure", ["TVC:DXY", "TVC:US10Y", "TVC:GOLD", "NYMEX:CL1!"]],
    ],
  },
  {
    id: "indices",
    label: "Indices",
    title: "Indices",
    lead: "S&P 500, Nasdaq, Dow and world benchmark indices.",
    primary: "FOREXCOM:SPXUSD",
    range: "ALL",
    symbols: [
      { s: "FOREXCOM:SPXUSD", d: "S&P 500", short: "SPX", badge: "500", wordLogo: "S&P 500", logo: "indices/s-and-p-500", yahoo: "^GSPC", tone: "red" },
      { s: "NASDAQ:NDX", d: "Nasdaq 100", short: "NDX", badge: "100", wordLogo: "Nasdaq 100", logo: "indices/nasdaq-100", yahoo: "^IXIC", tone: "blue" },
      { s: "DJ:DJI", d: "Dow 30", short: "DJI", badge: "30", wordLogo: "Dow Jones", logo: "indices/dow-30", yahoo: "^DJI", tone: "cyan" },
      { s: "TVC:RUT", d: "US 2000 small cap", short: "RUT", badge: "2000", wordLogo: "Russell 2000", logo: "indices/russell-2000", yahoo: "^RUT", tone: "wine" },
      { s: "TVC:NI225", d: "Japan 225", short: "NI225", badge: "225", wordLogo: "Nikkei 225", logo: "indices/nikkei-225", tone: "navy" },
      { s: "TVC:UKX", d: "FTSE 100", short: "UKX", badge: "100", wordLogo: "FTSE 100", logo: "indices/uk-100", tone: "steel" },
      { s: "XETR:DAX", d: "DAX", short: "DAX", badge: "D", wordLogo: "DAX", logo: "indices/dax", tone: "blue" },
    ],
    groups: [
      ["US indices", ["FOREXCOM:SPXUSD", "NASDAQ:NDX", "DJ:DJI", "TVC:RUT"]],
      ["World indices", ["TVC:NI225", "TVC:UKX", "XETR:DAX"]],
    ],
  },
  {
    id: "us-stocks",
    label: "US stocks",
    title: "US stocks",
    lead: "Large-cap US equities with brand marks and a full-history chart.",
    primary: "NASDAQ:NVDA",
    range: "ALL",
    symbols: [
      { s: "NASDAQ:NVDA", d: "NVIDIA", short: "NVDA", logo: "nvidia", yahoo: "NVDA" },
      { s: "NASDAQ:AAPL", d: "Apple", short: "AAPL", logo: "apple", yahoo: "AAPL" },
      { s: "NASDAQ:AMZN", d: "Amazon", short: "AMZN", logo: "amazon", yahoo: "AMZN" },
      { s: "NASDAQ:GOOGL", d: "Alphabet", short: "GOOGL", logo: "alphabet", yahoo: "GOOGL" },
      { s: "NASDAQ:MSFT", d: "Microsoft", short: "MSFT", logo: "microsoft", yahoo: "MSFT" },
      { s: "NASDAQ:TSLA", d: "Tesla", short: "TSLA", logo: "tesla", yahoo: "TSLA" },
    ],
    groups: [
      ["Highest attention", ["NASDAQ:NVDA", "NASDAQ:AAPL", "NASDAQ:AMZN"]],
      ["Mega-cap tape", ["NASDAQ:GOOGL", "NASDAQ:MSFT", "NASDAQ:TSLA"]],
    ],
  },
  {
    id: "world-stocks",
    label: "World stocks",
    title: "World stocks",
    lead: "Global leaders across US, Europe, Japan, Taiwan and Saudi markets.",
    primary: "NASDAQ:MSFT",
    range: "ALL",
    symbols: [
      { s: "NASDAQ:MSFT", d: "Microsoft", short: "MSFT", logo: "microsoft", yahoo: "MSFT" },
      { s: "NYSE:TSM", d: "TSMC", short: "TSM", logo: "taiwan-semiconductor", yahoo: "TSM" },
      { s: "EURONEXT:MC", d: "LVMH", short: "MC", logo: "lvmh" },
      { s: "TADAWUL:2222", d: "Saudi Aramco", short: "2222", logo: "saudi-aramco" },
      { s: "NYSE:TM", d: "Toyota", short: "TM", logo: "toyota", yahoo: "TM" },
      { s: "NASDAQ:ASML", d: "ASML", short: "ASML", logo: "asml", yahoo: "ASML" },
    ],
    groups: [
      ["World biggest companies", ["NASDAQ:MSFT", "NYSE:TSM", "EURONEXT:MC"]],
      ["Global industrials", ["TADAWUL:2222", "NYSE:TM", "NASDAQ:ASML"]],
    ],
  },
  {
    id: "crypto",
    label: "Crypto",
    title: "Crypto",
    lead: "Crypto stays separated from TradFi: spot, market cap and chain liquidity.",
    primary: "BINANCE:BTCUSDT",
    range: "12M",
    symbols: [
      { s: "BINANCE:BTCUSDT", d: "Bitcoin", short: "BTC", base: "BTC" },
      { s: "BINANCE:ETHUSDT", d: "Ethereum", short: "ETH", base: "ETH" },
      { s: "BINANCE:BNBUSDT", d: "BNB", short: "BNB", base: "BNB" },
      { s: "BINANCE:SOLUSDT", d: "Solana", short: "SOL", base: "SOL" },
      { s: "BINANCE:XRPUSDT", d: "XRP", short: "XRP", base: "XRP" },
      { s: "CRYPTOCAP:TOTAL", d: "Crypto market cap", short: "TOTAL", badge: "C", tone: "blue" },
    ],
    groups: [
      ["Crypto market cap ranking", ["BINANCE:BTCUSDT", "BINANCE:ETHUSDT", "BINANCE:BNBUSDT"]],
      ["Community trend tape", ["BINANCE:SOLUSDT", "BINANCE:XRPUSDT", "CRYPTOCAP:TOTAL"]],
    ],
  },
  {
    id: "futures",
    label: "Futures",
    title: "Futures and commodities",
    lead: "Metals, energy and index futures without mixing them into crypto cards.",
    primary: "TVC:GOLD",
    range: "12M",
    symbols: [
      { s: "TVC:GOLD", d: "Gold", short: "GOLD", badge: "Au", logo: "metal/gold", tone: "gold", yahoo: "GC=F" },
      { s: "TVC:SILVER", d: "Silver", short: "SILVER", badge: "Ag", logo: "metal/silver", tone: "silver", yahoo: "SI=F" },
      { s: "COMEX:HG1!", d: "Copper", short: "COPPER", badge: "Cu", logo: "metal/copper", tone: "copper", yahoo: "HG=F" },
      { s: "NYMEX:PL1!", d: "Platinum", short: "PLAT", badge: "Pt", logo: "metal/platinum", tone: "steel", yahoo: "PL=F" },
      { s: "NYMEX:CL1!", d: "WTI crude oil", short: "WTI", badge: "Oil", logo: "crude-oil", tone: "ink", yahoo: "CL=F" },
      { s: "NYMEX:NG1!", d: "Natural gas", short: "NG", badge: "Gas", logo: "natural-gas", tone: "blue", yahoo: "NG=F" },
    ],
    groups: [
      ["Metals futures", ["TVC:GOLD", "TVC:SILVER", "COMEX:HG1!", "NYMEX:PL1!"]],
      ["Energy futures", ["NYMEX:CL1!", "NYMEX:NG1!"]],
    ],
  },
  {
    id: "forex",
    label: "Forex",
    title: "Forex and currencies",
    lead: "Major pairs, dollar pressure and currency indices.",
    primary: "FX_IDC:EURUSD",
    range: "12M",
    symbols: [
      { s: "FX_IDC:EURUSD", d: "EUR to USD", short: "EURUSD", badge: "EU", logo: "country/EU", tone: "blue" },
      { s: "FX_IDC:USDJPY", d: "USD to JPY", short: "USDJPY", badge: "JP", logo: "country/JP", tone: "red" },
      { s: "FX_IDC:GBPUSD", d: "GBP to USD", short: "GBPUSD", badge: "GB", logo: "country/GB", tone: "navy" },
      { s: "FX_IDC:USDCHF", d: "USD to CHF", short: "USDCHF", badge: "CH", logo: "country/CH", tone: "red" },
      { s: "TVC:DXY", d: "US Dollar index", short: "DXY", badge: "$", logo: "indices/u-s-dollar-index", tone: "green", yahoo: "DX-Y.NYB" },
    ],
    groups: [
      ["Majors", ["FX_IDC:EURUSD", "FX_IDC:USDJPY", "FX_IDC:GBPUSD", "FX_IDC:USDCHF"]],
      ["Currency indices", ["TVC:DXY"]],
    ],
  },
  {
    id: "gov-bonds",
    label: "Government bonds",
    title: "Government bonds",
    lead: "Sovereign yields and curve pressure as a separate macro lane.",
    primary: "TVC:US10Y",
    range: "60M",
    symbols: [
      { s: "TVC:US02Y", d: "US 2Y yield", short: "US02Y", badge: "2Y", logo: "country/US", tone: "blue" },
      { s: "TVC:US10Y", d: "US 10Y yield", short: "US10Y", badge: "10Y", logo: "country/US", tone: "green", yahoo: "^TNX" },
      { s: "TVC:US30Y", d: "US 30Y yield", short: "US30Y", badge: "30Y", logo: "country/US", tone: "navy" },
      { s: "TVC:DE10Y", d: "Germany 10Y", short: "DE10Y", badge: "DE", logo: "country/DE", tone: "ink" },
      { s: "TVC:GB10Y", d: "UK 10Y", short: "GB10Y", badge: "GB", logo: "country/GB", tone: "wine" },
      { s: "TVC:JP10Y", d: "Japan 10Y", short: "JP10Y", badge: "JP", logo: "country/JP", tone: "red" },
    ],
    groups: [
      ["US curve", ["TVC:US02Y", "TVC:US10Y", "TVC:US30Y"]],
      ["Global 10Y yields", ["TVC:DE10Y", "TVC:GB10Y", "TVC:JP10Y"]],
    ],
  },
  {
    id: "corp-bonds",
    label: "Corporate bonds",
    title: "Corporate bonds",
    lead: "Credit ETFs as liquid proxies for investment grade and high yield stress.",
    primary: "AMEX:LQD",
    range: "60M",
    symbols: [
      { s: "AMEX:LQD", d: "iShares iBoxx IG", short: "LQD", logo: "ishares" },
      { s: "AMEX:HYG", d: "iShares high yield", short: "HYG", logo: "ishares" },
      { s: "AMEX:JNK", d: "SPDR high yield", short: "JNK", logo: "spdr" },
      { s: "NASDAQ:VCIT", d: "Vanguard intermediate corporate", short: "VCIT", logo: "vanguard" },
    ],
    groups: [
      ["Investment grade", ["AMEX:LQD", "NASDAQ:VCIT"]],
      ["High yield", ["AMEX:HYG", "AMEX:JNK"]],
    ],
  },
  {
    id: "etfs",
    label: "ETFs",
    title: "ETFs",
    lead: "Broad market, tech, total-market and Bitcoin ETF lanes.",
    primary: "AMEX:SPY",
    range: "ALL",
    symbols: [
      { s: "AMEX:SPY", d: "SPDR S&P 500 ETF Trust", short: "SPY", logo: "spdr" },
      { s: "NASDAQ:QQQ", d: "Invesco QQQ Trust", short: "QQQ", logo: "invesco" },
      { s: "AMEX:VTI", d: "Vanguard Total Stock Market ETF", short: "VTI", logo: "vanguard" },
      { s: "AMEX:IVV", d: "iShares Core S&P 500", short: "IVV", logo: "ishares" },
      { s: "NASDAQ:IBIT", d: "iShares Bitcoin Trust", short: "IBIT", logo: "ishares" },
    ],
    groups: [
      ["Most traded", ["AMEX:SPY", "NASDAQ:QQQ", "AMEX:VTI"]],
      ["ETF structure", ["AMEX:IVV", "NASDAQ:IBIT"]],
    ],
  },
  {
    id: "economy",
    label: "Economy",
    title: "Economy",
    lead: "Macro indicators are not crypto data: GDP, policy rates, inflation and unemployment.",
    primary: "FRED:GDP",
    range: "ALL",
    symbols: [
      { s: "FRED:GDP", d: "US GDP", short: "GDP", badge: "GDP", logo: "country/US", tone: "green" },
      { s: "FRED:GDPC1", d: "US real GDP", short: "GDPC1", badge: "Real", logo: "country/US", tone: "blue" },
      { s: "FRED:FEDFUNDS", d: "US interest rate", short: "FEDFUNDS", badge: "Fed", logo: "country/US", tone: "red" },
      { s: "FRED:CPIAUCSL", d: "US CPI", short: "CPI", badge: "CPI", logo: "country/US", tone: "gold" },
      { s: "FRED:UNRATE", d: "US unemployment", short: "UNRATE", badge: "Jobs", logo: "country/US", tone: "wine" },
    ],
    groups: [
      ["Economic indicators", ["FRED:GDP", "FRED:GDPC1", "FRED:FEDFUNDS"]],
      ["Inflation and labor", ["FRED:CPIAUCSL", "FRED:UNRATE"]],
    ],
  },
];
const MARKET_ATLAS_BY_ID = new Map(MARKET_ATLAS_CATEGORIES.map((c) => [c.id, c]));
const FRONT_PAGE_SECTION_IDS = ["indices", "us-stocks", "world-stocks", "crypto", "futures"];
const STOCK_TV_SYMBOLS = {
  AAPL: "NASDAQ:AAPL",
  ABNB: "NASDAQ:ABNB",
  ADBE: "NASDAQ:ADBE",
  AMD: "NASDAQ:AMD",
  AMZN: "NASDAQ:AMZN",
  AVGO: "NASDAQ:AVGO",
  COIN: "NASDAQ:COIN",
  CRCL: "NYSE:CRCL",
  GOOGL: "NASDAQ:GOOGL",
  HIMS: "NYSE:HIMS",
  META: "NASDAQ:META",
  MSFT: "NASDAQ:MSFT",
  MSTR: "NASDAQ:MSTR",
  MU: "NASDAQ:MU",
  NVDA: "NASDAQ:NVDA",
  PLTR: "NASDAQ:PLTR",
  TSLA: "NASDAQ:TSLA",
};

function listSymbol(s, d, short, extra = {}) {
  return { s, d, short: short || s.split(":").pop(), ...extra };
}

function listedSymbols(rows) {
  return rows.map(([s, d, short, logo, yahoo, extra = {}]) =>
    listSymbol(s, d, short, { logo, yahoo: yahoo || short, ...extra }));
}

const EXTRA_US_STOCKS = listedSymbols([
  ["NYSE:BRK.B", "Berkshire Hathaway", "BRK.B", "berkshire-hathaway", "BRK-B"],
  ["NASDAQ:AVGO", "Broadcom", "AVGO", "broadcom", "AVGO"],
  ["NYSE:LLY", "Eli Lilly", "LLY", "eli-lilly", "LLY"],
  ["NASDAQ:META", "Meta Platforms", "META", "meta", "META"],
  ["NYSE:JPM", "JPMorgan Chase", "JPM", "jpmorgan-chase", "JPM"],
  ["NYSE:V", "Visa", "V", "visa", "V"],
  ["NYSE:MA", "Mastercard", "MA", "mastercard", "MA"],
  ["NYSE:WMT", "Walmart", "WMT", "walmart", "WMT"],
  ["NYSE:UNH", "UnitedHealth", "UNH", "unitedhealth", "UNH"],
  ["NYSE:HD", "Home Depot", "HD", "home-depot", "HD"],
  ["NYSE:PG", "Procter & Gamble", "PG", "procter-and-gamble", "PG"],
  ["NYSE:JNJ", "Johnson & Johnson", "JNJ", "johnson-and-johnson", "JNJ"],
  ["NYSE:XOM", "Exxon Mobil", "XOM", "exxon-mobil", "XOM"],
  ["NYSE:BAC", "Bank of America", "BAC", "bank-of-america", "BAC"],
  ["NYSE:KO", "Coca-Cola", "KO", "coca-cola", "KO"],
  ["NYSE:CVX", "Chevron", "CVX", "chevron", "CVX"],
  ["NYSE:ABBV", "AbbVie", "ABBV", "abbvie", "ABBV"],
  ["NYSE:MRK", "Merck", "MRK", "merck", "MRK"],
  ["NASDAQ:PEP", "PepsiCo", "PEP", "pepsico", "PEP"],
  ["NYSE:CRM", "Salesforce", "CRM", "salesforce", "CRM"],
  ["NASDAQ:CSCO", "Cisco", "CSCO", "cisco", "CSCO"],
  ["NYSE:ACN", "Accenture", "ACN", "accenture", "ACN"],
  ["NYSE:MCD", "McDonald's", "MCD", "mcdonalds", "MCD"],
  ["NASDAQ:LIN", "Linde", "LIN", "linde", "LIN"],
  ["NYSE:ABT", "Abbott Laboratories", "ABT", "abbott", "ABT"],
  ["NYSE:TMO", "Thermo Fisher Scientific", "TMO", "thermo-fisher-scientific", "TMO"],
  ["NYSE:PM", "Philip Morris", "PM", "philip-morris", "PM"],
  ["NYSE:IBM", "IBM", "IBM", "ibm", "IBM"],
  ["NYSE:WFC", "Wells Fargo", "WFC", "wells-fargo", "WFC"],
  ["NYSE:GE", "GE Aerospace", "GE", "general-electric", "GE"],
  ["NYSE:CAT", "Caterpillar", "CAT", "caterpillar", "CAT"],
  ["NYSE:AXP", "American Express", "AXP", "american-express", "AXP"],
  ["NYSE:MS", "Morgan Stanley", "MS", "morgan-stanley", "MS"],
  ["NYSE:GS", "Goldman Sachs", "GS", "goldman-sachs", "GS"],
  ["NYSE:DIS", "Disney", "DIS", "disney", "DIS"],
  ["NASDAQ:INTU", "Intuit", "INTU", "intuit", "INTU"],
  ["NASDAQ:AMAT", "Applied Materials", "AMAT", "applied-materials", "AMAT"],
  ["NASDAQ:TXN", "Texas Instruments", "TXN", "texas-instruments", "TXN"],
  ["NASDAQ:QCOM", "Qualcomm", "QCOM", "qualcomm", "QCOM"],
  ["NASDAQ:ADP", "Automatic Data Processing", "ADP", "adp", "ADP"],
  ["NYSE:BKNG", "Booking Holdings", "BKNG", "booking", "BKNG"],
  ["NASDAQ:ISRG", "Intuitive Surgical", "ISRG", "intuitive-surgical", "ISRG"],
  ["NASDAQ:VRTX", "Vertex Pharmaceuticals", "VRTX", "vertex-pharmaceuticals", "VRTX"],
  ["NYSE:BLK", "BlackRock", "BLK", "blackrock", "BLK"],
  ["NYSE:LOW", "Lowe's", "LOW", "lowes", "LOW"],
  ["NYSE:RTX", "RTX", "RTX", "raytheon-technologies", "RTX"],
  ["NYSE:LMT", "Lockheed Martin", "LMT", "lockheed-martin", "LMT"],
  ["NYSE:BA", "Boeing", "BA", "boeing", "BA"],
  ["NYSE:DE", "Deere", "DE", "deere", "DE"],
  ["NYSE:UPS", "UPS", "UPS", "ups", "UPS"],
  ["NYSE:NEE", "NextEra Energy", "NEE", "nextera-energy", "NEE"],
  ["NYSE:NKE", "Nike", "NKE", "nike", "NKE"],
  ["NYSE:SBUX", "Starbucks", "SBUX", "starbucks", "SBUX"],
  ["NYSE:UBER", "Uber", "UBER", "uber", "UBER"],
  ["NASDAQ:AMD", "AMD", "AMD", "amd", "AMD"],
  ["NASDAQ:INTC", "Intel", "INTC", "intel", "INTC"],
  ["NASDAQ:ADBE", "Adobe", "ADBE", "adobe", "ADBE"],
  ["NASDAQ:APP", "AppLovin", "APP", "applovin", "APP"],
  ["NASDAQ:LRCX", "Lam Research", "LRCX", "lam-research", "LRCX"],
  ["NASDAQ:KLAC", "KLA", "KLAC", "kla", "KLAC"],
  ["NYSE:NOW", "ServiceNow", "NOW", "servicenow", "NOW"],
  ["NASDAQ:PLTR", "Palantir", "PLTR", "palantir", "PLTR"],
  ["NASDAQ:COIN", "Coinbase", "COIN", "coinbase", "COIN"],
  ["NASDAQ:MU", "Micron Technology", "MU", "micron-technology", "MU"],
  ["NASDAQ:CRWD", "CrowdStrike", "CRWD", "crowdstrike", "CRWD"],
  ["NASDAQ:PANW", "Palo Alto Networks", "PANW", "palo-alto-networks", "PANW"],
  ["NASDAQ:MSTR", "MicroStrategy", "MSTR", "microstrategy", "MSTR"],
  ["NYSE:SNOW", "Snowflake", "SNOW", "snowflake", "SNOW"],
  ["NASDAQ:ABNB", "Airbnb", "ABNB", "airbnb", "ABNB"],
  ["NASDAQ:PYPL", "PayPal", "PYPL", "paypal", "PYPL"],
  ["NYSE:NET", "Cloudflare", "NET", "cloudflare", "NET"],
  ["NASDAQ:DDOG", "Datadog", "DDOG", "datadog", "DDOG"],
  ["NYSE:C", "Citigroup", "C", "citigroup", "C"],
  ["NYSE:COP", "ConocoPhillips", "COP", "conocophillips", "COP"],
  ["NASDAQ:CMCSA", "Comcast", "CMCSA", "comcast", "CMCSA"],
  ["NYSE:ELV", "Elevance Health", "ELV", "elevance-health", "ELV"],
  ["NYSE:HCA", "HCA Healthcare", "HCA", "hca-healthcare", "HCA"],
  ["NYSE:MCO", "Moody's", "MCO", "moodys", "MCO"],
  ["NASDAQ:MDLZ", "Mondelez", "MDLZ", "mondelez", "MDLZ"],
  ["NYSE:PGR", "Progressive", "PGR", "progressive", "PGR"],
  ["NYSE:SYK", "Stryker", "SYK", "stryker", "SYK"],
  ["NYSE:TJX", "TJX Companies", "TJX", "tjx", "TJX"],
  ["NYSE:TGT", "Target", "TGT", "target", "TGT"],
  ["NYSE:SPGI", "S&P Global", "SPGI", "sp-global", "SPGI"],
  ["NASDAQ:CHTR", "Charter Communications", "CHTR", "charter", "CHTR"],
  ["NASDAQ:EQIX", "Equinix", "EQIX", "equinix", "EQIX"],
  ["NYSE:APD", "Air Products", "APD", "air-products", "APD"],
  ["NYSE:SO", "Southern Company", "SO", "southern-company", "SO"],
  ["NYSE:DHR", "Danaher", "DHR", "danaher", "DHR"],
  ["NYSE:GEV", "GE Vernova", "GEV", "ge-vernova", "GEV"],
  ["NASDAQ:GILD", "Gilead Sciences", "GILD", "gilead", "GILD"],
  ["NYSE:BSX", "Boston Scientific", "BSX", "boston-scientific", "BSX"],
  ["NASDAQ:CEG", "Constellation Energy", "CEG", "constellation-energy", "CEG"],
  ["NYSE:RCL", "Royal Caribbean", "RCL", "royal-caribbean", "RCL"],
]);

const EXTRA_WORLD_STOCKS = listedSymbols([
  ["NYSE:NVO", "Novo Nordisk", "NVO", "novo-nordisk", "NVO"],
  ["NYSE:SAP", "SAP", "SAP", "sap", "SAP"],
  ["NYSE:BABA", "Alibaba", "BABA", "alibaba", "BABA"],
  ["NYSE:SHEL", "Shell", "SHEL", "shell", "SHEL"],
  ["NASDAQ:AZN", "AstraZeneca", "AZN", "astrazeneca", "AZN"],
  ["NYSE:NVS", "Novartis", "NVS", "novartis", "NVS"],
  ["NYSE:HSBC", "HSBC", "HSBC", "hsbc", "HSBC"],
  ["NYSE:SONY", "Sony", "SONY", "sony", "SONY"],
  ["NASDAQ:PDD", "PDD", "PDD", "pdd-holdings", "PDD"],
  ["NASDAQ:MELI", "MercadoLibre", "MELI", "mercadolibre", "MELI"],
  ["NYSE:SE", "Sea Limited", "SE", "sea-limited", "SE"],
  ["NYSE:RACE", "Ferrari", "RACE", "ferrari", "RACE"],
  ["NYSE:UL", "Unilever", "UL", "unilever", "UL"],
  ["NYSE:BP", "BP", "BP", "bp", "BP"],
  ["NYSE:TTE", "TotalEnergies", "TTE", "totalenergies", "TTE"],
  ["NYSE:RIO", "Rio Tinto", "RIO", "rio-tinto", "RIO"],
  ["NYSE:BHP", "BHP", "BHP", "bhp", "BHP"],
  ["NYSE:SNY", "Sanofi", "SNY", "sanofi", "SNY"],
  ["NYSE:GSK", "GSK", "GSK", "gsk", "GSK"],
  ["NYSE:SHOP", "Shopify", "SHOP", "shopify", "SHOP"],
  ["NYSE:DEO", "Diageo", "DEO", "diageo", "DEO"],
  ["NYSE:UBS", "UBS", "UBS", "ubs", "UBS"],
  ["NYSE:BBVA", "BBVA", "BBVA", "bbva", "BBVA"],
  ["NYSE:INFY", "Infosys", "INFY", "infosys", "INFY"],
  ["NYSE:HDB", "HDFC Bank", "HDB", "hdfc-bank", "HDB"],
  ["NYSE:IBN", "ICICI Bank", "IBN", "icici-bank", "IBN"],
  ["NYSE:SMFG", "Sumitomo Mitsui", "SMFG", "sumitomo-mitsui-financial", "SMFG"],
  ["NYSE:MUFG", "Mitsubishi UFJ", "MUFG", "mitsubishi-ufj", "MUFG"],
  ["NYSE:NTES", "NetEase", "NTES", "netease", "NTES"],
  ["NYSE:BIDU", "Baidu", "BIDU", "baidu", "BIDU"],
]);

const EXTRA_ETFS = listedSymbols([
  ["AMEX:VOO", "Vanguard S&P 500 ETF", "VOO", "vanguard", "VOO"],
  ["AMEX:IWM", "iShares Russell 2000 ETF", "IWM", "ishares", "IWM"],
  ["AMEX:DIA", "SPDR Dow Jones Industrial Average ETF", "DIA", "spdr", "DIA"],
  ["AMEX:GLD", "SPDR Gold Shares", "GLD", "spdr", "GLD"],
  ["AMEX:SLV", "iShares Silver Trust", "SLV", "ishares", "SLV"],
  ["NASDAQ:TLT", "iShares 20+ Year Treasury Bond ETF", "TLT", "ishares", "TLT"],
  ["AMEX:EEM", "iShares MSCI Emerging Markets ETF", "EEM", "ishares", "EEM"],
  ["AMEX:XLF", "Financial Select Sector SPDR", "XLF", "spdr", "XLF"],
  ["AMEX:XLK", "Technology Select Sector SPDR", "XLK", "spdr", "XLK"],
  ["NASDAQ:SMH", "VanEck Semiconductor ETF", "SMH", "vaneck", "SMH"],
  ["NASDAQ:SOXX", "iShares Semiconductor ETF", "SOXX", "ishares", "SOXX"],
  ["AMEX:VUG", "Vanguard Growth ETF", "VUG", "vanguard", "VUG"],
  ["AMEX:VTV", "Vanguard Value ETF", "VTV", "vanguard", "VTV"],
  ["AMEX:VEA", "Vanguard FTSE Developed Markets ETF", "VEA", "vanguard", "VEA"],
  ["AMEX:VWO", "Vanguard Emerging Markets ETF", "VWO", "vanguard", "VWO"],
  ["AMEX:SCHD", "Schwab US Dividend Equity ETF", "SCHD", "schwab", "SCHD"],
  ["NASDAQ:BITB", "Bitwise Bitcoin ETF", "BITB", "bitwise", "BITB"],
  ["AMEX:FBTC", "Fidelity Wise Origin Bitcoin Fund", "FBTC", "fidelity", "FBTC"],
  ["AMEX:GBTC", "Grayscale Bitcoin Trust", "GBTC", "grayscale", "GBTC"],
  ["NASDAQ:ETHA", "iShares Ethereum Trust", "ETHA", "ishares", "ETHA"],
  ["NASDAQ:TQQQ", "ProShares UltraPro QQQ", "TQQQ", "proshares", "TQQQ"],
  ["NASDAQ:SQQQ", "ProShares UltraPro Short QQQ", "SQQQ", "proshares", "SQQQ"],
  ["AMEX:ARKK", "ARK Innovation ETF", "ARKK", "ark-invest", "ARKK"],
  ["AMEX:XLE", "Energy Select Sector SPDR", "XLE", "spdr", "XLE"],
  ["AMEX:XLV", "Health Care Select Sector SPDR", "XLV", "spdr", "XLV"],
  ["AMEX:XLY", "Consumer Discretionary Select Sector SPDR", "XLY", "spdr", "XLY"],
  ["AMEX:XLP", "Consumer Staples Select Sector SPDR", "XLP", "spdr", "XLP"],
  ["AMEX:XLU", "Utilities Select Sector SPDR", "XLU", "spdr", "XLU"],
  ["AMEX:XLI", "Industrial Select Sector SPDR", "XLI", "spdr", "XLI"],
]);

const MARKET_LIST_UNIVERSE = {
  global: [
    listSymbol("TVC:RUT", "US 2000 small cap", "RUT", { logo: "indices/russell-2000", yahoo: "^RUT" }),
    listSymbol("XETR:DAX", "DAX", "DAX", { logo: "indices/dax" }),
    listSymbol("TVC:UKX", "FTSE 100", "UKX", { logo: "indices/uk-100" }),
    listSymbol("FX_IDC:EURUSD", "EUR to USD", "EURUSD", { badge: "EU" }),
    listSymbol("FX_IDC:USDJPY", "USD to JPY", "USDJPY", { badge: "JP" }),
    listSymbol("TVC:US02Y", "US 2Y yield", "US02Y", { logo: "country/US" }),
    listSymbol("TVC:US30Y", "US 30Y yield", "US30Y", { logo: "country/US" }),
    listSymbol("TVC:SILVER", "Silver", "SILVER", { logo: "metal/silver", yahoo: "SI=F" }),
    listSymbol("NASDAQ:NVDA", "NVIDIA", "NVDA", { logo: "nvidia", yahoo: "NVDA" }),
    listSymbol("NASDAQ:AAPL", "Apple", "AAPL", { logo: "apple", yahoo: "AAPL" }),
    listSymbol("AMEX:SPY", "SPDR S&P 500 ETF Trust", "SPY", { logo: "spdr", yahoo: "SPY" }),
    listSymbol("NASDAQ:TLT", "iShares 20+ Year Treasury Bond ETF", "TLT", { logo: "ishares", yahoo: "TLT" }),
  ],
  "us-stocks": [
    listSymbol("NASDAQ:NFLX", "Netflix", "NFLX", { logo: "netflix", yahoo: "NFLX" }),
    listSymbol("NYSE:ORCL", "Oracle", "ORCL", { logo: "oracle", yahoo: "ORCL" }),
    listSymbol("NASDAQ:COST", "Costco", "COST", { logo: "costco", yahoo: "COST" }),
    listSymbol("NYSE:WMT", "Walmart", "WMT", { logo: "walmart", yahoo: "WMT" }),
    listSymbol("NYSE:MA", "Mastercard", "MA", { logo: "mastercard", yahoo: "MA" }),
    listSymbol("NYSE:V", "Visa", "V", { logo: "visa", yahoo: "V" }),
    listSymbol("NYSE:UNH", "UnitedHealth", "UNH", { logo: "unitedhealth", yahoo: "UNH" }),
    listSymbol("NYSE:HD", "Home Depot", "HD", { logo: "home-depot", yahoo: "HD" }),
    listSymbol("NYSE:PG", "Procter & Gamble", "PG", { logo: "procter-and-gamble", yahoo: "PG" }),
    listSymbol("NYSE:JNJ", "Johnson & Johnson", "JNJ", { logo: "johnson-and-johnson", yahoo: "JNJ" }),
    listSymbol("NYSE:XOM", "Exxon Mobil", "XOM", { logo: "exxon-mobil", yahoo: "XOM" }),
    listSymbol("NYSE:BAC", "Bank of America", "BAC", { logo: "bank-of-america", yahoo: "BAC" }),
    listSymbol("NYSE:KO", "Coca-Cola", "KO", { logo: "coca-cola", yahoo: "KO" }),
    listSymbol("NASDAQ:AMD", "AMD", "AMD", { logo: "amd", yahoo: "AMD" }),
    listSymbol("NASDAQ:INTC", "Intel", "INTC", { logo: "intel", yahoo: "INTC" }),
    listSymbol("NASDAQ:ADBE", "Adobe", "ADBE", { logo: "adobe", yahoo: "ADBE" }),
    listSymbol("NASDAQ:QCOM", "Qualcomm", "QCOM", { logo: "qualcomm", yahoo: "QCOM" }),
    listSymbol("NYSE:UBER", "Uber", "UBER", { logo: "uber", yahoo: "UBER" }),
    listSymbol("NASDAQ:PLTR", "Palantir", "PLTR", { logo: "palantir", yahoo: "PLTR" }),
    listSymbol("NASDAQ:COIN", "Coinbase", "COIN", { logo: "coinbase", yahoo: "COIN" }),
    listSymbol("NASDAQ:MU", "Micron", "MU", { logo: "micron-technology", yahoo: "MU" }),
    listSymbol("NASDAQ:CRWD", "CrowdStrike", "CRWD", { logo: "crowdstrike", yahoo: "CRWD" }),
    listSymbol("NASDAQ:PEP", "PepsiCo", "PEP", { logo: "pepsico", yahoo: "PEP" }),
    listSymbol("NYSE:ABBV", "AbbVie", "ABBV", { logo: "abbvie", yahoo: "ABBV" }),
    listSymbol("NYSE:MRK", "Merck", "MRK", { logo: "merck", yahoo: "MRK" }),
    listSymbol("NYSE:CRM", "Salesforce", "CRM", { logo: "salesforce", yahoo: "CRM" }),
    listSymbol("NASDAQ:CSCO", "Cisco", "CSCO", { logo: "cisco", yahoo: "CSCO" }),
    listSymbol("NASDAQ:TXN", "Texas Instruments", "TXN", { logo: "texas-instruments", yahoo: "TXN" }),
    listSymbol("NYSE:NOW", "ServiceNow", "NOW", { logo: "servicenow", yahoo: "NOW" }),
    listSymbol("NYSE:SHOP", "Shopify", "SHOP", { logo: "shopify", yahoo: "SHOP" }),
    listSymbol("NASDAQ:HOOD", "Robinhood", "HOOD", { logo: "robinhood", yahoo: "HOOD" }),
    listSymbol("NASDAQ:MSTR", "MicroStrategy", "MSTR", { logo: "microstrategy", yahoo: "MSTR" }),
    listSymbol("NASDAQ:SMCI", "Super Micro Computer", "SMCI", { logo: "super-micro-computer", yahoo: "SMCI" }),
    listSymbol("NASDAQ:PANW", "Palo Alto Networks", "PANW", { logo: "palo-alto-networks", yahoo: "PANW" }),
    listSymbol("NYSE:SNOW", "Snowflake", "SNOW", { logo: "snowflake", yahoo: "SNOW" }),
    listSymbol("NASDAQ:ABNB", "Airbnb", "ABNB", { logo: "airbnb", yahoo: "ABNB" }),
    ...EXTRA_US_STOCKS,
  ],
  "world-stocks": [
    listSymbol("NYSE:NVO", "Novo Nordisk", "NVO", { logo: "novo-nordisk", yahoo: "NVO" }),
    listSymbol("NYSE:SAP", "SAP", "SAP", { logo: "sap", yahoo: "SAP" }),
    listSymbol("NYSE:BABA", "Alibaba", "BABA", { logo: "alibaba", yahoo: "BABA" }),
    listSymbol("NYSE:SHEL", "Shell", "SHEL", { logo: "shell", yahoo: "SHEL" }),
    listSymbol("NASDAQ:AZN", "AstraZeneca", "AZN", { logo: "astrazeneca", yahoo: "AZN" }),
    listSymbol("NYSE:NVS", "Novartis", "NVS", { logo: "novartis", yahoo: "NVS" }),
    listSymbol("NYSE:HSBC", "HSBC", "HSBC", { logo: "hsbc", yahoo: "HSBC" }),
    listSymbol("NYSE:SONY", "Sony", "SONY", { logo: "sony", yahoo: "SONY" }),
    listSymbol("NASDAQ:PDD", "PDD", "PDD", { logo: "pdd-holdings", yahoo: "PDD" }),
    listSymbol("NASDAQ:MELI", "MercadoLibre", "MELI", { logo: "mercadolibre", yahoo: "MELI" }),
    listSymbol("NYSE:SE", "Sea Limited", "SE", { logo: "sea-limited", yahoo: "SE" }),
    ...EXTRA_WORLD_STOCKS,
  ],
  futures: [
    listSymbol("NYMEX:BZ1!", "Brent crude oil", "BRN", { badge: "Oil", tone: "ink", yahoo: "BZ=F" }),
    listSymbol("NYMEX:RB1!", "RBOB gasoline", "RBOB", { badge: "Gas", tone: "copper", yahoo: "RB=F" }),
    listSymbol("CBOT:ZC1!", "Corn", "Corn", { badge: "C", tone: "gold", yahoo: "ZC=F" }),
    listSymbol("CBOT:ZS1!", "Soybean", "Soy", { badge: "S", tone: "green", yahoo: "ZS=F" }),
    listSymbol("CBOT:ZW1!", "Wheat", "Wheat", { badge: "W", tone: "gold", yahoo: "ZW=F" }),
    listSymbol("ICEUS:KC1!", "Coffee", "Coffee", { badge: "C", tone: "wine", yahoo: "KC=F" }),
    listSymbol("ICEUS:SB1!", "Sugar No. 11", "Sugar", { badge: "S", tone: "steel", yahoo: "SB=F" }),
    listSymbol("ICEUS:CT1!", "Cotton No. 2", "Cotton", { badge: "Ct", tone: "steel", yahoo: "CT=F" }),
    listSymbol("CME_MINI:ES1!", "E-mini S&P 500", "ES", { badge: "500", tone: "red", yahoo: "ES=F" }),
    listSymbol("CME_MINI:NQ1!", "E-mini Nasdaq 100", "NQ", { badge: "100", tone: "blue", yahoo: "NQ=F" }),
    listSymbol("CBOT_MINI:YM1!", "E-mini Dow", "YM", { badge: "30", tone: "cyan", yahoo: "YM=F" }),
    listSymbol("CME_MINI:RTY1!", "E-mini Russell 2000", "RTY", { badge: "2K", tone: "wine", yahoo: "RTY=F" }),
  ],
  forex: [
    listSymbol("FX_IDC:AUDUSD", "AUD to USD", "AUDUSD", { badge: "AU", tone: "blue", yahoo: "AUDUSD=X" }),
    listSymbol("FX_IDC:USDCAD", "USD to CAD", "USDCAD", { badge: "CA", tone: "red", yahoo: "USDCAD=X" }),
    listSymbol("FX_IDC:NZDUSD", "NZD to USD", "NZDUSD", { badge: "NZ", tone: "green", yahoo: "NZDUSD=X" }),
    listSymbol("FX_IDC:EURJPY", "EUR to JPY", "EURJPY", { badge: "EJ", tone: "navy", yahoo: "EURJPY=X" }),
    listSymbol("FX_IDC:EURGBP", "EUR to GBP", "EURGBP", { badge: "EG", tone: "wine", yahoo: "EURGBP=X" }),
    listSymbol("FX_IDC:USDCNY", "USD to CNY", "USDCNY", { badge: "CN", tone: "red", yahoo: "USDCNY=X" }),
  ],
  "gov-bonds": [
    listSymbol("TVC:US03M", "US 3M yield", "US03M", { badge: "3M", tone: "blue", yahoo: "^IRX" }),
    listSymbol("TVC:US05Y", "US 5Y yield", "US05Y", { badge: "5Y", tone: "cyan", yahoo: "^FVX" }),
  ],
  "corp-bonds": [
    listSymbol("NASDAQ:VCSH", "Vanguard short-term corporate", "VCSH", { logo: "vanguard", yahoo: "VCSH" }),
    listSymbol("AMEX:AGG", "iShares core aggregate bond", "AGG", { logo: "ishares", yahoo: "AGG" }),
    listSymbol("NASDAQ:BND", "Vanguard total bond market", "BND", { logo: "vanguard", yahoo: "BND" }),
    listSymbol("AMEX:SHYG", "iShares 0-5 high yield", "SHYG", { logo: "ishares", yahoo: "SHYG" }),
  ],
  etfs: [
    listSymbol("AMEX:VOO", "Vanguard S&P 500 ETF", "VOO", { logo: "vanguard", yahoo: "VOO" }),
    listSymbol("AMEX:IWM", "iShares Russell 2000 ETF", "IWM", { logo: "ishares", yahoo: "IWM" }),
    listSymbol("AMEX:DIA", "SPDR Dow Jones Industrial Average ETF", "DIA", { logo: "spdr", yahoo: "DIA" }),
    listSymbol("AMEX:GLD", "SPDR Gold Shares", "GLD", { logo: "spdr", yahoo: "GLD" }),
    listSymbol("AMEX:SLV", "iShares Silver Trust", "SLV", { logo: "ishares", yahoo: "SLV" }),
    listSymbol("NASDAQ:TLT", "iShares 20+ Year Treasury Bond ETF", "TLT", { logo: "ishares", yahoo: "TLT" }),
    listSymbol("AMEX:EEM", "iShares MSCI Emerging Markets ETF", "EEM", { logo: "ishares", yahoo: "EEM" }),
    listSymbol("AMEX:XLF", "Financial Select Sector SPDR", "XLF", { logo: "spdr", yahoo: "XLF" }),
    listSymbol("AMEX:XLK", "Technology Select Sector SPDR", "XLK", { logo: "spdr", yahoo: "XLK" }),
    listSymbol("NASDAQ:SMH", "VanEck Semiconductor ETF", "SMH", { logo: "vaneck", yahoo: "SMH" }),
    listSymbol("NASDAQ:SOXX", "iShares Semiconductor ETF", "SOXX", { logo: "ishares", yahoo: "SOXX" }),
    ...EXTRA_ETFS,
  ],
};

function defaultBoardShow(id) {
  if (id === "global") return 40;
  if (id === "crypto") return 100;
  if (id === "us-stocks" || id === "world-stocks") return 100;
  if (id === "etfs") return 60;
  return 30;
}

const px = (c) => (c && c.price_live != null ? c.price_live : c ? c.price : null);
const trendText = (v) => (Number(v) >= 0 ? "Rising" : "Falling");

// Clean signed move: arrow + tabular pct. Color carries the direction.
function moveValue(value) {
  if (value == null || !isFinite(Number(value))) return "—";
  const n = Number(value);
  return (n >= 0 ? "↗ " : "↘ ") + fmtPct(n);
}

export function renderMarket(root) {
  let ov = null;           // /api/market-overview payload
  let sparks = {};         // binance local sparks
  let tab = "all";
  let showCount = 25;
  let news = null;
  let newsRetryTimer = 0;
  let overviewError = "";
  const cleanups = [];
  const tape = buildCoinsTape();
  cleanups.push(tape.destroy);

  // Repaint governor: below-fold sections paint eagerly ONCE (so audits and
  // deep links always find real rows), then only repaint while on screen —
  // off-screen they just mark dirty and catch up when scrolled into view.
  // This is what keeps the 5s poll cheap on a long page.
  const lazyState = new Map();   // el -> { seen, painted, dirty }
  const io = typeof IntersectionObserver !== "undefined"
    ? new IntersectionObserver((ents) => {
        for (const e of ents) {
          const st = lazyState.get(e.target);
          if (!st) continue;
          st.seen = e.isIntersecting;
          if (st.seen && st.dirty) { const fn = st.dirty; st.dirty = null; fn(); }
        }
      }, { rootMargin: "280px 0px" })
    : null;
  cleanups.push(() => { if (io) io.disconnect(); });
  function lazyPaint(el, fn) {
    if (!io) { fn(); return; }
    let st = lazyState.get(el);
    if (!st) { st = { seen: false, painted: false, dirty: null }; lazyState.set(el, st); io.observe(el); }
    if (!st.painted || st.seen) { st.painted = true; st.dirty = null; fn(); }
    else st.dirty = fn;
  }

  // ---- market cards (every card opens a detail sheet — no dead clicks) ----
  const cards = {};
  function card(key, label) {
    const v = h("div", { class: "stat-v num" }, "—");
    const d = h("div", { class: "card-delta num" });
    const s = h("div", { class: "stat-spark" });
    const src = h("div", { class: "card-src", role: "button", title: "Source details",
      onClick: (e) => { e.stopPropagation(); openDataSheet(); } }, "—");
    cards[key] = { v, d, s, src };
    return h("div", {
      class: "stat-tile clickable", role: "button", tabindex: "0", "data-card": key,
      onClick: () => openCardDetail(key),
    }, h("div", { class: "stat-k" }, label), v, d, s, src);
  }

  function srcLine(status, source) {
    return sheetNote(`${source || "—"} · ${status || "—"} · server-side cached`);
  }
  function domList(dom) {
    return Object.entries(dom || {}).map(([sym, pct]) =>
      h("div", { class: "lb-row", onClick: () => navigate("/symbol/" + sym + "USDT") },
        h("span", { class: "lb-bar bid", style: { width: Math.min(76, pct * 1.3) + "%" } }),
        tokenIcon(sym, 22), h("span", { class: "lb-name" }, sym),
        h("span", { class: "lb-val num strong" }, Number(pct).toFixed(2) + "%")));
  }
  function coinList(coins, valFn, clsFn) {
    return coins.map((c) => h("div", { class: "lb-row", onClick: () => navigate("/symbol/" + (c.binance ? c.binance.symbol : c.base + "USDT")) },
      coinIcon(c, 22), h("span", { class: "lb-name" }, c.name),
      h("span", { class: "lb-val num " + (clsFn ? clsFn(c) : "strong") }, valFn(c))));
  }
  function openCardDetail(key) {
    if (key === "uni") { navigate("/radar"); return; }
    if (!ov) {
      openDetailSheet("Market data warming", "activity", () => [
        sheetNote("The market overview cache is still hydrating. This card will fill automatically when the server returns the next snapshot."),
        sheetRow("Status", overviewError || "connecting"),
        sheetRow("Action", "No fake value is shown while the feed is unavailable"),
      ]);
      return;
    }
    const g = ov.global || {}, fg = ov.fear_greed || {}, st = ov.stablecoins || {}, df = ov.defi || {};
    const coins = (ov.top_coins && ov.top_coins.coins) || [];
    const builders = {
      mcap: () => [
        sheetRow("Crypto market cap", fmtMoney(g.mcap_usd)),
        sheetRow("24h change", g.mcap_change_24h_pct != null ? fmtPct(g.mcap_change_24h_pct) : "—", signClass(g.mcap_change_24h_pct)),
        sheetRow("Active assets", fmtCompact(g.active_cryptocurrencies)),
        sheetTitle("Dominance"), ...domList(g.dominance),
        srcLine(g.status, g.source)],
      vol: () => [
        sheetRow("Global 24h volume", fmtMoney(g.volume_usd)),
        sheetRow("Vol / mcap", g.volume_usd && g.mcap_usd ? ((g.volume_usd / g.mcap_usd) * 100).toFixed(2) + "%" : "—"),
        sheetTitle("Top coins by volume"),
        ...coinList([...coins].sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 8), (c) => fmtMoney(c.volume)),
        srcLine(g.status, g.source)],
      dom: () => [
        sheetRow("BTC dominance", g.btc_dominance != null ? g.btc_dominance.toFixed(2) + "%" : "—"),
        sheetRow("ETH dominance", g.eth_dominance != null ? g.eth_dominance.toFixed(2) + "%" : "—"),
        sheetTitle("Full dominance breakdown"), ...domList(g.dominance),
        srcLine(g.status, g.source)],
      dex: () => {
        const dx = ov.dex || {};
        return [
          sheetRow("DEX volume · 24h", fmtMoney(dx.total24h_usd)),
          sheetRow("1d change", dx.change_1d_pct != null ? fmtPct(dx.change_1d_pct) : "—", signClass(dx.change_1d_pct)),
          (dx.bars || []).length > 2 ? sheetChart(barsSvg((dx.bars || []).map((b) => b[1]), 340, 110), 110) : null,
          sheetNote("Aggregate spot volume across all decentralized exchanges — real daily bars."),
          srcLine(dx.status, "defillama")];
      },
      fng: () => [
        sheetRow("Fear & Greed", fg.value != null ? `${fg.value} · ${fg.label}` : "—",
          fg.value != null ? (fg.value <= 25 ? "down" : fg.value >= 75 ? "up" : "") : ""),
        (fg.history || []).length > 2
          ? sheetChart(sparkArea((fg.history || []).map((p) => p.value), 340, 110,
              fg.value <= 25 ? "var(--down)" : fg.value >= 75 ? "var(--up)" : "var(--accent)"), 110)
          : null,
        sheetRow("30d low", fg.history ? Math.min(...fg.history.map((p) => p.value)) : "—"),
        sheetRow("30d high", fg.history ? Math.max(...fg.history.map((p) => p.value)) : "—"),
        sheetNote("0–25 extreme fear · 25–45 fear · 45–55 neutral · 55–75 greed · 75–100 extreme greed."),
        srcLine(fg.status, "alternative.me")],
      stbl: () => [
        sheetRow("Stablecoin supply", fmtMoney(st.total_usd)),
        sheetRow("USDT share", st.usdt_share_pct != null ? st.usdt_share_pct.toFixed(2) + "%" : "—"),
        sheetRow("USDC share", st.usdc_share_pct != null ? st.usdc_share_pct.toFixed(2) + "%" : "—"),
        sheetTitle("Largest stablecoins"),
        ...(st.top || []).map((a) => sheetRow(a.symbol + " · " + a.name, fmtMoney(a.circulating_usd))),
        srcLine(st.status, "defillama")],
      tvl: () => [
        sheetRow("DeFi TVL", fmtMoney(df.tvl_usd)),
        (df.chart || []).length > 2 ? sheetChart(sparkArea(df.chart, 340, 110, "var(--up)"), 110) : null,
        sheetNote("Total value locked across DeFi protocols, last ~120 days."),
        srcLine(df.status, "defillama")],
    };
    const titles = {
      mcap: ["Crypto market cap", "globe"], vol: ["Crypto 24h volume", "activity"],
      dom: ["Market dominance", "target"], dex: ["DEX volume", "activity"],
      fng: ["Fear & Greed", "gauge"], stbl: ["Stablecoins", "database"], tvl: ["DeFi TVL", "candles"],
    };
    const build = builders[key];
    const meta = titles[key] || ["Detail", "info"];
    if (build) openDetailSheet(meta[0], meta[1], () => build().filter(Boolean));
  }
  const cardsWrap = h("div", { class: "stats stats-4x2" },
    card("mcap", "Crypto market cap"), card("vol", "Crypto 24h volume"),
    card("dom", "Dominance"), card("dex", "DEX volume"),
    card("fng", "Fear & Greed"), card("stbl", "Stablecoin supply"),
    card("tvl", "DeFi TVL"), card("uni", "Exchange pairs"));

  let summaryOpen = () => openCardDetail("mcap");
  const summaryKicker = h("div", { class: "ms-kicker" }, icon("activity"), h("span", {}, "Global market pulse"));
  const summaryValue = h("div", { class: "ms-value num" }, "—");
  const summaryDelta = h("div", { class: "ms-delta num" }, "Connecting");
  const summarySource = h("div", { class: "ms-source" }, "Data connecting");
  const summaryChart = h("div", { class: "ms-chart" });
  const summaryRail = h("div", { class: "ms-rail" });
  const summaryPanel = h("section", {
    class: "market-summary",
    id: "sec-global",
    role: "button",
    tabindex: "0",
    onClick: () => summaryOpen(),
    onKeydown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        summaryOpen();
      }
    },
  },
    h("div", { class: "ms-main" },
      summaryKicker,
      h("div", { class: "ms-headline" }, summaryValue, summaryDelta),
      summaryChart,
      summarySource),
    summaryRail);
  let summaryFallbackKey = "";

  const lensWrap = h("section", { class: "market-lens" });
  const activityStrip = h("section", { class: "activity-strip", "aria-label": "Live market activity" });
  const cryptoLensWrap = h("section", { class: "market-lens crypto-lens" });
  const cryptoSection = h("section", { class: "crypto-defi-section", id: "sec-crypto" },
    h("div", { class: "sec-head crypto-defi-head" },
      h("div", {},
        h("h2", { class: "sec-title" }, "Crypto & DeFi"),
        h("p", { class: "sec-note" }, "CoinGecko, DefiLlama and exchange stream data stays here. It is not used as a proxy for global markets.")),
      h("button", { class: "ghost-btn", onClick: () => navigate("/radar") }, icon("radar"), "Open radar")),
    cryptoLensWrap,
    cardsWrap,
    activityStrip);

  let atlasCategory = "global";
  let atlasSymbol = MARKET_ATLAS_BY_ID.get(atlasCategory).primary;
  let atlasRange = MARKET_ATLAS_BY_ID.get(atlasCategory).range;
  let atlasWidgetKey = "";
  let atlasChartNonce = 0;
  let atlasTapeKey = "";
  const atlasKicker = h("div", { class: "atlas-kicker" }, h("span", { class: "scan-dot" }), "Global market structure");
  const atlasTitle = h("h2", { class: "atlas-title" }, "Markets, everywhere");
  const atlasLead = h("p", { class: "atlas-lead" }, "Loading market structure…");
  const atlasSource = h("div", { class: "atlas-source" }, "Data connecting");
  const atlasNotices = h("div", { class: "atlas-notices" });
  const atlasInsights = h("div", { class: "atlas-insights", "aria-label": "Selected market data cards" });
  const atlasSymbols = h("div", { class: "atlas-symbols" });
  const atlasTape = h("div", { class: "atlas-tv-tape" });
  const atlasRanges = h("div", { class: "atlas-ranges", role: "tablist", "aria-label": "Chart range" });
  const atlasChart = h("div", { class: "atlas-chart" });
  const atlasGroups = h("div", { class: "atlas-groups" });
  const marketAtlas = h("section", { class: "market-atlas", id: "sec-global" },
    h("div", { class: "atlas-head" },
      h("div", { class: "atlas-head-copy" }, atlasKicker, atlasTitle, atlasLead)),
    atlasNotices,
    atlasInsights,
    atlasTape,
    atlasSymbols,
    h("div", { class: "atlas-chart-shell" },
      h("div", { class: "atlas-chart-top" },
        h("div", { class: "atlas-chart-label" },
          h("span", { class: "atlas-chart-symbol num" }, "—"),
          h("span", { class: "atlas-chart-name" }, "")),
        atlasRanges),
      atlasChart),
    h("div", { class: "atlas-foot" }, atlasSource, atlasGroups));

  const taxonomyWrap = h("section", { class: "market-taxonomy", "aria-label": "Market asset classes" },
    MARKET_ATLAS_CATEGORIES.map((cat) => marketTaxonomyButton(cat)));

  function marketTaxonomyButton(cat) {
    return h("button", {
      class: "market-taxonomy-pill",
      dataset: { atlasCategory: cat.id },
      onClick: () => setAtlasCategory(cat.id, true),
      title: cat.lead,
    },
      h("span", { class: "mtp-label" }, cat.label));
  }

  function setAtlasCategory(id, scroll = false) {
    const next = MARKET_ATLAS_BY_ID.get(id) || MARKET_ATLAS_BY_ID.get("indices");
    atlasCategory = next.id;
    atlasSymbol = next.primary;
    atlasRange = next.range || "12M";
    atlasWidgetKey = "";
    atlasTapeKey = "";
    boardFilter = "all";
    boardSortKey = null;
    boardSortDir = -1;
    boardShow = defaultBoardShow(next.id);
    paintMarketAtlas();
    paintSectorBoard();
    paintTopMovers();
    if (scroll && taxonomyWrap.isConnected) {
      const rect = taxonomyWrap.getBoundingClientRect();
      const headerClearance = 86;
      if (rect.top < headerClearance || rect.bottom > window.innerHeight - 18) {
        taxonomyWrap.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  function atlasCfg() {
    return MARKET_ATLAS_BY_ID.get(atlasCategory) || MARKET_ATLAS_BY_ID.get("indices");
  }
  function atlasSymbolDef(symbol = atlasSymbol) {
    return (atlasCfg().symbols || []).find((s) => s.s === symbol) || atlasCfg().symbols[0];
  }
  function atlasInterval(range) {
    if (range === "1D") return "5";
    if (range === "1M" || range === "3M") return "60";
    if (range === "12M") return "D";
    if (range === "60M") return "W";
    return "M";
  }
  function atlasLogo(item, size = 34) {
    if (item.base) return coinIcon({ base: item.base }, size);
    if (item.wordLogo) {
      return h("span", {
        class: "atlas-word-logo " + (size <= 28 ? "compact " : "") + (String(item.wordLogo).length > 9 ? "wide " : "") + (item.tone || ""),
        style: { "--logo-size": size + "px" },
      }, item.wordLogo);
    }
    if (item.logo) {
      const img = h("img", {
        class: "atlas-logo-img",
        src: `https://s3-symbol-logo.tradingview.com/${item.logo}.svg`,
        alt: "",
        loading: "lazy",
        referrerpolicy: "no-referrer",
      });
      img.addEventListener("error", () => img.replaceWith(atlasBadge(item, size)), { once: true });
      return img;
    }
    return atlasBadge(item, size);
  }
  function atlasBadge(item, size = 34) {
    return h("span", {
      class: "atlas-badge " + (item.tone || "neutral"),
      style: { width: size + "px", height: size + "px" },
    }, item.badge || String(item.short || item.d || "?").slice(0, 2));
  }
  function atlasLocalMeta(item) {
    if (!ov) return null;
    if (item.base) {
      const coin = ((ov.top_coins || {}).coins || []).find((c) => c.base === item.base);
      if (!coin) return null;
      return {
        value: fmtPrice(px(coin)),
        move: coin.chg24h != null ? moveValue(coin.chg24h) : "",
        cls: signClass(coin.chg24h),
        sub: "CoinGecko + exchange tape",
      };
    }
    const fx = atlasFxMeta(item);
    if (fx) return fx;
    if (item.yahoo) {
      const it = worldItem(item.yahoo);
      if (!it) return null;
      return {
        value: wmVal(it),
        move: it.chg_pct != null ? moveValue(it.chg_pct) : "",
        cls: signClass(it.chg_pct),
        sub: "Yahoo cached quote",
      };
    }
    return null;
  }
  function atlasFxMeta(item) {
    const fx = (ov && ov.fx) || {};
    const r = fx.rates || {};
    let value = null;
    if (item.s === "FX_IDC:EURUSD" && r.EUR) value = 1 / Number(r.EUR);
    else if (item.s === "FX_IDC:USDJPY" && r.JPY) value = Number(r.JPY);
    else if (item.s === "FX_IDC:GBPUSD" && r.GBP) value = 1 / Number(r.GBP);
    else if (item.s === "FX_IDC:USDCHF" && r.CHF) value = Number(r.CHF);
    if (value == null || !isFinite(value)) return null;
    const digits = value < 20 ? 5 : 3;
    return {
      value: value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }),
      move: "spot snapshot",
      cls: "",
      sub: "open.er-api FX snapshot",
      state: fx.status || "live",
      raw: value,
    };
  }
  function atlasCoinFor(item) {
    if (!item || !item.base || !ov) return null;
    return ((ov.top_coins || {}).coins || []).find((c) => c.base === item.base) || null;
  }
  function atlasCardShell({
    item, label, value, sub, source, state, tone, iconName, visual, onClick, logo,
  }) {
    const clickable = typeof onClick === "function";
    const sourceState = state || "live";
    const showSourceFoot = ["error", "requires_key", "not_configured", "disabled", "unavailable"].includes(sourceState);
    const props = {
      class: "atlas-insight-card " + (tone || "") + (clickable ? " clickable" : ""),
      role: "listitem",
    };
    if (clickable) {
      props.type = "button";
      props.onClick = onClick;
    }
    const el = h(clickable ? "button" : "div", props,
      h("div", { class: "atlas-insight-head" },
        h("span", { class: "atlas-insight-logo" }, logo || (item ? atlasLogo(item, 34) : icon(iconName || "activity"))),
        h("span", { class: "atlas-insight-copy" },
          h("b", {}, label || (item && item.d) || "Market"),
          h("small", { class: "num" }, source || "—"))),
      h("div", { class: "atlas-insight-value num" }, value == null ? "—" : value),
      h("div", { class: "atlas-insight-sub num " + (tone || "") }, sub || ""),
      h("div", { class: "atlas-insight-visual" }, visual || atlasSourceVisual(sourceState)),
      showSourceFoot ? h("div", { class: "atlas-insight-source " + statusClass(sourceState) },
        h("span", { class: "source-dot" }),
        h("span", {}, source || "embedded chart"),
        h("b", {}, statusWord({ status: sourceState }))) : null);
    return el;
  }
  function atlasSourceVisual(state = "live") {
    const label = statusWord({ status: state }).replace(/\s+/g, " ").slice(0, 6).toUpperCase();
    return h("span", { class: "atlas-source-visual " + statusClass(state), "aria-hidden": "true" },
      Array.from({ length: 16 }, (_, i) => h("i", { style: { "--i": i } })),
      h("em", {}, label || "LIVE"));
  }
  function atlasSparkVisual(values, tone = "") {
    const vals = cleanSeries(values);
    if (vals.length >= 6) {
      const up = vals[vals.length - 1] >= vals[0];
      const color = tone === "down" ? "var(--down)" : tone === "up" ? "var(--up)" : up ? "var(--up)" : "var(--down)";
      return h("span", { class: "atlas-spark-visual", html: sparkArea(vals, 210, 62, color, { dots: true, endDot: true }) });
    }
    return null;
  }
  function atlasBarsVisual(values) {
    const vals = cleanSeries(values);
    return vals.length >= 3 ? h("span", { class: "atlas-bars-visual", html: barsSvg(vals, 210, 62) }) : null;
  }
  function atlasDonutVisual(parts) {
    return h("span", { class: "atlas-donut-visual", html: donutSvg(parts) });
  }
  function atlasGaugeVisual(value) {
    return value != null ? h("span", { class: "atlas-gauge-visual", html: gaugeSvg(value) }) : null;
  }
  function atlasShareVisual(parts) {
    return h("span", { class: "atlas-share-visual", html: shareBarSvg(parts) });
  }
  function atlasUnavailableSource(item) {
    if (item && item.yahoo) return "embedded chart";
    if (item && item.s) return item.s.includes("FRED:") ? "FRED" : "embedded chart";
    return "source unavailable";
  }
  function atlasRouteValue(item) {
    if (!item) return "Chart";
    return item.short || item.badge || String(item.s || item.d || "Chart").replace(/^[A-Z_]+:/, "");
  }
  function atlasRouteSub(item) {
    if (!item) return "route available";
    if (item.yahoo) return item.yahoo.replace(/\^/g, "");
    return String(item.s || "").replace(/^[A-Z_]+:/, "") || "route available";
  }
  function globalWorldInsight(label, symbols, iconName, tone = "blue") {
    const item = worldFirst(symbols);
    const state = worldState();
    if (!item) {
      const fallback = (MARKET_ATLAS_BY_ID.get("global").symbols || [])
        .find((s) => symbols.includes(s.yahoo) || symbols.includes(s.short) || symbols.includes(s.s));
      return atlasCardShell({
        item: fallback,
        label,
        value: fallback ? fallback.short : "Chart",
        sub: "chart route active; quotes limited",
        source: "TradingView chart · Yahoo quotes limited",
        state: "chart_route",
        tone,
        iconName,
        visual: atlasSourceVisual("chart_route"),
        onClick: () => {
          if (fallback) {
            atlasSymbol = fallback.s;
            atlasChartNonce += 1;
            atlasWidgetKey = "";
            paintMarketAtlas();
          } else {
            openDataSheet();
          }
        },
      });
    }
    return atlasCardShell({
      item,
      label,
      value: wmVal(item),
      sub: item.chg_pct != null ? `${item.name} ${moveValue(item.chg_pct)}` : item.name,
      source: `${(ov.world || {}).source || "Yahoo Finance"} · ${item.group_label || item.group || "markets"}`,
      state,
      tone: signClass(item.chg_pct) || tone,
      visual: atlasSparkVisual(item.spark || [], signClass(item.chg_pct)),
      onClick: () => openWorldDetail(item),
    });
  }
  function worldLaneNote() {
    // One honest line replaces three dead dash-cards when the Yahoo quote
    // lane is empty. Missing data never gets card furniture.
    const st = worldState();
    return h("button", { class: "atlas-lane-note " + statusClass(st), onClick: () => openDataSheet() },
      h("span", { class: "source-dot" }),
      h("b", {}, "World quotes limited"),
      h("span", {}, "Yahoo is rate-limiting the keyless quote cache. Index, FX and bond chart routes remain available."),
      h("em", { class: "num" }, worldCopy()));
  }
  function globalAtlasInsights() {
    const g = (ov && ov.global) || {};
    const gh = (ov && ov.global_history) || {};
    const dx = (ov && ov.dex) || {};
    const st = (ov && ov.stablecoins) || {};
    const df = (ov && ov.defi) || {};
    const cryptoMove = g.mcap_change_24h_pct;
    const worldCards = [
      globalWorldInsight("US equity pulse", ["^GSPC", "^IXIC"], "activity", "blue"),
      globalWorldInsight("Rates pressure", ["^TNX", "^FVX"], "target", "green"),
      globalWorldInsight("Dollar / gold", ["DX-Y.NYB", "DXY", "GC=F"], "globe", "gold"),
    ];
    return [
      ...worldCards,
      atlasCardShell({
        label: "Crypto market cap",
        value: g.mcap_usd != null ? fmtMoney(g.mcap_usd) : "—",
        sub: cryptoMove != null ? `${moveValue(cryptoMove)} · 24h` : "global crypto cap",
        source: (g.source || "coingecko") + " · market size",
        state: g.status,
        tone: signClass(cryptoMove) || "green",
        iconName: "globe",
        visual: atlasSparkVisual(gh.mcap || [], signClass(cryptoMove)),
        onClick: () => openCardDetail("mcap"),
      }),
      atlasCardShell({
        label: "Crypto 24h volume",
        value: g.volume_usd != null ? fmtMoney(g.volume_usd) : "—",
        sub: g.volume_usd && g.mcap_usd ? `vol/mcap ${((g.volume_usd / g.mcap_usd) * 100).toFixed(1)}%` : "global spot volume",
        source: (g.source || "coingecko") + " · market flow",
        state: g.status,
        tone: "blue",
        iconName: "barChart",
        visual: atlasSourceVisual(g.status || "live"),
        onClick: () => openCardDetail("vol"),
      }),
      atlasCardShell({
        label: "DEX volume",
        value: dx.total24h_usd != null ? fmtMoney(dx.total24h_usd) : "—",
        sub: dx.change_1d_pct != null ? `${moveValue(dx.change_1d_pct)} · 24h` : "daily DEX flow",
        source: "defillama · daily bars",
        state: dx.status,
        tone: signClass(dx.change_1d_pct) || "pink",
        iconName: "activity",
        visual: atlasBarsVisual((dx.bars || []).map((b) => b[1])),
        onClick: () => openCardDetail("dex"),
      }),
      atlasCardShell({
        label: "Stablecoin float",
        value: st.total_usd != null ? fmtMoney(st.total_usd) : "—",
        sub: st.usdt_share_pct != null ? `USDT ${st.usdt_share_pct.toFixed(1)}% · USDC ${st.usdc_share_pct.toFixed(1)}%` : "stablecoin supply",
        source: "defillama · stables",
        state: st.status,
        tone: "green",
        iconName: "database",
        visual: atlasShareVisual([
          { label: "USDT", pct: st.usdt_share_pct || 0, color: "#26A17B" },
          { label: "USDC", pct: st.usdc_share_pct || 0, color: "#2775CA" },
          { label: "Other", pct: Math.max(0, 100 - (st.usdt_share_pct || 0) - (st.usdc_share_pct || 0)), color: "var(--line-strong)" },
        ]),
        onClick: () => openCardDetail("stbl"),
      }),
      atlasCardShell({
        label: "DeFi TVL",
        value: df.tvl_usd != null ? fmtMoney(df.tvl_usd) : "—",
        sub: "chain/protocol TVL",
        source: "defillama · TVL",
        state: df.status,
        tone: "violet",
        iconName: "candles",
        visual: atlasSparkVisual(df.chart || [], "down"),
        onClick: () => openCardDetail("tvl"),
      }),
    ];
  }
  function atlasSymbolInsight(item, idx = 0) {
    const meta = atlasLocalMeta(item);
    const world = item.yahoo ? worldItem(item.yahoo) : null;
    const coin = atlasCoinFor(item);
    const tone = meta && meta.cls ? meta.cls : idx % 3 === 0 ? "blue" : idx % 3 === 1 ? "green" : "violet";
    const visual = coin ? atlasSparkVisual(latestSpark(coin), signClass(coin.chg24h))
      : world ? atlasSparkVisual(world.spark || [], signClass(world.chg_pct))
      : atlasSourceVisual(meta ? (meta.state || "live") : "live");
    return atlasCardShell({
      item,
      label: item.d,
      value: meta ? meta.value : atlasRouteValue(item),
      sub: meta ? meta.move : atlasRouteSub(item),
      source: meta ? meta.sub : atlasUnavailableSource(item),
      state: meta ? (meta.state || ((ov && ov.world) || {}).status || "live") : "live",
      tone,
      visual,
      onClick: () => {
        atlasSymbol = item.s;
        atlasChartNonce += 1;
        atlasWidgetKey = "";
        paintMarketAtlas();
      },
    });
  }
  function cryptoAtlasInsights() {
    const g = (ov && ov.global) || {};
    const gh = (ov && ov.global_history) || {};
    const fg = (ov && ov.fear_greed) || {};
    const st = (ov && ov.stablecoins) || {};
    const df = (ov && ov.defi) || {};
    const dx = (ov && ov.dex) || {};
    const m = (ov && ov.metrics) || {};
    const btcDom = g.btc_dominance || 0;
    const ethDom = g.eth_dominance || 0;
    const usdt = st.usdt_share_pct || 0;
    const usdc = st.usdc_share_pct || 0;
    return [
      atlasCardShell({
        label: "Crypto market cap",
        value: g.mcap_usd != null ? fmtMoney(g.mcap_usd) : "—",
        sub: g.mcap_change_24h_pct != null ? `${moveValue(g.mcap_change_24h_pct)} · 24h` : "",
        source: (g.source || "coingecko") + " · 7d",
        state: g.status,
        tone: signClass(g.mcap_change_24h_pct) || "green",
        iconName: "globe",
        visual: atlasSparkVisual(gh.mcap || [], signClass(g.mcap_change_24h_pct)),
        onClick: () => openCardDetail("mcap"),
      }),
      atlasCardShell({
        label: "Crypto 24h volume",
        value: g.volume_usd != null ? fmtMoney(g.volume_usd) : "—",
        sub: g.volume_usd && g.mcap_usd ? `vol/mcap ${((g.volume_usd / g.mcap_usd) * 100).toFixed(1)}%` : "",
        source: g.source || "coingecko",
        state: g.status,
        tone: "blue",
        iconName: "barChart",
        visual: atlasSourceVisual(g.status || "live"),
        onClick: () => openCardDetail("vol"),
      }),
      atlasCardShell({
        label: "Dominance",
        value: g.btc_dominance != null ? `BTC ${g.btc_dominance.toFixed(1)}%` : "—",
        sub: g.eth_dominance != null ? `ETH ${g.eth_dominance.toFixed(1)}%` : "",
        source: g.source || "coingecko",
        state: g.status,
        tone: "gold",
        iconName: "target",
        visual: atlasDonutVisual([
          { label: "BTC", pct: btcDom, color: "#F7931A" },
          { label: "ETH", pct: ethDom, color: "#627EEA" },
          { label: "Others", pct: Math.max(0, 100 - btcDom - ethDom), color: "var(--line-strong)" },
        ]),
        onClick: () => openCardDetail("dom"),
      }),
      atlasCardShell({
        label: "DEX volume",
        value: dx.total24h_usd != null ? fmtMoney(dx.total24h_usd) : "—",
        sub: dx.change_1d_pct != null ? `${moveValue(dx.change_1d_pct)} · 24h` : "",
        source: "defillama · daily bars",
        state: dx.status,
        tone: signClass(dx.change_1d_pct) || "pink",
        iconName: "activity",
        visual: atlasBarsVisual((dx.bars || []).map((b) => b[1])),
        onClick: () => openCardDetail("dex"),
      }),
      atlasCardShell({
        label: "Fear & Greed",
        value: fg.value != null ? `${fg.value} · ${fg.label || ""}` : "—",
        sub: fg.value != null ? fngBandLabel(fg.value) : "",
        source: "alternative.me",
        state: fg.status,
        tone: fg.value != null && fg.value <= 25 ? "down" : fg.value != null && fg.value >= 75 ? "up" : "amber",
        iconName: "gauge",
        visual: atlasGaugeVisual(fg.value),
        onClick: () => openCardDetail("fng"),
      }),
      atlasCardShell({
        label: "Stablecoin supply",
        value: st.total_usd != null ? fmtMoney(st.total_usd) : "—",
        sub: st.usdt_share_pct != null ? `USDT ${st.usdt_share_pct.toFixed(1)}%` : "",
        source: "defillama",
        state: st.status,
        tone: "green",
        iconName: "database",
        visual: atlasShareVisual([
          { label: "USDT", pct: usdt, color: "#26A17B" },
          { label: "USDC", pct: usdc, color: "#2775CA" },
          { label: "Other", pct: Math.max(0, 100 - usdt - usdc), color: "var(--line-strong)" },
        ]),
        onClick: () => openCardDetail("stbl"),
      }),
      atlasCardShell({
        label: "DeFi TVL",
        value: df.tvl_usd != null ? fmtMoney(df.tvl_usd) : "—",
        sub: "chain/protocol TVL",
        source: "defillama",
        state: df.status,
        tone: "violet",
        iconName: "candles",
        visual: atlasSparkVisual(df.chart || [], "down"),
        onClick: () => openCardDetail("tvl"),
      }),
      atlasCardShell({
        label: "Exchange pairs",
        value: m.total_symbols != null ? `${m.total_symbols} pairs` : "—",
        sub: m.live_symbols != null ? `${m.live_symbols} live · open Radar` : "exchange stream",
        source: "exchange public stream",
        state: "live",
        tone: "blue",
        iconName: "radio",
        visual: atlasSourceVisual("live"),
        onClick: () => navigate("/radar"),
      }),
    ];
  }
  function stockAtlasInsights(cfg) {
    return (cfg.symbols || []).slice(0, 8).map(atlasSymbolInsight);
  }
  function economyAtlasInsights(cfg) {
    const rows = (cfg.symbols || []).map((item, idx) => atlasCardShell({
      item,
      label: item.d,
      value: atlasRouteValue(item),
      sub: atlasRouteSub(item),
      source: item.s && item.s.includes("FRED:") ? "FRED" : "embedded chart",
      state: "live",
      tone: idx % 2 ? "blue" : "green",
      visual: atlasSourceVisual("live"),
      onClick: () => {
        atlasSymbol = item.s;
        atlasChartNonce += 1;
        atlasWidgetKey = "";
        paintMarketAtlas();
      },
    }));
    return rows.slice(0, 8);
  }
  function atlasInsightCards(cfg) {
    if (!ov) return [];
    if (cfg.id === "global") return globalAtlasInsights();
    if (cfg.id === "crypto") return cryptoAtlasInsights();
    if (cfg.id === "us-stocks" || cfg.id === "world-stocks") return stockAtlasInsights(cfg);
    if (cfg.id === "economy") return economyAtlasInsights(cfg);
    return (cfg.symbols || []).slice(0, 8).map(atlasSymbolInsight);
  }
  function atlasSymbolButton(item) {
    const meta = atlasLocalMeta(item);
    const active = item.s === atlasSymbol;
    return h("button", {
      class: "atlas-symbol-card" + (active ? " active" : ""),
      onClick: () => { atlasSymbol = item.s; atlasChartNonce += 1; atlasWidgetKey = ""; paintMarketAtlas(); },
      title: item.d + " · " + item.s,
    },
      atlasLogo(item, 34),
      h("span", { class: "atlas-symbol-copy" },
        h("b", {}, item.d),
        h("span", { class: "num" }, item.short || item.s)),
        h("span", { class: "atlas-symbol-data" },
        h("strong", { class: "num" }, meta ? meta.value : atlasRouteValue(item)),
        h("small", { class: "num " + (meta ? meta.cls : "") }, meta ? meta.move : "chart")));
  }
  function atlasGroupRow(item) {
    const meta = atlasLocalMeta(item);
    return h("button", {
      class: "atlas-group-row" + (item.s === atlasSymbol ? " active" : ""),
      onClick: () => { atlasSymbol = item.s; atlasChartNonce += 1; atlasWidgetKey = ""; paintMarketAtlas(); },
    },
      atlasLogo(item, 28),
      h("span", { class: "atlas-group-name" },
        h("b", {}, item.d),
        h("small", { class: "num" }, item.s)),
      h("span", { class: "atlas-group-value" },
        h("b", { class: "num" }, meta ? meta.value : atlasRouteValue(item)),
        h("small", { class: "num " + (meta ? meta.cls : "") }, meta ? meta.move : "chart")));
  }
  function atlasGroupsView(cfg) {
    const bySymbol = new Map((cfg.symbols || []).map((s) => [s.s, s]));
    return (cfg.groups || []).map(([title, symbols]) =>
      h("div", { class: "atlas-group" },
        h("div", { class: "atlas-group-title" }, title),
        symbols.map((sym) => {
          const item = bySymbol.get(sym);
          return item ? atlasGroupRow(item) : null;
        }).filter(Boolean)));
  }
  function tradingViewTickerTape(cfg) {
    return h("div", { class: "atlas-tape-widget atlas-tape-local" },
      (cfg.symbols || []).slice(0, 14).map((it) => {
        const meta = atlasLocalMeta(it);
        return h("button", {
          class: "atlas-tape-chip" + (it.s === atlasSymbol ? " active" : ""),
          onClick: () => { atlasSymbol = it.s; atlasChartNonce += 1; atlasWidgetKey = ""; paintMarketAtlas(); },
          title: `${it.d} · ${it.s}`,
        },
            atlasLogo(it, 22),
          h("span", { class: "atlas-tape-copy" },
            h("b", {}, it.short || it.d),
            h("small", { class: "num " + (meta ? meta.cls : "") }, meta ? meta.move : "chart")));
      }));
  }
  function tradingViewAdvancedChart(symbol, cfg) {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    const theme = dark ? "dark" : "light";
    const item = atlasSymbolDef(symbol);
    const params = new URLSearchParams({
      symbol,
      interval: atlasInterval(atlasRange),
      theme,
      style: "3",
      locale: "en",
      hidesidetoolbar: "1",
      hide_top_toolbar: "1",
      symboledit: "0",
      saveimage: "0",
      withdateranges: "1",
      backgroundColor: dark ? "#050607" : "#ffffff",
      gridColor: dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
      studies: "[]",
      support_host: "https://www.tradingview.com",
      widget_reload: String(atlasChartNonce),
    });
    const box = h("div", { class: "tradingview-widget-container atlas-chart-widget" },
      h("iframe", {
        src: `https://s.tradingview.com/widgetembed/?${params.toString()}`,
        title: `${item ? item.d : symbol} TradingView chart`,
        loading: "lazy",
        allow: "fullscreen",
      }),
      h("div", { class: "tradingview-widget-copyright" },
        h("a", {
          href: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`,
          rel: "noopener nofollow",
          target: "_blank",
        }, h("span", { class: "blue-text" }, item ? item.d : symbol)),
        h("span", { class: "trademark" }, " by TradingView")));
    return box;
  }
  function syncAtlasNav() {
    taxonomyWrap.querySelectorAll(".market-taxonomy-pill").forEach((btn) => {
      const on = btn.dataset.atlasCategory === atlasCategory;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  function paintMarketAtlas() {
    const cfg = atlasCfg();
    if (!cfg.symbols.some((s) => s.s === atlasSymbol)) atlasSymbol = cfg.primary;
    atlasTitle.textContent = cfg.title;
    atlasLead.textContent = cfg.lead;
    const active = atlasSymbolDef();
    const meta = active ? atlasLocalMeta(active) : null;
    marketAtlas.dataset.marketAtlas = cfg.id;
    const compactIndex = cfg.id === "global" || cfg.id === "indices";
    marketAtlas.classList.toggle("atlas-compact-index", compactIndex);
    mount(atlasNotices, (cfg.id === "global" && ov && !worldItems().length) ? [worldLaneNote()] : []);
    mount(atlasInsights, atlasInsightCards(cfg));
    mount(atlasSymbols, compactIndex ? [] : cfg.symbols.map(atlasSymbolButton));
    mount(atlasRanges, ATLAS_RANGES.map(([range, label]) =>
      h("button", {
        class: "atlas-range" + (atlasRange === range ? " active" : ""),
        role: "tab",
        "aria-selected": atlasRange === range ? "true" : "false",
        onClick: () => { atlasRange = range; atlasWidgetKey = ""; paintMarketAtlas(); },
      }, label)));
    mount(atlasGroups, compactIndex ? [] : atlasGroupsView(cfg));
    atlasSource.textContent = meta && meta.sub ? meta.sub : "Live chart · quotes fill in when the provider responds";
    const chartLabel = atlasChart.parentElement && atlasChart.parentElement.querySelector(".atlas-chart-label");
    if (chartLabel && active) {
      const sym = chartLabel.querySelector(".atlas-chart-symbol");
      const name = chartLabel.querySelector(".atlas-chart-name");
      if (sym) sym.textContent = active.short || active.s;
      if (name) name.textContent = active.d;
    }
    const theme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const nextTapeKey = [theme, cfg.id, cfg.symbols.map((s) => s.s).join("|")].join(":");
    if (atlasTapeKey !== nextTapeKey || !atlasTape.querySelector(".atlas-tape-widget")) {
      atlasTapeKey = nextTapeKey;
      mount(atlasTape, tradingViewTickerTape(cfg));
    }
    const nextChartKey = [theme, atlasSymbol, atlasRange, cfg.id, atlasChartNonce].join(":");
    if (atlasWidgetKey !== nextChartKey || !atlasChart.querySelector(".atlas-chart-widget")) {
      atlasWidgetKey = nextChartKey;
      mount(atlasChart, tradingViewAdvancedChart(atlasSymbol, cfg));
    }
    syncAtlasNav();
    syncSectorVisibility();
  }
  function syncSectorVisibility() {
    const cryptoOn = atlasCategory === "crypto" && !binanceOnly();
    const exchangeTapeOn = atlasCategory === "crypto" || binanceOnly();
    tape.el.classList.toggle("market-tape-hidden", !exchangeTapeOn);
    tape.el.setAttribute("aria-hidden", exchangeTapeOn ? "false" : "true");
    cryptoSection.style.display = cryptoOn ? "" : "none";
    moversSection.style.display = binanceOnly() ? "none" : "";
    intelSection.style.display = cryptoOn ? "" : "none";
  }

  function sourceState(id) {
    return ((ov && ov.source_status) || []).find((s) => s.id === id) || {};
  }
  function statusWord(st) {
    const s = (st && st.status) || "unavailable";
    if (s === "live") return "live";
    if (s === "delayed") return "delayed";
    if (s === "stale") return "stale";
    if (s === "requires_key") return "key required";
    if (s === "not_configured") return "not configured";
    if (s === "tree_backed") return "tree relay";
    if (s === "chart_route") return "chart";
    return s;
  }
  function worldGroups() {
    return (((ov && ov.world) || {}).groups || []);
  }
  function worldItems() {
    return worldGroups().flatMap((g) => (g.items || []).map((it) => ({ ...it, group_label: g.label })));
  }
  function worldItem(symbol) {
    const wanted = String(symbol || "").toUpperCase();
    return worldItems().find((it) => String(it.symbol || "").toUpperCase() === wanted) || null;
  }
  function worldFirst(symbols) {
    for (const symbol of symbols) {
      const it = worldItem(symbol);
      if (it) return it;
    }
    return null;
  }
  function worldMove(it) {
    return it && it.chg_pct != null ? moveValue(it.chg_pct) : "—";
  }
  function worldState() {
    return ((ov && ov.world) || {}).status || "warming";
  }
  function worldCopy() {
    const s = worldState();
    if (s === "live") return "quotes live";
    if (s === "stale") return "quote cache stale";
    if (s === "warming" || s === "idle") return "quotes warming";
    return "chart routes live; quote cache limited";
  }
  function lensCell(label, value, sub, cls, ic, run, state = "live") {
    const disabled = typeof run !== "function";
    return h("button", {
      class: "lens-cell " + (cls || "") + (disabled ? " disabled" : ""),
      disabled,
      onClick: disabled ? null : run,
    },
      h("span", { class: "lens-ic" }, icon(ic || "activity")),
      h("span", { class: "lens-k" }, label),
      h("span", { class: "lens-v num" }, value || "—"),
      h("span", { class: "lens-sub" }, sub || ""),
      h("span", { class: "lens-state " + (state === "live" ? "ok" : state === "requires_key" || state === "not_configured" ? "muted" : "warn") },
        statusWord({ status: state })));
  }
  function paintLens() {
    if (!ov || binanceOnly()) { lensWrap.replaceChildren(); cryptoLensWrap.replaceChildren(); return; }
    const g = ov.global || {};
    const dx = ov.dex || {};
    const df = ov.defi || {};
    const st = ov.stablecoins || {};
    const stocks = (ov.stocks && ov.stocks.items) || [];
    const newsItems = (news && news.items) || [];
    const topStock = [...stocks].sort((a, b) => Math.abs(b.chg24h || 0) - Math.abs(a.chg24h || 0))[0];
    const lead = newsItems[0];
    const spx = worldItem("^GSPC");
    const ndx = worldItem("^IXIC");
    const india = worldFirst(["^NSEI", "^BSESN"]);
    const dxy = worldFirst(["DX-Y.NYB", "DXY"]);
    const tenY = worldItem("^TNX");
    const gold = worldItem("GC=F");
    // ASSET-CLASS SEPARATION (TradingView discipline): TradFi and crypto never
    // share a block. A feed with no live data is simply NOT rendered — no
    // "Awaiting feed" placeholders occupying front-page real estate.
    const tradfi = [];
    if (spx) tradfi.push(lensCell("US equities", `${wmVal(spx)} · ${worldMove(spx)}`,
      ndx ? `Nasdaq ${worldMove(ndx)} · S&P 500` : "S&P 500", signClass(spx.chg_pct), "activity", () => openWorldDetail(spx), worldState()));
    if (india) tradfi.push(lensCell("India / Asia", `${india.name} ${worldMove(india)}`,
      "Nifty, Sensex, Nikkei, Hang Seng", signClass(india.chg_pct), "globe", () => openWorldDetail(india), worldState()));
    if (dxy || tenY) tradfi.push(lensCell("Dollar / rates", dxy ? `DXY ${wmVal(dxy)}` : `US10Y ${wmVal(tenY)}`,
      tenY ? `US 10Y ${worldMove(tenY)}` : "FX and rate pressure", dxy ? signClass(dxy.chg_pct) : signClass(tenY.chg_pct),
      "target", () => openWorldDetail(dxy || tenY), worldState()));
    if (gold) tradfi.push(lensCell("Gold", `Gold ${worldMove(gold)}`,
      "commodities as macro risk context", signClass(gold.chg_pct), "columns", () => openWorldDetail(gold), worldState()));

    const crypto = [
      lensCell("Crypto breadth", g.mcap_change_24h_pct != null ? `${trendText(g.mcap_change_24h_pct)} ${fmtPct(g.mcap_change_24h_pct)}` : "warming",
        g.mcap_usd != null ? `${fmtMoney(g.mcap_usd)} crypto cap` : "CoinGecko global", signClass(g.mcap_change_24h_pct), "globe", () => openCardDetail("mcap"), g.status),
      lensCell("Funding stress", (ov.funding_top || [])[0] ? `${baseOf(ov.funding_top[0].symbol)} ${fmtFunding(ov.funding_top[0].funding_rate)}` : "warming",
        "highest shorts-paying rate", "up", "zap", () => navigate("/funding"), "live"),
      lensCell("DEX impulse", dx.total24h_usd != null ? fmtMoney(dx.total24h_usd) : "warming",
        dx.change_1d_pct != null ? `${fmtPct(dx.change_1d_pct)} vs prior day` : "DefiLlama DEX volume", signClass(dx.change_1d_pct), "activity", () => openCardDetail("dex"), dx.status),
      lensCell("Stables float", st.total_usd != null ? fmtMoney(st.total_usd) : "warming",
        st.usdt_share_pct != null ? `USDT ${st.usdt_share_pct.toFixed(1)}% · USDC ${st.usdc_share_pct.toFixed(1)}%` : "DefiLlama stables", "", "database", () => openCardDetail("stbl"), st.status),
      lensCell("Tokenized equities", topStock ? `${topStock.base} ${fmtPct(topStock.chg24h)}` : (stocks.length ? `${stocks.length} wrappers` : "warming"),
        topStock ? `${topStock.name} · on-chain wrapper, not a cash quote` : "on-chain stock wrappers, not cash exchange quotes",
        topStock ? signClass(topStock.chg24h) : "", "columns", () => { tab = "stocks"; buildTabs(); paintPriceHead(); paintPrices(); stocksWrap.scrollIntoView({ behavior: "smooth", block: "start" }); }, (ov.stocks || {}).status),
      lensCell("News pulse", lead && lead.impact ? `${lead.impact} / 100` : "warming",
        lead ? `top story: ${(lead.tags || ["market"])[0]} · ${lead.domain}` : "Tree relay + RSS + Lookonchain", "", "radar", () => toggleWire(true), (news && news.status) || "idle"),
      lensCell("DeFi TVL", df.tvl_usd != null ? fmtMoney(df.tvl_usd) : "warming",
        "DefiLlama chain/protocol TVL", "", "candles", () => openCardDetail("tvl"), df.status),
    ];
    if (tradfi.length) {
      mount(lensWrap,
        h("div", { class: "lens-head" },
          h("div", {}, h("h2", { class: "lens-title" }, "World market intelligence"),
            h("p", { class: "lens-copy" }, "Indices, stocks, FX, rates and commodities only.")),
          h("button", { class: "mini-btn", onClick: () => openDataSheet() }, icon("database"), "Sources")),
        h("div", { class: "lens-grid" }, tradfi));
    } else {
      lensWrap.replaceChildren();
    }
    mount(cryptoLensWrap,
      h("div", { class: "lens-head" },
        h("div", {}, h("h2", { class: "lens-title" }, "Crypto intelligence"),
          h("p", { class: "lens-copy" }, "Crypto cap, funding, DeFi, stablecoins, tokenized wrappers and news pulse.")),
        h("button", { class: "mini-btn", onClick: () => openDataSheet() }, icon("database"), "Sources")),
      h("div", { class: "lens-grid" }, crypto));
  }

  function activeStatusCard(label, value, sub, ic, cls = "") {
    const bars = Array.from({ length: 7 }, (_, i) => h("i", { style: { "--i": i } }));
    return h("div", { class: "as-card " + cls },
      h("span", { class: "as-card-ic" }, icon(ic || "activity")),
      h("span", { class: "as-card-k" }, label),
      h("b", { class: "as-card-v num" }, value || "—"),
      h("span", { class: "as-card-sub" }, sub || ""),
      h("span", { class: "as-card-viz", "aria-hidden": "true" }, bars));
  }
  function activeCoin(c, idx) {
    const chg = c && c.chg24h != null ? Number(c.chg24h) : null;
    const sym = c.binance ? c.binance.symbol : c.base + "USDT";
    const vals = latestSpark(c);
    return h("button", {
      class: "orbit-coin " + signClass(chg),
      style: { "--delay": (-idx * 0.18) + "s" },
      title: `${c.name || c.base} · ${chg != null ? fmtPct(chg) : "warming"}`,
      onClick: () => navigate("/symbol/" + sym),
    },
      h("span", { class: "live-token-ring" }, coinIcon(c, 28)),
      h("span", { class: "orbit-sym" }, c.base),
      h("span", { class: "orbit-move num" }, chg != null ? moveValue(chg) : "—"),
      h("span", {
        class: "orbit-spark",
        html: vals.length >= 6
          ? sparkline(vals, 84, 24, chg != null && chg < 0 ? "var(--down)" : "var(--up)")
          : "",
      }));
  }
  function sourceHealthSummary(rows) {
    const all = rows || [];
    const active = all.filter((s) => s.status === "live" || s.status === "tree_backed").length;
    const warning = all.filter((s) => s.status === "delayed" || s.status === "stale" || s.status === "requires_key" || s.status === "not_configured").length;
    const total = Math.max(1, all.length);
    return {
      active,
      warning,
      total: all.length,
      pct: Math.max(6, Math.round((active / total) * 100)),
    };
  }
  function activityModule(label, sub, ic, cls, run, state = "live") {
    return h("button", {
      class: "as-module " + (cls || "") + " " + statusClass(state),
      "data-state": state,
      onClick: run,
    },
      h("span", { class: "as-module-ic" }, icon(ic || "activity")),
      h("span", { class: "as-module-copy" },
        h("b", { class: "as-module-k" }, label),
        h("span", { class: "as-module-sub" }, sub || "")),
      h("span", { class: "as-module-state" },
        h("i", { class: "as-module-dot" }),
        statusWord({ status: state })),
      h("span", { class: "as-module-arrow" }, "›"));
  }
  function paintActivityStrip() {
    if (!ov || binanceOnly()) { activityStrip.replaceChildren(); activityStrip.style.display = "none"; return; }
    activityStrip.style.display = "";
    const g = ov.global || {};
    const dx = ov.dex || {};
    const st = ov.stablecoins || {};
    const coins = ((ov.top_coins || {}).coins || [])
      .filter((c) => c.chg24h != null || c.volume != null)
      .sort((a, b) => Math.abs(b.chg24h || 0) - Math.abs(a.chg24h || 0))
      .slice(0, 14);
    const loop = coins.concat(coins);
    const sourceRows = (ov.source_status || [])
      .filter((s) => ["live", "delayed", "stale", "tree_backed", "error", "unavailable"].includes(s.status))
      .slice(0, 6);
    const sourceAll = ov.source_status || [];
    const sourceHealth = sourceHealthSummary(sourceAll);
    const fundingLeader = (ov.funding_top || [])[0];
    const stockItems = ((ov.stocks || {}).items || []);
    const leadNews = (news && news.items || [])[0];
    const modules = [
      activityModule("Data health", `${sourceHealth.active}/${sourceHealth.total || sourceHealth.active} sources active`, "database", "blue", () => openDataSheet(), sourceHealth.active ? "live" : "stale"),
      activityModule("News wire", leadNews ? `${leadNews.domain || leadNews.source || "wire"} · ${timeAgo(leadNews.ts || leadNews.time)}` : "Tree relay/RSS/Lookonchain warming", "radio", "green", () => toggleWire(true), (news && news.status) || "stale"),
      activityModule("Radar", "basis map + microstructure", "radar", "purple", () => navigate("/radar"), "live"),
      activityModule("Funding", fundingLeader ? `${baseOf(fundingLeader.symbol)} ${fmtFunding(fundingLeader.funding_rate)}` : "perp stress board", "zap", "amber", () => navigate("/funding"), fundingLeader ? "live" : "stale"),
      activityModule("Stocks", stockItems.length ? `${stockItems.length} tokenized equities` : "on-chain equity wrappers", "columns", "pink", () => {
        tab = "stocks";
        showCount = 25;
        buildTabs();
        paintPriceHead();
        paintPrices();
        stocksWrap.scrollIntoView({ behavior: "smooth", block: "start" });
      }, (ov.stocks || {}).status || "stale"),
      activityModule("Settings", `${getSettings().glassMode === "tinted" ? "Tinted" : "Clear"} glass · ${getSettings().motion}`, "sliders", "gray", () => openSettingsSheet(), "live"),
    ];
    mount(activityStrip,
      h("div", { class: "as-head" },
        h("div", {},
          h("div", { class: "as-kicker" }, h("span", { class: "scan-dot" }), "Crypto & DeFi live surface"),
          h("div", { class: "as-title" }, "Moving token tape, exchange health, and DeFi context")),
        h("button", { class: "as-news-btn", onClick: () => toggleWire(true) }, icon("radio"), "Open wire")),
      h("div", { class: "as-grid" },
        h("div", { class: "orbit-mask" },
          loop.length
            ? h("div", { class: "orbit-track" }, loop.map(activeCoin))
            : h("div", { class: "orbit-empty" }, icon("activity"), "Coin tape connecting")),
        h("div", { class: "as-status" },
          activeStatusCard("Crypto breadth", g.mcap_change_24h_pct != null ? moveValue(g.mcap_change_24h_pct) : "Awaiting feed",
            g.mcap_usd != null ? fmtMoney(g.mcap_usd) : "CoinGecko global", "globe", signClass(g.mcap_change_24h_pct)),
          activeStatusCard("DEX impulse", dx.total24h_usd != null ? fmtMoney(dx.total24h_usd) : "Awaiting feed",
            dx.change_1d_pct != null ? `${fmtPct(dx.change_1d_pct)} 24h` : "DefiLlama daily bars", "activity", signClass(dx.change_1d_pct)),
          activeStatusCard("Stable float", st.total_usd != null ? fmtMoney(st.total_usd) : "Awaiting feed",
            st.usdt_share_pct != null ? `USDT ${st.usdt_share_pct.toFixed(1)}%` : "supply watch", "database"))),
      h("div", { class: "as-control-panel" },
        h("div", { class: "as-control-head" },
          h("div", {},
            h("b", {}, "Market services"),
            h("span", {}, `${sourceHealth.active} active · ${sourceHealth.warning} warming · ${sourceHealth.total} tracked`)),
          h("button", { class: "as-small-pill", onClick: () => openDataSheet() }, icon("database"), "Manage")),
        h("div", { class: "as-health-line" },
          h("span", { class: "as-health-fill", style: { width: sourceHealth.pct + "%" } }),
          h("span", { class: "as-health-pulse" })),
        h("div", { class: "as-module-grid" }, modules)),
      sourceRows.length ? h("div", { class: "as-sources" }, sourceRows.map((s) =>
        h("button", { class: "as-source " + statusClass(s.status), onClick: () => openDataSheet(), title: s.detail || s.note || s.label },
          h("span", { class: "as-source-dot" }),
          h("span", { class: "as-source-name" }, s.label || s.id),
          h("b", {}, statusWord(s))))) : null);
  }

  function summaryAction(label, value, sub, cls, ic, run) {
    return h("button", { class: "ms-action " + (cls || ""), onClick: (e) => { e.stopPropagation(); run(); } },
      h("span", { class: "ms-ic" }, icon(ic || "activity")),
      h("span", { class: "ms-label" }, label),
      h("span", { class: "ms-act-v num" }, value == null ? "—" : value),
      h("span", { class: "ms-act-sub" }, sub || ""));
  }
  function cleanSeries(vals) {
    return (vals || []).map(Number).filter((x) => isFinite(x));
  }
  function latestSpark(c) {
    const sym = c && c.binance ? c.binance.symbol : c && c.base ? c.base + "USDT" : "";
    return cleanSeries((sym && sparks[sym]) || (c && (c.spark || c.sparkline)) || []);
  }
  function warmingBars(count = 24) {
    const nodes = [];
    for (let i = 0; i < count; i++) {
      const hgt = 16 + ((i * 19) % 56);
      nodes.push(h("span", { class: "ms-warm-bar", style: { "--h": hgt + "%", "--d": (i * 0.055) + "s" } }));
    }
    return nodes;
  }
  function fallbackChart(kind, values, cls = "") {
    const series = cleanSeries(values);
    if (series.length >= 6) {
      const up = series[series.length - 1] >= series[0];
      const color = cls === "down" ? "var(--down)" : cls === "warn" ? "var(--accent)" : up ? "var(--up)" : "var(--down)";
      return h("div", { class: "ms-mini-chart real" + (kind === "bars" ? " bars" : ""), html:
        kind === "bars" ? barsSvg(series, 210, 76) : sparkArea(series, 220, 76, color, { dots: true, endDot: true }) });
    }
    return h("div", { class: "ms-mini-chart warming", "aria-label": "Data warming" },
      h("div", { class: "ms-warm-grid" }, warmingBars(kind === "bars" ? 28 : 22)),
      h("span", { class: "ms-scan-line" }),
      h("span", { class: "ms-scan-dot" }));
  }
  function liveCoinButton(c, idx) {
    const move = c && c.chg24h != null ? Number(c.chg24h) : null;
    const sym = c && c.binance ? c.binance.symbol : c && c.base ? c.base + "USDT" : "";
    return h("button", {
      class: "ms-logo-coin " + signClass(move),
      style: { "--delay": (-idx * 0.21) + "s" },
      title: `${c.name || c.base} · ${move != null ? fmtPct(move) : "warming"}`,
      onClick: (e) => { e.stopPropagation(); if (sym) navigate("/symbol/" + sym); },
    },
      h("span", { class: "ms-logo-img" }, coinIcon(c, 30)),
      h("span", { class: "ms-logo-base" }, c.base),
      h("b", { class: "num" }, move != null ? moveValue(move) : "—"));
  }
  function contextRow(label, value, sub, visual, cls, run) {
    return h("button", {
      class: "ms-context-row " + (cls || ""),
      onClick: (e) => { e.stopPropagation(); run(); },
    },
      h("span", { class: "ms-context-visual" }, visual),
      h("span", { class: "ms-context-copy" },
        h("b", {}, label),
        h("span", {}, sub || "")),
      h("strong", { class: "ms-context-value num" }, value || "—"));
  }
  function liveLogoRail(coins) {
    const picked = (coins || [])
      .filter((c) => c && c.base)
      .sort((a, b) => Math.abs(b.chg24h || 0) - Math.abs(a.chg24h || 0))
      .slice(0, 12);
    if (!picked.length) {
      return h("div", { class: "ms-logo-empty" }, icon("refresh"), h("span", {}, "Coin logo tape warming"));
    }
    return h("div", { class: "ms-logo-mask" },
      h("div", { class: "ms-logo-track" }, picked.concat(picked).map(liveCoinButton)));
  }
  function sourcePill(s) {
    return h("button", {
      class: "ms-source-pill " + statusClass(s.status),
      onClick: (e) => { e.stopPropagation(); openDataSheet(); },
      title: s.detail || s.note || s.label || s.id || "",
    },
      h("span", { class: "ms-source-dot" }),
      h("span", {}, s.label || s.id || "source"),
      h("b", {}, statusWord(s)));
  }
  function sourceHealthStrip() {
    const rows = ((ov && ov.source_status) || [])
      .filter((s) => ["yahoo_finance", "coingecko_global", "coingecko_markets", "defillama_dex", "defillama_stables", "binance_stream"].includes(s.id)
        || ["live", "delayed", "stale", "tree_backed", "unavailable", "error"].includes(s.status))
      .slice(0, 6);
    if (!rows.length) return null;
    return h("div", { class: "ms-source-strip" }, rows.map(sourcePill));
  }
  function macroSourceStrip() {
    const rows = ((ov && ov.source_status) || [])
      .filter((s) => {
        const id = String(s.id || "").toLowerCase();
        const label = String(s.label || "").toLowerCase();
        return id.includes("yahoo") || id.includes("world") || id.includes("fx")
          || label.includes("yahoo") || label.includes("world") || label.includes("global markets");
      })
      .slice(0, 4);
    if (!rows.length) {
      return h("div", { class: "ms-source-strip macro-only" },
        h("button", {
          class: "ms-source-pill error",
          onClick: (e) => { e.stopPropagation(); openDataSheet(); },
          title: "World market source is unavailable. No substitute market data is shown.",
        },
          h("span", { class: "ms-source-dot" }),
          h("span", {}, "World market feed"),
          h("b", {}, "unavailable")));
    }
    return h("div", { class: "ms-source-strip macro-only" }, rows.map(sourcePill));
  }
  function liveMetricCard(label, value, sub, ic, cls, chart, run, state = "live") {
    return h("button", {
      class: "ms-live-card " + (cls || ""),
      onClick: (e) => { e.stopPropagation(); run(); },
    },
      h("div", { class: "ms-live-top" },
        h("span", { class: "ms-live-ic" }, icon(ic || "activity")),
        h("span", { class: "ms-live-k" }, label),
        h("span", { class: "ms-live-state " + statusClass(state) }, statusWord({ status: state }))),
      h("div", { class: "ms-live-v num" }, value || "—"),
      h("div", { class: "ms-live-sub" }, sub || ""),
      chart);
  }
  function summaryFallbackView(g, gh, dx, st) {
    const spx = worldItem("^GSPC");
    const ndx = worldItem("^IXIC");
    const dji = worldItem("^DJI");
    const dxy = worldFirst(["DX-Y.NYB", "DXY"]);
    const tenY = worldItem("^TNX");
    const gold = worldItem("GC=F");
    const oil = worldItem("CL=F");
    const worldStatus = ((ov.world || {}).status || "unavailable");
    const macroChart = (it) => fallbackChart("line", (it && it.spark) || [], signClass(it && it.chg_pct));
    const contextRows = [
      spx ? contextRow("S&P 500", wmVal(spx), worldMove(spx), icon("activity"), signClass(spx.chg_pct), () => openWorldDetail(spx)) : null,
      ndx ? contextRow("Nasdaq", wmVal(ndx), worldMove(ndx), icon("candles"), signClass(ndx.chg_pct), () => openWorldDetail(ndx)) : null,
      dji ? contextRow("Dow / Russell", wmVal(dji), worldMove(dji), icon("columns"), signClass(dji.chg_pct), () => openWorldDetail(dji)) : null,
      (dxy || tenY) ? contextRow("DXY / 10Y", dxy ? wmVal(dxy) : wmVal(tenY),
        tenY ? `10Y ${worldMove(tenY)}` : "dollar and rates", icon("target"), signClass((dxy || tenY).chg_pct), () => openWorldDetail(dxy || tenY)) : null,
      (gold || oil) ? contextRow("Gold / WTI", gold ? wmVal(gold) : wmVal(oil),
        oil ? `WTI ${worldMove(oil)}` : "commodities tape", icon("globe"), signClass((gold || oil).chg_pct), () => openWorldDetail(gold || oil)) : null,
    ].filter(Boolean);
    const liveCards = [
      spx ? liveMetricCard("S&P 500", wmVal(spx), worldMove(spx), "activity", signClass(spx.chg_pct), macroChart(spx), () => openWorldDetail(spx), worldStatus) : null,
      ndx ? liveMetricCard("Nasdaq", wmVal(ndx), worldMove(ndx), "candles", signClass(ndx.chg_pct), macroChart(ndx), () => openWorldDetail(ndx), worldStatus) : null,
      (dxy || tenY) ? liveMetricCard("DXY / US10Y", dxy ? wmVal(dxy) : wmVal(tenY),
        tenY ? `10Y ${worldMove(tenY)}` : "rates", "target", signClass((dxy || tenY).chg_pct), macroChart(dxy || tenY), () => openWorldDetail(dxy || tenY), worldStatus) : null,
      (gold || oil) ? liveMetricCard("Gold / WTI", gold ? wmVal(gold) : wmVal(oil),
        oil ? `WTI ${worldMove(oil)}` : "commodities", "globe", signClass((gold || oil).chg_pct), macroChart(gold || oil), () => openWorldDetail(gold || oil), worldStatus) : null,
    ].filter(Boolean);
    return h("div", { class: "ms-market-terminal" },
      h("div", { class: "ms-tv-board" },
        h("div", { class: "ms-tv-head" },
          h("div", {},
            h("div", { class: "ms-tv-k" }, "World macro board"),
            h("div", { class: "ms-tv-title" }, "World indices + macro tape"),
            h("div", { class: "ms-tv-sub" },
              "Live indices, rates, commodities, stocks, FX and bonds from TradingView-style market lanes.")),
          h("a", {
            class: "ms-tv-link",
            href: "https://www.tradingview.com/markets/",
            target: "_blank",
            rel: "noopener noreferrer",
            onClick: (e) => e.stopPropagation(),
          }, "Open markets")),
        tradingViewWorldWidget("462", "ms-tv-summary-widget")),
      h("div", { class: "ms-context-board" },
        h("div", { class: "ms-context-head" },
          h("div", {},
            h("div", { class: "ms-context-k" }, "Macro context"),
            h("h3", {}, "Indices, rates, FX and commodities")),
          h("button", { class: "ms-context-source", onClick: (e) => { e.stopPropagation(); openDataSheet(); } }, icon("database"), "Sources")),
        contextRows.length ? h("div", { class: "ms-context-rows" }, contextRows) : h("button", {
          class: "ms-context-empty",
          onClick: (e) => { e.stopPropagation(); openDataSheet(); },
        },
          h("span", { class: "ms-context-visual" }, icon("database")),
          h("span", { class: "ms-context-copy" },
            h("b", {}, "World feed unavailable"),
            h("span", {}, "Yahoo backend has no live macro payload for this session."))),
        macroSourceStrip()),
      liveCards.length ? h("div", { class: "ms-live-cards terminal-cards" }, liveCards) : null);
  }

  function paintSummary() {
    if (!ov) return;
    const g = ov.global || {};
    const gh = ov.global_history || {};
    const fg = ov.fear_greed || {};
    const dx = ov.dex || {};
    const st = ov.stablecoins || {};
    const spx = worldItem("^GSPC");
    const ndx = worldItem("^IXIC");
    const dji = worldItem("^DJI");
    const rut = worldItem("^RUT");
    const dxy = worldFirst(["DX-Y.NYB", "DXY"]);
    const tenY = worldItem("^TNX");
    const gold = worldItem("GC=F");
    const oil = worldItem("CL=F");
    const stockLead = worldFirst(["AAPL", "MSFT", "NVDA"]);
    const futuresLead = worldFirst(["GC=F", "CL=F", "SI=F"]);
    const hero = spx || ndx || worldItems()[0] || null;
    summaryPanel.classList.toggle("summary-state", !hero);
    if (hero) {
      summaryFallbackKey = "";
      summaryOpen = () => openWorldDetail(hero);
      summaryValue.textContent = `${hero.name} ${wmVal(hero)}`;
      summaryDelta.textContent = hero.chg_pct != null ? `${moveValue(hero.chg_pct)} today` : "Waiting for session change";
      summaryDelta.className = "ms-delta num " + signClass(hero.chg_pct);
      summarySource.textContent = `${(ov.world || {}).source || "Yahoo Finance"} · ${(ov.world || {}).status || "connecting"} · global indices, FX and rates`;
      const series = hero.spark || [];
      if (series.length > 6) {
        summaryChart.innerHTML = sparkArea(series, 760, 214, signClass(hero.chg_pct) === "down" ? "var(--down)" : "var(--up)", { dots: true, endDot: true });
      } else {
        summaryChart.innerHTML = `<div class="ms-empty">World-market history is connecting.</div>`;
      }
    } else {
      summaryOpen = () => openDataSheet();
      summaryValue.textContent = "Global markets overview";
      summaryDelta.textContent = "World indices, stocks, FX, rates and commodities";
      summaryDelta.className = "ms-delta num";
      summarySource.textContent = `TradingView market widget · Yahoo backend ${worldState()}`;
      const theme = document.documentElement.getAttribute("data-theme") || "light";
      const macroKey = worldItems().slice(0, 16).map((it) =>
        [it.symbol, it.price, it.chg_pct, (it.spark || []).length, (it.spark || [])[((it.spark || []).length - 1)]].join(",")).join("|");
      const key = [
        "summary-tv", theme, worldState(), macroKey,
      ].join(":");
      if (summaryFallbackKey !== key || !summaryChart.querySelector(".ms-market-terminal")) {
        summaryFallbackKey = key;
        mount(summaryChart, summaryFallbackView(g, gh, dx, st));
      }
    }
    mount(summaryRail,
      summaryAction("S&P 500", spx ? wmVal(spx) : "—", spx ? worldMove(spx) : "US equity proxy", spx ? signClass(spx.chg_pct) : "", "activity", () => spx ? openWorldDetail(spx) : openDataSheet()),
      summaryAction("Nasdaq", ndx ? wmVal(ndx) : "—", ndx ? worldMove(ndx) : "growth tape", ndx ? signClass(ndx.chg_pct) : "", "candles", () => ndx ? openWorldDetail(ndx) : openDataSheet()),
      summaryAction("Dow / Russell", dji ? wmVal(dji) : rut ? wmVal(rut) : "—", dji ? worldMove(dji) : rut ? worldMove(rut) : "US breadth", dji ? signClass(dji.chg_pct) : rut ? signClass(rut.chg_pct) : "", "columns", () => dji ? openWorldDetail(dji) : rut ? openWorldDetail(rut) : openDataSheet()),
      summaryAction("DXY / US10Y", dxy ? wmVal(dxy) : tenY ? wmVal(tenY) : "—", tenY ? `10Y ${worldMove(tenY)}` : "rates awaiting feed", dxy ? signClass(dxy.chg_pct) : tenY ? signClass(tenY.chg_pct) : "", "target", () => dxy ? openWorldDetail(dxy) : tenY ? openWorldDetail(tenY) : openDataSheet()),
      summaryAction("Gold / WTI", gold ? wmVal(gold) : oil ? wmVal(oil) : "—", oil ? `WTI ${worldMove(oil)}` : "commodities", gold ? signClass(gold.chg_pct) : oil ? signClass(oil.chg_pct) : "", "columns", () => gold ? openWorldDetail(gold) : oil ? openWorldDetail(oil) : openDataSheet()),
      summaryAction("World stocks", stockLead ? wmVal(stockLead) : "—", "large-cap equity lane", stockLead ? signClass(stockLead.chg_pct) : "", "globe", () => stockLead ? openWorldDetail(stockLead) : openDataSheet()),
      summaryAction("Futures", futuresLead ? wmVal(futuresLead) : "—", "commodities and index futures", futuresLead ? signClass(futuresLead.chg_pct) : "", "trendingUp", () => futuresLead ? openWorldDetail(futuresLead) : openDataSheet()),
      summaryAction("FX", dxy ? wmVal(dxy) : "—", "dollar and major pairs", dxy ? signClass(dxy.chg_pct) : "", "activity", () => dxy ? openWorldDetail(dxy) : openDataSheet()));
  }

  function setCard(key, value, fmt, { delta, deltaCls, spark, sparkColor, src, srcState } = {}) {
    const c = cards[key];
    if (value == null || !isFinite(Number(value))) {
      c.v.textContent = "—"; c.d.textContent = ""; c.s.innerHTML = "";
      c.src.textContent = src ? src + " · " + (srcState || "unavailable") : "source not configured";
      c.src.className = "card-src bad";
      return;
    }
    countUp(c.v, Number(value), fmt);
    c.d.textContent = delta || "";
    c.d.className = "card-delta num " + (deltaCls || "");
    if (spark && spark.length >= 6) {
      const up = spark[spark.length - 1] >= spark[0];
      // Coinbase-style dotted area + end marker — texture, not just a line
      c.s.innerHTML = sparkArea(spark, 150, 40, sparkColor || (up ? "var(--up)" : "var(--down)"), { dots: true, endDot: true });
    } else c.s.innerHTML = "";
    c.src.textContent = (src || "") + (srcState && srcState !== "live" ? " · " + srcState : "");
    c.src.className = "card-src" + (srcState === "live" ? " ok" : "");
  }

  function paintCards() {
    if (!ov) return;
    const g = ov.global || {};
    const gh = ov.global_history || {};
    const fg = ov.fear_greed || {};
    const st = ov.stablecoins || {};
    const df = ov.defi || {};
    const m = ov.metrics || {};
    if (g.mcap_usd != null) {
      const chg = Number(g.mcap_change_24h_pct);
      setCard("mcap", g.mcap_usd, fmtMoney, {
        delta: isFinite(chg) ? (chg >= 0 ? "↗ " : "↘ ") + fmtPct(chg) + " · 24h" : "",
        deltaCls: signClass(chg), spark: gh.mcap || [], src: g.source + (gh.mcap ? " · 7d" : ""), srcState: g.status });
      setCard("vol", g.volume_usd, fmtMoney, {
        delta: g.mcap_usd ? "vol/mcap " + ((g.volume_usd / g.mcap_usd) * 100).toFixed(1) + "%" : "",
        src: g.source, srcState: g.status });
      setCard("dom", g.btc_dominance, (v) => "BTC " + v.toFixed(1) + "%", {
        delta: g.eth_dominance != null ? "ETH " + g.eth_dominance.toFixed(1) + "%" : "",
        src: g.source, srcState: g.status });
      cards.dom.s.innerHTML = donutSvg([
        { label: "BTC", pct: g.btc_dominance || 0, color: "#F7931A" },
        { label: "ETH", pct: g.eth_dominance || 0, color: "#627EEA" },
        { label: "Others", pct: Math.max(0, 100 - (g.btc_dominance || 0) - (g.eth_dominance || 0)), color: "var(--line-strong)" }]);
    } else {
      setCard("mcap", null, null, { src: "coingecko/paprika", srcState: g.status });
      setCard("vol", null, null, { src: "coingecko/paprika", srcState: g.status });
      setCard("dom", null, null, { src: "coingecko/paprika", srcState: g.status });
    }
    const dx = ov.dex || {};
    if (dx.total24h_usd != null) {
      const dch = Number(dx.change_1d_pct);
      setCard("dex", dx.total24h_usd, fmtMoney, {
        delta: isFinite(dch) ? (dch >= 0 ? "↗ " : "↘ ") + fmtPct(dch) + " · 24h" : "",
        deltaCls: signClass(dch), src: "defillama · daily bars", srcState: dx.status });
      cards.dex.s.innerHTML = barsSvg((dx.bars || []).map((b) => b[1]));
    } else setCard("dex", null, null, { src: "defillama", srcState: dx.status });
    if (fg.value != null) {
      setCard("fng", fg.value, (v) => Math.round(v) + " · " + (fg.label || ""), {
        src: "alternative.me", srcState: fg.status });
      cards.fng.v.classList.add("fng-" + fngBand(fg.value));
      cards.fng.s.innerHTML = gaugeSvg(fg.value);
      cards.fng.d.textContent = fngBandLabel(fg.value) + " · 30d range " +
        Math.min(...(fg.history || [{value:fg.value}]).map((p) => p.value)) +
        "-" + Math.max(...(fg.history || [{value:fg.value}]).map((p) => p.value));
    } else setCard("fng", null, null, { src: "alternative.me", srcState: fg.status });
    if (st.total_usd != null) {
      setCard("stbl", st.total_usd, fmtMoney, { src: "defillama", srcState: st.status });
      const u = st.usdt_share_pct || 0, c = st.usdc_share_pct || 0;
      cards.stbl.s.innerHTML = shareBarSvg([
        { label: "USDT", pct: u, color: "#26A17B" },
        { label: "USDC", pct: c, color: "#2775CA" },
        { label: "Other", pct: Math.max(0, 100 - u - c), color: "var(--line-strong)" }]);
    } else setCard("stbl", null, null, { src: "defillama", srcState: st.status });
    if (df.tvl_usd != null) {
      setCard("tvl", df.tvl_usd, fmtMoney, { spark: df.chart || [], src: "defillama", srcState: df.status });
    } else setCard("tvl", null, null, { src: "defillama", srcState: df.status });
    setCard("uni", m.total_symbols, (v) => Math.round(v) + " pairs", {
      delta: `${m.live_symbols ?? "—"} live · open Radar ›`,
      src: "exchange stream", srcState: "live" });
  }
  function fngBand(v) { return v <= 25 ? "fear" : v >= 75 ? "greed" : "mid"; }
  function fngBandLabel(v) { return v <= 25 ? "Risk-off" : v >= 75 ? "Euphoric" : "Balanced"; }
  // donut — composition at a glance (dominance), not another line
  function donutSvg(parts) {
    const cx = 27, cy = 26, r = 19, C = 2 * Math.PI * r;
    let off = C * 0.25; // start at 12 o'clock
    const segs = parts.map((p) => {
      const len = Math.max(0, p.pct) / 100 * C;
      const s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${p.color}" stroke-width="9" stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>`;
      off -= len;
      return s;
    }).join("");
    const legend = parts.map((p, i) =>
      `<text x="58" y="${15 + i * 15}" font-size="10" fill="var(--muted)"><tspan fill="${p.color}">●</tspan> ${p.label} <tspan fill="var(--text)" font-weight="600">${p.pct.toFixed(1)}%</tspan></text>`).join("");
    return `<svg viewBox="0 0 150 52" style="width:100%;height:100%;display:block">${segs}${legend}</svg>`;
  }
  // daily volume bars, Pyth-style: thin quiet grey bars, the CURRENT day in
  // accent with a dot cap — history as texture, today as the signal
  function barsSvg(vals, W = 150, H = 46) {
    const v = (vals || []).filter((x) => isFinite(x)).slice(-28);
    if (v.length < 3) return "";
    const max = Math.max(...v) || 1;
    const bw = W / v.length;
    const barW = Math.max(1.4, Math.min(3, bw * 0.42));
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:100%;display:block">` +
      v.map((x, i) => {
        const bh = Math.max(2, (x / max) * (H - 8));
        const cx = i * bw + bw / 2;
        const last = i === v.length - 1;
        const fill = last ? "var(--accent)" : "var(--line-strong)";
        const cap = last ? `<circle cx="${cx.toFixed(1)}" cy="${(H - bh - 3).toFixed(1)}" r="2.3" fill="var(--accent)"/>` : "";
        return `<rect x="${(cx - barW / 2).toFixed(1)}" y="${(H - bh).toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="${(barW / 2).toFixed(1)}" fill="${fill}"/>` + cap;
      }).join("") + "</svg>";
  }
  // semicircle gauge (0-100): colored bands + needle — not another line chart
  function gaugeSvg(value) {
    const W = 150, H = 52, cx = 75, cy = 48, r = 40;
    const pol = (deg) => [cx + r * Math.cos(Math.PI * deg / 180), cy - r * Math.sin(Math.PI * deg / 180)];
    const seg = (a0, a1, color) => {
      const [x0, y0] = pol(a0), [x1, y1] = pol(a1);
      return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="${color}" stroke-width="8" fill="none" stroke-linecap="butt" opacity=".85"/>`;
    };
    const bands = [["#e0414b",180,144],["#f0932b",144,108],["#c3c9d2",108,72],["#7cc47f",72,36],["#0a9b64",36,0]];
    const ang = 180 - Math.max(0, Math.min(100, value)) * 1.8;
    const [nx, ny] = pol(ang);
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:100%;display:block">
      ${bands.map(([c,a0,a1]) => seg(a0,a1,c)).join("")}
      <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="var(--text)" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="3.4" fill="var(--text)"/></svg>`;
  }
  function shareBarSvg(parts) {
    const total = parts.reduce((a, p) => a + p.pct, 0) || 100;
    let cells = "", x = 0;
    for (const p of parts) {
      const w = (p.pct / total) * 100;
      cells += `<div style="width:${w}%;background:${p.color}" title="${p.label} ${p.pct.toFixed(1)}%"></div>`;
      x += w;
    }
    const legend = parts.map((p) =>
      `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--muted)">
        <span style="width:7px;height:7px;border-radius:2px;background:${p.color}"></span>${p.label} ${p.pct.toFixed(1)}%</span>`).join("");
    return `<div style="display:flex;height:10px;border-radius:5px;overflow:hidden;margin-top:12px">${cells}</div>
      <div style="display:flex;gap:10px;margin-top:6px">${legend}</div>`;
  }
  function fngColor(v) { return v <= 25 ? "var(--down)" : v >= 75 ? "var(--up)" : "var(--accent)"; }

  // ---- majors ----
  const majorsWrap = h("div", { class: "mcards" });
  const majorCards = new Map();
  function paintMajors() {
    if (!ov) return;
    const coinsByBase = {};
    (ov.top_coins && ov.top_coins.coins || []).forEach((c) => { coinsByBase[c.base] = c; });
    for (const r of ov.majors || []) {
      const base = baseOf(r.symbol);
      const coin = coinsByBase[base];
      let card = majorCards.get(r.symbol);
      if (!card) {
        card = buildMajorCard(r, coin);
        majorCards.set(r.symbol, card);
        majorsWrap.appendChild(card.el);
      }
      countUp(card.px, Number(coin ? px(coin) : r.spot_mid), fmtPrice);
      if (coin && coin.chg24h != null) {
        card.chg.textContent = (coin.chg24h >= 0 ? "↗ " : "↘ ") + fmtPct(coin.chg24h) + " · 24h";
        card.chg.className = "mcard-chg num " + signClass(coin.chg24h);
      } else {
        card.chg.textContent = "";
        card.chg.className = "mcard-chg num";
      }
      const pts = sparks[r.symbol];
      const vals = (coin && coin.spark && coin.spark.length > 2) ? coin.spark
        : (pts && pts.length > 2 ? pts.map((p) => p[1]) : []);
      const sig = vals.length + ":" + vals[vals.length - 1];
      if (card._k !== sig && vals.length >= 2) {
        card._k = sig;
        card.chart.innerHTML = sparkArea(vals, 170, 52, brandColor(r.symbol));
      }
    }
  }
  function buildMajorCard(r, coin) {
    const px = h("div", { class: "mcard-px num" });
    const chg = h("div", { class: "mcard-chg num" });
    const chart = h("div", { class: "mcard-chart" });
    const el = h("div", { class: "mcard", onClick: () => navigate("/symbol/" + r.symbol) },
      h("div", { class: "mcard-head" }, tokenIcon(r.symbol, 30),
        h("div", {}, h("div", { class: "tok-name" }, coin ? coin.name : baseOf(r.symbol)),
          h("div", { class: "tok-sub" }, baseOf(r.symbol)))),
      px, chg, chart);
    attachPopover(el, () => majorPopover(r.symbol));
    return { el, px, chg, chart };
  }
  function majorPopover(symbol) {
    const r = (ov && ov.majors || []).find((x) => x.symbol === symbol);
    if (!r) return null;
    const pts = sparks[symbol] || [];
    return h("div", {},
      h("div", { class: "hp-head" }, tokenIcon(symbol, 22), h("b", {}, baseOf(symbol)), h("span", { class: "muted" }, symbol)),
      pts.length > 2 ? h("div", { class: "hp-chart", html: sparkArea(pts.map((p) => p[1]), 220, 44, brandColor(symbol)) }) : null,
      popRow("Spot", fmtPrice(r.spot_mid)),
      popRow("Basis", fmtBasisVal(r.mid_spread_bps, true) + " " + basisUnit(), signClass(r.mid_spread_bps)),
      popRow("Funding / 8h", fmtFunding(r.funding_rate), signClass(r.funding_rate)),
      h("div", { class: "hp-src" }, "binance · live — click to open"));
  }

  // ---- tokenized stocks (Uniswap-style cards; real on-chain equity prices) ----
  const stocksStrip = h("div", { class: "stock-strip" });
  const stocksNote = h("span", { class: "sec-note" });
  const stocksWrap = h("div", { style: { display: "none" } },
    h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Stocks · tokenized"), stocksNote),
    stocksStrip);
  const stockCards = new Map();
  function paintStocks() {
    const stq = (ov && ov.stocks) || {};
    const items = stq.items || [];
    if (binanceOnly() || !items.length) { stocksWrap.style.display = "none"; return; }
    stocksWrap.style.display = "";
    stocksNote.textContent = "real on-chain tokenized equities — price tracks the listed company · " + (stq.source || "");
    for (const s of items) {
      let sc = stockCards.get(s.base);
      if (!sc) {
        sc = buildStockCard(s);
        stockCards.set(s.base, sc);
        stocksStrip.appendChild(sc.el);
      }
      countUp(sc.px, s.price, fmtPrice);
      const up = (s.chg24h || 0) >= 0;
      sc.chg.replaceChildren();
      mount(sc.chg, s.chg24h != null ? moveValue(s.chg24h, { hot: 8 }) : "—");
      sc.chg.className = "sc-chg num " + signClass(s.chg24h);
      const vals = s.spark || [];
      const sig = vals.length + ":" + vals[vals.length - 1];
      if (sc._k !== sig && vals.length >= 2) {
        sc._k = sig;
        sc.spark.innerHTML = sparkArea(vals, 150, 34, up ? "var(--up)" : "var(--down)");
      }
    }
  }
  function buildStockCard(s) {
    // official company logo first (Parqet's keyless ticker CDN — crisp, real
    // brand marks), then the wrapper-token image, then the resolver
    const chain = [`https://assets.parqet.com/logos/symbol/${encodeURIComponent(s.base)}?format=png&size=64`];
    if (s.image) chain.push(s.image);
    const img = document.createElement("img");
    img.className = "tok-ico sc-logo"; img.width = 28; img.height = 28; img.alt = s.base;
    img.referrerPolicy = "no-referrer"; img.loading = "lazy";
    let ci = 0;
    img.addEventListener("error", () => {
      ci += 1;
      if (ci < chain.length) img.src = chain[ci];
      else img.replaceWith(tokenIcon(s.base, 28));
    });
    img.src = chain[0];
    const pxEl = h("div", { class: "sc-px num" });
    const chg = h("div", { class: "sc-chg num" });
    const spark = h("div", { class: "sc-spark" });
    const el = h("button", { class: "stock-card", title: s.wrapper || s.name, onClick: () => navigate("/symbol/" + s.base) },
      h("div", { class: "sc-head" }, img,
        h("div", { class: "tok-meta" }, h("span", { class: "tok-name" }, s.base), h("span", { class: "tok-sub" }, s.name))),
      pxEl, chg, spark);
    return { el, px: pxEl, chg, spark };
  }

  // ---- active sector ranked board (taxonomy-aware, pinnable, sortable) ----
  let boardFilter = "all";
  let boardSortKey = null;
  let boardSortDir = -1;          // -1 descending, +1 ascending
  let boardShow = 30;
  const BOARD_PIN_KEY = "bslab:market-board-pins:v1";
  let boardPins = new Set();
  try { boardPins = new Set(JSON.parse(localStorage.getItem(BOARD_PIN_KEY) || "[]")); } catch (e) { boardPins = new Set(); }

  const boardTitle = h("h2", { class: "sec-title" }, "Market prices");
  const boardNote = h("span", { class: "sec-note" }, "Data warming");
  const boardCount = h("span", { class: "market-board-count num" }, "");
  const boardCards = h("div", { class: "market-board-leaders" });
  const boardTabs = h("div", { class: "chips market-board-tabs" });
  const boardHead = h("tr");
  const boardBody = h("tbody");
  const boardTable = h("div", { class: "table-scroll market-board-table" },
    h("table", { class: "mkt sector-mkt" }, h("thead", {}, boardHead), boardBody));
  const marketBoard = h("section", { class: "market-board", id: "sec-prices" },
    h("div", { class: "sec-head market-board-head" },
      h("div", {}, boardTitle, boardNote),
      h("div", { class: "market-board-actions" },
        boardCount,
        h("button", { class: "mini-btn", onClick: () => loadOverview() }, icon("refresh"), "Refresh"))),
    boardCards,
    h("div", { class: "table-tools" }, boardTabs),
    boardTable);

  function saveBoardPins() {
    try { localStorage.setItem(BOARD_PIN_KEY, JSON.stringify([...boardPins])); } catch (e) {}
  }
  function boardKey(row) {
    return `${row.section}:${row.symbol}`;
  }
  function isPinned(row) {
    return boardPins.has(boardKey(row));
  }
  function toggleBoardPin(row) {
    const key = boardKey(row);
    if (boardPins.has(key)) boardPins.delete(key);
    else boardPins.add(key);
    saveBoardPins();
    paintSectorBoard();
  }
  function sectionUniverse(cfg) {
    const seen = new Set();
    return [...(cfg.symbols || []), ...(MARKET_LIST_UNIVERSE[cfg.id] || [])].filter((it) => {
      const key = it.s || it.short || it.d;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function boardSourceFor(cfg) {
    if (cfg.id === "crypto") return `${(ov.top_coins || {}).source || "coingecko"} · ${(ov.top_coins || {}).status || "warming"}`;
    if (cfg.id === "forex") return `open.er-api · ${((ov.fx || {}).status || "warming")}`;
    if (cfg.id === "economy") return "FRED · charts only";
    return `Yahoo · ${worldCopy()}`;
  }
  function liveRowBySymbol(symbol) {
    if (!symbol) return null;
    const lite = store.lite || {};
    const rows = [...(lite.ticker || []), ...(lite.radar_top || [])];
    return rows.find((r) => r.symbol === symbol) || null;
  }
  function boardRowFromCoin(c, i) {
    const live = px(c);
    const lr = liveRowBySymbol(c.binance && c.binance.symbol);
    return {
      section: "crypto",
      kind: "crypto",
      rank: c.rank ?? i + 1,
      symbol: c.base,
      name: c.name,
      sub: c.base,
      coin: c,
      price: live,
      priceText: fmtPrice(live),
      chg1h: c.chg1h,
      chg24h: c.chg24h,
      chg7d: c.chg7d,
      mcap: c.mcap,
      volume: c.vol_live ?? c.volume,
      basis: lr && lr.mid_spread_bps != null ? lr.mid_spread_bps : null,
      funding: lr && lr.funding_rate != null ? lr.funding_rate : null,
      spark: cleanSeries(c.spark || []),
      source: c.binance ? "CoinGecko + exchange live" : "CoinGecko",
      sourceState: (ov.top_coins || {}).status || "live",
      tvSymbol: c.binance ? "BINANCE:" + c.binance.symbol : null,
      route: "/symbol/" + (c.binance ? c.binance.symbol : c.base + "USDT"),
    };
  }
  function boardRowFromSymbol(item, i, cfg) {
    const world = item.yahoo ? worldItem(item.yahoo) : null;
    const meta = atlasLocalMeta(item);
    const rawPx = world && world.last != null ? Number(world.last) : meta && meta.raw != null ? Number(meta.raw) : null;
    const spark = world ? cleanSeries(world.spark || []) : [];
    return {
      section: cfg.id,
      kind: cfg.id,
      rank: i + 1,
      symbol: item.short || item.s,
      name: item.d,
      sub: item.short || item.s,
      item,
      price: rawPx,
      priceText: world ? wmVal(world) : meta ? meta.value : "—",
      chg24h: world && world.chg_pct != null ? world.chg_pct : null,
      spark,
      // A chart route is not a quote: rows without real data never claim live.
      source: meta ? meta.sub : world ? "Yahoo Finance" : "chart route only",
      sourceState: meta ? (meta.state || worldState()) : world ? worldState() : "unavailable",
      tvSymbol: item.s,
      route: null,
    };
  }
  function boardRowsRaw(cfg = atlasCfg()) {
    if (!ov) return [];
    if (cfg.id === "crypto") {
      return ((ov.top_coins || {}).coins || []).map(boardRowFromCoin);
    }
    return sectionUniverse(cfg).map((item, i) => boardRowFromSymbol(item, i, cfg));
  }
  function boardFilters(cfg) {
    if (cfg.id === "crypto") {
      return [
        ["all", "All assets"], ["majors", "Majors"], ["binance", "Exchange listed"],
        ["volume", "High volume"], ["gainers", "Top gainers"], ["losers", "Top losers"],
        ["basis", "Highest basis"], ["funding", "Highest funding"],
        ["stable", "Stablecoins"], ["pinned", "Pinned"],
      ];
    }
    if (cfg.id === "economy") {
      return [["all", "Indicators"], ["pinned", "Pinned"], ["live", "Chart-ready"]];
    }
    return [["all", "All"], ["live", "Live quotes"], ["gainers", "Gainers"], ["losers", "Losers"], ["pinned", "Pinned"]];
  }
  function boardRows(cfg = atlasCfg()) {
    let rows = boardRowsRaw(cfg);
    switch (boardFilter) {
      case "majors": rows = rows.filter((r) => MAJOR_BASES.has(r.symbol)); break;
      case "binance": rows = rows.filter((r) => r.coin && r.coin.binance); break;
      case "volume": rows = rows.filter((r) => r.volume != null).sort((a, b) => b.volume - a.volume); break;
      case "gainers": rows = rows.filter((r) => r.chg24h != null).sort((a, b) => b.chg24h - a.chg24h); break;
      case "losers": rows = rows.filter((r) => r.chg24h != null).sort((a, b) => a.chg24h - b.chg24h); break;
      case "basis": rows = rows.filter((r) => r.basis != null).sort((a, b) => Math.abs(b.basis) - Math.abs(a.basis)); break;
      case "funding": rows = rows.filter((r) => r.funding != null).sort((a, b) => Math.abs(b.funding) - Math.abs(a.funding)); break;
      case "stable": rows = rows.filter((r) => STABLE_BASES.has(r.symbol)); break;
      case "pinned": rows = rows.filter(isPinned); break;
      case "live": rows = rows.filter((r) => r.price != null || r.tvSymbol); break;
      default: break;
    }
    const col = boardColumns(cfg).find((c) => c.key === boardSortKey);
    if (col && col.sort) {
      rows = [...rows].sort((a, b) => {
        const av = col.sort(a);
        const bv = col.sort(b);
        if (typeof av === "string" || typeof bv === "string") {
          return String(av || "").localeCompare(String(bv || "")) * boardSortDir;
        }
        const an = Number(av);
        const bn = Number(bv);
        const as = Number.isFinite(an) ? an : -1e18;
        const bs = Number.isFinite(bn) ? bn : -1e18;
        return (bs - as) * (boardSortDir < 0 ? 1 : -1);
      });
    } else {
      rows = [...rows].sort((a, b) => Number(isPinned(b)) - Number(isPinned(a)) || (a.rank || 1e9) - (b.rank || 1e9));
    }
    return rows;
  }
  function boardColumns(cfg = atlasCfg()) {
    const cols = [
      { key: "pin", label: "", cls: "l w-star", sort: null },
      { key: "rank", label: "#", cls: "l w-idx", sort: (r) => r.rank ?? 1e9 },
      { key: "token", label: cfg.id === "crypto" ? "Token" : "Instrument", cls: "l", sort: (r) => r.name },
      { key: "spark", label: cfg.id === "crypto" ? "7d chart" : "Session chart", cls: "l col-hide-xs", sort: null },
      { key: "price", label: cfg.id === "economy" ? "Value" : "Price", cls: "", sort: (r) => r.price ?? -1 },
    ];
    if (cfg.id === "crypto") {
      cols.push(
        { key: "chg1h", label: "1h", cls: "col-hide-sm", sort: (r) => r.chg1h ?? -1e9 },
        { key: "chg24h", label: "24h", cls: "", sort: (r) => r.chg24h ?? -1e9 },
        { key: "chg7d", label: "7d", cls: "col-hide-sm", sort: (r) => r.chg7d ?? -1e9 },
        ...(BASIS_TABS.has(boardFilter) ? [
          { key: "basis", label: "Basis", cls: "col-hide-sm", sort: (r) => Math.abs(r.basis ?? -1e9) },
          { key: "funding", label: "Funding", cls: "col-hide-sm", sort: (r) => Math.abs(r.funding ?? -1e9) },
        ] : []),
        { key: "mcap", label: "Market cap", cls: "", sort: (r) => r.mcap ?? -1 },
        { key: "volume", label: "Volume", cls: "col-hide-sm", sort: (r) => r.volume ?? -1 },
      );
    } else {
      // No per-row source column: 20 repeated "Yahoo LIVE" chips are noise.
      // The section note carries the source once, like a real terminal.
      cols.push({ key: "chg24h", label: "Session", cls: "", sort: (r) => r.chg24h ?? -1e9 });
    }
    cols.push({ key: "view", label: "", cls: "", sort: null });
    return cols;
  }
  function paintBoardHead(cfg = atlasCfg()) {
    mount(boardHead, boardColumns(cfg).map((col) => {
      if (!col.sort) return h("th", { class: col.cls }, col.label);
      const active = boardSortKey === col.key;
      return h("th", {
        class: col.cls + " th-sort" + (active ? " th-on" : ""),
        dataset: { sortKey: col.key },
        role: "button",
        tabindex: "0",
        title: "Sort by " + (col.label || col.key),
        "aria-sort": active ? (boardSortDir > 0 ? "ascending" : "descending") : "none",
        onClick: () => {
          if (boardSortKey === col.key) {
            if (boardSortDir === -1) boardSortDir = 1;
            else { boardSortKey = null; boardSortDir = -1; }
          } else {
            boardSortKey = col.key;
            boardSortDir = -1;
          }
          paintBoardHead(cfg);
          paintSectorBoard();
        },
      }, col.label, h("span", { class: "th-car" }, active ? (boardSortDir > 0 ? "▲" : "▼") : "⇅"));
    }));
  }
  function boardLogo(row, size = 32) {
    return row.coin ? coinIcon(row.coin, size) : row.item ? atlasLogo(row.item, size) : tokenIcon(row.symbol, size);
  }
  function boardChart(row, wide = 108, high = 34) {
    const vals = cleanSeries(row.spark || []);
    if (vals.length >= 6) {
      const tone = row.chg7d != null ? row.chg7d : row.chg24h;
      return h("span", { class: "market-row-chart", html: sparkline(vals, wide, high, tone != null && tone < 0 ? "var(--down)" : "var(--up)") });
    }
    // The animated LIVE pulse is reserved for rows that actually have a live
    // quote behind them; anything else gets a quiet dash, not fake motion.
    if (row.price != null && (row.sourceState === "live" || row.sourceState === "delayed")) {
      return h("span", { class: "market-row-chart market-row-chart-live" }, atlasSourceVisual(row.sourceState));
    }
    return h("span", { class: "market-row-chart market-row-chart-none num" }, "—");
  }
  const lastPx = new Map();   // row key -> last painted price (flash on change)
  function boardPriceCell(row) {
    const td = h("td", { class: "num val-strong board-price-cell" }, row.priceText || "—");
    const key = boardKey(row);
    const prev = lastPx.get(key);
    if (prev != null && row.price != null && row.price !== prev) {
      td.classList.add(row.price > prev ? "flash-up" : "flash-down");
    }
    if (row.price != null) lastPx.set(key, row.price);
    return td;
  }
  function boardCell(col, row, i) {
    switch (col.key) {
      case "pin": return h("td", { class: "l w-star" }, h("button", {
        class: "star-btn",
        title: isPinned(row) ? "Unpin" : "Pin",
        onClick: (e) => { e.stopPropagation(); toggleBoardPin(row); },
      }, starIcon(isPinned(row))));
      case "rank": return h("td", { class: "l idx w-idx" }, row.rank ?? i + 1);
      case "token": return h("td", { class: "l" }, h("div", { class: "tok sector-token" },
        boardLogo(row, 34),
        h("div", { class: "tok-meta" },
          h("span", { class: "tok-name" }, row.name),
          h("span", { class: "tok-sub num" }, row.sub))));
      case "spark": return h("td", { class: "l col-hide-xs" }, boardChart(row));
      case "price": return boardPriceCell(row);
      case "chg1h": return h("td", { class: "num col-hide-sm " + signClass(row.chg1h) }, row.chg1h != null ? fmtPct(row.chg1h) : "—");
      case "chg24h": return h("td", { class: "num " + signClass(row.chg24h) }, row.chg24h != null ? moveValue(row.chg24h) : "—");
      case "chg7d": return h("td", { class: "num col-hide-sm " + signClass(row.chg7d) }, row.chg7d != null ? fmtPct(row.chg7d) : "—");
      case "basis": return h("td", { class: "num col-hide-sm " + signClass(row.basis) }, row.basis != null ? fmtBasisVal(row.basis, true) + " " + basisUnit() : "—");
      case "funding": return h("td", { class: "num col-hide-sm " + signClass(row.funding) }, row.funding != null ? fmtFunding(row.funding) : "—");
      case "mcap": return h("td", { class: "num" }, fmtMoney(row.mcap));
      case "volume": return h("td", { class: "num col-hide-sm muted" }, fmtMoney(row.volume));
      case "source": return h("td", { class: "num col-hide-sm" }, h("span", { class: "board-source " + statusClass(row.sourceState) },
        h("span", { class: "source-dot" }),
        h("span", {}, row.source),
        h("b", {}, statusWord({ status: row.sourceState }))));
      case "view": return h("td", {}, h("button", { class: "cta-pill", onClick: (e) => { e.stopPropagation(); openBoardRow(row); } }, row.route ? "View" : "Chart"));
      default: return h("td", {});
    }
  }
  function openBoardRow(row) {
    if (row.route) {
      navigate(row.route);
      return;
    }
    if (row.tvSymbol) {
      atlasSymbol = row.tvSymbol;
      atlasChartNonce += 1;
      atlasWidgetKey = "";
      paintMarketAtlas();
      marketAtlas.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
  }
  function boardPopover(row) {
    return h("div", {},
      h("div", { class: "hp-head" }, boardLogo(row, 22), h("b", {}, row.name), h("span", { class: "muted" }, row.symbol)),
      cleanSeries(row.spark || []).length > 2 ? h("div", { class: "hp-chart", html: sparkArea(row.spark, 220, 44, (row.chg7d ?? row.chg24h ?? 0) < 0 ? "var(--down)" : "var(--up)") }) : null,
      popRow("Price", row.priceText || "—"),
      popRow("Move", row.chg24h != null ? fmtPct(row.chg24h) : "—", signClass(row.chg24h)),
      row.mcap != null ? popRow("Market cap", fmtMoney(row.mcap)) : null,
      row.volume != null ? popRow("Volume", fmtMoney(row.volume)) : null,
      h("div", { class: "hp-src" }, `${row.source} · ${statusWord({ status: row.sourceState })}`));
  }
  function paintBoardTabs(cfg = atlasCfg()) {
    const filters = boardFilters(cfg);
    if (!filters.some(([id]) => id === boardFilter)) boardFilter = "all";
    mount(boardTabs, filters.map(([id, label]) =>
      h("button", {
        class: "chip" + (id === boardFilter ? " active" : ""),
        onClick: () => { boardFilter = id; boardShow = defaultBoardShow(cfg.id); paintSectorBoard(); },
      }, label)));
  }
  function boardLeaderCard(row, idx) {
    // Leaders always carry a real price; the section note carries the source
    // once, so the card is number-first: name, price, move, chart. Nothing else.
    return h("button", { class: "market-leader-card " + signClass(row.chg24h), onClick: () => openBoardRow(row) },
      h("div", { class: "mlc-head" }, boardLogo(row, 34),
        h("div", {}, h("b", {}, row.name), h("span", { class: "num" }, row.sub))),
      h("div", { class: "mlc-price num" }, row.priceText || "—"),
      h("div", { class: "mlc-move num " + signClass(row.chg24h) }, row.chg24h != null ? `${moveValue(row.chg24h)} · ${row.kind === "crypto" ? "24h" : "session"}` : ""),
      boardChart(row, 168, 42));
  }
  function paintSectorBoard() {
    const cfg = atlasCfg();
    marketBoard.dataset.marketBoard = cfg.id;
    if (!ov) {
      boardTitle.textContent = "Market prices";
      boardNote.textContent = overviewError ? "Market overview failed" : "Data connecting";
      const msg = overviewError ? `Market overview could not load: ${overviewError}` : "Loading market board…";
      mount(boardCards, h("div", { class: "empty-state" }, msg));
      mount(boardBody, h("tr", {}, h("td", { colspan: 8, class: "l empty-state" }, overviewError ? "Retrying automatically…" : "Loading…")));
      return;
    }
    const raw = boardRowsRaw(cfg);
    const all = boardRows(cfg);
    const rows = all.slice(0, boardShow);
    boardTitle.textContent = cfg.id === "crypto" ? "Crypto market prices" : `${cfg.title} prices`;
    // When a whole non-crypto lane has zero real quotes, the table would be
    // pure dash furniture. Collapse it to one honest state line + the
    // instrument rail (every chart route stays one click away).
    const quotesDown = cfg.id !== "crypto" && raw.length > 0 && !raw.some((r) => r.price != null);
    marketBoard.classList.toggle("board-quotes-down", quotesDown);
    if (quotesDown) {
      boardNote.textContent = `${raw.length} instruments · quotes delayed · charts live`;
      boardCount.textContent = "";
      boardBody.replaceChildren();
      mount(boardCards,
        h("div", { class: "board-quotes-note" },
          h("span", { class: "source-dot" }),
          h("div", { class: "bqn-copy" },
            h("b", {}, "Quotes are warming"),
            h("span", {}, "Yahoo Finance rate-limits keyless clients; prices return automatically. Every instrument below opens its live chart meanwhile.")),
          h("button", { class: "mini-btn", onClick: () => openDataSheet() }, "Source detail")),
        h("div", { class: "board-instrument-rail" }, raw.map((row) =>
          h("button", { class: "board-instrument-chip", title: "Open " + row.name + " chart", onClick: () => openBoardRow(row) },
            boardLogo(row, 20),
            h("span", {}, row.name)))));
      return;
    }
    boardNote.textContent = `${boardSourceFor(cfg)} · ${raw.length} tracked`;
    boardCount.textContent = `${rows.length}/${all.length}`;
    paintBoardTabs(cfg);
    paintBoardHead(cfg);
    // Leader cards demand a real price — a chart route alone is not a leader.
    const leaders = boardRows(cfg)
      .filter((r) => r.price != null)
      .slice(0, 6);
    mount(boardCards, leaders.length ? leaders.map(boardLeaderCard) : []);
    const nCols = boardColumns(cfg).length;
    if (!all.length) {
      mount(boardBody, h("tr", {}, h("td", { colspan: nCols, class: "l empty-state" }, "No rows in this filtered view. Pin rows or switch filters.")));
      return;
    }
    mount(boardBody, rows.map((row, i) => {
      const tr = h("tr", { class: isPinned(row) ? "pinned-row" : "", onClick: (e) => { if (!e.target.closest("button")) openBoardRow(row); } },
        ...boardColumns(cfg).map((col) => boardCell(col, row, i)));
      attachPopover(tr, () => boardPopover(row));
      return tr;
    }));
    if (all.length > boardShow) {
      boardBody.appendChild(h("tr", {}, h("td", { colspan: nCols, class: "l", style: { textAlign: "center", height: "58px" } },
        h("button", { class: "mini-btn", style: { margin: "0 auto" }, onClick: () => { boardShow = Math.min(all.length, boardShow + (cfg.id === "crypto" ? 50 : 25)); paintSectorBoard(); } },
          `Show more (${boardShow} of ${all.length})`))));
    }
  }

  // ---- live news rail (squawk wire + outlets; lanes, live pulse, chips) ----
  const newsRail = h("aside", { class: "news-rail", id: "sec-news-rail" });
  const wireScrim = h("div", { class: "wire-scrim", onClick: () => toggleWire(false), "aria-hidden": "true" });
  const wireDesk = h("section", { class: "wire-desk wire-drawer", id: "sec-news", role: "dialog", "aria-modal": "true", "aria-hidden": "true" });
  let wireExpanded = false;
  let newsLane = "all";                  // all | squawk | macro | equity | crypto | onchain
  let wireLane = "all";
  let newsMenuOpen = false;
  let newsSort = "latest";               // latest | impact
  let seenNewsKeys = new Set();          // entrance animation for new stories
  const timeRefs = [];                   // [{el, iso}] — self-updating "Xm ago"
  const newsKey = (it) => (it.title || "").toLowerCase().replace(/\W+/g, " ").slice(0, 90);
  const LANES = [
    ["all", "All"], ["squawk", "Squawk"], ["macro", "Macro"], ["equity", "Equity"],
    ["crypto", "Crypto"], ["onchain", "On-chain"],
  ];
  const LANE_LABELS = { squawk: "Squawk", macro: "Macro", equity: "Equity", crypto: "Crypto", onchain: "On-chain" };
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const laneLabel = (lane) => LANE_LABELS[lane] || String(lane || "Market");
  function favicon(domain) {
    const raw = String(domain || "source").replace(/^www\./, "");
    const fallback = () => h("span", { class: "nr-fav nr-fav-local", "aria-hidden": "true" },
      raw.replace(/^@/, "").slice(0, 1).toUpperCase());
    if (raw.startsWith("@") || !raw.includes(".")) return fallback();
    const img = h("img", {
      class: "nr-fav nr-fav-img",
      src: `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(raw)}`,
      alt: "",
      loading: "lazy",
      referrerpolicy: "no-referrer",
    });
    img.addEventListener("error", () => img.replaceWith(fallback()), { once: true });
    return img;
  }
  const ageMin = (it) => (it && it.time ? (Date.now() - Date.parse(it.time)) / 60000 : null);
  function newBadge(it) {
    const m = ageMin(it);
    return m != null && m >= 0 && m < 30 ? h("span", { class: "nr-new" }, "NEW") : null;
  }
  // Crypto chips are only useful on crypto/on-chain stories. Macro/equity
  // headlines keep clean tags so the wire does not look like a token feed.
  function storyWantsTickerChips(it) {
    const lane = (it && it.lane) || "";
    const title = String((it && it.title) || "").toLowerCase();
    const tags = new Set((it && it.tags) || []);
    if (lane === "crypto" || lane === "onchain") return true;
    if (tags.has("crypto") || tags.has("stablecoins") || tags.has("defi") || tags.has("onchain")) return true;
    return /\b(bitcoin|btc|ethereum|eth|solana|xrp|bnb|doge|stablecoin|usdt|usdc|on-chain|onchain)\b/.test(title);
  }
  // detect which tracked crypto assets a headline is about → clickable chips
  function tickerChips(it) {
    const title = String((it && it.title) || it || "");
    if (!storyWantsTickerChips(it)) return [];
    const coins = (ov && ov.top_coins && ov.top_coins.coins) || [];
    const out = [];
    const explicit = new Set(((it && it.matched_symbols) || []).map((s) => String(s || "").toUpperCase()));
    for (const c of coins.slice(0, 120)) {
      if (out.length >= 2) break;
      let hit = false;
      try {
        hit = (explicit.has(c.base))
          || (c.name && c.name.length > 3 && new RegExp("\\b" + escapeRe(c.name) + "\\b", "i").test(title))
          || (c.base && c.base.length >= 3 && new RegExp("\\b" + escapeRe(c.base) + "\\b").test(title));
      } catch (e) { hit = false; }
      if (hit) {
        out.push(h("button", {
          class: "nr-chip num",
          onClick: (e) => { e.preventDefault(); e.stopPropagation(); navigate("/symbol/" + (c.binance ? c.binance.symbol : c.base + "USDT")); },
        }, coinIcon(c, 14), c.base));
      }
    }
    return out;
  }
  function newsMeta(it) {
    const t = h("span", { class: "num nr-time" }, timeAgo(it.time));
    if (it.time) timeRefs.push({ el: t, iso: it.time });
    return h("div", { class: "nr-meta" }, favicon(it.domain),
      t,
      h("span", { class: it.lane === "squawk" ? "nr-handle" : "" }, it.domain || "source"),
      it.lane ? h("span", { class: "nr-lane nr-lane-" + it.lane }, laneLabel(it.lane)) : null,
      // high-impact stories get a quiet flag, not a cryptic code
      it.impact >= 70 ? h("span", { class: "nr-impact num", title: (it.reason || "impact score") + " · " + it.impact + "/100" }, "★") : null,
      newBadge(it));
  }
  function newsTags(it) {
    const tags = (it.tags || []).slice(0, 3);
    const plainSyms = storyWantsTickerChips(it) ? [] : (it.matched_symbols || []).slice(0, 3);
    if (!tags.length && !plainSyms.length) return null;
    return h("div", { class: "nr-tags" },
      tags.map((t) => h("span", { class: "nr-tag" }, t)),
      plainSyms.map((s) => h("span", { class: "nr-tag nr-symbol-tag num" }, "$" + s)));
  }
  function newsCoverageStrip() {
    const cov = (news && news.coverage) || [];
    if (!cov.length) return null;
    const SHORT = { tree_news: "Tree relay", rss: "Outlets ×17", lookonchain: "Lookonchain", news: "GDELT" };
    const GLYPH = { tree_news: "radio", rss: "globe", lookonchain: "database", news: "newspaper" };
    const preferred = ["tree_news", "rss", "lookonchain", "news"];   // keyless server-side feeds only
    const rows = preferred.map((id) => cov.find((c) => c.id === id)).filter(Boolean);
    return h("div", { class: "nr-settings-group nr-coverage nr-provider-list" },
      h("div", { class: "nr-group-title" }, "Coverage"),
      rows.map((c) => {
      const st = c.status || "idle";
      const detail = c.detail || (st === "live" ? "Headlines, desktop, cached" : "Warming server-side");
      return h("span", { class: "nr-cov " + statusClass(st), title: (c.label || "") + (c.detail ? " — " + c.detail : "") },
        h("span", { class: "nr-cov-icon" }, icon(GLYPH[c.id] || "radio")),
        h("span", { class: "nr-cov-copy" },
          h("b", {}, SHORT[c.id] || c.label),
          h("small", {}, statusWord(c) + " · " + detail)),
        h("span", { class: "nr-cov-state" }, statusWord(c)));
    }));
  }
  function newsLaneStrip(items) {
    const counts = { ...(news && news.lane_counts || {}), all: items.length };
    return h("div", { class: "nr-settings-group nr-sources", role: "tablist", "aria-label": "News lane" },
      h("div", { class: "nr-group-title" }, "Filter"),
      LANES.map(([id, label]) => {
      if (id !== "all" && !counts[id]) return null;
      return h("button", {
        class: "nr-source" + (newsLane === id ? " active" : ""),
        role: "tab",
        "aria-selected": newsLane === id ? "true" : "false",
        onClick: () => { newsLane = id; paintPulse(); },
      }, h("span", {}, label), h("span", { class: "num" }, counts[id] || 0));
    }).filter(Boolean));
  }
  function newsCategoryPicker(items) {
    const counts = { ...(news && news.lane_counts || {}), all: items.length };
    const opts = LANES.filter(([id]) => id === "all" || counts[id]);
    const cur = opts.find(([id]) => id === newsLane) || opts[0] || ["all", "All"];
    return h("div", { class: "nr-category-wrap" },
      h("button", {
        class: "nr-category-trigger",
        type: "button",
        "aria-expanded": newsMenuOpen ? "true" : "false",
        onClick: () => { newsMenuOpen = !newsMenuOpen; paintPulse(); },
      },
        h("span", { class: "nr-category-glyph", "aria-hidden": "true" },
          h("i", {}), h("i", {}), h("i", {}), h("i", {})),
        h("span", {}, cur[0] === "all" ? "All Categories" : cur[1]),
        icon("chevronDown")),
      h("button", { class: "nr-search-icon", type: "button", title: "Open searchable news wire", onClick: () => { paintWireDesk(); toggleWire(true); } }, icon("search")),
      h("button", {
        class: "nr-sort-icon " + newsSort,
        type: "button",
        title: newsSort === "latest" ? "Sort by impact" : "Sort newest first",
        "aria-label": newsSort === "latest" ? "Sort by impact" : "Sort newest first",
        onClick: () => { newsSort = newsSort === "latest" ? "impact" : "latest"; paintPulse(); },
      }, icon(newsSort === "latest" ? "sliders" : "trendingUp")),
      newsMenuOpen ? h("div", { class: "nr-category-pop", role: "menu" }, opts.map(([id, label]) =>
        h("button", {
          class: "nr-category-option " + (newsLane === id ? "on" : ""),
          type: "button",
          role: "menuitemradio",
          "aria-checked": newsLane === id ? "true" : "false",
          onClick: () => { newsLane = id; newsMenuOpen = false; paintPulse(); },
        },
          h("span", { class: "nr-category-glyph", "aria-hidden": "true" },
            h("i", {}), h("i", {}), h("i", {}), h("i", {})),
          h("span", {}, id === "all" ? "All Categories" : label),
          h("b", { class: "num" }, counts[id] || 0),
          newsLane === id ? h("span", { class: "nr-category-check" }, "✓") : null))) : null);
  }
  function newsDeskButton(label, value, sub, cls, onClick) {
    return h("button", {
      class: "nr-desk-cell " + (cls || ""),
      type: "button",
      title: sub ? `${label}: ${value || "—"} · ${sub}` : label,
      onClick,
    },
      h("span", { class: "nr-desk-k" }, label),
      h("b", { class: "nr-desk-v num" }, value || "—"));
  }
  function newsDeskBrief(items, filtered, nSources) {
    const latest = sortNewsItems(items)[0] || filtered[0];
    const lanes = (news && news.lane_counts) || {};
    const marketDesk = (lanes.macro || 0) + (lanes.equity || 0);
    const cryptoDesk = (lanes.crypto || 0) + (lanes.onchain || 0);
    return h("div", { class: "nr-desk-brief", "aria-label": "News wire state" },
      newsDeskButton("Fresh", latest && latest.time ? timeAgo(latest.time) : "warming",
        latest ? latest.domain || laneLabel(latest.lane) : "server cache", "fresh",
        () => { newsSort = "latest"; paintPulse(); }),
      newsDeskButton("Markets", marketDesk || "—", "macro + equity", "sources",
        () => { newsLane = marketDesk ? "macro" : "all"; paintPulse(); }),
      newsDeskButton("Crypto", cryptoDesk || "—", "crypto + on-chain", "sources",
        () => { newsLane = cryptoDesk ? "crypto" : "all"; paintPulse(); }));
  }
  function wireIconAction(label, ic, onClick, cls = "") {
    return h("button", {
      class: "wire-icon-action " + cls,
      type: "button",
      title: label,
      "aria-label": label,
      onClick,
    }, icon(ic), h("span", { class: "wire-action-label" }, label));
  }
  function railStory(it, lead = false) {
    const chips = tickerChips(it);
    const t = h("span", { class: "num nr-time" }, timeAgo(it.time));
    if (it.time) timeRefs.push({ el: t, iso: it.time });
    return h("a", {
      class: "nr-row-story " + (lead ? "lead " : "") + (it.lane === "squawk" ? "squawk " : "") + (lead && it.lane === "squawk" ? "nr-squawk-lead " : ""),
      href: it.url,
      target: "_blank",
      rel: "noopener noreferrer",
    },
      h("span", { class: "nr-row-icon" }, favicon(it.domain)),
      h("span", { class: "nr-row-copy" },
        h("b", { class: "nr-row-title" }, it.title),
        h("span", { class: "nr-row-sub" },
          h("span", {}, it.domain || "source"),
          h("span", {}, " · "),
          t,
          it.lane ? h("span", { class: "nr-lane nr-lane-" + it.lane }, laneLabel(it.lane)) : null),
        lead && chips.length ? h("div", { class: "nr-chips" }, chips.slice(0, 2)) : null));
  }
  function railGroupedStories(items, isNew) {
    const groups = [];
    items.forEach((it) => {
      const label = wireGroupLabel(it);
      let group = groups[groups.length - 1];
      if (!group || group.label !== label) {
        group = { label, items: [] };
        groups.push(group);
      }
      group.items.push(it);
    });
    return groups.map((group) => h("section", { class: "nr-list-section" },
      h("div", { class: "nr-list-month" }, group.label),
      group.items.map((it) => {
        const row = railStory(it);
        if (isNew(it)) row.classList.add("nr-enter");
        return row;
      })));
  }
  function sortNewsItems(items) {
    const copy = [...items];
    if (newsSort === "impact") {
      return copy.sort((a, b) => (Number(b.impact) || 0) - (Number(a.impact) || 0) || Date.parse(b.time || 0) - Date.parse(a.time || 0));
    }
    return copy.sort((a, b) => Date.parse(b.time || 0) - Date.parse(a.time || 0) || (Number(b.impact) || 0) - (Number(a.impact) || 0));
  }
  function statusClass(status) {
    if (status === "live") return "live";
    if (status === "chart_route") return "live";
    if (status === "delayed" || status === "stale" || status === "tree_backed") return "stale";
    if (status === "requires_key") return "locked";
    if (status === "not_configured" || status === "disabled") return "off";
    if (status === "error" || status === "unavailable") return "error";
    return "idle";
  }
  function switchToCombinedNews() {
    setSetting("source", "combined");
    toggleWire(false);
  }
  function newsPausedActions(close = false) {
    return h("div", { class: "news-paused-actions" },
      h("button", { class: "wire-source-btn news-mode-primary", onClick: switchToCombinedNews },
        icon("radio"), "Switch to Combined"),
      h("button", { class: "wire-source-btn", onClick: () => openDataSheet() },
        icon("database"), "Source health"),
      close ? h("button", { class: "wire-source-btn", onClick: () => toggleWire(false) },
        icon("x"), "Close") : null);
  }
  function toggleWire(open = !wireExpanded) {
    wireExpanded = !!open;
    wireDesk.classList.toggle("open", wireExpanded);
    wireDesk.setAttribute("aria-hidden", wireExpanded ? "false" : "true");
    wireScrim.classList.toggle("open", wireExpanded);
    wireScrim.setAttribute("aria-hidden", wireExpanded ? "false" : "true");
  }
  function wireLaneStrip(items) {
    const counts = { ...(news && news.lane_counts || {}), all: items.length };
    return h("div", { class: "wire-tabs", role: "tablist" }, LANES.map(([id, label]) => {
      if (id !== "all" && !counts[id]) return null;
      return h("button", {
        class: "wire-tab" + (wireLane === id ? " active" : ""),
        role: "tab",
        "aria-selected": wireLane === id ? "true" : "false",
        onClick: () => { wireLane = id; paintWireDesk(); },
      }, h("span", {}, label), h("b", { class: "num" }, counts[id] || 0));
    }).filter(Boolean));
  }
  function wireStat(label, value, sub, cls = "") {
    return h("div", { class: "wire-stat " + cls },
      h("span", { class: "wire-stat-k" }, label),
      h("b", { class: "wire-stat-v num" }, value),
      h("span", { class: "wire-stat-sub" }, sub || ""));
  }
  function wireGroupLabel(it) {
    const ts = Date.parse(it && it.time || 0);
    if (!Number.isFinite(ts)) return "Earlier";
    const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (mins < 60) return "Last hour";
    if (mins < 24 * 60) return "Today";
    if (mins < 48 * 60) return "Yesterday";
    return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(ts));
  }
  function wireGroupedStories(items) {
    const groups = [];
    items.forEach((it) => {
      const label = wireGroupLabel(it);
      let group = groups[groups.length - 1];
      if (!group || group.label !== label) {
        group = { label, items: [] };
        groups.push(group);
      }
      group.items.push(it);
    });
    return groups.map((group) => h("section", { class: "wire-list-section" },
      h("div", { class: "wire-list-month" }, group.label),
      group.items.map((it) => wireStory(it))));
  }
  function providerHost(p) {
    try {
      return new URL(p.url || "").hostname.replace(/^www\./, "") || (p.id || "source");
    } catch {
      return p.id || "source";
    }
  }
  function providerGroupLabel(p) {
    const st = p.status || "idle";
    if (st === "live") return "Live";
    if (st === "delayed" || st === "tree_backed" || st === "stale") return "Delayed";
    if (st === "requires_key") return "Requires key";
    if (st === "error" || st === "unavailable") return "Errors";
    return "Directory";
  }
  function providerRow(p) {
    const status = p.status || "idle";
    const host = providerHost(p);
    const countLabel = p.count
      ? p.count + " in wire"
      : p.fetched_count
        ? p.fetched_count + " fetched"
        : p.error
          ? "feed warning"
          : host;
    return h("a", {
      class: "provider-row " + statusClass(status),
      href: p.url || "#",
      target: p.url ? "_blank" : "",
      rel: p.url ? "noopener noreferrer" : "",
      onClick: p.url ? null : (e) => e.preventDefault(),
    },
      h("span", { class: "provider-row-icon" }, favicon(host)),
      h("span", { class: "provider-row-copy" },
        h("b", { class: "provider-row-name" }, p.label || host),
        h("span", { class: "provider-row-sub" },
          h("span", {}, p.route || p.note || host),
          h("span", {}, " · "),
          h("span", { class: "num" }, countLabel))),
      h("span", { class: "provider-row-state" }, statusWord(p)));
  }
  function providerList(providers) {
    const order = ["Live", "Delayed", "Requires key", "Errors", "Directory"];
    const buckets = Object.fromEntries(order.map((label) => [label, []]));
    providers.forEach((p) => {
      const label = providerGroupLabel(p);
      (buckets[label] || buckets.Directory).push(p);
    });
    const groups = order.map((label) => ({ label, items: buckets[label] })).filter((group) => group.items.length);
    return h("div", { class: "provider-list" }, groups.map((group) =>
      h("section", { class: "provider-list-section" },
        h("div", { class: "provider-list-month" }, group.label),
        group.items.map(providerRow))));
  }
  function providerCard(p) {
    const status = p.status || "idle";
    const countLabel = p.count
      ? p.count + " in wire"
      : p.fetched_count
        ? p.fetched_count + " fetched"
        : p.error
          ? "feed warning"
          : "";
    const card = h("a", {
      class: "provider-card " + statusClass(status),
      href: p.url || "#",
      target: p.url ? "_blank" : "",
      rel: p.url ? "noopener noreferrer" : "",
      onClick: p.url ? null : (e) => e.preventDefault(),
    },
      h("div", { class: "provider-top" },
        h("span", { class: "provider-kind" }, p.kind || "source"),
        h("span", { class: "provider-state" }, statusWord(p))),
      h("div", { class: "provider-name" }, p.label),
      h("div", { class: "provider-route" }, p.route || "not wired"),
      h("div", { class: "provider-note" }, p.error ? (p.note || "") + " · " + p.error : (p.note || "")),
      countLabel ? h("div", { class: "provider-count num" }, countLabel) : null);
    return card;
  }
  function wireStory(it, lead = false) {
    const chips = tickerChips(it);
    const tags = newsTags(it);
    const t = h("span", { class: "num wire-time" }, timeAgo(it.time));
    if (it.time) timeRefs.push({ el: t, iso: it.time });
    return h("a", {
      class: "wire-story " + (lead ? "lead " : "") + (it.lane || "crypto"),
      href: it.url,
      target: "_blank",
      rel: "noopener noreferrer",
    },
      h("span", { class: "wire-story-icon" }, favicon(it.domain)),
      h("span", { class: "wire-story-copy" },
        h("span", { class: "wire-story-top" },
          h("span", { class: "wire-story-meta" },
            h("span", { class: "wire-source" }, it.domain || "source"),
            h("span", { class: "wire-dot", "aria-hidden": "true" }, "·"),
            t),
          h("span", { class: "wire-story-flags" },
            it.lane ? h("span", { class: "nr-lane nr-lane-" + it.lane }, laneLabel(it.lane)) : null,
            it.impact ? h("span", { class: "wire-impact num", title: (it.reason || "impact score") + " · " + it.impact + "/100" }, "I" + it.impact) : null)),
        h(lead ? "h3" : "b", { class: "wire-story-title" }, it.title),
        (tags || chips.length) ? h("div", { class: "wire-story-context" },
          tags,
          chips.length ? h("div", { class: "nr-chips" }, chips) : null) : null));
  }
  function paintWireDesk() {
    if (binanceOnly()) {
      wireDesk.classList.remove("is-hidden");
      const providers = (news && news.providers) || [];
      mount(wireDesk,
        h("div", { class: "wire-head" },
          h("div", {},
            h("div", { class: "wire-kicker" }, icon("radio"), "News wire paused"),
            h("h2", { class: "wire-title" }, "External news is hidden in Binance-only mode"),
            h("p", { class: "wire-copy" },
              "The feed was not removed. Strict exchange mode suppresses Tree, RSS, Lookonchain, WSJ/Benzinga/FinancialJuice and X/API-only sources so the page stays Binance-public only.")),
          h("div", { class: "wire-actions" },
            h("button", { class: "wire-close", title: "Close wire", onClick: () => toggleWire(false) }, icon("x")))),
        h("div", { class: "wire-stats" },
          wireStat("Mode", "Binance", "public exchange data only"),
          wireStat("News rail", "Paused", "not deleted", "hot"),
          wireStat("Restore", "Combined", "enables external context"),
          wireStat("Providers", providers.length || "—", "tracked when combined")),
        h("div", { class: "wire-paused-layout" },
          h("div", { class: "wire-empty wire-paused-card" },
            icon("info"),
            h("b", {}, "Nothing is silently hidden anymore"),
            h("span", {}, "Use Combined when you want the live news desk. Keep Binance-only when you want a strict local exchange surface."),
            newsPausedActions(true)),
          providers.length ? h("div", { class: "provider-panel provider-list-panel" },
            h("div", { class: "provider-head" },
              h("span", {}, "External providers kept ready"),
              h("span", { class: "num" }, providers.length + " tracked")),
            providerList(providers.slice(0, 8))) : null));
      return;
    }
    wireDesk.classList.remove("is-hidden");
    const items = (news && news.items) || [];
    const providers = (news && news.providers) || [];
    if (wireLane !== "all" && !items.some((it) => (it.lane || "crypto") === wireLane)) wireLane = "all";
    const filtered = sortNewsItems(wireLane === "all" ? items : items.filter((it) => (it.lane || "crypto") === wireLane));
    const sourceCount = new Set(items.map((it) => it.domain || "source")).size;
    const lanes = (news && news.lane_counts) || {};
    const marketDesk = (lanes.macro || 0) + (lanes.equity || 0);
    const cryptoDesk = (lanes.crypto || 0) + (lanes.onchain || 0);
    const liveProviders = providers.filter((p) => ["live", "delayed", "stale", "tree_backed"].includes(p.status)).length;
    const storyRows = filtered.slice(0, 28);
    const providerRows = providers.length ? providers : [
      { label: "Tree News", kind: "squawk", status: "idle", route: "warming", note: "Source status appears after first news fetch." },
    ];
    const delayedProviders = providerRows.filter((p) => ["delayed", "stale", "tree_backed"].includes(p.status)).length;
    const blockedProviders = providerRows.filter((p) => ["requires_key", "not_configured", "disabled", "error", "unavailable"].includes(p.status)).length;
    mount(wireDesk,
      h("div", { class: "wire-head" },
        h("div", {},
          h("div", { class: "wire-kicker" }, icon("radio"), "News source map"),
          h("h2", { class: "wire-title" }, "Live Wire Desk"),
          h("p", { class: "wire-copy" }, "Structured headlines, source state and market-lane filters stay visible together so freshness is readable at a glance.")),
        h("div", { class: "wire-actions" },
          wireIconAction("Data health", "database", () => openDataSheet()),
          h("button", { class: "wire-close", title: "Close wire", onClick: () => toggleWire(false) }, icon("x")))),
      h("div", { class: "wire-grid wire-desk-grid" },
        h("div", { class: "wire-main-column" },
          wireLaneStrip(items),
          h("div", { class: "wire-feed wire-feed-list" },
            storyRows.length ? wireGroupedStories(storyRows) : h("div", { class: "wire-empty" },
              icon("info"), h("b", {}, "Wire is warming"), h("span", {}, "Tree relay/RSS/Lookonchain/GDELT fetch in the background.")))),
        h("aside", { class: "wire-source-column" },
          h("div", { class: "wire-stats wire-stats-rail" },
            wireStat("Headlines", items.length || "—", "cached server-side", items.length ? "ok" : ""),
            wireStat("Sources", sourceCount || "—", "unique domains", sourceCount ? "ok" : ""),
            wireStat("Macro/equity", marketDesk || "—", "market desk", marketDesk ? "hot" : ""),
            wireStat("Crypto/on-chain", cryptoDesk || "—", "asset + wallet", cryptoDesk ? "ok" : ""),
            wireStat("Providers", `${liveProviders}/${providerRows.length}`, "live or warming", liveProviders ? "ok" : ""),
            wireStat("Delayed/blocked", `${delayedProviders}/${blockedProviders}`, "labeled before use", delayedProviders || blockedProviders ? "hot" : "")),
          h("div", { class: "provider-panel provider-list-panel" },
            h("div", { class: "provider-head" },
              h("span", {}, "Provider coverage"),
              h("span", { class: "num" }, providerRows.length + " tracked")),
            providerList(providerRows)))));
  }
  function paintPulse() {
    if (binanceOnly()) {
      timeRefs.length = 0;
      const providers = (news && news.providers) || [];
      const head = h("div", { class: "nr-head" },
        h("span", { class: "nr-live paused" }),
        h("div", { class: "nr-title-wrap" },
          h("h2", { class: "sec-title", style: { fontSize: "17px" } }, "Live news"),
          h("span", { class: "sec-note" }, "paused")),
        h("button", { class: "nr-expand nr-expand-icon", onClick: () => { paintWireDesk(); toggleWire(true); }, title: "Open news mode detail", "aria-label": "Open news mode detail" },
          icon("arrowUpRight"), h("span", { class: "btn-copy" }, "Details")));
      mount(newsRail, head,
        h("div", { class: "news-paused" },
          h("div", { class: "news-paused-orb" }, icon("radio")),
          h("div", { class: "news-paused-k" }, "Binance public only"),
          h("div", { class: "news-paused-title" }, "News wire is paused, not removed"),
          h("p", {},
            "External feeds are intentionally suppressed in this mode: Tree delayed relay, RSS outlets, Lookonchain, WSJ/Benzinga/FinancialJuice and X/API-only sources."),
          h("div", { class: "news-paused-meta" },
            h("span", {}, "Combined restores live headlines"),
            h("span", { class: "num" }, providers.length ? providers.length + " providers ready" : "providers warm after first fetch")),
          newsPausedActions(false)));
      return;
    }
    const items = (news && news.items) || [];
    if (newsLane !== "all" && !items.some((it) => (it.lane || "crypto") === newsLane)) newsLane = "all";
    const filtered = sortNewsItems(newsLane === "all" ? items : items.filter((it) => (it.lane || "crypto") === newsLane));
    const nSources = new Set(items.map((it) => it.domain || "source")).size;
    timeRefs.length = 0;
    const head = h("div", { class: "nr-head" },
      h("span", { class: "nr-live " + ((news && news.status) || "idle") }),
        h("div", { class: "nr-title-wrap" },
          h("h2", { class: "sec-title", style: { fontSize: "17px" } }, "Live news"),
        h("span", { class: "sec-note" }, items.length ? `${items.length} headlines` : "warming")),
      h("button", { class: "nr-expand", onClick: () => { paintWireDesk(); toggleWire(true); }, title: "Expand news wire" },
        icon("arrowUpRight"), h("span", { class: "btn-copy" }, "Expand")));
    if (!items.length) {
      mount(newsRail, head, h("div", { class: "ghost-tile" }, icon("info"),
        h("div", {},
          h("div", { class: "gt-title" }, "Headlines loading"),
          h("div", { class: "gt-sub" }, "The Tree relay, RSS outlets, GDELT and Lookonchain are cached server-side and appear as they warm.")),
        h("span", { class: "gt-badge" }, (news && news.status) || "connecting")));
      return;
    }
    const isNew = (it) => seenNewsKeys.size > 0 && !seenNewsKeys.has(newsKey(it));
    const lead = filtered.length ? railStory(filtered[0], true) : null;
    if (lead && isNew(filtered[0])) lead.classList.add("nr-enter");
    mount(newsRail, head, newsDeskBrief(items, filtered, nSources), newsCategoryPicker(items),
      lead,
      h("div", { class: "nr-list nr-grouped-list" }, railGroupedStories(filtered.slice(1, 11), isNew)));
    seenNewsKeys = new Set(items.map(newsKey));
  }

  // ---- basis & funding intelligence (exchange stream universe) ----
  const intelWrap = h("div", { class: "signals" });
  const intelSection = h("section", { class: "sector-crypto-only", id: "sec-intel" },
    h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Basis & funding intelligence"),
      h("a", { class: "ghost-link", href: "/radar", onClick: linkTo("/radar") }, "Open full Radar ›")),
    intelWrap);
  function paintIntel() {
    if (!ov) return;
    const byBase = {};
    (ov.top_coins && ov.top_coins.coins || []).forEach((c) => { byBase[c.base] = c; });
    const col = (label, path, list, valFn, clsFn) =>
      h("div", { class: "sig" },
        h("div", { class: "sig-head", onClick: () => navigate(path) },
          h("span", { class: "sig-label" }, label), h("span", { class: "sig-more" }, "Open ›")),
        (list || []).slice(0, 4).map((r) => {
          const b = baseOf(r.symbol);
          const row = h("div", { class: "sig-row", onClick: () => navigate("/symbol/" + r.symbol) },
            coinIcon(byBase[b] || { base: b }, 22),
            h("span", { class: "sig-name" }, b),
            h("span", { class: "sig-val num " + clsFn(r) }, valFn(r)));
          attachPopover(row, () => majorPopoverAny(r));
          return row;
        }));
    mount(intelWrap,
      col("Widest basis", "/radar", ov.top_basis, (r) => fmtBasisVal(r.mid_spread_bps, true) + " " + basisUnit(), (r) => signClass(r.mid_spread_bps)),
      col("Shorts paying", "/funding", ov.funding_top, (r) => fmtFunding(r.funding_rate), () => "up"),
      col("Longs paying", "/funding", ov.funding_bottom, (r) => fmtFunding(r.funding_rate), () => "down"),
      col("Top score", "/radar", ov.top_score, (r) => fmtScore(r.opportunity_score), () => "strong"));
  }
  function majorPopoverAny(r) {
    const pts = sparks[r.symbol] || [];
    return h("div", {},
      h("div", { class: "hp-head" }, tokenIcon(r.symbol, 22), h("b", {}, baseOf(r.symbol)), h("span", { class: "muted" }, r.symbol)),
      pts.length > 2 ? h("div", { class: "hp-chart", html: sparkArea(pts.map((p) => p[1]), 220, 44, brandColor(r.symbol)) }) : null,
      popRow("Spot", fmtPrice(r.spot_mid)),
      popRow("Basis", fmtBasisVal(r.mid_spread_bps, true) + " " + basisUnit(), signClass(r.mid_spread_bps)),
      popRow("Funding / 8h", fmtFunding(r.funding_rate), signClass(r.funding_rate)),
      popRow("Score", fmtScore(r.opportunity_score)),
      h("div", { class: "hp-src" }, "binance · live — click to open"));
  }

  // ---- page scaffold ----
  const subLine = h("div", { class: "page-sub" }, "loading…");
  const regimePill = h("span", { class: "pill-regime" });
  // ---- top movers today (external 24h data) ----
  const moversWrap = h("div", { class: "signals market-signals-grid" });
  const moversTitle = h("h2", { class: "sec-title" }, "Market movers");
  const moversNote = h("span", { class: "sec-note" }, "Selected market");
  const moversSection = h("section", { class: "market-signals-section", id: "sec-movers" },
    h("div", { class: "sec-head" }, moversTitle, moversNote),
    moversWrap);
  function marketSignalRows(cfg = atlasCfg()) {
    return boardRowsRaw(cfg).filter((r) => r && (r.route || r.tvSymbol || r.price != null || r.priceText));
  }
  function signalMove(row) {
    if (row.chg24h != null && isFinite(Number(row.chg24h))) return moveValue(row.chg24h);
    if (row.priceText && row.priceText !== "—") return row.priceText;
    return row.tvSymbol ? "Chart" : "Awaiting";
  }
  function signalMoveClass(row) {
    return row.chg24h != null ? signClass(row.chg24h) : "neutral";
  }
  function signalPrice(row) {
    return row.priceText && row.priceText !== "—" ? row.priceText : row.tvSymbol ? "Chart" : "—";
  }
  function signalSource(row) {
    return statusWord({ status: row.sourceState || "live" });
  }
  function marketSignalItem(row, valFn, clsFn) {
    const item = h("button", { class: "sig-row sig-action", onClick: () => openBoardRow(row) },
      boardLogo(row, 24),
      h("span", { class: "sig-name" }, row.name),
      h("span", { class: "sig-val num " + clsFn(row) }, valFn(row)));
    attachPopover(item, () => boardPopover(row));
    return item;
  }
  function marketSignalColumn(label, rows, valFn, clsFn, opts = {}) {
    const filter = opts.filter || "all";
    const list = rows.slice(0, opts.limit || 4);
    return h("div", { class: "sig market-signal-card" },
      h("button", {
        class: "sig-head",
        onClick: () => {
          boardFilter = filter;
          boardShow = defaultBoardShow(atlasCategory);
          paintSectorBoard();
          marketBoard.scrollIntoView({ behavior: "smooth", block: "start" });
        },
      }, h("span", { class: "sig-label" }, label), h("span", { class: "sig-more" }, "Show")),
      list.length
        ? list.map((row) => marketSignalItem(row, valFn, clsFn))
        : h("div", { class: "sig-empty" }, opts.empty || "Awaiting live source"));
  }
  function sortedByMove(rows, dir = -1) {
    return rows
      .filter((r) => r.chg24h != null && isFinite(Number(r.chg24h)))
      .sort((a, b) => dir * (Number(a.chg24h) - Number(b.chg24h)));
  }
  function rowsByVolume(rows) {
    return rows
      .filter((r) => r.volume != null && isFinite(Number(r.volume)))
      .sort((a, b) => Number(b.volume) - Number(a.volume));
  }
  function rowsBySevenDay(rows) {
    return rows
      .filter((r) => r.chg7d != null && isFinite(Number(r.chg7d)))
      .sort((a, b) => Number(b.chg7d) - Number(a.chg7d));
  }
  function chartReadyRows(rows) {
    return rows.filter((r) => r.tvSymbol || r.route || (r.spark || []).length > 5);
  }
  function rowsForGroup(cfg, rows, index) {
    const group = (cfg.groups || [])[index];
    if (!group) return [];
    const symbols = new Set((group[1] || []).map(String));
    return rows.filter((r) => r.item && symbols.has(r.item.s));
  }
  function signalLabels(cfg) {
    switch (cfg.id) {
      case "crypto":
        return ["Top gainers · 24h", "Top losers · 24h", "Top volume", "7d strength"];
      case "us-stocks":
        return ["US gainers · session", "US losers · session", "Mega-cap tape", "Chart-ready"];
      case "world-stocks":
        return ["World gainers · session", "World losers · session", "Global leaders", "Chart-ready"];
      case "indices":
        return ["Index gainers", "Index losers", "US benchmarks", "World benchmarks"];
      case "futures":
        return ["Commodity gainers", "Commodity losers", "Metals / energy", "Index futures"];
      case "forex":
        return ["FX gainers", "FX losers", "Majors", "Currency indices"];
      case "etfs":
        return ["ETF gainers", "ETF losers", "Most watched", "Bond / crypto ETF lane"];
      case "gov-bonds":
        return ["Yield movers", "Yield pressure", "US curve", "World yields"];
      case "corp-bonds":
        return ["Credit movers", "Rate-sensitive", "High yield", "Core bond tape"];
      case "economy":
        return ["Growth indicators", "Inflation / rates", "Policy context", "Chart-ready"];
      default:
        return ["Top gainers", "Top losers", "Watched tape", "Chart-ready"];
    }
  }
  function sourceHealthRows(rows) {
    const ranked = [...rows].sort((a, b) => {
      const score = (r) => r.sourceState === "live" ? 3 : r.sourceState === "delayed" || r.sourceState === "stale" ? 2 : r.tvSymbol ? 1 : 0;
      return score(b) - score(a);
    });
    return ranked;
  }
  function groupLabel(cfg, index, fallback) {
    return ((cfg.groups || [])[index] || [fallback])[0] || fallback;
  }
  function curatedSignalRows(cfg, rows, slot) {
    const live = chartReadyRows(rows);
    if (cfg.id === "indices") {
      if (slot === 2) return rows.filter((r) => ["SPX", "NDX", "DJI", "RUT"].includes(r.symbol));
      if (slot === 3) return rows.filter((r) => !["SPX", "NDX", "DJI", "RUT"].includes(r.symbol));
    }
    if (cfg.id === "futures") {
      if (slot === 2) return rows.filter((r) => /GC|SI|HG|PL|CL|NG|BRN|RB|HO/.test(r.symbol));
      if (slot === 3) return rows.filter((r) => /ES|NQ|YM|RTY|VX|EMD/.test(r.symbol));
    }
    if (cfg.id === "forex") {
      if (slot === 2) return rows.filter((r) => /USD|EUR|GBP|JPY|CHF|CAD|AUD/.test(r.symbol)).slice(0, 8);
      if (slot === 3) return rows.filter((r) => /DXY|EXY|JXY|BXY|SXY|CXY/.test(r.symbol));
    }
    if (cfg.id === "etfs") {
      if (slot === 2) return rows.filter((r) => /SPY|QQQ|VOO|VTI|IWM|DIA|XLK|SMH|SOXX/.test(r.symbol));
      if (slot === 3) return rows.filter((r) => /IBIT|ETHA|GLD|SLV|TLT|BND|AGG|HYG|LQD/.test(r.symbol));
    }
    if (cfg.id === "gov-bonds") {
      if (slot === 2) return rows.filter((r) => /US|10|2|30|5|TNX|TYX|FVX|IRX/.test(r.symbol));
      if (slot === 3) return rows.filter((r) => /DE|JP|UK|IN|FR|IT|CA|AU/.test(r.symbol));
    }
    if (cfg.id === "corp-bonds") {
      if (slot === 2) return rows.filter((r) => /HYG|JNK|SHYG/.test(r.symbol));
      if (slot === 3) return rows.filter((r) => /LQD|VCIT|VCSH|BND|AGG/.test(r.symbol));
    }
    if (cfg.id === "economy") {
      if (slot === 2) return rows.filter((r) => /GDP|RATE|CPI|INFLATION|UNEMP|PAYROLL/i.test(r.name + " " + r.symbol));
      if (slot === 3) return live;
    }
    return live;
  }
  function paintTopMovers() {
    if (!ov) return;
    const cfg = atlasCfg();
    const rows = marketSignalRows(cfg);
    moversTitle.textContent = `${cfg.title} movers`;
    moversNote.textContent = `${boardSourceFor(cfg)} · ${rows.length} tracked`;
    if (!rows.length) {
      mount(moversWrap, h("div", { class: "empty-state" }, "This market tab is waiting on source data."));
      return;
    }
    const labels = signalLabels(cfg);
    const gainers = sortedByMove(rows, -1);
    const losers = sortedByMove(rows, 1);
    const volume = rowsByVolume(rows);
    const strength = rowsBySevenDay(rows);
    const fallback = chartReadyRows(rows);
    const hasRealMove = gainers.length >= 2 && losers.length >= 2;
    if (cfg.id !== "crypto" && !hasRealMove) {
      const firstGroup = rowsForGroup(cfg, rows, 0);
      const secondGroup = rowsForGroup(cfg, rows, 1);
      const liveRows = sourceHealthRows(rows);
      mount(moversWrap,
        marketSignalColumn(groupLabel(cfg, 0, `${cfg.title} tape`), firstGroup.length ? firstGroup : fallback, signalPrice, signalMoveClass, { filter: "live" }),
        marketSignalColumn(groupLabel(cfg, 1, "Watchlist"), secondGroup.length ? secondGroup : fallback, signalPrice, signalMoveClass, { filter: "live" }),
        marketSignalColumn("Chart-ready", fallback.length ? fallback : rows, signalSource, (r) => statusClass(r.sourceState || "live"), { filter: "live" }),
        marketSignalColumn("Quote health", liveRows, signalSource, (r) => statusClass(r.sourceState || "live"), { filter: "live" }));
      return;
    }
    const thirdRows = cfg.id === "crypto" && volume.length ? volume : curatedSignalRows(cfg, rows, 2);
    const fourthRows = cfg.id === "crypto" && strength.length ? strength : curatedSignalRows(cfg, rows, 3);
    mount(moversWrap,
      marketSignalColumn(labels[0], gainers.length ? gainers : fallback, signalMove, signalMoveClass, { filter: "gainers" }),
      marketSignalColumn(labels[1], losers.length ? losers : fallback, signalMove, signalMoveClass, { filter: "losers" }),
      marketSignalColumn(labels[2], thirdRows.length ? thirdRows : fallback,
        cfg.id === "crypto" && volume.length ? (r) => fmtMoney(r.volume) : signalPrice,
        cfg.id === "crypto" && volume.length ? () => "strong" : signalMoveClass,
        { filter: cfg.id === "crypto" && volume.length ? "volume" : "live" }),
      marketSignalColumn(labels[3], fourthRows.length ? fourthRows : fallback,
        cfg.id === "crypto" && strength.length ? (r) => moveValue(r.chg7d) : signalSource,
        cfg.id === "crypto" && strength.length ? (r) => signClass(r.chg7d) : (r) => statusClass(r.sourceState || "live"),
        { filter: cfg.id === "crypto" ? "all" : "live" }));
  }

  // ---- trending (CoinGecko search trending) ----
  const trendingWrap = h("div", {});
  function paintTrending() {
    const tr = (ov && ov.trending) || {};
    if (binanceOnly() || !(tr.coins || []).length) { trendingWrap.replaceChildren(); return; }
    mount(trendingWrap,
      h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Trending"),
        h("span", { class: "sec-note" }, "CoinGecko search")),
      h("div", { class: "trend-strip" }, tr.coins.map((c) => {
        const img = tokenIcon(c.base, 22);
        return h("button", { class: "trend-chip", onClick: () => navigate("/symbol/" + c.base + "USDT") },
          img, h("b", {}, c.base), h("span", { class: "muted" }, c.name),
          c.rank ? h("span", { class: "num faint" }, "#" + c.rank) : null);
      })));
  }

  // ---- world markets (US/EU/Asia/India indices · commodities · FX · rates) ----
  // Primary path: real Yahoo Finance intraday data, one bounded server-side
  // call. Fallback path: official TradingView Market Overview widget with
  // visible attribution, so the page can still show real macro context when
  // the backend provider is rate-limited. No fabricated stock/index values.
  let worldGroup = "us";
  const worldTabs = h("div", { class: "wm-tabs", role: "tablist" });
  const worldStrip = h("div", { class: "wm-strip" });
  const worldNote = h("span", { class: "sec-note" });
  const worldWrap = h("section", { class: "wm", id: "sec-world" },
    h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "World markets"), worldNote),
    worldTabs, worldStrip);
  const wmCards = new Map();
  let tvWorldKey = "";

  function wmVal(it) {
    if (it.last == null || !isFinite(it.last)) return "—";
    if (it.group === "rates") return Number(it.last).toFixed(2) + "%";
    const digits = it.group === "fx" ? (it.last < 20 ? 4 : 2) : 2;
    return Number(it.last).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  function openWorldDetail(it) {
    openDetailSheet(it.name, "globe", () => [
      (it.spark || []).length > 2
        ? sheetChart(sparkArea(it.spark, 340, 120, (it.chg_pct || 0) >= 0 ? "var(--up)" : "var(--down)", { dots: true, endDot: true }), 120)
        : null,
      sheetRow("Last", wmVal(it), signClass(it.chg_pct)),
      sheetRow("Change today", it.chg_pct != null ? fmtPct(it.chg_pct) : "—", signClass(it.chg_pct)),
      sheetRow("Previous close", it.prev_close != null ? Number(it.prev_close).toLocaleString("en-US", { maximumFractionDigits: 4 }) : "—"),
      it.currency ? sheetRow("Currency", it.currency) : null,
      it.asof ? sheetRow("As of", new Date(it.asof * 1000).toUTCString().replace(" GMT", " UTC")) : null,
      sheetNote("Intraday session, 15-minute closes."),
      srcLine((ov.world || {}).status, "yahoo finance"),
    ].filter(Boolean));
  }
  function buildWmCard(it) {
    const pxEl = h("div", { class: "wm-px num" });
    const chg = h("div", { class: "wm-chg num" });
    const spark = h("div", { class: "wm-spark" });
    const name = h("div", { class: "wm-name" });
    if (it.group === "stocks") {   // real brand marks via Parqet's keyless CDN
      const img = document.createElement("img");
      img.className = "wm-logo"; img.width = 16; img.height = 16; img.alt = "";
      img.loading = "lazy"; img.referrerPolicy = "no-referrer";
      img.addEventListener("error", () => img.remove(), { once: true });
      img.src = `https://assets.parqet.com/logos/symbol/${encodeURIComponent(it.symbol)}?format=png&size=32`;
      name.appendChild(img);
    }
    name.appendChild(document.createTextNode(it.name));
    const el = h("button", { class: "wm-card", onClick: () => openWorldDetail(wmCards.get(it.symbol).it) },
      name, pxEl, chg, spark);
    return { el, px: pxEl, chg, spark, it };
  }
  function tradingViewWorldWidget(height = "520", extraClass = "") {
    const widgetBox = h("div", { class: "tradingview-widget-container tv-widget " + extraClass },
      h("div", { class: "tradingview-widget-container__widget tv-widget-static", style: { minHeight: height + "px" } },
        h("div", { class: "tv-world-k" }, "External market chart"),
        h("div", { class: "tv-world-title" }, "TradingView markets"),
        h("div", { class: "tv-world-sub" },
          "Open the official market overview for live global charts. The local page keeps provider-limited values separate from crypto context."),
        h("a", {
          class: "pill-btn",
          href: "https://www.tradingview.com/markets/",
          target: "_blank",
          rel: "noopener nofollow",
        }, icon("arrowUpRight"), "Open TradingView")),
      h("div", { class: "tradingview-widget-copyright" },
        h("a", {
          href: "https://www.tradingview.com/markets/?utm_source=cosmosgeek.local&utm_medium=widget&utm_campaign=market-overview",
          rel: "noopener nofollow",
          target: "_blank",
        }, h("span", { class: "blue-text" }, "World markets")),
        h("span", { class: "trademark" }, " by TradingView")));
    return widgetBox;
  }
  function mountTradingViewWorld(status) {
    const theme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const key = "tv:" + theme + ":" + (status || "connecting");
    if (tvWorldKey === key && worldStrip.querySelector(".tv-world-shell")) return;
    tvWorldKey = key;
    mount(worldStrip, h("div", { class: "tv-world-shell" },
      h("div", { class: "tv-world-copy" },
        h("div", { class: "tv-world-k" }, "Yahoo feed unavailable"),
        h("div", { class: "tv-world-title" }, "TradingView global market overview"),
        h("div", { class: "tv-world-sub" },
          "Yahoo Finance is returning ", status || "unavailable",
          ". This embedded widget keeps global indices, macro and stocks visible with TradingView attribution.")),
      tradingViewWorldWidget("520")));
  }
  function paintWorld() {
    if (binanceOnly()) { worldWrap.style.display = "none"; return; }
    worldWrap.style.display = "";
    const w = (ov && ov.world) || {};
    const groups = w.groups || [];
    if (!groups.length) {
      worldWrap.style.display = "none";
      worldNote.textContent = "Yahoo Finance · " + (w.status || "unavailable") + " · TradingView widget shown in market summary";
      worldTabs.replaceChildren();
      worldStrip.replaceChildren();
      wmCards.clear();
      return;
    }
    tvWorldKey = "";
    if (!groups.some((g) => g.id === worldGroup)) worldGroup = groups[0].id;
    worldNote.textContent = `Yahoo Finance · ${w.status} · real intraday data`;
    mount(worldTabs, groups.map((g) =>
      h("button", {
        class: "chip" + (g.id === worldGroup ? " active" : ""), role: "tab",
        "aria-selected": g.id === worldGroup ? "true" : "false",
        onClick: () => { worldGroup = g.id; wmCards.clear(); paintWorld(); },
      }, g.label, h("span", { class: "chip-n num" }, g.items.length))));
    const items = (groups.find((g) => g.id === worldGroup) || {}).items || [];
    if (!wmCards.size) {
      worldStrip.replaceChildren();
      for (const it of items) {
        const card = buildWmCard(it);
        wmCards.set(it.symbol, card);
        worldStrip.appendChild(card.el);
      }
    }
    for (const it of items) {
      const card = wmCards.get(it.symbol);
      if (!card) continue;
      card.it = it;
      card.px.textContent = wmVal(it);
      card.chg.textContent = it.chg_pct != null ? moveValue(it.chg_pct) : "—";
      card.chg.className = "wm-chg num " + signClass(it.chg_pct);
      const vals = it.spark || [];
      const sig = vals.length + ":" + vals[vals.length - 1];
      if (card._k !== sig && vals.length > 2) {
        card._k = sig;
        card.spark.innerHTML = sparkline(vals, 92, 28, (it.chg_pct || 0) >= 0 ? "var(--up)" : "var(--down)");
      }
    }
  }

  const binanceOnly = () => getSettings().source === "binance";
  const extSections = h("div", {});   // external sections live here (source-gated)

  const frontSectionPainters = [];
  const marketSequence = h("div", { class: "market-sequence", id: "sec-global", "aria-label": "Global market sections" });

  function frontConfigs() {
    return FRONT_PAGE_SECTION_IDS
      .map((id) => MARKET_ATLAS_BY_ID.get(id))
      .filter(Boolean);
  }
  function frontInterval(range) {
    if (range === "1D") return "5";
    if (range === "1M" || range === "3M") return "60";
    if (range === "60M") return "W";
    if (range === "ALL") return "M";
    return "D";
  }
  function frontChartTitle(symbol, item) {
    if (item && item.d) return item.d;
    return String(symbol || "Market").replace(/^[A-Z_]+:/, "");
  }
  function frontMarketChart(symbol, item, range, nonce = 0) {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    const params = new URLSearchParams({
      symbol,
      interval: frontInterval(range),
      theme: dark ? "dark" : "light",
      style: "3",
      locale: "en",
      hidesidetoolbar: "1",
      hide_top_toolbar: "1",
      symboledit: "0",
      saveimage: "0",
      withdateranges: "1",
      backgroundColor: dark ? "#050607" : "#ffffff",
      gridColor: dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.055)",
      studies: "[]",
      support_host: "https://www.tradingview.com",
      widget_reload: String(nonce),
    });
    return h("div", { class: "tradingview-widget-container seq-chart-widget" },
      h("iframe", {
        src: `https://s.tradingview.com/widgetembed/?${params.toString()}`,
        title: `${frontChartTitle(symbol, item)} chart`,
        loading: "lazy",
        allow: "fullscreen",
      }),
      h("div", { class: "tradingview-widget-copyright" },
        h("a", {
          href: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`,
          rel: "noopener nofollow",
          target: "_blank",
        }, h("span", { class: "blue-text" }, frontChartTitle(symbol, item))),
        h("span", { class: "trademark" }, " by TradingView")));
  }
  function frontSourceLabel(cfg, rows) {
    if (!ov) return "Data connecting";
    if (cfg.id === "crypto") {
      const tc = ov.top_coins || {};
      return `${tc.source || "CoinGecko"} · ${tc.status || "warming"} · ${rows.length} assets`;
    }
    if (cfg.id === "us-stocks") {
      const stq = ov.stocks || {};
      return `${stq.source || "CoinGecko"} · ${stq.status || "warming"} · source-owned stock rows`;
    }
    const priced = rows.filter((r) => r.price != null).length;
    return priced
      ? `${boardSourceFor(cfg)} · ${priced}/${rows.length} quotes`
      : `TradingView chart routes · ${rows.length} instruments · quotes limited`;
  }
  function frontStockRows(cfg) {
    const stq = (ov && ov.stocks) || {};
    const items = stq.items || [];
    if (!items.length) return [];
    const wanted = new Map(sectionUniverse(cfg).map((it) => [String(it.short || "").toUpperCase(), it]));
    const used = new Set();
    const sourceState = stq.status || "live";
    const build = (s, i, mapped) => {
      const base = String(s.base || "").toUpperCase();
      used.add(base);
      const tvSymbol = (mapped && mapped.s) || STOCK_TV_SYMBOLS[base] || null;
      return {
        section: cfg.id,
        kind: "stock",
        rank: i + 1,
        symbol: base,
        name: mapped ? mapped.d : s.name,
        sub: s.wrapper_symbol ? `${s.wrapper_symbol} · tokenized equity` : (s.wrapper || s.name || base),
        stock: s,
        item: mapped || (tvSymbol ? { s: tvSymbol, d: s.name, short: base, logo: base.toLowerCase(), yahoo: base } : null),
        price: s.price,
        priceText: s.price != null ? fmtPrice(s.price) : "—",
        chg1h: s.chg1h,
        chg24h: s.chg24h,
        chg7d: s.chg7d,
        mcap: s.mcap,
        volume: s.volume,
        spark: cleanSeries(s.spark || []),
        source: stq.source || "CoinGecko tokenized equities",
        sourceState,
        auditSource: "stocks-overview",
        tvSymbol,
        route: "/symbol/" + base,
      };
    };
    const matched = [];
    for (const s of items) {
      const base = String(s.base || "").toUpperCase();
      const mapped = wanted.get(base);
      if (mapped) matched.push(build(s, matched.length, mapped));
    }
    const extras = items
      .filter((s) => !used.has(String(s.base || "").toUpperCase()))
      .slice(0, Math.max(0, 18 - matched.length))
      .map((s, i) => build(s, matched.length + i, wanted.get(String(s.base || "").toUpperCase())));
    return [...matched, ...extras].slice(0, 18);
  }
  function frontWorldStockRows(cfg) {
    return sectionUniverse(cfg).slice(0, 14).map((item, i) => ({
      ...boardRowFromSymbol(item, i, cfg),
      price: null,
      priceText: "Chart",
      source: "TradingView chart route",
      sourceState: "chart_route",
    }));
  }
  function frontRowsFor(cfg) {
    if (!ov) return [];
    if (cfg.id === "crypto") return ((ov.top_coins || {}).coins || [])
      .filter((c) => c && c.base)
      .slice(0, 42)
      .map(boardRowFromCoin);
    if (cfg.id === "us-stocks") return frontStockRows(cfg);
    if (cfg.id === "world-stocks") return frontWorldStockRows(cfg);
    return sectionUniverse(cfg).slice(0, cfg.id === "futures" ? 18 : 14)
      .map((item, i) => {
        const row = boardRowFromSymbol(item, i, cfg);
        if (row.price != null) return row;
        return {
          ...row,
          priceText: "Chart",
          source: "TradingView chart route",
          sourceState: "chart_route",
        };
      });
  }
  function frontLogo(row, size = 32) {
    if (row.coin) return coinIcon(row.coin, size);
    if (row.stock) {
      const img = document.createElement("img");
      img.className = "seq-logo-img";
      img.width = size;
      img.height = size;
      img.alt = "";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      const base = encodeURIComponent(row.symbol);
      const sources = [
        `https://assets.parqet.com/logos/symbol/${base}?format=png&size=${Math.max(64, size * 2)}`,
        row.stock.image,
      ].filter(Boolean);
      let idx = 0;
      img.addEventListener("error", () => {
        idx += 1;
        if (idx < sources.length) img.src = sources[idx];
        else img.replaceWith(row.item ? atlasLogo(row.item, size) : tokenIcon(row.symbol, size));
      });
      img.src = sources[0];
      return img;
    }
    return row.item ? atlasLogo(row.item, size) : tokenIcon(row.symbol, size);
  }
  function frontActiveItem(cfg, rows, symbol) {
    const allItems = sectionUniverse(cfg);
    const direct = allItems.find((it) => it.s === symbol);
    if (direct) return direct;
    const row = rows.find((r) => r.tvSymbol === symbol || r.symbol === symbol);
    return row && row.item ? row.item : row ? { s: symbol, d: row.name, short: row.symbol } : null;
  }
  function frontChartSymbol(cfg, rows) {
    const cfgPrimary = cfg.primary;
    if (cfg.id === "us-stocks") {
      const priced = rows.find((r) => r.tvSymbol);
      return (priced && priced.tvSymbol) || cfgPrimary;
    }
    if (cfg.id === "crypto") {
      const btc = rows.find((r) => r.symbol === "BTC" && r.tvSymbol);
      return (btc && btc.tvSymbol) || cfgPrimary;
    }
    return cfgPrimary;
  }
  function frontMove(row) {
    if (row.chg24h != null && isFinite(Number(row.chg24h))) return moveValue(row.chg24h);
    return row.sourceState === "chart_route" ? "Chart" : "—";
  }
  function frontMetric(row) {
    if (row.mcap != null) return fmtMoney(row.mcap);
    if (row.volume != null) return fmtMoney(row.volume);
    if (row.sourceState === "chart_route") return "Chart route";
    return statusWord({ status: row.sourceState });
  }
  function frontEmptyChip(cfg, rows, sourceLabel, setActive) {
    const props = { class: "seq-empty-chip " + statusClass((rows[0] || {}).sourceState || worldState()) };
    if (cfg.id === "us-stocks") props["data-us-stocks-table-audit"] = "empty-compact";
    const routeRows = rows.slice(0, 10);
    return h("div", props,
      h("div", { class: "seq-empty-copy" },
        h("span", { class: "source-dot" }),
        h("b", {}, cfg.id === "us-stocks" ? "US stock source has no rows" : "Quote lane limited"),
        h("span", {}, cfg.id === "us-stocks"
          ? "The stocks endpoint returned no usable rows, so the page shows this compact state instead of an empty table."
          : "Live chart routes remain available; price rows return when the quote source responds."),
        h("em", {}, sourceLabel)),
      routeRows.length ? h("div", { class: "seq-chip-rail" }, routeRows.map((row) =>
        h("button", {
          class: "seq-route-chip",
          type: "button",
          onClick: () => {
            if (row.tvSymbol) setActive(row.tvSymbol);
            else if (row.route) navigate(row.route);
          },
        }, frontLogo(row, 20), h("span", {}, row.name)))) : null);
  }
  function frontRow(row, cfg, setActive) {
    const hasChart = !!row.tvSymbol;
    const props = {
      class: "seq-row " + signClass(row.chg24h),
      "data-symbol": row.symbol,
      "data-row-source": row.auditSource || row.source || "",
      onClick: () => {
        if (hasChart) setActive(row.tvSymbol);
        else if (row.route) navigate(row.route);
      },
    };
    return h("button", props,
      h("span", { class: "seq-rank num" }, row.rank || ""),
      h("span", { class: "seq-asset" }, frontLogo(row, 30),
        h("span", { class: "seq-asset-copy" },
          h("b", {}, row.name),
          h("small", { class: "num" }, row.sub || row.symbol))),
      h("span", { class: "seq-price num" }, row.priceText || "—"),
      h("span", { class: "seq-move num " + signClass(row.chg24h) }, frontMove(row)),
      h("span", { class: "seq-chart" }, boardChart(row, 112, 30)),
      h("span", { class: "seq-meta num" }, frontMetric(row)),
      h("span", { class: "seq-open" }, hasChart ? "Chart" : row.route ? "Open" : "Source"));
  }
  function frontRowsView(cfg, rows, sourceLabel, setActive) {
    const hasPricedRows = rows.some((r) => r.price != null);
    const canShowTable = cfg.id === "crypto" || cfg.id === "us-stocks" || hasPricedRows;
    if (!rows.length || !canShowTable) return frontEmptyChip(cfg, rows, sourceLabel, setActive);
    const sorted = [...rows].sort((a, b) =>
      Number(b.price != null) - Number(a.price != null) || (a.rank || 1e9) - (b.rank || 1e9));
    return h("div", {
      class: "seq-table",
      "data-section-table": cfg.id,
      "data-us-stocks-table-audit": cfg.id === "us-stocks" ? "stocks-overview" : null,
    },
      h("div", { class: "seq-table-head" },
        h("span", {}, "#"),
        h("span", {}, cfg.id === "crypto" ? "Asset" : "Instrument"),
        h("span", {}, "Price"),
        h("span", {}, cfg.id === "crypto" ? "24h" : "Session"),
        h("span", {}, "Chart"),
        h("span", {}, cfg.id === "crypto" ? "Market cap" : "Source"),
        h("span", {}, "")),
      sorted.slice(0, cfg.id === "crypto" ? 24 : 12).map((row) => frontRow(row, cfg, setActive)));
  }
  function frontRailRows(cfg, rows) {
    const staticItems = (cfg.symbols || []).map((item, i) => ({
      section: cfg.id,
      symbol: item.short || item.s,
      name: item.d,
      sub: item.short || item.s,
      item,
      tvSymbol: item.s,
      priceText: atlasLocalMeta(item)?.value || "Chart",
      chg24h: null,
      sourceState: "chart_route",
      rank: i + 1,
    }));
    const list = cfg.id === "crypto" || cfg.id === "us-stocks" ? rows : staticItems;
    const seen = new Set();
    return list.filter((row) => {
      const key = row.tvSymbol || row.symbol;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8);
  }
  function buildSequenceSection(cfg, index) {
    const rowsEl = h("div", { class: "seq-rows" });
    const railEl = h("div", { class: "seq-rail" });
    const chartEl = h("div", { class: "seq-chart-body" });
    const sourceEl = h("span", { class: "seq-source" }, "Data connecting");
    const chartName = h("span", { class: "seq-chart-name" }, cfg.title);
    const chartSym = h("b", { class: "seq-chart-symbol num" }, "");
    const rangeEl = h("div", { class: "seq-ranges", role: "tablist", "aria-label": cfg.title + " chart range" });
    const state = { symbol: cfg.primary, range: cfg.range || "12M", key: "", nonce: 0 };
    const setActive = (symbol) => {
      if (!symbol) return;
      state.symbol = symbol;
      state.nonce += 1;
      paint();
    };
    const setRange = (range) => {
      state.range = range;
      state.nonce += 1;
      paint();
    };
    const section = h("section", {
      class: "market-seq-section",
      id: "sec-" + cfg.id,
      "data-section": cfg.id,
    },
      h("div", { class: "seq-head" },
        h("div", {},
          h("div", { class: "seq-kicker" }, h("span", { class: "num" }, String(index + 1).padStart(2, "0")), cfg.label),
          h("h2", { class: "seq-title" }, cfg.title),
          h("p", { class: "seq-lead" }, cfg.lead)),
        sourceEl),
      h("div", { class: "seq-layout" },
        h("div", { class: "seq-chart-shell" },
          h("div", { class: "seq-chart-top" },
            h("span", { class: "seq-chart-label" }, chartSym, chartName),
            rangeEl),
          chartEl),
        h("div", { class: "seq-side" }, railEl, rowsEl)));
    function paint() {
      const rows = frontRowsFor(cfg);
      if (!state.symbol || !rows.some((r) => r.tvSymbol === state.symbol) && !(cfg.symbols || []).some((it) => it.s === state.symbol)) {
        state.symbol = frontChartSymbol(cfg, rows);
      }
      const activeItem = frontActiveItem(cfg, rows, state.symbol);
      const sourceLabel = frontSourceLabel(cfg, rows);
      sourceEl.textContent = sourceLabel;
      chartSym.textContent = activeItem ? (activeItem.short || activeItem.s || state.symbol) : state.symbol;
      chartName.textContent = activeItem ? activeItem.d : frontChartTitle(state.symbol, null);
      mount(rangeEl, ATLAS_RANGES.map(([range, label]) =>
        h("button", {
          class: "seq-range" + (state.range === range ? " active" : ""),
          role: "tab",
          "aria-selected": state.range === range ? "true" : "false",
          onClick: () => setRange(range),
        }, label)));
      mount(railEl, frontRailRows(cfg, rows).map((row) =>
        h("button", {
          class: "seq-rail-chip" + (row.tvSymbol === state.symbol ? " active" : ""),
          type: "button",
          onClick: () => row.tvSymbol ? setActive(row.tvSymbol) : row.route ? navigate(row.route) : null,
        }, frontLogo(row, 24), h("span", {}, row.symbol), h("small", { class: "num " + signClass(row.chg24h) },
          row.priceText && row.priceText !== "—" ? row.priceText : row.sourceState === "chart_route" ? "Chart" : "—"))));
      mount(rowsEl, frontRowsView(cfg, rows, sourceLabel, setActive));
      const theme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      const key = [theme, cfg.id, state.symbol, state.range, state.nonce].join(":");
      if (state.key !== key || !chartEl.querySelector(".seq-chart-widget")) {
        state.key = key;
        mount(chartEl, frontMarketChart(state.symbol, activeItem, state.range, state.nonce));
      }
    }
    frontSectionPainters.push(paint);
    return section;
  }
  function buildMarketSequence() {
    mount(marketSequence, frontConfigs().map((cfg, index) => buildSequenceSection(cfg, index)));
  }
  function paintMarketSequence() {
    if (!marketSequence.childElementCount) buildMarketSequence();
    frontSectionPainters.forEach((paint) => {
      try { paint(); } catch (e) { console.error("front section paint failed", e); }
    });
  }

  function buildExtSections() {
    cardsWrap.classList.toggle("binance-only", binanceOnly());
    if (binanceOnly()) {
      mount(extSections, h("div", { class: "ghost-tile", style: { margin: "18px 0" } },
        icon("database"),
        h("div", {},
          h("div", { class: "gt-title" }, "External market context hidden"),
          h("div", { class: "gt-sub" }, "Data source is set to “Binance public” only. Switch to “Combined” in the header source selector to see global market cap, top coins, news and more.")),
        h("span", { class: "gt-badge" }, "Binance only")));
      return;
    }
    mount(extSections,
      marketBoard,
      moversSection);
    paintPulse();
    paintSectorBoard();
    syncSectorVisibility();
  }

  const page_ = h("div", { class: "page" },
    h("div", { class: "container" },
      h("div", { class: "page-head" },
        h("div", {}, h("h1", { class: "page-title" }, "Markets, everywhere"), subLine), regimePill),
      h("div", { class: "market-overview-grid market-overview-grid-main" },
        h("div", { class: "market-main-stack" },
          marketSequence),
        // market wire lives ON the front page, top-right, always —
        // Tree delayed relay + FinancialJuice + Lookonchain + RSS, never drawer-only
        newsRail)));

  mount(root, tape.el, page_, wireScrim, wireDesk);
  tape.el.classList.add("market-tape-hidden");
  paintMarketSequence();
  paintPulse();
  // header nav deep links: /?sec=world|prices|news scrolls to the section
  const wantSec = new URLSearchParams(location.search).get("sec");
  if (wantSec) {
    setTimeout(() => {
      const target = document.getElementById("sec-" + wantSec);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }
  cleanups.push(onSettings((_, key) => {
    if (key === "source" || key === "*") { paintAll(); }
  }));
  // theme flips rebuild every embedded chart immediately (key includes theme).
  cleanups.push(onTheme(() => paintMarketSequence()));
  cleanups.push(onIconsReady(() => paintAll()));
  function paintStep(label, fn) {
    try {
      fn();
    } catch (e) {
      console.error("market paint failed:", label, e);
    }
  }
  function paintAll() {
    paintStep("front market sequence", paintMarketSequence);
    paintStep("head", paintHead);
    paintStep("pulse", paintPulse);
    paintStep("wire desk", paintWireDesk);
  }

  function paintHead() {
    if (!ov) return;
    mount(subLine, "Indices → US stocks → World stocks → Crypto → Futures & commodities. Source-owned rows, logos and theme-matched charts.");
    const regime = ov.regime || {};
    const label = regime.regime || "—";
    const displayLabel = label === "DATA STALE" ? "Exchange cache stale" : label.charAt(0) + label.slice(1).toLowerCase();
    const dot = label === "ORDERLY" ? "dot-live" : label === "DATA STALE" ? "dot-off" : "dot-stale";
    mount(regimePill, h("span", { class: "dot " + dot }), displayLabel);
  }

  // ---- loaders -------------------------------------------------------------
  // These hydrate the visible market structure even when the host browser marks
  // the tab hidden; server-side TTLs/backoff protect external providers.
  async function loadOverview() {
    try {
      const res = await api.marketOverview();
      if (!res || res.ok === false) return;
      overviewError = "";
      ov = res;
      paintAll();
    } catch (e) {
      overviewError = e && e.message ? e.message : String(e || "unknown error");
      console.warn("market overview load failed", overviewError);
      paintSectorBoard();
      paintTopMovers();
    }
  }
  async function loadSparks() {
    try {
      const res = await api.sparks();
      if (res && res.sparks) {
        sparks = res.sparks;
        paintMarketSequence();
      }
    } catch (e) {}
  }
  async function loadNews() {
    clearTimeout(newsRetryTimer);
    try {
      news = await api.newsContext(56);
      paintPulse();
      paintWireDesk();
      if (!((news && news.items) || []).length) {
        newsRetryTimer = setTimeout(loadNews, 4500);
      }
    } catch (e) {
      newsRetryTimer = setTimeout(loadNews, 6500);
    }
  }

  loadSparks().then(loadOverview);
  loadNews();
  const t1 = setInterval(loadOverview, 5000);    // server TTLs protect providers; live prices tick
  const t2 = setInterval(loadSparks, 12000);
  const t3 = setInterval(loadNews, 25000);       // squawk wire refreshes server-side at 60s
  const t4 = setInterval(() => {                 // "3m ago" stays honest between polls
    for (const ref of timeRefs) ref.el.textContent = timeAgo(ref.iso);
  }, 20000);
  cleanups.push(() => {
    clearInterval(t1);
    clearInterval(t2);
    clearInterval(t3);
    clearInterval(t4);
    clearTimeout(newsRetryTimer);
  });
  cleanups.push(onLive(() => {})); // tape handles itself; cards update via overview poll

  return () => cleanups.forEach((c) => c());
}
