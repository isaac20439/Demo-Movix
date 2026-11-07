# Movix — notas del proyecto (léelas antes de tocar código)

App web móvil (PWA) para el transporte público de Barranquilla y su área metropolitana. Prototipo académico con revisiones de un instructor. Idioma de la interfaz y de la comunicación: **español de Colombia**. Sitio publicado en GitHub Pages (desde la rama `main`, carpeta raíz).

## Qué hace
- **Planifica tu viaje** (pestaña Mapa): origen (texto, GPS o mantener presionado el mapa) + destino → buses directos y opciones con 1 transbordo, usando los trazados oficiales del AMB. La hoja de resultados se arrastra como en Google Maps (3 posiciones).
- Caminata dibujada con línea discontinua por las calles (servicio de rutas a pie `routing.openstreetmap.de`, perfil foot); recorrido del bus con línea continua.
- Ficha de ruta con mapa del recorrido COMPLETO; catálogo de rutas y las 25 empresas (23 del catálogo AMB + 2 solo en los trazados); reportes guardados en el dispositivo.

## Estructura
- `index.html` — HTML + CSS + JS heredado (varias capas de scripts que se sobrescriben; las funciones nuevas están en `js/plan-ui.js`, que se carga al final).
- `js/plan-ui.js` — interfaz del planificador, hoja arrastrable, mapa Leaflet o lienzo SVG de respaldo, ficha de ruta (`window.showDetail` la reemplaza), directorio de empresas.
- `data/planner.js` — motor de rutas (funciona en navegador y en Node). `data/routes.js`, `route-enrichment.js`, `operator-sources.js` — catálogo oficial. `data/rutas_amb.geojson` — 79 trazados (KMZ del AMB), compactado.
- `tests/planner.test.mjs` + `tests/fixture-prueba.geojson` (rutas SINTÉTICAS, no reales). `verify.mjs` — validación de archivos.
- `sw.js` — service worker **red primero** (v5). Si cambias archivos, sube la versión de caché y la etiqueta de versión (Más → Acerca de Movix).

## Cómo probar
`node verify.mjs` · `node tests/planner.test.mjs` · servidor local: `python3 -m http.server 8080`.

## Reglas del proyecto (no negociables)
1. **No inventar datos**: ni rutas, ni nombres de letrero, ni paraderos, ni horarios, ni tiempos, ni posición de buses. Lo que falta se dice como pendiente.
2. **Sin «paraderos»**: se puede abordar en cualquier punto del recorrido, en un lugar seguro. «Sube aquí» = punto del recorrido más cercano, no un paradero verificado.
3. Los nombres tipo «Vivero – Paraíso» son denominaciones publicadas por el AMB; **no** se afirma que sean el letrero frontal.
4. Atribuir al AMB. Los KMZ no traen licencia de datos explícita: verificar antes de redistribuir o uso comercial. Fotos: solo con licencia y crédito visible (p. ej. CC BY 4.0, Wikimedia Commons).
5. Diseño: misma paleta de marca pero en **tonos vivos** (pedido del profesor: menos pastel, más contraste): Carbón #1F1A17, Terracota #C73E1D, Ocre #F2A900, Salvia #0B8460, Hueso #FBF6EE, Gris cálido #D8CBBB, Blanco. (La paleta original, apagada, era #2E2A26 / #B5654A / #D9A24B / #6E9B8C / #F7F2EC / #E6DDD3.) Fraunces/Inter con respaldo del sistema. **Contraste mínimo 4,5:1**: para TEXTO usar `--salvia-texto #0A6048` y `--terracota-texto #A8320C`; botones con `--terracota-boton #C73E1D` (texto blanco 5,1:1); texto oscuro sobre el ocre. Sin marco de teléfono ni elementos de maqueta; responsive celular + computador. Botones táctiles ≥ 44 px.
6. **Modo claro / oscuro** en Más → Apariencia (`data-tema` en `<html>`; tokens en `:root` y `:root[data-tema=oscuro]`). Nunca colores fijos: usar los tokens (`--carbon` = texto, `--hueso` = fondo, `--blanco` = superficie, `--oscuro` = fondos oscuros fijos, `--caminata`, `--contorno`). Verificar contraste ≥ 4,5:1 en AMBOS modos. Celular y PC deben tener las mismas funciones.
   Antes: **Un solo color de acento** (`--vivo*` = terracota vivo): se probaron temas lila / verde / amarillo y se descartaron. Usar siempre los tokens, nunca colores fijos, y mantener contraste ≥ 4,5:1. El recorrido del bus se dibuja con contorno oscuro.
7. Sin claves en el repositorio. No se usa Google Maps (decisión del usuario): Leaflet + OpenStreetMap.

## Decisiones técnicas que conviene conservar
- Cada trazado del AMB es un **circuito cerrado (ida + vuelta)**: el recorrido de subida a bajada puede cruzar el cierre (`fwd()` en `planner.js`).
- Costo = 6 × metros a pie + metros en bus (se prioriza caminar poco). Si no hay resultados a 600 m, se amplía a 1000 y 1500 m. Se descartan recorridos en bus > 4× la distancia en línea recta + 3 km.
- Los códigos del catálogo pueden traer sufijo («C12-4169 A») y el trazado no («C12-4169»): `catalog()` y `geoFor()` los emparejan.
- El mini mapa de la ficha no captura el arrastre con un dedo en celular (para que la página baje).

## Pendiente / límites conocidos
- Sin trazados de **Transmetro**. 79 trazados vs 93 rutas catalogadas (26 sin trazado; 12 trazados con códigos que el catálogo no tiene; Cootratlantico y T_Atlantico solo aparecen en los trazados).
- **No se ha probado en un teléfono real** el servicio de caminata (routing.openstreetmap.de), el GPS ni la instalación PWA. Nominatim (búsqueda de direcciones) es una instancia pública: uso ligero.
- Fotos con licencia de más empresas; estado operativo vigente de cada empresa sin verificar; sin tiempo real ni horarios.
- Pendiente de revisar: el instructor envió un audio con correcciones que no se transcribió; el usuario confirmó que «lo del profesor se corrigió», pero conviene pedir el texto.

## Documentos de origen
Poner en `docs/` el PROMPT MAESTRO y el ANEXO de identidad visual originales (requisitos completos).
