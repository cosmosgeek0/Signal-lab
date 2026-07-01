from __future__ import annotations

import argparse
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import plotly.express as px
import streamlit as st
import streamlit.components.v1 as components

try:
    from streamlit_autorefresh import st_autorefresh
except ImportError:  # pragma: no cover - runtime fallback for partial installs
    st_autorefresh = None


SNAPSHOT_COLUMNS = [
    "ts_ms",
    "symbol",
    "spot_bid",
    "spot_ask",
    "fut_bid",
    "fut_ask",
    "mark_price",
    "funding_rate",
    "spot_to_perp_bps",
    "perp_to_spot_bps",
    "spot_age_sec",
    "fut_age_sec",
    "mark_age_sec",
]
STALE_AFTER_SEC = 15.0
TABLE_COLUMNS = [
    "symbol",
    "spot_bid",
    "spot_ask",
    "fut_bid",
    "fut_ask",
    "spot_to_perp_bps",
    "perp_to_spot_bps",
    "funding_rate",
    "age_seconds",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default="data/binance_signal_lab.sqlite")
    args, _ = parser.parse_known_args()
    return args


def empty_snapshots() -> pd.DataFrame:
    return pd.DataFrame(columns=SNAPSHOT_COLUMNS)


def utc_label(ts_ms: int | float | None) -> str:
    if not ts_ms:
        return "No snapshots yet"
    dt = datetime.fromtimestamp(float(ts_ms) / 1000, tz=timezone.utc)
    return dt.strftime("%Y-%m-%d %H:%M:%S UTC")


def seconds_since(ts_ms: int | float | None) -> float | None:
    if not ts_ms:
        return None
    return max(0.0, time.time() - (float(ts_ms) / 1000))


def fmt_seconds(value: float | None) -> str:
    if value is None:
        return "n/a"
    if value < 60:
        return f"{value:.1f}s"
    return f"{value / 60:.1f}m"


def fmt_bps(value: float | None) -> str:
    if value is None or pd.isna(value):
        return "n/a"
    return f"{value:.2f} bps"


def fmt_pct(value: float | None) -> str:
    if value is None or pd.isna(value):
        return "n/a"
    return f"{value * 100:.4f}%"


@st.cache_data(ttl=1, show_spinner=False)
def load_snapshots(db: str, minutes: int) -> tuple[pd.DataFrame, dict[str, Any]]:
    path = Path(db)
    meta: dict[str, Any] = {
        "db_exists": path.exists(),
        "table_exists": False,
        "latest_ts_ms": None,
        "symbol_count": 0,
        "error": "",
    }
    if not path.exists():
        return empty_snapshots(), meta

    cutoff = int((time.time() - minutes * 60) * 1000)
    try:
        with sqlite3.connect(path, timeout=2.0) as conn:
            table_row = conn.execute(
                """
                SELECT 1
                FROM sqlite_master
                WHERE type = 'table' AND name = 'basis_snapshots'
                """
            ).fetchone()
            meta["table_exists"] = table_row is not None
            if not meta["table_exists"]:
                return empty_snapshots(), meta

            latest_row = conn.execute("SELECT MAX(ts_ms) FROM basis_snapshots").fetchone()
            symbol_row = conn.execute("SELECT COUNT(DISTINCT symbol) FROM basis_snapshots").fetchone()
            meta["latest_ts_ms"] = latest_row[0] if latest_row and latest_row[0] else None
            meta["symbol_count"] = int(symbol_row[0] or 0) if symbol_row else 0

            df = pd.read_sql_query(
                """
                SELECT *
                FROM basis_snapshots
                WHERE ts_ms >= ?
                ORDER BY ts_ms DESC
                """,
                conn,
                params=(cutoff,),
            )
    except sqlite3.Error as exc:
        meta["error"] = str(exc)
        return empty_snapshots(), meta

    if df.empty:
        return empty_snapshots(), meta

    df["time"] = pd.to_datetime(df["ts_ms"], unit="ms", utc=True)
    df["spot_mid"] = (df["spot_bid"] + df["spot_ask"]) / 2
    df["futures_mid"] = (df["fut_bid"] + df["fut_ask"]) / 2
    df["age_seconds"] = df[["spot_age_sec", "fut_age_sec"]].max(axis=1)
    df["abs_opportunity_bps"] = df[["spot_to_perp_bps", "perp_to_spot_bps"]].abs().max(axis=1)
    return df, meta


