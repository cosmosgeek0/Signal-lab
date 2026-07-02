// Command palette (Cmd/Ctrl-K): symbol search + quick navigation.

import { h, mount } from "../lib/dom.js";
import { icon, tokenIcon } from "../lib/icons.js";
import { api } from "../lib/api.js";
import { navigate, toggleTheme } from "../lib/store.js";
import { baseOf, fmtBps, signClass, signedBasis } from "../lib/format.js";

let open = false;

const NAV = [
  { id: "nav-market", name: "Go to Market", sub: "Overview · majors · movers", run: () => navigate("/"), ic: "globe" },
  { id: "nav-radar", name: "Go to Radar", sub: "Full market scanner", run: () => navigate("/radar"), ic: "radar" },
  { id: "nav-heat", name: "Go to Heatmap", sub: "Tiles · bubbles · strips", run: () => navigate("/heatmap"), ic: "grid" },
  { id: "nav-funding", name: "Go to Funding", sub: "Leaderboards & distribution", run: () => navigate("/funding"), ic: "zap" },
  { id: "nav-movers", name: "Go to Movers", sub: "Spot / basis / funding movement", run: () => navigate("/movers"), ic: "trendingUp" },
  { id: "nav-settings", name: "Open Settings", sub: "Theme · refresh · units", run: () => import("./settings.js").then((m) => m.openSettingsSheet()), ic: "sliders" },
  { id: "nav-health", name: "Open Data health", sub: "Sources · collector · cache", run: () => import("./drawer.js").then((m) => m.openDataSheet()), ic: "wifi" },
  { id: "nav-theme", name: "Toggle theme", sub: "Light / dark", run: () => toggleTheme(), ic: "moon" },
];

export function openCommand() {
  if (open) return;
  open = true;

  let items = [];      // flat selectable list
  let sel = 0;
  let seq = 0;

  const input = h("input", {
    class: "cmd-input", type: "text", placeholder: "Search symbols or jump to a page…",
    autocomplete: "off", spellcheck: "false",
  });
  const list = h("div", { class: "cmd-list" });
  const box = h("div", { class: "cmd", role: "dialog", "aria-modal": "true" },
    h("div", { class: "cmd-input-wrap" }, icon("search"), input),
    list,
    h("div", { class: "cmd-foot" },
      h("span", {}, kbd("↑↓"), "navigate"),
      h("span", {}, kbd("↵"), "open"),
      h("span", {}, kbd("esc"), "close")));
  const overlay = h("div", { class: "overlay", onMousedown: (e) => { if (e.target === overlay) close(); } }, box);

  function kbd(t) { return h("span", { class: "kbd" }, t); }

  function render() {
    mount(list);
    const q = input.value.trim();
    const navMatches = NAV.filter((n) => !q || n.name.toLowerCase().includes(q.toLowerCase()));
    const flat = [];
    if (navMatches.length) {
      list.appendChild(h("div", { class: "cmd-group" }, "Navigation"));
      navMatches.forEach((n) => {
        const i = flat.length;
        const el = h("div", { class: "cmd-item", onClick: () => activate(i) },
          icon(n.ic), h("div", {}, h("div", { class: "c-name" }, n.name), h("div", { class: "c-sub" }, n.sub)));
        list.appendChild(el); flat.push({ el, run: n.run });
      });
    }
    if (results.length) {
      list.appendChild(h("div", { class: "cmd-group" }, "Symbols"));
      results.forEach((r) => {
        const b = signedBasis(r);
        const i = flat.length;
        const el = h("div", { class: "cmd-item", onClick: () => activate(i) },
          tokenIcon(r.symbol, 22),
          h("div", {}, h("div", { class: "c-name" }, baseOf(r.symbol)), h("div", { class: "c-sub" }, r.symbol)),
          h("div", { class: "c-right num " + signClass(b) }, fmtBps(b, true) + " bps"));
        list.appendChild(el); flat.push({ el, run: () => navigate("/symbol/" + r.symbol) });
      });
    }
    if (!flat.length) list.appendChild(h("div", { class: "cmd-empty" }, q ? `No matches for “${q}”` : "Type to search"));
    items = flat;
    sel = Math.min(sel, Math.max(0, items.length - 1));
    paintSel();
  }

  function paintSel() {
    items.forEach((it, i) => it.el.classList.toggle("sel", i === sel));
    const cur = items[sel];
    if (cur) cur.el.scrollIntoView({ block: "nearest" });
  }
  function activate(i) { const it = items[i]; if (it) { close(); it.run(); } }

  let results = [];
  let debounce;
  function search() {
    clearTimeout(debounce);
    const q = input.value.trim();
    if (!q) { results = []; render(); return; }
    const my = ++seq;
    debounce = setTimeout(async () => {
      try {
        const r = await api.search(q, 14);
        if (my !== seq) return;
        results = (r && r.results) || [];
      } catch (e) { results = []; }
      render();
    }, 90);
  }

  input.addEventListener("input", search);
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); paintSel(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); paintSel(); }
    else if (e.key === "Enter") { e.preventDefault(); activate(sel); }
  });

  function close() {
    open = false;
    document.removeEventListener("keydown", onGlobalKey, true);
    overlay.remove();
  }
  function onGlobalKey() {}

  document.body.appendChild(overlay);
  input.focus();
  render();
}

// Global hotkey wiring (called once from main).
export function wireCommandHotkey() {
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && k === "k") { e.preventDefault(); openCommand(); }
    else if (k === "/" && !isTyping(e.target)) { e.preventDefault(); openCommand(); }
  });
}
function isTyping(el) {
  const t = (el && el.tagName) || "";
  return t === "INPUT" || t === "TEXTAREA" || (el && el.isContentEditable);
}
