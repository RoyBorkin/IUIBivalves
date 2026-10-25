// ─────────────────────────────────────────────────────────────
//  Numbers worked out from the findings, and the result charts (plain SVG).
// ─────────────────────────────────────────────────────────────
import { TEST_RULE } from './mission.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
export const r1 = (v) => (isNum(v) ? Math.round(v * 10) / 10 : null);
const pct = (a, b) => (isNum(a) && isNum(b) && b > 0 ? (a / b) * 100 : null);

// how many holes to test with fluorescein: a third of them, at least 7 (never more than there are)
export function toTest(holes) {
  if (!isNum(holes) || holes <= 0) return null;
  return Math.min(holes, Math.max(TEST_RULE.min, Math.ceil(holes * TEST_RULE.fraction)));
}

export function derive(c) {
  const density = isNum(c.holes) && isNum(c.surfaceCm2) && c.surfaceCm2 > 0 ? (c.holes / c.surfaceCm2) * 100 : null;
  const per = (v, base) => (isNum(v) && isNum(base) && base > 0 ? (v / base) * 100 : null);
  // active bivalves on the whole colony, estimated: holes × the share found active by day
  const dayShare = isNum(c.day.active) && isNum(c.day.tested) && c.day.tested > 0 ? c.day.active / c.day.tested : null;
  const estActive = isNum(c.holes) && dayShare !== null ? c.holes * dayShare : null;
  return {
    volDensity: per(c.holes, c.volumeCm3),     // holes per 100 cm³
    estActive,
    activeDensity: per(estActive, c.surfaceCm2),   // active bivalves per 100 cm²
    activeVolDensity: per(estActive, c.volumeCm3), // active bivalves per 100 cm³
    density,                                   // holes per 100 cm²
    dayPct: pct(c.day.active, c.day.tested),
    nightPct: pct(c.night.active, c.night.tested),
    target: toTest(c.holes),
  };
}

export function summary(corals) {
  const found = corals.filter((c) => c.found);
  const sum = (f) => found.reduce((s, c) => s + (isNum(f(c)) ? f(c) : 0), 0);
  const dens = found.map((c) => c.calc.density).filter(isNum);
  const both = found.filter((c) => isNum(c.calc.dayPct) && isNum(c.calc.nightPct));
  return {
    found: found.length,
    holes: found.some((c) => isNum(c.holes)) ? sum((c) => c.holes) : null,
    meanDensity: dens.length ? dens.reduce((a, b) => a + b, 0) / dens.length : null,
    dayPct: pct(sum((c) => c.day.active), sum((c) => c.day.tested)),
    nightPct: pct(sum((c) => c.night.active), sum((c) => c.night.tested)),
    pairDiff: both.length ? both.reduce((s, c) => s + (c.calc.nightPct - c.calc.dayPct), 0) / both.length : null,
    pairs: both.length,
  };
}

/* ── charts ── */
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
export const DAY_COL = '#D99A1E';
export const NIGHT_COL = '#3D4FB8';

function emptyNote(W, H, text) {
  return `<text class="c-empty" x="${W / 2}" y="${H / 2}" text-anchor="middle">${esc(text)}</text>`;
}

// grouped bars: % active by day and by night, one group per coral
export function activityChart(corals, { rtl, names, labels, empty }) {
  const W = 760, H = 330, A = 52, E = 18, T = 26, B = 54;
  const px0 = rtl ? E : A, px1 = rtl ? W - A : W - E;
  const list = corals.filter((c) => c.found);
  const has = list.some((c) => isNum(c.calc.dayPct) || isNum(c.calc.nightPct));
  const n = Math.max(list.length, 3);
  const gw = (px1 - px0) / n;
  const bw = Math.min(34, gw * 0.3);
  const y = (v) => T + (1 - v / 100) * (H - T - B);
  const X = (i) => (rtl ? px1 - gw * (i + 0.5) : px0 + gw * (i + 0.5));
  const tickX = rtl ? W - A + 8 : A - 8, tickA = rtl ? 'start' : 'end';
  let out = '';
  [0, 25, 50, 75, 100].forEach((v) => {
    out += `<path class="c-grid" d="M${px0} ${y(v)}H${px1}"/><text class="c-tick" x="${tickX}" y="${y(v) + 4}" text-anchor="${tickA}">${v}%</text>`;
  });
  list.forEach((c, i) => {
    const cx = X(i);
    [[c.calc.dayPct, DAY_COL, -1], [c.calc.nightPct, NIGHT_COL, 1]].forEach(([v, col, side]) => {
      const x = cx + side * (rtl ? -1 : 1) * (bw / 2 + 2) - bw / 2;
      if (isNum(v)) {
        out += `<rect x="${x.toFixed(1)}" y="${y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(y(0) - y(v)).toFixed(1)}" fill="${col}" rx="2"/>`;
        out += `<text class="c-val" x="${(x + bw / 2).toFixed(1)}" y="${(y(v) - 6).toFixed(1)}" text-anchor="middle">${Math.round(v)}%</text>`;
      } else {
        out += `<rect x="${x.toFixed(1)}" y="${y(100)}" width="${bw.toFixed(1)}" height="${y(0) - y(100)}" fill="none" class="c-missing" rx="2"/>`;
      }
    });
    out += `<text class="c-name" x="${cx.toFixed(1)}" y="${H - B + 22}" text-anchor="middle">${esc(names(c))}</text>`;
  });
  out += `<path class="c-axis" d="M${px0} ${y(0)}H${px1}"/>`;
  const lg = rtl ? px1 : px0;
  out += `<g transform="translate(${lg} ${H - 12})"><rect x="${rtl ? -12 : 0}" y="-10" width="12" height="12" fill="${DAY_COL}" rx="2"/><text class="c-leg" x="${rtl ? -18 : 18}" y="0" text-anchor="${rtl ? 'end' : 'start'}">${esc(labels.day)}</text>
    <rect x="${rtl ? -112 : 100}" y="-10" width="12" height="12" fill="${NIGHT_COL}" rx="2"/><text class="c-leg" x="${rtl ? -118 : 118}" y="0" text-anchor="${rtl ? 'end' : 'start'}">${esc(labels.night)}</text></g>`;
  if (!has) out += emptyNote(W, (H - B) / 2 + T, empty);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(labels.aria)}">${out}</svg>`;
}

