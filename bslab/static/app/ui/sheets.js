// Generic right-side detail sheet. Market cards, source labels and metric
// chips open these — every clickable-looking element must do something useful.

import { h, mount } from "../lib/dom.js";
import { icon } from "../lib/icons.js";

export function openDetailSheet(title, iconName, build) {
  const existing = document.querySelector(".sheet");
  if (existing) existing.remove();
  const oldScrim = document.querySelector(".sheet-scrim");
  if (oldScrim) oldScrim.remove();

  const scrim = h("div", { class: "sheet-scrim", onClick: close });
  const body = h("div", { class: "sheet-body", style: { padding: "16px 19px" } });
  const sheet = h("div", { class: "sheet", role: "dialog", "aria-label": title },
    h("div", { class: "sheet-head" },
      icon(iconName || "info"), h("h2", {}, title),
      h("button", { class: "icon-btn", style: { marginLeft: "auto" }, onClick: close, title: "Close" }, icon("x"))),
    body);

  try { mount(body, build()); } catch (e) { mount(body, h("div", { class: "muted" }, "Detail unavailable.")); }

  function close() {
    scrim.remove(); sheet.remove();
    document.removeEventListener("keydown", onKey, true);
  }
  function onKey(e) { if (e.key === "Escape") close(); }
  document.addEventListener("keydown", onKey, true);
  document.body.appendChild(scrim);
  document.body.appendChild(sheet);
  return close;
}

// Small helpers for sheet content.
export const sheetRow = (k, v, cls) => h("div", { class: "drow", style: { padding: "10px 0" } },
  h("span", { class: "k" }, k), h("span", { class: "v num " + (cls || "") }, v));
export const sheetNote = (text) => h("div", {
  style: { padding: "12px 0 4px", color: "var(--faint)", fontSize: "11.5px", lineHeight: "1.6" } }, text);
export const sheetChart = (html, height = 120) => h("div", { style: { height: height + "px", margin: "10px 0" }, html });
export const sheetTitle = (t) => h("div", { class: "menu-title", style: { padding: "14px 0 6px" } }, t);
