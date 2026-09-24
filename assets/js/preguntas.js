// Definición única del cuestionario. El formulario se dibuja a partir de aquí y
// el panel la usa para resumir y exportar. Para cambiar una pregunta u opción se
// edita solo este archivo: el backend crea solo las columnas nuevas en la hoja.
// Ojo: cambiar un `campo` o un `id` existente crea una columna nueva (la vieja
// queda en la hoja con los datos anteriores).

const SEPARADOR = " | "; // cómo se guardan varias selecciones en una celda

const ROLES = [
  { id: "directivos", texto: "Directivos" },
  { id: "docentes", texto: "Docentes" },
  { id: "estudiantes", texto: "Estudiantes" }
];

const PREGUNTAS = [
  { n: 1, seccion: "Identificación", tipo: "texto", campo: "nombre", corto: "Nombre completo", titulo: "Nombre completo", max: 120, autocomplete: "name" },
  { n: 2, tipo: "cedula", campo: "cedula", corto: "Número de cédula", titulo: "Número de cédula", ayuda: "Solo números, sin puntos ni espacios." },

  {
    n: 3, seccion: "Aplicación", tipo: "escala", campo: "transferencia", corto: "Aplicación de lo aprendido (1-5)",
    titulo: "Desde el taller, ¿cuánto has logrado aplicar lo aprendido en tu trabajo?",
    anclas: ["Todavía no lo he aplicado", "Lo he incorporado frecuentemente"],
  },

  {
    n: 4, seccion: "Uso de los contenidos de CPE", tipo: "matriz", campo: "contenidos_cpe", corto: "Contenidos CPE",
    titulo: "¿Qué contenidos de IA creados por Computadores para Educar has utilizado para formar o acompañar a directivos, docentes o estudiantes?",
    ayuda: "En cada contenido, marca con quién lo has utilizado. Puedes marcar varias columnas por fila.",
    columnas: ROLES,
    filas: [
      { id: "maquinas", texto: "Máquinas que aprenden", grupo: "Nivel básico" },
      { id: "etica_uso", texto: "IA ética y uso responsable", grupo: "Nivel básico" },
      { id: "detras_chat", texto: "Detrás del chat", grupo: "Nivel básico" },
      { id: "proyecto_final", texto: "Proyecto final", grupo: "Nivel básico" },
      { id: "prompts", texto: "Ingeniería de prompts pedagógicos", grupo: "Nivel intermedio" },
      { id: "analisis_critico", texto: "Análisis crítico y ética de la IA", grupo: "Nivel intermedio" },
      { id: "curriculo", texto: "IA aplicada al currículo", grupo: "Nivel intermedio" },
      { id: "arquitecturas", texto: "Arquitecturas de IA contextualizada", grupo: "Nivel avanzado" },
      { id: "multimodalidad", texto: "Multimodalidad e inclusión educativa", grupo: "Nivel avanzado" },
      { id: "gobernanza", texto: "Gobernanza, liderazgo e integración curricular", grupo: "Nivel avanzado" }
    ],
    ninguno: "Todavía no he utilizado ninguno de estos contenidos"
  },

  {
    n: 5, seccion: "Transferencia de la formación superior", tipo: "matriz", campo: "practicas_avanzadas", corto: "Componentes avanzados",
    titulo: "¿Qué componentes de esta formación superior has puesto en práctica y con quién?",
    ayuda: "En cada componente, marca con quién lo has puesto en práctica. Puedes marcar varias columnas por fila.",
    columnas: ROLES,
    filas: [
      { id: "recuperacion", texto: "Práctica de recuperación o aprendizaje activo" },
      { id: "marcos", texto: "Uso de marcos de competencias de IA" },
      { id: "agencia", texto: "Diseño de actividades con agencia epistémica" },
      { id: "asistente", texto: "Configuración y prueba de un asistente con instrucciones y base de conocimiento" },
      { id: "workspace", texto: "Workspace con contexto persistente y relevo entre chats" }
    ],
    ninguno: "Todavía no he puesto en práctica ninguno de estos componentes"
  },

  {
    n: 6, seccion: "Alcance", tipo: "matriz-numeros", campo: "personas", corto: "Personas formadas",
    titulo: "Aproximadamente, ¿cuántas personas has formado o acompañado en el uso de IA desde la formación de nivel superior?",
    ayuda: "Indica el número por nivel y por rol. Registra cero (0) si no aplica. Para evitar dobles conteos, registra a cada persona una sola vez, en el nivel más avanzado que alcanzó. Por ejemplo: Si formaste a la profe Ana en nivel básico y luego en nivel intermedio, solo cuéntala en el nivel intermedio.",
    columnas: ROLES,
    filas: [
      { id: "basico", texto: "Nivel básico" },
      { id: "intermedio", texto: "Nivel intermedio" },
      { id: "avanzado", texto: "Nivel avanzado" }
    ],
    max: 99999
  },

  {
    n: 7, seccion: "Actividades y talleres", tipo: "matriz", campo: "actividades", corto: "Actividades y talleres",
    titulo: "Desde la formación de nivel superior, ¿qué actividades o talleres sobre IA has desarrollado y con quién?",
    ayuda: "En cada tipo de actividad, marca con quién la has desarrollado. Puedes marcar varias columnas por fila.",
    columnas: ROLES,
    filas: [
      { id: "aula", texto: "Actividades de aula con IA" },
      { id: "talleres_propia", texto: "Talleres en mi institución educativa" },
      { id: "talleres_otras", texto: "Talleres en otras instituciones educativas" },
      { id: "mentoria", texto: "Acompañamiento o mentoría individual" },
      { id: "presentacion", texto: "Presentación en espacio institucional (consejo académico, comité, reunión de área, equipo docente)" },
      { id: "materiales", texto: "Creación y difusión de materiales o recursos (guías, tutoriales, bancos de prompts)" },
      { id: "proyectos", texto: "Proyectos o experiencias institucionales con IA" },
      { id: "comunidades", texto: "Intercambio de experiencias o comunidades de aprendizaje sobre IA" }
    ],
    ninguno: "Todavía no he desarrollado actividades ni talleres sobre IA"
  },

  {
    n: 8, seccion: "Barreras y apoyo", tipo: "multi", campo: "barreras", corto: "Barreras",
    titulo: "¿Qué barreras has encontrado?",
    ayuda: "Puedes seleccionar varias.",
    opciones: ["Tiempo", "Conectividad o equipos", "Acceso a herramientas o licencias", "Políticas o autorizaciones institucionales", "Protección de datos", "Falta de materiales o acompañamiento", "Resistencia o baja participación", "Todavía no he tenido oportunidad", "Otra"],
    otro: { opcion: "Otra", campo: "barreras_otra", etiqueta: "¿Cuál otra barrera has encontrado?" }
  },
  {
    n: 9, tipo: "parrafo", campo: "apoyo", corto: "Apoyo que ayudaría", max: 1000,
    titulo: "¿Qué apoyos te ayudarían a avanzar en el acompañamiento de tu comunidad para que sea más competente en el uso de la IA?"
  },
  {
    n: 10, tipo: "parrafo", campo: "propuestas_tpa", corto: "Propuestas para TPA", max: 1000,
    titulo: "¿Qué crees que podríamos implementar desde Tecnologías para Aprender para responder a las necesidades de las comunidades educativas locales?"
  },

  // Obligatoria para enviar. Se guarda como constancia ("Sí, acepto") con la fecha del envío.
  {
    n: 11, seccion: "Tratamiento de datos", tipo: "consentimiento", campo: "autorizacion_datos", corto: "Autorización de tratamiento de datos",
    titulo: "Autorización para el Tratamiento de Datos",
    texto: [
      "Al enviar esta encuesta, usted está aceptando la política de tratamiento de datos de Computadores para Educar y autoriza la recolección y el tratamiento de sus datos personales, incluyendo la información proporcionada en este formulario, para los fines allí establecidos. Si desea consultarla, ingrese a este link: ",
      { url: "https://www.computadoresparaeducar.gov.co/publicaciones/66/politicas-y-condiciones-de-uso/", texto: "computadoresparaeducar.gov.co/publicaciones/66/politicas-y-condiciones-de-uso", externo: true },
      ". Cualquier duda, comuníquese con la línea gratuita ",
      { url: "tel:018000919275", texto: "01-8000-919-275" },
      " o escríbanos a ",
      { url: "mailto:info@cpe.gov.co", texto: "info@cpe.gov.co" },
      "."
    ],
    opcion: "Sí, acepto"
  },

  // Tarjeta informativa: no es pregunta, no es obligatoria y no se guarda.
  {
    n: 12, seccion: "Comparte tu experiencia", tipo: "enlace",
    titulo: "Comparte tus experiencias en el Padlet",
    texto: "Te invitamos a compartir en el Padlet lo que has hecho después del taller: tus ejemplos, recursos o fotos de las actividades. Así otros formadores pueden conocer tu experiencia y aprender de ella.",
    url: "https://padlet.com/nando24/taller-ia-nivel-superior-formador-de-formadores-mri6rkz61qiy2cb3",
    boton: "Abrir el Padlet"
  }
];

