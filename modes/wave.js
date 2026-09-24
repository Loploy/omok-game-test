

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generateGrid(newSeed, newIntensity) {
    seed = newSeed;
    if (newIntensity !== undefined) intensity = newIntensity;
    grid = allowTangleCheck.checked ? buildWarpedGrid(null) : repairTangles();
  }

  function buildWarpedGrid(damp) {
    const rnd = mulberry32(seed);
    const rowPhaseA = [], rowPhaseB = [], colPhaseA = [], colPhaseB = [];
    for (let i = 0; i < N; i++) {
      rowPhaseA.push(rnd() * Math.PI * 2);
      rowPhaseB.push(rnd() * Math.PI * 2);
    }
    for (let j = 0; j < N; j++) {
      colPhaseA.push(rnd() * Math.PI * 2);
      colPhaseB.push(rnd() * Math.PI * 2);
    }

    const amp1 = SPACING * WAVE_PRIMARY_AMPLITUDE * intensity;
    const amp2 = SPACING * WAVE_SECONDARY_AMPLITUDE * intensity;
    const f1 = WAVE_PRIMARY_FREQUENCY, f2 = WAVE_SECONDARY_FREQUENCY;

    const g = [];
    for (let i = 0; i < N; i++) {
      const row = [];
      for (let j = 0; j < N; j++) {
        const s = damp ? damp[i][j] : 1;
        const dx = (amp1 * Math.sin(j * f1 + rowPhaseA[i]) + amp2 * Math.sin(j * f2 + rowPhaseB[i] + 1.7)) * s;
        const dy = (amp1 * Math.sin(i * f1 + colPhaseA[j]) + amp2 * Math.sin(i * f2 + colPhaseB[j] + 1.7)) * s;
        row.push({
          x: MARGIN + j * SPACING + dx,
          y: MARGIN + i * SPACING + dy
        });
      }
      g.push(row);
    }
    return g;
  }

  function sampleCurve(pts, steps) {
    const out = [];
    for (let n = 0; n < pts.length - 1; n++) {
      const p0 = pts[n - 1] || pts[n];
      const p1 = pts[n];
      const p2 = pts[n + 1];
      const p3 = pts[n + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      for (let s = 0; s < steps; s++) {
        const t = s / steps, u = 1 - t;
        out.push({
          x: u*u*u*p1.x + 3*u*u*t*c1x + 3*u*t*t*c2x + t*t*t*p2.x,
          y: u*u*u*p1.y + 3*u*u*t*c1y + 3*u*t*t*c2y + t*t*t*p2.y,
          k: n + t
        });
      }
    }
    const last = pts[pts.length - 1];
    out.push({ x: last.x, y: last.y, k: pts.length - 1 });
    return out;
  }

  function valueAt(poly, t, axis) {
    const A = axis === 'y' ? 'y' : 'x';
    const B = axis === 'y' ? 'x' : 'y';
    if (t <= poly[0][A]) return { v: poly[0][B], k: poly[0].k };
    for (let n = 1; n < poly.length; n++) {
      if (poly[n][A] >= t) {
        const p = poly[n - 1], q = poly[n];
        const d = q[A] - p[A];
        const r = d === 0 ? 0 : (t - p[A]) / d;
        return { v: p[B] + (q[B] - p[B]) * r, k: p.k + (q.k - p.k) * r };
      }
    }
    const l = poly[poly.length - 1];
    return { v: l[B], k: l.k };
  }

  function findTangles(g) {
    const hits = [];
    const cols = [], rows = [];
    for (let j = 0; j < N; j++) {
      const p = []; for (let i = 0; i < N; i++) p.push(g[i][j]);
      cols.push(sampleCurve(p, 12));
    }
    for (let i = 0; i < N; i++) {
      const p = []; for (let j = 0; j < N; j++) p.push(g[i][j]);
      rows.push(sampleCurve(p, 12));
    }
    const STEPS = 60;
    const clamp = (v) => Math.max(0, Math.min(N - 1, v));

    for (let j = 0; j < N - 1; j++) {
      const a = cols[j], b = cols[j + 1];
      const lo = Math.max(a[0].y, b[0].y);
      const hi = Math.min(a[a.length - 1].y, b[b.length - 1].y);
      for (let s = 0; s <= STEPS; s++) {
        const Y = lo + (hi - lo) * s / STEPS;
        const va = valueAt(a, Y, 'y'), vb = valueAt(b, Y, 'y');
        if (vb.v - va.v < TANGLE_MIN_GAP) {
          const i = clamp(Math.round((va.k + vb.k) / 2));
          hits.push({ dir: 'v', i, j });
        }
      }
    }
    for (let i = 0; i < N - 1; i++) {
      const a = rows[i], b = rows[i + 1];
      const lo = Math.max(a[0].x, b[0].x);
      const hi = Math.min(a[a.length - 1].x, b[b.length - 1].x);
      for (let s = 0; s <= STEPS; s++) {
        const X = lo + (hi - lo) * s / STEPS;
        const va = valueAt(a, X, 'x'), vb = valueAt(b, X, 'x');
        if (vb.v - va.v < TANGLE_MIN_GAP) {
          const j = clamp(Math.round((va.k + vb.k) / 2));
          hits.push({ dir: 'h', i, j });
        }
      }
    }
    return hits;
  }

  function repairTangles() {
    const damp = Array.from({ length: N }, () => Array(N).fill(1));
    let g = buildWarpedGrid(damp);
    for (let iter = 0; iter < MAX_REPAIR_ITER; iter++) {
      const hits = findTangles(g);
      if (hits.length === 0) break;
      const clamp = (v) => Math.max(0, Math.min(N - 1, v));
      for (const h of hits) {

        const cells = h.dir === 'v'
          ? [[h.i, h.j], [h.i, h.j + 1], [clamp(h.i + 1), h.j], [clamp(h.i + 1), h.j + 1],
             [clamp(h.i - 1), h.j], [clamp(h.i - 1), h.j + 1]]
          : [[h.i, h.j], [h.i + 1, h.j], [h.i, clamp(h.j + 1)], [h.i + 1, clamp(h.j + 1)],
             [h.i, clamp(h.j - 1)], [h.i + 1, clamp(h.j - 1)]];
        for (const [ci, cj] of cells) damp[ci][cj] *= DAMP_STEP;
      }
      g = buildWarpedGrid(damp);
    }
    return g;
  }

