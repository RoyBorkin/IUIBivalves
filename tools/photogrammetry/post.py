"""mesh.npz -> colony segmentation, crop, metric scale, area, GLB."""
import sys, json, struct, numpy as np, cv2, scipy.sparse as sp
key = sys.argv[1]; SIZE_CM = float(sys.argv[2])
m = np.load(f'out/{key}/mesh.npz')
V, F, C, hsv = m['verts'], m['faces'], m['cols'], m['hsv']
n = len(V)
colony = m['colony'].copy()
# 'up' = away from where the photographers looked, i.e. minus the mean viewing direction
_sf = np.load(f'out/{key}/sfm.npz')
_dirs = np.array([cv2.Rodrigues(r)[0][2] for r in _sf['rvecs']])
_up_w = -_dirs.mean(0); _up_w /= np.linalg.norm(_up_w)
_up_l = m['Rl'] @ _up_w
_z = np.array([0, 0, 1.0]); _v = np.cross(_up_l, _z); _c = _up_l @ _z
if np.linalg.norm(_v) > 1e-6:
    _vx = np.array([[0, -_v[2], _v[1]], [_v[2], 0, -_v[0]], [-_v[1], _v[0], 0]])
    _Rup = np.eye(3) + _vx + _vx @ _vx / (1 + _c)
    V = V @ _Rup.T
if colony.sum() < 50:
    colony = np.linalg.norm(V[:, :2], axis=1) < float(m['rad'])
    print('colony from radius fallback', colony.sum())
e = np.r_[F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]
A = sp.coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(n, n)); A = ((A + A.T) > 0).tocsr()
for _ in range(4):   # majority smoothing over the mesh
    frac = (A @ colony.astype(float)) / np.maximum(A @ np.ones(n), 1)
    colony = (frac > 0.55) | (colony & (frac > 0.35))
nc, lab = sp.csgraph.connected_components(A[colony][:, colony], directed=False)
idx = np.where(colony)[0]; big = np.argmax(np.bincount(lab))
colony = np.zeros(n, bool); colony[idx[lab == big]] = True
P = V[colony]; cc = P.mean(0)
# horizontal extent (max) = reference size
xy = P[:, :2] - cc[:2]
cov = np.cov(xy.T); w, vec = np.linalg.eigh(cov)
proj = xy @ vec
ext = proj.max(0) - proj.min(0)
hgt = np.percentile(P[:, 2], 98) - np.percentile(P[:, 2], 2)
s = SIZE_CM / ext.max()                       # units -> cm
rad = np.percentile(np.linalg.norm(V[colony] - cc, axis=1), 97)
# crop: everything within 1.8 colony radii (horizontally) of the colony centre
keepv = np.linalg.norm(V[:, :2] - cc[:2], axis=1) < 1.6 * rad
remap = -np.ones(n, int); remap[keepv] = np.arange(keepv.sum())
F2 = remap[F]; F2 = F2[(F2 >= 0).all(1)]
V2 = (V[keepv] - [cc[0], cc[1], 0]) * s; C2 = C[keepv]; col2 = colony[keepv]
# drop tiny islands
n2 = len(V2); e2 = np.r_[F2[:, [0, 1]], F2[:, [1, 2]]]
G = sp.coo_matrix((np.ones(len(e2)), (e2[:, 0], e2[:, 1])), shape=(n2, n2))
_, lb = sp.csgraph.connected_components(G, directed=False)
big = np.bincount(lb)[lb] > 0.05 * n2
remap = -np.ones(n2, int); remap[big] = np.arange(big.sum())
F2 = remap[F2]; F2 = F2[(F2 >= 0).all(1)]; V2, C2, col2 = V2[big], C2[big], col2[big]
# trim the ragged open border: drop a few rings of boundary vertices, then small islands again
def boundary_verts(F_):
    e_ = np.sort(np.r_[F_[:, [0, 1]], F_[:, [1, 2]], F_[:, [2, 0]]], 1)
    u_, c_ = np.unique(e_, axis=0, return_counts=True)
    return np.unique(u_[c_ == 1])
for _ in range(int(sys.argv[3]) if len(sys.argv) > 3 else 3):
    bv = boundary_verts(F2)
    kill = np.zeros(len(V2), bool); kill[bv] = True
    F2 = F2[~kill[F2].any(1)]
used = np.unique(F2); keep_ = np.zeros(len(V2), bool); keep_[used] = True
remap = -np.ones(len(V2), int); remap[keep_] = np.arange(keep_.sum())
F2 = remap[F2]; V2, C2, col2 = V2[keep_], C2[keep_], col2[keep_]
n2 = len(V2); e2 = np.r_[F2[:, [0, 1]], F2[:, [1, 2]]]
G = sp.coo_matrix((np.ones(len(e2)), (e2[:, 0], e2[:, 1])), shape=(n2, n2))
_, lb = sp.csgraph.connected_components(G, directed=False)
big = lb == np.argmax(np.bincount(lb))
remap = -np.ones(n2, int); remap[big] = np.arange(big.sum())
F2 = remap[F2]; F2 = F2[(F2 >= 0).all(1)]; V2, C2, col2 = V2[big], C2[big], col2[big]
V2[:, 2] -= np.percentile(V2[:, 2], 3)
# colony surface area (faces whose 3 vertices are colony)
tri = V2[F2]; fa = 0.5 * np.linalg.norm(np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]), axis=1)
area = fa[col2[F2].sum(1) >= 2].sum()
# mean colony colour
cm = C2[col2].mean(0)
info = dict(key=key, sizeCm=[round(float(SIZE_CM), 1), round(float(ext.min() * s), 1), round(float(hgt * s), 1)],
            surfaceCm2=round(float(area)), colonyRGB=[int(x) for x in cm], verts=int(len(V2)), faces=int(len(F2)))
