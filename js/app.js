import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { SITE, POINTS, LIVE_CAMERA_YOUTUBE_ID, SHORELINE, PIER, BUILDINGS, ISOBATHS, DROP, GROUND_MAP, COVER, PIPES, CORAL_MODELS } from './data.js';
import { DECKS, PAIRS, FLOATS, ZONES, TEST_RULE, SITE_URL } from './mission.js';
import { CORALS, CONCLUSIONS, LESSONS, SCHEDULE } from './findings.js';
import { applyDemo } from './demo.js';
import { derive, summary, toTest, r1, activityChart, densityChart, scatter as scatterChart, DAY_COL, NIGHT_COL } from './analysis.js';
import { badgeSVG, logoSVG, BADGE_BG } from './badges.js';
import { buildFloat, buildAnchor, GLOW } from './floats.js';
import { coralReef } from './corals.js';
import { UI } from './i18n.js';
import { qrSVG } from './qr.js';
import { Kit, buildObject, buildPier, buildScatter, buildBuildings, buildPipes } from './models.js';

THREE.ColorManagement.enabled = false;

const EX = SITE.verticalExaggeration;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const isPhone = () => window.matchMedia('(max-width: 760px)').matches;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtNum = (n) => (Math.round(n * 10) / 10).toString();
/* ── language ── */
let LANG = (() => {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'en' || q === 'he') return q;
    return localStorage.getItem('iui-lang') === 'en' ? 'en' : 'he';
  } catch { return 'he'; }
})();
const t = (k, ...a) => { const v = UI[LANG][k]; return typeof v === 'function' ? v(...a) : v; };
const tx = (p, f) => (LANG === 'en' && p.en && p.en[f] != null ? p.en[f] : p[f]);
const nm = (p) => tx(p, 'name');
const isRTL = () => LANG === 'he';

/* ═════════════ loading screen ═════════════
   Shown while the scene is built, and again (softly, over the map) while the
   3D corals download. It hides once nothing is left to wait for. */
const loading = { scene: true, corals: false, booted: false };
const loaderEl = document.getElementById('loader');
const loaderBarWrap = loaderEl.querySelector('.loader-bar');
function loaderStep(text, frac = null) {
  document.getElementById('loaderStep').textContent = text;
  loaderBarWrap.classList.toggle('is-busy', frac === null);
  document.getElementById('loaderBar').style.width = frac === null ? '' : `${Math.round(frac * 100)}%`;
}
function loaderShow(soft) {
  loaderEl.classList.toggle('is-soft', !!soft);
  loaderEl.classList.remove('is-done');
}
function loaderBrand() {
  const img = document.getElementById('loaderLogo');
  const dark = document.documentElement.dataset.theme === 'dark';
  img.src = `assets/logo/iui-${LANG}${dark ? '-light' : ''}.png`;
  img.alt = LANG === 'en' ? 'The Interuniversity Institute for Marine Sciences in Eilat' : 'המכון הבין־אוניברסיטאי למדעי הים באילת';
  img.height = LANG === 'en' ? 256 : 315;
  document.getElementById('loaderTitle').textContent = t('title');
}
let onLoaderHidden = null;
const LOADER_MIN_MS = 1200; // the opening screen stays at least this long, so the logo doesn't just flash
function loaderMaybeHide() {
  if (loading.scene || loading.corals) return;
  if (!loaderEl.classList.contains('is-soft') && performance.now() < LOADER_MIN_MS) {
    setTimeout(loaderMaybeHide, LOADER_MIN_MS - performance.now() + 20);
    return;
  }
  if (!loaderEl.classList.contains('is-done')) {
    loaderEl.classList.add('is-done');
    if (onLoaderHidden) { onLoaderHidden(); onLoaderHidden = null; }
  }
}
// never leave people stuck behind the loading screen
setTimeout(() => { loading.scene = false; loading.corals = false; loaderMaybeHide(); }, 25000);
// keep numeric ranges like 7–10 in reading order inside right-to-left text
const num = (v) => `\u2066${v}\u2069`;

/* ═════════════ geo: local metric frame ═════════════ */
const ddm = ([d, m]) => d + m / 60;
const known = POINTS.filter((p) => p.lat);
const lat0 = avg(known.map((p) => ddm(p.lat)));
const lon0 = avg(known.map((p) => ddm(p.lon)));
const M_LAT = 110574;
const M_LON = 111320 * Math.cos(rad(lat0));
const toLocal = (lat, lon) => ({ e: (lon - lon0) * M_LON, n: (lat - lat0) * M_LAT });
const toGeo = (e, n) => ({ lat: lat0 + n / M_LAT, lon: lon0 + e / M_LON });

const byId = Object.fromEntries(POINTS.map((p) => [p.id, p]));

POINTS.forEach((p) => {
  p.hasDepth = p.depth.length > 0;
  p.depthMid = p.hasDepth ? avg(p.depth) : null;
  p.depthMax = p.hasDepth ? Math.max(...p.depth) : null;
  p.depthText = p.hasDepth ? num(p.depth.length > 1 ? `${p.depth[0]}–${p.depth[1]}` : `${p.depth[0]}`) : '';
  if (p.lat) {
    p.latDec = ddm(p.lat); p.lonDec = ddm(p.lon);
    Object.assign(p, toLocal(p.latDec, p.lonDec));
    if (p.snap) {
      // keep the measured position for the panel, but draw the point where the satellite image shows the object
      p.measured = { lat: p.latDec, lon: p.lonDec };
      p.e += p.snap[0]; p.n += p.snap[1];
      const g = toGeo(p.e, p.n);
      p.latDec = g.lat; p.lonDec = g.lon;
    }
  }
});
/* ═════════════ coastline (traced from the satellite image) ═════════════ */
const SHORE = SHORELINE.map(([lat, lon]) => toLocal(lat, lon));
{
  // extend both ends of the traced waterline so distances are defined across the whole block
  const stretch = (p, q) => { const d = Math.hypot(p.e - q.e, p.n - q.n) || 1; return { e: p.e + ((p.e - q.e) / d) * 400, n: p.n + ((p.n - q.n) / d) * 400 }; };
  SHORE.unshift(stretch(SHORE[0], SHORE[3]));
  SHORE.push(stretch(SHORE[SHORE.length - 1], SHORE[SHORE.length - 4]));
}
// signed distance to the waterline in metres: positive at sea (east of the line), negative on the beach
function seaDist(e, n) {
  let best = Infinity, sign = 1;
  for (let k = 0; k < SHORE.length - 1; k++) {
    const a = SHORE[k], b = SHORE[k + 1];
    const de = b.e - a.e, dn = b.n - a.n, L2 = de * de + dn * dn;
    const t = clamp(((e - a.e) * de + (n - a.n) * dn) / L2, 0, 1);
    const pe = a.e + de * t, pn = a.n + dn * t;
    const d = Math.hypot(e - pe, n - pn);
    if (d < best) { best = d; sign = (e - pe) * -dn + (n - pn) * de >= 0 ? 1 : -1; }
  }
  return best * sign;
}
// direction of the waterline near a point, in degrees, pointing to whichever side is closer to `toward`
function shoreBearing(e, n, toward) {
  let best = Infinity, b = 0;
  for (let k = 0; k < SHORE.length - 1; k++) {
    const a = SHORE[k], c = SHORE[k + 1];
    const mid = Math.hypot(e - (a.e + c.e) / 2, n - (a.n + c.n) / 2);
    if (mid < best) { best = mid; b = (deg(Math.atan2(c.e - a.e, c.n - a.n)) + 360) % 360; }
  }
  const diff = Math.abs(((b - toward + 540) % 360) - 180);
  return diff > 90 ? (b + 180) % 360 : b;
}

for (let guard = 0; guard < 6; guard++) {
  POINTS.forEach((p) => {
    if (p.e !== undefined || !p.derive) return;
    const f = byId[p.derive.from];
    if (f.e === undefined) return;
    if (p.derive.along === 'shore') p.derive.bearing = Math.round(shoreBearing(f.e, f.n, p.derive.toward));
    p.e = f.e + Math.sin(rad(p.derive.bearing)) * p.derive.dist;
    p.n = f.n + Math.cos(rad(p.derive.bearing)) * p.derive.dist;
    const g = toGeo(p.e, p.n);
    p.latDec = g.lat; p.lonDec = g.lon;
    p.estimated = true;
  });
}

function ddmText(v, isLat) {
  const a = Math.abs(v);
  let d = Math.floor(a);
  let m = (a - d) * 60;
  if (m >= 59.9995) { d += 1; m = 0; }
  const dd = isLat ? String(d) : String(d).padStart(3, '0');
  return `${isLat ? (v >= 0 ? 'N' : 'S') : (v >= 0 ? 'E' : 'W')} ${dd}°${m.toFixed(3).padStart(6, '0')}′`;
}
const bearingBetween = (a, b) => (deg(Math.atan2(b.e - a.e, b.n - a.n)) + 360) % 360;
const distBetween = (a, b) => Math.hypot(b.e - a.e, b.n - a.n);

/* ═════════════ the marked corals (from findings.js) ═════════════ */
const DEMO = new URLSearchParams(location.search).has('demo');
if (DEMO) applyDemo(CORALS);
const coralById = {};
const toDec = (v) => (Array.isArray(v) ? ddm(v) : v);
CORALS.forEach((c, i) => { c.num = i + 1; c.isCoral = true; coralById[c.id] = c; });
for (let guard = 0; guard < 4; guard++) {
  CORALS.forEach((c) => {
    if (c.e !== undefined) return;
    if (c.lat != null && c.lon != null) {
      c.latDec = toDec(c.lat); c.lonDec = toDec(c.lon);
      Object.assign(c, toLocal(c.latDec, c.lonDec));
    } else if (c.fromPoint) {
      const f = byId[c.fromPoint.point] || coralById[c.fromPoint.point];
      if (!f || f.e === undefined) return;
      c.e = f.e + Math.sin(rad(c.fromPoint.bearing)) * c.fromPoint.dist;
      c.n = f.n + Math.cos(rad(c.fromPoint.bearing)) * c.fromPoint.dist;
      const g = toGeo(c.e, c.n);
      c.latDec = g.lat; c.lonDec = g.lon;
      c.estimated = true;
    }
  });
}
CORALS.forEach((c) => { c.placed = c.e !== undefined; c.calc = derive(c); });
const PLACED = CORALS.filter((c) => c.placed);
const CAM = byId.camera;
const ctx = (c, f) => (LANG === 'en' && c['en_' + f] ? c['en_' + f] : c[f]);
const floatName = (c) => FLOATS[c.float][LANG];
const coralName = (c) => t('coralName', c.num, floatName(c));

/* ═════════════ position along the shore ═════════════ */
POINTS.forEach((p) => (p.s = seaDist(p.e, p.n)));
// metres along the shore from the pier, positive towards the north-east.
// Measured on a straight axis following the coast at the pier, so it changes smoothly everywhere
// (the nearest point on a curved waterline can jump from one bend to another).
const SHORE_AXIS = (() => { const b = rad(shoreBearing(byId.pier.e, byId.pier.n, 45)); return { e: Math.sin(b), n: Math.cos(b) }; })();
const alongShore = (e, n) => (e - byId.pier.e) * SHORE_AXIS.e + (n - byId.pier.n) * SHORE_AXIS.n;

/* ═════════════ seabed model ═════════════
   Depth lines (3, 6, 10 m) read from the IUI beach sign, a reef wall from
   12 m down to 25 m, and a local shift of those lines so the surface passes
   through every depth the team measured. */
