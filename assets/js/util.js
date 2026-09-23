// Utilidades compartidas por el formulario y el panel.

const $ = (s, raiz = document) => raiz.querySelector(s);
const $$ = (s, raiz = document) => Array.from(raiz.querySelectorAll(s));

// Crea un elemento. Los hijos de texto se insertan como texto (nunca HTML);
// `html` solo se usa para íconos estáticos del propio código.
function crear(tag, props = {}, hijos = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "hidden") e.hidden = true;
    else e.setAttribute(k, v === true ? "" : v);
  }
  [].concat(hijos).flat(Infinity).forEach(h => { if (h != null && h !== false) e.append(h); });
  return e;
}

const ICONOS = {
  check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  alerta: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 5.5v5.5M10 14v.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  reloj: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 6v4.3l2.8 1.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  lista: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5.5h9M7 10h9M7 14.5h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="3.8" cy="5.5" r="1.2" fill="currentColor"/><circle cx="3.8" cy="10" r="1.2" fill="currentColor"/><circle cx="3.8" cy="14.5" r="1.2" fill="currentColor"/></svg>',
  candado: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="9" width="12" height="8.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6.8 9V6.8a3.2 3.2 0 016.4 0V9" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
};

const fmtNum = n => Number(n || 0).toLocaleString("es-CO");
const fmtFecha = d => d.toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtFechaCorta = d => d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
