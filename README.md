# Seguimiento · Formación de formadores en IA

Formulario de seguimiento (CPE · Fundación Shaia · TPA) con panel de administración y exportación a Excel.
Sitio estático para GitHub Pages; las respuestas se guardan en una hoja de Google Sheets mediante Apps Script.

| Archivo | Qué es |
|---|---|
| `seguimiento.html` | Formulario público (`index.html` redirige aquí) |
| `admin.html` | Panel: resumen, respuestas individuales y botón **Descargar Excel** |
| `assets/js/preguntas.js` | **Única** definición de preguntas y opciones (formulario, panel y Excel salen de aquí) |
| `assets/js/config.js` | URL del backend (`SCRIPT_URL`) |
| `apps-script/Code.gs` | Backend: guarda respuestas, bloquea cédulas duplicadas, crea solo las columnas nuevas y entrega datos al panel con contraseña |
| `MEMORIA.md` | Decisiones, pendientes y registro de cambios del proyecto |
