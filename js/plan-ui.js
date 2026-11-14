/* Planificador de viaje de Movix: origen + destino -> rutas que sirven (directas y con 1 transbordo).
   Solo usa trazados publicados. Sin trazados cargados, lo dice y no inventa nada. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), P = window.MovixPlanner;
  const S = { routes: null, paths: null, status: 'loading', test: false, from: null, to: null, res: null, focus: 'to', t: 0 };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = m => m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(m / 10) * 10 + ' m';
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), CT = () => css('--contorno'), CA = () => css('--caminata'), V = () => css('--vivo'), V2 = () => css('--vivo2'), VO = () => css('--vivo-osc');
  const OR = () => (typeof OFFICIAL_ROUTES !== 'undefined' ? OFFICIAL_ROUTES : []), OSRC = () => (typeof OPERATOR_SOURCES !== 'undefined' ? OPERATOR_SOURCES : []);
  const nid = P.normId, SUF = /^[A-Z]{1,2}$/;
  const catalog = gid => { const g = nid(gid), L = OR().filter(r => r.system === 'TPC AMB'); return L.find(r => nid(r.id) === g) || L.find(r => { const c = nid(r.id); return c.startsWith(g) && SUF.test(c.slice(g.length)); }); };
  const geoFor = cid => { if (!S.paths || S.test) return null; const c = nid(cid); return S.paths.find(p => nid(p.route.id) === c) || S.paths.find(p => { const g = nid(p.route.id); return c.startsWith(g) && SUF.test(c.slice(g.length)); }) || null; };
  const NOMBRES = { 'ALIANZA-SODIS': 'Alianza SODIS' };
  const pretty = n => NOMBRES[String(n || '').toUpperCase()] || String(n || '').toLowerCase().replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  /* ---------- botón «atrás» del celular: vuelve a la pantalla anterior dentro de la app ---------- */
  const NAV = { stack: ['mapa'], quiet: false };
  const pushCapa = n => { try { history.pushState({ mx: NAV.stack[NAV.stack.length - 1], i: NAV.stack.length - 1, capa: n }, ''); } catch (e) {} };
  const popCapa = n => { try { if (history.state && history.state.capa === n) history.back(); } catch (e) {} };
  (function () {
    if (!window.go || !history.pushState) return; const goOrig = window.go;
    try { history.replaceState({ mx: 'base', i: -1 }, ''); history.pushState({ mx: 'mapa', i: 0 }, ''); } catch (e) { return; }
    window.go = function (v) {
      const st = NAV.stack, prev = st[st.length - 1]; goOrig(v);
      if (NAV.quiet || v === prev) return;
      if (st.length > 1 && st[st.length - 2] === v) { history.back(); return; }
      st.push(v); history.pushState({ mx: v, i: st.length - 1 }, '');
    };
    function cerrarCapas() {
      let c = false; const g = $('galeria'); if (g) { g.remove(); c = true; }
      const m = $('modal'); if (m && m.classList.contains('open')) { m.classList.remove('open'); c = true; }
      const d = $('d-map'); if (d && d.classList.contains('full')) { cerrarMapaGrande(); c = true; } return c;
    }
    window.addEventListener('popstate', e => {
      const st = e.state; if (cerrarCapas() || !st) return;
      if (st.mx === 'base') {
        if (S.res || S.from || S.to) { $('clear-plan').click(); NAV.stack.length = 1; history.pushState({ mx: 'mapa', i: 0 }, ''); NAV.quiet = true; goOrig('mapa'); NAV.quiet = false; }
        else history.back();   // nada que cerrar: salir de la app
        return;
      }
      NAV.quiet = true; NAV.stack.length = st.i + 1; NAV.stack[st.i] = st.mx; goOrig(st.mx); NAV.quiet = false;
    });
    const mo = document.getElementById('modal');   // formulario de reporte: «atrás» lo cierra
    if (mo) new MutationObserver(() => { const ab = mo.classList.contains('open'); if (ab && !(history.state && history.state.capa === 'modal')) pushCapa('modal'); else if (!ab) popCapa('modal'); }).observe(mo, { attributes: true, attributeFilter: ['class'] });
  })();
  function cerrarMapaGrande() {
    const d = $('d-map'); if (!d) return; d.classList.remove('full');
    if (S.dmap && S.dmap.scrollWheelZoom) { S.dmap.scrollWheelZoom.disable(); setTimeout(() => { S.dmap.invalidateSize(); if (S.dlls) S.dmap.fitBounds(L.latLngBounds(S.dlls), { padding: [24, 24] }); }, 120); }
  }

  /* ---------- mapa: Leaflet si existe; si no, lienzo SVG con los trazados ---------- */
  const M = { kind: null, svg: null, bg: null, fg: null, box: null };
  function mapInit() {
    const host = $('leaflet-map'); if (!host) return;
    if (window.L && window.movixMap) {
      M.kind = 'leaflet'; M.group = L.layerGroup().addTo(window.movixMap);
      window.movixMap.on('contextmenu', e => pickMenu(e.latlng.lat, e.latlng.lng, e.containerPoint.x, e.containerPoint.y));
    } else {
      M.kind = 'svg'; host.innerHTML = '<svg id="svgmap" role="img" aria-label="Mapa esquemático sin teselas" xmlns="http://www.w3.org/2000/svg"><rect id="svgbg" style="fill:var(--hueso)"/><g id="bgl"></g><g id="fgl"></g></svg>';
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
    S.paths.forEach(p => M.bg.appendChild(svgEl('polyline', { points: p.pts.map(q => q[0] + ',' + -q[1]).join(' '), fill: 'none', stroke: css('--texto-suave'), 'stroke-width': 1.4, 'vector-effect': 'non-scaling-stroke', opacity: .55 })));
  }
  function clearFg() { if (M.kind === 'leaflet') M.group.clearLayers(); else if (M.fg) M.fg.innerHTML = ''; }
  function line(ll, o) {
    if (M.kind === 'leaflet') L.polyline(ll, { color: o.color, weight: o.w, opacity: o.op || 1, dashArray: o.dash || null }).addTo(M.group);
    else M.fg.appendChild(svgEl('polyline', { points: ll.map(q => { const x = P.toXY(q[0], q[1]); return x[0] + ',' + -x[1]; }).join(' '), fill: 'none', stroke: o.color, 'stroke-width': o.w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': o.dash || '', opacity: o.op || 1, 'vector-effect': 'non-scaling-stroke' }));
  }
  function dot(lat, lng, o) {
    if (M.kind === 'leaflet') L.circleMarker([lat, lng], { radius: o.r || 8, color: '#fff', weight: 3, fillColor: o.color, fillOpacity: 1 }).bindTooltip(o.label || '', { permanent: !!o.perm, direction: 'top' }).addTo(M.group);
    else { const x = P.toXY(lat, lng), u = M.box[2] / 900; M.fg.appendChild(svgEl('circle', { cx: x[0], cy: -x[1], r: (o.r || 8) * u, fill: o.color, stroke: '#fff', 'stroke-width': 3 * u }));
      if (o.label) { const t = svgEl('text', { x: x[0] + 12 * u, y: -x[1] - 10 * u, 'font-size': 13 * u, fill: css('--carbon'), 'font-family': 'Inter,system-ui,sans-serif', 'font-weight': 700, stroke: css('--hueso'), 'stroke-width': 3 * u, 'paint-order': 'stroke' }); t.textContent = o.label; M.fg.appendChild(t); } }
  }
  function fit(lls) {
    if (!lls.length) return;
    if (M.kind === 'leaflet') window.movixMap.fitBounds(L.latLngBounds(lls), { padding: [50, 50], maxZoom: 16 });
    else { const xy = lls.map(q => P.toXY(q[0], q[1])), x0 = Math.min(...xy.map(a => a[0])), x1 = Math.max(...xy.map(a => a[0])), y0 = Math.min(...xy.map(a => a[1])), y1 = Math.max(...xy.map(a => a[1])), px = Math.max(500, (x1 - x0) * .25), py = Math.max(500, (y1 - y0) * .25);
      M.box = [x0 - px, -(y1 + py), x1 - x0 + 2 * px, y1 - y0 + 2 * py]; M.svg.setAttribute('viewBox', M.box.join(' ')); }
  }
  function markPoints() {
    if (S.from) dot(S.from.lat, S.from.lng, { color: V(), label: 'Origen', perm: true });
    if (S.to) dot(S.to.lat, S.to.lng, { color: CA(), label: 'Destino', perm: true });
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
  function msg(t, err) { const r = $('plan-results'); if (!r) return; r.innerHTML = t ? `<div class="banner${err ? ' error' : ''}" style="margin:0 0 10px">${t}</div>` : howto(); $('sheet').classList.toggle('planning', !!t); if (t) setSheet('mid'); else resetSheet(); }
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
  /* ---------- hoja inferior arrastrable (como Google Maps) ---------- */
  const sheet = $('sheet'), mq = window.matchMedia('(max-width:899px)'), scr = document.querySelector('.screen[data-screen="mapa"]');
  const SH = () => { const H = sheet.parentElement.clientHeight; return { peek: 96, mid: Math.round(H * .46), full: H - 70 }; };
  function setSheet(st, anim) {
    if (!mq.matches) { sheet.style.height = ''; scr.style.setProperty('--sheet-h', '0px'); return; }
    const h = SH()[st]; S.sst = st; sheet.style.transition = anim === false ? 'none' : 'height .22s ease'; sheet.style.height = h + 'px'; scr.style.setProperty('--sheet-h', h + 'px');
    if (M.kind === 'leaflet') setTimeout(() => window.movixMap.invalidateSize(), 250);
  }
  function resetSheet() { sheet.style.height = ''; sheet.style.transition = ''; scr.style.setProperty('--sheet-h', '0px'); }
  let drag = null;
  sheet.addEventListener('pointerdown', e => {
    if (!mq.matches || !sheet.classList.contains('planning') || !e.target.closest('.handle,.res-head')) return;
    drag = { y: e.clientY, h: sheet.getBoundingClientRect().height, t: Date.now(), moved: false }; sheet.setPointerCapture(e.pointerId); sheet.style.transition = 'none';
  });
  sheet.addEventListener('pointermove', e => {
    if (!drag) return; const H = sheet.parentElement.clientHeight, dy = drag.y - e.clientY; if (Math.abs(dy) > 5) drag.moved = true;
    const nh = Math.max(80, Math.min(H - 70, drag.h + dy)); sheet.style.height = nh + 'px'; scr.style.setProperty('--sheet-h', nh + 'px');
  });
  const endDrag = e => {
    if (!drag) return; const hs = SH(), cur = sheet.getBoundingClientRect().height, dy = drag.y - e.clientY, v = dy / Math.max(1, Date.now() - drag.t), order = ['peek', 'mid', 'full'], was = S.sst || 'mid', moved = drag.moved; drag = null;
    let to = order.reduce((a, k) => Math.abs(hs[k] - cur) < Math.abs(hs[a] - cur) ? k : a, 'peek');
    if (!moved) to = was === 'peek' ? 'mid' : was === 'mid' ? 'full' : 'mid';
    else if (to === was && Math.abs(v) > .6) to = order[Math.max(0, Math.min(2, order.indexOf(was) + (v > 0 ? 1 : -1)))];
    setSheet(to);
  };
  sheet.addEventListener('pointerup', endDrag); sheet.addEventListener('pointercancel', endDrag);
  window.addEventListener('resize', () => { if (sheet.classList.contains('planning')) setSheet(S.sst || 'mid', false); else resetSheet(); });

  /* ---------- caminata por las calles (ruta a pie de OpenStreetMap) ---------- */
  const WALK = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/', walkCache = new Map();
  function walkRoute(a, b) { // a, b: [lat, lng]
    const k = a.map(v => v.toFixed(5)) + '|' + b.map(v => v.toFixed(5)); if (walkCache.has(k)) return walkCache.get(k);
    const pr = (async () => {
      const c = new AbortController(), t = setTimeout(() => c.abort(), 9000);
      try {
        const r = await fetch(`${WALK}${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`, { signal: c.signal }); if (!r.ok) throw 0;
        const rt = ((await r.json()).routes || [])[0]; if (!rt) throw 0;
        return { ok: true, dist: rt.distance, ll: [a].concat(rt.geometry.coordinates.map(q => [q[1], q[0]]), [b]) };
      } catch (e) { walkCache.delete(k); const A = P.toXY(a[0], a[1]), B = P.toXY(b[0], b[1]); return { ok: false, dist: Math.hypot(A[0] - B[0], A[1] - B[1]), ll: [a, b] }; }
      finally { clearTimeout(t); }
    })();
    walkCache.set(k, pr); return pr;
  }
  window.MovixWalk = walkRoute;

  /* ---------- resultados ---------- */
  function title(path) {
    const c = catalog(path.route.id), nm = c && (c.publicName || c.destination);
    return { code: (c && c.id) || path.route.id, name: nm || path.route.label, op: pretty(path.route.operator || (c && c.operator)) };
  }
  function legHtml(path) {
    const t = title(path); return `<b>${esc(t.name !== t.code ? t.name : 'Ruta ' + t.code)}</b><span>${esc(t.code)} · ${esc(t.op)}</span>`;
  }
  const sinTexto = (alias, nombre) => (alias || []).filter(x => !norm(nombre).includes(norm(x)));
  const norm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function moreHtml(path) {
    const c = catalog(path.route.id), t = title(path), al = sinTexto(c && c.aliases, t.name);
    return `<div class="opt-more"><div class="opt-foto" data-ruta="${esc(c ? c.id : path.route.id)}"><p class="sin-foto">Buscando la foto…</p></div>${al.length ? `<p><b>Sectores que menciona el AMB:</b> ${al.map(esc).join(', ')}.</p>` : ''}<button class="primary" data-ficha="${esc(c ? c.id : path.route.id)}" data-op="${esc(c ? c.operator : '')}">Ver información de ${esc(t.code)}</button></div>`;
  }
  function cargarFotosOpt() {
    $('plan-results').querySelectorAll('.opt-foto[data-ruta]').forEach(box => fotosRuta(box.dataset.ruta).then(({ own }) => {
      if (!own.length) { box.innerHTML = '<p class="sin-foto">No se encontró la foto de este bus.</p>'; return; }
      box.innerHTML = `<button class="ft" type="button" aria-label="Ampliar foto"><img src="${esc(own[0].url)}" alt="${esc(tituloFoto(own[0]))}" loading="lazy"></button><small>${own.length} ${own.length === 1 ? 'foto' : 'fotos'} · toca para ampliar</small>`;
      box.querySelector('.ft').onclick = e => { e.stopPropagation(); galeria(own, 0); };
    }));
  }
  function stepsHtml(x) {
    const a = title(x.a.path), b = title(x.b.path), nm = t => t.name !== t.code ? t.name : 'Ruta ' + t.code;
    return `<div class="opt-more steps"><ol><li>Camina hasta el recorrido y <b>sube a ${esc(nm(a))}</b> (${esc(a.code)}).</li><li><b>Bájate</b> en el punto «Baja (transbordo)» del mapa.</li><li>Camina un poco y <b>sube a ${esc(nm(b))}</b> (${esc(b.code)}).</li><li><b>Bájate</b> en «Baja aquí» y camina hasta tu destino.</li></ol></div>`;
  }
  const head = txt => `<div class="res-head"><b>${txt}</b></div>`;
  const wTxt = (m, ok) => (ok ? '' : '≈') + fmt(m);
  function render(res) {
    const r = $('plan-results'), test = S.test ? '<div class="banner error" style="margin:0 0 10px"><b>DATOS DE PRUEBA.</b> Estas rutas no existen.</div>' : '';
    const D = res.direct, T = res.transfers.slice(0, 5), n = D.length, ext = res.expanded ? `<p class="muted" style="margin:0 0 8px">No hay rutas a menos de 600 m, así que se amplió la búsqueda a ${fmt(res.opts.walk)} a pie.</p>` : '';
    let h = head(n ? n + (n === 1 ? ' bus directo' : ' buses directos') : T.length ? 'Sin bus directo · opciones con transbordo' : 'Sin rutas') + test + ext;
    h += D.map((x, i) => `<div class="opt" data-k="d${i}"><div class="opt-main" role="button" tabindex="0" data-k="d${i}"><div class="item-main">${legHtml(x.path)}<span class="walk">Camina ≈${fmt(x.walkO)} · viaja ~${fmt(x.ride)} · camina ≈${fmt(x.walkD)}</span></div><span class="chev">›</span></div>${moreHtml(x.path)}</div>`).join('');
    if (!n && !T.length) h += '<p class="muted">' + (!res.nearO ? 'Ningún trazado publicado pasa a menos de ' + fmt(res.opts.walk) + ' de tu <b>origen</b>.' : !res.nearD ? 'Ningún trazado publicado pasa a menos de ' + fmt(res.opts.walk) + ' de tu <b>destino</b>.' : 'Hay ' + res.nearO + ' trazados cerca del origen y ' + res.nearD + ' cerca del destino, pero ninguno los une.') + ' Prueba mover algún punto.</p>';
    if (T.length) h += `<div class="section">${n ? 'Con 1 transbordo' : 'Sube a un bus, bájate y toma otro'}</div>` + T.map((x, i) => `<div class="opt" data-k="t${i}"><div class="opt-main" role="button" tabindex="0" data-k="t${i}"><div class="item-main">${legHtml(x.a.path)}<span>luego, en el transbordo</span>${legHtml(x.b.path)}<span class="walk">Camina ≈${fmt(x.walkO)} · cambio a ≈${fmt(x.walkT)} · camina ≈${fmt(x.walkD)}</span></div><span class="chev">›</span></div>${stepsHtml(x)}${moreHtml(x.a.path)}${moreHtml(x.b.path)}</div>`).join('');
    h += '<p class="muted"><span class="lg bus"></span> línea continua: recorrido del bus · <span class="lg walk"></span> línea discontinua: a pie por las calles. Puedes subir al bus en cualquier punto de su recorrido, en un lugar seguro donde pueda detenerse; “Sube aquí” es el punto del recorrido más cercano a ti. Confirma el sentido de la vía antes de esperar. Trazados del KMZ oficial del AMB (' + S.routes.length + ' publicados), que pueden no ser la versión operativa más reciente. “≈” = distancia en línea recta hasta que se calcule la caminata. Sin tiempos ni posición de buses.</p>';
    r.innerHTML = h; cargarFotosOpt(); r.scrollTop = 0; sheet.classList.add('planning'); $('trip').classList.add('compact'); setSheet('mid');
    if (D[0]) show('d0'); else if (T[0]) show('t0'); else fit([[S.from.lat, S.from.lng], [S.to.lat, S.to.lng]]);
  }
  function show(k) {
    const res = S.res, i = +k.slice(1), isD = k[0] === 'd', x = isD ? res.direct[i] : res.transfers[i]; S.sel = k; const tok = S.wt = (S.wt || 0) + 1;
    $('plan-results').querySelectorAll('.opt').forEach(b => b.classList.toggle('on', b.dataset.k === k));
    const legs = isD ? [[x.path, x.sO, x.sD, V()]] : [[x.a.path, x.a.s0, x.a.s1, V()], [x.b.path, x.b.s0, x.b.s1, V2()]];
    const slices = legs.map(l => P.slice(l[0], l[1], l[2])), all = [[S.from.lat, S.from.lng], [S.to.lat, S.to.lng]].concat(...slices);
    if (M.kind === 'svg') fit(all);
    clearFg();
    const ll = o => P.toLL(o.x, o.y);
    legs.forEach((l, j) => { line(P.slice(l[0], 0, l[0].length), { color: l[3], w: 3, op: .4 }); line(slices[j], { color: CT(), w: 11, op: .85 }); line(slices[j], { color: l[3], w: 7 }); });
    let pairs;
    if (isD) { const a = ll(x.board), b = ll(x.alight); pairs = [[[S.from.lat, S.from.lng], a, 'wo'], [b, [S.to.lat, S.to.lng], 'wd']];
      dot(a[0], a[1], { color: '#F2A900', r: 7, label: 'Sube aquí' }); dot(b[0], b[1], { color: '#0B8460', r: 7, label: 'Baja aquí' }); }
    else { const a = ll(x.a.board), t = ll(x.a.leave), tb = ll(x.b.board), b = ll(x.b.alight); pairs = [[[S.from.lat, S.from.lng], a, 'wo'], [t, tb, 'wt'], [b, [S.to.lat, S.to.lng], 'wd']];
      dot(a[0], a[1], { color: '#F2A900', r: 7, label: 'Sube aquí' }); dot(t[0], t[1], { color: CA(), r: 7, label: 'Baja (transbordo)' }); dot(tb[0], tb[1], { color: CA(), r: 7, label: 'Sube al 2.º bus' }); dot(b[0], b[1], { color: '#0B8460', r: 7, label: 'Baja aquí' }); }
    markPoints(); if (M.kind === 'leaflet') fit(all);
    Promise.all(pairs.map(p => walkRoute(p[0], p[1]))).then(rs => {
      if (tok !== S.wt) return; let bad = false;
      rs.forEach((w, j) => { line(w.ll, { color: CA(), w: 4, dash: w.ok ? '2 9' : '6 10', op: w.ok ? 1 : .55 }); if (!w.ok) bad = true; x[pairs[j][2] + 'R'] = w.dist; });
      const el = $('plan-results').querySelector(`.opt[data-k="${k}"] .walk`);
      if (el && !bad) el.textContent = isD ? `Camina ${fmt(x.woR)} · viaja ~${fmt(x.ride)} · camina ${fmt(x.wdR)}` : `Camina ${fmt(x.woR)} · cambio a ${fmt(x.wtR)} · camina ${fmt(x.wdR)}`;
      const nb = $('plan-results').querySelector('.walk-warn'); if (nb) nb.remove();
      if (bad) $('plan-results').querySelector('.res-head').insertAdjacentHTML('afterend', '<div class="banner error walk-warn" style="margin:0 0 8px">No se pudo calcular el camino a pie por las calles (sin conexión con el servicio de rutas a pie). La línea punteada es solo una aproximación en línea recta.</div>');
    });
  }
  const pl = $('plan-results');
  pl?.addEventListener('click', e => {
    const f = e.target.closest('[data-ficha]'); if (f) return window.showDetail(f.dataset.ficha, f.dataset.op || undefined);
    const b = e.target.closest('.opt-main'); if (b) show(b.dataset.k);
  });
  pl?.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('opt-main')) { e.preventDefault(); show(e.target.dataset.k); } });

  /* ---------- ficha completa de la ruta (con mapa del recorrido completo) ---------- */
  function mkView(host) {
    if (window.L) {
      host.innerHTML = ''; if (S.dmap) { try { S.dmap.remove(); } catch (e) {} }
      const m = L.map(host, { scrollWheelZoom: false, dragging: true, touchZoom: true, doubleClickZoom: true }); S.dmap = m;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m); const g = L.layerGroup().addTo(m);
      return { line: (ll, o) => L.polyline(ll, { color: o.color, weight: o.w, opacity: o.op || 1, dashArray: o.dash || null, lineCap: 'round' }).addTo(g),
        dot: (la, lo, o) => L.circleMarker([la, lo], { radius: o.r || 7, color: '#fff', weight: 3, fillColor: o.color, fillOpacity: 1 }).bindTooltip(o.label || '', { permanent: !!o.label, direction: 'top' }).addTo(g),
        fit: lls => { S.dlls = lls; m.fitBounds(L.latLngBounds(lls), { padding: [24, 24] }); setTimeout(() => m.invalidateSize(), 150); } };
    }
    host.innerHTML = '<svg role="img" aria-label="Mapa esquemático del recorrido" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;background:var(--hueso)"></svg>';
    const svg = host.firstChild, dots = [], add = (t, a) => { const e = svgEl(t, a); svg.appendChild(e); return e; };
    (function () { svg.style.touchAction = 'none'; const pts = new Map(), vb = () => svg.getAttribute('viewBox').split(' ').map(Number);   // mover y acercar con el dedo o el ratón
      const zoom = (f, cx, cy) => { const v = vb(), r = svg.getBoundingClientRect(), fx = (cx - r.left) / r.width, fy = (cy - r.top) / r.height, px = v[0] + fx * v[2], py = v[1] + fy * v[3]; v[2] *= f; v[3] *= f; v[0] = px - fx * v[2]; v[1] = py - fy * v[3]; svg.setAttribute('viewBox', v.join(' ')); };
      svg.addEventListener('pointerdown', e => { svg.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); });
      svg.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; const o = pts.get(e.pointerId), v = vb(), r = svg.getBoundingClientRect(), k = Math.max(v[2] / r.width, v[3] / r.height);
        if (pts.size === 1) { v[0] -= (e.clientX - o[0]) * k; v[1] -= (e.clientY - o[1]) * k; svg.setAttribute('viewBox', v.join(' ')); pts.set(e.pointerId, [e.clientX, e.clientY]); }
        else if (pts.size === 2) { const q = [...pts.entries()].find(([id]) => id !== e.pointerId)[1], d0 = Math.hypot(o[0] - q[0], o[1] - q[1]), d1 = Math.hypot(e.clientX - q[0], e.clientY - q[1]); pts.set(e.pointerId, [e.clientX, e.clientY]); if (d0 && d1) zoom(d0 / d1, (e.clientX + q[0]) / 2, (e.clientY + q[1]) / 2); } });
      const fin = e => pts.delete(e.pointerId); svg.addEventListener('pointerup', fin); svg.addEventListener('pointercancel', fin);
      svg.addEventListener('wheel', e => { if (!host.classList.contains('full')) return; e.preventDefault(); zoom(e.deltaY > 0 ? 1.2 : 1 / 1.2, e.clientX, e.clientY); }, { passive: false }); })();
    return { line: (ll, o) => add('polyline', { points: ll.map(q => { const p = P.toXY(q[0], q[1]); return p[0] + ',' + -p[1]; }).join(' '), fill: 'none', stroke: o.color, 'stroke-width': o.w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': o.dash || '', opacity: o.op || 1, 'vector-effect': 'non-scaling-stroke' }),
      dot: (la, lo, o) => dots.push([P.toXY(la, lo), o]),
      fit: lls => { const xy = lls.map(q => P.toXY(q[0], q[1])), x0 = Math.min(...xy.map(a => a[0])), x1 = Math.max(...xy.map(a => a[0])), y0 = Math.min(...xy.map(a => a[1])), y1 = Math.max(...xy.map(a => a[1])), px = Math.max(400, (x1 - x0) * .08), py = Math.max(400, (y1 - y0) * .08), b = [x0 - px, -(y1 + py), x1 - x0 + 2 * px, y1 - y0 + 2 * py], u = b[2] / 520;
        svg.setAttribute('viewBox', b.join(' ')); dots.forEach(([p, o]) => { add('circle', { cx: p[0], cy: -p[1], r: (o.r || 7) * u, fill: o.color, stroke: '#fff', 'stroke-width': 3 * u });
          if (o.label) { const t = add('text', { x: p[0] + 11 * u, y: -p[1] - 9 * u, 'font-size': 12 * u, fill: css('--carbon'), 'font-weight': 700, 'font-family': 'Inter,system-ui,sans-serif', stroke: css('--hueso'), 'stroke-width': 3 * u, 'paint-order': 'stroke' }); t.textContent = o.label; } }); } };
  }
  function tripOf(gp) {
    if (!S.res || !S.from || !S.to || S.test) return null;
    const d = S.res.direct.find(x => x.path.route === gp.route); if (d) return { kind: 'd', x: d };
    const t = S.res.transfers.find(x => x.a.path.route === gp.route || x.b.path.route === gp.route); return t ? { kind: 't', x: t } : null;
  }
  window.showDetail = function (id, operator) {
    S.lastDetail = [id, operator];
    const c = OR().find(r => r.id === id && (!operator || r.operator === operator)) || OR().find(r => r.id === id) || catalog(id);
    const gp = geoFor(c ? c.id : id); if (!c && !gp) return;
    const code = c ? c.id : gp.route.id, op = pretty(c ? c.operator : gp.route.operator), sys = c ? c.system : 'TPC AMB';
    const name = (c && (c.publicName || c.destination)) || '', trip = gp && tripOf(gp), ph = c && c.photo;
    const secs = sinTexto(c && c.aliases, name);
    const km = gp ? (gp.length / 1000).toFixed(1).replace('.', ',') + ' km' : null, src = (c && (c.source || '')) || '';
    const usa = trip ? (trip.kind === 'd' ? `Camina ${fmt(trip.x.walkO)} hasta el punto del recorrido más cercano a tu origen, viaja ~${fmt(trip.x.ride)} y camina ${fmt(trip.x.walkD)} hasta tu destino.` : `Con transbordo: camina ${fmt(trip.x.walkO)}, cambia de bus a ${fmt(trip.x.walkT)} de distancia y camina ${fmt(trip.x.walkD)} al final.`) : 'Elige un origen y un destino en el mapa para ver cuánto caminar con esta ruta.';
    $('detail-content').innerHTML = `<div class="d-hero"><div class="d-top"><button class="icon-btn back" id="d-back" aria-label="Volver">‹</button><span class="d-src">Fuente oficial</span></div>
      <div class="d-title"><span class="d-code">${esc(code)}</span><div class="d-tx"><h2 class="d-name">${esc(name || 'Ruta ' + code)}</h2><div class="d-sub">${esc(op)} · ${esc(sys)}</div></div></div></div>
      <div class="d-body">${gp ? '<button class="d-expand" id="d-expand" type="button">⤢ Ampliar mapa</button>' : ''}<div class="d-map" id="d-map">${gp ? '' : '<div class="d-nomap">El trazado de esta ruta no está publicado en los archivos cargados. Consulta el visor oficial.</div>'}</div><button class="d-cerrar" id="d-cerrar" type="button">✕ Cerrar mapa</button>
      ${gp ? `<div class="d-legend"><span class="lg bus"></span> Recorrido completo (ida y vuelta)${trip ? ' <span class="lg walk"></span> Caminata' : ''}</div>` : ''}
      <div class="d-chips"><div><b>${km || 'Sin trazado'}</b>${km ? 'Circuito completo (ida y vuelta)' : 'Recorrido'}</div></div>
      <details class="acc" open><summary>Cómo reconocer este bus</summary><div id="d-foto">${ph && c.system === 'Transmetro' ? `<img class="d-photo" src="${esc(ph.url)}" alt="Bus de Transmetro" loading="lazy"><p class="muted">${esc(ph.attribution)} · ${esc(ph.license)} · <a href="${esc(ph.page)}" target="_blank" rel="noopener">ver licencia</a><br>${esc(ph.note || '')}</p>` : '<p class="sin-foto">Buscando la foto…</p>'}</div>${secs.length ? `<p>Sectores que menciona el AMB: ${secs.map(esc).join(', ')}.</p>` : ''}<p class="muted">${name ? 'Nombre publicado por el AMB; no se confirma que sea el letrero frontal del bus.' : 'El AMB no publica un nombre para esta ruta.'} Ante la duda, pregunta al conductor.</p></details>
      <details class="acc"><summary>Cómo usar esta ruta</summary><p>${usa}</p><p class="muted">Puedes subir en cualquier punto del recorrido, en un lugar seguro donde el bus pueda detenerse. Confirma el sentido de la vía antes de esperar.</p></details>
      <details class="acc"><summary>Fuentes y avisos</summary>${src ? `<p><a href="${esc(src)}" target="_blank" rel="noopener">Fuente oficial de la ruta</a></p>` : ''}<p class="muted">${gp ? 'Trazado del KMZ oficial del AMB; puede no ser la versión operativa más reciente. ' : ''}Sin horarios, tiempos de llegada ni posición de buses: no hay una fuente oficial en tiempo real.</p></details></div>`;
    $('d-back').onclick = () => go(S.res ? 'mapa' : 'busqueda'); go('detalle');
    fotosRuta(code).then(({ own }) => { const box = $('d-foto'); if (!box) return;
      if (!own.length) { if (!(ph && c && c.system === 'Transmetro')) box.innerHTML = '<p class="sin-foto">No se encontró la foto de este bus.</p>'; return; }
      box.innerHTML = `<div class="d-galeria">${own.map((f, i) => `<button class="g-item" data-i="${i}" aria-label="Ampliar foto ${i + 1}"><img src="${esc(f.url)}" alt="${esc(tituloFoto(f))}" loading="lazy"></button>`).join('')}</div><p class="muted">${own.length} ${own.length === 1 ? 'foto' : 'fotos'} de la ruta ${esc(code)}. Toca una foto para ampliarla. ${[...new Set(own.map(f => fotoPie(f)))].join(' · ')}</p>`;
      box.querySelector('.d-galeria').addEventListener('click', e => { const g = e.target.closest('.g-item'); if (g) galeria(own, +g.dataset.i); }); });
    if (gp) { $('d-expand').onclick = () => { $('d-map').classList.add('full'); pushCapa('mapa'); if (S.dmap && S.dmap.scrollWheelZoom) { S.dmap.scrollWheelZoom.enable(); setTimeout(() => { S.dmap.invalidateSize(); if (S.dlls) S.dmap.fitBounds(L.latLngBounds(S.dlls), { padding: [24, 24] }); }, 120); } };
      $('d-cerrar').onclick = () => { cerrarMapaGrande(); popCapa('mapa'); }; }
    if (!gp) return;
    setTimeout(() => {
      const v = mkView($('d-map')), full = P.slice(gp, 0, gp.length), all = full.slice();
      v.line(full, { color: CT(), w: 8, op: trip ? .45 : .8 }); v.line(full, { color: V(), w: 5, op: trip ? .7 : 1 });
      if (trip) { const ll = o => P.toLL(o.x, o.y), x = trip.x, F = [S.from.lat, S.from.lng], T = [S.to.lat, S.to.lng];
        if (trip.kind === 'd') { const a = ll(x.board), b = ll(x.alight); v.line(P.slice(x.path, x.sO, x.sD), { color: CT(), w: 11 }); v.line(P.slice(x.path, x.sO, x.sD), { color: VO(), w: 7 }); const ws = [[F, a], [b, T]]; Promise.all(ws.map(q => walkRoute(q[0], q[1]))).then(rs => rs.forEach(w => v.line(w.ll, { color: CA(), w: 4, dash: w.ok ? '2 9' : '6 10', op: w.ok ? 1 : .55 })));
          v.dot(F[0], F[1], { color: V(), label: 'Origen' }); v.dot(T[0], T[1], { color: CA(), label: 'Destino' }); v.dot(a[0], a[1], { color: '#F2A900', label: 'Sube aquí' }); v.dot(b[0], b[1], { color: '#0B8460', label: 'Baja aquí' }); all.push(F, T, a, b); }
        else { const a = ll(x.a.board), t = ll(x.a.leave), tb = ll(x.b.board), b = ll(x.b.alight);
          [[x.a.path, x.a.s0, x.a.s1, VO()], [x.b.path, x.b.s0, x.b.s1, V2()]].forEach(q => { v.line(P.slice(q[0], q[1], q[2]), { color: CT(), w: 11 }); v.line(P.slice(q[0], q[1], q[2]), { color: q[3], w: 7 }); }); [[F, a], [t, tb], [b, T]].forEach(q => walkRoute(q[0], q[1]).then(w => v.line(w.ll, { color: CA(), w: 4, dash: w.ok ? '2 9' : '6 10', op: w.ok ? 1 : .55 })));
          v.dot(F[0], F[1], { color: V(), label: 'Origen' }); v.dot(T[0], T[1], { color: CA(), label: 'Destino' }); all.push(F, T, a, b, t, tb); } }
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
  /* ---------- fotos reales: assets/buses/<empresa>/<ruta>.jpg + índice data/fotos.json (lo genera tools/indexar-fotos.mjs) ---------- */
  const FOTO_DIR = 'assets/buses/', slug = n => String(n || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const HINT = (() => { try { return new URLSearchParams(location.search).get('fotos') === '1'; } catch (e) { return false; } })();
  let fotoIdx = null;
  const fotoIndex = () => fotoIdx || (fotoIdx = fetch('data/fotos.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : {}).catch(() => ({})));
  const encPath = p => p.split('/').map(encodeURIComponent).join('/');
  const cred = (...v) => v.find(x => x && !/^pendiente/i.test(String(x))) || '';
  const mapFoto = (f, e, d) => ({ url: encPath(/^assets\d*\//.test(f.archivo) ? f.archivo : FOTO_DIR + f.archivo), rutas: f.rutas || [], etiqueta: f.etiqueta || '', autor: cred(f.autor, e.autor, d.autor), licencia: cred(f.licencia, e.licencia, d.licencia), nota: f.nota || e.nota || '' });
  async function fotosEmpresa(op) { const idx = await fotoIndex(), e = (idx.empresas || {})[slug(op)]; if (!e) return []; return (e.fotos || []).map(f => mapFoto(f, e, idx.defecto || {})); }
  async function fotosRuta(id) {   // todas las fotos cuya ruta coincide, sin importar en qué carpeta de empresa estén
    const idx = await fotoIndex(), g = nid(id), own = [];
    for (const e of Object.values(idx.empresas || {})) for (const f of (e.fotos || [])) if ((f.rutas || []).some(r => nid(r) === g)) own.push(mapFoto(f, e, idx.defecto || {}));
    return { own };
  }
  const fotoPie = f => esc([f.autor, f.licencia].filter(Boolean).join(' · ') || 'Crédito pendiente de registrar');
  const rutaPie = f => f.rutas.length ? 'Ruta ' + f.rutas.join(', ') : 'Foto de la empresa (sin ruta asignada)';
  const tituloFoto = f => f.etiqueta || rutaPie(f);
  window.MovixFotos = { fotosEmpresa, fotosRuta, slug };
  function galeria(list, i) {
    const old = $('galeria'); if (old) old.remove();
    const box = document.createElement('div'); box.id = 'galeria'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Fotos de buses'); let k = i || 0;
    const draw = () => { const f = list[k]; box.innerHTML = `<button class="g-x" aria-label="Cerrar">✕</button><img src="${esc(f.url)}" alt="${esc(tituloFoto(f))}"><div class="g-cap"><b>${esc(tituloFoto(f))}</b><br>${f.etiqueta ? esc(rutaPie(f)) + ' · ' : ''}${fotoPie(f)}${f.nota ? '<br>' + esc(f.nota) : ''}<br><span>${k + 1} de ${list.length}</span></div>${list.length > 1 ? '<button class="g-n g-prev" aria-label="Anterior">‹</button><button class="g-n g-next" aria-label="Siguiente">›</button>' : ''}`; };
    const cerrar = () => { if (box.isConnected) { box.remove(); popCapa('galeria'); } };
    const mover = d => { k = (k + d + list.length) % list.length; draw(); };
    box.addEventListener('click', e => { if (e.target.closest('.g-x') || e.target === box) cerrar(); else if (e.target.closest('.g-prev')) mover(-1); else if (e.target.closest('.g-next')) mover(1); });
    let x0 = null; box.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50 && list.length > 1) mover(dx < 0 ? 1 : -1); });
    const key = e => { if (!document.body.contains(box)) return document.removeEventListener('keydown', key); if (e.key === 'Escape') cerrar(); else if (e.key === 'ArrowRight') mover(1); else if (e.key === 'ArrowLeft') mover(-1); };
    document.addEventListener('keydown', key); draw(); document.body.appendChild(box); pushCapa('galeria');
  }
  function companies() {
    const host = $('company-directory'); if (!host || !OR().length) return;
    const by = {}, geo = {}; OR().filter(r => r.system === 'TPC AMB').forEach(r => (by[r.operator] = by[r.operator] || []).push(r));
    if (S.paths && !S.test) S.routes.forEach(r => { geo[r.operator] = (geo[r.operator] || 0) + 1; by[r.operator] = by[r.operator] || []; });
    const names = Object.keys(by).sort((a, b) => (geo[b] || 0) - (geo[a] || 0) || by[b].length - by[a].length || a.localeCompare(b));
    const priv = n => OSRC().find(s => P.normId(s.name) === P.normId(n));
    const tm = OR().filter(r => r.system === 'Transmetro'), extra = names.filter(n => !OR().some(r => r.system === 'TPC AMB' && r.operator === n));
    $('company-count').textContent = `${names.length} empresas de transporte colectivo (TPC) en las fuentes del AMB, más Transmetro.` + (extra.length ? ` ${extra.map(pretty).join(' y ')} aparece${extra.length > 1 ? 'n' : ''} solo en los trazados del AMB, no en el catálogo.` : '') + ' Estado operativo vigente: pendiente de verificar.';
    host.innerHTML = names.map(n => { const s = priv(n), c = by[n].length, g = geo[n] || 0;
      return `<button class="source-card" data-op="${esc(n)}" style="text-align:left;width:100%"><span class="co-foto"></span><b>${esc(pretty(n))}</b><span>${c ? c + (c === 1 ? ' ruta catalogada' : ' rutas catalogadas') : 'sin rutas en el catálogo'} · ${g ? g + (g === 1 ? ' con trazado' : ' con trazado') : 'sin trazado cargado'}${s ? '<br>Sitio del operador: <u>' + esc(s.status) + '</u>' : ''}</span><i class="source-status pending">AMB · foto pendiente</i></button>`; }).join('') +
      `<button class="source-card" data-op="Transmetro" style="text-align:left;width:100%"><span class="co-foto"></span><b>Transmetro</b><span>${tm.length} rutas alimentadoras catalogadas · sin trazado cargado</span><i class="source-status">fuente oficial</i></button>`;
    host.querySelectorAll('[data-op]').forEach(b => { const op = b.dataset.op; fotosEmpresa(op).then(list => { const slot = b.querySelector('.co-foto'), st = b.querySelector('.source-status'); if (!slot) return;
      if (list.length) { slot.innerHTML = `<img src="${esc(list[0].url)}" alt="Bus de ${esc(pretty(op))}" loading="lazy"><small>${list.length} ${list.length === 1 ? 'foto' : 'fotos'} · toca la imagen para verlas</small>`; slot._list = list;
        if (st && /foto pendiente/.test(st.textContent)) { st.textContent = st.textContent.replace('foto pendiente', list.length + (list.length === 1 ? ' foto' : ' fotos')); st.classList.remove('pending'); } }
      else if (HINT) slot.innerHTML = `<small class="hint">Sin fotos: crea la carpeta ${FOTO_DIR}${slug(op)}/</small>`; }); });
    host.onclick = e => { const im = e.target.closest('.co-foto img'); if (im && im.parentElement._list) { galeria(im.parentElement._list, 0); return; } const b = e.target.closest('[data-op]'); if (!b) return; const d = $('destination'); if (d) d.value = b.dataset.op; go('busqueda'); searchRoutes(); };
  }

  /* ---------- eventos ---------- */
  $('from')?.addEventListener('input', () => onType('from')); $('to')?.addEventListener('input', () => onType('to'));
  $('trip')?.addEventListener('focusin', () => $('trip').classList.remove('compact'));
  $('from')?.addEventListener('focus', () => { S.focus = 'from'; if (!$('from').value) showSuggest('from', [], '', true); });
  $('to')?.addEventListener('focus', () => { S.focus = 'to'; });
  $('from-gps')?.addEventListener('click', () => { S.focus = 'from'; gps(); });
  $('swap')?.addEventListener('click', () => { const a = S.from, b = S.to; S.from = b; S.to = a; $('from').value = b ? b.label : ''; $('to').value = a ? a.label : ''; redraw(); if (S.from && S.to) runPlan(); });
  $('clear-plan')?.addEventListener('click', () => { $('trip').classList.remove('compact'); S.from = S.to = S.res = null; $('from').value = $('to').value = ''; clearFg(); msg(''); $('sheet').classList.remove('planning'); resetSheet(); });
  $('plan-btn')?.addEventListener('click', async () => {
    for (const w of ['from', 'to']) { if (!S[w] && $(w).value.trim().length > 2) { try { const r = await nominatim($(w).value + ', Barranquilla'); if (r[0]) S[w] = r[0]; } catch { return msg('No se pudo consultar el buscador de direcciones. Elige los puntos con GPS o mantén presionado el mapa.', true); } } }
    if (!S.from || !S.to) return msg('Indica origen y destino (escribe un lugar, usa el GPS o mantén presionado el mapa).', true);
    redraw(); runPlan();
  });

  window.MovixGeo = { latlngs: id => { const q = geoFor(id); return q ? P.slice(q, 0, q.length) : null; } };
  (function () { const sc = document.querySelector('[data-screen="mas"] .scroll'); if (!sc) return; let cur = null;
    [...sc.children].forEach(el => { if (el.classList.contains('section')) { cur = document.createElement('details'); cur.className = 'acc'; const sm = document.createElement('summary'); sm.textContent = el.textContent; cur.appendChild(sm); sc.insertBefore(cur, el); el.remove(); } else if (cur) cur.appendChild(el); }); })();
  (function () { const v = $('app-version'); if (v) v.textContent += ' · planificador 09-nov-2026 (v12)';
    if ('serviceWorker' in navigator) { const had = !!navigator.serviceWorker.controller; navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !window.__rl) { window.__rl = 1; location.reload(); } }); } })();
  const TEMAS = { claro: 'Claro', oscuro: 'Oscuro' };
  function setTema(t, save) {
    if (!TEMAS[t]) t = 'claro'; document.documentElement.dataset.tema = t;
    if (save !== false) { try { localStorage.setItem('movix.tema', t); } catch (e) {} }
    const mt = document.querySelector('meta[name="theme-color"]'); if (mt) mt.setAttribute('content', t === 'oscuro' ? '#0B0807' : '#1F1A17');
    document.querySelectorAll('#temas .chip').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('sel', on); b.setAttribute('aria-checked', on); });
    if (M.kind === 'svg') drawBackground();
    if (S.res && S.sel && S.from && S.to) show(S.sel);
    const dv = document.querySelector('.screen[data-screen="detalle"]'); if (S.lastDetail && dv && dv.classList.contains('active')) window.showDetail(S.lastDetail[0], S.lastDetail[1]);
  }
  (function () { const box = $('temas'); if (!box) return;
    box.innerHTML = Object.keys(TEMAS).map(k => `<button class="chip" role="radio" data-t="${k}"><span class="sw" style="background:${k === 'claro' ? '#FBF6EE' : '#14100E'}"></span>${TEMAS[k]}</button>`).join('');
    box.addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) setTema(b.dataset.t); });
    try { localStorage.removeItem('movix.acento'); } catch (e) {}
    setTema(document.documentElement.dataset.tema === 'oscuro' ? 'oscuro' : 'claro', false); })();
  (async function () { const APP_V = '12'; try { const r = await fetch('version.json', { cache: 'no-store' }); if (!r.ok) return; const v = (await r.json()).v;
    if (v !== APP_V && !sessionStorage.getItem('mx.rl')) { sessionStorage.setItem('mx.rl', '1'); const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(x => x.unregister())); for (const k of await caches.keys()) await caches.delete(k); location.reload(); } } catch (e) {} })();
  msg(''); mapInit(); companies(); loadGeo().then(() => { if (S.status !== 'ok') geoBadge(); });
})();
