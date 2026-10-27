# Canvas del trabajo de TG · Artículo 11

Tablero compartido para preparar la exposición y el documento del artículo
*Finding the Chromatic Number by Means of Critical Graphs* (Herrmann y Hertz, 2002).

- Cada punto tiene un responsable (María, Ale, Javi, Pedro o Todos).
- Las casillas y los textos editados se guardan en una base de datos y **se sincronizan entre los cuatro** (cada 4 segundos).
- Cualquier cuadro se puede editar desde la web (lápiz ✎) y restaurar a su texto original.
- Si dos personas editan el mismo cuadro a la vez, la segunda recibe un aviso y se le carga la versión actual: no se pisan cambios.

## Por qué no un archivo SQLite dentro del proyecto

En Vercel, las funciones tienen el sistema de archivos de **solo lectura** (solo `/tmp` es escribible y no persiste ni se comparte entre instancias). Un `.db` dentro del proyecto perdería los cambios.

Por eso se usa **Turso**, que es SQLite alojado (libSQL): mismo SQL, pero accesible desde Vercel. En local, el mismo código usa un archivo SQLite normal (`local.db`).

## Estructura

```
api/index.js      Única función de la API (GET estado, POST marcar/editar/restaurar)
lib/db.js         Conexión (Turso o archivo local), creación de tablas y datos iniciales
lib/seed.js       Contenido inicial (solo se inserta si no existe)
public/           Web estática: index.html, styles.css, app.js, figs.js, seed.js
scripts/dev.mjs   Servidor local sin Vercel
vercel.json       Sirve la carpeta public/
```

## Probar en local

```bash
npm install
npm run dev        # http://localhost:3000  (crea local.db)
```

Abre la página en dos navegadores distintos para ver la sincronización.

## Desplegar en Vercel (una vez)

1. **Sube la carpeta a un repositorio de GitHub** (puede ser privado).
2. **Crea la base de datos en Turso.** Dos opciones:
   - Desde Vercel: *Storage* → Marketplace → **Turso Cloud** → crea la base y conéctala al proyecto.
   - Con la CLI de Turso:
     ```bash
     turso db create canvas-tg
     turso db show canvas-tg --url          # → TURSO_DATABASE_URL
     turso db tokens create canvas-tg       # → TURSO_AUTH_TOKEN
     ```
3. **Importa el repositorio en Vercel** (*Add New → Project*). No hace falta comando de build.
4. **Variables de entorno** (*Settings → Environment Variables*):
   | Variable | Valor |
   | :-- | :-- |
   | `TURSO_DATABASE_URL` | URL `libsql://…` de tu base |
   | `TURSO_AUTH_TOKEN` | token de la base |
   | `GROUP_KEY` | una clave que solo conozcáis los cuatro |

   Si conectas Turso desde el Marketplace, revisa los nombres que crea: este proyecto lee exactamente `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`.
5. **Redeploy** para que se apliquen las variables. La primera visita crea las tablas y carga el contenido inicial.
6. Comparte el enlace. Cada uno elige su nombre y escribe la clave del grupo la primera vez (se recuerda en su navegador).

## Detalles

- **Clave del grupo:** es una contraseña compartida sencilla para que nadie ajeno edite el tablero; no es un sistema de usuarios.
- **Historial:** cada marca o edición queda registrada en la tabla `history` (quién, cuándo, texto anterior y nuevo).
- **Cambiar el contenido inicial:** edita `lib/seed.js` y `public/seed.js`. Solo afecta a elementos nuevos: lo ya guardado en la base no se sobrescribe.
- **Fórmulas al editar:** entre dólares (`$G'$`, `$\chi(G)$`, `$G_{n,p}$`, `$10^6$`). `*texto*` va en cursiva.
- **Modo local:** si la página no encuentra la API (por ejemplo, abierta como archivo), funciona igual pero guardando solo en ese navegador, y lo indica con un aviso.
