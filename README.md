# DEMO_MOVIX — Movix PWA

## Qué contiene

- Catálogo de códigos y operadores publicado por el Visor de Rutas del Área Metropolitana de Barranquilla (AMB).
- Rutas alimentadoras y destinos publicados por Transmetro.
- Búsqueda por código, operador, sistema, denominación publicada, barrio o lugar conocido; si no hay coincidencia local, intenta geocodificar la dirección con Nominatim/OpenStreetMap.
- GPS únicamente del usuario, reporte local y funcionamiento PWA heredados del prototipo.
- Enlace a la fuente oficial cuando el trazado no está publicado en un formato utilizable por Movix.
- Planificación con 79 geometrías oficiales disponibles; la cobertura es parcial y no se inventan las rutas restantes.
- Puntos de abordaje/descenso sugeridos sobre el trazado, no paraderos oficiales. La posibilidad de detenerse depende de las normas y condiciones de la vía.

No se dibujan rutas inventadas, no se muestran tiempos de llegada calculados y no se rastrean buses. Las fotos TPC genéricas están rotuladas como referencia y no prueban la identidad de una empresa.

## Probar en computador

Sirve cualquier servidor HTTP local. Desde esta carpeta, por ejemplo:

```text
npx serve .
```

Abre la URL que indique el servidor. Para instalar en el teléfono, usa HTTPS o el enlace seguro de un servidor local de la misma red y agrega Movix a la pantalla de inicio desde el navegador.

## Fuentes

Las fuentes y la licencia de la fotografía están documentadas en `FUENTES.md`.
## Publicación en GitHub Pages

1. Crea un repositorio vacío y sube el contenido de esta carpeta. `index.html`, `data/`, `manifest.webmanifest`, `sw.js` y `movix-icon.svg` deben quedar en la raíz del repositorio; no subas el ZIP como único archivo ni dejes todo dentro de una carpeta `Movix/`.
2. Haz push a la rama `main`. El archivo `.github/workflows/pages.yml` publica automáticamente el contenido mediante GitHub Actions.
3. En GitHub abre **Settings → Pages** y selecciona **GitHub Actions** como fuente. No selecciones `/docs` ni una rama `gh-pages` para este flujo.
4. Revisa **Actions → Publicar Movix en GitHub Pages**. Cuando termine en verde, GitHub mostrará la URL en el entorno `github-pages` y en **Settings → Pages**.
5. Abre la URL publicada. Los enlaces usan rutas relativas, por lo que funcionan en una URL de proyecto, no solo en el dominio raíz.

El mapa usa Leaflet 1.9.4 desde `unpkg.com` y teselas de OpenStreetMap con atribución visible. Para una publicación sin conexión a Internet, sería necesario alojar una copia compatible de Leaflet y usar un proveedor de teselas apropiado.

La aplicación no dibuja geometrías inventadas: conserva códigos y nombres respaldados por AMB/Transmetro y enlaza la fuente cuando no hay una geometría utilizable. La GPS corresponde únicamente al usuario; no hay GPS ni seguimiento en vivo de buses.

## Verificación local

Desde la raíz del proyecto:

```text
node verify.mjs
npx serve .
```

La prueba estructural espera `MOVIX_VERIFY_OK`. En la validación del 23 de octubre de 2026 se comprobaron 149 registros, Leaflet en HTTP local, búsqueda por destino y operador, ficha de ruta, origen manual, reporte guardado localmente, enlaces de fuentes y vista móvil. La búsqueda de direcciones necesita conexión; el catálogo local permanece disponible sin conexión. La autorización de GPS del navegador debe concederse explícitamente por cada usuario y no se usa para ubicar buses.

Este paquete no incluye un repositorio GitHub ni una URL pública porque el entorno no tenía una conexión GitHub autenticada disponible para crear y publicar el repositorio. El workflow incluido deja preparado el despliegue automático. Verifica después la URL pública, el candado HTTPS, la instalación PWA y los enlaces antes de anunciarla como publicada.

### Opción rápida con Git desde la carpeta del proyecto

```text
git init -b main
git add .
git commit -m "Publicar Movix"
git remote add origin https://github.com/TU_USUARIO/NOMBRE_DEL_REPOSITORIO.git
git push -u origin main
```

Si GitHub muestra un error de autenticación, inicia sesión con GitHub Desktop o configura una clave SSH/token; no pegues tokens dentro de los archivos del proyecto.


## Interfaz DEMO_MOVIX

- Buscador de origen/destino compacto y adaptable a móvil, tablet y escritorio.
- Mapa con mayor protagonismo y panel de resultados reducido en móvil.
- Tramos en bus con línea continua; caminatas y conexiones a pie con línea discontinua.
- Abordajes y descensos se muestran como sugerencias geométricas, nunca como paraderos verificados ni como garantía de parada permitida.
- Colores de texto y controles ajustados para mejorar contraste. La conformidad WCAG 2.2 AA completa requiere auditoría visual y pruebas en dispositivos reales.
