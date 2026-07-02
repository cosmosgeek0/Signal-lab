// Anchored dropdown menu. Opens under its trigger, right-aligned; closes on
// outside click or Escape. Items may be disabled with an honest note.

import { h } from "../lib/dom.js";

export function openMenu(anchor, { title, items, width = 264 }) {
  const existing = document.querySelector(".menu-pop");
  if (existing) { existing.remove(); return null; }
  const r = anchor.getBoundingClientRect();
  const left = Math.min(window.innerWidth - width - 12, Math.max(12, r.right - width));
  const pop = h("div", { class: "menu-pop", style: {
    position: "fixed", top: (r.bottom + 8) + "px", left: left + "px", width: width + "px", zIndex: "85",
  } });
  if (title) pop.appendChild(h("div", { class: "menu-title" }, title));
  for (const it of items) {
    if (it.group) { pop.appendChild(h("div", { class: "menu-title" }, it.group)); continue; }
    const row = h("div", { class: "menu-item" + (it.active ? " active" : "") + (it.disabled ? " disabled" : "") },
      it.dot ? h("span", { class: "m-dot " + it.dot }) : null,
      h("div", { class: "m-body" },
        h("div", { class: "m-label" }, it.label),
        it.sub ? h("div", { class: "m-sub" }, it.sub) : null),
      it.active ? h("span", { class: "m-check" }, "✓") : null,
      it.right ? h("span", { class: "m-right num" }, it.right) : null);
    if (!it.disabled && it.onClick) row.addEventListener("click", () => { close(); it.onClick(); });
    pop.appendChild(row);
  }
  function close() {
    pop.remove();
    document.removeEventListener("mousedown", outside, true);
    document.removeEventListener("keydown", onKey, true);
  }
  function outside(e) { if (!pop.contains(e.target) && !anchor.contains(e.target)) close(); }
  function onKey(e) { if (e.key === "Escape") close(); }
  setTimeout(() => {
    document.addEventListener("mousedown", outside, true);
    document.addEventListener("keydown", onKey, true);
  }, 0);
  document.body.appendChild(pop);
  return close;
}
