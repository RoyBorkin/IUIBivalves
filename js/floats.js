// ─────────────────────────────────────────────────────────────
//  3D models of the six marker floats (rubber sea animals), each with
//  its light stick, reflective tape and the rope tied around it.
//  Models face +X, up is +Y, and are about 1 unit long; the map scales them.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

const C = (h) => new THREE.Color(h);
const rubber = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0 });
const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0, ...extra });

// an ellipsoid whose vertices are coloured by a function of their (unit-sphere) position
function blob(rx, ry, rz, paint, seg = 40) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    tmp.copy(paint(x, y, z));
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
    pos.setXYZ(i, x * rx, y * ry, z * rz);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, rubber());
}
const mix = (a, b, k) => a.clone().lerp(b, Math.min(1, Math.max(0, k)));
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// a thin fin from a 2D outline (x forward, y up), extruded sideways
function fin(pts, color, thick = 0.04) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.45, bevelSize: thick * 0.45, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, -thick / 2);
  g.computeVertexNormals();
  return new THREE.Mesh(g, flat(color));
}
function eyes(x, y, z, r, iris = '#1B2F45', white = '#ffffff') {
  const grp = new THREE.Group();
  [-1, 1].forEach((s) => {
    const w = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), flat(white, { roughness: 0.2 }));
    w.position.set(x, y, z * s);
    const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.52, 14, 10), flat(iris, { roughness: 0.15 }));
    p.position.set(x + r * 0.35, y, (z + r * 0.62) * s);
    grp.add(w, p);
  });
  return grp;
}
// rope tied around the body (as on the real floats)
function rope(x, ry, rz, tilt = 0) {
  const g = new THREE.TorusGeometry(1, 0.025, 8, 40);
  const m = new THREE.Mesh(g, flat('#F1EFE6', { roughness: 0.9 }));
  m.scale.set(rz, ry, 1);
  m.rotation.y = Math.PI / 2;
  m.rotation.x = tilt;
  m.position.x = x;
  return m;
}

