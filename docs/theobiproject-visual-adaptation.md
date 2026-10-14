# Adaptación visual de THEOBIPROJECT a NLOBI

Fecha: 2026-10-13

## Procedencia

- Repositorio designado: `MikeMR13/THEOBIPROJECT`. El repositorio de GitHub estaba vacío (sin commits ni ramas) al preparar esta adaptación.
- Fuente visual recuperada: proyecto Vercel `theobiproject`, despliegue de producción `dpl_73Xbm39hN27stFVbS6TNtVQjc8aY`, con archivos `styles.css`, `index.html`, `app.js` e icono.
- Diseño observable en el CSS publicado: tinta `#0d0c0a`, papel `#f3ecd9`, oro `#f2c230`, borde `#2f2a20`, neutro `#a89f8a`; familias Shippori Mincho B1, IBM Plex Sans y Literata; sello japonés, navegación en tinta y tarjetas con cabecera dorada.

## Qué se trasladó

- Tokens de tinta, papel, oro y tipografía editorial al tema de NLOBI.
- Encabezado oscuro con un sello tipográfico girado y navegación contrastada.
- Superficies de catálogo, portada de obra, volúmenes y biblioteca como fichas de libro.
- Continuidad visual para perfiles públicos, notificaciones, Studio y administración.
- Compatibilidad con el tema claro (reinterpretación en papel) y oscuro (tinta original).
- Tipografías en carga diferida; primer fotograma de portada móvil mantiene el respaldo previo para no penalizar LCP.

## Límites deliberados

No se sustituyen `src/app.js`, APIs, esquema de Supabase, control de acceso, rutas, notificaciones, imports ni sistema de lectura. El símbolo `オ` actual y los iconos PWA se preservan para no romper identificadores ni validaciones. Las fuentes originales embebidas en EPUB, preferencias de lectura y estilo de cada equipo siguen teniendo prioridad.

La adaptación no reproduce íntegramente cada vista de la aplicación de origen: el repositorio de GitHub no dispone aún del código y el despliegue publicado ofrece una referencia visual, no una rama versionada que fusionar.

## Validación

- `npm run check` (incluye las validaciones del lector EPUB, plataforma y `scripts/check-theobi-visual.mjs`).
- `npm run build` (verifica artefactos, configuraciones, CSS y Service Worker).
- Revisar CI, accesibilidad, LCP/CLS y navegación en 320 px, 375 px, escritorio y ambos temas antes de fusionar.
