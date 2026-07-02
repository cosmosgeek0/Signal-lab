// Hover context cards. attachPopover(el, build) shows a small card near the
// element after a short delay; build() returns a DOM node (mini chart, stats,
// source, last update). One popover at a time; disappears on leave.

import { h } from "../lib/dom.js";

let current = null;
let showTimer = null;

function removeCurrent() {
  if (current) { current.remove(); current = null; }
}

export function attachPopover(el, build, { delay = 220 } = {}) {
  el.addEventListener("mouseenter", () => {
    clearTimeout(showTimer);
    showTimer = setTimeout(() => {
      removeCurrent();
      let content;
      try { content = build(); } catch (e) { return; }
      if (!content) return;
      const pop = h("div", { class: "hover-pop" }, content);
      document.body.appendChild(pop);
      const r = el.getBoundingClientRect();
      const pw = pop.offsetWidth, ph = pop.offsetHeight;
      let left = Math.min(window.innerWidth - pw - 10, Math.max(10, r.left + r.width / 2 - pw / 2));
      let top = r.bottom + 10;
      if (top + ph > window.innerHeight - 10) top = r.top - ph - 10;
      pop.style.left = left + "px";
      pop.style.top = Math.max(10, top) + "px";
      current = pop;
    }, delay);
  });
  el.addEventListener("mouseleave", () => { clearTimeout(showTimer); removeCurrent(); });
  el.addEventListener("click", () => { clearTimeout(showTimer); removeCurrent(); });
}

// Convenience rows for popover content.
export function popRow(k, v, cls) {
  return h("div", { class: "hp-row" },
    h("span", { class: "k" }, k),
    h("span", { class: "v num " + (cls || "") }, v));
}