function isoAt(t) {
  const L = ISOBATHS;
  if (t <= L[0].t) return L[0];
  if (t >= L[L.length - 1].t) return L[L.length - 1];
  let k = 0;
  while (L[k + 1].t < t) k++;
  const a = L[k], b = L[k + 1], f = (t - a.t) / (b.t - a.t);
  return { s3: a.s3 + (b.s3 - a.s3) * f, s6: a.s6 + (b.s6 - a.s6) * f, s10: a.s10 + (b.s10 - a.s10) * f };
}
// monotone cubic (Fritsch–Carlson) through the knots, so depth always grows towards the sea
function pchip(xs, ys, x) {
  const n = xs.length;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];
  let k = 0;
  while (xs[k + 1] < x) k++;
  const d = (i) => (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  const m = (i) => {
    if (i === 0) return d(0);
    if (i === n - 1) return d(n - 2);
    const a = d(i - 1), b = d(i);
    if (a * b <= 0) return 0;
    const w1 = 2 * (xs[i + 1] - xs[i]) + (xs[i] - xs[i - 1]), w2 = (xs[i + 1] - xs[i]) + 2 * (xs[i] - xs[i - 1]);
    return (w1 + w2) / (w1 / a + w2 / b);
  };
  const h = xs[k + 1] - xs[k], t = (x - xs[k]) / h;
  const h00 = 2 * t ** 3 - 3 * t ** 2 + 1, h10 = t ** 3 - 2 * t ** 2 + t, h01 = -2 * t ** 3 + 3 * t ** 2, h11 = t ** 3 - t ** 2;
  return h00 * ys[k] + h10 * h * m(k) + h01 * ys[k + 1] + h11 * h * m(k + 1);
}
function profileAt(s, t) {
  if (s <= 0) return 0;
  const iso = isoAt(t);
  const s12 = iso.s10 + DROP.d12After10, s25 = s12 + DROP.wallTo25;
  if (s >= s25) return DROP.floor + 4 * (1 - Math.exp(-(s - s25) / 60)); // the deep floor keeps sloping gently, never flat
  return pchip([0, iso.s3, iso.s6, iso.s10, s12, s25], [0, 3, 6, 10, 12, DROP.floor], s);
}
// distance from shore at which the profile reaches depth d (inverse of profileAt)
function sForDepth(d, t) {
  let lo = 0, hi = 200;
  for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (profileAt(mid, t) < d) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
POINTS.forEach((p) => {
  p.t = alongShore(p.e, p.n);
  if (p.hasDepth) p.shift = sForDepth(p.depthMid, p.t) - p.s;
});
// the seabed also passes through each marked coral's measured depth
PLACED.forEach((c) => {
  c.s = seaDist(c.e, c.n); c.t = alongShore(c.e, c.n);
  if (typeof c.depth === 'number') c.shift = sForDepth(c.depth, c.t) - c.s;
});
const DEPTH_REFS = [...POINTS, ...PLACED];
// how far the depth lines are shifted at a given spot: exact at each point, fading out ~30 m away
function lineShift(e, n) {
  let ws = 0, wr = 0;
  for (const p of DEPTH_REFS) {
    if (p.shift === undefined) continue;
    const d2 = (e - p.e) ** 2 + (n - p.n) ** 2;
    const w = Math.exp(-d2 / (2 * 16 * 16)) / (d2 + 0.6) ** 1.5;
    ws += w; wr += w * p.shift;
  }
  return wr / (ws + 0.0015);
}
const seabedModel = (e, n, s) => {
  const noise = 0.1 * Math.sin(e * 0.19 + n * 0.11) + 0.07 * Math.sin(e * 0.07 - n * 0.23 + 1.3) + 0.04 * Math.sin(e * 0.41 + n * 0.37 + 2.1);
  return profileAt(s + lineShift(e, n), alongShore(e, n)) + noise * Math.min(1, s / 10);
};
const MAX_DEPTH = DROP.floor + 5;

/* models that run along the shore */
POINTS.forEach((p) => {
  if (['nursery', 'deep', 'shahar'].includes(p.id)) p.heading = (shoreBearing(p.e, p.n, 45) + 90) % 360; // long side along the shore
});
/* level pads under the objects, so they stand on the seabed instead of sinking into the slope */
POINTS.forEach((p) => {
  if (p.model !== 'tables3') return;
  p.heading = shoreBearing(p.e, p.n, 45); // the three tables run along the shore
  const b = rad(p.heading), gap = p.spacing || 5.5;
  p.parts = [-1, 0, 1].map((k) => ({ e: p.e + Math.sin(b) * gap * k, n: p.n + Math.cos(b) * gap * k, r: 1.3 }));
});
const PADS = [];
POINTS.forEach((p) => {
  if (!p.model) return;
  const parts = p.parts || [{ e: p.e, n: p.n, r: p.dims.length >= 2 ? Math.hypot(p.dims[0], p.dims[1]) / 2 + 0.5 : 1.2 }];
  parts.forEach((q) => { const s = seaDist(q.e, q.n); PADS.push({ ...q, d: clamp(seabedModel(q.e, q.n, s), 0, MAX_DEPTH) }); });
});
const smooth01 = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/* paths the team swam at one depth: the seabed along them runs evenly from end to end */
const LEVEL_PATHS = [['nursery', 'tables3']].map(([a, b]) => {
  const A = byId[a], B = byId[b];
  const dA = clamp(seabedModel(A.e, A.n, seaDist(A.e, A.n)), 0, MAX_DEPTH);
  const dB = clamp(seabedModel(B.e, B.n, seaDist(B.e, B.n)), 0, MAX_DEPTH);
  return { A, B, dA, dB, half: 4, fade: 7 };
});
function levelPaths(e, n, d) {
  for (const L of LEVEL_PATHS) {
    const de = L.B.e - L.A.e, dn = L.B.n - L.A.n, L2 = de * de + dn * dn;
    const t = clamp(((e - L.A.e) * de + (n - L.A.n) * dn) / L2, 0, 1);
    const dist = Math.hypot(e - (L.A.e + de * t), n - (L.A.n + dn * t));
    if (dist >= L.half + L.fade) continue;
    const w = 1 - smooth01(L.half, L.half + L.fade, dist);
    d += (L.dA + (L.dB - L.dA) * t - d) * w;
  }
  return d;
}
// the level pads under objects on such a path follow it too
PADS.forEach((q) => (q.d = levelPaths(q.e, q.n, q.d)));

// depth in metres (negative on the beach)
function seabed(e, n) {
  const s = seaDist(e, n);
  if (s <= 0) return -1.6 * (1 - Math.exp(s / 18));
  const d = levelPaths(e, n, clamp(seabedModel(e, n, s), 0, MAX_DEPTH));
  // nearby pads are blended with each other, so close objects don't fight over the same ground
  let ws = 0, wd = 0, wmax = 0;
  for (const q of PADS) {
    const dist = Math.hypot(e - q.e, n - q.n);
    if (dist >= q.r + 2) continue;
    const w = 1 - smooth01(q.r, q.r + 2, dist);
    const sharp = w ** 3;
    ws += sharp; wd += sharp * q.d; wmax = Math.max(wmax, w);
  }
  return ws > 0 ? d + (wd / ws - d) * wmax : d;
}
const yAt = (e, n) => -seabed(e, n) * EX;
const inSea = (e, n) => seaDist(e, n) > 1.5;

/* ═════════════ seabed cover (reef / stones / sand) from the team's ground map ═════════════ */
const PIER_HEAD = { e: byId.pier.e + PIER.headOffset[0], n: byId.pier.n + PIER.headOffset[1] };
function mapPxToLocal([x, y]) {
  const [ax, ay] = GROUND_MAP.anchorPx;
  const dx = x - ax, dy = y - ay;
  const dist = Math.hypot(dx, dy) * GROUND_MAP.metresPerPx;
  const b = Math.atan2(dx, -dy) + rad(GROUND_MAP.rotationDeg);
  return { e: PIER_HEAD.e + dist * Math.sin(b), n: PIER_HEAD.n + dist * Math.cos(b) };
}
const COVER_POLYS = COVER.map((c) => ({ type: c.type, pts: c.px.map(mapPxToLocal) }));
// signed distance to a polygon (positive inside)
function polyDist(poly, e, n) {
  let inside = false, best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.n > n) !== (b.n > n) && e < ((b.e - a.e) * (n - a.n)) / (b.n - a.n) + a.e) inside = !inside;
    const de = b.e - a.e, dn = b.n - a.n, L2 = de * de + dn * dn || 1;
    const t = clamp(((e - a.e) * de + (n - a.n) * dn) / L2, 0, 1);
    best = Math.min(best, Math.hypot(e - (a.e + de * t), n - (a.n + dn * t)));
  }
  return inside ? best : -best;
}
// gradual, slightly irregular borders between reef, stones and sand
function mixAt(e, n) {
  if (seaDist(e, n) < 0.5) return { gravel: 0, rubble: 0, rocks: 0, reef: 0 };
  const wobble = 1.6 * Math.sin(e * 0.31 + n * 0.17) + 1.1 * Math.sin(e * 0.13 - n * 0.37 + 2.0) + 0.7 * Math.sin(e * 0.71 + n * 0.53);
  let reef = 0, rocks = 0;
  for (const c of COVER_POLYS) {
    const w = smooth01(-3.5, 3.5, polyDist(c.pts, e, n) + wobble);
    if (c.type === 'reef') reef = Math.max(reef, w); else rocks = Math.max(rocks, w);
  }
  if (reef + rocks > 1) { const k = 1 / (reef + rocks); reef *= k; rocks *= k; }
  return { gravel: 0, rubble: rocks * 0.25, rocks: rocks * 0.75, reef };
}

/* ═════════════ block extent ═════════════ */
const MARGIN = 38;
// beach buildings within 150 m of the pier are part of the model
const NEAR_BUILDINGS = BUILDINGS.map((b) => ({ ...b, pts: b.ll.map(([lat, lon]) => toLocal(lat, lon)) }))
  .filter((b) => b.pts.every((q) => Math.hypot(q.e - byId.pier.e, q.n - byId.pier.n) < 150));
const ext = (() => {
  const bs = NEAR_BUILDINGS.flatMap((b) => b.pts);
  const es = [...POINTS.map((p) => p.e), ...PLACED.map((c) => c.e), ...bs.map((q) => q.e + 20)];
  const ns = [...POINTS.map((p) => p.n), ...PLACED.map((c) => c.n), ...bs.map((q) => q.n - 26)];
  const r10 = (v, f) => f(v / 10) * 10;
  return {
    e0: r10(Math.min(...es) - MARGIN, Math.floor), e1: r10(Math.max(...es) + MARGIN, Math.ceil),
    n0: r10(Math.min(...ns) - MARGIN, Math.floor), n1: r10(Math.max(...ns) + MARGIN, Math.ceil),
  };
})();
ext.w = ext.e1 - ext.e0; ext.h = ext.n1 - ext.n0;
ext.ce = (ext.e0 + ext.e1) / 2; ext.cn = (ext.n0 + ext.n1) / 2;
const BASE_Y = -(MAX_DEPTH + 2) * EX;
// world: x = east, z = -north
const W = (e, n, y) => new THREE.Vector3(e, y, -n);

/* ═════════════ theme colors ═════════════ */
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const c = (n) => new THREE.Color(cs.getPropertyValue(n).trim());
  return {
    paper: c('--paper'), ink: c('--ink'), ink2: c('--ink-2'), magenta: c('--magenta'), slice: c('--slice'),
    t1: c('--t1'), t2: c('--t2'), t3: c('--t3'), t4: c('--t4'), buff: c('--buff'), reef: c('--reef'), rock: c('--rock'),
    clay: c('--clay'), simBg: c('--sim-bg'),
    dark: document.documentElement.dataset.theme === 'dark',
  };
}
let T = readTheme();

/* ═════════════ renderer / scene ═════════════ */
const canvas = $('#scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
} catch (err) {
  $('#stage').insertAdjacentHTML('beforeend', `<p class="noscript">${t('noWebgl')}</p>`);
}
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 4000);
renderer?.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer?.setClearColor(T.paper);
renderer && (renderer.outputColorSpace = THREE.LinearSRGBColorSpace);

const controls = new MapControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.09;
controls.screenSpacePanning = false;
controls.minDistance = 10;
controls.maxDistance = 650;
controls.maxPolarAngle = rad(78);
controls.zoomToCursor = true;