/* ── the six animals ── */
function shark() {
  const g = new THREE.Group();
  const grey = C('#9AA1B2'), belly = C('#ECEEF3');
  const body = blob(0.55, 0.26, 0.25, (x, y) => mix(grey, belly, smooth(-0.05, -0.45, y) * (1 - smooth(0.85, 1, -x))));
  g.add(body);
  // flattened hammer-like snout seen on the toy
  const snout = blob(0.16, 0.12, 0.28, (x, y) => mix(grey, belly, smooth(0, -0.5, y)), 28);
  snout.position.set(0.47, 0.03, 0); g.add(snout);
  g.add(fin([[-0.12, 0.18], [0.0, 0.47], [0.13, 0.2]], '#8E95A6', 0.05));
  const tail = new THREE.Group();
  tail.add(fin([[0, 0], [-0.32, 0.3], [-0.22, 0.02], [-0.3, -0.2]], '#8E95A6', 0.05));
  tail.position.x = -0.5; g.add(tail);
  [-1, 1].forEach((s) => {
    const p = fin([[0, 0], [-0.24, -0.06], [0.04, -0.03]], '#8E95A6', 0.035);
    p.rotation.x = s * 1.1; p.position.set(0.12, -0.12, s * 0.16); g.add(p);
  });
  g.add(eyes(0.5, 0.1, 0.2, 0.06, '#1B2F45', '#F1E7A0'));
  // teeth: a small white smile
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.014, 6, 20, Math.PI * 0.7), flat('#ffffff'));
  smile.rotation.set(Math.PI / 2, 0, Math.PI * 0.65); smile.position.set(0.5, -0.1, 0); smile.scale.set(1, 1.6, 1);
  g.add(smile);
  return { g, length: 1.3, back: 0.27, ropeAt: [0.2, 0.245, 0.235] };
}
function dolphin() {
  const g = new THREE.Group();
  const blue = C('#5E84DC'), belly = C('#B9CBF3');
  g.add(blob(0.6, 0.22, 0.21, (x, y) => mix(blue, belly, smooth(-0.1, -0.6, y))));
  const beak = blob(0.16, 0.07, 0.07, () => blue, 20); beak.position.set(0.66, -0.04, 0); g.add(beak);
  g.add(fin([[-0.14, 0.16], [0.02, 0.42], [-0.02, 0.36], [0.1, 0.18]], '#4F72C8', 0.045));
  [-1, 1].forEach((s) => {
    const f = fin([[0, 0], [-0.3, 0.06], [-0.2, -0.07]], '#4F72C8', 0.04);
    f.rotation.x = Math.PI / 2; f.rotation.z = s * 0.3; f.position.set(-0.56, 0.02, s * 0.12); g.add(f);
    const p = fin([[0, 0], [-0.22, -0.08], [0.02, -0.04]], '#4F72C8', 0.035);
    p.rotation.x = s * 1.0; p.position.set(0.2, -0.12, s * 0.14); g.add(p);
  });
  g.add(eyes(0.42, 0.04, 0.16, 0.05));
  return { g, length: 1.4, back: 0.23, ropeAt: [0.1, 0.22, 0.21] };
}
function clownfish() {
  const g = new THREE.Group();
  const orange = C('#F57E1E'), white = C('#FFFFFF'), black = C('#1B2F45');
  const edge = C('#C4520E');
  const band = (x, c, w) => { const d = Math.abs(x - c); return d < w ? white : d < w + 0.07 ? edge : null; };
  g.add(blob(0.42, 0.32, 0.2, (x) => band(x, 0.28, 0.13) || band(x, -0.5, 0.1) || orange, 72));
  const fo = (pts, x, y, rx = 0, rz = 0) => { const f = fin(pts, '#F57E1E', 0.04); f.position.set(x, y, 0); f.rotation.x = rx; f.rotation.z = rz; g.add(f); return f; };
  fo([[-0.2, 0.22], [-0.05, 0.42], [0.18, 0.28]], 0, 0);
  fo([[0, 0.12], [-0.28, 0.3], [-0.2, 0], [-0.28, -0.3], [0, -0.12]], -0.36, 0);
  fo([[0, -0.2], [-0.12, -0.4], [0.08, -0.25]], 0, 0);
  // the toy's cartoon eyes are large and sit on top
  g.add(eyes(0.26, 0.14, 0.13, 0.085, '#2B4AB0'));
  return { g, length: 1.0, back: 0.33, ropeAt: [0.08, 0.32, 0.2] };
}
function octopus() {
  const g = new THREE.Group();
  const pink = C('#EA4FB3'), spot = C('#F7A6D8');
  const head = blob(0.34, 0.4, 0.34, (x, y, z) => {
    const s = Math.sin(x * 9.0 + 1.3) * Math.sin(y * 8.0) * Math.sin(z * 7.0 + 0.4);
    return s > 0.55 && y > 0 ? spot : pink;
  });
  head.position.y = 0.32; g.add(head);
  const mat = flat('#E64AAE');
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      // down from under the head, then out, then curling up at the tip
      const r = 0.16 + 0.34 * smooth(0.15, 1, t) - 0.08 * smooth(0.8, 1, t);
      const y = 0.12 - 0.2 * Math.sin(Math.min(1, t * 1.3) * Math.PI * 0.5) + 0.14 * smooth(0.7, 1, t);
      const tw = 0.5 * smooth(0.6, 1, t);
      pts.push(new THREE.Vector3(Math.cos(a + tw) * r, y, Math.sin(a + tw) * r));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.06, 8, false), mat);
    g.add(tube);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat); tip.position.copy(pts[pts.length - 1]); g.add(tip);
  }
  g.add(eyes(0.27, 0.36, 0.12, 0.095));
  return { g, length: 1.0, back: 0.74, ropeAt: null, height: 0.75 };
}
function whale() {
  const g = new THREE.Group();
  const blue = C('#3165D8'), white = C('#F4F7FB');
  g.add(blob(0.56, 0.36, 0.33, (x, y) => (x > 0.15 && y < -0.08 && y > -0.75 ? (y > -0.16 ? C('#1B2F45') : white) : blue)));
  const flukes = fin([[0, 0], [-0.2, 0.22], [-0.34, 0.2], [-0.24, 0], [-0.34, -0.2], [-0.2, -0.22]], '#2F60D2', 0.05);
  flukes.rotation.x = Math.PI / 2; flukes.rotation.z = -0.35; flukes.position.set(-0.5, 0.1, 0); g.add(flukes);
  g.add(eyes(0.38, 0.1, 0.24, 0.06));
  return { g, length: 1.25, back: 0.36, ropeAt: [-0.1, 0.36, 0.33] };
}
function turtle() {
  const g = new THREE.Group();
  const green = C('#2E7D4A'), light = C('#3F9A5E'), rim = C('#C9C26A'), olive = C('#8C8A2E');
  const shell = blob(0.5, 0.3, 0.4, (x, y, z) => {
    if (y < 0.12) return rim;
    const hx = Math.abs(Math.sin(x * 6) * Math.cos(z * 6));
    return hx > 0.82 ? light : green;
  });
  shell.position.y = 0.1; g.add(shell);
  const belly = blob(0.46, 0.08, 0.36, () => olive, 24); belly.position.y = 0.06; g.add(belly);
  const head = blob(0.18, 0.15, 0.15, () => olive, 24); head.position.set(0.56, 0.16, 0); g.add(head);
  [[0.25, 1], [0.25, -1], [-0.3, 1], [-0.3, -1]].forEach(([x, s]) => {
    const f = blob(0.17, 0.04, 0.1, () => olive, 16);
    f.position.set(x, 0.05, s * 0.42); f.rotation.y = s * (x > 0 ? -0.6 : 0.5); g.add(f);
  });
  g.add(eyes(0.66, 0.22, 0.09, 0.05));
  return { g, length: 1.2, back: 0.4, ropeAt: null };
}
const MAKERS = { shark, dolphin, clownfish, octopus, whale, turtle };