def latest_per_symbol(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    return (
        df.sort_values(["symbol", "ts_ms"])
        .groupby("symbol", as_index=False)
        .tail(1)
        .sort_values("abs_opportunity_bps", ascending=False)
    )


def apply_dark_theme() -> None:
    st.markdown(
        """
        <style>
        :root {
          --bg: #081017;
          --panel: #101923;
          --panel-2: #0d151d;
          --line: rgba(148, 163, 184, 0.22);
          --text: #e5edf5;
          --muted: #8ea0b5;
          --good: #30d597;
          --warn: #f6b73c;
          --hot: #ff6b6b;
          --cyan: #55d6ff;
        }
        .stApp {
          background: linear-gradient(180deg, #081017 0%, #0b121a 45%, #080d12 100%);
          color: var(--text);
        }
        .block-container {
          max-width: 1440px;
          padding-top: 1.4rem;
          padding-bottom: 3rem;
        }
        [data-testid="stSidebar"] {
          background: #0a121a;
          border-right: 1px solid var(--line);
        }
        h1, h2, h3 {
          letter-spacing: 0;
        }
        h1 {
          color: #f7fbff;
          font-size: 2.15rem;
        }
        h2, h3 {
          color: #dce8f5;
        }
        [data-testid="stMetric"] {
          background: linear-gradient(180deg, rgba(16, 25, 35, 0.96), rgba(10, 18, 26, 0.96));
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 14px 14px 12px;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.22);
        }
        [data-testid="stMetricLabel"] {
          color: var(--muted);
        }
        [data-testid="stMetricValue"] {
          color: var(--text);
        }
        .radar-header {
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 18px 18px 15px;
          background: linear-gradient(135deg, rgba(16, 25, 35, 0.98), rgba(10, 18, 26, 0.95));
          margin-bottom: 16px;
        }
        .radar-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .radar-title h1 {
          margin: 0;
        }
        .radar-subtitle {
          margin-top: 6px;
          color: var(--muted);
          font-size: 0.94rem;
        }
        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 7px 11px;
          color: var(--text);
          background: rgba(255, 255, 255, 0.04);
          font-weight: 650;
        }
        .dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          display: inline-block;
        }
        .dot-live { background: var(--good); box-shadow: 0 0 18px rgba(48, 213, 151, 0.75); }
        .dot-warm { background: var(--warn); box-shadow: 0 0 18px rgba(246, 183, 60, 0.75); }
        .dot-stale { background: var(--hot); box-shadow: 0 0 18px rgba(255, 107, 107, 0.75); }
        .header-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 16px;
        }
        .header-item {
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 11px 12px;
          background: rgba(255, 255, 255, 0.035);
          min-width: 0;
        }
        .header-label {
          color: var(--muted);
          font-size: 0.76rem;
          text-transform: uppercase;
        }
        .header-value {
          color: var(--text);
          margin-top: 4px;
          font-weight: 650;
          overflow-wrap: anywhere;
        }
        .section-gap {
          margin-top: 20px;
        }
        div[data-testid="stDataFrame"] {
          border: 1px solid var(--line);
          border-radius: 8px;
          overflow: hidden;
        }
        .stAlert {
          border-radius: 8px;
        }
        @media (max-width: 760px) {
          .header-grid { grid-template-columns: 1fr; }
          h1 { font-size: 1.55rem; }
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def trigger_refresh(seconds: int) -> None:
    interval_ms = seconds * 1000
    if st_autorefresh is not None:
        st_autorefresh(interval=interval_ms, key="cosmosgeek_market_radar_refresh")
        return
    components.html(
        f"""
        <script>
        setTimeout(function() {{
          window.parent.location.reload();
        }}, {interval_ms});
        </script>
        """,
        height=0,
    )


def status_from_meta(meta: dict[str, Any]) -> tuple[str, str]:
    if meta["error"]:
        return "Database error", "stale"
    if not meta["db_exists"] or not meta["table_exists"] or not meta["latest_ts_ms"]:
        return "Warming up", "warm"
    age = seconds_since(meta["latest_ts_ms"])
    if age is not None and age <= 6:
        return "Live", "live"
    return "Stale", "stale"


def render_header(db: str, meta: dict[str, Any]) -> None:
    status, status_class = status_from_meta(meta)
    st.markdown(
        f"""
        <div class="radar-header">
          <div class="radar-title">
            <h1>CG Signal Lab</h1>
            <div class="status-pill"><span class="dot dot-{status_class}"></span>{status}</div>
          </div>
          <div class="radar-subtitle">Public Binance spot and USD-M perpetual market data. No API keys. No trading.</div>
          <div class="header-grid">
            <div class="header-item">
              <div class="header-label">Database</div>
              <div class="header-value">{db}</div>
            </div>
            <div class="header-item">
              <div class="header-label">Last Update</div>
              <div class="header-value">{utc_label(meta["latest_ts_ms"])}</div>
            </div>
            <div class="header-item">
              <div class="header-label">Symbols Tracked</div>
              <div class="header-value">{meta["symbol_count"]}</div>
            </div>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def style_basis_table(df: pd.DataFrame):
    def basis_style(value: Any) -> str:
        try:
            abs_value = abs(float(value))
        except (TypeError, ValueError):
            return ""
        if abs_value >= 100:
            return "background-color: rgba(255, 107, 107, 0.34); color: #ffffff; font-weight: 750;"
        if abs_value >= 50:
            return "background-color: rgba(246, 183, 60, 0.30); color: #fff5d6; font-weight: 700;"
        if abs_value >= 25:
            return "background-color: rgba(85, 214, 255, 0.20); color: #dff7ff; font-weight: 650;"
        return ""

    return (
        df.style.format(
            {
                "spot_bid": "{:.8g}",
                "spot_ask": "{:.8g}",
                "fut_bid": "{:.8g}",
                "fut_ask": "{:.8g}",
                "spot_to_perp_bps": "{:.2f}",
                "perp_to_spot_bps": "{:.2f}",
                "funding_rate": "{:.4%}",
                "age_seconds": "{:.2f}",
            }
        )
        .applymap(basis_style, subset=["spot_to_perp_bps", "perp_to_spot_bps"])
    )


def render_table(df: pd.DataFrame, height: int = 420) -> None:
    if df.empty:
        st.info("No rows in this section yet.")
        return
    st.dataframe(style_basis_table(df[TABLE_COLUMNS]), use_container_width=True, hide_index=True, height=height)


def render_metrics(latest: pd.DataFrame, meta: dict[str, Any]) -> None:
    if latest.empty:
        max_spot_perp = max_perp_spot = highest_funding = freshest_age = None
    else:
        max_spot_perp = latest["spot_to_perp_bps"].max()
        max_perp_spot = latest["perp_to_spot_bps"].max()
        highest_funding = latest["funding_rate"].max()
        freshest_age = latest["age_seconds"].min()

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Max spot->perp", fmt_bps(max_spot_perp))
    c2.metric("Max perp->spot", fmt_bps(max_perp_spot))
    c3.metric("Highest funding", fmt_pct(highest_funding))
    c4.metric("Freshest update age", fmt_seconds(freshest_age or seconds_since(meta["latest_ts_ms"])))


def polish_fig(fig, height: int = 320):
    fig.update_layout(
        template="plotly_dark",
        height=height,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin=dict(l=12, r=12, t=42, b=12),
        legend_title_text="",
        font=dict(color="#dce8f5"),
    )
    fig.update_xaxes(gridcolor="rgba(148,163,184,0.16)", zerolinecolor="rgba(148,163,184,0.22)")
    fig.update_yaxes(gridcolor="rgba(148,163,184,0.16)", zerolinecolor="rgba(148,163,184,0.22)")
    return fig


def render_symbol_detail(df: pd.DataFrame, latest: pd.DataFrame) -> None:
    st.subheader("Symbol Detail")
    if latest.empty:
        st.info("Symbol detail will appear after snapshots arrive.")
        return

    symbols = latest.sort_values("abs_opportunity_bps", ascending=False)["symbol"].tolist()
    selected = st.selectbox("Symbol", symbols)
    history = df[df["symbol"] == selected].sort_values("time")
    if history.empty:
        st.info("No history for the selected symbol in this window.")
        return

    basis_long = history[["time", "spot_to_perp_bps", "perp_to_spot_bps"]].melt(
        id_vars="time",
        var_name="basis",
        value_name="bps",
    )
    basis_fig = px.line(basis_long, x="time", y="bps", color="basis", title=f"{selected} basis over time")
    st.plotly_chart(polish_fig(basis_fig), use_container_width=True)

    price_long = history[["time", "spot_mid", "futures_mid"]].melt(
        id_vars="time",
        var_name="market",
        value_name="mid_price",
    )
    price_fig = px.line(price_long, x="time", y="mid_price", color="market", title=f"{selected} spot vs futures mid price")
    st.plotly_chart(polish_fig(price_fig), use_container_width=True)

    funding_fig = px.line(
        history.assign(funding_pct=history["funding_rate"] * 100),
        x="time",
        y="funding_pct",
        title=f"{selected} funding over time",
    )
    st.plotly_chart(polish_fig(funding_fig, height=260), use_container_width=True)


def render_data_quality(df: pd.DataFrame, latest: pd.DataFrame, meta: dict[str, Any]) -> None:
    st.subheader("Data Quality")
    if df.empty or latest.empty:
        stale_count = missing_spot_count = missing_futures_count = absent_latest_count = 0
    else:
        now_age = latest["ts_ms"].apply(seconds_since)
        latest = latest.assign(total_age_seconds=pd.concat([latest["age_seconds"], now_age], axis=1).max(axis=1))
        stale_count = int((latest["total_age_seconds"] > STALE_AFTER_SEC).sum())
        missing_spot_count = int(((latest["spot_bid"] <= 0) | (latest["spot_ask"] <= 0)).sum())
        missing_futures_count = int(((latest["fut_bid"] <= 0) | (latest["fut_ask"] <= 0)).sum())
        latest_snapshot_symbols = set(df[df["ts_ms"] == meta["latest_ts_ms"]]["symbol"].unique())
        absent_latest_count = len(set(df["symbol"].unique()) - latest_snapshot_symbols)

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Stale symbols", stale_count)
    c2.metric("Missing spot", missing_spot_count)
    c3.metric("Missing futures", missing_futures_count)
    c4.metric("Absent latest snapshot", absent_latest_count)


def main() -> None:
    args = parse_args()
    st.set_page_config(page_title="CG Signal Lab", layout="wide")
    apply_dark_theme()

    with st.sidebar:
        st.header("Radar Controls")
        minutes = st.slider("History window minutes", 1, 240, 60)
        top_n = st.slider("Top rows", 5, 100, 25)
        min_abs_bps = st.slider("Minimum absolute basis bps", 0.0, 500.0, 0.0, step=1.0)
        refresh_seconds = st.select_slider("Auto refresh seconds", options=[1, 2, 5, 10], value=2)
        auto_refresh = st.toggle("Auto refresh", value=True)
        if st.button("Refresh now", use_container_width=True):
            st.cache_data.clear()

    if auto_refresh:
        trigger_refresh(refresh_seconds)

    df, meta = load_snapshots(args.db, minutes)
    render_header(args.db, meta)

    if meta["error"]:
        st.error(f"Could not read SQLite database: {meta['error']}")
        st.stop()
    if not meta["db_exists"]:
        st.warning("Database not found yet. Start the collector and this dashboard will fill in automatically.")
        st.stop()
    if not meta["table_exists"]:
        st.warning("Database exists, but the collector has not created basis_snapshots yet.")
        st.stop()
    if df.empty:
        st.warning("No snapshots in the selected window yet. The collector may still be warming up.")
        st.stop()

    latest = latest_per_symbol(df)
    if min_abs_bps:
        latest = latest[latest["abs_opportunity_bps"] >= min_abs_bps]

    render_metrics(latest, meta)

    st.markdown('<div class="section-gap"></div>', unsafe_allow_html=True)
    st.subheader("Live Basis Radar")
    radar = latest.sort_values("abs_opportunity_bps", ascending=False).head(top_n)
    render_table(radar)

    left, right = st.columns(2)
    with left:
        st.subheader("Spot->Perp Opportunities")
        spot_perp = latest[(latest["spot_ask"] < latest["fut_bid"]) & (latest["spot_to_perp_bps"] > 0)]
        render_table(spot_perp.sort_values("spot_to_perp_bps", ascending=False).head(top_n), height=330)
    with right:
        st.subheader("Perp->Spot Opportunities")
        perp_spot = latest[(latest["fut_ask"] < latest["spot_bid"]) & (latest["perp_to_spot_bps"] > 0)]
        render_table(perp_spot.sort_values("perp_to_spot_bps", ascending=False).head(top_n), height=330)

    st.subheader("Funding Heat")
    funding_left, funding_right = st.columns(2)
    with funding_left:
        st.caption("Highest positive funding")
        render_table(latest.sort_values("funding_rate", ascending=False).head(top_n), height=300)
    with funding_right:
        st.caption("Lowest negative funding")
        render_table(latest.sort_values("funding_rate", ascending=True).head(top_n), height=300)

    render_symbol_detail(df, latest)
    render_data_quality(df, latest, meta)


if __name__ == "__main__":
    main()
