# Sitio de la revista (Hugo + Decap CMS + Netlify)

Sitio estático para una revista científica. **El sitio público está íntegramente en inglés** (textos fijos, URLs `/articles/`, `/about/`, `/author-guidelines/`, fechas y tipos de artículo); el panel de Decap está en español para quien lo edita. Cada estudio tiene su página con los datos principales, un botón de descarga al PDF de Zenodo, identificadores (DOI, ARK, DOI anterior), "Cómo citar" con exportación a BibTeX y RIS, y metaetiquetas para Google Scholar más datos estructurados (JSON-LD). No usa ningún tema: las plantillas están en `layouts/` y los estilos en `assets/css/main.css`.

## Puesta en marcha

1. **Sube esta carpeta a un repositorio de GitHub** (rama `main`).
2. **Edita los datos básicos:**
   - `hugo.toml`: `baseURL` (el dominio definitivo), `title`, `description`, `issn`, `publisher`, `footer_note`.
   - `static/admin/config.yml`: `repo` (usuario/repositorio).
   - `netlify.toml`: `HUGO_VERSION` está fijada en la versión con la que se probó el proyecto (0.123.7). Puedes subirla cuando quieras.
3. **Conecta el repositorio a Netlify:** Add new site → Import from Git. El comando (`hugo --gc --minify`) y la carpeta de publicación (`public`) ya están en `netlify.toml`.
4. **Inicio de sesión de Decap.** El backend es `github`, que necesita un proveedor OAuth. En Netlify se instala en el sitio (Site configuration → Access & security → OAuth; el nombre de los menús puede cambiar), con una OAuth App creada en GitHub (Settings → Developer settings) cuya URL de retorno es `https://api.netlify.com/auth/done`. Después entra a `https://TU-SITIO/admin/`. Si prefieres Netlify Identity con Git Gateway, el bloque alternativo está comentado en `config.yml`.
5. **Borra el estudio de ejemplo** (`content/articles/example-study.md`) cuando publiques el primero real. Está como borrador, así que no se publica.

## Publicar un estudio

1. Sube el PDF a Zenodo (en la comunidad de la revista) y copia el DOI y el enlace directo al archivo.
2. En `/admin/` → Artículos → Nuevo artículo: completa los campos y escribe el resumen en el cuerpo.
3. Publica. Netlify reconstruye el sitio en aproximadamente un minuto.

Campos del artículo: título, fecha, tipo, volumen, número, autores (nombre, afiliación, ORCID), DOI actual, ARK, DOI anterior, URL del PDF, tamaño del PDF, URL del registro de Zenodo (si se deja vacía, se deduce del DOI), licencia, idioma y palabras clave.

## Cosas que conviene saber

- **No cambies el nombre de archivo (slug) de un estudio después de publicarlo.** La URL depende de él, y tu ARK apunta a esa URL.
- **Fechas:** `buildFuture = true` en `hugo.toml` publica un estudio fechado hoy aunque el servidor de Netlify (UTC) todavía esté en el día anterior. Una fecha posterior a hoy también se publica de inmediato.
- **ARK:** se escribe a mano en cada estudio. Formato: `ark:/57464/jsp/v{volumen}.i{número}/{contador de 4 dígitos}`. Si tu ARK tiene un resolvedor público, ponlo en `ark_resolver` y el ARK se muestra como enlace.
- **Volumen y número son obligatorios.** El listado agrupa por esos dos campos, y un estudio sin ellos no aparece.
- **Redirecciones de las URLs antiguas de Grav:** se declaran en `netlify.toml` (hay un ejemplo comentado). Para que `tu-dominio/ark:/...` lleve a la página del estudio, prueba primero con un ARK de ejemplo, porque los dos puntos pueden interpretarse como marcador en las rutas de Netlify.
- **Google Scholar:** según sus pautas de inclusión, prefiere que el PDF esté en el mismo dominio que la página del artículo. Si ves que no indexa los estudios, aloja también el PDF en tu sitio (por ejemplo en `static/pdf/`) y apunta ahí `pdf_url`. Conviene revisar sus pautas actuales.
- **Fuentes:** se cargan desde Google Fonts. Para no depender de un servicio externo, descárgalas a `static/fonts/` y cámbialas en `layouts/partials/head.html`.

## Vista previa en tu computador

```
hugo server -D
```

`-D` incluye los borradores. Para editar con Decap en local, ejecuta además `npx decap-server` y abre `http://localhost:1313/admin/`.

## Personalizar

- **Colores y tipografías:** el bloque `:root` de `assets/css/main.css`.
- **Menú:** la sección `[menus]` de `hugo.toml`.
- **Licencias:** la lista del campo Licencia en `config.yml` y el diccionario de enlaces al inicio de `layouts/articles/single.html`.
- **Textos fijos** (por ejemplo "Cómo citar" o "Acceso abierto"): en `layouts/`. Las plantillas están en español.

## Estructura

```
hugo.toml                       configuración y datos de la revista
netlify.toml                    construcción, cabeceras y redirecciones
archetypes/articles.md         plantilla para `hugo new articles/nombre.md`
assets/css/main.css             estilos
content/_index.md               texto de la portada
content/about.md            páginas de texto
content/author-guidelines.md
content/articles/              un archivo .md por estudio (lo escribe Decap)
layouts/index.html              portada
layouts/articles/              listado por volumen y número, página del estudio, exportación .bib y .ris
layouts/partials/               cabecera, pie, tarjeta de artículo, metaetiquetas de citación
static/admin/                   Decap CMS (index.html y config.yml)
```
