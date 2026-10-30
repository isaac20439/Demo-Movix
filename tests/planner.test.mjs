// Pruebas del motor con trazados SINTÉTICOS (tests/fixture-prueba.geojson). No son rutas reales.
import fs from 'node:fs'; import assert from 'node:assert'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const P = require('../data/planner.js');
const fc = JSON.parse(fs.readFileSync(new URL('./fixture-prueba.geojson', import.meta.url)));
const paths = P.prepare(P.fromGeoJSON(fc));
const ids = r => r.direct.map(x => x.path.route.id);
// 1) directo oeste->este: solo PRUEBA-1 (PRUEBA-3 va en sentido contrario)
let r = P.plan(paths, { lat: 10.9905, lng: -74.825 }, { lat: 10.9905, lng: -74.785 });
assert.deepStrictEqual(ids(r), ['PRUEBA-1'], 'directo O->E: ' + ids(r));
// 2) sentido inverso: solo PRUEBA-3
r = P.plan(paths, { lat: 10.9905, lng: -74.785 }, { lat: 10.9905, lng: -74.825 });
assert.deepStrictEqual(ids(r), ['PRUEBA-3'], 'directo E->O: ' + ids(r));
// 3) transbordo: de la ruta 1 (oeste) a un punto al norte sobre la ruta 2
r = P.plan(paths, { lat: 10.9905, lng: -74.825 }, { lat: 11.005, lng: -74.8005 });
assert.strictEqual(r.direct.length, 0, 'no debe haber directo');
assert.ok(r.transfers.some(t => t.a.path.route.id === 'PRUEBA-1' && t.b.path.route.id === 'PRUEBA-2'), 'falta transbordo 1->2');
// 4) lejos de todo trazado: nada (no inventa rutas)
r = P.plan(paths, { lat: 11.07, lng: -74.70 }, { lat: 11.08, lng: -74.69 });
assert.strictEqual(r.direct.length + r.transfers.length, 0, 'no debe inventar rutas');
// 5) caminata máxima respetada
r = P.plan(paths, { lat: 10.9905, lng: -74.825 }, { lat: 10.9905, lng: -74.785 });
assert.ok(r.direct.every(x => x.walkO <= 600 && x.walkD <= 600));
// 6) circuito CERRADO: el destino queda "antes" del origen sobre el trazado, el bus debe dar la vuelta
const loop = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { codigo: 'CIRC-1', empresa: 'DATOS DE PRUEBA' },
  geometry: { type: 'LineString', coordinates: [[-74.83,10.99],[-74.78,10.99],[-74.78,11.01],[-74.83,11.01],[-74.83,10.99]] } }] };
const lp = P.prepare(P.fromGeoJSON(loop)); assert.ok(lp[0].closed, 'debe detectarse como circuito cerrado');
r = P.plan(lp, { lat: 11.0101, lng: -74.78 }, { lat: 10.9899, lng: -74.80 });   // sur-este->norte-este... destino atrás en el trazado
assert.strictEqual(r.direct.length, 1, 'directo con vuelta'); assert.ok(r.direct[0].ride > 250);
const sl = P.slice(lp[0], r.direct[0].sO, r.direct[0].sD); assert.ok(sl.length >= 3, 'tramo debe cruzar el cierre');
console.log('PLANNER_TESTS_OK');
