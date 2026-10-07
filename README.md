# El Obi del Lector

Biblioteca digital de novelas ligeras para lectores y equipos de traducción. Marca pública: **El Obi del Lector**.

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

El sitio solo utiliza configuración pública de Supabase en el navegador:

- `NLOBI_SUPABASE_URL`
- `NLOBI_SUPABASE_PUBLISHABLE_KEY`

Nunca uses `service_role` en frontend o CI del sitio estático.

Si las variables no están presentes, el build de desarrollo utiliza la configuración pública actual del sitio.

## Deploy

Vercel ejecuta `npm run build` y publica `dist/`.

Antes de producción:
1. ejecutar CI;
2. crear deployment de prueba;
3. verificar `NLOBI_BETA19_ARCHITECTURE`;
4. probar Auth, Biblioteca, Reader, Studio y Admin;
5. promover solo el build probado.

## Auditoría de producción

El CI cubre build, accesibilidad, responsive y una matriz funcional de vistas públicas/autenticadas. La base de datos mantiene RLS en las tablas expuestas y las migraciones de endurecimiento se versionan en `supabase/migrations/`.

La configuración runtime acepta tanto los nombres canónicos `NLOBI_SUPABASE_*` como los nombres heredados `NEXT_PUBLIC_SUPABASE_*`.

### Pendientes operativos externos al código

- mantener Vercel enlazado a `MikeMR13/NLOBI` para que `main` despliegue automáticamente;
- promover a producción únicamente un deployment del commit probado;
- definir política de respaldo/restauración y retención de logs acorde al entorno de producción.
