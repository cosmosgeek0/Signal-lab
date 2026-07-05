// Compact preferences sheet: only controls that are wired into the app.

import { h, mount } from "../lib/dom.js";
import { icon } from "../lib/icons.js";
import { getTheme, setTheme } from "../lib/store.js";
import { getSettings, setSetting, DEFAULTS } from "../lib/settings.js";

const THEME_OPTIONS = [
  ["system", "System", "sun"],
  ["light", "Light", "sun"],
  ["dark", "Dark", "moon"],
];

const DENSITY_OPTIONS = [
  ["comfortable", "Comfortable", "columns"],
  ["compact", "Compact", "columns"],
];

const CURRENCY_OPTIONS = [
  ["USD", "USD"],
  ["INR", "INR"],
  ["EUR", "EUR"],
  ["GBP", "GBP"],
  ["JPY", "JPY"],
];

const BASIS_OPTIONS = [
  ["bps", "bps"],
  ["pct", "%"],
];

const DEFAULT_PAGE_OPTIONS = [
  ["market", "Global"],
  ["radar", "Basis radar"],
];

export function openSettingsSheet() {
  if (document.querySelector(".settings-sheet")) return;

  const scrim = h("div", { class: "sheet-scrim settings-scrim", onClick: close });
  const body = h("div", { class: "sheet-body settings-sheet-body" });
  const closeBtn = h("button", {
    class: "icon-btn settings-close",
    type: "button",
    onClick: close,
    title: "Close",
    "aria-label": "Close preferences",
  }, icon("x"));

  const sheet = h("div", {
    class: "sheet settings-sheet",
    role: "dialog",
    "aria-label": "Preferences",
  },
    h("div", { class: "sheet-head settings-compact-head" },
      h("span", { class: "settings-head-icon" }, icon("sliders")),
      h("h2", {}, "Preferences"),
      closeBtn),
    body);

  function paint() {
    const s = getSettings();
    const density = s.density === "compact" ? "compact" : "comfortable";
    sheet.dataset.density = density;
    sheet.dataset.themeChoice = s.themeMode || DEFAULTS.themeMode;
    sheet.dataset.motionChoice = s.motion === "reduced" ? "reduced" : "full";
    mount(body,
      h("div", { class: "settings-compact-panel" },
        choiceRow("Theme", "themeMode", THEME_OPTIONS, s.themeMode || DEFAULTS.themeMode, (mode) => {
          setSetting("themeMode", mode);
          setTheme(resolveThemeMode(mode));
          paint();
        }),
        choiceRow("Density", "density", DENSITY_OPTIONS, density, (value) => {
          setSetting("density", value);
          paint();
        }),
        selectRow("Currency", "currency", CURRENCY_OPTIONS, s.currency || DEFAULTS.currency, (value) => {
          setSetting("currency", value);
          paint();
        }),
        choiceRow("Basis units", "basisUnit", BASIS_OPTIONS, s.basisUnit || DEFAULTS.basisUnit, (value) => {
          setSetting("basisUnit", value);
          rerenderCurrentView();
          paint();
        }),
        switchRow("Motion", s.motion !== "reduced", (on) => {
          setSetting("motion", on ? "full" : "reduced");
          paint();
        }),
        selectRow("Default page", "defaultPage", DEFAULT_PAGE_OPTIONS, s.defaultPage || DEFAULTS.defaultPage, (value) => {
          setSetting("defaultPage", value);
          paint();
        })));
  }

  function rowShell(label, control) {
    return h("div", { class: "pref-row" },
      h("div", { class: "pref-label" },
        h("b", {}, label)),
      control);
  }

  function choiceRow(label, key, options, current, onPick) {
    return rowShell(label,
      h("div", { class: "pref-seg", role: "group", "aria-label": label },
        options.map(([value, text, ic]) => {
          const on = String(value) === String(current);
          return h("button", {
            class: on ? "on" : "",
            type: "button",
            "data-setting": key,
            "data-value": String(value),
            "aria-pressed": on ? "true" : "false",
            onClick: () => onPick(value),
          },
            ic ? icon(ic) : null,
            h("span", {}, text));
        })));
  }

  function selectRow(label, key, options, current, onPick) {
    return rowShell(label,
      h("label", { class: "pref-select-wrap" },
        h("select", {
          "data-setting": key,
          value: String(current),
          onChange: (e) => onPick(e.currentTarget.value),
          "aria-label": label,
        },
          options.map(([value, text]) => h("option", { value: String(value) }, text))),
        icon("chevronDown")));
  }

  function switchRow(label, checked, onPick) {
    return rowShell(label,
      h("button", {
        class: "pref-switch " + (checked ? "on" : ""),
        type: "button",
        "data-setting": "motion",
        "aria-pressed": checked ? "true" : "false",
        onClick: () => onPick(!checked),
      },
        h("span", {}, checked ? "Full" : "Reduced"),
        h("i", { "aria-hidden": "true" })));
  }

  function close() {
    scrim.remove();
    sheet.remove();
    document.removeEventListener("keydown", onKey, true);
    if (systemTheme && systemTheme.removeEventListener) {
      systemTheme.removeEventListener("change", onSystemTheme);
    }
  }

  function onKey(e) {
    if (e.key === "Escape") close();
  }

  function onSystemTheme() {
    if ((getSettings().themeMode || DEFAULTS.themeMode) === "system") {
      setTheme(resolveThemeMode("system"));
      paint();
    }
  }

  const systemTheme = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  if (systemTheme && systemTheme.addEventListener) {
    systemTheme.addEventListener("change", onSystemTheme);
  }
  document.addEventListener("keydown", onKey, true);
  document.body.appendChild(scrim);
  document.body.appendChild(sheet);
  paint();
  closeBtn.focus({ preventScroll: true });
}

function resolveThemeMode(mode) {
  if (mode === "light" || mode === "dark") return mode;
  if (window.matchMedia) return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return getTheme();
}

function rerenderCurrentView() {
  try {
    window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
  } catch (e) {
    window.dispatchEvent(new Event("popstate"));
  }
}