/* ── chart shader (also renders the realistic simulation when uSim = 1) ── */
const chartUniforms = () => ({
  uT1: { value: T.t1.clone() }, uT2: { value: T.t2.clone() }, uT3: { value: T.t3.clone() }, uT4: { value: T.t4.clone() },
  uInk: { value: T.ink.clone() }, uSlice: { value: T.slice.clone() }, uLand: { value: T.buff.clone() },
  uSlices: { value: new THREE.Vector3(1, 1, 1) },
  uEx: { value: EX }, uWall: { value: 0 }, uDark: { value: T.dark ? 1 : 0 },
  uSim: { value: 0 }, uTime: { value: 0 }, uCover: { value: 1 },
  uReef: { value: T.reef.clone() }, uRock: { value: T.rock.clone() },
});
const chartVS = /* glsl */`
  attribute vec4 aMix;
  varying float vD; varying vec3 vN; varying vec3 vW; varying vec4 vMix;
  uniform float uEx;
  void main(){
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vD = -w.y / uEx;
    vMix = aMix;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const chartFS = /* glsl */`
  varying float vD; varying vec3 vN; varying vec3 vW; varying vec4 vMix;
  uniform vec3 uT1, uT2, uT3, uT4, uInk, uSlice, uSlices, uLand, uReef, uRock;
  uniform float uWall, uDark, uSim, uTime, uCover;
  float iso(float v, float k, float px){
    float fw = max(fwidth(v), 1e-4);
    return 1.0 - smoothstep(px * 0.5, px * 0.5 + 1.0, abs(v - k) / fw);
  }
  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
  float caustic(vec2 p, float t){
    vec2 q = p;
    for (int i = 0; i < 3; i++) q += vec2(sin(q.y * 1.3 + t), cos(q.x * 1.1 - t * 1.2)) * 0.45;
    float c = abs(sin(q.x * 1.6) + sin(q.y * 1.6)) * 0.5;
    return pow(1.0 - clamp(c, 0.0, 1.0), 7.0);
  }
  vec3 chartColor(float d, float sh){
    vec3 col = d < 0.0 ? uLand : d < 3.0 ? uT1 : d < 6.0 ? uT2 : d < 9.0 ? uT3 : uT4;
    col *= mix(mix(0.80, 0.62, uDark), 1.03, sh);
    col *= 1.0 - 0.10 * uWall;
    float fw = max(fwidth(d), 1e-4);
    float fine = 1.0 - smoothstep(0.4, 1.4, abs(d - floor(d + 0.5)) / fw);
    // thin 1 m lines fade out where they crowd together on the steep reef wall
    fine *= 1.0 - smoothstep(0.18, 0.45, fw);
    col = mix(col, uInk, fine * mix(0.16, 0.22, uDark) * step(0.0, d));
    col = mix(col, uInk, iso(d, 0.0, 2.0) * 0.9 * (1.0 - uWall));
    // seabed cover, drawn as chart-style tints: reef with small wave marks, stones as dots
    vec4 cv = vMix * uCover * (1.0 - uWall);
    float reef = cv.w, rock = cv.y + cv.z;
    vec2 q = vW.xz;
    float waves = smoothstep(0.82, 0.95, sin(q.x * 1.6 + sin(q.y * 1.3) * 1.4) * 0.5 + 0.5);
    float dots = 1.0 - smoothstep(0.14, 0.24, length(fract(q * 0.9 + vec2(hash(floor(q * 0.9)) * 0.3)) - 0.5));
    col = mix(col, uReef, reef * (0.38 + 0.35 * waves));
    col = mix(col, uRock, rock * (0.30 + 0.45 * dots));
    return col;
  }
  vec3 simColor(float d, float sh){
    vec2 p = vW.xz;
    float n1 = fbm(p * 0.35), n2 = fbm(p * 2.3);
    if (uWall > 0.5) {
      float band = step(0.5, fract(d * 1.2 + n1 * 0.7));
      return mix(vec3(0.60, 0.53, 0.41), vec3(0.71, 0.63, 0.49), band) * mix(0.72, 1.0, sh) * mix(1.0, 0.7, uDark);
    }
    if (d < 0.0) {
      vec3 dry = vec3(0.86, 0.78, 0.62) * (0.9 + 0.14 * n2);
      dry = mix(dry * 0.78, dry, smoothstep(0.0, 0.25, -d));
      return dry * mix(0.75, 1.03, sh) * mix(1.0, 0.72, uDark);
    }
    vec3 sand = vec3(0.80, 0.72, 0.56) * (0.86 + 0.18 * n1 + 0.06 * n2);
    sand *= 0.96 + 0.05 * sin(p.x * 3.1 + n1 * 6.0 + p.y * 0.8);
    vec3 gravel = mix(vec3(0.50, 0.48, 0.44), vec3(0.70, 0.66, 0.60), hash(floor(p * 7.0)));
    vec3 rubble = mix(vec3(0.58, 0.54, 0.46), vec3(0.78, 0.74, 0.66), step(0.5, fbm(p * 1.6))) * (0.85 + 0.2 * hash(floor(p * 4.0)));
    vec3 rock = vec3(0.42, 0.40, 0.36) * (0.7 + 0.55 * fbm(p * 0.9));
    vec3 reef = mix(vec3(0.44, 0.39, 0.30), vec3(0.58, 0.38, 0.50), smoothstep(0.45, 0.7, fbm(p * 0.7 + 3.0)));
    reef = mix(reef, vec3(0.40, 0.48, 0.35), smoothstep(0.55, 0.8, fbm(p * 1.1 + 9.0)));
    vec4 w = clamp(vMix * uCover * 1.7 * (0.55 + 0.9 * vec4(fbm(p * 0.6 + 1.0), fbm(p * 0.6 + 5.0), fbm(p * 0.6 + 9.0), fbm(p * 0.6 + 13.0))), 0.0, 1.0);
    float ws = w.x + w.y + w.z + w.w;
    if (ws > 1.0) { w /= ws; ws = 1.0; }
    vec3 col = sand * (1.0 - ws) + gravel * w.x + rubble * w.y + rock * w.z + reef * w.w;
    col *= mix(0.72, 1.05, sh);
    col += vec3(0.85, 1.0, 1.0) * caustic(p * 0.42, uTime * 0.6) * 0.30 * exp(-0.13 * d);
    vec3 water = mix(vec3(0.20, 0.62, 0.70), vec3(0.04, 0.27, 0.40), clamp(d / 12.0, 0.0, 1.0));
    col = mix(col * vec3(0.78, 0.95, 1.02), water, (1.0 - exp(-0.15 * d)) * 0.82);
    return col * mix(1.0, 0.68, uDark);
  }
  void main(){
    float d = vD;
    vec3 L = normalize(vec3(-0.45, 0.82, 0.36));
    float sh = clamp(dot(normalize(vN), L), 0.0, 1.0);
    vec3 col = uSim > 0.5 ? simColor(d, sh) : chartColor(d, sh);
    float s = iso(d, 3.0, 2.2) * uSlices.x + iso(d, 6.0, 2.2) * uSlices.y + iso(d, 9.0, 2.2) * uSlices.z;
    col = mix(col, uSlice, clamp(s, 0.0, 1.0) * mix(0.95, 0.75, uSim));
    gl_FragColor = vec4(col, 1.0);
  }`;
const bedMat = new THREE.ShaderMaterial({ uniforms: chartUniforms(), vertexShader: chartVS, fragmentShader: chartFS });
const wallMat = new THREE.ShaderMaterial({ uniforms: chartUniforms(), vertexShader: chartVS, fragmentShader: chartFS });
wallMat.uniforms.uWall.value = 1;

/* ── seabed mesh ── */
const SEG = isPhone() ? 130 : 190;
{
  const g = new THREE.PlaneGeometry(ext.w, ext.h, SEG, Math.round((SEG * ext.h) / ext.w));
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const mix = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const e = pos.getX(i) + ext.ce, n = -pos.getZ(i) + ext.cn;
    pos.setXYZ(i, e, yAt(e, n), -n);
    const m = mixAt(e, n);
    mix.set([m.gravel, m.rubble, m.rocks, m.reef], i * 4);
  }
  g.setAttribute('aMix', new THREE.BufferAttribute(mix, 4));
  g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, bedMat));
}

/* ── block walls (the cut faces of the block diagram) ── */
{
  const STEP = 1.5;
  const sides = [
    { from: [ext.e0, ext.n0], to: [ext.e1, ext.n0] },
    { from: [ext.e1, ext.n0], to: [ext.e1, ext.n1] },
    { from: [ext.e1, ext.n1], to: [ext.e0, ext.n1] },
    { from: [ext.e0, ext.n1], to: [ext.e0, ext.n0] },
  ];
  const verts = [];
  sides.forEach(({ from, to }) => {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const k = Math.ceil(len / STEP);
    for (let i = 0; i < k; i++) {
      const a = i / k, b = (i + 1) / k;
      const ea = from[0] + (to[0] - from[0]) * a, na = from[1] + (to[1] - from[1]) * a;
      const eb = from[0] + (to[0] - from[0]) * b, nb = from[1] + (to[1] - from[1]) * b;
      const ta = W(ea, na, yAt(ea, na) - 0.02), tb = W(eb, nb, yAt(eb, nb) - 0.02);
      const ba = W(ea, na, BASE_Y), bb = W(eb, nb, BASE_Y);
      verts.push(...ta.toArray(), ...ba.toArray(), ...tb.toArray(), ...tb.toArray(), ...ba.toArray(), ...bb.toArray());
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('aMix', new THREE.Float32BufferAttribute(new Float32Array((verts.length / 3) * 4), 4));
  g.computeVertexNormals();
  wallMat.side = THREE.DoubleSide;
  scene.add(new THREE.Mesh(g, wallMat));
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(ext.w, 0.001, ext.h)),
    new THREE.LineBasicMaterial({ color: T.ink, transparent: true, opacity: 0.55 })
  );
  outline.position.set(ext.ce, BASE_Y, -ext.cn);
  outline.userData.themeColor = 'ink';
  scene.add(outline);
}

/* ── surface neatline with 10 m graduation, and a faint 20 m graticule ── */
const themed = [];
{
  const pts = [];
  const y = 0;
  const tick = (e, n, de, dn, len) => { pts.push(W(e, n, y), W(e + de * len, n + dn * len, y)); };
  pts.push(W(ext.e0, ext.n0, y), W(ext.e1, ext.n0, y), W(ext.e1, ext.n0, y), W(ext.e1, ext.n1, y),
           W(ext.e1, ext.n1, y), W(ext.e0, ext.n1, y), W(ext.e0, ext.n1, y), W(ext.e0, ext.n0, y));
  for (let e = ext.e0; e <= ext.e1; e += 10) {
    const L = (e - ext.e0) % 50 === 0 ? 3.2 : 1.6;
    tick(e, ext.n0, 0, -1, L); tick(e, ext.n1, 0, 1, L);
  }
  for (let n = ext.n0; n <= ext.n1; n += 10) {
    const L = (n - ext.n0) % 50 === 0 ? 3.2 : 1.6;
    tick(ext.e0, n, -1, 0, L); tick(ext.e1, n, 1, 0, L);
  }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const m = new THREE.LineBasicMaterial({ color: T.ink, transparent: true, opacity: 0.75 });
  const neat = new THREE.LineSegments(g, m);
  neat.userData.themeColor = 'ink';
  scene.add(neat); themed.push(neat);

  const gp = [];
  for (let e = ext.e0 + 20; e < ext.e1; e += 20) gp.push(W(e, ext.n0, 0), W(e, ext.n1, 0));
  for (let n = ext.n0 + 20; n < ext.n1; n += 20) gp.push(W(ext.e0, n, 0), W(ext.e1, n, 0));
  const grid = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gp),
    new THREE.LineBasicMaterial({ color: T.ink, transparent: true, opacity: 0.09, depthWrite: false }));
  grid.userData.themeColor = 'ink';
  scene.add(grid); themed.push(grid);
}

/* ── depth slice planes ── */
const slices = {};
SITE.slices.forEach((d) => {
  const grp = new THREE.Group();
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(ext.w, ext.h).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: T.slice, transparent: true, opacity: T.dark ? 0.13 : 0.1, depthWrite: false, side: THREE.DoubleSide })
  );
  plane.position.set(ext.ce, -d * EX, -ext.cn);
  plane.renderOrder = 2;
  plane.userData.themeColor = 'slice';
  grp.add(plane);
  const rim = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
    W(ext.e0, ext.n0, -d * EX), W(ext.e1, ext.n0, -d * EX), W(ext.e1, ext.n1, -d * EX), W(ext.e0, ext.n1, -d * EX),
  ]), new THREE.LineBasicMaterial({ color: T.slice, transparent: true, opacity: 0.9 }));
  rim.userData.themeColor = 'slice';
  grp.add(rim);
  scene.add(grp);
  slices[d] = { on: true, grp, anchor: W(ext.e0, ext.n0, -d * EX) };
});

/* ── 3D models of the objects (true size), plus the pier ── */
const hemi = new THREE.HemisphereLight(0xe8f4ff, 0x8a7a5a, 2.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.3);
sun.position.set(-45, 82, -36);
scene.add(sun);
const kit = new Kit();
kit.setMode('chart', T.clay);
POINTS.forEach((p) => {
  if (!p.model) return;
  const obj = buildObject(kit, p);
  if (!obj) return;
  obj.position.copy(W(p.e, p.n, yAt(p.e, p.n)));
  if (p.heading != null) obj.rotation.y = Math.atan2(Math.sin(rad(p.heading)), -Math.cos(rad(p.heading)));
  // tables in a row each stand on their own patch of seabed
  if (p.parts && obj.children.length === p.parts.length) {
    const y0 = yAt(p.e, p.n);
    obj.children.forEach((c, k) => (c.position.y = yAt(p.parts[k].e, p.parts[k].n) - y0));
  }
  scene.add(obj);
});
{
  const head = { e: byId.pier.e + PIER.headOffset[0], n: byId.pier.n + PIER.headOffset[1] };
  scene.add(buildPier(kit, { head, bearing: PIER.bearing, headSize: PIER.headSize, walkWidth: PIER.walkWidth, seaDist, yAt, W }));
}
scene.add(buildBuildings(kit, NEAR_BUILDINGS, { ext, seaDist, yAt }));
scene.add(buildPipes(kit, { head: PIER_HEAD, bearing: PIER.bearing, offsets: PIPES.offsets, diameter: PIPES.diameter, color: PIPES.color, seaDist, yAt, W, ext }));

/* ── simulation extras: scattered rocks and coral heads, and the water surface ── */
let scatter = null;
const waterMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
  uniforms: { uTime: { value: 0 }, uDark: { value: 0 } },
  vertexShader: `attribute float aSea; varying float vSea; varying vec3 vW;
    void main(){ vSea = aSea; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `varying float vSea; varying vec3 vW; uniform float uTime, uDark;
    void main(){
      if (vSea < 0.0) discard;
      float r = sin(vW.x * 0.9 + uTime * 1.3) * sin(vW.z * 0.7 - uTime) * 0.5 + 0.5;
      vec3 c = mix(vec3(0.16, 0.55, 0.68), vec3(0.55, 0.85, 0.92), r * 0.35);
      float edge = smoothstep(0.0, 3.0, vSea);
      gl_FragColor = vec4(c * mix(1.0, 0.6, uDark), mix(0.55, 0.16, edge));
    }`,
});
const water = (() => {
  const g = new THREE.PlaneGeometry(ext.w, ext.h, 100, Math.round((100 * ext.h) / ext.w)).rotateX(-Math.PI / 2);
  const pos = g.attributes.position, sea = new Float32Array(pos.count);
  for (let k = 0; k < pos.count; k++) sea[k] = seaDist(pos.getX(k) + ext.ce, -pos.getZ(k) + ext.cn);
  g.setAttribute('aSea', new THREE.BufferAttribute(sea, 1));
  return new THREE.Mesh(g, waterMat);
})();
water.position.set(ext.ce, 0.02, -ext.cn);
water.renderOrder = 4;
water.visible = false;
scene.add(water);

/* ── pins on the landmarks + plumb lines ── */
const pinMat = new THREE.MeshBasicMaterial({ color: T.ink, transparent: true, depthTest: false, fog: false });
const pinCamMat = new THREE.MeshBasicMaterial({ color: T.slice, transparent: true, depthTest: false, fog: false });
const pinSelMat = new THREE.MeshBasicMaterial({ color: T.magenta, transparent: true, depthTest: false, fog: false });
const pinDotMat = new THREE.MeshBasicMaterial({ color: T.paper, transparent: true, depthTest: false, fog: false });
const plumbMat = new THREE.LineDashedMaterial({ color: T.ink, dashSize: 0.9, gapSize: 0.9, transparent: true, opacity: 0.38, fog: false });
const PIN_HEAD_Y = 3.1;
const pinHead = new THREE.SphereGeometry(1, 24, 16);
const pinNeedle = new THREE.ConeGeometry(0.5, PIN_HEAD_Y, 18).rotateX(Math.PI).translate(0, PIN_HEAD_Y / 2, 0);
const pinDot = new THREE.CircleGeometry(0.42, 20);
const markers = [];
POINTS.forEach((p) => {
  const ground = W(p.e, p.n, yAt(p.e, p.n));
  p.world = ground;
  const grp = new THREE.Group();
  const base = p.live ? pinCamMat : pinMat;
  const needle = new THREE.Mesh(pinNeedle, base);
  const head = new THREE.Mesh(pinHead, base);
  head.position.y = PIN_HEAD_Y;
  const dot = new THREE.Mesh(pinDot, pinDotMat);
  dot.position.y = PIN_HEAD_Y;
  grp.add(needle, head, dot);
  grp.position.copy(ground);
  [needle, head, dot].forEach((m, k) => (m.renderOrder = 10 + k));
  scene.add(grp);
  const pl = new THREE.Line(new THREE.BufferGeometry().setFromPoints([ground.clone().add(new THREE.Vector3(0, 0.5, 0)), new THREE.Vector3(ground.x, 0, ground.z)]), plumbMat);
  pl.computeLineDistances();
  scene.add(pl);
  markers.push({ p, grp, parts: [needle, head], base, dot, intro: 0 });
});
const selRing = new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints(Array.from({ length: 64 }, (_, i) => new THREE.Vector3(Math.cos((i / 64) * Math.PI * 2) * 4, 0, Math.sin((i / 64) * Math.PI * 2) * 4))),
  new THREE.LineDashedMaterial({ color: T.magenta, dashSize: 0.8, gapSize: 0.6, depthTest: false, transparent: true, fog: false })
);
selRing.computeLineDistances();
selRing.renderOrder = 11;
selRing.visible = false;
scene.add(selRing);

/* ── lines draped on the seabed (search-area outlines) ── */
const lineMats = [];
function drape(pts, opts) {
  const arr = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const k = Math.max(1, Math.ceil(distBetween(a, b) / 1.2));
    for (let j = i ? 1 : 0; j <= k; j++) {
      const f = j / k, e = a.e + (b.e - a.e) * f, n = a.n + (b.n - a.n) * f;
      arr.push(e, yAt(e, n) + 0.4, -n);
    }
  }
  const g = new LineGeometry(); g.setPositions(arr);
  const m = new LineMaterial({ color: opts.color, linewidth: opts.width, dashed: !!opts.dash, dashSize: opts.dash || 1, gapSize: opts.gap || 1, transparent: true, opacity: 0 });
  m.fog = false;
  m.userData = { role: opts.role, max: opts.opacity || 1 };
  lineMats.push(m);
  const line = new Line2(g, m); line.computeLineDistances();
  line.renderOrder = 5;
  scene.add(line);
  return line;
}

/* ── search areas north and south of the camera, following the shore ── */
const SEAWARD = (() => {
  let v = { e: SHORE_AXIS.n, n: -SHORE_AXIS.e };
  if (seaDist(CAM.e + v.e * 10, CAM.n + v.n * 10) < seaDist(CAM.e, CAM.n)) v = { e: -v.e, n: -v.n };
  return v;
})();
// the spot at `t` metres along the shore whose distance from the waterline is `s`
function shorePoint(t, s) {
  const be = byId.pier.e + SHORE_AXIS.e * t, bn = byId.pier.n + SHORE_AXIS.n * t;
  let lo = -150, hi = 250;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (seaDist(be + SEAWARD.e * mid, bn + SEAWARD.n * mid) < s) lo = mid; else hi = mid;
  }
  const k = (lo + hi) / 2;
  return { e: be + SEAWARD.e * k, n: bn + SEAWARD.n * k };
}
const zones = Object.entries(ZONES).map(([key, z]) => {
  const col = new THREE.Color(PAIRS[key].color);
  const t0 = CAM.t + z.along[0], t1 = CAM.t + z.along[1];
  const s0 = Math.max(2, CAM.s + z.across[0]), s1 = CAM.s + z.across[1];
  const NT = 30, NS = 8;
  const verts = [], idx = [];
  for (let i = 0; i <= NT; i++) {
    for (let j = 0; j <= NS; j++) {
      const q = shorePoint(t0 + (t1 - t0) * (i / NT), s0 + (s1 - s0) * (j / NS));
      verts.push(q.e, yAt(q.e, q.n) + 0.25, -q.n);
    }
  }
  for (let i = 0; i < NT; i++) for (let j = 0; j < NS; j++) {
    const a = i * (NS + 1) + j, b = a + NS + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  const fill = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  fill.renderOrder = 3;
  scene.add(fill);
  const edge = [];
  for (let i = 0; i <= NT; i++) edge.push(shorePoint(t0 + (t1 - t0) * (i / NT), s0));
  for (let j = 1; j <= NS; j++) edge.push(shorePoint(t1, s0 + (s1 - s0) * (j / NS)));
  for (let i = NT - 1; i >= 0; i--) edge.push(shorePoint(t0 + (t1 - t0) * (i / NT), s1));
  for (let j = NS - 1; j >= 0; j--) edge.push(shorePoint(t0, s0 + (s1 - s0) * (j / NS)));
  drape(edge, { color: col, width: 2, dash: 1.6, gap: 1.1, role: 'zone' });
  // a trail from the camera into the area, showing which way the pair swims
  const tm = (t0 + t1) / 2, sm = (s0 + s1) / 2;
  const trailPts = [{ e: CAM.e, n: CAM.n }];
  for (let i = 1; i <= 12; i++) trailPts.push(shorePoint(CAM.t + (tm - CAM.t) * (i / 12) * 0.82, CAM.s + (sm - CAM.s) * (i / 12)));
  drape(trailPts, { color: col, width: 3, dash: 2.2, gap: 1.3, role: 'trail' });
  const c = shorePoint(tm, sm);
  const poly = edge.filter((_, k) => k % 3 === 0).map((q) => toGeo(q.e, q.n));
  return { key, col, fill, center: W(c.e, c.n, yAt(c.e, c.n) + 0.6), mid: c, poly, edge, trail: trailPts };
});

/* ── the marked corals: colony, anchor stone, rope and float ── */
function buildColony(c) {
  const [w, l, h] = (c.sizeCm || []).map((v) => (typeof v === 'number' ? v / 100 : null));
  const rw = (w || 0.4) / 2, rl = (l || 0.4) / 2, rh = h || 0.22;
  const g = new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const bump = 1 + 0.05 * Math.sin(x * 23 + z * 17) * Math.sin(y * 19 + x * 7);
    pos.setXYZ(i, x * rw * bump, y * rh * bump, z * rl * bump);
  }
  g.computeVertexNormals();
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#D9BCA9', roughness: 0.85 })));
  // one dark burrow opening per counted hole (up to 60), spread over the dome
  const n = Math.min(60, typeof c.holes === 'number' ? c.holes : 0);
  const holeGeo = new THREE.SphereGeometry(0.012, 8, 6).scale(1.8, 0.6, 1);
  const holeMat = new THREE.MeshBasicMaterial({ color: '#2A1E18' });
  for (let k = 0; k < n; k++) {
    const u = (k + 0.5) / n, a = k * 2.399963;
    const y = 0.25 + 0.72 * u, r = Math.sqrt(1 - y * y);
    const m = new THREE.Mesh(holeGeo, holeMat);
    m.position.set(Math.cos(a) * r * rw, y * rh, Math.sin(a) * r * rl);
    m.lookAt(m.position.clone().multiply(new THREE.Vector3(2, 2, 2)));
    grp.add(m);
  }
  return grp;
}
const coralMarks = PLACED.map((c, i) => {
  const ground = W(c.e, c.n, yAt(c.e, c.n));
  c.world = ground;
  const colony = buildColony(c);
  colony.position.copy(ground);
  scene.add(colony);
  // the stone sits a little inshore of the colony, never on it
  const se = c.e - SEAWARD.e * 0.9, sn = c.n - SEAWARD.n * 0.9;
  const stone = buildAnchor();
  stone.position.copy(W(se, sn, yAt(se, sn) + 0.05));
  scene.add(stone);
  const fl = buildFloat(c.float);
  scene.add(fl.group);
  const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([stone.position.clone(), stone.position.clone()]), new THREE.LineBasicMaterial({ color: '#F1EFE6', transparent: true, opacity: 0.9 }));
  scene.add(rope);
  const ring = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(Array.from({ length: 48 }, (_, k) => new THREE.Vector3(Math.cos((k / 48) * Math.PI * 2) * 1.6, 0, Math.sin((k / 48) * Math.PI * 2) * 1.6))),
    new THREE.LineBasicMaterial({ color: PAIRS[c.pair].color, transparent: true, opacity: 0.95, depthTest: false })
  );
  ring.position.copy(ground).add(new THREE.Vector3(0, 0.3, 0));
  ring.renderOrder = 9;
  scene.add(ring);
  // a soft halo around the light stick, shown in night view
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: new THREE.Color(GLOW[c.float]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
  halo.visible = false;
  scene.add(halo);
  return { c, ground, stone, float: fl, rope, ring, halo, phase: i * 1.7 };
});
function haloTexture() {
  if (haloTexture.tex) return haloTexture.tex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  haloTexture.tex = new THREE.CanvasTexture(cv);
  return haloTexture.tex;
}

