// Hand-built SVG financial chart. No external library.
// Area + line with a Coinbase-style dotted fade fill, right value axis, time
// axis, crosshair tooltip, and an optional draw-in animation.
// Also exports sparkline() for tables and stat tiles.

const NS = "http://www.w3.org/2000/svg";

function niceTicks(min, max, count) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const start = Math.ceil(min / step) * step;
  const ticks = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(v);
  return ticks;
}

// Crisp straight segments, exchange-style (no heavy smoothing).
const linePath = (pts) =>
  pts.map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");

let chartSeq = 0;

export function renderChart(host, series, opts = {}) {
  const width = Math.max(320, host.clientWidth || 960);
  const height = opts.height || 400;
  const padR = 66, padL = 10, padT = 18, padB = 30;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  host.innerHTML = "";
  if (!series || series.length < 2) {
    const empty = document.createElement("div");
    empty.className = "chart-empty";
    empty.style.height = height + "px";
    empty.textContent = "No history in this window yet.";
    host.appendChild(empty);
    return;
  }

  const values = series.map((d) => d.v);
  let vmin = Math.min(...values), vmax = Math.max(...values);
  if (opts.zeroLine) { vmin = Math.min(vmin, 0); vmax = Math.max(vmax, 0); }
  const padV = (vmax - vmin || Math.abs(vmax) || 1) * 0.12;
  vmin -= padV; vmax += padV;

  const t0 = series[0].t, t1 = series[series.length - 1].t;
  const tSpan = t1 - t0 || 1;
  const x = (t) => padL + ((t - t0) / tSpan) * plotW;
  const y = (v) => padT + (1 - (v - vmin) / (vmax - vmin || 1)) * plotH;

  const pts = series.map((d) => ({ x: x(d.t), y: y(d.v), d }));
  const color = opts.color || "var(--up)";
  const gid = "cg" + chartSeq++;

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "chart-svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", height);

  // defs: soft gradient underlay + dotted texture + fade mask (Coinbase look)
  svg.innerHTML = `<defs>
    <linearGradient id="${gid}g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity="0.10"/>
      <stop offset="1" stop-color="${color}" stop-opacity="0"/>
    </linearGradient>
    <pattern id="${gid}d" width="7" height="7" patternUnits="userSpaceOnUse">
      <circle cx="1.7" cy="1.7" r="1.15" fill="${color}"/>
    </pattern>
    <linearGradient id="${gid}fm" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.5"/>
      <stop offset="0.85" stop-color="#fff" stop-opacity="0.06"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <mask id="${gid}m"><rect x="0" y="0" width="${width}" height="${height}" fill="url(#${gid}fm)"/></mask>
  </defs>`;

  // gridlines + right value labels
  const ticks = niceTicks(vmin + padV * 0.5, vmax - padV * 0.5, 4);
  const gg = document.createElementNS(NS, "g");
  for (const tv of ticks) {
    const yy = y(tv);
    if (yy < padT - 1 || yy > padT + plotH + 1) continue;
    const ln = document.createElementNS(NS, "line");
    ln.setAttribute("x1", padL); ln.setAttribute("x2", padL + plotW);
    ln.setAttribute("y1", yy.toFixed(1)); ln.setAttribute("y2", yy.toFixed(1));
    ln.setAttribute("stroke", opts.zeroLine && Math.abs(tv) < 1e-9 ? "var(--line-strong)" : "var(--line)");
    ln.setAttribute("stroke-width", "1");
    gg.appendChild(ln);
    const tx = document.createElementNS(NS, "text");
    tx.setAttribute("x", padL + plotW + 10);
    tx.setAttribute("y", (yy + 3.5).toFixed(1));
    tx.setAttribute("fill", "var(--muted)");
    tx.setAttribute("font-size", "11");
    tx.setAttribute("font-family", "var(--font)");
    tx.textContent = (opts.axisFmt || opts.valueFmt || String)(tv);
    gg.appendChild(tx);
  }
  svg.appendChild(gg);

  // time axis labels
  const nT = Math.min(6, series.length);
  const tg = document.createElementNS(NS, "g");
  for (let i = 0; i < nT; i++) {
    const idx = Math.round((i / (nT - 1 || 1)) * (series.length - 1));
    const d = series[idx];
    const tx = document.createElementNS(NS, "text");
    tx.setAttribute("x", x(d.t).toFixed(1));
    tx.setAttribute("y", height - 8);
    tx.setAttribute("fill", "var(--faint)");
    tx.setAttribute("font-size", "11");
    tx.setAttribute("text-anchor", i === 0 ? "start" : i === nT - 1 ? "end" : "middle");
    tx.setAttribute("font-family", "var(--font)");
    tx.textContent = (opts.timeFmt || String)(d.t);
    tg.appendChild(tx);
  }
  svg.appendChild(tg);

  // areas: gradient underlay + dotted texture with fade mask
  const baseY = padT + plotH;
  const areaD = `${linePath(pts)} L${pts[pts.length - 1].x.toFixed(1)} ${baseY} L${pts[0].x.toFixed(1)} ${baseY} Z`;
  const areaGrad = document.createElementNS(NS, "path");
  areaGrad.setAttribute("d", areaD);
  areaGrad.setAttribute("fill", `url(#${gid}g)`);
  svg.appendChild(areaGrad);
  if (opts.dotted !== false) {
    const areaDots = document.createElementNS(NS, "path");
    areaDots.setAttribute("d", areaD);
    areaDots.setAttribute("fill", `url(#${gid}d)`);
    areaDots.setAttribute("mask", `url(#${gid}m)`);
    if (opts.animate) areaDots.setAttribute("class", "chart-anim-area");
    svg.appendChild(areaDots);
  }

  // line
  const line = document.createElementNS(NS, "path");
  line.setAttribute("d", linePath(pts));
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", color);
  line.setAttribute("stroke-width", "2");
  line.setAttribute("stroke-linejoin", "round");
  line.setAttribute("stroke-linecap", "round");
  svg.appendChild(line);

  // live end-dot
  const endDot = document.createElementNS(NS, "circle");
  endDot.setAttribute("cx", pts[pts.length - 1].x);
  endDot.setAttribute("cy", pts[pts.length - 1].y);
  endDot.setAttribute("r", "4");
  endDot.setAttribute("fill", color);
  endDot.setAttribute("stroke", "var(--bg)");
  endDot.setAttribute("stroke-width", "2");
  svg.appendChild(endDot);

  // crosshair (hidden until hover)
  const cross = document.createElementNS(NS, "g");
  cross.style.opacity = "0";
  const vline = document.createElementNS(NS, "line");
  vline.setAttribute("y1", padT); vline.setAttribute("y2", padT + plotH);
  vline.setAttribute("stroke", "var(--line-strong)");
  vline.setAttribute("stroke-width", "1");
  vline.setAttribute("stroke-dasharray", "3 3");
  const dot = document.createElementNS(NS, "circle");
  dot.setAttribute("r", "4.5");
  dot.setAttribute("fill", color);
  dot.setAttribute("stroke", "var(--bg)");
  dot.setAttribute("stroke-width", "2");
  cross.appendChild(vline); cross.appendChild(dot);
  svg.appendChild(cross);

  const hit = document.createElementNS(NS, "rect");
  hit.setAttribute("x", padL); hit.setAttribute("y", padT);
  hit.setAttribute("width", plotW); hit.setAttribute("height", plotH);
  hit.setAttribute("fill", "transparent");
  svg.appendChild(hit);

  host.appendChild(svg);

  // draw-in animation (only when explicitly requested; not on silent refresh)
  if (opts.animate) {
    try {
      const L = line.getTotalLength();
      line.style.strokeDasharray = String(L);
      line.style.strokeDashoffset = String(L);
      endDot.style.opacity = "0";
      line.getBoundingClientRect(); // flush
      line.style.transition = "stroke-dashoffset .85s cubic-bezier(.3,.6,.2,1)";
      endDot.style.transition = "opacity .3s ease .7s";
      requestAnimationFrame(() => { line.style.strokeDashoffset = "0"; endDot.style.opacity = "1"; });
    } catch (e) { /* non-fatal */ }
  }

  const tip = document.createElement("div");
  tip.className = "chart-tip";
  host.appendChild(tip);

  function move(ev) {
    const rect = svg.getBoundingClientRect();
    const sx = rect.width / width;
    const px = (ev.clientX - rect.left) / sx;
    const tx = t0 + ((px - padL) / plotW) * tSpan;
    let best = 0, bestd = Infinity;
    for (let i = 0; i < series.length; i++) {
      const dd = Math.abs(series[i].t - tx);
      if (dd < bestd) { bestd = dd; best = i; }
    }
    const p = pts[best], d = series[best];
    cross.style.opacity = "1";
    vline.setAttribute("x1", p.x); vline.setAttribute("x2", p.x);
    dot.setAttribute("cx", p.x); dot.setAttribute("cy", p.y);
    tip.style.opacity = "1";
    tip.style.left = (p.x * sx) + "px";
    tip.style.top = p.y + "px";
    tip.innerHTML =
      `<div class="t-val">${(opts.valueFmt || String)(d.v)}</div>` +
      `<div class="t-time">${(opts.tipTimeFmt || opts.timeFmt || String)(d.t)}</div>`;
  }
  function leave() { cross.style.opacity = "0"; tip.style.opacity = "0"; }
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerleave", leave);
}

