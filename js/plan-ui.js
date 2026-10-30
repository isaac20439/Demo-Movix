/* Planificador de viaje de Movix: origen + destino -> rutas que sirven (directas y con 1 transbordo).
   Solo usa trazados publicados. Sin trazados cargados, lo dice y no inventa nada. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), P = window.MovixPlanner;
  const S = { routes: null, paths: null, status: 'loading', test: false, from: null, to: null, res: null, focus: 'to', t: 0 };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = m => m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(m / 10) * 10 + ' m';
  const OR = () => (typeof OFFICIAL_ROUTES !== 'undefined' ? OFFICIAL_ROUTES : []), OSRC = () => (typeof OPERATOR_SOURCES !== 'undefined' ? OPERATOR_SOURCES : []);
  const catalog = id => OR().find(r => P.normId(r.id) === P.normId(id));
  const pretty = n => String(n || '').toLowerCase().replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  /* ---------- mapa: Leaflet si existe; si no, lienzo SVG con los trazados ---------- */
  const M = { kind: null, svg: null, bg: null, fg: null, box: null };
  function mapInit() {
    const host = $('leaflet-map'); if (!host) return;
    if (window.L && window.movixMap) {
      M.kind = 'leaflet'; M.group = L.layerGroup().addTo(window.movixMap);
      window.movixMap.on('contextmenu', e => pickMenu(e.latlng.lat, e.latlng.lng, e.containerPoint.x, e.containerPoint.y));
    } else {
      M.kind = 'svg'; host.innerHTML = '<svg id="svgmap" role="img" aria-label="Mapa esquemático sin teselas" xmlns="http://www.w3.org/2000/svg"><rect id="svgbg" fill="#F7F2EC"/><g id="bgl"></g><g id="fgl"></g></svg>';
      M.svg = $('svgmap'); M.bg = $('bgl'); M.fg = $('fgl'); setView(null);
      M.svg.addEventListener('click', e => {
        const pt = M.svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const q = pt.matrixTransform(M.svg.getScreenCTM().inverse());
        const ll = P.toLL(q.x, -q.y), r = host.getBoundingClientRect(); pickMenu(ll[0], ll[1], e.clientX - r.left, e.clientY - r.top);
      });
    }
  }
  function setView(paths) {
    if (M.kind !== 'svg') return;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    (paths && paths.length ? paths : []).forEach(p => p.pts.forEach(q => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }));
    if (!isFinite(x0)) { const a = P.toXY(10.90, -74.88), b = P.toXY(11.05, -74.72); x0 = a[0]; x1 = b[0]; y0 = a[1]; y1 = b[1]; }
    const padX = (x1 - x0) * .06 + 300, padY = (y1 - y0) * .06 + 300;
    M.box = [x0 - padX, -(y1 + padY), x1 - x0 + 2 * padX, y1 - y0 + 2 * padY];
    M.svg.setAttribute('viewBox', M.box.join(' '));
    const bg = $('svgbg'); bg.setAttribute('x', M.box[0]); bg.setAttribute('y', M.box[1]); bg.setAttribute('width', M.box[2]); bg.setAttribute('height', M.box[3]);
  }
  const svgEl = (t, a) => { const e = document.createElementNS('http://www.w3.org/2000/svg', t); for (const k in a) e.setAttribute(k, a[k]); return e; };
  function drawBackground() {
    if (M.kind !== 'svg') return; M.bg.innerHTML = '';
    if (!S.paths) return; setView(S.paths);
    S.paths.forEach(p => M.bg.appendChild(svgEl('polyline', { points: p.pts.map(q => q[0] + ',' + -q[1]).join(' '), fill: 'none', stroke: '#B5A99B', 'stroke-width': 1.4, 'vector-effect': 'non-scaling-stroke', opacity: .55 })));
  }
  function clearFg() { if (M.kind === 'leaflet') M.group.clearLayers(); else if (M.fg) M.fg.innerHTML = ''; }
  function line(ll, o) {
    if (M.kind === 'leaflet') L.polyline(ll, { color: o.color, weight: o.w, opacity: o.op || 1, dashArray: o.dash || null }).addTo(M.group);
    else M.fg.appendChild(svgEl('polyline', { points: ll.map(q => { const x = P.toXY(q[0], q[1]); return x[0] + ',' + -x[1]; }).join(' '), fill: 'none', stroke: o.color, 'stroke-width': o.w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': o.dash || '', opacity: o.op || 1, 'vector-effect': 'non-scaling-stroke' }));
  }
  function dot(lat, lng, o) {
    if (M.kind === 'leaflet') L.circleMarker([lat, lng], { radius: o.r || 8, color: '#fff', weight: 3, fillColor: o.color, fillOpacity: 1 }).bindTooltip(o.label || '', { permanent: !!o.perm, direction: 'top' }).addTo(M.group);
    else { const x = P.toXY(lat, lng), u = M.box[2] / 900; M.fg.appendChild(svgEl('circle', { cx: x[0], cy: -x[1], r: (o.r || 8) * u, fill: o.color, stroke: '#fff', 'stroke-width': 3 * u }));
      if (o.label) { const t = svgEl('text', { x: x[0] + 12 * u, y: -x[1] - 10 * u, 'font-size': 13 * u, fill: '#2E2A26', 'font-family': 'Inter,system-ui,sans-serif', 'font-weight': 700, stroke: '#F7F2EC', 'stroke-width': 3 * u, 'paint-order': 'stroke' }); t.textContent = o.label; M.fg.appendChild(t); } }
  }
  function fit(lls) {
    if (!lls.length) return;
    if (M.kind === 'leaflet') window.movixMap.fitBounds(L.latLngBounds(lls), { padding: [50, 50], maxZoom: 16 });
    else { const xy = lls.map(q => P.toXY(q[0], q[1])), x0 = Math.min(...xy.map(a => a[0])), x1 = Math.max(...xy.map(a => a[0])), y0 = Math.min(...xy.map(a => a[1])), y1 = Math.max(...xy.map(a => a[1])), px = Math.max(500, (x1 - x0) * .25), py = Math.max(500, (y1 - y0) * .25);
      M.box = [x0 - px, -(y1 + py), x1 - x0 + 2 * px, y1 - y0 + 2 * py]; M.svg.setAttribute('viewBox', M.box.join(' ')); }
  }
  function markPoints() {
    if (S.from) dot(S.from.lat, S.from.lng, { color: '#B5654A', label: 'Origen', perm: true });
    if (S.to) dot(S.to.lat, S.to.lng, { color: '#2E2A26', label: 'Destino', perm: true });
  }

  /* ---------- elegir punto en el mapa (clic derecho / mantener presionado / toque en el lienzo) ---------- */
  function pickMenu(lat, lng, x, y) {
    const old = $('pick'); if (old) old.remove();
    const d = document.createElement('div'); d.id = 'pick'; d.className = 'pick';
    d.style.left = Math.max(8, x - 10) + 'px'; d.style.top = Math.max(8, y - 10) + 'px';
    d.innerHTML = '<button data-w="from">Origen aquí</button><button data-w="to">Destino aquí</button><button data-w="x">Cancelar</button>';
    d.onclick = e => { const w = e.target.dataset.w; if (!w) return; d.remove(); if (w !== 'x') setPoint(w, { lat, lng, label: 'Punto en el mapa' }); };
    document.querySelector('#v-mapa, [data-screen="mapa"] .map').appendChild(d);
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const p = $('pick'); if (p) p.remove(); const s = $('suggest'); if (s) s.hidden = true; } });

  /* ---------- puntos y buscador de lugares ---------- */
  function setPoint(w, p) {
    S[w] = p; $(w === 'from' ? 'from' : 'to').value = p.label; const s = $('suggest'); if (s) s.hidden = true;
    redraw(); if (S.from && S.to) runPlan(); else msg('Falta el ' + (S.from ? 'destino' : 'origen') + '. Escribe un lugar, usa el GPS o mantén presionado el mapa.');
  }
  function redraw() { clearFg(); markPoints(); const pts = [S.from, S.to].filter(Boolean).map(p => [p.lat, p.lng]); if (pts.length === 1 && M.kind === 'leaflet') window.movixMap.setView(pts[0], 15); else if (pts.length === 2 && !S.res) fit(pts); }
  function msg(t, err) { const r = $('plan-results'); if (!r) return; r.innerHTML = t ? `<div class="banner${err ? ' error' : ''}" style="margin:0 0 10px">${t}</div>` : ''; $('sheet').classList.toggle('planning', !!t); }
  async function nominatim(q) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), 9000);
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=co&bounded=1&viewbox=-74.98,11.10,-74.62,10.82&q=' + encodeURIComponent(q), { signal: c.signal, headers: { Accept: 'application/json' } });
      if (!r.ok) throw 0; return (await r.json()).map(x => ({ lat: +x.lat, lng: +x.lon, label: x.display_name.split(',').slice(0, 3).join(',').trim(), full: x.display_name }));
    } finally { clearTimeout(t); }
  }
  let deb;
  function onType(w) {
    S.focus = w; S[w] = null; clearTimeout(deb); const q = $(w).value.trim(), box = $('suggest');
    if (q.length < 3) { if (w === 'from') showSuggest(w, [], '', true); else box.hidden = true; return; }
    box.hidden = false; box.innerHTML = '<div class="muted" style="padding:10px">Buscando…</div>';
    deb = setTimeout(async () => {
      try { showSuggest(w, await nominatim(q + ', Barranquilla'), q, w === 'from'); }
      catch { box.hidden = false; box.innerHTML = '<div class="muted" style="padding:10px">No se pudo consultar el buscador de direcciones (sin conexión o servicio bloqueado). Mantén presionado el mapa para elegir el punto.</div>'; }
    }, 600);
  }
  function showSuggest(w, items, q, gps) {
    const box = $('suggest'); box.hidden = false; S.sug = items;
    box.innerHTML = (gps ? '<button class="sg" data-i="gps">⌖ <b>Mi ubicación (GPS)</b></button>' : '') +
      items.map((x, i) => `<button class="sg" data-i="${i}">⌕ <span>${esc(x.label)}</span></button>`).join('') +
      (q && !items.length ? '<div class="muted" style="padding:10px">Sin coincidencias. Prueba con otro nombre o elige el punto en el mapa.</div>' : '');
  }
  $('suggest')?.addEventListener('click', e => {
    const b = e.target.closest('.sg'); if (!b) return; const w = S.focus;
    if (b.dataset.i === 'gps') return gps(); setPoint(w, S.sug[+b.dataset.i]);
  });
  function gps() {
    if (!navigator.geolocation) return msg('Este navegador no permite ubicación. Escribe tu origen o elígelo en el mapa.', true);
    msg('Solicitando tu ubicación…');
    navigator.geolocation.getCurrentPosition(p => setPoint('from', { lat: p.coords.latitude, lng: p.coords.longitude, label: 'Mi ubicación' }),
      e => msg(e.code === 1 ? 'Permiso de ubicación denegado. Escribe tu origen o elígelo en el mapa.' : 'No se pudo obtener tu ubicación.', true), { enableHighAccuracy: true, timeout: 12000 });
  }

  /* ---------- planificación y resultados ---------- */
  const noGeo = () => `<div class="notice" style="margin:0"><b>Faltan los trazados oficiales</b><br>Para decir qué bus te sirve Movix necesita el recorrido de cada ruta (archivo <code>data/rutas_amb.geojson</code>). Sin él no calcula rutas y no inventa ninguna.<br><button class="secondary" style="margin-top:10px" id="load-test">Probar con datos de prueba (NO son rutas reales)</button></div>`;
  async function runPlan() {
    if (S.status === 'loading') await loadGeo();
    if (!S.paths) { const r = $('plan-results'); r.innerHTML = noGeo(); $('sheet').classList.add('planning'); $('load-test').onclick = () => setTest(true); return; }
    S.res = P.plan(S.paths, S.from, S.to, {}); clearFg(); markPoints(); render(S.res);
  }
  function title(path) {
    const c = catalog(path.route.id), nm = c && (c.publicName || c.destination);
    return { code: path.route.id, name: nm || path.route.label, op: pretty((c && c.operator) || path.route.operator) };
  }
  function legHtml(path, extra) {
    const t = title(path); return `<b>${esc(t.name !== t.code ? t.name : 'Ruta ' + t.code)}</b><span>${esc(t.code)} · ${esc(t.op)}${extra || ''}</span>`;
  }
  function render(res) {
    const r = $('plan-results'), test = S.test ? '<div class="banner error" style="margin:0 0 10px"><b>DATOS DE PRUEBA.</b> Estas rutas no existen.</div>' : '';
    const D = res.direct, T = res.transfers;
    let h = test + `<div class="section" style="margin-top:0">${D.length ? D.length + (D.length === 1 ? ' bus directo' : ' buses directos') : 'Sin bus directo'}</div>`;
    h += D.map((x, i) => `<button class="opt" data-k="d${i}"><div class="item-main">${legHtml(x.path)}<span class="walk">Camina ${fmt(x.walkO)} · viaja ~${fmt(x.ride)} · camina ${fmt(x.walkD)}</span></div><span class="chev">›</span></button>`).join('');
    if (!D.length) h += '<p class="muted">Ningún trazado publicado pasa cerca de ambos puntos en ese sentido (máximo ' + fmt(res.opts.walk) + ' a pie).</p>';
    const tr = T.map((x, i) => `<button class="opt" data-k="t${i}"><div class="item-main">${legHtml(x.a.path)}<span>luego</span>${legHtml(x.b.path)}<span class="walk">Camina ${fmt(x.walkO)} · transbordo a ${fmt(x.walkT)} · camina ${fmt(x.walkD)}</span></div><span class="chev">›</span></button>`).join('');
    if (!T.length) h += '<div class="section">Sin opciones con transbordo</div>';
    else if (!D.length) h += `<div class="section">Con 1 transbordo</div>${tr}`;
    else h += `<details class="more-opts"><summary>Ver ${T.length} ${T.length === 1 ? 'opción' : 'opciones'} con 1 transbordo</summary>${tr}</details>`;
    h += '<p class="muted">Distancias en línea recta sobre el trazado publicado. El “punto de abordaje” es el punto más cercano del trazado, <b>no un paradero verificado</b>; confirma el lado y la parada en la calle. Sin tiempos ni posición de buses.</p>';
    r.innerHTML = h; $('sheet').classList.add('planning'); $('trip').classList.add('compact'); r.scrollIntoView?.({ block: 'nearest' });
    if (D[0]) show('d0'); else if (T[0]) show('t0'); else fit([[S.from.lat, S.from.lng], [S.to.lat, S.to.lng]]);
  }
  function show(k) {
    const res = S.res, i = +k.slice(1); const all = [];
    if (M.kind === 'svg') { const x = k[0] === 'd' ? res.direct[i] : res.transfers[i], ps = k[0] === 'd' ? [x.path] : [x.a.path, x.b.path];
      fit([[S.from.lat, S.from.lng], [S.to.lat, S.to.lng], ...ps.flatMap(p => [P.toLL(p.pts[0][0], p.pts[0][1]), P.toLL(p.pts[p.pts.length - 1][0], p.pts[p.pts.length - 1][1])])]); }
    clearFg();
    $('plan-results').querySelectorAll('.opt').forEach(b => b.classList.toggle('on', b.dataset.k === k));
    const leg = (p, s0, s1, color) => { const ll = P.slice(p, Math.min(s0, s1), Math.max(s0, s1)); line(P.slice(p, 0, p.length), { color, w: 3, op: .35 }); line(ll, { color, w: 6 }); all.push(...ll); };
    if (k[0] === 'd') { const x = res.direct[i]; leg(x.path, x.sO, x.sD, '#B5654A'); const a = P.toLL(x.board.x, x.board.y), b = P.toLL(x.alight.x, x.alight.y);
      dot(a[0], a[1], { color: '#D9A24B', r: 7, label: 'Sube aquí (más cercano del trazado)' }); dot(b[0], b[1], { color: '#6E9B8C', r: 7, label: 'Baja aquí' }); }
    else { const x = res.transfers[i]; leg(x.a.path, x.a.s0, x.a.s1, '#B5654A'); leg(x.b.path, x.b.s0, x.b.s1, '#6E9B8C');
      const a = P.toLL(x.a.board.x, x.a.board.y), t = P.toLL(x.a.leave.x, x.a.leave.y), b = P.toLL(x.b.alight.x, x.b.alight.y);
      dot(a[0], a[1], { color: '#D9A24B', r: 7, label: 'Sube aquí' }); dot(t[0], t[1], { color: '#2E2A26', r: 7, label: 'Transbordo' }); dot(b[0], b[1], { color: '#6E9B8C', r: 7, label: 'Baja aquí' }); }
    markPoints(); all.push([S.from.lat, S.from.lng], [S.to.lat, S.to.lng]); if (M.kind === 'leaflet') fit(all);
  }
  $('plan-results')?.addEventListener('click', e => { const b = e.target.closest('.opt'); if (b) show(b.dataset.k); });

  /* ---------- carga de trazados ---------- */
  function apply(fc, test) {
    S.routes = P.fromGeoJSON(fc); S.paths = P.prepare(S.routes); S.status = 'ok'; S.test = !!test; drawBackground(); geoBadge();
  }
  async function loadGeo() {
    if (window.__FIXTURE && window.__USE_FIXTURE) return apply(window.__FIXTURE, true);
    try { const r = await fetch('data/rutas_amb.geojson', { cache: 'no-cache' }); if (!r.ok) throw 0; apply(await r.json(), false); }
    catch { S.status = 'missing'; S.paths = null; geoBadge(); }
  }
  async function setTest(on) {
    if (!on) { S.test = false; S.paths = null; S.status = 'loading'; await loadGeo(); clearFg(); if (M.bg) M.bg.innerHTML = ''; if (S.from && S.to) runPlan(); return; }
    try { const fc = window.__FIXTURE || await (await fetch('tests/fixture-prueba.geojson')).json(); apply(fc, true);
      const a = fc.features.flatMap(f => f.geometry.coordinates);
      S.from = { lat: 10.9905, lng: -74.825, label: 'Origen de prueba' }; S.to = { lat: 10.9905, lng: -74.785, label: 'Destino de prueba' };
      $('from').value = S.from.label; $('to').value = S.to.label; runPlan();
    } catch { msg('No se pudieron cargar los datos de prueba.', true); }
  }
  function geoBadge() {
    const el = $('geo-status'), note = document.querySelector('.map-empty');
    const t = S.status === 'ok' ? (S.test ? '<b>Modo de prueba activo:</b> ' + S.routes.length + ' trazados SINTÉTICOS (no son rutas reales).' : '<b>' + S.routes.length + ' trazados oficiales cargados</b> desde <code>data/rutas_amb.geojson</code>. Fuente: AMB (visor de rutas). Uso personal y no comercial con crédito.')
      : '<b>Sin trazados cargados.</b> Falta <code>data/rutas_amb.geojson</code>; el planificador no calcula rutas hasta tenerlo.';
    if (el) el.innerHTML = t + (S.status === 'ok' && S.test ? '<br><button class="secondary" style="margin-top:8px" id="test-off">Salir del modo de prueba</button>' : S.status !== 'ok' ? '<br><button class="secondary" style="margin-top:8px" id="test-on">Probar con datos de prueba (NO reales)</button>' : '');
    $('test-on') && ($('test-on').onclick = () => { setTest(true); go('mapa'); }); $('test-off') && ($('test-off').onclick = () => setTest(false));
    if (note) note.textContent = S.status === 'ok' ? (S.test ? 'MODO DE PRUEBA: trazados sintéticos, no reales.' : 'Trazados: AMB. Toca y mantén el mapa para elegir origen o destino.') : 'Sin trazados cargados: el mapa no dibuja recorridos. Mantén presionado para elegir puntos.';
  }
  document.addEventListener('click', e => { if (e.target && e.target.id === 'load-test') setTest(true); });

  /* ---------- directorio de empresas (todas las del catálogo AMB + Transmetro) ---------- */
  function companies() {
    const host = $('company-directory'); if (!host || !OR().length) return;
    const by = {}; OR().filter(r => r.system === 'TPC AMB').forEach(r => (by[r.operator] = by[r.operator] || []).push(r));
    const names = Object.keys(by).sort((a, b) => by[b].length - by[a].length || a.localeCompare(b));
    const priv = n => OSRC().find(s => P.normId(s.name) === P.normId(n));
    const tm = OR().filter(r => r.system === 'Transmetro');
    $('company-count').textContent = `${names.length} empresas de transporte colectivo (TPC) en el catálogo AMB, más Transmetro. Pendiente de verificar su estado operativo vigente.`;
    host.innerHTML = names.map(n => { const s = priv(n); return `<button class="source-card" data-op="${esc(n)}" style="text-align:left;width:100%"><b>${esc(pretty(n))}</b><span>${by[n].length} ${by[n].length === 1 ? 'ruta catalogada' : 'rutas catalogadas'} (${by[n].slice(0, 4).map(r => esc(r.id)).join(', ')}${by[n].length > 4 ? '…' : ''})${s ? '<br>Sitio del operador: <u>' + esc(s.status) + '</u>' : ''}</span><i class="source-status pending">catálogo AMB · foto pendiente</i></button>`; }).join('') +
      `<button class="source-card" data-op="Transmetro" style="text-align:left;width:100%"><b>Transmetro</b><span>${tm.length} rutas alimentadoras catalogadas · sistema masivo</span><i class="source-status">fuente oficial</i></button>`;
    host.onclick = e => { const b = e.target.closest('[data-op]'); if (!b) return; const d = $('destination'); if (d) d.value = b.dataset.op; go('busqueda'); searchRoutes(); };
  }

  /* ---------- eventos ---------- */
  $('from')?.addEventListener('input', () => onType('from')); $('to')?.addEventListener('input', () => onType('to'));
  $('trip')?.addEventListener('focusin', () => $('trip').classList.remove('compact'));
  $('from')?.addEventListener('focus', () => { S.focus = 'from'; if (!$('from').value) showSuggest('from', [], '', true); });
  $('to')?.addEventListener('focus', () => { S.focus = 'to'; });
  $('from-gps')?.addEventListener('click', () => { S.focus = 'from'; gps(); });
  $('swap')?.addEventListener('click', () => { const a = S.from, b = S.to; S.from = b; S.to = a; $('from').value = b ? b.label : ''; $('to').value = a ? a.label : ''; redraw(); if (S.from && S.to) runPlan(); });
  $('clear-plan')?.addEventListener('click', () => { $('trip').classList.remove('compact'); S.from = S.to = S.res = null; $('from').value = $('to').value = ''; clearFg(); msg(''); $('sheet').classList.remove('planning'); });
  $('plan-btn')?.addEventListener('click', async () => {
    for (const w of ['from', 'to']) { if (!S[w] && $(w).value.trim().length > 2) { try { const r = await nominatim($(w).value + ', Barranquilla'); if (r[0]) S[w] = r[0]; } catch { return msg('No se pudo consultar el buscador de direcciones. Elige los puntos con GPS o mantén presionado el mapa.', true); } } }
    if (!S.from || !S.to) return msg('Indica origen y destino (escribe un lugar, usa el GPS o mantén presionado el mapa).', true);
    redraw(); runPlan();
  });

  mapInit(); companies(); loadGeo().then(() => { if (S.status !== 'ok') geoBadge(); });
})();
