/* Motor de planificación de Movix. Solo usa trazados publicados (GeoJSON del AMB).
   No inventa paraderos: el "punto de abordaje" es el punto MÁS CERCANO DEL TRAZADO, no un paradero verificado.
   Distancias: línea recta en metros. No calcula tiempos ni posiciones de buses. */
(function (root) {
  'use strict';
  const LNG0 = -74.8, LAT0 = 10.97, KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KY = 110540;
  const toXY = (lat, lng) => [(lng - LNG0) * KX, (lat - LAT0) * KY];
  const toLL = (x, y) => [y / KY + LAT0, x / KX + LNG0];
  const DEFAULTS = { walk: 600, minRide: 250, transfer: 200, step: 60, maxTransfers: 12 };
  const normId = s => String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');

  /* GeoJSON -> rutas [{id,label,operator,parts:[[[lng,lat],...]]}] */
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
      const id = pick(p, ['codigo', 'código', 'cod_ruta', 'ruta', 'code', 'id', 'nombre', 'name']) || 'ruta-' + i;
      out.push({ id, label: pick(p, ['nombre', 'name', 'descripcion', 'descripción']) || id,
        operator: pick(p, ['empresa', 'operador', 'operator', 'company', 'nombre_empresa']), parts: clean });
    });
    return out;
  }

  function buildPath(route, part, coords) {
    const pts = coords.map(c => toXY(c[1], c[0])), cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { route, part, pts, cum, length: cum[cum.length - 1] };
  }
  function prepare(routes) {
    const paths = [];
    routes.forEach(r => r.parts.forEach((c, i) => { if (c.length > 1) paths.push(buildPath(r, i, c)); }));
    return paths;
  }
  function segCands(path, P, maxD) {
    const out = [], pts = path.pts, cum = path.cum;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], ay = pts[i][1], dx = pts[i + 1][0] - ax, dy = pts[i + 1][1] - ay, L2 = dx * dx + dy * dy;
      let t = L2 ? ((P[0] - ax) * dx + (P[1] - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
      const x = ax + t * dx, y = ay + t * dy, d = Math.hypot(P[0] - x, P[1] - y);
      if (d <= maxD) out.push({ d, s: cum[i] + t * Math.sqrt(L2), x, y });
    }
    return out;
  }
  function at(path, s) {
    const { pts, cum } = path; let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const seg = cum[i] - cum[i - 1] || 1, t = Math.max(0, Math.min(1, (s - cum[i - 1]) / seg));
    return { x: pts[i - 1][0] + t * (pts[i][0] - pts[i - 1][0]), y: pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1]), s };
  }
  function samples(path, step) {
    if (path._smp && path._smpStep === step) return path._smp;
    const out = []; for (let s = 0; s <= path.length; s += step) out.push(at(path, s));
    path._smp = out; path._smpStep = step; return out;
  }
  function best(list) { return list.reduce((a, b) => (!a || b.d < a.d ? b : a), null); }
  const keep = (map, key, item) => { if (!map.has(key) || item.cost < map.get(key).cost) map.set(key, item); };

  function direct(paths, O, D, o) {
    const m = new Map();
    for (const p of paths) {
      const co = segCands(p, O, o.walk), cd = segCands(p, D, o.walk);
      if (!co.length || !cd.length) continue;
      let b = null;
      for (const a of co) for (const c of cd) {
        const ride = c.s - a.s; if (ride < o.minRide) continue;
        const cost = a.d + c.d; if (!b || cost < b.cost) b = { cost, a, c, ride };
      }
      if (b) keep(m, p.route.id, { type: 'direct', path: p, walkO: b.a.d, walkD: b.c.d, sO: b.a.s, sD: b.c.s, ride: b.ride, board: b.a, alight: b.c, cost: b.cost });
    }
    return [...m.values()].sort((x, y) => x.cost - y.cost || x.ride - y.ride);
  }

  function transfers(paths, O, D, o) {
    const A = [], B = [];
    for (const p of paths) {
      const a = best(segCands(p, O, o.walk)); if (a) A.push({ p, a });
      const b = best(segCands(p, D, o.walk)); if (b) B.push({ p, b });
    }
    const cell = Math.max(o.transfer, 50), grids = new Map();
    const gridOf = p => {
      if (grids.has(p)) return grids.get(p);
      const g = new Map();
      samples(p, o.step).forEach(q => { const k = Math.floor(q.x / cell) + ',' + Math.floor(q.y / cell); (g.get(k) || g.set(k, []).get(k)).push(q); });
      grids.set(p, g); return g;
    };
    const m = new Map();
    for (const a of A) for (const b of B) {
      if (a.p.route.id === b.p.route.id) continue;
      const g = gridOf(b.p); let bestT = null;
      for (const q of samples(a.p, o.step)) {
        if (q.s < a.a.s + o.minRide) continue;
        const cx = Math.floor(q.x / cell), cy = Math.floor(q.y / cell);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          for (const r of (g.get((cx + dx) + ',' + (cy + dy)) || [])) {
            if (r.s > b.b.s - o.minRide) continue;
            const d = Math.hypot(q.x - r.x, q.y - r.y); if (d > o.transfer) continue;
            const cost = a.a.d + b.b.d + d;
            if (!bestT || cost < bestT.cost) bestT = { cost, d, qa: q, qb: r };
          }
        }
      }
      if (bestT) keep(m, a.p.route.id + '>' + b.p.route.id, { type: 'transfer', cost: bestT.cost, walkO: a.a.d, walkD: b.b.d, walkT: bestT.d,
        a: { path: a.p, s0: a.a.s, s1: bestT.qa.s, board: a.a, leave: bestT.qa }, b: { path: b.p, s0: bestT.qb.s, s1: b.b.s, board: bestT.qb, alight: b.b },
        ride: (bestT.qa.s - a.a.s) + (b.b.s - bestT.qb.s) });
    }
    return [...m.values()].sort((x, y) => x.cost - y.cost || x.ride - y.ride).slice(0, o.maxTransfers);
  }

  function plan(paths, from, to, opts) {
    const o = Object.assign({}, DEFAULTS, opts), O = toXY(from.lat, from.lng), D = toXY(to.lat, to.lng);
    return { direct: direct(paths, O, D, o), transfers: transfers(paths, O, D, o), opts: o,
      straight: Math.hypot(O[0] - D[0], O[1] - D[1]) };
  }
  function slice(path, s0, s1) {
    const out = [toLL.apply(null, (p => [p.x, p.y])(at(path, s0)))];
    for (let i = 1; i < path.pts.length - 1; i++) if (path.cum[i] > s0 && path.cum[i] < s1) out.push(toLL(path.pts[i][0], path.pts[i][1]));
    out.push(toLL.apply(null, (p => [p.x, p.y])(at(path, s1)))); return out;
  }
  const api = { fromGeoJSON, prepare, plan, slice, toLL, toXY, normId, DEFAULTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MovixPlanner = api;
})(typeof window !== 'undefined' ? window : globalThis);
