# Movix actualizado para GitHub Pages

## Cambios

- Se reemplazó el mapa SVG de maqueta por Leaflet 1.9.4 con teselas de OpenStreetMap y atribución visible.
- Se conservaron los códigos AMB/Transmetro respaldados por fuentes oficiales y se añadió un registro separado de operadores privados consultados.
- Se añadieron Coochofal, Cootrasol y Coolitoral como fuentes privadas verificadas; sus páginas no se usan para completar datos que no publican.
- Se mantuvo el logo carbón, ocre, hueso y terracota en la interfaz; `movix-icon.svg` es el favicon y el icono PWA.
- Se añadió documentación de GitHub Pages y se corrigieron rutas relativas de los recursos.
- La ficha de ruta declara cuándo faltan geometría, paraderos, horarios o tiempos publicados; no dibuja recorridos inventados.
- Se añadieron denominaciones legibles y alias de lugares respaldados por notas/resoluciones AMB; el código técnico permanece visible.
- El detalle de ruta incluye foto licenciada de Transmetro o foto TPC genérica claramente rotulada, mini mapa Leaflet y estado explícito de geometría/paraderos.
- Las búsquedas que no coinciden localmente intentan ubicar una dirección mediante Nominatim; no atribuyen rutas cercanas ni metros a pie sin geometría y paraderos verificables.
- Se intentó recuperar un KMZ oficial de AMB para dibujar geometría calle por calle, pero el entorno de ejecución bloqueó la descarga directa; por eso el prototipo enlaza las resoluciones/visor y deja el trazado detallado como pendiente, sin inventarlo.
- La fotografía usada tiene atribución a Jdvillalobos y licencia CC BY 4.0. Las fotos privadas quedan pendientes por falta de licencia verificable.

## Verificación realizada

- Sintaxis de `data/routes.js`, `data/operator-sources.js` y los dos bloques JavaScript activos del HTML: correcta.
- Carga local en navegador: Leaflet visible, controles de zoom, atribución OpenStreetMap y marcador de Barranquilla.
- Búsqueda manual: `SOBUSA` devolvió 9 registros AMB.
- Detalle manual: mostró código, operador, enlace AMB y el estado de geometría no disponible.

## Consolidación y prueba adicional — 23 de octubre de 2026

- Se consolidó esta versión en el proyecto actual sin sobrescribir el ZIP anterior; se conservó el `movix-icon.svg` existente y se verificó que su SHA-256 coincide con el icono del PWA anterior.
- Se añadió origen manual por dirección o lugar. El origen se marca en el mapa mediante geocodificación de Nominatim; no se atribuyen rutas ni combinaciones sin geometría y paraderos oficiales comprobables.
- La búsqueda muestra el estado explícito de combinaciones no calculadas y mantiene los segmentos directos respaldados por AMB/Transmetro.
- Se sustituyó el logotipo visual de cabecera por el mismo SVG usado como icono y favicon.
- `node verify.mjs`: `MOVIX_VERIFY_OK`, 149 registros catalogados, 3 bloques JavaScript válidos, PWA y fuentes presentes.
- Prueba HTTP en `http://127.0.0.1:8765/`: Leaflet visible con atribución OpenStreetMap; búsqueda `Universidades` mostró U-30 y C6-4137; el detalle mostró tiempo y paraderos no publicados; origen manual encontró y marcó el lugar consultado; el reporte local mostró confirmación de guardado; la vista móvil de 390×844 conservó mapa, ficha inferior y navegación.
- GitHub Pages no se publicó desde este entorno: no hay CLI ni conector GitHub autenticado disponible. El README contiene el procedimiento exacto para crear el repositorio y activar Pages.
- Se añadió `.github/workflows/pages.yml` para publicar automáticamente desde `main` con GitHub Actions, además de `.nojekyll` para evitar que GitHub intente procesar el sitio como Jekyll.
- Se generó el paquete actualizado `outputs/Movix-PWA-GitHub-Pages-2026-10-24.zip`; SHA-256: `56A7222C370D1EDE0494307B8A80ECA96177D4E3DF51C9CBD021A3F0232B8863`.
- Se corrigió el buscador para que el filtro local funcione sin depender del mapa ni de Nominatim, acepte términos con espacios o guiones y responda tanto al botón como a Enter. Las direcciones sin coincidencia local ofrecen una acción externa separada y un mensaje de error con tiempo límite.
- Se actualizó la caché del service worker a `movix-official-v2` para evitar que GitHub Pages entregue la versión anterior.
- Prueba adicional en navegador: `SOBUSA` devolvió 9 rutas; `A7 4112` devolvió 1 ruta; una dirección inexistente mostró el estado `No hay coincidencias locales` y el botón para búsqueda externa.
- No se probó una publicación real en GitHub Pages ni permisos de GPS del usuario; esas pruebas dependen del repositorio y del navegador/dispositivo final.

## Ajuste de interfaz y correcciones — 28 de octubre de 2026