/* ═════════════ HTML overlay labels ═════════════ */
const labelLayer = $('#labels');
const labels = [];
POINTS.forEach((p) => {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'plabel' + (p.live ? ' plabel-cam' : '');
  el.addEventListener('click', () => select(p.id));
  labelLayer.appendChild(el);
  const m = markers.find((x) => x.p === p);
  labels.push({ p, el, w: 0, h: 0, prio: p.live ? 1 : 3, pos: () => tmpL.copy(m.grp.position).add(tmpUp.set(0, PIN_HEAD_Y * m.grp.scale.y, 0)), gap: 16 });
});
coralMarks.forEach((cm) => {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'plabel plabel-coral';
  el.style.setProperty('--pair', PAIRS[cm.c.pair].color);
  el.addEventListener('click', () => select(cm.c.id));
  labelLayer.appendChild(el);
  labels.push({ p: cm.c, el, w: 0, h: 0, prio: 0, pos: () => cm.float.group.position, gap: 22 });
});
const tmpL = new THREE.Vector3(), tmpUp = new THREE.Vector3();
const zoneLabels = zones.map((z) => {
  const el = document.createElement('div');
  el.className = 'zlabel';
  el.style.setProperty('--pair', PAIRS[z.key].color);
  el.setAttribute('aria-hidden', 'true');
  labelLayer.appendChild(el);
  return { z, el, w: 0, h: 0 };
});
const sliceLabels = SITE.slices.map((d) => {
  const el = document.createElement('div');
  el.className = 'slabel';
  el.setAttribute('aria-hidden', 'true');
  labelLayer.appendChild(el);
  return { d, el };
});
function fillLabels() {
  labels.forEach(({ p, el }) => {
    if (p.isCoral) {
      const d = typeof p.depth === 'number' ? `${num(p.depth)} ${t('m')}` : '';
      el.innerHTML = `${badgeSVG(p.float, { size: 26 })}<span class="pname">${esc(floatName(p))}</span><span class="snd">${d}</span>`;
      el.setAttribute('aria-label', coralName(p));
      return;
    }
    el.innerHTML = `<span class="pname">${esc(nm(p))}</span><span class="snd">${p.hasDepth ? p.depthText : ''}${p.live ? t('liveSnd') : ''}</span>`;
    el.setAttribute('aria-label', p.hasDepth ? t('depthAria', nm(p), p.depthText) : nm(p));
  });
  zoneLabels.forEach(({ z, el }) => {
    const P = PAIRS[z.key][LANG];
    el.innerHTML = `<b>${esc(P.name)}</b><span>${esc(P.people.join(t('and')))}</span>`;
  });
  sliceLabels.forEach(({ d, el }) => { el.textContent = `${d} ${t('m')}`; });
}
fillLabels();
function measureLabels() {
  [...labels, ...zoneLabels].forEach((l) => {
    const was = l.el.hidden;
    l.el.hidden = false;
    l.w = l.el.offsetWidth; l.h = l.el.offsetHeight;
    l.el.hidden = was;
  });
}

/* ═════════════ sizing / view offset ═════════════ */
let vw = 1, vh = 1;
const viewOff = { x: 0, y: 0, tx: 0, ty: 0 };
function resize() {
  const r = canvas.getBoundingClientRect();
  vw = Math.max(1, r.width); vh = Math.max(1, r.height);
  renderer?.setSize(vw, vh, false);
  camera.aspect = vw / vh;
  applyViewOffset();
  lineMats.forEach((m) => m.resolution.set(vw, vh));
}
function applyViewOffset() {
  if (Math.abs(viewOff.x) < 0.5 && Math.abs(viewOff.y) < 0.5) camera.clearViewOffset();
  else camera.setViewOffset(vw, vh, viewOff.x, viewOff.y, vw, vh);
  camera.updateProjectionMatrix();
}
function panelOffset(open) {
  if (!open) return { x: 0, y: 0 };
  const panel = $('#panel');
  if (isPhone()) return { x: 0, y: Math.min(panel.offsetHeight, vh * 0.74) / 2 };
  return { x: ((isRTL() ? -1 : 1) * (panel.offsetWidth + 16)) / 2, y: 0 };
}

/* ═════════════ camera framing & flights ═════════════ */
function topView() {
  const fovV = rad(camera.fov);
  const halfW = (Math.max(...POINTS.map((p) => p.e)) - Math.min(...POINTS.map((p) => p.e))) / 2 + (isPhone() ? 44 : 26);
  const halfH = (Math.max(...POINTS.map((p) => p.n)) - Math.min(...POINTS.map((p) => p.n))) / 2 + 26;
  const cE = (Math.max(...POINTS.map((p) => p.e)) + Math.min(...POINTS.map((p) => p.e))) / 2;
  const cN = (Math.max(...POINTS.map((p) => p.n)) + Math.min(...POINTS.map((p) => p.n))) / 2;
  const phone = isPhone();
  const usableH = phone ? 0.62 : 0.86;
  const dist = Math.max(halfH / Math.tan(fovV / 2) / usableH, halfW / (Math.tan(fovV / 2) * camera.aspect) / 0.86);
  const target = new THREE.Vector3(cE, -6 * EX, -cN);
  return { target, pos: target.clone().add(new THREE.Vector3(0, dist, 0.001)) };
}

let flight = null;
function fly(target, pos, ms = 1100) {
  if (reduceMotion) ms = 0;
  flight = {
    t0: performance.now(), ms,
    fromT: controls.target.clone(), toT: target.clone(),
    fromP: camera.position.clone(), toP: pos.clone(),
    fromO: { x: viewOff.x, y: viewOff.y }, toO: { x: viewOff.tx, y: viewOff.ty },
  };
}
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function stepFlight(now) {
  if (!flight) return;
  const t = flight.ms ? clamp((now - flight.t0) / flight.ms, 0, 1) : 1;
  const k = ease(t);
  controls.target.lerpVectors(flight.fromT, flight.toT, k);
  camera.position.lerpVectors(flight.fromP, flight.toP, k);
  viewOff.x = flight.fromO.x + (flight.toO.x - flight.fromO.x) * k;
  viewOff.y = flight.fromO.y + (flight.toO.y - flight.fromO.y) * k;
  applyViewOffset();
  if (t >= 1) flight = null;
}
controls.addEventListener('start', () => {
  if (flight) { viewOff.x = viewOff.tx; viewOff.y = viewOff.ty; applyViewOffset(); flight = null; }
  canvas.classList.add('grabbing');
});
controls.addEventListener('end', () => canvas.classList.remove('grabbing'));

function focusPoint(p) {
  const target = p.world.clone();
  const cur = camera.position.clone().sub(controls.target);
  const sph = new THREE.Spherical().setFromVector3(cur);
  const size = p.isCoral ? 3 : p.id === 'pier' ? 13 : p.id === 'tables3' ? 8 : Math.max(1, ...(p.dims.length ? p.dims : [3]));
  sph.radius = clamp(size * 4.2, 14, 54) * (isPhone() ? 1.15 : 1);
  sph.phi = rad(48);
  if (cur.length() < 1) sph.theta = 0;
  return { target, pos: target.clone().add(new THREE.Vector3().setFromSpherical(sph)) };
}
function resetView() {
  viewOff.tx = panelOffset(!$('#panel').hidden).x;
  viewOff.ty = panelOffset(!$('#panel').hidden).y;
  const v = topView();
  fly(v.target, v.pos, 1200);
}

/* ═════════════ selection & panel ═════════════ */
let selected = null;
const panel = $('#panel');
const panelBody = $('#panelBody');

function bearingIcon(b) {
  return `<svg class="bearing" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="15.5"/><g transform="rotate(${b} 17 17)"><path d="M17 26V8M12.5 12.5L17 8l4.5 4.5"/></g></svg>`;
}

function dimsText(p) {
  if (p.dimsText) return esc(tx(p, 'dimsText'));
  if (!p.dims.length) return `<span class="muted">${p.live ? t('notRelevant') : t('notMeasuredPl')}</span>`;
  const [w, l, h] = p.dims;
  return t('dims', w, l, h);
}

