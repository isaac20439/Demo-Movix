/* Motor de planificación de Movix. Solo usa trazados publicados (GeoJSON del AMB).
   Cada trazado del AMB es un circuito cerrado (ida + vuelta): el bus sigue dando la vuelta,
   así que el recorrido de subida a bajada puede cruzar el cierre del circuito.
   No inventa paraderos: el "punto de abordaje" es el punto MÁS CERCANO DEL TRAZADO, no un paradero verificado.
   Distancias en línea recta (m). No calcula tiempos ni posiciones de buses.
   Orden: menor "costo" = 3 × metros a pie + metros en bus. */
(function (root) {
  'use strict';
  const LNG0 = -74.8, LAT0 = 10.97, KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KY = 110540;
  const toXY = (lat, lng) => [(lng - LNG0) * KX, (lat - LAT0) * KY];
  const toLL = (x, y) => [y / KY + LAT0, x / KX + LNG0];
  const DEFAULTS = { walk: 600, minRide: 250, transfer: 200, step: 120, maxTransfers: 12, walkWeight: 3, closeTol: 300 };
  const normId = s => String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');

  function pick(props, keys) {
    const low = {}; Object.keys(props || {}).forEach(k => low[k.toLowerCase()] = props[k]);
    for (const k of keys) { const v = low[k]; if (v != null && String(v).trim() !== '') return String(v).trim(); }
    return '';
  }
  function fromGeoJSON(fc) {
    const out = [];
    (fc.features || []).forEach((f, i) => {
      const g = f.geometry || {}, p = f.properties || {};
      const parts = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
      const clean = parts.map(c => c.map(q => [Number(q[0]), Number(q[1])])).filter(c => c.length > 1);
      if (!clean.length) return;
      const id = pick(p, ['route_code', 'codigo', 'código', 'cod_ruta', 'ruta', 'code', 'id', 'nombre', 'name']) || 'ruta-' + i;
      out.push({ id, label: pick(p, ['nombre', 'name']) || id, operator: pick(p, ['empresa', 'operador', 'operator', 'company']),
        note: pick(p, ['geometry_note']), source: pick(p, ['source_url']), parts: clean });
    });
    return out;
  }

  function buildPath(route, part, coords, tol) {
    const pts = coords.map(c => toXY(c[1], c[0])), cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = cum[cum.length - 1], a = pts[0], b = pts[pts.length - 1];
    return { route, part, pts, cum, length: L, closed: Math.hypot(a[0] - b[0], a[1] - b[1]) < tol };
  }
  function prepare(routes, opts) {
    const tol = Object.assign({}, DEFAULTS, opts).closeTol, paths = [];
    routes.forEach(r => r.parts.forEach((c, i) => { if (c.length > 1) paths.push(buildPath(r, i, c, tol)); }));
    return paths;
  }
  /* distancia hacia adelante de sA a sB (en circuito cerrado puede cruzar el cierre) */
  const fwd = (p, sA, sB) => sB >= sA ? sB - sA : (p.closed ? p.length - sA + sB : -1);

  function segCands(path, P, maxD) {
    const out = [], pts = path.pts, cum = path.cum;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], ay = pts[i][1], dx = pts[i + 1][0] - ax, dy = pts[i + 1][1] - ay;
      if (Math.abs(P[0] - ax) > maxD + Math.abs(dx) || Math.abs(P[1] - ay) > maxD + Math.abs(dy)) continue;
      const L2 = dx * dx + dy * dy; let t = L2 ? ((P[0] - ax) * dx + (P[1] - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
      const x = ax + t * dx, y = ay + t * dy, d = Math.hypot(P[0] - x, P[1] - y);
      if (d <= maxD) out.push({ d, s: cum[i] + t * Math.sqrt(L2), x, y });
    }
    return out;
  }
  function samples(path, step) {
    if (path._smp && path._smpStep === step) return path._smp;
    const out = [], { pts, cum } = path; let i = 1;
    for (let s = 0; s <= path.length; s += step) {
      while (i < cum.length - 1 && cum[i] < s) i++;
      const seg = cum[i] - cum[i - 1] || 1, t = Math.max(0, Math.min(1, (s - cum[i - 1]) / seg));
      out.push({ x: pts[i - 1][0] + t * (pts[i][0] - pts[i - 1][0]), y: pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1]), s });
    }
    path._smp = out; path._smpStep = step; return out;
  }
  function pointAt(path, s) {
    const { pts, cum } = path; let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const seg = cum[i] - cum[i - 1] || 1, t = Math.max(0, Math.min(1, (s - cum[i - 1]) / seg));
    return { x: pts[i - 1][0] + t * (pts[i][0] - pts[i - 1][0]), y: pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1]) };
  }
  const bbox = p => p._bb || (p._bb = p.pts.reduce((r, q) => [Math.min(r[0], q[0]), Math.min(r[1], q[1]), Math.max(r[2], q[0]), Math.max(r[3], q[1])], [Infinity, Infinity, -Infinity, -Infinity]));
  const best = list => list.reduce((a, b) => (!a || b.d < a.d ? b : a), null);
  const keep = (map, key, item) => { if (!map.has(key) || item.cost < map.get(key).cost) map.set(key, item); };

  function direct(paths, O, D, o, C) {
    const m = new Map();
    for (const p of paths) {
      const co = C.o.get(p), cd = C.d.get(p); if (!co.length || !cd.length) continue;
      let b = null;
      for (const a of co) for (const c of cd) {
        const ride = fwd(p, a.s, c.s); if (ride < o.minRide) continue;
        const cost = o.walkWeight * (a.d + c.d) + ride; if (!b || cost < b.cost) b = { cost, a, c, ride };
      }
      if (b) keep(m, p.route.id, { type: 'direct', path: p, walkO: b.a.d, walkD: b.c.d, sO: b.a.s, sD: b.c.s, ride: b.ride, board: b.a, alight: b.c, cost: b.cost });
    }
    return [...m.values()].sort((x, y) => x.cost - y.cost);
  }

  function transfers(paths, O, D, o, C) {
    const A = [], B = [];
    for (const p of paths) {
      const a = best(C.o.get(p)); if (a) A.push({ p, a });
      const b = best(C.d.get(p)); if (b) B.push({ p, b });
    }
    const cell = Math.max(o.transfer, 50);
    const gridOf = p => {
      if (p._grid && p._gridKey === cell + ':' + o.step) return p._grid;
      const g = new Map();
      samples(p, o.step).forEach(q => { const k = Math.floor(q.x / cell) * 100003 + Math.floor(q.y / cell); (g.get(k) || g.set(k, []).get(k)).push(q); });
      p._grid = g; p._gridKey = cell + ':' + o.step; return g;
    };
    const m = new Map();
    for (const a of A) for (const b of B) {
      if (a.p.route.id === b.p.route.id) continue;
      const ba = bbox(a.p), bb = bbox(b.p);
      if (ba[0] > bb[2] + o.transfer || bb[0] > ba[2] + o.transfer || ba[1] > bb[3] + o.transfer || bb[1] > ba[3] + o.transfer) continue;
      const g = gridOf(b.p); let bt = null;
      for (const q of samples(a.p, o.step)) {
        const rA = fwd(a.p, a.a.s, q.s); if (rA < o.minRide) continue;
        const cx = Math.floor(q.x / cell), cy = Math.floor(q.y / cell);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++)
          for (const r of (g.get((cx + dx) * 100003 + (cy + dy)) || [])) {
            const rB = fwd(b.p, r.s, b.b.s); if (rB < o.minRide) continue;
            const d = Math.hypot(q.x - r.x, q.y - r.y); if (d > o.transfer) continue;
            const cost = o.walkWeight * (a.a.d + b.b.d + d) + rA + rB;
            if (!bt || cost < bt.cost) bt = { cost, d, qa: q, qb: r, rA, rB };
          }
      }
      if (bt) keep(m, a.p.route.id + '>' + b.p.route.id, { type: 'transfer', cost: bt.cost, walkO: a.a.d, walkD: b.b.d, walkT: bt.d, ride: bt.rA + bt.rB,
        a: { path: a.p, s0: a.a.s, s1: bt.qa.s, board: a.a, leave: bt.qa }, b: { path: b.p, s0: bt.qb.s, s1: b.b.s, board: bt.qb, alight: b.b } });
    }
    return [...m.values()].sort((x, y) => x.cost - y.cost).slice(0, o.maxTransfers);
  }

  function plan(paths, from, to, opts) {
    const o = Object.assign({}, DEFAULTS, opts), O = toXY(from.lat, from.lng), D = toXY(to.lat, to.lng);
    const C = { o: new Map(), d: new Map() };
    for (const p of paths) { C.o.set(p, segCands(p, O, o.walk)); C.d.set(p, segCands(p, D, o.walk)); }
    return { direct: direct(paths, O, D, o, C), transfers: transfers(paths, O, D, o, C), opts: o, nearO: paths.filter(p => C.o.get(p).length).length, nearD: paths.filter(p => C.d.get(p).length).length, straight: Math.hypot(O[0] - D[0], O[1] - D[1]) };
  }
  /* tramo de s0 a s1 hacia adelante (cruza el cierre en circuitos cerrados). Devuelve [[lat,lng],...] */
  function slice(path, s0, s1) {
    const ll = s => { const p = pointAt(path, s); return toLL(p.x, p.y); }, out = [ll(s0)];
    const inner = (a, b) => { for (let i = 1; i < path.pts.length - 1; i++) if (path.cum[i] > a && path.cum[i] < b) out.push(toLL(path.pts[i][0], path.pts[i][1])); };
    if (s1 >= s0) inner(s0, s1);
    else if (path.closed) { inner(s0, path.length); out.push(toLL(path.pts[path.pts.length - 1][0], path.pts[path.pts.length - 1][1])); out.push(toLL(path.pts[0][0], path.pts[0][1])); inner(0, s1); }
    out.push(ll(s1)); return out;
  }
  const api = { fromGeoJSON, prepare, plan, slice, toLL, toXY, normId, DEFAULTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MovixPlanner = api;
})(typeof window !== 'undefined' ? window : globalThis);