- Se eliminó el marco de teléfono (notch, barra de estado falsa, bordes y sombra). La app ocupa toda la ventana.
- Diseño adaptable: en celular, barra inferior; en pantallas de 900 px o más, menú lateral, mapa a la izquierda y panel a la derecha, contenido centrado.
- Se quitaron elementos de maqueta: marcador de ubicación fijo, perfil «Usuario Movix», «Favoritas», «Notificaciones» y «Ayuda» sin función, reloj falso y búsqueda precargada.
- Se escapa el texto devuelto por Nominatim antes de insertarlo en el HTML.
- `verify.mjs` resuelve bien la carpeta raíz en Linux/macOS/Windows. Resultado: MOVIX_VERIFY_OK (149 rutas).
- Caché del service worker `movix-official-v3`. Leaflet sigue cargándose desde unpkg; para uso sin conexión hay que alojarlo en el proyecto.
- Google Maps NO se implementó (decisión del usuario): se mantiene Leaflet + OpenStreetMap.

## Planificador estilo Rutaquilla — 28 de octubre de 2026

- Panel «Planifica tu viaje en bus» en el mapa: origen (escribir, GPS o mantener presionado el mapa) y destino; resultados con buses directos y opciones con 1 transbordo (`data/planner.js`, `js/plan-ui.js`).
- El motor usa solo trazados publicados (`data/rutas_amb.geojson`, que NO está incluido): comprueba cercanía a pie (máx. 600 m), sentido de circulación según el trazado y transbordos (máx. 200 m). No calcula tiempos ni posiciones de buses.
- El «punto de abordaje» es el punto más cercano del trazado; se rotula como no verificado. Sin trazados, el planificador lo dice y no inventa rutas.
- Directorio en Más: las 23 empresas TPC del catálogo AMB + Transmetro, tocables para ver sus rutas.
- Lienzo SVG como respaldo cuando Leaflet no carga (muestra los trazados sin teselas).
- Pruebas: `node tests/planner.test.mjs` (datos SINTÉTICOS de `tests/fixture-prueba.geojson`, no son rutas reales). Modo de prueba opcional en Más → Trazados de rutas.
- Datos AMB: uso personal y no comercial con crédito; el uso comercial requiere autorización escrita del AMB.

## Trazados oficiales del AMB integrados — 28 de octubre de 2026

- Se incluye `data/rutas_amb.geojson`: 79 trazados convertidos de los KMZ oficiales del AMB (25 operadores). Se compactó (de 20 MB a 1,5 MB, coordenadas a 5 decimales) y se corrigió el texto con codificación dañada.
- Cada trazado es un circuito cerrado (ida y vuelta). El motor ahora cuenta el recorrido cruzando el cierre del circuito y ordena por «3 × metros a pie + metros en bus».
- Cobertura parcial: el catálogo tiene 93 rutas de buses y hay 79 trazados; 12 trazados traen códigos que el catálogo no tiene. Cootratlantico y T_Atlantico aparecen solo en los trazados.
- Transmetro no tiene trazados cargados.
- El AMB no publica una licencia de datos explícita en los KMZ: citar al AMB y verificar condiciones antes de redistribuir o usar comercialmente.
- Rendimiento medido en Node: ~150 ms por consulta (máx. 480 ms); en un celular será mayor.

## Ajustes visuales y de contraste — 30 de octubre de 2026

- Contraste (medido): el texto en salvia daba 2,8–3,1:1 y el terracota 3,8–4,3:1 (mínimo recomendado 4,5:1). Se añadieron tonos derivados para TEXTO y BOTONES: `--salvia-texto #356355` (6,9:1), `--terracota-texto #9A4E36` (6,0:1), `--terracota-boton #A5573D` (blanco sobre él: 5,2:1) y `--texto-suave #5B5249`. Los colores de marca originales se conservan para logotipo, fondos y gráficos.
- Auditoría automática en navegador: 0 textos visibles bajo 4,5:1 en Mapa, Rutas y Más (antes: 45 en celular y 31 en computador).
- Tamaños de texto mínimos: de 10–11 px a 12–13 px.
- Celular: el panel de viaje ocupa menos (placeholders cortos, sin texto de ayuda); sin hoja inferior mientras no haya resultados, para ver más mapa.
- Botones flotantes con texto («Mi ubicación», «Reportar») y logotipo sobre fondo claro.
- Se quitó el marcador azul fijo del centro de la ciudad y el marcador falso del mapa de detalle: ahora la ficha dibuja el trazado oficial si existe.
- Panel lateral en computador: instrucciones de uso y altura completa; se quitó la foto decorativa del mapa.

## Revisión del instructor, segunda ronda — 30 de octubre de 2026

- Se eliminó el concepto de «paraderos» de la interfaz: se puede abordar en cualquier punto del recorrido (en un lugar seguro). «Sube aquí» es el punto del recorrido más cercano al usuario. Los reportes ofrecen «Bus no pasó» en vez de «Paradero dañado».
- La caminata se dibuja con línea discontinua y el recorrido del bus con línea continua (en el mapa y en la ficha).
- Los resultados se pueden ocultar y mostrar (botón «Ocultar/Mostrar» y barra superior de la hoja).
- Al tocar un resultado se despliega la información de esa ruta (cómo reconocerla, sectores) con el botón «Ver información de la ruta».
- La ficha de ruta se rehízo: mapa con el recorrido COMPLETO (circuito ida y vuelta), la caminata y el origen/destino cuando vienes de una búsqueda; secciones plegables para evitar páginas largas.
- Más: las secciones son plegables.
- Emparejamiento de códigos corregido: rutas del catálogo con sufijo (p. ej. «C12-4169 A») ahora encuentran su trazado («C12-4169») y su nombre publicado.
- Contraste revisado también en la ficha: 0 textos bajo 4,5:1.
