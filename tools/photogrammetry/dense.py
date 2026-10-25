"""Dense reconstruction for one coral, from sfm.npz:
stereo depth maps between neighbouring photos (rectify + SGBM with a
left-right check) -> TSDF fusion in a box around the coral ->
marching cubes -> vertex colours from the photos -> mesh.npz"""
import sys, os, time
import numpy as np, cv2
from skimage import measure
from scipy import ndimage

key = sys.argv[1]
OUT = f'out/{key}'
d = np.load(f'{OUT}/sfm.npz')
t0 = time.time()
log = lambda *a: print(f'[{time.time()-t0:6.1f}s]', *a, flush=True)
files, ids = d['files'], d['ids']
f, k1, k2 = d['intr']; Wd, H = d['size']
SC = 0.5                                  # depth maps at half resolution
K = np.array([[f, 0, Wd / 2], [0, f, H / 2], [0, 0, 1]])
dist = np.array([k1, k2, 0, 0, 0])
Ks = K.copy(); Ks[:2] *= SC
w2, h2 = int(Wd * SC), int(H * SC)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import depthlib as DL
SC = float(os.environ.get('SC', 0.5))
Ks = K.copy(); Ks[:2] *= SC
w2, h2 = int(Wd * SC), int(H * SC)
cams, _, _, _ = DL.load_cams(d, SC)
if os.environ.get('CAMS'):
    keepc = {int(x) for x in os.environ['CAMS'].split(',')}; cams = [c for c in cams if c['i'] in keepc]
log(len(cams), 'cameras')
SPARSE = 1 if len(cams) < 12 else 0
P = d['pts']

# convergence point of the optical axes = the coral the photos centre on
A = np.zeros((3, 3)); b = np.zeros(3)
for c in cams:
    v = c['z'] / np.linalg.norm(c['z']); M = np.eye(3) - np.outer(v, v); A += M; b += M @ c['C']
center = np.linalg.solve(A, b)
Dm = np.median([np.linalg.norm(c['C'] - center) for c in cams])
# ground plane from sparse points around the centre (RANSAC), normal towards the cameras
near = P[np.linalg.norm(P - center, axis=1) < 1.2 * Dm]
best = None
rng = np.random.default_rng(1)
for _ in range(600):
    s = near[rng.choice(len(near), 3, replace=False)]
    n = np.cross(s[1] - s[0], s[2] - s[0]); nn = np.linalg.norm(n)
    if nn < 1e-9: continue
    n /= nn
    dd = np.abs((near - s[0]) @ n)
    cnt = (dd < 0.03 * Dm).sum()
    if best is None or cnt > best[0]: best = (cnt, n, s[0])
_, up, p0 = best
if np.mean([(c['C'] - p0) @ up for c in cams]) < 0: up = -up
# refine plane by least squares on inliers
inl = near[np.abs((near - p0) @ up) < 0.05 * Dm]
cc = inl.mean(0); _, _, vt = np.linalg.svd(inl - cc); up2 = vt[2] * np.sign(vt[2] @ up); up, p0 = up2, cc
center = center - ((center - p0) @ up) * up        # drop the centre onto the ground plane
log('camera distance %.3f, plane inliers %d' % (Dm, len(inl)))

# local frame: x, y along the ground, z up
ax = np.cross(up, [1, 0, 0]); ax = ax if np.linalg.norm(ax) > 0.1 else np.cross(up, [0, 1, 0]); ax /= np.linalg.norm(ax)
ay = np.cross(up, ax)
Rl = np.stack([ax, ay, up])                       # world -> local
HALF = 0.75 * Dm                                  # half width of the box
ZLO, ZHI = -0.25 * Dm, 0.9 * Dm

# ── depth maps: plane sweep (depthlib) ──
def view_dir(c): return c['z']
depths = {}
if os.path.exists(f'{OUT}/depths.npz') and '--redo' not in sys.argv:
    z_ = np.load(f'{OUT}/depths.npz'); depths = {int(k): z_[k] for k in z_.files}; depths = {k: v for k, v in depths.items() if k in {c['i'] for c in cams}}; log('cached depths', len(depths))
