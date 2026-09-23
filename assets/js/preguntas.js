// Definición única del cuestionario. El formulario se dibuja a partir de aquí y
// el panel la usa para resumir y exportar. Para cambiar una pregunta u opción,
// se edita solo este archivo (y, si cambia un `campo`, también Code.gs).

const DEPARTAMENTOS = ["Amazonas", "Antioquia", "Arauca", "Atlántico", "Bogotá, D. C.", "Bolívar", "Boyacá", "Caldas", "Caquetá", "Casanare", "Cauca", "Cesar", "Chocó", "Córdoba", "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira", "Magdalena", "Meta", "Nariño", "Norte de Santander", "Putumayo", "Quindío", "Risaralda", "San Andrés y Providencia", "Santander", "Sucre", "Tolima", "Valle del Cauca", "Vaupés", "Vichada"];

const SEPARADOR = " | "; // cómo se guardan las respuestas de selección múltiple

const PREGUNTAS = [
  { n: 1, seccion: "Identificación", tipo: "texto", campo: "nombre", titulo: "Nombre completo", max: 120, autocomplete: "name" },
  { n: 2, tipo: "correo", campo: "correo", titulo: "Correo usado en el registro", max: 160, autocomplete: "email" },
  { n: 3, tipo: "lista", campo: "departamento", titulo: "Departamento", opciones: DEPARTAMENTOS },

  {
    n: 4, seccion: "Aplicación", tipo: "escala", campo: "transferencia",
    titulo: "Desde el taller, ¿cuánto has logrado aplicar lo aprendido?",
    anclas: ["Todavía no lo he aplicado", "Lo he incorporado en mi trabajo"]
  },

  {
    n: 5, seccion: "Formación y acompañamiento a directivos y docentes", tipo: "multi", campo: "contenidos_cpe",
    titulo: "¿Qué contenidos de IA creados por Computadores para Educar has utilizado para formar o acompañar a otras/os directivos o docentes?",
    ayuda: "Puedes seleccionar varios.",
    opciones: ["Máquinas que aprenden", "IA ética y uso responsable", "Detrás del chat", "Proyecto final", "Ingeniería de prompts pedagógicos", "Análisis crítico y ética de la IA", "IA aplicada al currículo", "Arquitecturas de IA contextualizada", "Multimodalidad e inclusión educativa", "Gobernanza, liderazgo e integración curricular", "Otro", "Todavía ninguno"],
    exclusiva: "Todavía ninguno",
    otro: { opcion: "Otro", campo: "contenido_cpe_otro" }
  },

  {
    n: 6, seccion: "Transferencia de la formación avanzada", tipo: "multi", campo: "practicas_avanzadas",
    titulo: "¿Qué componentes de esta formación avanzada has puesto en práctica?",
    ayuda: "Puedes seleccionar varios.",
    opciones: ["Práctica de recuperación o aprendizaje activo", "Uso de marcos de competencias de IA", "Diseño de actividades con agencia epistémica", "Configuración y prueba de un asistente con instrucciones y base de conocimiento", "Workspace con contexto persistente y relevo entre chats", "Todavía ninguna"],
    exclusiva: "Todavía ninguna"
  },

  {
    n: 7, seccion: "Alcance", tipo: "numeros",
    titulo: "Aproximadamente ¿Cuántos directivos o docentes has formado o acompañado en el uso de IA, desde el nivel superior?",
    ayuda: "Indica el número correspondiente a cada nivel. Registra 0 si no has realizado formación en alguno. Para evitar dobles conteos, ubica cada directivo o docente únicamente en el nivel más avanzado alcanzado.",
    max: 99999,
    campos: [
      { campo: "personas_basico", etiqueta: "Nivel básico" },
      { campo: "personas_intermedio", etiqueta: "Nivel intermedio" },
      { campo: "personas_avanzado", etiqueta: "Nivel avanzado" }
    ]
  },

  {
    n: 8, seccion: "Trabajo directo con estudiantes", tipo: "multi", campo: "trabajo_estudiantes",
    titulo: "Desde la formación de nivel superior, ¿has desarrollado actividades o talleres sobre IA directamente con estudiantes?",
    ayuda: "Puedes seleccionar varias opciones.",
    opciones: ["Sí, en actividades de aula con mis estudiantes", "Sí, en talleres para estudiantes de mi institución educativa", "Sí, en talleres para estudiantes de otras instituciones educativas", "Otro", "Todavía no"],
    exclusiva: "Todavía no",
    otro: { opcion: "Otro", campo: "trabajo_estudiantes_otro" },
    conteo: {
      campo: "estudiantes_alcanzados", max: 999999,
      etiqueta: "Aproximadamente, ¿cuántos estudiantes han participado en total?",
      ayuda: "Cuenta cada estudiante una sola vez."
    }
  },

  {
    n: 9, seccion: "Continuidad", tipo: "multi", campo: "barreras",
    titulo: "¿Qué barreras has encontrado?",
    ayuda: "Puedes seleccionar varias.",
    opciones: ["Tiempo", "Conectividad o equipos", "Acceso a herramientas o licencias", "Políticas o autorizaciones institucionales", "Protección de datos", "Falta de materiales o acompañamiento", "Resistencia o baja participación", "Todavía no he tenido oportunidad", "Otra"]
  },
  {
    n: 10, tipo: "parrafo", campo: "apoyo", max: 1000,
    titulo: "¿Qué apoyo te ayudaría a avanzar en el acompañamiento de tu comunidad para que sea más competente en el uso de la IA?"
  }
];

// Columnas de la hoja y del Excel exportado, en orden.
const COLUMNAS = [
  { campo: "fecha", etiqueta: "Fecha de envío", ancho: 17, tipo: "fecha" },
  { campo: "nombre", etiqueta: "Nombre completo", ancho: 28 },
  { campo: "correo", etiqueta: "Correo", ancho: 30 },
  { campo: "departamento", etiqueta: "Departamento", ancho: 18 },
  { campo: "transferencia", etiqueta: "Aplicación de lo aprendido (1-5)", ancho: 14, tipo: "numero" },
  { campo: "contenidos_cpe", etiqueta: "Contenidos CPE utilizados", ancho: 50, tipo: "multi" },
  { campo: "contenido_cpe_otro", etiqueta: "Contenidos CPE: otro", ancho: 24 },
  { campo: "practicas_avanzadas", etiqueta: "Componentes avanzados aplicados", ancho: 50, tipo: "multi" },
  { campo: "personas_basico", etiqueta: "Formados nivel básico", ancho: 12, tipo: "numero" },
  { campo: "personas_intermedio", etiqueta: "Formados nivel intermedio", ancho: 12, tipo: "numero" },
  { campo: "personas_avanzado", etiqueta: "Formados nivel avanzado", ancho: 12, tipo: "numero" },
  { campo: "trabajo_estudiantes", etiqueta: "Trabajo con estudiantes", ancho: 50, tipo: "multi" },
  { campo: "trabajo_estudiantes_otro", etiqueta: "Trabajo con estudiantes: otro", ancho: 24 },
  { campo: "estudiantes_alcanzados", etiqueta: "Estudiantes alcanzados", ancho: 12, tipo: "numero" },
  { campo: "barreras", etiqueta: "Barreras", ancho: 44, tipo: "multi" },
  { campo: "apoyo", etiqueta: "Apoyo que ayudaría", ancho: 60 }
];