// one bar per coral: holes per 100 cm²
export function densityChart(corals, { rtl, names, colors, labels, empty, value = (c) => c.calc.density, H: Hh = 300, round = r1 }) {
  const W = 760, H = Hh, A = 52, E = 18, T = 26, B = 40;
  const px0 = rtl ? E : A, px1 = rtl ? W - A : W - E;
  const list = corals.filter((c) => c.found);
  const vals = list.map(value).filter(isNum);
  const max = vals.length ? Math.max(...vals) * 1.2 : 1;
  const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); return Math.ceil(max / p) * p; })();
  const n = Math.max(list.length, 3);
  const gw = (px1 - px0) / n, bw = Math.min(56, gw * 0.55);
  const y = (v) => T + (1 - v / nice) * (H - T - B);
  const X = (i) => (rtl ? px1 - gw * (i + 0.5) : px0 + gw * (i + 0.5));
  const tickX = rtl ? W - A + 8 : A - 8, tickA = rtl ? 'start' : 'end';
  let out = '';
  [0, 0.5, 1].forEach((k) => {
    const v = nice * k;
    out += `<path class="c-grid" d="M${px0} ${y(v)}H${px1}"/><text class="c-tick" x="${tickX}" y="${y(v) + 4}" text-anchor="${tickA}">${r1(v)}</text>`;
  });
  list.forEach((c, i) => {
    const cx = X(i), v = value(c);
    if (isNum(v)) {
      out += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(y(0) - y(v)).toFixed(1)}" fill="${colors(c)}" rx="2"/>`;
      out += `<text class="c-val" x="${cx.toFixed(1)}" y="${(y(v) - 6).toFixed(1)}" text-anchor="middle">${round(v)}</text>`;
    }
    out += `<text class="c-name" x="${cx.toFixed(1)}" y="${H - B + 22}" text-anchor="middle">${esc(names(c))}</text>`;
  });
  out += `<path class="c-axis" d="M${px0} ${y(0)}H${px1}"/>`;
  if (!vals.length) out += emptyNote(W, (H - B) / 2 + T, empty);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(labels.aria)}">${out}</svg>`;
}