MULTI = bool(os.environ.get('MULTI'))
up_w = -np.mean([c['z'] for c in cams], 0); up_w /= np.linalg.norm(up_w)
for a in (cams if not depths else []):
    nb, zlo, zhi = DL.neighbours(a, cams, P, Ks, (w2, h2), nmax=4, amax=40 if not SPARSE else 65)
    if len(nb) < 2: log('depth', a['i'], 'no neighbours'); continue
    D = DL.sweep_multi(a, nb, zlo, zhi, Ks, (w2, h2), up_w=up_w) if MULTI else DL.sweep(a, nb, zlo, zhi, Ks, (w2, h2))
    depths[a['i']] = D
    acc, _ = DL.score(D, a, P, Ks, (w2, h2))
    log('depth', a['i'], len(nb), 'nb, valid %.0f%%, agrees with sparse %.0f%%' % (100 * np.isfinite(D).mean(), 100 * acc))

# ── geometric consistency: keep depths that other views confirm ──
def consistency(depths, tol=0.02):
    out = {}
    cm = {c['i']: c for c in cams}
    for a, Da in depths.items():
        ys, xs = np.where(np.isfinite(Da)); zz = Da[ys, xs]
        X = np.stack([(xs - Ks[0, 2]) / Ks[0, 0] * zz, (ys - Ks[1, 2]) / Ks[1, 1] * zz, zz], 1)
        Xw = (X - cm[a]['t']) @ cm[a]['R']
        cnt = np.zeros(len(zz), int)
        for b, Db in depths.items():
            if b == a: continue
            P_ = Xw @ cm[b]['R'].T + cm[b]['t']
            with np.errstate(divide='ignore', invalid='ignore'):
                u = np.round(P_[:, 0] / P_[:, 2] * Ks[0, 0] + Ks[0, 2]); v = np.round(P_[:, 1] / P_[:, 2] * Ks[1, 1] + Ks[1, 2])
            m = (P_[:, 2] > 0) & (u >= 0) & (u < w2) & (v >= 0) & (v < h2)
            db = np.full(len(zz), np.nan); db[m] = Db[v[m].astype(int), u[m].astype(int)]
            cnt += np.abs(db - P_[:, 2]) < tol * P_[:, 2]
        D = np.full_like(Da, np.nan); need = 1 if SPARSE else 2
        k = cnt >= need; D[ys[k], xs[k]] = Da[ys[k], xs[k]]
        out[a] = D
    return out
raw_depths = depths
depths = consistency(depths, 0.02 if not SPARSE else 0.03)
def densify(D, k):
    m = np.isfinite(D).astype(np.float32); z = np.nan_to_num(D, nan=0).astype(np.float32)
    num = cv2.blur(z, (k, k)); den = cv2.blur(m, (k, k))
    out = D.copy(); fillm = (m == 0) & (den > 0.25)
    out[fillm] = num[fillm] / den[fillm]
    return out
depths = {k_: densify(v_, 9 if SPARSE else 5) for k_, v_ in depths.items()}
log('consistent depth: ' + ' '.join('%d:%.0f%%' % (k, 100 * np.isfinite(v).mean()) for k, v in depths.items()))
if not os.path.exists(f'{OUT}/depths.npz') or '--redo' in sys.argv: np.savez_compressed(f'{OUT}/depths.npz', **{str(k): v for k, v in raw_depths.items()})
#, **{str(k): v for k, v in depths.items()})
import scipy.sparse as sp

