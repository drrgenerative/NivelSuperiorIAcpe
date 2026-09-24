// Comunicación con el backend (Apps Script). Sin SCRIPT_URL funciona en modo
// de prueba, guardando las respuestas en el localStorage de este navegador.

const API = (() => {
  const url = ((window.CONFIG && window.CONFIG.SCRIPT_URL) || "").trim();
  const demo = !url;
  const DEMO_KEY = "cpe-seguimiento-demo-v2";
  const DEMO_CLAVE = "demo";
  const pausa = ms => new Promise(r => setTimeout(r, ms));

  async function post(params) {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), 30000);
    try {
      // Cuerpo form-urlencoded = petición "simple": Apps Script responde con CORS abierto.
      const r = await fetch(url, { method: "POST", body: new URLSearchParams(params), signal: control.signal });
      if (!r.ok) throw new Error("http_" + r.status);
      return await r.json();
    } finally {
      clearTimeout(reloj);
    }
  }

  const leerDemo = () => { try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || []; } catch (e) { return []; } };
  const guardarDemo = filas => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(filas)); } catch (e) { } };

  async function enviar(campos) {
    // _orden le dice al backend qué columnas debe tener la hoja y en qué orden.
    const orden = COLUMNAS.map(c => c.campo).filter(c => c !== "fecha").join(",");
    if (!demo) return post({ tipo: "seguimiento", _orden: orden, ...campos });
    await pausa(500);
    const filas = leerDemo();
    if (filas.some(f => String(f.cedula) === campos.cedula)) return { ok: false, error: "duplicado" };
    filas.push({ fecha: new Date().toISOString(), ...campos });
    guardarDemo(filas);
    return { ok: true };
  }

  async function respuestas(clave) {
    if (!demo) return post({ accion: "respuestas", clave });
    await pausa(250);
    return clave === DEMO_CLAVE ? { ok: true, filas: leerDemo() } : { ok: false, error: "clave" };
  }

  // Solo modo de prueba: datos ficticios para ver el panel con contenido.
  function cargarEjemplos(cantidad = 30) {
    const azar = arr => arr[Math.floor(Math.random() * arr.length)];
    const entre = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const nombres = ["Ana", "Luis", "Marta", "Jorge", "Paola", "Andrés", "Camila", "Diego", "Laura", "Felipe", "Sofía", "Carlos", "Valentina", "Julián", "Diana"];
    const apellidos = ["Gómez", "Rodríguez", "Martínez", "López", "Hernández", "Díaz", "Moreno", "Rojas", "Vargas", "Castro", "Ortiz", "Ramírez"];
    const apoyos = ["Más materiales listos para usar en aula.", "Acompañamiento en sitio durante las primeras sesiones.", "Tiempo institucional asignado para formar a colegas.", "Acceso a licencias de herramientas de IA.", "Una comunidad de práctica entre formadores.", "Guías para hablar de ética y datos con directivos."];
    const filas = leerDemo();
    const ahora = Date.now();
    for (let i = 0; i < cantidad; i++) {
      const f = {
        fecha: new Date(ahora - Math.random() * 40 * 864e5).toISOString(),
        nombre: `${azar(nombres)} ${azar(apellidos)} ${azar(apellidos)}`,
        cedula: String(entre(10000000, 1099999999))
      };
      RESPONDIBLES.forEach(p => {
        if (p.tipo === "escala") f[p.campo] = entre(1, 5);
        else if (p.tipo === "multi") {
          f[p.campo] = p.opciones.filter(() => Math.random() < 0.3).join(SEPARADOR) || p.opciones[0];
          if (p.otro) f[p.otro.campo] = f[p.campo].includes(p.otro.opcion) ? azar(["Rotación de docentes", "Carga administrativa", "Falta de energía eléctrica"]) : "";
        }
        else if (p.tipo === "parrafo") f[p.campo] = azar(apoyos);
        else if (p.tipo === "consentimiento") f[p.campo] = p.opcion;
        else if (p.tipo === "matriz-numeros") {
          p.filas.forEach((fi, k) => p.columnas.forEach(c => {
            const tope = { directivos: 6, docentes: 30, estudiantes: 120 }[c.id] || 10;
            f[campoCelda(p, fi, c)] = Math.random() < 0.3 ? 0 : entre(0, Math.round(tope / (k + 1)));
          }));
        } else if (p.tipo === "matriz") {
          const ninguno = Math.random() < 0.12;
          f[campoNinguno(p)] = ninguno ? "Sí" : "";
          p.filas.forEach(fi => {
            f[campoFila(p, fi)] = ninguno ? "" : p.columnas.filter(() => Math.random() < 0.35).map(c => c.texto).join(SEPARADOR);
          });
        }
      });
      filas.push(f);
    }
    guardarDemo(filas);
  }

  const borrarDemo = () => { try { localStorage.removeItem(DEMO_KEY); } catch (e) { } };

  return { demo, enviar, respuestas, cargarEjemplos, borrarDemo };
})();