function sketchSVG(p) {
  const Wd = 300, Hd = 180, pad = 30;
  if (p.shape === 'camera') {
    return `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="${t('skCam')}"><g class="sk" transform="translate(110 40)"><rect x="0" y="20" width="62" height="40" rx="4"/><circle cx="31" cy="40" r="12"/><circle cx="31" cy="40" r="5"/><path d="M62 30l20-10v40l-20-10"/><path d="M31 60v40M31 100l-22 30M31 100l22 30"/></g></svg>`;
  }
  if (p.shape === 'pier') {
    return `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="${t('skPier')}"><g transform="translate(40 40)"><path class="sk" d="M0 0H220M0 90H220"/><path class="sk-hid" d="M220 0V90"/><path class="sk-ground" d="M0 0V90" stroke-dasharray="1 4"/><path class="sk-dim" d="M190 6V84M184 12l6-6 6 6M184 78l6 6 6-6"/><text x="150" y="50" text-anchor="middle">9 ${t('m')}</text></g></svg>`;
  }
  const c30 = Math.cos(rad(30)), s30 = Math.sin(rad(30));
  const iso = (x, y, z) => [(x - y) * c30, (x + y) * s30 - z];
  let corners, edges, hidden, dims;
  if (p.shape === 'pyramid') {
    const s = p.dims[0], h = p.dims[2];
    const A = [0, 0, 0], B = [s, 0, 0], C = [s / 2, s * Math.sin(rad(60)), 0], top = [s / 2, (s * Math.sin(rad(60))) / 3, h];
    corners = [A, B, C, top];
    edges = [[B, C], [C, A], [A, top], [B, top], [C, top]];
    hidden = [[A, B]];
    dims = [[A, C, `${t('skSide')} ${s}`, [-26, 10]], [B, top, `${t('skH')} ${h}`, [30, 0]]];
  } else if (p.shape === 'cylinder') {
    const [d, l] = p.dims;
    return `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="${t('skCyl')}"><g transform="translate(60 50)"><ellipse class="sk" cx="170" cy="40" rx="18" ry="40"/><path class="sk" d="M10 0H170M10 80H170"/><path class="sk-hid" d="M10 0a18 40 0 0 0 0 80"/><path class="sk" d="M10 0a18 40 0 0 1 0 80"/><path class="sk-dim" d="M10 100H170"/><text x="90" y="118" text-anchor="middle">${t('skL')} ${l}</text><path class="sk-dim" d="M205 0V80"/><text x="212" y="44" text-anchor="start">${t('skDiam')} ${d}</text></g></svg>`;
  } else {
    const [w, l, h] = p.dims;
    const P = (x, y, z) => [x, y, z];
    const o = P(0, 0, 0), x1 = P(w, 0, 0), y1 = P(0, l, 0), xy = P(w, l, 0);
    const oz = P(0, 0, h), xz = P(w, 0, h), yz = P(0, l, h), xyz = P(w, l, h);
    corners = [o, x1, y1, xy, oz, xz, yz, xyz];
    edges = [[x1, xy], [y1, xy], [x1, xz], [y1, yz], [xy, xyz], [oz, xz], [oz, yz], [xz, xyz], [yz, xyz]];
    hidden = [[o, x1], [o, y1], [o, oz]];
    dims = [[y1, xy, `${t('skW')} ${w}`, [-26, 14]], [x1, xy, `${t('skL')} ${l}`, [26, 14]], [y1, yz, `${t('skH')} ${h}`, [-34, 4]]];
  }
  const pr = corners.map((c) => iso(...c));
  const xs = pr.map((q) => q[0]), ys = pr.map((q) => q[1]);
  const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
  const k = Math.min((Wd - pad * 2 - 40) / bw, (Hd - pad * 2) / bh);
  const ox = (Wd - bw * k) / 2 - Math.min(...xs) * k, oy = (Hd - bh * k) / 2 - Math.min(...ys) * k;
  const S = (c) => { const q = iso(...c); return [q[0] * k + ox, q[1] * k + oy]; };
  const seg = (a, b) => { const A = S(a), B = S(b); return `M${A[0].toFixed(1)} ${A[1].toFixed(1)}L${B[0].toFixed(1)} ${B[1].toFixed(1)}`; };
  const dimMarks = dims.map(([a, b, t, side]) => {
    const A = S(a), B = S(b);
    const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
    const off = side;
    return `<text x="${(mx + off[0]).toFixed(1)}" y="${(my + off[1]).toFixed(1)}" text-anchor="middle">${t}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="${t('skAria')}"><path class="sk-hid" d="${hidden.map((e) => seg(...e)).join('')}"/><path class="sk" d="${edges.map((e) => seg(...e)).join('')}"/>${dimMarks}</svg>`;
}

const thumb = (src) => src.replace(/\.jpg$/i, '-s.jpg');
function mediaHTML(p) {
  let html = '';
  if (p.live) {
    html += `<div class="p-media"><p class="live-tag">${t('live')}</p><div class="live"><iframe src="https://www.youtube-nocookie.com/embed/${LIVE_CAMERA_YOUTUBE_ID}?autoplay=1&mute=1&playsinline=1&rel=0" title="${t('liveTitle')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div><a class="live-link" href="https://www.youtube.com/watch?v=${LIVE_CAMERA_YOUTUBE_ID}" target="_blank" rel="noopener">${t('openYT')}</a></div>`;
  }
  if (p.photos && p.photos.length) {
    html += `<div class="p-media"><div class="gallery">${p.photos.map((ph, i) => `<button type="button" data-photo="${i}" aria-label="${t('photoAria', i + 1, p.photos.length)}"><img src="${esc(thumb(ph.src))}" alt="${esc(ph.caption || t('photoAlt', nm(p), i + 1))}" loading="lazy" decoding="async"></button>`).join('')}</div><p class="gallery-count">${t('photosCount', p.photos.length)}</p></div>`;
  } else if (!p.live && p.dims.length) {
    html += `<figure class="p-media sketch">${sketchSVG(p)}<p>${t('sketchNote')}</p></figure>`;
  }
  return html;
}

function fromCamLine(p) {
  if (p === CAM || !p.placed && p.e === undefined) return '';
  const b = Math.round(bearingBetween(CAM, p)), d = Math.round(distBetween(CAM, p));
  return `<button type="button" class="leg-btn" data-go="camera">${bearingIcon(b)}<span class="lt"><b>${t('fromCamTitle')}</b><span>${t('fromCam', b, d)}</span></span></button>`;
}

function renderPanel(p) {
  if (p.isCoral) return renderCoralPanel(p);
  const kicker = p.live ? t('camKicker') : t('landmark');
  const material = p.material ? esc(tx(p, 'material')) : `<span class="muted">${t('notRecorded')}</span>`;
  const est = p.estimated
    ? `<span class="est">${esc(t('est', p.derive.bearing, p.derive.dist, nm(byId[p.derive.from]), p.derive.rough))}</span>`
    : '';
  panelBody.innerHTML = `
    <header class="p-head">
      <div>
        <p class="p-kicker">${kicker}</p>
        <h2 class="p-title" id="pTitle"><svg class="pin-i" viewBox="0 0 18 22" aria-hidden="true"><path d="M9 21C9 21 2 12.5 2 8a7 7 0 0 1 14 0c0 4.5-7 13-7 13z"/><circle cx="9" cy="8" r="2.6"/></svg>${esc(nm(p))}</h2>
      </div>
      <button type="button" class="icon-btn" id="pClose" aria-label="${t('close')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </header>
    ${p.live ? `<p class="p-entry">${t('entryNote')}</p>` : ''}
    ${mediaHTML(p)}
    <dl class="facts">
      <dt>${t('fDepth')}</dt><dd>${p.hasDepth ? `<span class="big">${p.depthText} ${t('m')}</span>` : `<span class="muted">${t('notMeasured')}</span>`}</dd>
      <dt>${t('fDims')}</dt><dd>${dimsText(p)}</dd>
      <dt>${t('fTerrain')}</dt><dd>${p.terrain ? esc(tx(p, 'terrain')) : `<span class="muted">${t('notRecorded')}</span>`}</dd>
      <dt>${t('fMaterial')}</dt><dd>${material}</dd>
      <dt>${t('fCoords')}</dt><dd><div class="coord"><span>${ddmText(p.latDec, true)}</span><span>${ddmText(p.lonDec, false)}</span></div><button type="button" class="copy" id="pCopy">${t('copy')}</button>${est}${p.measured ? `<span class="est">${esc(t('snapped', `${ddmText(p.measured.lat, true)} ${ddmText(p.measured.lon, false)}`))}</span>` : ''}</dd>
    </dl>
    ${p.note ? `<p class="p-note">${esc(tx(p, 'note'))}</p>` : ''}
    ${p.model && p.photos.length ? `<p class="p-note">${t('modelPhotos')}</p>` : ''}
    ${p.model && !p.photos.length ? `<p class="p-note">${t('modelGeneric')}</p>` : ''}
    ${p.live ? '' : `<section class="legs">${fromCamLine(p)}</section>`}
  `;
  wirePanel(p);
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const muted = (k = 'notYet') => `<span class="muted">${t(k)}</span>`;
const val = (v, unit = '') => (isNum(v) ? `${num(r1(v))}${unit ? ` ${unit}` : ''}` : muted());
const txt = (c, f) => (ctx(c, f) ? esc(ctx(c, f)) : muted());
function activityCell(ph, holes) {
  const target = toTest(holes);
  if (!isNum(ph.tested)) return `${muted()}${target ? `<span class="est">${t('toTestNote', target)}</span>` : ''}`;
  const pc = isNum(ph.active) && ph.tested > 0 ? Math.round((ph.active / ph.tested) * 100) : null;
  return `<span class="big">${pc !== null ? num(`${pc}%`) : '–'}</span><span class="est">${t('activeOf', isNum(ph.active) ? ph.active : '–', ph.tested)}${ph.time ? ` · ${num(ph.time)}` : ''}</span>`;
}
function sizeText(c) {
  const s = c.sizeCm || [];
  if (!s.some(isNum)) return muted();
  return t('sizeCm', ...s.map((v) => (isNum(v) ? v : '–')));
}
function renderCoralPanel(c) {
  const P = PAIRS[c.pair][LANG];
  const status = c.found ? t('statusFound') : t('statusPlanned');
  const model3d = c.model3d || '';
  const sketchfab = /sketchfab\.com/.test(model3d) ? (model3d.match(/([0-9a-f]{32})/) || [])[1] : null;
  panelBody.innerHTML = `
    <header class="p-head">
      <div>
        <p class="p-kicker"><span class="pair-dot" style="--pair:${PAIRS[c.pair].color}"></span>${esc(P.name)} · ${esc(P.people.join(t('and')))}</p>
        <h2 class="p-title" id="pTitle">${badgeSVG(c.float, { size: 34 })}${esc(coralName(c))}</h2>
      </div>
      <button type="button" class="icon-btn" id="pClose" aria-label="${t('close')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </header>
    <p class="status ${c.found ? 'is-found' : ''}">${status}</p>
    <figure class="p-media viewer">
      ${sketchfab ? `<div class="live"><iframe src="https://sketchfab.com/models/${sketchfab}/embed?autostart=1&ui_infos=0&ui_watermark=0" title="${t('model3dTitle')}" allow="autoplay; fullscreen; xr-spatial-tracking" loading="lazy"></iframe></div>` : '<div class="viewer-box" id="viewer"></div>'}
      <figcaption>${model3d ? t('viewerModel') : t('viewerFloat', floatName(c))}</figcaption>
    </figure>
    ${c.photos && c.photos.length ? `<div class="p-media"><div class="gallery">${c.photos.map((ph, i) => `<button type="button" data-photo="${i}" aria-label="${t('photoAria', i + 1, c.photos.length)}"><img src="${esc(thumb(ph.src))}" alt="${esc(ph.caption || t('photoAlt', coralName(c), i + 1))}" loading="lazy" decoding="async"></button>`).join('')}</div></div>` : ''}
    <h3 class="facts-h">${t('hBivalves')}</h3>
    <dl class="facts">
      <dt>${t('fHoles')}</dt><dd>${isNum(c.holes) ? `<span class="big">${num(c.holes)}</span>` : muted()}</dd>
      <dt>${t('fArea')}</dt><dd>${val(c.surfaceCm2, t('cm2'))}</dd>
      <dt>${t('fDensity')}</dt><dd>${isNum(c.calc.density) ? `<span class="big">${num(r1(c.calc.density))}</span> <span class="est">${t('densityUnit')}</span>` : muted()}</dd>
      <dt>${t('fDay')}</dt><dd>${activityCell(c.day, c.holes)}</dd>
      <dt>${t('fNight')}</dt><dd>${activityCell(c.night, c.holes)}</dd>
      <dt>${t('fBurrows')}</dt><dd>${txt(c, 'burrows')}</dd>
    </dl>
    <h3 class="facts-h">${t('hCoral')}</h3>
    <dl class="facts">
      <dt>${t('fSpecies')}</dt><dd>${txt(c, 'species')}</dd>
      <dt>${t('fForm')}</dt><dd>${txt(c, 'form')}</dd>
      <dt>${t('fColor')}</dt><dd>${txt(c, 'color')}</dd>
      <dt>${t('fSize')}</dt><dd>${sizeText(c)}</dd>
    </dl>
    <h3 class="facts-h">${t('hPlace')}</h3>
    <dl class="facts">
      <dt>${t('fDepth')}</dt><dd>${isNum(c.depth) ? `<span class="big">${num(c.depth)} ${t('m')}</span>` : muted()}</dd>
      <dt>${t('fLight')}</dt><dd>${isNum(c.lightLux) ? `${num(c.lightLux)} lux${ctx(c, 'light') ? ` · ${esc(ctx(c, 'light'))}` : ''}` : txt(c, 'light')}</dd>
      <dt>${t('fTerrain')}</dt><dd>${txt(c, 'substrate')}</dd>
      <dt>${t('fCurrent')}</dt><dd>${txt(c, 'current')}</dd>
      <dt>${t('fCoords')}</dt><dd>${c.placed ? `<div class="coord"><span>${ddmText(c.latDec, true)}</span><span>${ddmText(c.lonDec, false)}</span></div><button type="button" class="copy" id="pCopy">${t('copy')}</button>${c.estimated ? `<span class="est">${t('coralEst')}</span>` : ''}` : `${muted()}<span class="est">${t('coralNoPos')}</span>`}</dd>
    </dl>
    ${ctx(c, 'notes') ? `<p class="p-note">${esc(ctx(c, 'notes'))}</p>` : ''}
    ${c.placed ? `<section class="legs">${fromCamLine(c)}</section>` : ''}
  `;
  wirePanel(c);
  if (!sketchfab) startViewer(c);
}
function wirePanel(p) {
  $('#pClose').addEventListener('click', closePanel);
  $('#pCopy')?.addEventListener('click', async (ev) => {
    const txt = `${p.latDec.toFixed(6)}, ${p.lonDec.toFixed(6)}`;
    try { await navigator.clipboard.writeText(txt); ev.target.textContent = t('copied'); }
    catch { ev.target.textContent = txt; }
  });
  panelBody.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => select(b.dataset.go)));
  panelBody.querySelectorAll('[data-photo]').forEach((b) => b.addEventListener('click', () => openPhoto(p.photos, +b.dataset.photo, p.isCoral ? coralName(p) : nm(p))));
}

/* ── small 3D viewer in the coral panel: the float, or the coral's photogrammetry model ── */
const viewer = { renderer: null, scene: null, cam: null, obj: null, key: '', run: false, canvas: null, loader: null };
function startViewer(c) {
  const cv = $('#viewer');
  if (!cv || !renderer) return;
  if (!viewer.renderer) {
    viewer.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    viewer.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    viewer.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    viewer.scene = new THREE.Scene();
    viewer.scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x8a7a5a, 2.2));
    const d = new THREE.DirectionalLight(0xffffff, 2.4); d.position.set(2, 4, 3); viewer.scene.add(d);
    viewer.cam = new THREE.PerspectiveCamera(30, 600 / 340, 0.01, 100);
  }
  viewer.canvas = cv;
  cv.appendChild(viewer.renderer.domElement);
  const key = c.model3d || c.float;
  if (viewer.key !== key) {
    if (viewer.obj) viewer.scene.remove(viewer.obj);
    viewer.obj = null;
    viewer.key = key;
    if (/\.(glb|gltf)$/i.test(c.model3d || '')) {
      if (!viewer.loader) {
        viewer.loader = new GLTFLoader();
        const draco = new DRACOLoader(); draco.setDecoderPath('vendor/three/addons/libs/draco/gltf/');
        viewer.loader.setDRACOLoader(draco);
      }
      viewer.loader.load(c.model3d, (gl) => {
        if (viewer.key !== key) return;
        const o = gl.scene;
        const box = new THREE.Box3().setFromObject(o), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
        o.position.sub(mid);
        const wrap = new THREE.Group(); wrap.add(o); wrap.scale.setScalar(1.6 / Math.max(size.x, size.y, size.z));
        viewer.obj = wrap; viewer.scene.add(wrap);
      });
    } else {
      const f = buildFloat(c.float);
      viewer.obj = f.group; viewer.obj.position.y = -0.15;
      viewer.scene.add(viewer.obj);
    }
  }
  viewer.cam.position.set(0, 0.55, 2.4); viewer.cam.lookAt(0, 0.05, 0);
  if (!viewer.run) { viewer.run = true; requestAnimationFrame(stepViewer); }
}
function stepViewer(now) {
  const box = viewer.canvas;
  if (!box || !box.isConnected || panel.hidden) { viewer.run = false; return; }
  const w = box.clientWidth, h = box.clientHeight;
  if (w && h) {
    const el = viewer.renderer.domElement;
    if (el.width !== Math.round(w * viewer.renderer.getPixelRatio()) || el.height !== Math.round(h * viewer.renderer.getPixelRatio())) viewer.renderer.setSize(w, h, false);
    viewer.cam.aspect = w / h; viewer.cam.updateProjectionMatrix();
    if (viewer.obj) viewer.obj.rotation.y = reduceMotion ? -0.6 : now / 2400;
    viewer.renderer.render(viewer.scene, viewer.cam);
  }
  requestAnimationFrame(stepViewer);
}

