// Anchored dropdown menu. Opens under its trigger; closes on outside click or
// Escape. Items may be disabled with an honest note.

import { h } from "../lib/dom.js";

export function closeOpenMenu() {
  const existing = document.querySelector(".menu-pop");
  if (existing && typeof existing.__closeMenu === "function") existing.__closeMenu();
  else if (existing) existing.remove();
}

export function openMenu(anchor, { title, subtitle, items, width = 264, className = "", footer = null, align = "right" }) {
  closeOpenMenu();
  const r = anchor.getBoundingClientRect();
  const popWidth = Math.min(width, window.innerWidth - 24);
  const top = r.bottom + 8;
  const maxHeight = Math.max(320, window.innerHeight - top - 12);
  const rawLeft = align === "left" ? r.left
    : align === "center" ? r.left + (r.width / 2) - (popWidth / 2)
    : r.right - popWidth;
  const left = Math.min(window.innerWidth - popWidth - 12, Math.max(12, rawLeft));
  anchor.classList.add("menu-open");
  anchor.setAttribute("aria-expanded", "true");
  const pop = h("div", { class: ("menu-pop " + className).trim(), "data-menu-align": align, style: {
    position: "fixed", top: top + "px", left: left + "px", width: popWidth + "px",
    maxHeight: maxHeight + "px", zIndex: "85",
  } });
  if (title || subtitle) {
    pop.appendChild(h("div", { class: "menu-head" },
      title ? h("div", { class: "menu-title" }, title) : null,
      subtitle ? h("div", { class: "menu-subtitle" }, subtitle) : null));
  }
  for (const it of items) {
    if (it.group) {
      pop.appendChild(h("div", { class: "menu-group" },
        h("span", {}, it.group),
        it.sub ? h("b", {}, it.sub) : null));
      continue;
    }
    if (it.separator) { pop.appendChild(h("div", { class: "menu-sep" })); continue; }
    const tag = !it.disabled && it.onClick ? "button" : "div";
    const row = h(tag, {
      class: "menu-item " + (it.className || "") + (it.active ? " active" : "") + (it.disabled ? " disabled" : ""),
      type: tag === "button" ? "button" : null,
      title: it.title || null,
    },
      it.dot ? h("span", { class: "m-dot " + it.dot }) : null,
      it.ic ? h("span", { class: "m-icon" }, it.ic) : null,
      h("div", { class: "m-body" },
        h("div", { class: "m-label" }, it.label),
        it.sub ? h("div", { class: "m-sub" }, it.sub) : null,
        it.meta ? h("div", { class: "m-meta" }, it.meta) : null,
        it.progress != null ? h("span", { class: "m-progress", style: { "--p": Math.max(0, Math.min(100, Number(it.progress))) + "%" } }) : null),
      it.active ? h("span", { class: "m-check" }, "✓") : null,
      it.badge ? h("span", { class: "m-badge " + (it.badgeClass || "") }, it.badge) : null,
      it.right ? h("span", { class: "m-right num" }, it.right) : null,
      it.toggle != null ? h("span", { class: "m-switch " + (it.toggle ? "on" : "") }) : null,
      it.rightIc ? h("span", { class: "m-right-ic" }, it.rightIc) : null);
    if (!it.disabled && it.onClick) row.addEventListener("click", () => { close(); it.onClick(); });
    pop.appendChild(row);
  }
  if (footer) pop.appendChild(h("div", { class: "menu-footer" }, footer));
  function close() {
    anchor.classList.remove("menu-open");
    anchor.setAttribute("aria-expanded", "false");
    pop.remove();
    document.removeEventListener("mousedown", outside, true);
    document.removeEventListener("keydown", onKey, true);
  }
  pop.__closeMenu = close;
  function outside(e) { if (!pop.contains(e.target) && !anchor.contains(e.target)) close(); }
  function onKey(e) { if (e.key === "Escape") close(); }
  setTimeout(() => {
    document.addEventListener("mousedown", outside, true);
    document.addEventListener("keydown", onKey, true);
  }, 0);
  document.body.appendChild(pop);
  return close;
}
