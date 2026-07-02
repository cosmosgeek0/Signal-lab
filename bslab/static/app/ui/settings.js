// Settings sheet: theme, currency, data source, refresh rate, basis units,
// motion level, default page, language, reset. All persisted in localStorage.

import { h, mount } from "../lib/dom.js";
import { icon } from "../lib/icons.js";
import { getTheme, setTheme } from "../lib/store.js";
import { getSettings, setSetting, resetSettings, DEFAULTS } from "../lib/settings.js";

export function openSettingsSheet() {
  if (document.querySelector(".sheet")) return;
  const scrim = h("div", { class: "sheet-scrim", onClick: close });
  const body = h("div", { class: "sheet-body" });
  const sheet = h("div", { class: "sheet", role: "dialog", "aria-label": "Settings" },
    h("div", { class: "sheet-head" },
      icon("sliders"), h("h2", {}, "Settings"),
      h("button", { class: "icon-btn", style: { marginLeft: "auto" }, onClick: close, title: "Close" }, icon("x"))),
    body);

  function paint() {
    const s = getSettings();
    mount(body,
      group("Appearance",
        seg("Theme", [["light", "Light"], ["dark", "Dark"]], getTheme(), (v) => { setTheme(v); paint(); }),
        seg("Motion", [["full", "Full"], ["reduced", "Reduced"]], s.motion, (v) => { setSetting("motion", v); paint(); }),
        seg("Tape speed", [["calm", "Calm"], ["normal", "Normal"], ["fast", "Fast"]], s.tapeSpeed, (v) => { setSetting("tapeSpeed", v); paint(); })),
      group("Data",
        seg("Refresh", [[1.6, "1.6s"], [3, "3s"], [5, "5s"]], s.refreshSec, (v) => { setSetting("refreshSec", Number(v)); paint(); }),
        seg("Basis units", [["bps", "bps"], ["pct", "%"]], s.basisUnit, (v) => { setSetting("basisUnit", v); paint(); }),
        rowNote("Data source", "Binance public — manage from the header selector"),
        rowNote("Currency", s.currency + " — others need an FX source (header selector)")),
      group("Navigation",
        seg("Default page", [["market", "Market"], ["radar", "Radar"]], s.defaultPage, (v) => { setSetting("defaultPage", v); paint(); })),
      group("Language",
        seg("Language", [["en", "English"], ["hi", "हिन्दी"], ["ja", "日本語"]], s.lang, (v) => {
          if (v !== "en") return; // honest: translations not implemented yet
          setSetting("lang", v); paint();
        }, { disabled: ["hi", "ja"], note: "Hindi and Japanese are coming later" })),
      group("Table",
        rowNote("Advanced columns", "Toggle bid/ask columns from the Radar “Columns” control")),
      h("div", { style: { padding: "16px 19px" } },
        h("button", { class: "mini-btn", onClick: () => { resetSettings(); setTheme("light"); paint(); } },
          icon("refresh"), "Reset all preferences")));
  }

  function group(title, ...kids) {
    return h("div", {}, h("div", { class: "menu-title", style: { padding: "16px 19px 6px" } }, title), ...kids);
  }
  function seg(label, options, current, onPick, opts = {}) {
    const disabledSet = new Set(opts.disabled || []);
    const segEl = h("div", { class: "seg", style: { marginLeft: "auto" } },
      options.map(([v, lab]) => h("button", {
        class: String(v) === String(current) ? "on" : "",
        style: disabledSet.has(v) ? { opacity: ".45", cursor: "default" } : null,
        title: disabledSet.has(v) ? (opts.note || "Coming soon") : "",
        onClick: () => { if (!disabledSet.has(v)) onPick(v); },
      }, lab)));
    return h("div", { class: "toggle-row" }, h("span", { class: "k" }, label), segEl);
  }
  function rowNote(k, v) {
    return h("div", { class: "drow" }, h("span", { class: "k" }, k), h("span", { class: "v", style: { fontWeight: "500", color: "var(--muted)" } }, v));
  }

  paint();
  function close() {
    scrim.remove(); sheet.remove();
    document.removeEventListener("keydown", onKey, true);
  }
  function onKey(e) { if (e.key === "Escape") close(); }
  document.addEventListener("keydown", onKey, true);
  document.body.appendChild(scrim);
  document.body.appendChild(sheet);
}
