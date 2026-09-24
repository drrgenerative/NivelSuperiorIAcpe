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

**Modo de prueba:** mientras `SCRIPT_URL` esté vacío, todo funciona pero los datos quedan solo en el navegador. La contraseña del panel es `demo` y hay un botón para cargar respuestas de ejemplo.

---

## 1. Configurar Google (una sola vez, unos 10 minutos)

Se recomienda usar una cuenta de Google de la organización que no dependa de una persona, por ejemplo una cuenta creada solo para el programa.

1. **Crear la hoja.** En [sheets.new](https://sheets.new), crea una hoja nueva y llámala, por ejemplo, *Seguimiento CPE – Respuestas*.
2. **Abrir Apps Script.** Menú **Extensiones → Apps Script**.
3. **Pegar el código.** Borra lo que haya en `Código.gs` y pega todo el contenido de [`apps-script/Code.gs`](apps-script/Code.gs). Guarda (ícono de disco o Ctrl+S).
4. **Definir la contraseña del panel.** Ícono de engranaje **Configuración del proyecto** → al final, **Propiedades de la secuencia de comandos** → **Agregar propiedad**:
   - Propiedad: `ADMIN_PASSWORD`
   - Valor: la contraseña que usará el equipo. Usa una larga, de 12 caracteres o más.
   - Guarda.
5. **Crear la hoja de respuestas y dar permisos.** Vuelve al editor (ícono `< >`). En la barra superior elige la función `configurarHoja` y pulsa **Ejecutar**.
   - Google pedirá autorización: **Revisar permisos** → elige la cuenta → **Configuración avanzada** → **Ir a … (no seguro)** → **Permitir**. El aviso aparece porque el script es propio y no está publicado; es normal.
   - En la hoja aparecerá una pestaña **Respuestas** con los encabezados.
6. **Publicar como aplicación web.** **Implementar → Nueva implementación** → ícono de engranaje → **Aplicación web**:
   - Descripción: `v1`
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
   - **Implementar** y copia la **URL de la aplicación web**, que termina en `/exec`.
7. **Conectar el sitio.** Pega esa URL en `assets/js/config.js`:
   ```js
   window.CONFIG = { SCRIPT_URL: "https://script.google.com/macros/s/XXXX/exec" };
   ```

> **Si en "Quién tiene acceso" no aparece "Cualquier usuario"** (solo "Cualquier usuario de *dominio*"), la cuenta es de Google Workspace con restricciones. Pide a TI que lo habilite o usa una cuenta de Gmail normal.

### Cambios posteriores al script
Si se modifica `Code.gs`: **Implementar → Gestionar implementaciones** → lápiz ✏️ → Versión: **Nueva versión** → **Implementar**. Así la URL no cambia.

### Cambiar la contraseña
Edita `ADMIN_PASSWORD` en *Propiedades de la secuencia de comandos*. No hace falta volver a implementar.

---

## 2. Publicar en GitHub Pages

1. Crea un repositorio en la cuenta u organización de GitHub del cliente, por ejemplo `seguimiento-cpe`.
2. Sube estos archivos: `index.html`, `seguimiento.html`, `admin.html`, `assets/`. `apps-script/`, `README.md` y `MEMORIA.md` pueden ir también, porque no contienen secretos.
3. **Settings → Pages → Build and deployment**: Source *Deploy from a branch*, rama `main`, carpeta `/ (root)`.
4. Direcciones resultantes:
   - Formulario: `https://<usuario>.github.io/seguimiento-cpe/seguimiento.html`
   - Panel: `https://<usuario>.github.io/seguimiento-cpe/admin.html`

---

## Cómo funciona

- **Duplicados:** el backend rechaza un segundo envío con el mismo número de cédula. La persona ve un aviso claro.
- **Seguridad del panel:** la contraseña se valida en Apps Script, nunca en el HTML. Tras 10 intentos fallidos, el panel se bloquea 15 minutos. La hoja de Google sigue siendo privada de la cuenta dueña.
- **Excel:** exporta las respuestas **con el filtro de fechas activo** en dos hojas: *Respuestas* (una fila por persona; en las matrices, una columna por fila con los roles marcados, p. ej. "Directivos; Docentes") y *Resumen* (indicadores y tablas por pregunta).
- **Editar preguntas u opciones:** cambia solo `assets/js/preguntas.js`. El backend agrega a la hoja las columnas nuevas en el siguiente envío, así que **no hace falta tocar `Code.gs`**. Si renombras un `campo` o el `id` de una fila, se crea una columna nueva y la vieja queda con los datos anteriores.