def fuse(cen, half, zlo, zhi, NV=200, minw=3):
    vs = 2 * half / NV
    nz = int((zhi - zlo) / vs)
    gx = (np.arange(NV) + 0.5) * vs - half; gz = (np.arange(nz) + 0.5) * vs + zlo
    XX, YY, ZZ = np.meshgrid(gx, gx, gz, indexing='ij')
    Pw = np.stack([XX, YY, ZZ], -1).reshape(-1, 3) @ Rl + cen
    tsdf = np.ones(len(Pw), np.float32); wsum = np.zeros(len(Pw), np.float32)
    trunc = max(4 * vs, float(os.environ.get('TR', 0.004)) * Dm)
    for c in cams:
        Dmap = depths.get(c['i'])
        if Dmap is None: continue
        Pc = Pw @ c['R'].T + c['t']; z = Pc[:, 2]
        with np.errstate(divide='ignore', invalid='ignore'):
            u = np.round(Pc[:, 0] / z * Ks[0, 0] + Ks[0, 2]); v = np.round(Pc[:, 1] / z * Ks[1, 1] + Ks[1, 2])
        m = (z > 0) & (u >= 0) & (u < w2) & (v >= 0) & (v < h2)
        dep = np.full(len(Pw), np.nan, np.float32); dep[m] = Dmap[v[m].astype(int), u[m].astype(int)]
        sdf = dep - z
        upd = np.isfinite(sdf) & (sdf > -trunc)
        s_ = np.clip(sdf[upd] / trunc, -1, 1); w = wsum[upd]
        tsdf[upd] = (tsdf[upd] * w + s_) / (w + 1); wsum[upd] = w + 1
    if os.environ.get('DEBUGFUSE'):
        for c in cams[:8]:
            Dmap = depths.get(c['i'])
            if Dmap is None: continue
            ys, xs = np.where(np.isfinite(Dmap)); zz = Dmap[ys, xs]
            Xc = np.stack([(xs - Ks[0, 2]) / Ks[0, 0] * zz, (ys - Ks[1, 2]) / Ks[1, 1] * zz, zz], 1)
            L_ = ((Xc - c['t']) @ c['R'] - cen) @ Rl.T
            inb = (np.abs(L_[:, 0]) < half) & (np.abs(L_[:, 1]) < half) & (L_[:, 2] > zlo) & (L_[:, 2] < zhi)
            log('  cam', c['i'], 'depth px', len(zz), 'inside box', int(inb.sum()))
    T = tsdf.reshape(NV, NV, nz); Wg = wsum.reshape(NV, NV, nz)
    log('fuse NV', NV, 'seen>=minw %.2f%%' % (100 * (Wg >= minw).mean()), 'neg %.2f%%' % (100 * ((T < 0) & (Wg >= minw)).mean()), 'pos %.2f%%' % (100 * ((T > 0) & (Wg >= minw)).mean()))
    mask = ndimage.binary_dilation(Wg >= minw, iterations=1)
    verts, faces, normals, _ = measure.marching_cubes(T, level=0.0, mask=mask, spacing=(vs, vs, vs))
    verts = verts + [gx[0], gx[0], gz[0]]
    return verts, faces, normals

def keep(verts, faces, normals, keepv):
    remap = -np.ones(len(verts), int); remap[keepv] = np.arange(keepv.sum())
    faces = remap[faces]; faces = faces[(faces >= 0).all(1)]
    return verts[keepv], faces, normals[keepv]

def largest(verts, faces, normals):
    e = np.r_[faces[:, [0, 1]], faces[:, [1, 2]]]
    G = sp.coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(len(verts),) * 2)
    _, lab = sp.csgraph.connected_components(G, directed=False)
    return keep(verts, faces, normals, lab == np.argmax(np.bincount(lab)))