const findAny = (id) => byId[id] || coralById[id];
function select(id, { fromMap = false, instant = false } = {}) {
  const p = findAny(id);
  if (!p) return;
  selected = p;
  renderPanel(p);
  panel.hidden = false;
  document.body.classList.add('panel-open');
  panelBody.scrollTop = 0;
  if (isPhone()) setInset(false);
  labels.forEach((l) => l.el.classList.toggle('is-active', l.p === p));
  markers.forEach((m) => m.parts.forEach((b) => (b.material = m.p === p ? pinSelMat : m.base)));
  document.querySelectorAll('.fstrip button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.coral === id)));
  const where = p.world;
  selRing.visible = !!where;
  if (where) selRing.position.copy(where).add(new THREE.Vector3(0, 0.5, 0));
  highlightMapMarker(id, fromMap);
  requestAnimationFrame(() => {
    const o = panelOffset(true);
    viewOff.tx = o.x; viewOff.ty = o.y;
    if (where) {
      const v = focusPoint(p);
      fly(v.target, v.pos, instant ? 0 : 1100);
    } else fly(controls.target.clone(), camera.position.clone(), 500);
  });
  try { history.replaceState(null, '', `${location.search}#${id}`); } catch {}
}

function closePanel() {
  if (panel.hidden) return;
  const last = selected;
  panel.hidden = true;
  document.body.classList.remove('panel-open');
  panelBody.innerHTML = '';
  selected = null;
  labels.forEach((l) => l.el.classList.remove('is-active'));
  markers.forEach((m) => m.parts.forEach((b) => (b.material = m.base)));
  document.querySelectorAll('.fstrip button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  selRing.visible = false;
  highlightMapMarker(null);
  viewOff.tx = 0; viewOff.ty = 0;
  fly(controls.target.clone(), camera.position.clone(), 500);
  try { history.replaceState(null, '', location.pathname + location.search); } catch {}
  if (last) labels.find((l) => l.p === last)?.el.focus({ preventScroll: true });
}

/* ═════════════ canvas picking (screen-space, touch friendly) ═════════════ */
const screenPos = new Map();
let downAt = null;
canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
  downAt = null;
  if (moved > 6) return;
  const hit = pick(e);
  if (hit) select(hit.id);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || e.buttons) return;
  canvas.classList.toggle('hovering', !!pick(e));
});
function pick(e) {
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  let best = null, bd = e.pointerType === 'mouse' ? 18 : 28;
  for (const [p, s] of screenPos) {
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

/* ═════════════ satellite inset (Leaflet) ═════════════ */
const inset = $('#inset');
const mapToggle = $('#mapToggle');
let map = null;
const mapMarkers = {};
let viewPoly = null, viewDot = null;
function initMap() {
  if (!window.L) { $('#insetMap').innerHTML = `<p style="padding:12px;font-size:13px">${t('insetFail')}</p>`; return; }
  map = L.map('insetMap', { zoomControl: true, attributionControl: true, zoomSnap: 0.25, maxZoom: 21 });
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxNativeZoom: 19, maxZoom: 21,
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
  }).addTo(map);
  map.attributionControl.setPrefix(false);
  const ll = (p) => [p.latDec, p.lonDec];
  zones.forEach((z) => {
    L.polygon(z.poly.map((g) => [g.lat, g.lon]), { color: PAIRS[z.key].color, weight: 2, dashArray: '5 4', fillOpacity: 0.18, interactive: false }).addTo(map)
      .bindTooltip(PAIRS[z.key][LANG].name, { permanent: false, direction: 'center', className: 'ix-tip' });
  });
  POINTS.forEach((p) => {
    const m = L.marker(ll(p), {
      icon: L.divIcon({ className: '', html: `<span class="ipin${p.live ? ' ipin-cam' : ''}"></span>`, iconSize: [18, 24], iconAnchor: [9, 23] }),
      title: nm(p), keyboard: true, riseOnHover: true,
    }).addTo(map);
    m.bindTooltip(nm(p), { direction: 'top', offset: [0, -22], className: 'ix-tip' });
    m.on('click', () => select(p.id, { fromMap: true }));
    mapMarkers[p.id] = m;
  });
  PLACED.forEach((c) => {
    const m = L.marker(ll(c), {
      icon: L.divIcon({ className: '', html: `<span class="ibadge" style="--pair:${PAIRS[c.pair].color}">${badgeSVG(c.float, { size: 30 })}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] }),
      title: coralName(c), keyboard: true, riseOnHover: true, zIndexOffset: 500,
    }).addTo(map);
    m.bindTooltip(coralName(c), { direction: 'top', offset: [0, -16], className: 'ix-tip' });
    m.on('click', () => select(c.id, { fromMap: true }));
    mapMarkers[c.id] = m;
  });
  viewPoly = L.polygon([], { color: '#ffffff', weight: 1.2, fillOpacity: 0.06, dashArray: '3 3', interactive: false }).addTo(map);
  viewDot = L.circleMarker(ll(POINTS[0]), { radius: 5, color: '#ffffff', weight: 1.6, fill: false, interactive: false }).addTo(map);
  map.fitBounds(L.latLngBounds([...POINTS, ...PLACED].map(ll)).pad(0.12));
  map.on('click', (ev) => {
    const loc = toLocal(ev.latlng.lat, ev.latlng.lng);
    if (loc.e < ext.e0 || loc.e > ext.e1 || loc.n < ext.n0 || loc.n > ext.n1) return;
    const t = W(loc.e, loc.n, yAt(loc.e, loc.n));
    const off = camera.position.clone().sub(controls.target);
    fly(t, t.clone().add(off), 800);
  });
}
function highlightMapMarker(id, fromMap) {
  Object.entries(mapMarkers).forEach(([k, m]) => m.getElement()?.firstElementChild?.classList.toggle('is-active', k === id));
  const p = id && findAny(id);
  if (p && p.latDec !== undefined && map && !fromMap && inset.classList.contains('is-open')) map.panTo([p.latDec, p.lonDec], { animate: !reduceMotion });
}
function setInset(open) {
  inset.classList.toggle('is-open', open);
  mapToggle.setAttribute('aria-expanded', String(open));
  if (open) {
    if (!map) initMap();
    setTimeout(() => map?.invalidateSize(), 30);
  }
}
mapToggle.addEventListener('click', () => setInset(!inset.classList.contains('is-open')));
$('#insetClose').addEventListener('click', () => { setInset(false); mapToggle.focus(); });

const ray = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 6 * EX);
let lastMapSync = 0;
function syncMapView(now) {
  if (!map || !inset.classList.contains('is-open') || now - lastMapSync < 160) return;
  lastMapSync = now;
  const t = controls.target;
  const g = toGeo(t.x, -t.z);
  viewDot.setLatLng([g.lat, g.lon]);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const out = [];
  const hit = new THREE.Vector3();
  for (const [x, y] of corners) {
    ray.setFromCamera(new THREE.Vector2(x, y), camera);
    if (!ray.ray.intersectPlane(groundPlane, hit) || hit.distanceTo(camera.position) > 700) { viewPoly.setLatLngs([]); return; }
    const gg = toGeo(hit.x, -hit.z);
    out.push([gg.lat, gg.lon]);
  }
  viewPoly.setLatLngs(out);
}

/* ═════════════ depth slice chips ═════════════ */
const chipsEl = $('#depthChips');
SITE.slices.forEach((d, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip';
  b.setAttribute('aria-pressed', 'true');
  b.dataset.d = d;
  b.addEventListener('click', () => {
    const s = slices[d];
    s.on = !s.on;
    b.setAttribute('aria-pressed', String(s.on));
    s.grp.visible = s.on;
    const v = bedMat.uniforms.uSlices.value;
    v.setComponent(i, s.on ? 1 : 0);
    wallMat.uniforms.uSlices.value.setComponent(i, s.on ? 1 : 0);
  });
  chipsEl.appendChild(b);
});

/* ═════════════ meta line ═════════════ */
{
  const depths = POINTS.flatMap((p) => p.depth);
  $('#meta').dataset.a = Math.min(...depths); $('#meta').dataset.b = Math.max(...depths);
}

/* ═════════════ theme ═════════════ */
const themeBtn = $('#themeToggle');
function syncThemeButton() {
  const dark = document.documentElement.dataset.theme === 'dark';
  themeBtn.setAttribute('aria-label', dark ? t('toLight') : t('toDark'));
  $('.tb-theme-label').textContent = dark ? t('themeLight') : t('themeDark');
}
function applyTheme() {
  T = readTheme();
  renderer?.setClearColor(T.paper);
  [bedMat, wallMat].forEach((m) => {
    m.uniforms.uT1.value.copy(T.t1); m.uniforms.uT2.value.copy(T.t2); m.uniforms.uT3.value.copy(T.t3); m.uniforms.uT4.value.copy(T.t4);
    m.uniforms.uInk.value.copy(T.ink); m.uniforms.uSlice.value.copy(T.slice); m.uniforms.uDark.value = T.dark ? 1 : 0;
    m.uniforms.uLand.value.copy(T.buff);
    m.uniforms.uReef.value.copy(T.reef); m.uniforms.uRock.value.copy(T.rock);
  });
  kit.setMode(kit.mode, T.clay);
  waterMat.uniforms.uDark.value = T.dark ? 1 : 0;
  if (scene.fog) scene.fog.color.copy(T.dark ? new THREE.Color('#0b2a3a') : new THREE.Color('#2a7090'));
  scene.traverse((o) => {
    if (o.userData.themeColor && o.material) o.material.color.copy(o.userData.themeColor === 'ink' ? T.ink : T.slice);
  });
  Object.values(slices).forEach((s) => (s.grp.children[0].material.opacity = T.dark ? 0.13 : 0.1));
  pinMat.color.copy(T.ink); pinCamMat.color.copy(T.slice); pinSelMat.color.copy(T.magenta); pinDotMat.color.copy(T.paper); plumbMat.color.copy(T.ink);
  selRing.material.color.copy(T.magenta);
  syncThemeButton();
  loaderBrand();

}
themeBtn.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('iui-theme', next); } catch {}
  applyTheme();
});
syncThemeButton();

/* ═════════════ seabed simulation switch ═════════════ */
const simBtn = $('#simToggle');
let sim = false;
function setSim(on) {
  sim = on;
  [bedMat, wallMat].forEach((m) => (m.uniforms.uSim.value = on ? 1 : 0));
  kit.setMode(on ? 'sim' : 'chart', T.clay);
  if (on && !scatter) {
    // the 3D corals fill the reef, so no simple coral heads or loose rocks there
    scatter = buildScatter(kit, { ext, inSea, typeAt: (e, n) => { const m = mixAt(e, n); const k = 1 - m.reef; return { ...m, reef: 0, rocks: m.rocks * k, rubble: m.rubble * k }; }, yAt, W, tries: 90000 });
    scene.add(scatter);
  }
  updateCoverObjects();
  water.visible = on;
  scene.fog = on ? new THREE.FogExp2(T.dark ? '#0b2a3a' : '#2a7090', 0.0016) : null;
  simBtn.setAttribute('aria-checked', String(on));
  try { localStorage.setItem('iui-sim', on ? '1' : '0'); } catch {}
}
simBtn.addEventListener('click', () => setSim(!sim));

/* ═════════════ seabed cover switch + Smithsonian corals ═════════════ */
const coverBtn = $('#coverToggle');
let cover = true, corals = null;
const coverStatus = $('#coverStatus');
function ensureCorals() {
  if (corals) return;
  const places = [];
  const r = (() => { let a = 1234567; return () => ((a = (a * 1103515245 + 12345) % 2147483648) / 2147483648); })();
  // light tints over the real texture, so colonies vary a little without hiding their detail
  const TINTS = ['#ffffff', '#f6e7d6', '#f1dce8', '#e4efdc', '#f7e3c6', '#e8e0f2', '#fbefe2'];
  const shares = CORAL_MODELS.map((c) => c.share || 1 / CORAL_MODELS.length);
  const shareSum = shares.reduce((a, b) => a + b, 0);
  const pickKind = () => { let x = r() * shareSum; for (let k = 0; k < shares.length; k++) if ((x -= shares[k]) <= 0) return k; return 0; };
  // sample only inside the reef areas; the further from the reef edge, the denser the corals
  const reefs = COVER_POLYS.filter((c) => c.type === 'reef');
  const target = isPhone() ? 2600 : 6500;
  // pick each reef area in proportion to its size, so the big reefs get their share
  const boxes = reefs.map((c) => {
    const es = c.pts.map((q) => q.e), ns = c.pts.map((q) => q.n);
    const b = { poly: c.pts, e0: Math.min(...es), e1: Math.max(...es), n0: Math.min(...ns), n1: Math.max(...ns) };
    b.area = (b.e1 - b.e0) * (b.n1 - b.n0);
    return b;
  });
  const total = boxes.reduce((a, b) => a + b.area, 0);
  for (let k = 0; k < 160000 && places.length < target; k++) {
    let pick = r() * total, box = boxes[0];
    for (const b of boxes) { if ((pick -= b.area) <= 0) { box = b; break; } }
    const poly = box.poly;
    const e = box.e0 + r() * (box.e1 - box.e0);
    const n = box.n0 + r() * (box.n1 - box.n0);
    if (!inSea(e, n) || e < ext.e0 || e > ext.e1 || n < ext.n0 || n > ext.n1) continue;
    const inside = polyDist(poly, e, n);
    if (inside < -1) continue;
    const core = smooth01(-1, 9, inside);
    if (r() > 0.12 + 0.88 * core) continue;
    // corals grow in clumps: a few colonies of different species around each spot
    const clump = 1 + Math.floor(r() * (2 + core * 4));
    for (let c = 0; c < clump; c++) {
      const a = r() * Math.PI * 2, d = c ? 0.5 + r() * 1.4 : 0;
      const ce = e + Math.cos(a) * d, cn = n + Math.sin(a) * d;
      places.push({ x: ce, y: yAt(ce, cn), z: -cn, kind: pickKind(), size: 0.5 + r() * (0.4 + core * 0.7), squash: 0.85 + r() * 0.3, rot: r() * Math.PI * 2, tint: TINTS[Math.floor(r() * TINTS.length)] });
    }
  }
  coverStatus.hidden = false;
  coverStatus.textContent = t('coralsLoading', 0, CORAL_MODELS.length);
  loading.corals = true;
  if (loading.booted) loaderShow(true);
  loaderStep(t('loadCorals', 0, CORAL_MODELS.length), 0.05);
  corals = coralReef(CORAL_MODELS, places, {
    quality: isPhone() ? 0.6 : 1,
    onStatus: ({ done, failed, total }) => {
      if (done < total) coverStatus.textContent = t('coralsLoading', done, total);
      else coverStatus.textContent = failed === total ? t('coralsFailed') : t('coralsDone');
      loaderStep(t('loadCorals', done, total), Math.max(0.05, done / total));
      if (done >= total) { loading.corals = false; setTimeout(loaderMaybeHide, 250); }
    },
  });
  scene.add(corals);
}
function updateCoverObjects() {
  const show = sim && cover;
  if (scatter) scatter.visible = show;
  if (show) ensureCorals();
  if (corals) corals.visible = show;
  if (!show && coverStatus.textContent === t('coralsDone')) coverStatus.hidden = true;
  else if (show && corals) coverStatus.hidden = false;
}
function setCover(on) {
  cover = on;
  [bedMat, wallMat].forEach((m) => (m.uniforms.uCover.value = on ? 1 : 0));
  coverBtn.setAttribute('aria-checked', String(on));
  $('.depths').classList.toggle('cover-on', on);
  updateCoverObjects();
  try { localStorage.setItem('iui-cover', on ? '1' : '0'); } catch {}
}
coverBtn.addEventListener('click', () => setCover(!cover));
try { if (localStorage.getItem('iui-sim') === '1') setSim(true); } catch {}
try { setCover(localStorage.getItem('iui-cover') !== '0'); } catch { setCover(true); }

/* ═════════════ compass & scale ═════════════ */
const rose = $('#compassRose');
$('#compass').addEventListener('click', resetView);
const scaleBar = $('#scaleBar'), scaleText = $('#scaleText');
const NICE = [1, 2, 5, 10, 20, 25, 50, 100, 200];
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
let lastScale = '';
function updateWidgets() {
  tmpA.copy(controls.target).project(camera);
  tmpB.copy(controls.target).add(new THREE.Vector3(0, 0, -10)).project(camera);
  const ang = Math.atan2((tmpB.x - tmpA.x) * vw, (tmpB.y - tmpA.y) * vh);
  rose.style.transform = `rotate(${deg(ang).toFixed(1)}deg)`;
  const dist = camera.position.distanceTo(controls.target);
  const mpp = (2 * dist * Math.tan(rad(camera.fov) / 2)) / vh;
  let m = NICE[0];
  for (const n of NICE) if (n / mpp <= 110) m = n;
  const key = `${m}|${Math.round(m / mpp)}`;
  if (key !== lastScale) {
    lastScale = key;
    scaleBar.style.width = `${Math.round(m / mpp)}px`;
    scaleText.textContent = `${m} ${t('m')}`;
  }
}

/* ═════════════ overlay layout ═════════════ */
const v3 = new THREE.Vector3();
function toScreen(pos) {
  v3.copy(pos).project(camera);
  if (v3.z > 1 || v3.z < -1) return null;
  return { x: (v3.x * 0.5 + 0.5) * vw, y: (-v3.y * 0.5 + 0.5) * vh };
}
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const order = [...labels].sort((a, b) => a.prio - b.prio);
function layoutLabels() {
  screenPos.clear();
  const placed = [];
  const list = selected ? [labels.find((l) => l.p === selected), ...order.filter((l) => l.p !== selected)].filter(Boolean) : order;
  // every mark is clickable, even where its label had to hide
  for (const l of list) {
    const s = toScreen(l.pos());
    if (s) screenPos.set(l.p, s);
  }
  for (const l of list) {
    const s = screenPos.get(l.p);
    if (!s || s.x < -40 || s.y < -40 || s.x > vw + 40 || s.y > vh + 40) { l.el.hidden = true; continue; }
    const box = { x: isRTL() ? s.x - l.gap - l.w : s.x + l.gap, y: s.y - l.h / 2, w: l.w, h: l.h };
    const clash = placed.some((b) => overlap(box, b));
    if (clash && l.p !== selected) { l.el.hidden = true; continue; }
    l.el.hidden = false;
    placed.push({ x: s.x - 12, y: s.y - 12, w: 24, h: 24 }, box);
    l.el.style.transform = `translate(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px)`;
  }
  for (const z of zoneLabels) {
    const s = toScreen(z.z.center);
    if (!s) { z.el.hidden = true; continue; }
    const box = { x: s.x - z.w / 2, y: s.y - z.h / 2, w: z.w, h: z.h };
    if (placed.some((b) => overlap(box, b))) { z.el.hidden = true; continue; }
    z.el.hidden = false;
    placed.push(box);
    z.el.style.transform = `translate(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px)`;
  }
  const tilted = controls.getPolarAngle() > rad(18);
  for (const sl of sliceLabels) {
    const s = tilted && slices[sl.d].on ? toScreen(slices[sl.d].anchor) : null;
    if (!s) { sl.el.hidden = true; continue; }
    sl.el.hidden = false;
    sl.el.style.transform = `translate(${(s.x + 6).toFixed(1)}px, ${(s.y - 9).toFixed(1)}px)`;
  }
}

/* ═════════════ loop ═════════════ */
let introStart = performance.now() + 250;
onLoaderHidden = () => { introStart = performance.now() + 150; };
const markScale = (d) => clamp(d / 105, 0.35, 2.4);
function frame(now) {
  // a dialog covers the map: skip drawing until it closes
  if (deck.open || lb.open || qrDlg.open) { requestAnimationFrame(frame); return; }
  stepFlight(now);
  controls.update();
  // pins keep a constant on-screen size, and drop in one after another
  markers.forEach((m, i) => {
    const order = m.p.live ? 0 : i + 1;
    const k = reduceMotion ? 1 : clamp((now - introStart - order * 60) / 380, 0, 1);
    const pop = k === 0 ? 0 : 1 + 0.3 * Math.sin(Math.PI * k) * (1 - k);
    const d = camera.position.distanceTo(m.grp.position);
    m.grp.scale.setScalar(markScale(d) * pop);
    m.dot.quaternion.copy(camera.quaternion);
    if (m.p === selected) selRing.scale.setScalar(markScale(d));
  });
  // floats bob gently above their corals, on a rope from the anchor stone
  coralMarks.forEach((cm) => {
    const d = camera.position.distanceTo(cm.ground);
    const sc = markScale(d);
    const bob = reduceMotion ? 0 : Math.sin(now / 900 + cm.phase) * 0.12 * sc;
    const fs = Math.max(sc * 2.6, 0.18);
    const g = cm.float.group;
    g.scale.setScalar(fs);
    g.position.set(cm.ground.x, cm.ground.y + 2.2 + sc * 1.6 + bob, cm.ground.z);
    g.rotation.y = reduceMotion ? 0.6 : now / 4000 + cm.phase;
    const pos = cm.rope.geometry.attributes.position;
    pos.setXYZ(0, cm.stone.position.x, cm.stone.position.y + 0.1, cm.stone.position.z);
    pos.setXYZ(1, g.position.x, g.position.y - 0.25 * fs, g.position.z);
    pos.needsUpdate = true;
    cm.ring.scale.setScalar(Math.max(1, sc));
    cm.halo.position.copy(g.position);
    cm.halo.scale.setScalar(fs * 3.2);
    if (cm.c === selected) selRing.scale.setScalar(sc);
  });
  if (corals && corals.visible) corals.userData.update(camera);
  if (sim) {
    const k = reduceMotion ? 0 : now / 1000;
    bedMat.uniforms.uTime.value = k;
    waterMat.uniforms.uTime.value = k;
  }
  const fade = reduceMotion ? 1 : clamp((now - introStart - 500) / 700, 0, 1);
  lineMats.forEach((m) => (m.opacity = fade * m.userData.max));
  layoutLabels();
  updateWidgets();
  syncMapView(now);
  renderer?.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ═════════════ slides ═════════════ */
const deck = $('#deck');
let deckState = null;
const pairName = (k) => PAIRS[k][LANG].name;
const people = (k) => PAIRS[k][LANG].people.join(t('and'));
const dash = '–';
const fmt = (v, d = 1) => (isNum(v) ? num(d === 0 ? Math.round(v) : r1(v)) : dash);

/* top-down map of the search areas around the camera */
function zonesFigure() {
  const pts = [CAM, ...zones.flatMap((z) => z.edge), ...PLACED];
  const es = pts.map((q) => q.e), ns = pts.map((q) => q.n);
  const pad = 12;
  const minE = Math.min(...es) - pad, maxE = Math.max(...es) + pad, minN = Math.min(...ns) - pad, maxN = Math.max(...ns) + pad;
  const Wd = 760, Hd = 430;
  const k = Math.min(Wd / (maxE - minE), Hd / (maxN - minN));
  const ox = (Wd - (maxE - minE) * k) / 2, oy = (Hd - (maxN - minN) * k) / 2;
  const X = (q) => ox + (q.e - minE) * k, Y = (q) => oy + (maxN - q.n) * k;
  const path = (arr, close) => arr.map((q, i) => `${i ? 'L' : 'M'}${X(q).toFixed(1)} ${Y(q).toFixed(1)}`).join('') + (close ? 'Z' : '');
  // the beach: the waterline closed off far inland (west)
  const far = 400;
  const land = [...SHORE, { e: SHORE[SHORE.length - 1].e - far, n: SHORE[SHORE.length - 1].n }, { e: SHORE[0].e - far, n: SHORE[0].n }];
  let out = `<rect class="f-water" x="0" y="0" width="${Wd}" height="${Hd}"/><path class="f-land" d="${path(land, true)}"/><path class="f-shore" d="${path(SHORE)}"/>`;
  zones.forEach((z) => {
    const c = PAIRS[z.key].color;
    out += `<path d="${path(z.edge, true)}" fill="${c}" fill-opacity=".16" stroke="${c}" stroke-width="2" stroke-dasharray="6 4"/>`;
    out += `<path d="${path(z.trail)}" fill="none" stroke="${c}" stroke-width="3" stroke-dasharray="8 5" marker-end="url(#arr-${z.key})"/>`;
    out += `<defs><marker id="arr-${z.key}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker></defs>`;
  });
  // landmarks inside the frame
  POINTS.forEach((p) => {
    const x = X(p), y = Y(p);
    if (x < 10 || y < 10 || x > Wd - 10 || y > Hd - 10) return;
    const camP = p === CAM;
    out += `<g class="${camP ? 'f-pin f-pin-cam' : 'f-pin'}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><path d="M0 0C0 0-7-8.5-7-13a7 7 0 0 1 14 0c0 4.5-7 13-7 13z"/><circle cx="0" cy="-13" r="2.6" fill="#fff"/></g>`;
    out += `<text class="f-name${camP ? ' f-name-cam' : ''}" x="${(x + (isRTL() ? -10 : 10)).toFixed(1)}" y="${(y - 8).toFixed(1)}" text-anchor="${isRTL() ? 'end' : 'start'}">${esc(nm(p))}</text>`;
  });
  PLACED.forEach((c) => {
    const x = X(c), y = Y(c);
    out += `<g transform="translate(${(x - 13).toFixed(1)} ${(y - 13).toFixed(1)})">${badgeSVG(c.float, { size: 26, ring: PAIRS[c.pair].color })}</g>`;
  });
  zones.forEach((z) => {
    const x = X(z.mid), y = Y(z.mid);
    out += `<text class="f-zone" x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" fill="${PAIRS[z.key].color}">${esc(pairName(z.key))}</text>`;
    out += `<text class="f-zone-p" x="${x.toFixed(1)}" y="${(y + 22).toFixed(1)}" text-anchor="middle">${esc(people(z.key))}</text>`;
  });
  const sc = 10 * k;
  out += `<g transform="translate(${Wd - 40} 44)"><path class="f-line" d="M0 18V-14M-5 -8L0 -16 5 -8"/><text x="0" y="32" text-anchor="middle">${t('north')}</text></g>`;
  out += `<g transform="translate(24 ${Hd - 20})"><path class="f-line" d="M0 0H${sc.toFixed(1)}M0 -4V4M${sc.toFixed(1)} -4V4"/><text x="${(sc / 2).toFixed(1)}" y="-8" text-anchor="middle">10 ${t('m')}</text></g>`;
  return `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="${t('zonesAria')}">${out}</svg>`;
}

/* diagrams of a boring bivalve inside its coral host */
function diagramSVG(kind) {
  const L = (x, y, txt, a = 'middle', cls = 'd-lab') => `<text class="${cls}" x="${x}" y="${y}" text-anchor="${a}">${esc(txt)}</text>`;
  const coral = `<path class="d-coral" d="M20 300V170C60 100 150 66 250 66s190 34 230 104v130z"/>
    ${Array.from({ length: 22 }, (_, i) => { const a = Math.PI * (0.06 + 0.88 * (i / 21)); const r = 176; return `<circle class="d-polyp" cx="${(250 - Math.cos(a) * r * 1.3).toFixed(1)}" cy="${(250 - Math.sin(a) * r).toFixed(1)}" r="6"/>`; }).join('')}`;
  const burrow = `<path class="d-burrow" d="M232 90c-14 40-16 110 4 160 8 18 34 18 42 0 18-50 14-120 0-160z"/>
    <ellipse class="d-shell" cx="256" cy="178" rx="20" ry="66"/><path class="d-shell-l" d="M256 114v128"/>
    <path class="d-siph" d="M246 92c-2-14 4-24 8-24s6 10 2 24M258 92c-2-14 6-26 11-24 4 2 2 12-3 24"/>`;
  if (kind === 'fluor') {
    return `<svg class="diagram" viewBox="0 0 500 320" role="img" aria-label="${t('dgFluorAria')}">
      ${coral}${burrow}
      <path class="d-tube" d="M80 40C140 40 200 50 240 66"/><rect class="d-syr" x="20" y="28" width="62" height="24" rx="4"/><path class="d-syr" d="M6 40h14M82 40h10"/>
      <circle class="d-dye" cx="243" cy="66" r="7"/>
      <path class="d-jet" d="M266 66C290 30 340 14 410 10"/><path class="d-jet d-jet-2" d="M268 66C300 40 350 30 420 34"/>
      ${L(52, 74, t('dgSyringe'))}${L(380, 58, t('dgJet'))}${L(256, 310, t('dgBivalve'))}
    </svg>`;
  }
  return `<svg class="diagram" viewBox="0 0 500 320" role="img" aria-label="${t('dgBivalveAria')}">
    ${coral}${burrow}
    <path class="d-in" d="M196 20c20 10 36 26 46 46" marker-end="url(#din)"/><path class="d-out" d="M266 64c14-22 34-38 60-46" marker-end="url(#dout)"/>
    <defs><marker id="din" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" class="d-in-h"/></marker>
    <marker id="dout" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" class="d-out-h"/></marker></defs>
    ${L(150, 16, t('dgInhal'))}${L(380, 16, t('dgExhal'))}${L(256, 310, t('dgBivalve'))}${L(420, 260, t('dgCoral'))}
  </svg>`;
}

function stepsHTML(s) {
  return `<ol class="steps">${s.steps.map((st, i) => {
    const time = s.schedule && st.key ? (SCHEDULE[st.key] ? num(SCHEDULE[st.key]) : t('timeTbd')) : '';
    return `<li><span class="st-n">${i + 1}</span><div><h3>${esc(st.title)}${time ? ` <span class="st-time">${time}</span>` : ''}</h3><p>${esc(st.text)}</p></div></li>`;
  }).join('')}</ol>${s.schedule ? `<p class="slide-note">${SCHEDULE.date ? t('dateIs', num(SCHEDULE.date)) : t('dateTbd')}</p>` : ''}`;
}
const cardsHTML = (s) => `<div class="cards">${s.cards.map((c) => `<section class="card"><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p></section>`).join('')}</div>`;

function floatsHTML() {
  return `<div class="floats">${CORALS.map((c) => `<section class="fcard" style="--pair:${PAIRS[c.pair].color}">${badgeSVG(c.float, { size: 64 })}<div><h3>${esc(floatName(c))}</h3><p>${t('coralN', c.num)}</p><p class="fpair">${esc(pairName(c.pair))} · ${esc(people(c.pair))}</p></div></section>`).join('')}</div>`;
}
function ruleHTML() {
  const ex = [7, 12, 18, 21, 24, 30, 45, 60];
  return `<table class="legtable rule"><thead><tr><th>${t('ruleHoles')}</th>${ex.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody><tr><td>${t('ruleTest')}</td>${ex.map((h) => `<td><b>${toTest(h)}</b></td>`).join('')}</tr></tbody></table>
    <p class="slide-note">${t('ruleNote', TEST_RULE.min)}</p>`;
}
function sheetRows() {
  return ['shDepth', 'shBearing', 'shHoles', 'shSpecies', 'shColor', 'shSize', 'shLight', 'shSubstrate', 'shCurrent', 'shBurrows'];
}
function sheetHTML(c, printable = false) {
  const head = c ? `${badgeSVG(c.float, { size: 36 })}<b>${esc(floatName(c))}</b> · ${esc(pairName(c.pair))}` : `<b>${t('shFloat')}</b> ______`;
  const tests = Array.from({ length: 15 }, (_, i) => `<td>${i + 1}</td>`).join('');
  return `<div class="sheet${printable ? ' sheet-print' : ''}">
    <p class="sh-head">${head}<span>${t('shDate')} ______ ${t('shTime')} ______</span></p>
    <table class="sh-grid"><tbody>${sheetRows().map((k) => `<tr><th>${t(k)}</th><td></td></tr>`).join('')}</tbody></table>
    <table class="sh-tests"><thead><tr><th>${t('shHole')}</th>${tests}</tr></thead>
      <tbody><tr><th>${t('shDay')}</th>${'<td></td>'.repeat(15)}</tr><tr><th>${t('shNight')}</th>${'<td></td>'.repeat(15)}</tr></tbody></table>
    <p class="sh-foot">${t('shFoot')}</p>
  </div>`;
}
function printSheets() {
  const w = window.open('', '_blank');
  if (!w) return;
  const css = `body{font-family:'IBM Plex Sans Hebrew',Arial,sans-serif;color:#1B2F45;margin:0}
    .sheet{page-break-after:always;padding:14mm;box-sizing:border-box;height:100vh}
    .sh-head{display:flex;align-items:center;gap:10px;font-size:20px;margin:0 0 10px}.sh-head span{margin-inline-start:auto;font-size:15px}
    table{width:100%;border-collapse:collapse;margin-bottom:12px}th,td{border:1.5px solid #1B2F45;padding:9px 8px;font-size:15px;text-align:start}
    .sh-grid th{width:34%}.sh-tests td,.sh-tests th{text-align:center;padding:12px 2px}.sh-foot{font-size:13px}`;
  w.document.write(`<!doctype html><html lang="${LANG}" dir="${isRTL() ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${t('shTitle')}</title><style>${css}</style></head><body>${CORALS.map((c) => sheetHTML(c, true)).join('')}<script>setTimeout(function(){print()},300)<\/script></body></html>`);
  w.document.close();
}
function equipmentHTML(s) {
  return `<div class="equip"><section><h3>${t('eqHave')}</h3><ul class="checks">${s.have.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
    <section><h3>${t('eqAdd')}</h3><dl class="method">${s.add.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl></section></div>`;
}
const variablesHTML = (s) => `<table class="legtable vars"><thead><tr><th>${t('vVar')}</th><th>${t('vHow')}</th><th>${t('vUnit')}</th></tr></thead><tbody>${s.rows.map(([a, b, c]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td><td>${esc(c)}</td></tr>`).join('')}</tbody></table>`;

const coralCell = (c) => `<span class="cc">${badgeSVG(c.float, { size: 24 })}${esc(floatName(c))}</span>`;
const noData = () => (CORALS.some((c) => c.found) ? '' : `<p class="slide-note">${t('noDataYet')}</p>`);
function phaseHTML(phase) {
  const rows = CORALS.map((c) => {
    const ph = c[phase], pc = isNum(ph.active) && isNum(ph.tested) && ph.tested ? (ph.active / ph.tested) * 100 : null;
    return `<tr><td>${coralCell(c)}</td><td>${ph.time ? num(ph.time) : dash}</td><td>${fmt(c.holes, 0)}</td><td>${fmt(c.calc.target, 0)}</td><td>${fmt(ph.tested, 0)}</td><td>${fmt(ph.active, 0)}</td><td><b>${isNum(pc) ? num(`${Math.round(pc)}%`) : dash}</b></td></tr>`;
  }).join('');
  const h = t('phaseHead');
  return `<div class="table-wrap"><table class="legtable data"><thead><tr>${h.map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>${noData()}`;
}
function summaryHTML() {
  const S = summary(CORALS);
  const tile = (v, label, cls = '') => `<div class="${cls}"><b>${v}</b><span>${label}</span></div>`;
  const pc = (v) => (isNum(v) ? num(`${Math.round(v)}%`) : dash);
  const diff = isNum(S.pairDiff) ? num(`${S.pairDiff > 0 ? '+' : ''}${Math.round(S.pairDiff)}`) : dash;
  return `<div class="stats stats-big">
    ${tile(num(`${S.found}/${CORALS.length}`), t('sFound'))}
    ${tile(fmt(S.holes, 0), t('sHoles'))}
    ${tile(fmt(S.meanDensity), t('sDensity'))}
    ${tile(pc(S.dayPct), t('sDay'), 'is-day')}
    ${tile(pc(S.nightPct), t('sNight'), 'is-night')}
    ${tile(diff, t('sDiff', S.pairs))}
  </div>${noData()}`;
}
function coralTableHTML() {
  const h = t('tableHead');
  const rows = CORALS.map((c) => `<tr><td>${coralCell(c)}</td><td>${esc(pairName(c.pair))}</td><td>${ctx(c, 'species') ? esc(ctx(c, 'species')) : dash}</td><td>${fmt(c.depth)}</td><td>${fmt(c.holes, 0)}</td><td>${fmt(c.surfaceCm2, 0)}</td><td>${fmt(c.calc.density)}</td><td>${isNum(c.calc.dayPct) ? num(`${Math.round(c.calc.dayPct)}%`) : dash}</td><td>${isNum(c.calc.nightPct) ? num(`${Math.round(c.calc.nightPct)}%`) : dash}</td></tr>`).join('');
  return `<div class="table-wrap"><table class="legtable data"><thead><tr>${h.map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>${noData()}`;
}
const chartOpts = () => ({ rtl: isRTL(), names: (c) => floatName(c), colors: (c) => PAIRS[c.pair].color, empty: t('noDataYet') });
function relationsHTML() {
  const o = chartOpts();
  return `<div class="scatters">
    ${scatterChart(CORALS, (c) => c.depth, (c) => c.calc.density, { ...o, xLabel: t('xDepth'), yLabel: t('yDensity'), empty: t('need2') })}
    ${scatterChart(CORALS, (c) => c.lightLux, (c) => c.calc.density, { ...o, xLabel: t('xLight'), yLabel: t('yDensity'), empty: t('need2') })}
    ${scatterChart(CORALS, (c) => c.calc.dayPct, (c) => c.calc.nightPct, { ...o, xLabel: t('xDay'), yLabel: t('yNight'), empty: t('need2'), diagonal: true, fixed: [0, 100] })}
  </div><p class="slide-note">${t('relNote')}</p>`;
}
function listOrNote(arr, note) {
  return arr && arr.length ? `<ul class="bullets">${arr.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : `<p class="slide-note">${note}</p>`;
}

function slideHTML(s) {
  let body = '';
  const lead = s.lead ? `<p class="lead">${esc(s.lead)}</p>` : '';
  if (s.type === 'text') {
    body = lead +
      (s.bullets ? `<ul class="bullets">${s.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : '') +
      (s.list ? `<dl class="method">${s.list.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>` : '');
  } else if (s.type === 'diagram') {
    body = `<div class="slide-cols slide-diagram"><div>${lead}${s.bullets ? `<ul class="bullets">${s.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}</div><figure class="figure">${diagramSVG(s.diagram)}</figure></div>`;
  } else if (s.type === 'groups') {
    body = lead + `<div class="groups">${s.groups.map((g) => `<section class="group" style="--pair:${PAIRS[g.pair].color}"><h3>${esc(g.title)}</h3><p>${esc(g.sub)}</p><ul class="people">${g.members.map((m) => `<li><b>${esc(m)}</b></li>`).join('')}</ul><div class="g-floats">${CORALS.filter((c) => c.pair === g.pair).map((c) => badgeSVG(c.float, { size: 34, label: floatName(c) })).join('')}</div></section>`).join('')}</div>`;
  } else if (s.type === 'cards') {
    body = lead + cardsHTML(s);
  } else if (s.type === 'steps') {
    body = lead + stepsHTML(s);
  } else if (s.type === 'zones') {
    body = lead + `<div class="figure figure-map">${zonesFigure()}</div>`;
  } else if (s.type === 'floats') {
    body = lead + floatsHTML();
  } else if (s.type === 'rule') {
    body = lead + ruleHTML();
  } else if (s.type === 'sheet') {
    body = lead + sheetHTML(null) + `<button type="button" class="btn btn-print" id="printSheets">${t('printSheets')}</button>`;
  } else if (s.type === 'equipment') {
    body = lead + equipmentHTML(s);
  } else if (s.type === 'variables') {
    body = lead + variablesHTML(s);
  } else if (s.type === 'phase') {
    body = phaseHTML(s.phase);
  } else if (s.type === 'summary') {
    body = summaryHTML();
  } else if (s.type === 'coralTable') {
    body = coralTableHTML();
  } else if (s.type === 'activityChart') {
    body = `<div class="figure">${activityChart(CORALS, { ...chartOpts(), labels: { day: t('legDay'), night: t('legNight'), aria: t('actAria') } })}</div>`;
  } else if (s.type === 'densityChart') {
    body = `<div class="figure">${densityChart(CORALS, { ...chartOpts(), labels: { aria: t('densAria') } })}</div><p class="slide-note">${t('densNote')}</p>`;
  } else if (s.type === 'relations') {
    body = relationsHTML();
  } else if (s.type === 'conclusions') {
    body = listOrNote(CONCLUSIONS[LANG], t('concTbd'));
  } else if (s.type === 'lessons') {
    body = listOrNote(LESSONS[LANG], t('lessonsTbd'));
  }
  return `<article class="slide slide-${s.type}"><h2 id="deckSlideTitle">${esc(s.title)}</h2>${body}</article>`;
}
function showSlide(i) {
  const d = DECKS[LANG][deckState.key];
  deckState.i = clamp(i, 0, d.slides.length - 1);
  $('#deckName').textContent = d.title;
  $('#deckBody').innerHTML = slideHTML(d.slides[deckState.i]);
  $('#printSheets')?.addEventListener('click', printSheets);
  $('#deckBody').scrollTop = 0;
  $('#deckCount').textContent = `${deckState.i + 1} / ${d.slides.length}`;
  $('#deckPrev').disabled = deckState.i === 0;
  $('#deckNext').disabled = deckState.i === d.slides.length - 1;
  $('.deck-foot').style.visibility = d.slides.length > 1 ? 'visible' : 'hidden';
}
let deckOpener = null;
function openDeck(key, opener) {
  deckOpener = opener;
  deckState = { key, i: 0 };
  showSlide(0);
  deck.showModal();
}
document.querySelectorAll('[data-deck]').forEach((b) => b.addEventListener('click', () => openDeck(b.dataset.deck, b)));
$('#deckClose').addEventListener('click', () => deck.close());
$('#deckPrev').addEventListener('click', () => showSlide(deckState.i - 1));
$('#deckNext').addEventListener('click', () => showSlide(deckState.i + 1));
deck.addEventListener('close', () => deckOpener?.focus());
deck.addEventListener('click', (e) => { if (e.target === deck) deck.close(); });
// "next" lies in the reading direction: left in Hebrew, right in English
const nextKey = () => (isRTL() ? 'ArrowLeft' : 'ArrowRight');
const prevKey = () => (isRTL() ? 'ArrowRight' : 'ArrowLeft');
deck.addEventListener('keydown', (e) => {
  if (e.key === nextKey()) { e.preventDefault(); showSlide(deckState.i + 1); }
  if (e.key === prevKey()) { e.preventDefault(); showSlide(deckState.i - 1); }
});
{
  let sx0 = null, sy0 = null;
  deck.addEventListener('touchstart', (e) => { sx0 = e.touches[0].clientX; sy0 = e.touches[0].clientY; }, { passive: true });
  deck.addEventListener('touchend', (e) => {
    if (sx0 === null) return;
    const dx = e.changedTouches[0].clientX - sx0, dy = e.changedTouches[0].clientY - sy0;
    sx0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) showSlide(deckState.i + ((dx > 0) === isRTL() ? 1 : -1));
  });
}

/* ═════════════ QR code ═════════════ */
const qrDlg = $('#qrDialog');
let qrOpener = null;
$('#qrBtn').addEventListener('click', (e) => {
  qrOpener = e.currentTarget;
  if (!$('#qrCode').firstChild) $('#qrCode').innerHTML = qrSVG(SITE_URL);
  $('#qrCode svg').setAttribute('aria-label', SITE_URL);
  $('#qrCopy').textContent = t('qrCopy');
  qrDlg.showModal();
});
$('#qrClose').addEventListener('click', () => qrDlg.close());
qrDlg.addEventListener('click', (e) => { if (e.target === qrDlg) qrDlg.close(); });
qrDlg.addEventListener('close', () => qrOpener?.focus());
$('#qrCopy').addEventListener('click', async (e) => {
  try { await navigator.clipboard.writeText(SITE_URL); e.target.textContent = t('qrCopied'); } catch {}
});

/* lightbox with previous / next */
const lb = $('#lightbox');
let lbSet = null;
function showPhoto(k) {
  const { list, name } = lbSet;
  lbSet.i = (k + list.length) % list.length;
  const ph = list[lbSet.i];
  $('#lbImg').src = ph.src;
  $('#lbImg').alt = ph.caption || t('photoAlt', name, lbSet.i + 1);
  $('#lbCap').textContent = `${ph.caption ? ph.caption + '. ' : ''}${t('photoOf', name, lbSet.i + 1, list.length)}`;
  $('#lbPrev').hidden = $('#lbNext').hidden = list.length < 2;
}
function openPhoto(list, i = 0, name = '') {
  if (!Array.isArray(list)) list = [list];
  lbSet = { list, name, i };
  showPhoto(i);
  lb.showModal();
}
$('#lbClose').addEventListener('click', () => lb.close());
$('#lbPrev').addEventListener('click', () => showPhoto(lbSet.i - 1));
$('#lbNext').addEventListener('click', () => showPhoto(lbSet.i + 1));
lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
lb.addEventListener('keydown', (e) => {
  if (e.key === nextKey()) { e.preventDefault(); showPhoto(lbSet.i + 1); }
  if (e.key === prevKey()) { e.preventDefault(); showPhoto(lbSet.i - 1); }
});
{
  let x0 = null;
  lb.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) showPhoto(lbSet.i + ((dx > 0) === isRTL() ? 1 : -1));
  });
}

/* keyboard */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !deck.open && !lb.open) closePanel();
});

