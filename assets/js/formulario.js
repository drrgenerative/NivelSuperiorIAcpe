// Formulario de seguimiento: dibuja las preguntas, valida y envía.

(() => {
  "use strict";

  const ACENTOS = ["var(--purple)", "var(--orange)", "var(--cyan)", "var(--navy)"];
  const ENVIO_KEY = "cpe-seguimiento-enviado-v5";
  const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const OBLIGATORIA = "Esta pregunta es obligatoria.";

  const sel = {};       // selecciones de preguntas "multi" (arreglo) y "escala" (número)
  const tarjetas = {};  // n -> <section> de la pregunta
  let intentoEnvio = false;
  let enviando = false;

  // ---------- Dibujo ----------

  function dibujar() {
    const cont = $("#preguntas");
    let acentoSeccion = ACENTOS[0];
    PREGUNTAS.forEach(p => {
      const acento = ACENTOS[(p.n - 1) % ACENTOS.length];
      if (p.seccion) {
        acentoSeccion = acento;
        cont.append(crear("h2", { class: "seccion", style: `--acento:${acentoSeccion}` }, p.seccion));
      }
      const t = tarjeta(p, acento);
      tarjetas[p.n] = t;
      cont.append(t);
    });
  }

  function tarjeta(p, acento) {
    const idTitulo = `q${p.n}-titulo`;
    const unCampo = ["texto", "correo", "lista", "parrafo"].includes(p.tipo);
    const titulo = unCampo
      ? crear("label", { class: "q__titulo", id: idTitulo, for: p.campo }, p.titulo)
      : crear("h3", { class: "q__titulo", id: idTitulo }, p.titulo);
    return crear("section", {
      class: "q", "data-n": p.n, style: `--acento:${acento}`,
      role: unCampo ? null : "group", "aria-labelledby": unCampo ? null : idTitulo
    }, [
      crear("div", { class: "q__cab" }, [crear("span", { class: "q__num", "aria-hidden": "true" }, String(p.n)), titulo]),
      p.ayuda && crear("p", { class: "q__ayuda" }, p.ayuda),
      crear("div", { class: "q__cuerpo" }, control(p)),
      crear("p", { class: "q__error", "aria-live": "polite" }, [crear("span", { html: ICONOS.alerta }), crear("span", { class: "q__error-texto" })])
    ]);
  }

  function control(p) {
    switch (p.tipo) {
      case "texto":
      case "correo":
        return crear("input", {
          id: p.campo, name: p.campo, type: p.tipo === "correo" ? "email" : "text",
          maxlength: p.max, autocomplete: p.autocomplete, oninput: cambio
        });
      case "lista":
        return crear("select", { id: p.campo, name: p.campo, onchange: cambio },
          [crear("option", { value: "" }, "Selecciona…"), ...p.opciones.map(o => crear("option", { value: o }, o))]);
      case "parrafo": {
        const contador = crear("span", { class: "contador" }, `0 / ${p.max}`);
        const area = crear("textarea", {
          id: p.campo, name: p.campo, maxlength: p.max, rows: 4,
          oninput: e => { contador.textContent = `${e.target.value.length} / ${p.max}`; cambio(); }
        });
        return crear("div", { class: "parrafo" }, [area, contador]);
      }
      case "escala": return escala(p);
      case "multi": return multi(p);
      case "numeros": return numeros(p);
    }
  }

  function escala(p) {
    const grupo = crear("div", { class: "escala", role: "radiogroup", "aria-labelledby": `q${p.n}-titulo` });
    for (let v = 1; v <= 5; v++) {
      const b = crear("button", {
        type: "button", role: "radio", "aria-checked": "false", "aria-label": `${v} de 5`,
        onclick: () => {
          sel[p.campo] = v;
          $$("button", grupo).forEach(x => x.setAttribute("aria-checked", String(x === b)));
          cambio();
        }
      }, String(v));
      grupo.append(b);
    }
    return [grupo, crear("div", { class: "anclas", "aria-hidden": "true" }, p.anclas.map(a => crear("span", {}, a)))];
  }

  function multi(p) {
    sel[p.campo] = [];
    const chips = crear("div", { class: "chips" });
    const otroInput = p.otro && crear("input", { id: p.otro.campo, type: "text", maxlength: 240, oninput: cambio });
    const otroWrap = p.otro && crear("div", { class: "sub", hidden: true }, [crear("label", { for: p.otro.campo }, "Otro, ¿cuál?"), otroInput]);
    const conteoInput = p.conteo && crear("input", {
      id: p.conteo.campo, type: "number", min: 0, max: p.conteo.max, step: 1, inputmode: "numeric", oninput: cambio
    });
    const conteoWrap = p.conteo && crear("div", { class: "sub", hidden: true }, [
      crear("label", { for: p.conteo.campo }, p.conteo.etiqueta), conteoInput, crear("p", { class: "q__ayuda" }, p.conteo.ayuda)
    ]);

    const marcar = (b, on) => b.setAttribute("aria-pressed", String(on));
    const activo = b => b.getAttribute("aria-pressed") === "true";

    p.opciones.forEach(o => {
      const b = crear("button", { type: "button", class: "chip", "aria-pressed": "false", "data-valor": o }, [
        crear("span", { class: "chip__check", html: ICONOS.check }), crear("span", {}, o)
      ]);
      b.addEventListener("click", () => {
        const encender = !activo(b);
        const todos = $$(".chip", chips);
        if (o === p.exclusiva && encender) todos.forEach(x => marcar(x, false));
        else if (encender && p.exclusiva) todos.filter(x => x.dataset.valor === p.exclusiva).forEach(x => marcar(x, false));
        marcar(b, encender);
        sel[p.campo] = todos.filter(activo).map(x => x.dataset.valor);
        actualizarDependientes();
        cambio();
      });
      chips.append(b);
    });

    function actualizarDependientes() {
      const s = sel[p.campo];
      if (p.otro) {
        const on = s.includes(p.otro.opcion);
        otroWrap.hidden = !on;
        if (!on) otroInput.value = "";
      }
      if (p.conteo) {
        const ninguno = s.includes(p.exclusiva);
        const conActividad = s.length > 0 && !ninguno;
        conteoWrap.hidden = !conActividad;
        if (ninguno) conteoInput.value = "0";
        else if (!conActividad || conteoInput.value === "0") conteoInput.value = "";
      }
    }

    return [chips, otroWrap, conteoWrap];
  }

  function numeros(p) {
    return crear("div", { class: "numeros" }, p.campos.map(c => crear("div", { class: "numero" }, [
      crear("label", { for: c.campo }, c.etiqueta),
      crear("input", { id: c.campo, type: "number", min: 0, max: p.max, step: 1, inputmode: "numeric", oninput: cambio })
    ])));
  }

  // ---------- Datos y validación ----------

  const valor = id => (($("#" + id) || {}).value || "").trim();
  const esEntero = (s, max) => /^\d+$/.test(s) && Number(s) <= max;

  function recolectar() {
    const d = {};
    PREGUNTAS.forEach(p => {
      if (p.tipo === "multi") {
        d[p.campo] = sel[p.campo].join(SEPARADOR);
        if (p.otro) d[p.otro.campo] = valor(p.otro.campo);
        if (p.conteo) d[p.conteo.campo] = valor(p.conteo.campo);
      } else if (p.tipo === "escala") {
        d[p.campo] = sel[p.campo] ? String(sel[p.campo]) : "";
      } else if (p.tipo === "numeros") {
        p.campos.forEach(c => { d[c.campo] = valor(c.campo); });
      } else {
        d[p.campo] = valor(p.campo);
      }
    });
    return d;
  }

  function error(p, d) {
    switch (p.tipo) {
      case "correo":
        if (!d.correo) return OBLIGATORIA;
        return CORREO_RE.test(d.correo) ? "" : "Escribe un correo válido, por ejemplo nombre@dominio.com.";
      case "lista": return d[p.campo] ? "" : "Selecciona una opción.";
      case "escala": return d[p.campo] ? "" : "Elige un valor de 1 a 5.";
      case "numeros":
        return p.campos.every(c => esEntero(d[c.campo], p.max)) ? "" : "Registra un número entero en cada nivel (0 si no aplica).";
      case "multi":
        if (!sel[p.campo].length) return "Selecciona al menos una opción.";
        if (p.otro && sel[p.campo].includes(p.otro.opcion) && !d[p.otro.campo]) return "Escribe cuál es la otra opción.";
        if (p.conteo && !esEntero(d[p.conteo.campo], p.conteo.max)) return "Indica aproximadamente cuántos estudiantes participaron.";
        return "";
      default: return d[p.campo] ? "" : OBLIGATORIA;
    }
  }

  function pintarError(p, msg) {
    const t = tarjetas[p.n];
    t.classList.toggle("q--error", !!msg);
    $(".q__error-texto", t).textContent = msg;
  }

  // Se llama con cada cambio: progreso y, tras un intento de envío, errores en vivo.
  function cambio() {
    const d = recolectar();
    let completas = 0;
    PREGUNTAS.forEach(p => {
      const msg = error(p, d);
      if (!msg) completas++;
      tarjetas[p.n].classList.toggle("q--ok", !msg);
      if (intentoEnvio) pintarError(p, msg);
    });
    const total = PREGUNTAS.length;
    $("#progresoRelleno").style.width = `${(completas / total) * 100}%`;
    $("#progresoTexto").textContent = `${completas} de ${total}`;
    $("#progreso [role=progressbar]").setAttribute("aria-valuenow", completas);
    if (intentoEnvio && completas === total) ocultarAviso();
  }

  // ---------- Envío ----------

  function mostrarAviso(texto) {
    const a = $("#aviso");
    a.replaceChildren(crear("span", { html: ICONOS.alerta }), crear("span", {}, texto));
    a.hidden = false;
  }
  const ocultarAviso = () => { $("#aviso").hidden = true; };

  function irA(p) {
    const t = tarjetas[p.n];
    t.scrollIntoView({ behavior: "smooth", block: "center" });
    const foco = $("input, select, textarea, button", t);
    if (foco) foco.focus({ preventScroll: true });
  }

  function estadoBoton(cargando) {
    const b = $("#enviarBtn");
    b.disabled = cargando;
    b.replaceChildren(...(cargando ? [crear("span", { class: "girando" }), "Enviando…"] : ["Enviar seguimiento"]));
  }

  async function enviar(ev) {
    ev.preventDefault();
    if (enviando) return;
    intentoEnvio = true;
    const d = recolectar();
    const fallas = PREGUNTAS.filter(p => error(p, d));
    cambio();
    if (fallas.length) {
      mostrarAviso(fallas.length === 1
        ? "Falta 1 pregunta por completar. Está marcada en rojo."
        : `Faltan ${fallas.length} preguntas por completar. Están marcadas en rojo.`);
      irA(fallas[0]);
      return;
    }
    if ($("#sitio_web").value) { mostrarGracias(); return; }

    ocultarAviso();
    enviando = true;
    estadoBoton(true);
    try {
      const r = await API.enviar(d);
      if (r.ok) {
        try { sessionStorage.setItem(ENVIO_KEY, "1"); } catch (e) { }
        mostrarGracias();
      } else if (r.error === "duplicado") {
        const pCorreo = PREGUNTAS.find(p => p.campo === "correo");
        mostrarAviso(`Ya hay un seguimiento registrado con el correo ${d.correo}. Cada persona responde una sola vez; si necesitas corregir algo, escribe al equipo del programa.`);
        pintarError(pCorreo, "Este correo ya tiene un seguimiento registrado.");
        irA(pCorreo);
      } else {
        mostrarAviso("No pudimos guardar tu respuesta. Revisa los datos e intenta de nuevo.");
      }
    } catch (e) {
      mostrarAviso("No se pudo enviar. Verifica tu conexión e intenta de nuevo; tus respuestas siguen aquí.");
    } finally {
      enviando = false;
      estadoBoton(false);
    }
  }

  function mostrarGracias() {
    $("#formulario").hidden = true;
    $("#progreso").hidden = true;
    const g = $("#gracias");
    g.hidden = false;
    g.focus();
    window.scrollTo({ top: 0 });
  }

  // ---------- Inicio ----------

  $("#metaTiempo").prepend(crear("span", { html: ICONOS.reloj }));
  $("#metaPreguntas").prepend(crear("span", { html: ICONOS.lista }));
  $("#graciasIcono").innerHTML = ICONOS.check;

  if (API.demo) {
    const a = $("#avisoDemo");
    a.append(crear("span", { html: ICONOS.alerta }),
      crear("span", {}, "Modo de prueba: las respuestas se guardan solo en este navegador. Para recibirlas en Google Sheets, configura SCRIPT_URL en assets/js/config.js."));
    a.hidden = false;
  }

  dibujar();
  cambio();
  $("#formulario").addEventListener("submit", enviar);
  $("#otraRespuesta").addEventListener("click", () => {
    try { sessionStorage.removeItem(ENVIO_KEY); } catch (e) { }
    location.reload();
  });
  try { if (sessionStorage.getItem(ENVIO_KEY) === "1") mostrarGracias(); } catch (e) { }
})();