// Solo lo que se responde (excluye tarjetas informativas como la del Padlet).
const RESPONDIBLES = PREGUNTAS.filter(p => p.tipo !== "enlace");
const PADLET = PREGUNTAS.find(p => p.tipo === "enlace");

// Nombres de columna de las matrices.
const campoFila = (p, fila) => `${p.campo}__${fila.id}`;
const campoCelda = (p, fila, col) => `${p.campo}__${fila.id}__${col.id}`;
const campoNinguno = p => `${p.campo}__ninguno`;

// Columnas de la hoja y del Excel, en orden (se derivan de PREGUNTAS).
const COLUMNAS = (() => {
  const cols = [{ campo: "fecha", etiqueta: "Fecha de envío", ancho: 17, tipo: "fecha" }];
  RESPONDIBLES.forEach(p => {
    const pre = p.n > 2 ? `${p.n}. ${p.corto}` : p.corto;
    switch (p.tipo) {
      case "matriz":
        p.filas.forEach(f => cols.push({ campo: campoFila(p, f), etiqueta: `${pre} · ${f.texto}`, ancho: 26, tipo: "multi" }));
        cols.push({ campo: campoNinguno(p), etiqueta: `${pre} · Ninguno todavía`, ancho: 14 });
        break;
      case "matriz-numeros":
        p.filas.forEach(f => p.columnas.forEach(c =>
          cols.push({ campo: campoCelda(p, f, c), etiqueta: `${pre} · ${f.texto} · ${c.texto}`, ancho: 14, tipo: "numero" })));
        break;
      case "escala": cols.push({ campo: p.campo, etiqueta: pre, ancho: 14, tipo: "numero" }); break;
      case "multi":
        cols.push({ campo: p.campo, etiqueta: pre, ancho: 44, tipo: "multi" });
        if (p.otro) cols.push({ campo: p.otro.campo, etiqueta: `${pre} · ${p.otro.opcion} (cuál)`, ancho: 30 });
        break;
      case "parrafo": cols.push({ campo: p.campo, etiqueta: pre, ancho: 60 }); break;
      default: cols.push({ campo: p.campo, etiqueta: pre, ancho: p.tipo === "cedula" ? 16 : 28 });
    }
  });
  return cols;
})();