def colour(verts, normals, cen):
    Vw = verts @ Rl + cen; Nw = normals @ Rl
    col = np.zeros((len(verts), 3)); wt = np.zeros(len(verts))
    for c in cams:
        Pc = Vw @ c['R'].T + c['t']; z = Pc[:, 2]
        u = Pc[:, 0] / z * K[0, 0] + K[0, 2]; v = Pc[:, 1] / z * K[1, 1] + K[1, 2]
        m = (z > 0) & (u >= 0) & (u < Wd - 1) & (v >= 0) & (v < H - 1)
        Dmap = depths.get(c['i'])
        if Dmap is not None:
            us = (u * SC).astype(int).clip(0, w2 - 1); vv = (v * SC).astype(int).clip(0, h2 - 1)
            dz = Dmap[vv, us]
            m &= ~(np.isfinite(dz) & (z > dz * 1.04))
        view = c['C'] - Vw; view /= np.linalg.norm(view, axis=1, keepdims=True)
        cosang = np.abs((Nw * view).sum(1))
        m &= cosang > 0.15
        w = cosang ** 2 / (z ** 2 + 1e-9)
        px = c['img'][v[m].astype(int), u[m].astype(int)][:, ::-1].astype(float)
        col[m] += px * w[m, None]; wt[m] += w[m]
    return col, wt

def fill(col, wt, faces, n):
    seen = wt > 0
    col = col.copy(); col[seen] /= wt[seen, None]
    e = np.r_[faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]]
    A = sp.coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(n, n)); A = (A + A.T).tocsr()
    s = seen.astype(float)
    for _ in range(60):
        if s.all(): break
        num = A @ (col * s[:, None]); den = A @ s
        new = (den > 0) & (s == 0)
        col[new] = num[new] / den[new, None]; s[new] = 1
    col[s == 0] = np.median(col[s > 0], 0)
    return col, seen