/* glow colours of the light sticks — change to match the real sticks */
export const GLOW = { shark: '#FF4A5A', dolphin: '#FFE24A', clownfish: '#7CFF4F', octopus: '#4AE0FF', whale: '#FF9A2E', turtle: '#E066FF' };

// one float with its light stick, reflective tape and rope; returns { group, glowMat, top, bottom }
export function buildFloat(kind) {
  const make = MAKERS[kind] || shark;
  const { g, back, ropeAt, height } = make();
  const grp = new THREE.Group();
  grp.add(g);
  if (ropeAt) g.add(rope(ropeAt[0], ropeAt[1], ropeAt[2]));
  // light stick, tied along the back and sticking out at an angle
  const glowCol = new THREE.Color(GLOW[kind] || '#7CFF4F');
  const glowMat = new THREE.MeshStandardMaterial({ color: glowCol, emissive: glowCol, emissiveIntensity: 0.9, roughness: 0.3, transparent: true, opacity: 0.95 });
  const stick = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.5, 4, 10), glowMat);
  stick.rotation.z = Math.PI / 2 - 0.55;
  stick.position.set(-0.08, back + 0.1, 0.05);
  grp.add(stick);
  // reflective tape: a small silver patch on each side
  const tapeMat = new THREE.MeshStandardMaterial({ color: '#E6ECF0', metalness: 0.25, roughness: 0.25, emissive: '#9AA5AE', emissiveIntensity: 0.5 });
  [-1, 1].forEach((s) => {
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.01), tapeMat);
    tape.position.set(-0.12, kind === 'octopus' ? 0.2 : back * 0.45, s * ((kind === 'octopus' ? 0.3 : back * 0.75) + 0.01));
    tape.rotation.y = 0;
    grp.add(tape);
  });
  return { group: grp, glowMat, top: back + 0.3, bottom: -0.3 };
}

// a stone anchor and the rope up to the float
export function buildAnchor() {
  const g = new THREE.Group();
  const geo = new THREE.DodecahedronGeometry(0.22, 0);
  geo.scale(1.2, 0.7, 1);
  const stone = new THREE.Mesh(geo, flat('#8A8578', { roughness: 0.95, flatShading: true }));
  g.add(stone);
  return g;
}

export const FLOAT_KINDS = Object.keys(MAKERS);
