from __future__ import annotations

SPOT_REST_BASE = "https://api.binance.com"
FUTURES_REST_BASE = "https://fapi.binance.com"

SPOT_WS_BASE = "wss://stream.binance.com:9443/stream?streams="
FUTURES_PUBLIC_WS = "wss://fstream.binance.com/public/ws/!bookTicker"
FUTURES_MARKET_WS = "wss://fstream.binance.com/market/ws/!markPrice@arr@1s"

DEFAULT_QUOTE = "USDT"
SPOT_STREAM_CHUNK_SIZE = 200
SNAPSHOT_INTERVAL_SEC = 1.0
RECONNECT_BACKOFF_SEC = 5.0
STALE_AFTER_SEC = 15.0