# ── locate the colony: each photo's central cream blob, lifted to 3D through the depth maps ──
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mask_lib
from scipy.spatial import cKDTree
import scipy.sparse as sp
cell = 0.02 * Dm
pts_c, src_c = [], []
for c in cams:
    Dmap = depths.get(c['i'])
    if Dmap is None: continue
    tb = mask_lib.target_blob(c['small'])
    if tb is None: continue
    ys, xs = np.where(tb > 0)
    z = Dmap[ys, xs]; ok = np.isfinite(z)
    if ok.sum() < 20: continue
    sel = np.where(ok)[0][:: max(1, ok.sum() // 1500)]
    Xc = np.stack([(xs[sel] - Ks[0, 2]) / Ks[0, 0] * z[sel], (ys[sel] - Ks[1, 2]) / Ks[1, 1] * z[sel], z[sel]], 1)
    pts_c.append((Xc - c['t']) @ c['R']); src_c.append(np.full(len(sel), c['i']))
pts_c = np.vstack(pts_c); src_c = np.concatenate(src_c)
pr = cKDTree(pts_c).query_pairs(0.03 * Dm, output_type='ndarray')
G_ = sp.coo_matrix((np.ones(len(pr)), (pr[:, 0], pr[:, 1])), shape=(len(pts_c),) * 2)
_, lb_ = sp.csgraph.connected_components(G_, directed=False)
# the colony = the cluster seen from the most photos
score_ = {L: len(set(src_c[lb_ == L])) * 1e6 + (lb_ == L).sum() for L in np.unique(lb_)}
Lb = max(score_, key=score_.get)
cp_ = pts_c[lb_ == Lb]
cw = np.median(cp_, 0)
cc = (cw - center) @ Rl.T
rad = np.percentile(np.linalg.norm((cp_ - cw) @ Rl.T, axis=1), 95)
log('colony from %d views, %d points, radius %.3f (%.3f Dm)' % (len(set(src_c[lb_ == Lb])), len(cp_), rad, rad / Dm))
colony_cells = {tuple(g) for g in np.floor((cp_ - center) / cell).astype(int)}

if os.environ.get('HF'):
    # ── height-field surface for sparse sets ──
    upv = -np.mean([view_dir(c) for c in cams], 0); upv /= np.linalg.norm(upv)
    ax2 = np.cross(upv, Rl[0]); ax2 /= np.linalg.norm(ax2); ay2 = np.cross(upv, ax2)
    R2 = np.stack([ax2, ay2, upv])
    cw0 = center + cc @ Rl
    PP, CC = [], []
    for c in cams:
        Dm_ = depths.get(c['i'])
        if Dm_ is None: continue
        ys, xs = np.where(np.isfinite(Dm_)); zz = Dm_[ys, xs]
        Xc = np.stack([(xs - Ks[0, 2]) / Ks[0, 0] * zz, (ys - Ks[1, 2]) / Ks[1, 1] * zz, zz], 1)
        PP.append(((Xc - c['t']) @ c['R'] - cw0) @ R2.T); CC.append(c['small'][ys, xs][:, ::-1].astype(float))
    PP = np.vstack(PP); CC = np.vstack(CC)
    if os.environ.get('HFSRC') == 'sparse':
        # colony = sparse points that fall in the cream target blob in most photos that see them
        Pw_ = d['pts']; hit = np.zeros(len(Pw_)); seen_ = np.zeros(len(Pw_))
        for c in cams:
            tb = mask_lib.target_blob(c['small'])
            if tb is None: continue
            mk = mask_lib.cream_mask(c['small'])
            Pc = Pw_ @ c['R'].T + c['t']; z = Pc[:, 2]
            u = (Pc[:, 0] / z * Ks[0, 0] + Ks[0, 2]); v = (Pc[:, 1] / z * Ks[1, 1] + Ks[1, 2])
            m = (z > 0) & (u >= 0) & (u < w2) & (v >= 0) & (v < h2)
            seen_[m] += 1; hit[m] += tb[v[m].astype(int), u[m].astype(int)]
        frac = np.where(seen_ > 0, hit / np.maximum(seen_, 1), 0)
        cp = Pw_[(frac >= 0.6) & (seen_ >= 3)]
        from scipy.spatial import cKDTree
        pairs_ = cKDTree(cp).query_pairs(0.04 * Dm, output_type='ndarray')
        G_ = sp.coo_matrix((np.ones(len(pairs_)), (pairs_[:, 0], pairs_[:, 1])), shape=(len(cp),) * 2)
        _, lb_ = sp.csgraph.connected_components(G_, directed=False)
        cnt_ = np.bincount(lb_); log('colony clusters', sorted(cnt_)[-5:])
        cp = cp[lb_ == np.argmax(cnt_)]
        cw0 = cp.mean(0)
        # up: normal of the seabed around the colony (sparse points within 3x), towards cameras
        loc_ = Pw_[np.linalg.norm(Pw_ - cw0, axis=1) < 4 * np.percentile(np.linalg.norm(cp - cw0, axis=1), 90)]
        cg = loc_.mean(0); _, _, vt = np.linalg.svd(loc_ - cg); nrm = vt[2]
        if nrm @ upv < 0: nrm = -nrm
        upv = nrm; ax2 = np.cross(upv, [1, 0, 0]); ax2 /= np.linalg.norm(ax2); ay2 = np.cross(upv, ax2)
        R2 = np.stack([ax2, ay2, upv])
        rad = np.percentile(np.linalg.norm(((cp - cw0) @ R2.T)[:, :2], axis=1), 90)
        PP = (Pw_ - cw0) @ R2.T; CC = d['cols'][:, ::-1].astype(float) if d['cols'].ndim == 2 else np.full((len(PP), 3), 128.0)
        colony_cells = {tuple(g) for g in np.floor((cp - center) / cell).astype(int)}
        log('sparse colony points', len(cp), 'radius %.3f' % rad)
    HW = 2.2 * rad; NG = int(os.environ.get('NG', 90)); cs = 2 * HW / NG
    gi = np.floor((PP[:, :2] + HW) / cs).astype(int); ok = (gi >= 0).all(1) & (gi < NG).all(1)
    gi, PP, CC = gi[ok], PP[ok], CC[ok]
    lin = gi[:, 0] * NG + gi[:, 1]
    order = np.argsort(lin); lin, PPo, CCo = lin[order], PP[order], CC[order]
    uniq, start, cnt = np.unique(lin, return_index=True, return_counts=True)
    Z = np.full(NG * NG, np.nan); Cg = np.zeros((NG * NG, 3)); Nn = np.zeros(NG * NG)
    for u_, s_, n_ in zip(uniq, start, cnt):
        zs = PPo[s_:s_ + n_, 2]
        md = np.median(zs); mad = np.median(np.abs(zs - md)) + 1e-9
        top = np.abs(zs - md) < 2.5 * mad
        Z[u_] = np.median(zs[top]); Cg[u_] = CCo[s_:s_ + n_][top].mean(0); Nn[u_] = n_
        if mad > 0.25 * rad: Nn[u_] = 0      # cell too ambiguous
    Z = Z.reshape(NG, NG); Cg = Cg.reshape(NG, NG, 3); Nn = Nn.reshape(NG, NG)
    has = np.isfinite(Z) & (Nn >= int(os.environ.get('HFMIN', 2)))
    Z[~has] = np.nan
    # remove spikes, then fill gaps
    Zm = ndimage.median_filter(np.nan_to_num(Z, nan=np.nanmedian(Z)), 5)
    for _ in range(3):
        Zm = ndimage.median_filter(np.where(has, Z, np.nan_to_num(Zm)), 7)
        res = np.abs(Z - Zm); sig = 1.4826 * np.nanmedian(res[has])
        bad = has & (res > 2.5 * sig); Z[bad] = np.nan; has &= ~bad
    Zf = Z.copy(); Cf = Cg.copy(); hm = has.copy()
    for k in (3, 5, 9, 15, 25):
        m = hm.astype(np.float32); zz = np.where(hm, Zf, 0).astype(np.float32)
        den = cv2.blur(m, (k, k)); num = cv2.blur(zz, (k, k))
        cn = np.stack([cv2.blur((Cf[..., j] * m).astype(np.float32), (k, k)) for j in range(3)], -1)
        f_ = (~hm) & (den > 0.15)
        Zf[f_] = num[f_] / den[f_]; Cf[f_] = cn[f_] / den[f_, None]; hm |= f_
    Zf = cv2.GaussianBlur(np.nan_to_num(Zf, nan=np.nanmin(Zf[hm])).astype(np.float32), (0, 0), float(os.environ.get('HS', 1.5)))
    Cf = cv2.GaussianBlur(Cf.astype(np.float32), (0, 0), 0.8)
    yy, xx = np.meshgrid(np.arange(NG), np.arange(NG), indexing='ij')
    inside_disc = np.hypot((xx + 0.5) * cs - HW, (yy + 0.5) * cs - HW) < HW * 0.97
    valid = hm & inside_disc
    vid = -np.ones((NG, NG), int); vid[valid] = np.arange(valid.sum())
    verts = np.stack([(yy[valid] + 0.5) * cs - HW, (xx[valid] + 0.5) * cs - HW, Zf[valid]], 1)
    col = Cf[valid]
    q = [(vid[:-1, :-1], vid[1:, :-1], vid[1:, 1:]), (vid[:-1, :-1], vid[1:, 1:], vid[:-1, 1:])]
    faces = np.vstack([np.stack([a_.ravel(), b_.ravel(), c_.ravel()], 1) for a_, b_, c_ in q])
    faces = faces[(faces >= 0).all(1)]
    normals = np.zeros_like(verts)
    verts, faces, normals = largest(verts, faces, normals)
    vkeep = valid.copy(); col = col[np.isin(np.arange(valid.sum()), np.unique(faces)) | True][:len(verts)] if False else None
    # recolour from the photos (also gives a consistent look with the other models)
    col, wt = colour(verts, np.tile([0, 0, 1.0], (len(verts), 1)) @ (R2 @ Rl.T), cw0) if False else (None, None)
    # map back: build colours by projecting into the images directly
    Vw_ = verts @ R2 + cw0
    acc = np.zeros((len(verts), 3)); wsum_ = np.zeros(len(verts))
    for c in cams:
        Pc = Vw_ @ c['R'].T + c['t']; z = Pc[:, 2]
        u = Pc[:, 0] / z * K[0, 0] + K[0, 2]; v = Pc[:, 1] / z * K[1, 1] + K[1, 2]
        m = (z > 0) & (u >= 0) & (u < Wd - 1) & (v >= 0) & (v < H - 1)
        Dmap = depths.get(c['i'])
        if Dmap is not None:
            us = (u * SC).astype(int).clip(0, w2 - 1); vv = (v * SC).astype(int).clip(0, h2 - 1)
            dz = Dmap[vv, us]; m &= ~(np.isfinite(dz) & (z > dz * 1.05))
        w_ = 1 / (z ** 2 + 1e-9)
        acc[m] += c['img'][v[m].astype(int), u[m].astype(int)][:, ::-1] * w_[m, None]; wsum_[m] += w_[m]
    col, seen = fill(acc, wsum_, faces, len(verts))
    tri = verts[faces]; fn = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    normals = np.zeros_like(verts)
    for j in range(3): np.add.at(normals, faces[:, j], fn)
    normals /= np.linalg.norm(normals, axis=1, keepdims=True) + 1e-12
    gcell = np.floor((Vw_ - center) / cell).astype(int)
    dil = {(k[0] + dx, k[1] + dy, k[2] + dz) for k in colony_cells for dx in (-2, -1, 0, 1, 2) for dy in (-2, -1, 0, 1, 2) for dz in (-2, -1, 0, 1, 2)}
    inside = np.array([tuple(g) in dil for g in gcell])
    lab_ = cv2.cvtColor(col.clip(0, 255).astype(np.uint8)[None], cv2.COLOR_RGB2LAB)[0].astype(float)
    db = lab_[:, 2] - np.median(lab_[:, 2])
    colony = inside & (db > 0.25 * max(np.percentile(db, 97), 4))
    hsv = cv2.cvtColor(col.clip(0, 255).astype(np.uint8)[None], cv2.COLOR_RGB2HSV)[0].astype(float)
    log('height-field mesh', len(verts), 'verts', len(faces), 'faces; colony verts', int(colony.sum()))
    np.savez(f'{OUT}/mesh.npz', verts=verts, faces=faces, normals=normals, cols=col.astype(np.float32), Dm=Dm,
             rad=rad, center=cw0, Rl=R2, hsv=hsv, colony=colony)
    sys.exit(0)

if os.environ.get('HIRES'):
    # ── second depth pass: full resolution, only around the colony, depths near it only ──
    cl_ = cv2.createCLAHE(2.0, (8, 8))
    HSC = float(os.environ.get('HSC', 1.0)); HWIN = int(os.environ.get('HWIN', 11))
    KF = K.copy(); KF[:2] *= HSC; WF, HF_ = int(Wd * HSC), int(H * HSC)
    for c in cams:
        c['gF'] = cl_.apply(cv2.cvtColor(cv2.resize(c['img'], (WF, HF_), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)).astype(np.float32) / 255
    hi = {}
    for a in cams:
        Pa = a['R'] @ cw + a['t']
        if Pa[2] <= 0: continue
        u0 = KF[0, 0] * Pa[0] / Pa[2] + KF[0, 2]; v0 = KF[1, 1] * Pa[1] / Pa[2] + KF[1, 2]
        rpx = KF[0, 0] * rad / Pa[2] * 2.6
        x0, x1 = int(max(0, u0 - rpx)), int(min(WF, u0 + rpx)); y0, y1 = int(max(0, v0 - rpx)), int(min(HF_, v0 + rpx))
        if x1 - x0 < 40 or y1 - y0 < 40: continue
        nb, _, _ = DL.neighbours(a, cams, P, Ks, (w2, h2), nmax=5, amax=40 if not SPARSE else 65)
        nb = [b for b in nb if (b['R'] @ cw + b['t'])[2] > 0]
        if len(nb) < 2: continue
        Kc_ = KF.copy(); Kc_[0, 2] -= x0; Kc_[1, 2] -= y0
        ac = dict(g=a['gF'][y0:y1, x0:x1], R=a['R'], t=a['t'])
        nbF = [dict(g=b['gF'], R=b['R'], t=b['t']) for b in nb]
        zlo_, zhi_ = Pa[2] - 3.0 * rad, Pa[2] + 3.0 * rad
        Dc = DL.sweep(ac, nbF, max(zlo_, 0.2 * Pa[2]), zhi_, Kc_, (x1 - x0, y1 - y0), ND=160, WIN=HWIN, Kn=KF, amb=0.03, cmax=0.45)
        full = np.full((HF_, WF), np.nan, np.float32); full[y0:y1, x0:x1] = Dc
        hi[a['i']] = full
        log('hi-res depth', a['i'], 'window %dx%d' % (x1 - x0, y1 - y0), 'valid %.0f%%' % (100 * np.isfinite(Dc).mean()))
    np.savez_compressed(f'{OUT}/hires_raw.npz', **{str(k): v for k, v in hi.items()})
    # from here on, depth maps are full resolution
    Ks = KF; w2, h2 = WF, HF_; SC = HSC
    depths = consistency(hi, 0.015 if not SPARSE else 0.02)
    depths = {k_: densify(v_, 7) for k_, v_ in depths.items()}
    log('consistent hi-res depth: ' + ' '.join('%d:%.0f%%' % (k, 100 * np.isfinite(v).mean()) for k, v in depths.items()))

# ── pass 2: fine, around the colony ──
_pts = []
for c in cams:
    Dm_ = depths.get(c['i'])
    if Dm_ is None: continue
    ys, xs = np.where(np.isfinite(Dm_)); zz = Dm_[ys, xs]
    Xc = np.stack([(xs - Ks[0, 2]) / Ks[0, 0] * zz, (ys - Ks[1, 2]) / Ks[1, 1] * zz, zz], 1)
    _pts.append((Xc - c['t']) @ c['R'])
_pts = np.vstack(_pts); _loc = (_pts - (center + cc @ Rl)) @ Rl.T
_near = _loc[np.linalg.norm(_loc[:, :2], axis=1) < 2.2 * rad]
log('dense pts near colony', len(_near), 'z pct', np.percentile(_near[:, 2], [5, 50, 95]).round(2) if len(_near) else None, 'rad', round(rad, 2))
cen2 = center + cc @ Rl
H2 = 2.2 * rad
verts, faces, normals = fuse(cen2, H2, -1.6 * rad, 2.0 * rad, NV=int(os.environ.get('NV2', 260)), minw=3 - SPARSE)
r = np.linalg.norm(verts[:, :2], axis=1)
verts, faces, normals = keep(verts, faces, normals, r < H2 * 0.97)
verts, faces, normals = largest(verts, faces, normals)
col, wt = colour(verts, normals, cen2); col, seen = fill(col, wt, faces, len(verts))
log('fine mesh', len(verts), 'verts', len(faces), 'faces, coloured %.0f%%' % (100 * seen.mean()))
hsv = cv2.cvtColor(col.clip(0, 255).astype(np.uint8)[None], cv2.COLOR_RGB2HSV)[0].astype(float)
Vw_ = verts @ Rl + cen2
gcell = np.floor((Vw_ - center) / cell).astype(int)
dil = {(k[0] + dx, k[1] + dy, k[2] + dz) for k in colony_cells for dx in (-1, 0, 1) for dy in (-1, 0, 1) for dz in (-1, 0, 1)}
inside = np.array([tuple(g) in dil for g in gcell])
lab_ = cv2.cvtColor(col.clip(0, 255).astype(np.uint8)[None], cv2.COLOR_RGB2LAB)[0].astype(float)
db = lab_[:, 2] - np.median(lab_[:, 2])
colony = inside & (db > 0.25 * max(np.percentile(db, 97), 4))
log('colony verts', int(colony.sum()), 'of', len(verts))
np.savez(f'{OUT}/mesh.npz', verts=verts, faces=faces, normals=normals, cols=col.astype(np.float32), Dm=Dm,
         rad=rad, center=cen2, Rl=Rl, hsv=hsv, colony=colony)
log('saved mesh')
