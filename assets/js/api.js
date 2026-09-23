// Comunicación con el backend (Apps Script). Sin SCRIPT_URL funciona en modo
// de prueba, guardando las respuestas en el localStorage de este navegador.

const API = (() => {
  const url = ((window.CONFIG && window.CONFIG.SCRIPT_URL) || "").trim();
  const demo = !url;
  const DEMO_KEY = "cpe-seguimiento-demo-v1";
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
    if (!demo) return post({ tipo: "seguimiento", ...campos });
    await pausa(500);
    const filas = leerDemo();
    const correo = campos.correo.toLowerCase();
    if (filas.some(f => String(f.correo).toLowerCase() === correo)) return { ok: false, error: "duplicado" };
    filas.push({ fecha: new Date().toISOString(), ...campos, correo });
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
    const nombres = ["Ana", "Luis", "Marta", "Jorge", "Paola", "Andrés", "Camila", "Diego", "Laura", "Felipe", "Sofía", "Carlos", "Valentina", "Julián", "Diana"];
    const apellidos = ["Gómez", "Rodríguez", "Martínez", "López", "Hernández", "Díaz", "Moreno", "Rojas", "Vargas", "Castro", "Ortiz", "Ramírez"];
    const apoyos = ["Más materiales listos para usar en aula.", "Acompañamiento en sitio durante las primeras sesiones.", "Tiempo institucional asignado para formar a colegas.", "Acceso a licencias de herramientas de IA.", "Una comunidad de práctica entre formadores.", "Guías para hablar de ética y datos con directivos."];
    const multi = p => {
      if (p.exclusiva && Math.random() < 0.12) return p.exclusiva;
      const opciones = p.opciones.filter(o => o !== p.exclusiva);
      const k = 1 + Math.floor(Math.random() * 3);
      return [...opciones].sort(() => Math.random() - 0.5).slice(0, k).sort((a, b) => opciones.indexOf(a) - opciones.indexOf(b)).join(SEPARADOR);
    };
    const P = Object.fromEntries(PREGUNTAS.map(p => [p.campo, p]));
    const filas = leerDemo();
    const ahora = Date.now();
    for (let i = 0; i < cantidad; i++) {
      const nombre = `${azar(nombres)} ${azar(apellidos)} ${azar(apellidos)}`;
      const correo = `${nombre.split(" ")[0].toLowerCase()}.${i}${Math.floor(Math.random() * 900 + 100)}@ejemplo.edu.co`
        .normalize("NFD").replace(/[̀-ͯ]/g, "");
      const trabajo = multi(P.trabajo_estudiantes);
      const contenidos = multi(P.contenidos_cpe);
      filas.push({
        fecha: new Date(ahora - Math.random() * 40 * 864e5).toISOString(),
        nombre, correo,
        departamento: azar(DEPARTAMENTOS.slice(0, 20)),
        transferencia: 1 + Math.floor(Math.random() * 5),
        contenidos_cpe: contenidos,
        contenido_cpe_otro: contenidos.includes("Otro") ? "Guía propia de la secretaría" : "",
        practicas_avanzadas: multi(P.practicas_avanzadas),
        personas_basico: Math.floor(Math.random() * 40),
        personas_intermedio: Math.floor(Math.random() * 20),
        personas_avanzado: Math.floor(Math.random() * 8),
        trabajo_estudiantes: trabajo,
        trabajo_estudiantes_otro: trabajo.includes("Otro") ? "Semillero de robótica" : "",
        estudiantes_alcanzados: trabajo === "Todavía no" ? 0 : Math.floor(Math.random() * 180),
        barreras: multi(P.barreras),
        apoyo: azar(apoyos)
      });
    }
    guardarDemo(filas);
  }

  const borrarDemo = () => { try { localStorage.removeItem(DEMO_KEY); } catch (e) { } };

  return { demo, enviar, respuestas, cargarEjemplos, borrarDemo };
})();
