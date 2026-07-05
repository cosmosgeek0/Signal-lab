// Tiny hyperscript + DOM helpers. No framework: a plain h() that returns nodes.

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  let pendingValue;
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === "class" || k === "className") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k === "style" && typeof v === "object") {
        for (const sk in v) {
          if (sk.startsWith("--")) el.style.setProperty(sk, v[sk]);
          else el.style[sk] = v[sk];
        }
      }
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k.startsWith("on") && typeof v === "function")
        el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "value") pendingValue = v;
      else if (k === "checked") el[k] = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
  }
  append(el, kids);
  if (pendingValue != null) el.value = pendingValue;
  return el;
}

function append(el, kids) {
  for (const kid of kids) {
    if (kid == null || kid === false) continue;
    if (Array.isArray(kid)) append(el, kid);
    else if (kid instanceof Node) el.appendChild(kid);
    else el.appendChild(document.createTextNode(String(kid)));
  }
}

// Build an element whose innerHTML is a raw SVG string (used for inline icons).
export function svg(markup, cls) {
  const span = document.createElement("span");
  span.className = cls || "";
  span.setAttribute("aria-hidden", "true");
  span.style.display = "inline-flex";
  span.innerHTML = markup;
  return span;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function mount(node, ...kids) {
  clear(node);
  append(node, kids);
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function on(target, evt, fn, opts) {
  target.addEventListener(evt, fn, opts);
  return () => target.removeEventListener(evt, fn, opts);
}
