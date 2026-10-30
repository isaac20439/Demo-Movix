import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const required = ['index.html', 'manifest.webmanifest', 'sw.js', 'movix-icon.svg', 'README.md', 'FUENTES.md', 'data/routes.js', 'data/operator-sources.js', 'data/route-enrichment.js', 'data/planner.js', 'js/plan-ui.js'];
for (const file of required) if (!fs.existsSync(path.join(root, file))) throw new Error(`Falta ${file}`);

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
if (!manifest.name || !manifest.icons?.length || !manifest.start_url) throw new Error('Manifest incompleto');
if (html.includes('animateMotion') || html.includes('bus-icon')) throw new Error('Se encontró animación o marcador de bus');
const active = html.replace(/\/\*[\s\S]*?\*\//g, '');
if (active.includes('DEMO_ROUTES') || active.includes('DEMO_STOPS')) throw new Error('La lógica activa conserva datos demo');
if (!active.includes('L.map') || !active.includes('navigator.geolocation') || !active.includes('localStorage')) throw new Error('Falta una capacidad obligatoria');
const scriptBlocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim());
for (const [i, script] of scriptBlocks.entries()) new vm.Script(script, {filename: `index-inline-${i + 1}.js`});
const routes = fs.readFileSync(path.join(root, 'data/routes.js'), 'utf8');
const amb = (routes.match(/\['[^']+','[^']+'\]/g) || []).length;
const transmetro = (routes.match(/\['(?:A|U|G|R)[^']*','[^']+'\]/g) || []).length;
if (amb < 90 || transmetro < 20) throw new Error(`Catálogo inesperadamente pequeño: AMB=${amb}, Transmetro=${transmetro}`);
const docs = fs.readFileSync(path.join(root, 'README.md'), 'utf8') + fs.readFileSync(path.join(root, 'FUENTES.md'), 'utf8');
for (const marker of ['Leaflet', 'OpenStreetMap', 'GPS', 'geometr', 'licencia']) if (!docs.toLowerCase().includes(marker.toLowerCase())) throw new Error(`Falta documentación: ${marker}`);
console.log(`MOVIX_VERIFY_OK files=${required.length} inlineScripts=${scriptBlocks.length} ambRows=${amb} transmetroRows=${transmetro} routes=${amb + transmetro}`);
