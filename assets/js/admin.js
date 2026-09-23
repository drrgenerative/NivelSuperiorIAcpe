// Panel de administración: ingreso, resumen, vista individual y exportación a Excel.

(() => {
  "use strict";

  const CLAVE_KEY = "cpe-admin-clave";
  const XLSX_URL = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
  const P = Object.fromEntries(PREGUNTAS.map(p => [p.n, p]));
  const MULTI = PREGUNTAS.filter(p => p.tipo === "multi");
  const NUMERICOS = COLUMNAS.filter(c => c.tipo === "numero").map(c => c.campo);
  const TEXTOS = COLUMNAS.filter(c => !c.tipo).map(c => c.campo);
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

  // ---------- Datos ----------

  function normalizar(f, i) {
    const fecha = new Date(f.fecha);
    const r = { _id: i, fecha: isNaN(fecha) ? null : fecha, _listas: {} };
    TEXTOS.forEach(c => { r[c] = String(f[c] ?? "").trim(); });
    NUMERICOS.forEach(c => { r[c] = Number(f[c]) || 0; });
    MULTI.forEach(p => {
      r._listas[p.campo] = String(f[p.campo] ?? "").split(SEPARADOR).map(s => s.trim()).filter(Boolean);
    });
    return r;
  }

  const conActividadEstudiantes = f => {
    const l = f._listas.trabajo_estudiantes;
    return l.length > 0 && !l.includes(P[8].exclusiva);
  };

  function indicadores(filas) {
    const suma = c => filas.reduce((s, f) => s + f[c], 0);
    const basico = suma("personas_basico"), intermedio = suma("personas_intermedio"), avanzado = suma("personas_avanzado");
    const conEscala = filas.filter(f => f.transferencia > 0);
    return {
      respuestas: filas.length,
      departamentos: new Set(filas.map(f => f.departamento).filter(Boolean)).size,
      basico, intermedio, avanzado,
      formados: basico + intermedio + avanzado,
      estudiantes: suma("estudiantes_alcanzados"),
      conEstudiantes: filas.filter(conActividadEstudiantes).length,
      promedio: conEscala.length ? conEscala.reduce((s, f) => s + f.transferencia, 0) / conEscala.length : 0
    };
  }

  const conteoMulti = (p, filas) =>
    p.opciones.map(o => ({ etiqueta: o, valor: filas.filter(f => f._listas[p.campo].includes(o)).length }));

  const conteoEscala = filas =>
    [1, 2, 3, 4, 5].map(v => ({ etiqueta: String(v), valor: filas.filter(f => f.transferencia === v).length }));

  function conteoDepartamentos(filas) {
    const m = new Map();
    filas.forEach(f => m.set(f.departamento || "(sin dato)", (m.get(f.departamento || "(sin dato)") || 0) + 1));
    return [...m].map(([etiqueta, valor]) => ({ etiqueta, valor }))
      .sort((a, b) => b.valor - a.valor || a.etiqueta.localeCompare(b.etiqueta, "es"));
  }

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
    llenarDepartamentos();
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
      toast(`Datos actualizados: ${fmtNum(todas.length)} respuestas.`);
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

  function llenarDepartamentos() {
    const s = $("#fDepto");
    const actual = s.value;
    const conteo = conteoDepartamentos(todas).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
    s.replaceChildren(crear("option", { value: "" }, "Todos"),
      ...conteo.map(d => crear("option", { value: d.etiqueta }, `${d.etiqueta} (${d.valor})`)));
    s.value = conteo.some(d => d.etiqueta === actual) ? actual : "";
  }

  function aplicarFiltros() {
    const depto = $("#fDepto").value;
    const desde = $("#fDesde").value ? new Date($("#fDesde").value + "T00:00:00") : null;
    const hasta = $("#fHasta").value ? new Date($("#fHasta").value + "T23:59:59.999") : null;
    filtradas = todas.filter(f =>
      (!depto || f.departamento === depto) &&
      (!desde || (f.fecha && f.fecha >= desde)) &&
      (!hasta || (f.fecha && f.fecha <= hasta)));
    $("#cuenta").replaceChildren(crear("strong", {}, fmtNum(filtradas.length)),
      filtradas.length === todas.length ? " respuestas" : ` de ${fmtNum(todas.length)} respuestas`);
    render();
  }

  function descripcionFiltros() {
    const partes = [];
    if ($("#fDepto").value) partes.push(`Departamento: ${$("#fDepto").value}`);
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
      kpi("Respuestas", fmtNum(k.respuestas), `${fmtNum(k.departamentos)} ${k.departamentos === 1 ? "departamento" : "departamentos"}`, "var(--purple)"),
      kpi("Directivos y docentes formados", fmtNum(k.formados), "suma de los tres niveles", "var(--orange)"),
      kpi("Estudiantes alcanzados", fmtNum(k.estudiantes), `${fmtNum(k.conEstudiantes)} formadores con actividades`, "var(--cyan)"),
      kpi("Aplicación de lo aprendido", [fmtDec(k.promedio), crear("small", {}, " / 5")], "promedio de la escala", "var(--yellow)")
    ]));

    const metaMulti = `${fmtNum(n)} respuestas · selección múltiple: los porcentajes pueden sumar más de 100%`;
    const p8 = P[8];

    v.append(crear("div", { class: "rejilla" }, [
      tarjeta(P[4], `${fmtNum(n)} respuestas · promedio ${fmtDec(k.promedio)}`, columnasEscala(conteoEscala(filtradas), n)),
      tarjeta(P[7], "Suma de lo reportado por todos los formadores", cifrasNiveles(k)),
      tarjeta(P[3], `${fmtNum(k.departamentos)} departamentos con respuestas`, barras(conteoDepartamentos(filtradas), n, "barras--2col"), true),
      tarjeta(P[5], metaMulti, [barras(conteoMulti(P[5], filtradas), n), desplegableOtros(P[5])]),
      tarjeta(P[6], metaMulti, barras(conteoMulti(P[6], filtradas), n)),
      tarjeta(p8, `${metaMulti}`, [
        barras(conteoMulti(p8, filtradas), n),
        crear("p", { class: "extra" }, ["Estudiantes que han participado: ", crear("strong", {}, fmtNum(k.estudiantes)),
          ` (reportados por ${fmtNum(k.conEstudiantes)} ${k.conEstudiantes === 1 ? "formador" : "formadores"})`]),
        desplegableOtros(p8)
      ]),
      tarjeta(P[9], metaMulti, barras(conteoMulti(P[9], filtradas), n)),
      tarjeta(P[10], `${fmtNum(filtradas.filter(f => f.apoyo).length)} respuestas abiertas`, textos(filtradas, "apoyo"), true)
    ]));
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

  function columnasEscala(items, total) {
    const max = Math.max(1, ...items.map(i => i.valor));
    return crear("div", {}, [
      crear("div", { class: "columnas" }, items.map(it => crear("div", {
        class: "columna", title: `${it.etiqueta}: ${fmtNum(it.valor)} respuestas (${fmtPct(total ? it.valor / total * 100 : 0)})`
      }, [
        crear("span", { class: "columna__val" }, fmtNum(it.valor)),
        crear("div", { class: "columna__barra", style: `height:calc((100% - 24px) * ${it.valor / max})` })
      ]))),
      crear("div", { class: "columnas__eje" }, items.map(it => crear("span", {}, it.etiqueta))),
      crear("div", { class: "columnas__anclas" }, P[4].anclas.map(a => crear("span", {}, a)))
    ]);
  }

  function cifrasNiveles(k) {
    const niveles = [
      { etiqueta: "Nivel básico", valor: k.basico },
      { etiqueta: "Nivel intermedio", valor: k.intermedio },
      { etiqueta: "Nivel avanzado", valor: k.avanzado }
    ];
    return [
      crear("div", { class: "cifras" }, [
        ...niveles.map(nv => crear("div", { class: "cifra" }, [crear("div", { class: "cifra__etq" }, nv.etiqueta), crear("div", { class: "cifra__valor" }, fmtNum(nv.valor))])),
        crear("div", { class: "cifra cifra--total" }, [crear("div", { class: "cifra__etq" }, "Total"), crear("div", { class: "cifra__valor" }, fmtNum(k.formados))])
      ]),
      barras(niveles, k.formados)
    ];
  }

  function textos(filas, campo) {
    const con = filas.filter(f => f[campo]);
    if (!con.length) return crear("p", { class: "tarjeta__meta" }, "Sin respuestas.");
    return crear("div", { class: "textos" }, con.map(f => crear("div", { class: "texto" }, [
      crear("div", {}, f[campo]),
      crear("div", { class: "texto__quien" }, `${f.nombre} · ${f.departamento}`)
    ])));
  }

  function desplegableOtros(p) {
    const cuantos = filtradas.filter(f => f[p.otro.campo]).length;
    if (!cuantos) return null;
    return crear("details", { class: "desplegable" }, [
      crear("summary", {}, `Ver respuestas "Otro" (${cuantos})`),
      textos(filtradas, p.otro.campo)
    ]);
  }

  // ----- Individual -----

  function renderIndividual() {
    const v = $("#vistaIndividual");
    v.replaceChildren();
    if (sinDatos(v)) return;

    const items = crear("div", { class: "lista__items" });
    const detalle = crear("div", { class: "detalle" });
    const buscador = crear("input", {
      type: "search", placeholder: "Buscar por nombre o correo", "aria-label": "Buscar respuesta",
      oninput: e => { busqueda = e.target.value; actualizar(); }
    });
    buscador.value = busqueda;
    v.append(crear("div", { class: "individual" }, [
      crear("aside", { class: "lista" }, [crear("div", { class: "lista__buscar" }, buscador), items]),
      detalle
    ]));

    const visibles = () => {
      const q = busqueda.trim().toLowerCase();
      return q ? filtradas.filter(f => `${f.nombre} ${f.correo}`.toLowerCase().includes(q)) : filtradas;
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
          crear("div", { class: "lista__detalle" }, `${f.departamento} · ${f.fecha ? fmtFechaCorta(f.fecha) : "sin fecha"}`)
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
          crear("span", {}, f.correo), crear("span", {}, f.departamento),
          crear("span", {}, f.fecha ? fmtFecha(f.fecha) : "sin fecha")
        ])
      ]),
      crear("div", { class: "detalle__nav" }, [
        crear("button", { class: "btn btn--chico", type: "button", disabled: idx === 0, onclick: () => ir(lista[idx - 1]._id) }, "‹ Anterior"),
        crear("span", {}, `${idx + 1} de ${lista.length}`),
        crear("button", { class: "btn btn--chico", type: "button", disabled: idx === lista.length - 1, onclick: () => ir(lista[idx + 1]._id) }, "Siguiente ›")
      ])
    ]);
    const respuestas = PREGUNTAS.filter(p => p.n > 3).map(p => crear("div", { class: "resp" }, [
      crear("h3", {}, [crear("span", { class: "tarjeta__num" }, String(p.n)), crear("span", {}, p.titulo)]),
      crear("div", { class: "resp__cuerpo" }, cuerpoRespuesta(p, f))
    ]));
    return [cab, ...respuestas];
  }

  function cuerpoRespuesta(p, f) {
    switch (p.tipo) {
      case "escala":
        return [
          crear("div", { class: "escala-ver" }, [1, 2, 3, 4, 5].map(v => crear("span", { class: f.transferencia === v ? "si" : null }, String(v)))),
          crear("p", { class: "extra" }, f.transferencia ? `${f.transferencia} de 5` : "Sin respuesta")
        ];
      case "multi": {
        const elegidas = f._listas[p.campo];
        const fuera = elegidas.filter(o => !p.opciones.includes(o)); // valores de versiones anteriores
        const op = (o, si) => crear("span", { class: "op" + (si ? " op--si" : "") }, [crear("span", { class: "op__marca", html: ICONOS.check }), o]);
        return [
          crear("div", { class: "opciones" }, [...p.opciones.map(o => op(o, elegidas.includes(o))), ...fuera.map(o => op(o, true))]),
          p.otro && f[p.otro.campo] && crear("p", { class: "extra" }, ["Otro: ", crear("strong", {}, f[p.otro.campo])]),
          p.conteo && crear("p", { class: "extra" }, ["Estudiantes que han participado: ", crear("strong", {}, fmtNum(f[p.conteo.campo]))])
        ];
      }
      case "numeros": {
        const total = p.campos.reduce((s, c) => s + f[c.campo], 0);
        return crear("div", { class: "cifras" }, [
          ...p.campos.map(c => crear("div", { class: "cifra" }, [crear("div", { class: "cifra__etq" }, c.etiqueta), crear("div", { class: "cifra__valor" }, fmtNum(f[c.campo]))])),
          crear("div", { class: "cifra cifra--total" }, [crear("div", { class: "cifra__etq" }, "Total"), crear("div", { class: "cifra__valor" }, fmtNum(total))])
        ]);
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
      ["Departamentos con respuestas", k.departamentos],
      ["Directivos y docentes formados (total)", k.formados],
      ["   Nivel básico", k.basico],
      ["   Nivel intermedio", k.intermedio],
      ["   Nivel avanzado", k.avanzado],
      ["Estudiantes alcanzados", k.estudiantes],
      ["Formadores con actividades con estudiantes", k.conEstudiantes],
      ["Aplicación de lo aprendido (promedio 1 a 5)", Math.round(k.promedio * 100) / 100],
      []
    ];
    const filasPct = [];
    const bloque = (titulo, items, nota) => {
      aoa.push([titulo]);
      aoa.push(["Opción", "Respuestas", nota || "% de participantes"]);
      items.forEach(it => { filasPct.push(aoa.length); aoa.push([it.etiqueta, it.valor, n ? it.valor / n : 0]); });
      aoa.push([]);
    };
    bloque(`3. ${P[3].titulo}`, conteoDepartamentos(filas));
    bloque(`4. ${P[4].titulo} (1 = ${P[4].anclas[0]}; 5 = ${P[4].anclas[1]})`, conteoEscala(filas));
    [P[5], P[6], P[8], P[9]].forEach(p => bloque(`${p.n}. ${p.titulo}`, conteoMulti(p, filas), "% de participantes (selección múltiple)"));

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    filasPct.forEach(r => {
      const celda = ws[XLSX.utils.encode_cell({ r, c: 2 })];
      if (celda) celda.z = "0%";
    });
    ws["!cols"] = [{ wch: 70 }, { wch: 14 }, { wch: 22 }];
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
      toast(`Excel descargado con ${fmtNum(filtradas.length)} respuestas.`);
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
  $("#fDepto").addEventListener("change", aplicarFiltros);
  $("#fDesde").addEventListener("change", aplicarFiltros);
  $("#fHasta").addEventListener("change", aplicarFiltros);
  $("#limpiarBtn").addEventListener("click", () => {
    $("#fDepto").value = ""; $("#fDesde").value = ""; $("#fHasta").value = "";
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