/* ═════════════ the floats strip: one button per marked coral ═════════════ */
const strip = $('#floatStrip');
CORALS.forEach((c) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.coral = c.id;
  b.setAttribute('aria-pressed', 'false');
  b.style.setProperty('--pair', PAIRS[c.pair].color);
  b.className = c.found ? 'is-found' : '';
  b.addEventListener('click', () => select(c.id));
  strip.querySelector('.fstrip-row').appendChild(b);
});
function fillStrip() {
  strip.querySelectorAll('button').forEach((b) => {
    const c = coralById[b.dataset.coral];
    b.innerHTML = `${badgeSVG(c.float, { size: 34 })}<i aria-hidden="true"></i>`;
    b.setAttribute('aria-label', `${coralName(c)}, ${pairName(c.pair)}, ${c.found ? t('statusFound') : t('statusPlanned')}`);
    b.title = coralName(c);
  });
  $('#stripCount').textContent = t('stripCount', CORALS.filter((c) => c.found).length, CORALS.length);
}

/* ═════════════ night view: dark water, glowing light sticks ═════════════ */
const nightBtn = $('#nightToggle');
let night = false, themeBeforeNight = null;
function setNight(on) {
  night = on;
  nightBtn.setAttribute('aria-checked', String(on));
  document.body.classList.toggle('is-night', on);
  if (on) {
    themeBeforeNight = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = 'dark';
  } else if (themeBeforeNight) {
    document.documentElement.dataset.theme = themeBeforeNight;
  }
  applyTheme();
  hemi.intensity = on ? 0.32 : 2.1;
  sun.intensity = on ? 0.22 : 2.3;
  coralMarks.forEach((cm) => { cm.halo.visible = on; cm.float.glowMat.emissiveIntensity = on ? 2.4 : 0.9; });
  if (on) renderer?.setClearColor('#03080F');
}
nightBtn.addEventListener('click', () => setNight(!night));

