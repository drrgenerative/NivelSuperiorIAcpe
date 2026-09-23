// Panel de administración: ingreso, resumen, vista individual y exportación a Excel.

(() => {
  "use strict";

  const CLAVE_KEY = "cpe-admin-clave";
  const XLSX_URL = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
  const P_ESCALA = PREGUNTAS.find(p => p.tipo === "escala");
  const P_PERSONAS = PREGUNTAS.find(p => p.tipo === "matriz-numeros");
  const P_ACTIVIDADES = PREGUNTAS.find(p => p.campo === "actividades");
  const MENSAJES = {
    clave: "Contraseña incorrecta.",
    bloqueado: "Demasiados intentos fallidos. Espera 15 minutos e intenta de nuevo.",
    sin_clave: "El servidor no tiene contraseña configurada (propiedad ADMIN_PASSWORD en Apps Script).",
    servidor: "Error en el servidor. Intenta de nuevo en unos minutos."
  };

  let clave = "";
  let todas = [];       // todas las respuestas normalizadas, más recientes primero
  let filtradas = [];
  let vista = "resumen";
  let seleccion = null; // _id de la respuesta abierta en la vista individual
  let busqueda = "";

  const fmtPct = x => `${Math.round(x)}%`;
  const fmtDec = x => x.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const plural = (n, uno, varios) => `${fmtNum(n)} ${n === 1 ? uno : varios}`;

  // ---------- Datos ----------

  function normalizar(f, i) {
    const fecha = new Date(f.fecha);
    const r = { _id: i, fecha: isNaN(fecha) ? null : fecha, _listas: {} };
    COLUMNAS.forEach(c => {
      if (c.tipo === "fecha") return;
      const v = f[c.campo] ?? "";
      if (c.tipo === "numero") r[c.campo] = Number(v) || 0;
      else if (c.tipo === "multi") r._listas[c.campo] = String(v).split(SEPARADOR).map(s => s.trim()).filter(Boolean);
      else r[c.campo] = String(v).trim();
    });
    return r;
  }

  const tieneAlgo = (p, f) => p.filas.some(fi => f._listas[campoFila(p, fi)].length > 0);

  function sumasPersonas(filas) {
    const p = P_PERSONAS;
    const celdas = p.filas.map(fi => p.columnas.map(c => filas.reduce((s, f) => s + f[campoCelda(p, fi, c)], 0)));
    const porRol = p.columnas.map((_, j) => celdas.reduce((s, fila) => s + fila[j], 0));
    return { celdas, porRol, total: porRol.reduce((a, b) => a + b, 0) };
  }

  function indicadores(filas) {
    const conEscala = filas.filter(f => f[P_ESCALA.campo] > 0);
    const s = sumasPersonas(filas);
    const rol = id => s.porRol[P_PERSONAS.columnas.findIndex(c => c.id === id)] || 0;
    return {
      respuestas: filas.length,
      directivos: rol("directivos"),
      docentes: rol("docentes"),
      estudiantes: rol("estudiantes"),
      conActividades: filas.filter(f => tieneAlgo(P_ACTIVIDADES, f)).length,
      promedio: conEscala.length ? conEscala.reduce((a, f) => a + f[P_ESCALA.campo], 0) / conEscala.length : 0
    };
  }

  // Por cada fila de una matriz: cuántas personas marcaron cada rol y cuántas marcaron alguno.
  function conteoMatriz(p, filas) {
    return {
      filas: p.filas.map(fi => {
        const listas = filas.map(f => f._listas[campoFila(p, fi)]);
        return {
          texto: fi.texto,
          porCol: p.columnas.map(c => listas.filter(l => l.includes(c.texto)).length),
          alguna: listas.filter(l => l.length > 0).length
        };
      }),
      ninguno: filas.filter(f => f[campoNinguno(p)]).length
    };
  }

  const conteoMulti = (p, filas) =>
    p.opciones.map(o => ({ etiqueta: o, valor: filas.filter(f => f._listas[p.campo].includes(o)).length }));

  const conteoEscala = filas =>
    [1, 2, 3, 4, 5].map(v => ({ etiqueta: String(v), valor: filas.filter(f => f[P_ESCALA.campo] === v).length }));

  // ---------- Ingreso ----------

  async function ingresar(c, silencioso) {
    const btn = $("#ingresoBtn");
    btn.disabled = true;
    btn.replaceChildren(crear("span", { class: "girando" }), "Entrando…");
    $("#ingresoError").hidden = true;
    try {
      const r = await API.respuestas(c);
      if (!r.ok) {
        try { sessionStorage.removeItem(CLAVE_KEY); } catch (e) { }
        if (!silencioso) errorIngreso(MENSAJES[r.error] || "No se pudo ingresar.");
        return;
      }
      clave = c;
      try { sessionStorage.setItem(CLAVE_KEY, c); } catch (e) { }
      cargarFilas(r.filas);
      abrirPanel();
    } catch (e) {
      if (!silencioso) errorIngreso("No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.");
    } finally {
      btn.disabled = false;
      btn.replaceChildren("Entrar");
    }
  }

  function errorIngreso(msg) {
    const a = $("#ingresoError");
    a.replaceChildren(crear("span", { html: ICONOS.alerta }), crear("span", {}, msg));
    a.hidden = false;
    $("#clave").select();
  }

  function cargarFilas(filas) {
    todas = (filas || []).map(normalizar)
      .sort((a, b) => (b.fecha ? b.fecha.getTime() : 0) - (a.fecha ? a.fecha.getTime() : 0));
    aplicarFiltros();
  }

  function abrirPanel() {
    $("#ingreso").hidden = true;
    $("#panel").hidden = false;
    if (API.demo) {
      const b = $("#demoBarra");
      b.replaceChildren(
        crear("span", { html: ICONOS.alerta }),
        crear("span", {}, "Modo de prueba: los datos viven solo en este navegador."),
        crear("button", { class: "btn btn--secundario btn--chico", type: "button", onclick: () => { API.cargarEjemplos(30); recargar(); } }, "Cargar 30 respuestas de ejemplo"),
        crear("button", { class: "btn btn--secundario btn--chico", type: "button", onclick: () => { API.borrarDemo(); recargar(); } }, "Borrar datos de prueba")
      );
      b.hidden = false;
    }
  }

  async function recargar() {
    const btn = $("#actualizarBtn");
    btn.disabled = true;
    try {
      const r = await API.respuestas(clave);
      if (!r.ok) {
        if (r.error === "clave") return salir();
        return toast(MENSAJES[r.error] || "No se pudieron actualizar los datos.");
      }
      cargarFilas(r.filas);
      toast(`Datos actualizados: ${plural(todas.length, "respuesta", "respuestas")}.`);
    } catch (e) {
      toast("No se pudo conectar con el servidor.");
    } finally {
      btn.disabled = false;
    }
  }

  function salir() {
    try { sessionStorage.removeItem(CLAVE_KEY); } catch (e) { }
    location.reload();
  }

  // ---------- Filtros ----------

  function aplicarFiltros() {
    const desde = $("#fDesde").value ? new Date($("#fDesde").value + "T00:00:00") : null;
    const hasta = $("#fHasta").value ? new Date($("#fHasta").value + "T23:59:59.999") : null;
    filtradas = todas.filter(f =>
      (!desde || (f.fecha && f.fecha >= desde)) &&
      (!hasta || (f.fecha && f.fecha <= hasta)));
    $("#cuenta").replaceChildren(crear("strong", {}, fmtNum(filtradas.length)),
      filtradas.length === todas.length ? " respuestas" : ` de ${fmtNum(todas.length)} respuestas`);
    render();
  }

  function descripcionFiltros() {
    const partes = [];
    if ($("#fDesde").value) partes.push(`Desde: ${$("#fDesde").value}`);
    if ($("#fHasta").value) partes.push(`Hasta: ${$("#fHasta").value}`);
    return partes.length ? partes.join(" · ") : "Ninguno (todas las respuestas)";
  }

  // ---------- Vistas ----------

  function render() {
    if (vista === "resumen") renderResumen();
    else renderIndividual();
  }

  function cambiarVista(nueva) {
    vista = nueva;
    $("#tabResumen").setAttribute("aria-selected", String(nueva === "resumen"));
    $("#tabIndividual").setAttribute("aria-selected", String(nueva === "individual"));
    $("#vistaResumen").hidden = nueva !== "resumen";
    $("#vistaIndividual").hidden = nueva !== "individual";
    render();
  }

  const vacio = (titulo, texto) => crear("div", { class: "vacio" }, [crear("strong", {}, titulo), texto]);

  function sinDatos(contenedor) {
    if (!todas.length) {
      contenedor.append(vacio("Todavía no hay respuestas", "Cuando alguien envíe el formulario de seguimiento, aparecerá aquí."));
      return true;
    }
    if (!filtradas.length) {
      contenedor.append(vacio("Sin resultados", "Ninguna respuesta coincide con los filtros seleccionados."));
      return true;
    }
    return false;
  }

  // ----- Resumen -----

  function renderResumen() {
    const v = $("#vistaResumen");
    v.replaceChildren();
    if (sinDatos(v)) return;

    const k = indicadores(filtradas);
    const n = filtradas.length;
    v.append(crear("div", { class: "kpis" }, [
      kpi("Respuestas", fmtNum(k.respuestas), `${plural(k.conActividades, "con actividades", "con actividades")} o talleres`, "var(--purple)"),
      kpi("Directivos formados", fmtNum(k.directivos), "suma de los tres niveles", "var(--orange)"),
      kpi("Docentes formados", fmtNum(k.docentes), "suma de los tres niveles", "var(--cyan)"),
      kpi("Estudiantes alcanzados", fmtNum(k.estudiantes), "suma de los tres niveles", "var(--navy)"),
      kpi("Aplicación de lo aprendido", [fmtDec(k.promedio), crear("small", {}, " / 5")], "promedio de la escala", "var(--yellow)")
    ]));

    const metaMatriz = `${plural(n, "respuesta", "respuestas")} · cada celda: personas que marcaron esa casilla (% del total)`;
    const tarjetas = [];
    // La escala y la tabla de personas van lado a lado; el resto en el orden del formulario.
    const primero = p => (p.tipo === "escala" ? 0 : p.tipo === "matriz-numeros" ? 1 : 2);
    RESPONDIBLES.filter(p => p.n > 2).sort((a, b) => primero(a) - primero(b) || a.n - b.n).forEach(p => {
      switch (p.tipo) {
        case "escala":
          tarjetas.push(tarjeta(p, `${plural(n, "respuesta", "respuestas")} · promedio ${fmtDec(k.promedio)}`, columnasEscala(conteoEscala(filtradas), n, p.anclas)));
          break;
        case "matriz-numeros":
          tarjetas.push(tarjeta(p, "Suma de lo reportado por todos los formadores", tablaNumeros(p, sumasPersonas(filtradas))));
          break;
        case "matriz":
          tarjetas.push(tarjeta(p, metaMatriz, tablaMatriz(p, conteoMatriz(p, filtradas), n), true));
          break;
        case "multi":
          tarjetas.push(tarjeta(p, `${plural(n, "respuesta", "respuestas")} · selección múltiple: los porcentajes pueden sumar más de 100%`,
            [barras(conteoMulti(p, filtradas), n, "barras--2col"), desplegableOtros(p)], true));
          break;
        case "parrafo":
          tarjetas.push(tarjeta(p, plural(filtradas.filter(f => f[p.campo]).length, "respuesta abierta", "respuestas abiertas"), textos(filtradas, p.campo), true));
          break;
      }
    });
    v.append(crear("div", { class: "rejilla" }, tarjetas));
  }

  function kpi(etiqueta, valor, nota, acento) {
    return crear("div", { class: "kpi", style: `--acento:${acento}` }, [
      crear("div", { class: "kpi__etq" }, etiqueta),
      crear("div", { class: "kpi__valor" }, valor),
      crear("div", { class: "kpi__nota" }, nota)
    ]);
  }

  function tarjeta(p, meta, cuerpo, ancha) {
    return crear("article", { class: "tarjeta" + (ancha ? " tarjeta--ancha" : "") }, [
      crear("div", { class: "tarjeta__cab" }, [crear("span", { class: "tarjeta__num" }, String(p.n)), crear("h3", {}, p.titulo)]),
      crear("p", { class: "tarjeta__meta" }, meta),
      cuerpo
    ]);
  }

  function barras(items, total, clase = "") {
    return crear("div", { class: `barras ${clase}` }, items.map(it => {
      const pct = total ? (it.valor / total) * 100 : 0;
      return crear("div", {
        class: "barra-h" + (it.valor ? "" : " barra-h--cero"),
        title: `${it.etiqueta}: ${fmtNum(it.valor)} (${fmtPct(pct)})`
      }, [
        crear("span", { class: "barra-h__etq" }, it.etiqueta),
        crear("span", { class: "barra-h__val" }, [fmtNum(it.valor), crear("small", {}, fmtPct(pct))]),
        crear("div", { class: "barra-h__pista", "aria-hidden": "true" },
          crear("div", { class: "barra-h__relleno", style: `width:${pct}%` }))
      ]);
    }));
  }

  function columnasEscala(items, total, anclas) {
    const max = Math.max(1, ...items.map(i => i.valor));
    return crear("div", {}, [
      crear("div", { class: "columnas" }, items.map(it => crear("div", {
        class: "columna", title: `${it.etiqueta}: ${fmtNum(it.valor)} respuestas (${fmtPct(total ? it.valor / total * 100 : 0)})`
      }, [
        crear("span", { class: "columna__val" }, fmtNum(it.valor)),
        crear("div", { class: "columna__barra", style: `height:calc((100% - 24px) * ${it.valor / max})` })
      ]))),
      crear("div", { class: "columnas__eje" }, items.map(it => crear("span", {}, it.etiqueta))),
      crearAnclas(anclas)
    ]);
  }

  // Tabla de calor: el fondo se intensifica con el porcentaje; el número siempre está escrito.
  function celdaCalor(v, n) {
    const pct = n ? (v / n) * 100 : 0;
    return crear("td", { class: "calor", style: `--p:${(pct * 0.6).toFixed(1)}%`, title: `${fmtNum(v)} de ${fmtNum(n)} (${fmtPct(pct)})` },
      [crear("strong", {}, fmtNum(v)), crear("small", {}, fmtPct(pct))]);
  }

  function tablaMatriz(p, conteo, n) {
    return [
      crear("div", { class: "tabla-scroll" }, crear("table", { class: "tabla" }, [
        crear("thead", {}, crear("tr", {}, [crear("th", { scope: "col" }, "Opción"), ...p.columnas.map(c => crear("th", { scope: "col" }, c.texto)), crear("th", { scope: "col" }, "Algún rol")])),
        crear("tbody", {}, conteo.filas.map(f => crear("tr", {}, [
          crear("th", { scope: "row" }, f.texto), ...f.porCol.map(v => celdaCalor(v, n)), celdaCalor(f.alguna, n)
        ])))
      ])),
      p.ninguno && crear("p", { class: "extra" }, [`${p.ninguno}: `, crear("strong", {}, fmtNum(conteo.ninguno)), ` (${fmtPct(n ? conteo.ninguno / n * 100 : 0)})`])
    ];
  }

  function tablaNumeros(p, s) {
    const totalFila = fila => fila.reduce((a, b) => a + b, 0);
    return crear("div", { class: "tabla-scroll" }, crear("table", { class: "tabla tabla--numeros" }, [
      crear("thead", {}, crear("tr", {}, [crear("th", { scope: "col" }, "Nivel"), ...p.columnas.map(c => crear("th", { scope: "col" }, c.texto)), crear("th", { scope: "col" }, "Total")])),
      crear("tbody", {}, p.filas.map((f, i) => crear("tr", {}, [
        crear("th", { scope: "row" }, f.texto), ...s.celdas[i].map(v => crear("td", {}, fmtNum(v))), crear("td", { class: "tabla__total" }, fmtNum(totalFila(s.celdas[i])))
      ]))),
      crear("tfoot", {}, crear("tr", {}, [
        crear("th", { scope: "row" }, "Total"), ...s.porRol.map(v => crear("td", {}, fmtNum(v))), crear("td", {}, fmtNum(s.total))
      ]))
    ]));
  }

  function desplegableOtros(p) {
    if (!p.otro) return null;
    const cuantos = filtradas.filter(f => f[p.otro.campo]).length;
    if (!cuantos) return null;
    return crear("details", { class: "desplegable" }, [
      crear("summary", {}, `Ver cuáles escribieron en «${p.otro.opcion}» (${cuantos})`),
      textos(filtradas, p.otro.campo)
    ]);
  }

  function textos(filas, campo) {
    const con = filas.filter(f => f[campo]);
    if (!con.length) return crear("p", { class: "tarjeta__meta" }, "Sin respuestas.");
    return crear("div", { class: "textos" }, con.map(f => crear("div", { class: "texto" }, [
      crear("div", {}, f[campo]),
      crear("div", { class: "texto__quien" }, `${f.nombre} · C.C. ${f.cedula}`)
    ])));
  }

  // ----- Individual -----

  function renderIndividual() {
    const v = $("#vistaIndividual");
    v.replaceChildren();
    if (sinDatos(v)) return;

    const items = crear("div", { class: "lista__items" });
    const detalle = crear("div", { class: "detalle" });
    const buscador = crear("input", {
      type: "search", placeholder: "Buscar por nombre o cédula", "aria-label": "Buscar respuesta",
      oninput: e => { busqueda = e.target.value; actualizar(); }
    });
    buscador.value = busqueda;
    v.append(crear("div", { class: "individual" }, [
      crear("aside", { class: "lista" }, [crear("div", { class: "lista__buscar" }, buscador), items]),
      detalle
    ]));

    const visibles = () => {
      const q = busqueda.trim().toLowerCase();
      return q ? filtradas.filter(f => `${f.nombre} ${f.cedula}`.toLowerCase().includes(q)) : filtradas;
    };

    function ir(id, desdeLista) {
      seleccion = id;
      actualizar();
      const actual = $(".lista__item[aria-current=true]", items);
      if (actual) actual.scrollIntoView({ block: "nearest" });
      if (desdeLista && matchMedia("(max-width: 980px)").matches) detalle.scrollIntoView({ behavior: "smooth" });
    }

    function actualizar() {
      const lista = visibles();
      if (!lista.some(f => f._id === seleccion)) seleccion = lista.length ? lista[0]._id : null;
      items.replaceChildren(...(lista.length
        ? lista.map(f => crear("button", {
          type: "button", class: "lista__item", "aria-current": String(f._id === seleccion),
          onclick: () => ir(f._id, true)
        }, [
          crear("div", { class: "lista__nombre" }, f.nombre || "(sin nombre)"),
          crear("div", { class: "lista__detalle" }, `C.C. ${f.cedula} · ${f.fecha ? fmtFechaCorta(f.fecha) : "sin fecha"}`)
        ]))
        : [crear("div", { class: "lista__vacia" }, "Sin coincidencias.")]));
      const idx = lista.findIndex(f => f._id === seleccion);
      detalle.replaceChildren(...(idx >= 0 ? vistaDetalle(lista, idx, ir) : []));
    }

    actualizar();
  }

  function vistaDetalle(lista, idx, ir) {
    const f = lista[idx];
    const cab = crear("div", { class: "detalle__cab" }, [
      crear("div", {}, [
        crear("div", { class: "detalle__nombre" }, f.nombre || "(sin nombre)"),
        crear("div", { class: "detalle__datos" }, [
          crear("span", {}, `C.C. ${f.cedula}`),
          crear("span", {}, f.fecha ? fmtFecha(f.fecha) : "sin fecha")
        ])
      ]),
      crear("div", { class: "detalle__nav" }, [
        crear("button", { class: "btn btn--chico", type: "button", disabled: idx === 0, onclick: () => ir(lista[idx - 1]._id) }, "‹ Anterior"),
        crear("span", {}, `${idx + 1} de ${lista.length}`),
        crear("button", { class: "btn btn--chico", type: "button", disabled: idx === lista.length - 1, onclick: () => ir(lista[idx + 1]._id) }, "Siguiente ›")
      ])
    ]);
    const respuestas = RESPONDIBLES.filter(p => p.n > 2).map(p => crear("div", { class: "resp" }, [
      crear("h3", {}, [crear("span", { class: "tarjeta__num" }, String(p.n)), crear("span", {}, p.titulo)]),
      crear("div", { class: "resp__cuerpo" }, cuerpoRespuesta(p, f))
    ]));
    return [cab, ...respuestas];
  }

  function cuerpoRespuesta(p, f) {
    switch (p.tipo) {
      case "escala":
        return [
          crear("div", { class: "escala-ver" }, [1, 2, 3, 4, 5].map(v => crear("span", { class: f[p.campo] === v ? "si" : null }, String(v)))),
          crearAnclas(p.anclas)
        ];
      case "matriz": {
        if (f[campoNinguno(p)]) return crear("p", { class: "cita" }, p.ninguno);
        return crear("div", { class: "tabla-scroll" }, crear("table", { class: "tabla tabla--marcas" }, [
          crear("thead", {}, crear("tr", {}, [crear("th", { scope: "col" }, ""), ...p.columnas.map(c => crear("th", { scope: "col" }, c.texto))])),
          crear("tbody", {}, p.filas.map(fi => {
            const l = f._listas[campoFila(p, fi)];
            return crear("tr", { class: l.length ? "si" : null }, [
              crear("th", { scope: "row" }, fi.texto),
              ...p.columnas.map(c => l.includes(c.texto)
                ? crear("td", { class: "marca", "aria-label": "Sí", html: ICONOS.check })
                : crear("td", { class: "marca marca--no", "aria-label": "No" }, "·"))
            ]);
          }))
        ]));
      }
      case "matriz-numeros": {
        const celdas = p.filas.map(fi => p.columnas.map(c => f[campoCelda(p, fi, c)]));
        const porRol = p.columnas.map((_, j) => celdas.reduce((s, fila) => s + fila[j], 0));
        return tablaNumeros(p, { celdas, porRol, total: porRol.reduce((a, b) => a + b, 0) });
      }
      case "multi": {
        const elegidas = f._listas[p.campo];
        const fuera = elegidas.filter(o => !p.opciones.includes(o)); // valores de versiones anteriores
        const op = (o, si) => crear("span", { class: "op" + (si ? " op--si" : "") }, [crear("span", { class: "op__marca", html: ICONOS.check }), o]);
        return [
          crear("div", { class: "opciones" }, [...p.opciones.map(o => op(o, elegidas.includes(o))), ...fuera.map(o => op(o, true))]),
          p.otro && f[p.otro.campo] && crear("p", { class: "extra" }, [`${p.otro.opcion}: `, crear("strong", {}, f[p.otro.campo])])
        ];
      }
      default:
        return crear("p", { class: "cita" }, f[p.campo] || "Sin respuesta");
    }
  }

  // ---------- Excel ----------

  function cargarXLSX() {
    if (window.XLSX) return Promise.resolve();
    return new Promise((ok, mal) => {
      const s = document.createElement("script");
      s.src = XLSX_URL;
      s.onload = ok;
      s.onerror = () => mal(new Error("xlsx"));
      document.head.append(s);
    });
  }

  // Fecha local -> número de serie de Excel (evita desfases de zona horaria).
  const serialExcel = d => (d.getTime() - d.getTimezoneOffset() * 60000) / 864e5 + 25569;

  function hojaRespuestas(filas) {
    const ordenadas = [...filas].sort((a, b) => (a.fecha ? a.fecha.getTime() : 0) - (b.fecha ? b.fecha.getTime() : 0));
    const aoa = [COLUMNAS.map(c => c.etiqueta)];
    ordenadas.forEach(f => aoa.push(COLUMNAS.map(c => {
      if (c.tipo === "fecha") return f.fecha ? serialExcel(f.fecha) : "";
      if (c.tipo === "multi") return f._listas[c.campo].join("; ");
      return f[c.campo];
    })));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    for (let r = 1; r < aoa.length; r++) {
      const celda = ws[XLSX.utils.encode_cell({ r, c: 0 })];
      if (celda && celda.t === "n") celda.z = "yyyy-mm-dd hh:mm";
    }
    ws["!cols"] = COLUMNAS.map(c => ({ wch: c.ancho || 18 }));
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: COLUMNAS.length - 1 } }) };
    return ws;
  }

  function hojaResumen(filas) {
    const k = indicadores(filas);
    const n = filas.length;
    const aoa = [
      ["Resumen del seguimiento · Formación de formadores en IA"],
      ["Generado", fmtFecha(new Date())],
      ["Filtros", descripcionFiltros()],
      [],
      ["Indicador", "Valor"],
      ["Respuestas", k.respuestas],
      ["Formadores con actividades o talleres", k.conActividades],
      ["Directivos formados", k.directivos],
      ["Docentes formados", k.docentes],
      ["Estudiantes alcanzados", k.estudiantes],
      ["Aplicación de lo aprendido (promedio 1 a 5)", Math.round(k.promedio * 100) / 100],
      []
    ];
    const filasPct = [];
    RESPONDIBLES.filter(p => p.n > 2).forEach(p => {
      if (p.tipo === "parrafo") return;
      aoa.push([`${p.n}. ${p.titulo}`]);
      if (p.tipo === "escala") {
        aoa.push([`Valor (1 = ${p.anclas[0]}; 5 = ${p.anclas[1]})`, "Respuestas", "% de participantes"]);
        conteoEscala(filas).forEach(it => { filasPct.push(aoa.length); aoa.push([it.etiqueta, it.valor, n ? it.valor / n : 0]); });
      } else if (p.tipo === "multi") {
        aoa.push(["Opción", "Respuestas", "% de participantes"]);
        conteoMulti(p, filas).forEach(it => { filasPct.push(aoa.length); aoa.push([it.etiqueta, it.valor, n ? it.valor / n : 0]); });
      } else if (p.tipo === "matriz") {
        const c = conteoMatriz(p, filas);
        aoa.push(["Opción (personas que marcaron)", ...p.columnas.map(x => x.texto), "Algún rol"]);
        c.filas.forEach(f => aoa.push([f.texto, ...f.porCol, f.alguna]));
        aoa.push([p.ninguno, c.ninguno]);
      } else if (p.tipo === "matriz-numeros") {
        const s = sumasPersonas(filas);
        aoa.push(["Nivel (suma de personas)", ...p.columnas.map(x => x.texto), "Total"]);
        p.filas.forEach((f, i) => aoa.push([f.texto, ...s.celdas[i], s.celdas[i].reduce((a, b) => a + b, 0)]));
        aoa.push(["Total", ...s.porRol, s.total]);
      }
      aoa.push([]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    filasPct.forEach(r => {
      const celda = ws[XLSX.utils.encode_cell({ r, c: 2 })];
      if (celda) celda.z = "0%";
    });
    ws["!cols"] = [{ wch: 70 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 }];
    return ws;
  }

  async function descargarExcel() {
    if (!filtradas.length) return toast("No hay respuestas para descargar con los filtros actuales.");
    const btn = $("#excelBtn");
    btn.disabled = true;
    btn.replaceChildren(crear("span", { class: "girando" }), "Generando…");
    try {
      await cargarXLSX();
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, hojaRespuestas(filtradas), "Respuestas");
      XLSX.utils.book_append_sheet(wb, hojaResumen(filtradas), "Resumen");
      const hoy = new Date();
      const sello = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
      XLSX.writeFile(wb, `seguimiento-cpe-${sello}.xlsx`);
      toast(`Excel descargado con ${plural(filtradas.length, "respuesta", "respuestas")}.`);
    } catch (e) {
      toast("No se pudo generar el Excel. Revisa tu conexión e intenta de nuevo.");
    } finally {
      btn.disabled = false;
      btn.replaceChildren("Descargar Excel");
    }
  }

  // ---------- Varios ----------

  let relojToast;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(relojToast);
    relojToast = setTimeout(() => { t.hidden = true; }, 3500);
  }

  // ---------- Inicio ----------

  $("#ingresoForm").addEventListener("submit", e => {
    e.preventDefault();
    const c = $("#clave").value;
    if (c) ingresar(c, false);
  });
  $("#ingresoDemo").hidden = !API.demo;
  $("#ingresoIcono").innerHTML = ICONOS.candado;
  $("#verClave").addEventListener("click", e => {
    const input = $("#clave");
    const mostrar = input.type === "password";
    input.type = mostrar ? "text" : "password";
    e.currentTarget.textContent = mostrar ? "Ocultar" : "Mostrar";
    e.currentTarget.setAttribute("aria-pressed", String(mostrar));
    e.currentTarget.setAttribute("aria-label", mostrar ? "Ocultar contraseña" : "Mostrar contraseña");
    input.focus();
  });
  $("#fDesde").addEventListener("change", aplicarFiltros);
  $("#fHasta").addEventListener("change", aplicarFiltros);
  $("#limpiarBtn").addEventListener("click", () => {
    $("#fDesde").value = ""; $("#fHasta").value = "";
    aplicarFiltros();
  });
  $("#tabResumen").addEventListener("click", () => cambiarVista("resumen"));
  $("#tabIndividual").addEventListener("click", () => cambiarVista("individual"));
  $("#actualizarBtn").addEventListener("click", recargar);
  $("#excelBtn").addEventListener("click", descargarExcel);
  $("#salirBtn").addEventListener("click", salir);

  let guardada = "";
  try { guardada = sessionStorage.getItem(CLAVE_KEY) || ""; } catch (e) { }
  if (guardada) ingresar(guardada, true);
  else $("#clave").focus();
})();
