# NLOBI

Biblioteca digital de novelas ligeras para lectores y equipos de traducción.

## Arquitectura Beta 19

- `src/index.html`: shell de la SPA.
- `src/styles.css`: estilos globales.
- `src/app.js`: aplicación cliente.
- `public/`: manifest, Service Worker e iconos.
- `scripts/`: validación, configuración runtime y build.
- `dist/`: salida generada; no se versiona.
- `.github/workflows/ci.yml`: validación automática para PR/main.

## Desarrollo / validación

```bash
npm ci
npm run check
npm run build
```

El build no necesita framework ni bundler.

## Configuración

NLOBI solo utiliza configuración pública de Supabase en el navegador:

- `NLOBI_SUPABASE_URL`
- `NLOBI_SUPABASE_PUBLISHABLE_KEY`

Nunca uses `service_role` en frontend o CI del sitio estático.

Si las variables no están presentes, el build de desarrollo utiliza la configuración pública actual de NLOBI.

## Deploy

Vercel ejecuta `npm run build` y publica `dist/`.

Antes de producción:
1. ejecutar CI;
2. crear deployment de prueba;
3. verificar `NLOBI_BETA19_ARCHITECTURE`;
4. probar Auth, Biblioteca, Reader, Studio y Admin;
5. promover solo el build probado.