/* ═════════════ language ═════════════ */
function applyLang() {
  const html = document.documentElement;
  html.lang = LANG;
  html.dir = isRTL() ? 'rtl' : 'ltr';
  document.title = t('docTitle');
  loaderBrand();
  document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  document.querySelectorAll('[data-i18n-title]').forEach((el) => (el.title = t(el.dataset.i18nTitle)));
  $('#langToggle').lang = isRTL() ? 'en' : 'he';
  document.querySelectorAll('.tb[data-deck], .tb-map, .tb-qr').forEach((b) => (b.title = b.getAttribute('aria-label')));
  const meta = $('#meta');
  meta.textContent = t('meta', CORALS.filter((c) => c.found).length, CORALS.length, POINTS.length);
  chipsEl.querySelectorAll('.chip').forEach((b) => {
    b.textContent = `${b.dataset.d} ${t('m')}`;
    b.setAttribute('aria-label', t('sliceAria', b.dataset.d));
  });
  syncThemeButton();
  fillLabels();
  measureLabels();
  Object.entries(mapMarkers).forEach(([id, m]) => { const p = findAny(id); m.setTooltipContent(p.isCoral ? coralName(p) : nm(p)); });
  fillStrip();
  lastScale = '';
  $('#qrCopy').textContent = t('qrCopy');
  if (deck.open && deckState) showSlide(deckState.i);
  if (selected) {
    renderPanel(selected);
    const o = panelOffset(true);
    viewOff.tx = o.x; viewOff.ty = o.y;
    fly(controls.target.clone(), camera.position.clone(), 500);
  }
}
$('#langToggle').addEventListener('click', () => {
  LANG = isRTL() ? 'en' : 'he';
  try { localStorage.setItem('iui-lang', LANG); } catch {}
  applyLang();
});
applyLang();

/* ═════════════ boot ═════════════ */
$('#cLogo').innerHTML = logoSVG({ size: 46 });
resize();
{
  const v = topView();
  controls.target.copy(v.target);
  camera.position.copy(v.pos);
  controls.update();
}
new ResizeObserver(() => resize()).observe(canvas);
// the info panel starts below the toolbar, however many rows the toolbar wraps to
const toolbarEl = document.querySelector('.toolbar');
new ResizeObserver(() => document.documentElement.style.setProperty('--toolbar-h', `${toolbarEl.offsetHeight}px`)).observe(toolbarEl);
// the floats strip sits right under the title box
const cartEl = document.querySelector('.cartouche');
new ResizeObserver(() => document.documentElement.style.setProperty('--cart-bottom', `${cartEl.offsetTop + cartEl.offsetHeight}px`)).observe(cartEl);
window.addEventListener('resize', resize);
measureLabels();
document.fonts?.ready.then(measureLabels);
if (window.innerWidth > 1180) setInset(true);
requestAnimationFrame(frame);
loaderStep(t('loadScene'));
requestAnimationFrame(() => requestAnimationFrame(() => {
  loading.scene = false;
  loading.booted = true;
  if (loading.corals) loaderStep(t('loadCorals', 0, CORAL_MODELS.length), 0.05);
  loaderMaybeHide();
}));
const hashId = decodeURIComponent(location.hash.slice(1));
if (findAny(hashId)) setTimeout(() => select(hashId), 400);
if (DEMO) document.body.classList.add('is-demo');

// small debugging handle
window.__iui = { POINTS, CORALS, select, resetView, camera, controls, seabed, scene, yAt, mixAt, setNight, openDeck };