// Mini area chart (market cards). Fills its container. `opts.dots` swaps the
// gradient for a Coinbase-style dotted texture under the line; `opts.endDot`
// caps the series with a marker on the last point.
let miniSeq = 0;
export function sparkArea(values, w = 150, h = 48, color, opts = {}) {
  const vals = (values || []).map(Number).filter(isFinite);
  const open = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:100%;display:block">`;
  if (vals.length < 2) return open + "</svg>";
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const stepX = w / (vals.length - 1);
  const pad = 3;
  const y = (v) => pad + (1 - (v - min) / span) * (h - pad * 2);
  const line = vals.map((v, i) => (i ? "L" : "M") + (i * stepX).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
  const stroke = color || (vals[vals.length - 1] >= vals[0] ? "var(--up)" : "var(--down)");
  const gid = "ma" + miniSeq++;
  const defs = opts.dots
    ? `<defs><pattern id="${gid}" width="5.5" height="5.5" patternUnits="userSpaceOnUse">
        <circle cx="1.4" cy="1.4" r="1" fill="${stroke}" opacity=".30"/>
      </pattern></defs>`
    : `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${stroke}" stop-opacity="0.20"/>
      <stop offset="1" stop-color="${stroke}" stop-opacity="0"/>
    </linearGradient></defs>`;
  const endDot = opts.endDot
    ? `<circle cx="${((vals.length - 1) * stepX).toFixed(1)}" cy="${y(vals[vals.length - 1]).toFixed(1)}" r="2.4" fill="${stroke}"/>`
    : "";
  return `${open}${defs}
    <path d="${line} L${w} ${h} L0 ${h} Z" fill="url(#${gid})"/>
    <path d="${line}" fill="none" stroke="${stroke}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>${endDot}</svg>`;
}

// Compact sparkline. Fills its container (wrap in a sized element).
export function sparkline(values, w = 96, h = 30, color) {
  const vals = (values || []).map(Number).filter(isFinite);
  const open = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:100%;display:block">`;
  if (vals.length < 2) return open + "</svg>";
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const stepX = w / (vals.length - 1);
  const pad = 2;
  const y = (v) => pad + (1 - (v - min) / span) * (h - pad * 2);
  const d = vals.map((v, i) => (i ? "L" : "M") + (i * stepX).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
  const stroke = color || (vals[vals.length - 1] >= vals[0] ? "var(--up)" : "var(--down)");
  return `${open}<path d="${d}" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
}