// a small scatter plot of two measures, one dot per coral
export function scatter(corals, fx, fy, { rtl, xLabel, yLabel, colors, names, empty, diagonal = false, fixed = null }) {
  const W = 340, H = 260, L = 46, R = 14, T = 16, B = 44;
  const pts = corals.filter((c) => c.found && isNum(fx(c)) && isNum(fy(c))).map((c) => ({ c, x: fx(c), y: fy(c) }));
  const ext = (a, pad) => { if (!a.length) return [0, 1]; let lo = Math.min(...a), hi = Math.max(...a); if (lo === hi) { lo -= 1; hi += 1; } const p = (hi - lo) * pad; return [Math.max(0, lo - p), hi + p]; };
  const [x0, x1] = fixed ? fixed : ext(pts.map((p) => p.x), 0.15);
  const [y0, y1] = fixed ? fixed : ext(pts.map((p) => p.y), 0.15);
  const px0 = rtl ? R : L, px1 = rtl ? W - L : W - R;
  const sx = (v) => { const k = (v - x0) / (x1 - x0); return rtl ? px1 - k * (px1 - px0) : px0 + k * (px1 - px0); };
  const sy = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  let out = `<rect class="c-frame" x="${px0}" y="${T}" width="${px1 - px0}" height="${H - T - B}"/>`;
  if (diagonal) out += `<path class="c-grid" d="M${sx(x0)} ${sy(y0)}L${sx(x1)} ${sy(y1)}" stroke-dasharray="4 4"/>`;
  const anc = (v) => (sx(v) < W / 2 ? 'start' : 'end');
  out += `<text class="c-tick" x="${sx(x0)}" y="${H - B + 16}" text-anchor="${anc(x0)}">${r1(x0)}</text><text class="c-tick" x="${sx(x1)}" y="${H - B + 16}" text-anchor="${anc(x1)}">${r1(x1)}</text>`;
  out += `<text class="c-tick" x="${rtl ? px1 + 6 : px0 - 6}" y="${sy(y0)}" text-anchor="${rtl ? 'start' : 'end'}">${r1(y0)}</text><text class="c-tick" x="${rtl ? px1 + 6 : px0 - 6}" y="${sy(y1) + 8}" text-anchor="${rtl ? 'start' : 'end'}">${r1(y1)}</text>`;
  out += `<text class="c-axis-t" x="${W / 2}" y="${H - 8}" text-anchor="middle">${esc(xLabel)}</text>`;
  pts.forEach((p) => {
    out += `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="7" fill="${colors(p.c)}" stroke="#1B2F45" stroke-width="1.2"><title>${esc(names(p.c))}</title></circle>`;
    out += `<text class="c-dot" x="${(sx(p.x) + (rtl ? -10 : 10)).toFixed(1)}" y="${(sy(p.y) + 4).toFixed(1)}" text-anchor="${rtl ? 'end' : 'start'}">${esc(names(p.c))}</text>`;
  });
  if (pts.length < 2) out += `<text class="c-empty c-empty-s" x="${W / 2}" y="${(H - B + T) / 2}" text-anchor="middle">${esc(empty)}</text>`;
  return `<figure class="scatter"><figcaption>${esc(yLabel)}</figcaption><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${yLabel} / ${xLabel}`)}">${out}</svg></figure>`;
}

// one horizontal bar per coral: all its holes, split into active / inactive (tested by day) and not tested
export const INACTIVE_COL = '#8E99A4';
export function holesChart(corals, { rtl, names, labels, empty }) {
  const list = corals.filter((c) => c.found && isNum(c.holes));
  const W = 760, rowH = 46, T = 14, B = 46, NAME = 120;
  const H = T + Math.max(list.length, 3) * rowH + B;
  const max = list.length ? Math.max(...list.map((c) => c.holes)) : 10;
  const x0 = rtl ? 20 : NAME + 10, x1 = rtl ? W - NAME - 10 : W - 60;
  const span = (x1 - x0) - 40;
  const sx = (v) => (v / max) * span;
  let out = '';
  list.forEach((c, i) => {
    const yy = T + i * rowH + 10, h = 24;
    const act = isNum(c.day.active) ? c.day.active : 0;
    const tested = isNum(c.day.tested) ? c.day.tested : 0;
    const segs = [[act, DAY_COL, 'c-seg'], [tested - act, INACTIVE_COL, 'c-seg'], [c.holes - tested, 'none', 'c-seg c-untested']];
    let pos = 0;
    segs.forEach(([v, col, cls]) => {
      if (v <= 0) return;
      const w = sx(v), x = rtl ? x1 - pos - w : x0 + pos;
      out += `<rect class="${cls}" x="${x.toFixed(1)}" y="${yy}" width="${w.toFixed(1)}" height="${h}" fill="${col}"/>`;
      if (w > 22) out += `<text class="c-in${col === 'none' ? ' c-in-dark' : ''}" x="${(x + w / 2).toFixed(1)}" y="${yy + 16}" text-anchor="middle">${v}</text>`;
      pos += w;
    });
    out += `<text class="c-name" x="${rtl ? W - 4 : 4}" y="${yy + 16}" text-anchor="${rtl ? 'end' : 'start'}">${esc(names(c))}</text>`;
    out += `<text class="c-val" x="${(rtl ? x1 - pos - 8 : x0 + pos + 8).toFixed(1)}" y="${yy + 16}" text-anchor="${rtl ? 'end' : 'start'}">${c.holes}</text>`;
  });
  const ly = H - 14, lx = rtl ? W - 4 : 4, dir = rtl ? -1 : 1;
  [[DAY_COL, labels.active], [INACTIVE_COL, labels.inactive], ['none', labels.untested]].forEach(([col, text], k) => {
    const bx = lx + dir * k * 190;
    out += `<rect class="${col === 'none' ? 'c-untested' : ''}" x="${rtl ? bx - 12 : bx}" y="${ly - 10}" width="12" height="12" fill="${col}"/><text class="c-leg" x="${bx + dir * 18}" y="${ly}" text-anchor="${rtl ? 'end' : 'start'}">${esc(text)}</text>`;
  });
  if (!list.length) out += emptyNote(W, H / 2, empty);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(labels.aria)}">${out}</svg>`;
}
