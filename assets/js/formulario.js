// Formulario de seguimiento: dibuja las preguntas, valida y envía.

(() => {
  "use strict";

  const ACENTOS = ["var(--purple)", "var(--orange)", "var(--cyan)", "var(--navy)"];
  const ENVIO_KEY = "cpe-seguimiento-enviado-v6";
  const OBLIGATORIA = "Esta pregunta es obligatoria.";

  const sel = {};       // selecciones de preguntas "multi" (arreglo) y "escala" (número)
  const tarjetas = {};  // n -> <section> de la pregunta
  let intentoEnvio = false;
  let enviando = false;

  // ---------- Dibujo ----------

  function dibujar() {
    const cont = $("#preguntas");
    PREGUNTAS.forEach(p => {
      const acento = ACENTOS[(p.n - 1) % ACENTOS.length];
      if (p.seccion) cont.append(crear("h2", { class: "seccion", style: `--acento:${acento}` }, p.seccion));
      const t = tarjeta(p, acento);
      tarjetas[p.n] = t;
      cont.append(t);
    });
  }

  function tarjeta(p, acento) {
    if (p.tipo === "enlace") return tarjetaEnlace(p);
    const idTitulo = `q${p.n}-titulo`;
    const unCampo = ["texto", "cedula", "parrafo"].includes(p.tipo);
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

  // Invitación con botón a un sitio externo (Padlet). No se valida ni se guarda.
  function tarjetaEnlace(p) {
    return crear("section", { class: "q q--enlace", "data-n": p.n, "aria-labelledby": `q${p.n}-titulo` }, [
      crear("div", { class: "q__cab" }, [
        crear("span", { class: "q__num", "aria-hidden": "true" }, String(p.n)),
        crear("h3", { class: "q__titulo", id: `q${p.n}-titulo` }, p.titulo)
      ]),
      crear("div", { class: "q__cuerpo" }, [
        crear("p", { class: "enlace-texto" }, p.texto),
        botonEnlace(p),
        crear("p", { class: "q__ayuda enlace-nota" }, "Se abre en una pestaña nueva; este formulario sigue abierto.")
      ])
    ]);
  }

  const botonEnlace = p => crear("a", { class: "btn btn--padlet", href: p.url, target: "_blank", rel: "noopener" },
    [p.boton, crear("span", { html: ICONOS.externo })]);

  function control(p) {
    switch (p.tipo) {
      case "texto":
        return crear("input", { id: p.campo, name: p.campo, type: "text", maxlength: p.max, autocomplete: p.autocomplete, oninput: cambio });
      case "cedula":
        return crear("input", {
          id: p.campo, name: p.campo, type: "text", inputmode: "numeric", autocomplete: "off", maxlength: 12,
          class: "input-cedula", oninput: e => { e.target.value = e.target.value.replace(/\D/g, ""); cambio(); }
        });
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
      case "matriz": return matriz(p, false);
      case "matriz-numeros": return matriz(p, true);
    }
  }

  function escala(p) {
    const grupo = crear("div", { class: "escala", role: "radiogroup", "aria-labelledby": `q${p.n}-titulo` });
    for (let v = 1; v <= 5; v++) {
      const b = crear("button", {
        type: "button", role: "radio", "aria-checked": "false",
        "aria-label": v === 1 ? `1: ${p.anclas[0]}` : v === 5 ? `5: ${p.anclas[1]}` : `${v} de 5`,
        onclick: () => {
          sel[p.campo] = v;
          $$("button", grupo).forEach(x => x.setAttribute("aria-checked", String(x === b)));
          cambio();
        }
      }, String(v));
      grupo.append(b);
    }
    return [grupo, crearAnclas(p.anclas)];
  }

  function multi(p) {
    sel[p.campo] = [];
    const chips = crear("div", { class: "chips" });
    // Campo "¿Cuál?" que aparece al elegir la opción "Otra".
    const otroInput = p.otro && crear("input", { id: p.otro.campo, type: "text", maxlength: 240, oninput: cambio });
    const otroWrap = p.otro && crear("div", { class: "otro-campo", hidden: true }, [
      crear("label", { for: p.otro.campo }, p.otro.etiqueta), otroInput
    ]);
    p.opciones.forEach(o => {
      const b = crear("button", { type: "button", class: "chip", "aria-pressed": "false", "data-valor": o }, [
        crear("span", { class: "chip__check", html: ICONOS.check }), crear("span", {}, o)
      ]);
      b.addEventListener("click", () => {
        b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true"));
        sel[p.campo] = $$(".chip", chips).filter(x => x.getAttribute("aria-pressed") === "true").map(x => x.dataset.valor);
        if (p.otro) {
          const activo = sel[p.campo].includes(p.otro.opcion);
          otroWrap.hidden = !activo;
          if (!activo) otroInput.value = "";
          else if (o === p.otro.opcion) otroInput.focus();
        }
        cambio();
      });
      chips.append(b);
    });
    return [chips, otroWrap];
  }

  // Matriz filas × columnas: casillas de verificación o números.
  // En pantallas angostas cada fila se muestra como tarjeta (ver formulario.css).
  function matriz(p, numeros) {
    const caja = crear("div", { class: "matriz" + (numeros ? " matriz--numeros" : ""), style: `--cols:${p.columnas.length}` });
    caja.append(crear("div", { class: "matriz__cab", "aria-hidden": "true" },
      [crear("span"), ...p.columnas.map(c => crear("span", {}, c.texto))]));

    let ninguno = null;
    const casillas = [];
    p.filas.forEach(f => {
      const celdas = p.columnas.map(c => {
        if (numeros) {
          return crear("label", { class: "celda celda--num" }, [
            crear("span", { class: "celda__col" }, c.texto),
            crear("input", {
              id: campoCelda(p, f, c), type: "number", min: 0, max: p.max, step: 1, inputmode: "numeric",
              "aria-label": `${f.texto}, ${c.texto}`, oninput: cambio
            })
          ]);
        }
        const input = crear("input", {
          type: "checkbox", "data-fila": f.id, "data-col": c.texto, "aria-label": `${f.texto}, ${c.texto}`,
          onchange: () => { if (input.checked && ninguno) ninguno.checked = false; cambio(); }
        });
        casillas.push(input);
        return crear("label", { class: "celda" }, [input, crear("span", { class: "casilla", html: ICONOS.check }), crear("span", { class: "celda__col" }, c.texto)]);
      });
      caja.append(crear("div", { class: "matriz__fila", role: "group", "aria-label": f.texto }, [
        crear("div", { class: "matriz__etq" }, f.texto), ...celdas
      ]));
    });

    if (!p.ninguno) return caja;
    ninguno = crear("input", {
      type: "checkbox", id: campoNinguno(p),
      onchange: () => { if (ninguno.checked) casillas.forEach(x => { x.checked = false; }); cambio(); }
    });
    return [caja, crear("label", { class: "ninguno" }, [ninguno, crear("span", { class: "casilla", html: ICONOS.check }), crear("span", {}, p.ninguno)])];
  }

  // ---------- Datos y validación ----------

  const valor = id => (($("#" + id) || {}).value || "").trim();
  const esEntero = (s, max) => /^\d+$/.test(s) && Number(s) <= max;

  function recolectar() {
    const d = {};
    RESPONDIBLES.forEach(p => {
      const t = tarjetas[p.n];
      switch (p.tipo) {
        case "multi":
          d[p.campo] = sel[p.campo].join(SEPARADOR);
          if (p.otro) d[p.otro.campo] = valor(p.otro.campo);
          break;
        case "escala": d[p.campo] = sel[p.campo] ? String(sel[p.campo]) : ""; break;
        case "matriz-numeros":
          p.filas.forEach(f => p.columnas.forEach(c => { d[campoCelda(p, f, c)] = valor(campoCelda(p, f, c)); }));
          break;
        case "matriz":
          p.filas.forEach(f => {
            d[campoFila(p, f)] = $$(`input[data-fila="${f.id}"]:checked`, t).map(x => x.dataset.col).join(SEPARADOR);
          });
          if (p.ninguno) d[campoNinguno(p)] = $("#" + campoNinguno(p)).checked ? "Sí" : "";
          break;
        default: d[p.campo] = valor(p.campo);
      }
    });
    return d;
  }

  function error(p, d) {
    switch (p.tipo) {
      case "cedula":
        if (!d.cedula) return OBLIGATORIA;
        return /^\d{5,12}$/.test(d.cedula) ? "" : "Escribe un número de cédula válido (entre 5 y 12 dígitos).";
      case "escala": return d[p.campo] ? "" : "Elige un valor de 1 a 5.";
      case "multi":
        if (!sel[p.campo].length) return "Selecciona al menos una opción.";
        if (p.otro && sel[p.campo].includes(p.otro.opcion) && !d[p.otro.campo]) return `Escribe cuál es la opción «${p.otro.opcion}».`;
        return "";
      case "matriz": {
        const alguna = p.filas.some(f => d[campoFila(p, f)]) || (p.ninguno && d[campoNinguno(p)]);
        return alguna ? "" : `Marca al menos una casilla, o «${p.ninguno}».`;
      }
      case "matriz-numeros":
        return p.filas.every(f => p.columnas.every(c => esEntero(d[campoCelda(p, f, c)], p.max)))
          ? "" : "Registra un número entero en cada casilla (0 si no aplica).";
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
    RESPONDIBLES.forEach(p => {
      const msg = error(p, d);
      if (!msg) completas++;
      tarjetas[p.n].classList.toggle("q--ok", !msg);
      if (intentoEnvio) pintarError(p, msg);
    });
    const total = RESPONDIBLES.length;
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
    const fallas = RESPONDIBLES.filter(p => error(p, d));
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
        const pCedula = PREGUNTAS.find(p => p.tipo === "cedula");
        mostrarAviso(`Ya hay un seguimiento registrado con la cédula ${d.cedula}. Cada persona responde una sola vez; si necesitas corregir algo, escribe al equipo del programa.`);
        pintarError(pCedula, "Esta cédula ya tiene un seguimiento registrado.");
        irA(pCedula);
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
    g.scrollIntoView({ block: "start" });
  }

  // ---------- Inicio ----------

  $("#metaTiempo").prepend(crear("span", { html: ICONOS.reloj }));
  $("#metaPreguntas").replaceChildren(crear("span", { html: ICONOS.lista }), `${RESPONDIBLES.length} preguntas · todas obligatorias`);
  $("#progreso [role=progressbar]").setAttribute("aria-valuemax", RESPONDIBLES.length);
  $("#graciasIcono").innerHTML = ICONOS.check;
  if (PADLET) {
    $("#graciasPadlet").replaceChildren(
      crear("p", {}, [crear("strong", {}, "¿Ya compartiste tu experiencia? "), "Publica tus respuestas, ejemplos o fotos en el Padlet del taller."]),
      botonEnlace(PADLET));
    $("#graciasPadlet").hidden = false;
  }

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