print(json.dumps(info))
json.dump(info, open(f'out/{key}/info.json', 'w'))
np.savez(f'out/{key}/final.npz', V=V2, F=F2, C=C2, colony=col2)

# ── decimate for the web (vertex clustering) to ~60k faces ──
def cluster(V, F, C, cell):
    g = np.floor(V / cell).astype(np.int64)
    _, inv, cnt = np.unique(g, axis=0, return_inverse=True, return_counts=True)
    inv = inv.ravel(); k = cnt.size
    Vn = np.zeros((k, 3)); np.add.at(Vn, inv, V); Vn /= cnt[:, None]
    Cn = np.zeros((k, 3)); np.add.at(Cn, inv, C); Cn /= cnt[:, None]
    Fn = inv[F]; Fn = Fn[(Fn[:, 0] != Fn[:, 1]) & (Fn[:, 1] != Fn[:, 2]) & (Fn[:, 0] != Fn[:, 2])]
    Fn = np.unique(np.sort(Fn, 1), axis=0, return_index=True)[1]
    return Vn, inv[F][np.sort(Fn)], Cn
Vw, Fw, Cw = V2, F2, C2
diag = np.linalg.norm(V2.max(0) - V2.min(0))
cell = diag / 400
while len(Fw) > 110000:
    Vw, Fw, Cw = cluster(V2, F2, C2, cell); cell *= 1.25
print('web faces', len(Fw))
# smooth normals
tri = Vw[Fw]; fn = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
Nw = np.zeros_like(Vw); 
for j in range(3): np.add.at(Nw, Fw[:, j], fn)
Nw /= np.linalg.norm(Nw, axis=1, keepdims=True) + 1e-12
# make normals face up/out (towards the viewer side, +z mostly)
if (Nw[:, 2]).mean() < 0: Nw = -Nw; Fw = Fw[:, ::-1]

# ── GLB: metres, y up ──
pos = (Vw[:, [0, 2, 1]] * [1, 1, -1] / 100).astype(np.float32)
nor = (Nw[:, [0, 2, 1]] * [1, 1, -1]).astype(np.float32)
Fw = Fw[:, ::-1]   # the axis swap mirrors, so flip winding
# colours as photographed (the site's viewer draws without colour conversion), and unlit,
# because the photos already carry the light and shade
colb = (Cw.clip(0, 255) + 0.5).astype(np.uint8); colb = np.c_[colb, np.full(len(colb), 255, np.uint8)]
ind = Fw.astype(np.uint32).ravel()
blobs = [pos.tobytes(), nor.tobytes(), colb.tobytes(), ind.tobytes()]
offs = []; buf = b''
for b in blobs:
    offs.append(len(buf)); buf += b + b'\0' * ((-len(b)) % 4)
nv = len(pos)
gl = {"asset": {"version": "2.0", "generator": "IUI bivalves photogrammetry"},
      "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0, "name": key}],
      "extensionsUsed": ["KHR_materials_unlit"],
      "materials": [{"pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1], "metallicFactor": 0, "roughnessFactor": 1}, "doubleSided": True, "extensions": {"KHR_materials_unlit": {}}}],
      "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1, "COLOR_0": 2}, "indices": 3, "material": 0}]}],
      "buffers": [{"byteLength": len(buf)}],
      "bufferViews": [{"buffer": 0, "byteOffset": offs[0], "byteLength": len(blobs[0]), "target": 34962},
                      {"buffer": 0, "byteOffset": offs[1], "byteLength": len(blobs[1]), "target": 34962},
                      {"buffer": 0, "byteOffset": offs[2], "byteLength": len(blobs[2]), "target": 34962},
                      {"buffer": 0, "byteOffset": offs[3], "byteLength": len(blobs[3]), "target": 34963}],
      "accessors": [{"bufferView": 0, "componentType": 5126, "count": nv, "type": "VEC3", "min": pos.min(0).tolist(), "max": pos.max(0).tolist()},
                    {"bufferView": 1, "componentType": 5126, "count": nv, "type": "VEC3"},
                    {"bufferView": 2, "componentType": 5121, "normalized": True, "count": nv, "type": "VEC4"},
                    {"bufferView": 3, "componentType": 5125, "count": len(ind), "type": "SCALAR"}]}
js = json.dumps(gl).encode(); js += b' ' * ((-len(js)) % 4)
out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(buf)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(buf), 0x004E4942) + buf
open(f'out/{key}/{key}.glb', 'wb').write(out)
print('glb %.1f MB' % (len(out) / 1e6))

# preview with the colony outlined
import render_lib
render_lib.preview(V2, F2, C2, col2, f'{key}_final.jpg')
