/* Planificador de viaje de Movix: origen + destino -> rutas que sirven (directas y con 1 transbordo).
   Solo usa trazados publicados. Sin trazados cargados, lo dice y no inventa nada. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), P = window.MovixPlanner;
  const S = { routes: null, paths: null, status: 'loading', test: false, from: null, to: null, res: null, focus: 'to', t: 0 };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = m => m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(m / 10) * 10 + ' m';
  const OR = () => (typeof OFFICIAL_ROUTES !== 'undefined' ? OFFICIAL_ROUTES : []), OSRC = () => (typeof OPERATOR_SOURCES !== 'undefined' ? OPERATOR_SOURCES : []);
  const nid = P.normId, SUF = /^[A-Z]{1,2}$/;
  const catalog = gid => { const g = nid(gid), L = OR().filter(r => r.system === 'TPC AMB'); return L.find(r => nid(r.id) === g) || L.find(r => { const c = nid(r.id); return c.startsWith(g) && SUF.test(c.slice(g.length)); }); };
  const geoFor = cid => { if (!S.paths || S.test) return null; const c = nid(cid); return S.paths.find(p => nid(p.route.id) === c) || S.paths.find(p => { const g = nid(p.route.id); return c.startsWith(g) && SUF.test(c.slice(g.length)); }) || null; };
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
      host.insertAdjacentHTML('beforeend', '<div id="svg-note" class="svg-note"><b>El mapa de calles no se puede cargar aquí.</b><br>Esta vista previa bloquea los mapas externos. En tu propio sitio con HTTPS verás las calles de OpenStreetMap. Toca el lienzo para elegir origen o destino.</div>');
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
    if (!S.paths) return; setView(S.paths); const n = document.getElementById('svg-note'); if (n) n.style.display = 'none';
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
  function howto() { return '<div class="howto" style="background:var(--blanco);border:1px solid var(--gris);border-radius:15px;padding:14px;margin:0 0 12px"><b>Cómo planear tu viaje</b><ol><li>Elige tu <b>origen</b>: escribe un lugar, usa el GPS (⌖) o mantén presionado el mapa.</li><li>Elige tu <b>destino</b> de la misma forma.</li><li>Pulsa <b>Buscar rutas</b> y toca una opción para verla en el mapa.</li></ol><p class="muted" style="margin:8px 0 0">Solo usa trazados oficiales del AMB. Los puntos de abordaje no están verificados.</p></div>'; }
  function msg(t, err) { const r = $('plan-results'); if (!r) return; r.innerHTML = t ? `<div class="banner${err ? ' error' : ''}" style="margin:0 0 10px">${t}</div>` : howto(); $('sheet').classList.toggle('planning', !!t); }
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
  /* ---------- resultados ---------- */
  function title(path) {
    const c = catalog(path.route.id), nm = c && (c.publicName || c.destination);
    return { code: (c && c.id) || path.route.id, name: nm || path.route.label, op: pretty(path.route.operator || (c && c.operator)) };
  }
  function legHtml(path) {
    const t = title(path); return `<b>${esc(t.name !== t.code ? t.name : 'Ruta ' + t.code)}</b><span>${esc(t.code)} · ${esc(t.op)}</span>`;
  }
  function moreHtml(path) {
    const c = catalog(path.route.id), t = title(path);
    const al = c && c.aliases && c.aliases.length ? `<p><b>Sectores que menciona el AMB:</b> ${c.aliases.map(esc).join(', ')}.</p>` : '';
    const named = t.name !== t.code; return `<div class="opt-more"><p><b>Cómo reconocerlo:</b> ${named ? esc(t.name) + ' · código ' + esc(t.code) : 'por su código <b>' + esc(t.code) + '</b>'} (${esc(t.op)}).</p>${al}<p class="muted">${named ? 'Nombre publicado por el AMB; no se confirma que sea el letrero del bus.' : 'El AMB no publica un nombre para esta ruta.'} Ante la duda, pregunta al conductor.</p><button class="primary" data-ficha="${esc(c ? c.id : path.route.id)}" data-op="${esc(c ? c.operator : '')}">Ver información de la ruta</button></div>`;
  }
  const head = txt => `<div class="res-head"><b>${txt}</b><button class="tog" aria-expanded="true" aria-label="Ocultar o mostrar los resultados"><span class="tl">Ocultar</span> <span aria-hidden="true">▾</span></button></div>`;
  function setCollapsed(c) {
    $('sheet').classList.toggle('collapsed', c); const b = document.querySelector('#plan-results .tog');
    if (b) { b.setAttribute('aria-expanded', String(!c)); b.querySelector('.tl').textContent = c ? 'Mostrar' : 'Ocultar'; }
  }
  function render(res) {
    const r = $('plan-results'), test = S.test ? '<div class="banner error" style="margin:0 0 10px"><b>DATOS DE PRUEBA.</b> Estas rutas no existen.</div>' : '';
    const D = res.direct, T = res.transfers, n = D.length;
    let h = head(n ? n + (n === 1 ? ' bus directo' : ' buses directos') : 'Sin bus directo') + test;
    h += D.map((x, i) => `<div class="opt" data-k="d${i}"><div class="opt-main" role="button" tabindex="0" data-k="d${i}"><div class="item-main">${legHtml(x.path)}<span class="walk">Camina ${fmt(x.walkO)} · viaja ~${fmt(x.ride)} · camina ${fmt(x.walkD)}</span></div><span class="chev">›</span></div>${moreHtml(x.path)}</div>`).join('');
    if (!n) h += '<p class="muted">' + (!res.nearO ? 'Ningún trazado publicado pasa a menos de ' + fmt(res.opts.walk) + ' de tu <b>origen</b>.' : !res.nearD ? 'Ningún trazado publicado pasa a menos de ' + fmt(res.opts.walk) + ' de tu <b>destino</b>.' : 'Hay ' + res.nearO + ' trazados cerca del origen y ' + res.nearD + ' cerca del destino, pero ninguno los une en su sentido de circulación.') + ' Prueba mover algún punto.</p>';
    const tr = T.map((x, i) => `<div class="opt" data-k="t${i}"><div class="opt-main" role="button" tabindex="0" data-k="t${i}"><div class="item-main">${legHtml(x.a.path)}<span>luego</span>${legHtml(x.b.path)}<span class="walk">Camina ${fmt(x.walkO)} · transbordo a ${fmt(x.walkT)} · camina ${fmt(x.walkD)}</span></div><span class="chev">›</span></div>${moreHtml(x.a.path)}${moreHtml(x.b.path)}</div>`).join('');
    if (!T.length) h += '<div class="section">Sin opciones con transbordo</div>';
    else if (!n) h += `<div class="section">Con 1 transbordo</div>${tr}`;
    else h += `<details class="more-opts"><summary>Ver ${T.length} ${T.length === 1 ? 'opción' : 'opciones'} con 1 transbordo</summary>${tr}</details>`;
    h += '<p class="muted"><span class="lg bus"></span> línea continua: recorrido del bus · <span class="lg walk"></span> línea discontinua: a pie. Puedes subir al bus en cualquier punto de su recorrido, en un lugar seguro donde pueda detenerse; “Sube aquí” es el punto del recorrido más cercano a ti. Confirma el sentido de la vía antes de esperar. Los trazados son del KMZ oficial del AMB (' + S.routes.length + ' publicados) y pueden no ser la versión operativa más reciente. Distancias en línea recta; sin tiempos ni posición de buses.</p>';
    r.innerHTML = h; $('sheet').classList.add('planning'); $('trip').classList.add('compact'); setCollapsed(false);
    if (D[0]) show('d0'); else if (T[0]) show('t0'); else fit([[S.from.lat, S.from.lng], [S.to.lat, S.to.lng]]);
  }
  function show(k) {
    const res = S.res, i = +k.slice(1), isD = k[0] === 'd', x = isD ? res.direct[i] : res.transfers[i]; S.sel = k;
    $('plan-results').querySelectorAll('.opt').forEach(b => b.classList.toggle('on', b.dataset.k === k));
    const legs = isD ? [[x.path, x.sO, x.sD, '#B5654A']] : [[x.a.path, x.a.s0, x.a.s1, '#B5654A'], [x.b.path, x.b.s0, x.b.s1, '#356355']];
    const slices = legs.map(l => P.slice(l[0], l[1], l[2])), all = [[S.from.lat, S.from.lng], [S.to.lat, S.to.lng]].concat(...slices);
    if (M.kind === 'svg') fit(all);
    clearFg();
    const ll = o => P.toLL(o.x, o.y), walk = (a, b) => line([a, b], { color: '#2E2A26', w: 4, dash: '2 9' });
    legs.forEach((l, j) => { line(P.slice(l[0], 0, l[0].length), { color: l[3], w: 3, op: .4 }); line(slices[j], { color: l[3], w: 6 }); });
    if (isD) { const a = ll(x.board), b = ll(x.alight);
      walk([S.from.lat, S.from.lng], a); walk(b, [S.to.lat, S.to.lng]);
      dot(a[0], a[1], { color: '#D9A24B', r: 7, label: 'Sube aquí' }); dot(b[0], b[1], { color: '#356355', r: 7, label: 'Baja aquí' }); }
    else { const a = ll(x.a.board), t = ll(x.a.leave), tb = ll(x.b.board), b = ll(x.b.alight);
      walk([S.from.lat, S.from.lng], a); walk(t, tb); walk(b, [S.to.lat, S.to.lng]);
      dot(a[0], a[1], { color: '#D9A24B', r: 7, label: 'Sube aquí' }); dot(t[0], t[1], { color: '#2E2A26', r: 7, label: 'Baja (transbordo)' }); dot(tb[0], tb[1], { color: '#2E2A26', r: 7, label: 'Sube al 2.º bus' }); dot(b[0], b[1], { color: '#356355', r: 7, label: 'Baja aquí' }); }
    markPoints(); if (M.kind === 'leaflet') fit(all);
  }
  const pl = $('plan-results');
  pl?.addEventListener('click', e => {
    if (e.target.closest('.tog')) return setCollapsed(!$('sheet').classList.contains('collapsed'));
    const f = e.target.closest('[data-ficha]'); if (f) return window.showDetail(f.dataset.ficha, f.dataset.op || undefined);
    const b = e.target.closest('.opt-main'); if (b) show(b.dataset.k);
  });
  pl?.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('opt-main')) { e.preventDefault(); show(e.target.dataset.k); } });
  document.querySelector('#sheet .handle')?.addEventListener('click', () => { if ($('sheet').classList.contains('planning')) setCollapsed(!$('sheet').classList.contains('collapsed')); });

  /* ---------- ficha completa de la ruta (con mapa del recorrido completo) ---------- */
  function mkView(host) {
    if (window.L) {
      host.innerHTML = ''; if (S.dmap) { try { S.dmap.remove(); } catch (e) {} }
      const m = L.map(host, { scrollWheelZoom: false }); S.dmap = m;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m); const g = L.layerGroup().addTo(m);
      return { line: (ll, o) => L.polyline(ll, { color: o.color, weight: o.w, opacity: o.op || 1, dashArray: o.dash || null, lineCap: 'round' }).addTo(g),
        dot: (la, lo, o) => L.circleMarker([la, lo], { radius: o.r || 7, color: '#fff', weight: 3, fillColor: o.color, fillOpacity: 1 }).bindTooltip(o.label || '', { permanent: !!o.label, direction: 'top' }).addTo(g),
        fit: lls => { m.fitBounds(L.latLngBounds(lls), { padding: [24, 24] }); setTimeout(() => m.invalidateSize(), 150); } };
    }
    host.innerHTML = '<svg role="img" aria-label="Mapa esquemático del recorrido" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;background:#F7F2EC"></svg>';
    const svg = host.firstChild, dots = [], add = (t, a) => { const e = svgEl(t, a); svg.appendChild(e); return e; };
    return { line: (ll, o) => add('polyline', { points: ll.map(q => { const p = P.toXY(q[0], q[1]); return p[0] + ',' + -p[1]; }).join(' '), fill: 'none', stroke: o.color, 'stroke-width': o.w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': o.dash || '', opacity: o.op || 1, 'vector-effect': 'non-scaling-stroke' }),
      dot: (la, lo, o) => dots.push([P.toXY(la, lo), o]),
      fit: lls => { const xy = lls.map(q => P.toXY(q[0], q[1])), x0 = Math.min(...xy.map(a => a[0])), x1 = Math.max(...xy.map(a => a[0])), y0 = Math.min(...xy.map(a => a[1])), y1 = Math.max(...xy.map(a => a[1])), px = Math.max(400, (x1 - x0) * .08), py = Math.max(400, (y1 - y0) * .08), b = [x0 - px, -(y1 + py), x1 - x0 + 2 * px, y1 - y0 + 2 * py], u = b[2] / 520;
        svg.setAttribute('viewBox', b.join(' ')); dots.forEach(([p, o]) => { add('circle', { cx: p[0], cy: -p[1], r: (o.r || 7) * u, fill: o.color, stroke: '#fff', 'stroke-width': 3 * u });
          if (o.label) { const t = add('text', { x: p[0] + 11 * u, y: -p[1] - 9 * u, 'font-size': 12 * u, fill: '#2E2A26', 'font-weight': 700, 'font-family': 'Inter,system-ui,sans-serif', stroke: '#F7F2EC', 'stroke-width': 3 * u, 'paint-order': 'stroke' }); t.textContent = o.label; } }); } };
  }
  function tripOf(gp) {
    if (!S.res || !S.from || !S.to || S.test) return null;
    const d = S.res.direct.find(x => x.path.route === gp.route); if (d) return { kind: 'd', x: d };
    const t = S.res.transfers.find(x => x.a.path.route === gp.route || x.b.path.route === gp.route); return t ? { kind: 't', x: t } : null;
  }
  window.showDetail = function (id, operator) {
    const c = OR().find(r => r.id === id && (!operator || r.operator === operator)) || OR().find(r => r.id === id) || catalog(id);
    const gp = geoFor(c ? c.id : id); if (!c && !gp) return;
    const code = c ? c.id : gp.route.id, op = pretty(c ? c.operator : gp.route.operator), sys = c ? c.system : 'TPC AMB';
    const name = (c && (c.publicName || c.destination)) || '', trip = gp && tripOf(gp), ph = c && c.photo;
    const km = gp ? (gp.length / 1000).toFixed(1).replace('.', ',') + ' km' : null, src = (c && (c.source || '')) || '';
    const usa = trip ? (trip.kind === 'd' ? `Camina ${fmt(trip.x.walkO)} hasta el punto del recorrido más cercano a tu origen, viaja ~${fmt(trip.x.ride)} y camina ${fmt(trip.x.walkD)} hasta tu destino.` : `Con transbordo: camina ${fmt(trip.x.walkO)}, cambia de bus a ${fmt(trip.x.walkT)} de distancia y camina ${fmt(trip.x.walkD)} al final.`) : 'Elige un origen y un destino en el mapa para ver cuánto caminar con esta ruta.';
    $('detail-content').innerHTML = `<div class="d-hero"><div class="d-top"><button class="icon-btn back" id="d-back" aria-label="Volver">‹</button><span class="d-src">Fuente oficial</span></div>
      <div class="d-title"><span class="d-code">${esc(code)}</span><div class="d-tx"><h2 class="d-name">${esc(name || 'Ruta ' + code)}</h2><div class="d-sub">${esc(op)} · ${esc(sys)}</div></div></div></div>
      <div class="d-body"><div class="d-map" id="d-map">${gp ? '' : '<div class="d-nomap">El trazado de esta ruta no está publicado en los archivos cargados. Consulta el visor oficial.</div>'}</div>
      ${gp ? `<div class="d-legend"><span class="lg bus"></span> Recorrido completo (ida y vuelta)${trip ? ' <span class="lg walk"></span> Caminata' : ''}</div>` : ''}
      <div class="d-chips"><div><b>${esc(op)}</b>Operador</div><div><b>${km || 'Sin trazado'}</b>${km ? 'Circuito completo' : 'Recorrido'}</div></div>
      <details class="acc" open><summary>Cómo reconocer este bus</summary><p>${name ? `<b>${esc(name)}</b><br>` : ''}Código de ruta: <b>${esc(code)}</b>.</p>${c && c.aliases && c.aliases.length ? `<p>Sectores que menciona el AMB: ${c.aliases.map(esc).join(', ')}.</p>` : ''}<p class="muted">${name ? 'Nombre publicado por el AMB; no se confirma que sea el letrero frontal del bus.' : 'El AMB no publica un nombre para esta ruta.'} Ante la duda, pregunta al conductor.</p>${ph ? `<img class="d-photo" src="${esc(ph.url)}" alt="Bus de referencia" loading="lazy"><p class="muted">${esc(ph.attribution)} · ${esc(ph.license)} · <a href="${esc(ph.page)}" target="_blank" rel="noopener">ver licencia</a><br>${esc(ph.note || '')}</p>` : ''}</details>
      <details class="acc"><summary>Cómo usar esta ruta</summary><p>${usa}</p><p class="muted">Puedes subir en cualquier punto del recorrido, en un lugar seguro donde el bus pueda detenerse. Confirma el sentido de la vía antes de esperar.</p></details>
      <details class="acc"><summary>Fuentes y avisos</summary>${src ? `<p><a href="${esc(src)}" target="_blank" rel="noopener">Fuente oficial de la ruta</a></p>` : ''}<p class="muted">${gp ? 'Trazado del KMZ oficial del AMB; puede no ser la versión operativa más reciente. ' : ''}Sin horarios, tiempos de llegada ni posición de buses: no hay una fuente oficial en tiempo real.</p></details></div>`;
    $('d-back').onclick = () => go(S.res ? 'mapa' : 'busqueda'); go('detalle');
    if (!gp) return;
    setTimeout(() => {
      const v = mkView($('d-map')), full = P.slice(gp, 0, gp.length), all = full.slice();
      v.line(full, { color: '#A5573D', w: 4, op: trip ? .55 : .95 });
      if (trip) { const ll = o => P.toLL(o.x, o.y), walk = (a, b) => v.line([a, b], { color: '#2E2A26', w: 4, dash: '2 9' }), x = trip.x, F = [S.from.lat, S.from.lng], T = [S.to.lat, S.to.lng];
        if (trip.kind === 'd') { const a = ll(x.board), b = ll(x.alight); v.line(P.slice(x.path, x.sO, x.sD), { color: '#7A3A26', w: 7 }); walk(F, a); walk(b, T);
          v.dot(F[0], F[1], { color: '#B5654A', label: 'Origen' }); v.dot(T[0], T[1], { color: '#2E2A26', label: 'Destino' }); v.dot(a[0], a[1], { color: '#D9A24B', label: 'Sube aquí' }); v.dot(b[0], b[1], { color: '#356355', label: 'Baja aquí' }); all.push(F, T, a, b); }
        else { const a = ll(x.a.board), t = ll(x.a.leave), tb = ll(x.b.board), b = ll(x.b.alight);
          v.line(P.slice(x.a.path, x.a.s0, x.a.s1), { color: '#7A3A26', w: 7 }); v.line(P.slice(x.b.path, x.b.s0, x.b.s1), { color: '#356355', w: 7 }); walk(F, a); walk(t, tb); walk(b, T);
          v.dot(F[0], F[1], { color: '#B5654A', label: 'Origen' }); v.dot(T[0], T[1], { color: '#2E2A26', label: 'Destino' }); all.push(F, T, a, b, t, tb); } }
      v.fit(all);
    }, 80);
  };


  /* ---------- carga de trazados ---------- */
  function apply(fc, test) {
    S.routes = P.fromGeoJSON(fc); S.paths = P.prepare(S.routes); S.meta = fc; S.status = 'ok'; S.test = !!test; drawBackground(); geoBadge(); companies();
  }
  async function loadGeo() {
    if (window.__GEO) return apply(window.__GEO, false);
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
    const t = S.status === 'ok' ? (S.test ? '<b>Modo de prueba activo:</b> ' + S.routes.length + ' trazados SINTÉTICOS (no son rutas reales).' : '<b>' + S.routes.length + ' trazados oficiales cargados</b> (KMZ publicados por el AMB' + (S.meta && S.meta.downloaded_at ? ', descargados el ' + esc(S.meta.downloaded_at) : '') + '). Cobertura parcial: el catálogo tiene ' + OR().filter(r => r.system === 'TPC AMB').length + ' rutas de buses y algunas no tienen trazado publicado. El AMB no publica una licencia de datos explícita: cita al AMB y verifica las condiciones antes de redistribuir o usar comercialmente.')
      : '<b>Sin trazados cargados.</b> Falta <code>data/rutas_amb.geojson</code>; el planificador no calcula rutas hasta tenerlo.';
    if (el) el.innerHTML = t + (S.status === 'ok' && S.test ? '<br><button class="secondary" style="margin-top:8px" id="test-off">Salir del modo de prueba</button>' : S.status !== 'ok' ? '<br><button class="secondary" style="margin-top:8px" id="test-on">Probar con datos de prueba (NO reales)</button>' : '');
    $('test-on') && ($('test-on').onclick = () => { setTest(true); go('mapa'); }); $('test-off') && ($('test-off').onclick = () => setTest(false));
    if (note) note.textContent = S.status === 'ok' ? (S.test ? 'MODO DE PRUEBA: trazados sintéticos, no reales.' : 'Trazados: AMB. Toca y mantén el mapa para elegir origen o destino.') : 'Sin trazados cargados: el mapa no dibuja recorridos. Mantén presionado para elegir puntos.';
  }
  document.addEventListener('click', e => { if (e.target && e.target.id === 'load-test') setTest(true); });

  /* ---------- directorio de empresas (todas las del catálogo AMB + Transmetro) ---------- */
  function companies() {
    const host = $('company-directory'); if (!host || !OR().length) return;
    const by = {}, geo = {}; OR().filter(r => r.system === 'TPC AMB').forEach(r => (by[r.operator] = by[r.operator] || []).push(r));
    if (S.paths && !S.test) S.routes.forEach(r => { geo[r.operator] = (geo[r.operator] || 0) + 1; by[r.operator] = by[r.operator] || []; });
    const names = Object.keys(by).sort((a, b) => (geo[b] || 0) - (geo[a] || 0) || by[b].length - by[a].length || a.localeCompare(b));
    const priv = n => OSRC().find(s => P.normId(s.name) === P.normId(n));
    const tm = OR().filter(r => r.system === 'Transmetro'), extra = names.filter(n => !OR().some(r => r.system === 'TPC AMB' && r.operator === n));
    $('company-count').textContent = `${names.length} empresas de transporte colectivo (TPC) en las fuentes del AMB, más Transmetro.` + (extra.length ? ` ${extra.map(pretty).join(' y ')} aparece${extra.length > 1 ? 'n' : ''} solo en los trazados del AMB, no en el catálogo.` : '') + ' Estado operativo vigente: pendiente de verificar.';
    host.innerHTML = names.map(n => { const s = priv(n), c = by[n].length, g = geo[n] || 0;
      return `<button class="source-card" data-op="${esc(n)}" style="text-align:left;width:100%"><b>${esc(pretty(n))}</b><span>${c ? c + (c === 1 ? ' ruta catalogada' : ' rutas catalogadas') : 'sin rutas en el catálogo'} · ${g ? g + (g === 1 ? ' con trazado' : ' con trazado') : 'sin trazado cargado'}${s ? '<br>Sitio del operador: <u>' + esc(s.status) + '</u>' : ''}</span><i class="source-status pending">AMB · foto pendiente</i></button>`; }).join('') +
      `<button class="source-card" data-op="Transmetro" style="text-align:left;width:100%"><b>Transmetro</b><span>${tm.length} rutas alimentadoras catalogadas · sin trazado cargado</span><i class="source-status">fuente oficial</i></button>`;
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

  window.MovixGeo = { latlngs: id => { const q = geoFor(id); return q ? P.slice(q, 0, q.length) : null; } };
  (function () { const sc = document.querySelector('[data-screen="mas"] .scroll'); if (!sc) return; let cur = null;
    [...sc.children].forEach(el => { if (el.classList.contains('section')) { cur = document.createElement('details'); cur.className = 'acc'; const sm = document.createElement('summary'); sm.textContent = el.textContent; cur.appendChild(sm); sc.insertBefore(cur, el); el.remove(); } else if (cur) cur.appendChild(el); }); })();
  msg(''); mapInit(); companies(); loadGeo().then(() => { if (S.status !== 'ok') geoBadge(); });
})();
