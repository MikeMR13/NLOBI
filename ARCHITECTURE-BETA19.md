# NLOBI Beta 19 — Arquitectura y estado de producción

## Estado actual

El proyecto vive en `MikeMR13/NLOBI` y GitHub Actions valida cada pull request y cada push a `main`.

## Estructura

- `src/index.html` — shell de la SPA.
- `src/styles.css` — estilos globales.
- `src/app.js` — aplicación cliente.
- `public/` — PWA: manifest, Service Worker e iconos.
- `scripts/` — build y suites de QA.
- `supabase/migrations/` — cambios de esquema/RLS aplicados durante el endurecimiento.
- `.github/workflows/ci.yml` — validación automática.
- `vercel.json` — build, salida y headers de seguridad.

## Seguridad y QA

- RLS activo en tablas públicas expuestas.
- Storage limitado a imágenes de hasta 8 MB y escrituras por propietario/equipo editorial.
- Creación de proyecto novela+traducción transaccional mediante RPC.
- Roles de consulta separados de roles editoriales en Studio.
- CI con validación, build, Axe, auditoría responsive, matriz funcional y smoke cross-browser.
- Headers CSP, nosniff, referrer policy, permissions policy, COOP, frame-ancestors y object-src.

## Configuración pública

Se aceptan:

- `NLOBI_SUPABASE_URL`
- `NLOBI_SUPABASE_PUBLISHABLE_KEY`

Por compatibilidad también se aceptan:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Nunca debe utilizarse `service_role` en el navegador.

## Estado Vercel detectado en la auditoría

Existe el proyecto Vercel `nlobi`, pero la integración consultada no lo reportó como proyecto Git enlazado a `MikeMR13/NLOBI`. El deployment más reciente observado durante la auditoría apuntaba a un commit anterior a `main`.

Por tanto, el repositorio/CI está sano, pero la promoción a producción debe considerarse pendiente hasta reconectar la integración Git o desplegar explícitamente el commit probado y verificarlo.

## Cierre de producción

1. CI de `main` en verde.
2. Vercel enlazado al repositorio correcto o deployment explícito del SHA probado.
3. Smoke test contra el deployment real.
4. Verificación de Auth, Biblioteca, Reader, Studio, Importador y Admin con datos reales.
5. Estrategia de backup/restauración documentada.
6. Retención/observabilidad suficiente para incidentes de producción.
