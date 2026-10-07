# NLOBI Beta 19 — Arquitectura y producción

## Resultado

Beta 18 fue migrada desde un HTML monolítico a un proyecto estático con build reproducible.

## Estructura

- `src/index.html` — shell de la SPA.
- `src/styles.css` — estilos globales.
- `src/app.js` — aplicación cliente.
- `public/` — PWA: manifest, Service Worker e iconos.
- `scripts/generate-config.mjs` — genera configuración pública runtime.
- `scripts/validate.mjs` — validación de JS, JSON y estructura.
- `scripts/build.mjs` — genera `dist/`.
- `.github/workflows/ci.yml` — CI preparado para GitHub.
- `vercel.json` — build, output y headers de seguridad.

## Configuración

Variables soportadas:

- `NLOBI_SUPABASE_URL`
- `NLOBI_SUPABASE_PUBLISHABLE_KEY`

Nunca debe usarse `service_role` en el frontend.

## Seguridad HTTP preparada

- Content-Security-Policy
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- Cross-Origin-Opener-Policy
- frame-ancestors none
- object-src none

La CSP permite únicamente los CDN que utiliza el importador DOCX/EPUB/PDF.

## CI

En cada pull request y push a `main`:

1. `npm ci`
2. `npm run check`
3. `npm run build`

Las GitHub Actions están fijadas a commits concretos.

## Verificación local

- `npm run check`: OK
- `npm run build`: OK
- `/`: 200 + marcador `NLOBI_BETA19_ARCHITECTURE`
- `/assets/app.js`: 200
- `/assets/styles.css`: 200
- `/manifest.webmanifest`: 200
- `/sw.js`: 200

## Estado Git/Vercel

El GitHub conectado actualmente no contiene un repositorio NLOBI, y la integración disponible no permite crear uno desde este flujo. Por tanto, CI está preparada pero todavía no activada en GitHub.

El proyecto Vercel existente es `nlobi`, pero los alias de producción siguen apuntando al deployment anterior. Beta 19 no se declara desplegada ni promovida.

## Para cerrar producción

1. Crear un repositorio vacío `NLOBI` en el GitHub conectado.
2. Subir este proyecto.
3. Vincular el repositorio al proyecto Vercel `nlobi`.
4. Configurar las dos variables públicas de Supabase en Vercel.
5. Ejecutar CI.
6. Crear preview.
7. Verificar el marcador Beta 19 y flujos críticos.
8. Promover el build probado a producción.