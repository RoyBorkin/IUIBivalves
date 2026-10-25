"""Incremental structure-from-motion for one coral photo set.
SIFT features -> pairwise matching + geometric check -> tracks ->
incremental registration (PnP) + triangulation -> bundle adjustment
(shared focal length and two radial distortion terms).
Writes <out>/sfm.npz with cameras, intrinsics and sparse points."""
import sys, os, glob, re, time, json
import numpy as np, cv2
from scipy.optimize import least_squares
from scipy.sparse import lil_matrix

key = sys.argv[1]
W_TARGET = int(sys.argv[2]) if len(sys.argv) > 2 else 1200
OUT = f'out/{os.environ.get("OUTKEY", key)}'
os.makedirs(OUT, exist_ok=True)
files = sorted(glob.glob(f'img/{key}-*.jpg'), key=lambda f: int(re.findall(r'-(\d+)\.jpg$', f)[0]) if re.search(r'-(\d+)\.jpg$', f) else 0)
files = [f for f in files if not f.endswith('-s.jpg')]
if os.environ.get('PICK'):
    pick = set()
    for part in os.environ['PICK'].split(','):
        a_, _, b_ = part.partition('-'); pick |= set(range(int(a_), int(b_ or a_) + 1))
    files = [f for f in files if int(re.findall(r'-(\d+)\.jpg$', f)[0]) in pick]
t0 = time.time()
log = lambda *a: print(f'[{time.time()-t0:6.1f}s]', *a, flush=True)

imgs, grays = [], []
for f in files:
    im = cv2.imread(f)
    s = W_TARGET / max(im.shape[:2])
    im = cv2.resize(im, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    imgs.append(im)
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    # underwater photos are low-contrast: equalise locally before detecting features
    g = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8)).apply(g)
    grays.append(g)
N = len(imgs)
H, Wd = imgs[0].shape[:2]
cx, cy = Wd / 2, H / 2
f0 = 1.0 * Wd
K0 = np.array([[f0, 0, cx], [0, f0, cy], [0, 0, 1]])
log(N, 'images', Wd, 'x', H)

NF = int(os.environ.get('NF', 7000)); RATIO = float(os.environ.get('RATIO', 0.8)); MINI = int(os.environ.get('MINI', 30)); FTH = float(os.environ.get('FTH', 1.5))
sift = cv2.SIFT_create(nfeatures=NF, contrastThreshold=0.015 if NF > 7000 else 0.02)
import pickle
CACHE = f'{OUT}/matches_{W_TARGET}_{os.environ.get("ASIFT","0")}_{NF}_{RATIO}_{MINI}.pkl'
if os.path.exists(CACHE):
    kps, pairs = pickle.load(open(CACHE, 'rb')); log('cached matches', len(pairs))
else:
    kps, descs = [], []
    def detect(g):
        if not os.environ.get('ASIFT'):
            k, d = sift.detectAndCompute(g, None); return np.array([p.pt for p in k], np.float64), d
        P_, D_ = [], []
        h, w = g.shape
        for t, phis in [(1, [0]), (np.sqrt(2), [0, 45, 90, 135]), (2, [0, 60, 120])]:
            for phi in phis:
                A = np.eye(2, 3)
                img = g
                if phi:
                    Mr = cv2.getRotationMatrix2D((w / 2, h / 2), phi, 1.0)
                    cs = np.abs(Mr[:, :2]); nw, nh = int(h * cs[0, 1] + w * cs[0, 0]), int(h * cs[0, 0] + w * cs[0, 1])
                    Mr[0, 2] += nw / 2 - w / 2; Mr[1, 2] += nh / 2 - h / 2
                    img = cv2.warpAffine(g, Mr, (nw, nh), borderMode=cv2.BORDER_CONSTANT); A = Mr
                if t > 1:
                    img = cv2.GaussianBlur(img, (0, 0), sigmaX=0.8 * np.sqrt(t * t - 1), sigmaY=0.01)
                    img = cv2.resize(img, (int(img.shape[1] / t), img.shape[0]), interpolation=cv2.INTER_NEAREST)
                    A = np.diag([1 / t, 1]) @ A
                sub = cv2.SIFT_create(nfeatures=NF // (1 if t == 1 else 3), contrastThreshold=0.02)
                k, d = sub.detectAndCompute(img, None)
                if d is None: continue
                pts = np.array([p.pt for p in k], np.float64)
                A3 = np.vstack([A, [0, 0, 1]]); Ai = np.linalg.inv(A3)
                back = pts @ Ai[:2, :2].T + Ai[:2, 2]
                ok = (back[:, 0] >= 0) & (back[:, 0] < w) & (back[:, 1] >= 0) & (back[:, 1] < h)
                P_.append(back[ok]); D_.append(d[ok])
        return np.vstack(P_), np.vstack(D_)
    for g in grays:
        kp_, d = detect(g)
        d = d / (np.abs(d).sum(1, keepdims=True) + 1e-7)
        d = np.sqrt(d).astype(np.float32)  # RootSIFT
        kps.append(kp_)
        descs.append(d)
    log('features', [len(k) for k in kps])

    flann = cv2.FlannBasedMatcher(dict(algorithm=1, trees=5), dict(checks=64))
    WIN = 14 if N > 40 else N
    pairs = {}
    for i in range(N):
        for j in range(i + 1, min(N, i + WIN + 1)):
            m = flann.knnMatch(descs[i], descs[j], k=2)
            good = [a for a, b in (x for x in m if len(x) == 2) if a.distance < RATIO * b.distance]
            if RATIO > 0.8:  # looser ratio: keep only mutual nearest neighbours
                back = {x[0].queryIdx: x[0].trainIdx for x in flann.knnMatch(descs[j], descs[i], k=1) if x}
                good = [g for g in good if back.get(g.trainIdx) == g.queryIdx]
            if len(good) < MINI: continue
            p1 = kps[i][[g.queryIdx for g in good]]; p2 = kps[j][[g.trainIdx for g in good]]
            F, mask = cv2.findFundamentalMat(p1, p2, cv2.USAC_MAGSAC, FTH, 0.999, 5000)
            if F is None: continue
            mask = mask.ravel().astype(bool)
            if mask.sum() < MINI: continue
            pairs[(i, j)] = np.array([[g.queryIdx, g.trainIdx] for g, ok in zip(good, mask) if ok])
    log('verified pairs', len(pairs))
    pickle.dump((kps, pairs), open(CACHE, 'wb'))

# tracks via union-find on (image, keypoint)
parent = {}
def find(x):
    while parent.setdefault(x, x) != x:
        parent[x] = parent[parent[x]]; x = parent[x]
    return x
for (i, j), mm in pairs.items():
    for a, b in mm:
        ra, rb = find((i, a)), find((j, b))
        if ra != rb: parent[ra] = rb
groups = {}
for x in list(parent):
    groups.setdefault(find(x), []).append(x)
tracks = []
for g in groups.values():
    ims = [x[0] for x in g]
    if len(set(ims)) != len(ims) or len(g) < 2: continue  # inconsistent track
    tracks.append(dict(g))
log('tracks', len(tracks))
obs_by_img = [dict() for _ in range(N)]  # kp idx -> track id
for t, tr in enumerate(tracks):
    for i, k in tr.items(): obs_by_img[i][k] = t

def undist_norm(pts, f, k1, k2):
    """pixel -> normalised camera coords, undoing radial distortion (iterative)."""
    x = (pts - [cx, cy]) / f
    u = x.copy()
    for _ in range(6):
        r2 = (u ** 2).sum(1, keepdims=True)
        u = x / (1 + k1 * r2 + k2 * r2 ** 2)
    return u

def project(Pw, R, t, f, k1, k2):
    Pc = Pw @ R.T + t
    x = Pc[:, :2] / Pc[:, 2:3]
    r2 = (x ** 2).sum(1, keepdims=True)
    x = x * (1 + k1 * r2 + k2 * r2 ** 2)
    return x * f + [cx, cy], Pc[:, 2]

FIXK = bool(os.environ.get('FIXK'))
intr = np.array([f0, 0.0, 0.0])
poses = {}   # img -> (rvec, t)
X = {}       # track -> 3D point

def triangulate(t_ids):
    added = 0
    f, k1, k2 = intr
    for t in t_ids:
        if t in X: continue
        obs = [(i, k) for i, k in tracks[t].items() if i in poses]
        if len(obs) < 2: continue
        # best pair = widest angle
        best = None
        cams = {i: (cv2.Rodrigues(poses[i][0])[0], poses[i][1]) for i, _ in obs}
        centers = {i: -cams[i][0].T @ cams[i][1] for i, _ in obs}
        for a in range(len(obs)):
            for b in range(a + 1, len(obs)):
                ia, ka = obs[a]; ib, kb = obs[b]
                pa = undist_norm(kps[ia][[ka]], f, k1, k2); pb = undist_norm(kps[ib][[kb]], f, k1, k2)
                Ra, ta = cams[ia]; Rb, tb = cams[ib]
                Xh = cv2.triangulatePoints(np.hstack([Ra, ta[:, None]]), np.hstack([Rb, tb[:, None]]), pa.T, pb.T)
                P = (Xh[:3] / Xh[3]).ravel()
                va = P - centers[ia]; vb = P - centers[ib]
                ang = np.degrees(np.arccos(np.clip(va @ vb / (np.linalg.norm(va) * np.linalg.norm(vb) + 1e-12), -1, 1)))
                if best is None or ang > best[0]: best = (ang, P)
        if best is None or best[0] < 1.5: continue
        P = best[1]
        good, bad = [], []
        for i, k in obs:
            R, tt = cams[i]
            uv, z = project(P[None], R, tt, f, k1, k2)
            (bad if z[0] <= 0 or np.linalg.norm(uv[0] - kps[i][k]) > 4 else good).append(i)
        if len(good) >= 2 and len(good) >= len(obs) - len(bad) and len(good) > len(bad):
            for i in bad: tracks[t].pop(i, None)      # a wrong match in this track: drop just that observation
            X[t] = P; added += 1
    return added

def bundle(fix_first=True, iters=60):
    global intr
    imgs_ = sorted(poses)
    tids = sorted(X)
    ci = {i: n for n, i in enumerate(imgs_)}; pi = {t: n for n, t in enumerate(tids)}
    obs = [(ci[i], pi[t], kps[i][k]) for t in tids for i, k in tracks[t].items() if i in poses]
    nc, npnt, no = len(imgs_), len(tids), len(obs)
    cam_idx = np.array([o[0] for o in obs]); pt_idx = np.array([o[1] for o in obs]); uv = np.array([o[2] for o in obs])
    x0 = np.concatenate([intr, np.concatenate([np.concatenate([poses[i][0].ravel(), poses[i][1]]) for i in imgs_]), np.array([X[t] for t in tids]).ravel()])
    def resid(x):
        f, k1, k2 = (f0, 0.0, 0.0) if FIXK else x[:3]
        cams = x[3:3 + 6 * nc].reshape(nc, 6); pts = x[3 + 6 * nc:].reshape(npnt, 3)
        rv = cams[cam_idx, :3]; tt = cams[cam_idx, 3:]
        th = np.linalg.norm(rv, axis=1, keepdims=True) + 1e-12; kx = rv / th
        P = pts[pt_idx]
        cos, sin = np.cos(th), np.sin(th)
        Pr = P * cos + np.cross(kx, P) * sin + kx * (kx * P).sum(1, keepdims=True) * (1 - cos)
        Pc = Pr + tt
        xn = Pc[:, :2] / Pc[:, 2:3]
        r2 = (xn ** 2).sum(1, keepdims=True)
        xn = xn * (1 + k1 * r2 + k2 * r2 ** 2)
        r = (xn * f + [cx, cy] - uv).ravel()
        # robust: Huber via loss below; gauge: keep first camera fixed softly
        g = (cams[0] - x0[3:9]) * 1e3 if fix_first else np.zeros(6)
        return np.concatenate([r, g])
    A = lil_matrix((2 * no + 6, len(x0)), dtype=int)
    o = np.arange(no)
    for s in range(2):
        if not FIXK: A[2 * o + s, 0:3] = 1
        for c in range(6): A[2 * o + s, 3 + cam_idx * 6 + c] = 1
        for c in range(3): A[2 * o + s, 3 + nc * 6 + pt_idx * 3 + c] = 1
    for c in range(6): A[2 * no + c, 3 + c] = 1
    res = least_squares(resid, x0, jac_sparsity=A, loss='huber', f_scale=2.0, x_scale='jac', max_nfev=iters, method='trf', verbose=0)
    x = res.x
    intr = np.array([f0, 0.0, 0.0]) if FIXK else x[:3].copy()
    cams = x[3:3 + 6 * nc].reshape(nc, 6); pts = x[3 + 6 * nc:].reshape(npnt, 3)
    for n, i in enumerate(imgs_): poses[i] = (cams[n, :3].copy(), cams[n, 3:].copy())
    for n, t in enumerate(tids): X[t] = pts[n].copy()
    # drop observations with large error
    r = res.fun[:2 * no].reshape(no, 2)
    err = np.linalg.norm(r, axis=1)
    bad = set()
    for (c, p, _), e in zip(obs, err):
        if e > 4: bad.add(tids[p])
    for t in bad: X.pop(t, None)
    return np.sqrt(np.mean(err ** 2)), len(bad)

# ── initial pair: many matches and enough parallax ──
cands = sorted(pairs.items(), key=lambda kv: -len(kv[1]))
init = None
for (i, j), mm in cands[:40]:
    p1 = kps[i][mm[:, 0]]; p2 = kps[j][mm[:, 1]]
    E, mask = cv2.findEssentialMat(p1, p2, K0, cv2.RANSAC, 0.999, 1.5)
    if E is None or E.shape != (3, 3): continue
    n, R, t, mask2 = cv2.recoverPose(E, p1, p2, K0, mask=mask)
    inl = mask2.ravel() > 0
    if inl.sum() < 60: continue
    # median triangulation angle
    P1 = K0 @ np.hstack([np.eye(3), np.zeros((3, 1))]); P2 = K0 @ np.hstack([R, t])
    Xh = cv2.triangulatePoints(P1, P2, p1[inl].T, p2[inl].T); Xp = (Xh[:3] / Xh[3]).T
    c2 = (-R.T @ t).ravel()
    a = Xp; b = Xp - c2
    ang = np.degrees(np.arccos(np.clip((a * b).sum(1) / (np.linalg.norm(a, axis=1) * np.linalg.norm(b, axis=1)), -1, 1)))
    med = np.median(ang)
    if med < float(os.environ.get('MINANG', 3)): continue
    init = (i, j, R, t.ravel(), inl.sum(), med); break
if init is None: raise SystemExit('no initial pair')
i, j, R, t, ninl, med = init
log('init pair', i, j, 'inliers', ninl, 'median angle %.1f' % med)
poses[i] = (np.zeros(3), np.zeros(3))
poses[j] = (cv2.Rodrigues(R)[0].ravel(), t)
triangulate(range(len(tracks)))
log('initial points', len(X)); print('BA', bundle(fix_first=True))

# ── register the remaining images one by one, each checked against its best photo partner ──
def pair_pts(a_, b_):
    if (a_, b_) in pairs: m = pairs[(a_, b_)]; return kps[a_][m[:, 0]], kps[b_][m[:, 1]]
    if (b_, a_) in pairs: m = pairs[(b_, a_)]; return kps[a_][m[:, 1]], kps[b_][m[:, 0]]
    return None, None
def Rt(i): return cv2.Rodrigues(poses[i][0])[0], poses[i][1]
def epi_err(c, b_, R_c, t_c):
    pa, pb = pair_pts(c, b_)
    f, k1, k2 = intr
    na = undist_norm(pa, f, k1, k2); nb_ = undist_norm(pb, f, k1, k2)
    R_b, t_b = Rt(b_); R = R_b @ R_c.T; t = t_b - R @ t_c
    E = np.array([[0, -t[2], t[1]], [t[2], 0, -t[0]], [-t[1], t[0], 0]]) @ R
    xa = np.c_[na, np.ones(len(na))]; xb = np.c_[nb_, np.ones(len(nb_))]; Ex = xa @ E.T; Etx = xb @ E
    return np.median(np.sqrt((xb * Ex).sum(1) ** 2 / (Ex[:, 0] ** 2 + Ex[:, 1] ** 2 + Etx[:, 0] ** 2 + Etx[:, 1] ** 2 + 1e-18))) * f
def partners(c):
    out = []
    for b_ in poses:
        pa, _ = pair_pts(c, b_)
        if pa is not None: out.append((len(pa), b_))
    return sorted(out, reverse=True)
def reproj(c, R_c, t_c):
    corr = [(k, t) for k, t in obs_by_img[c].items() if t in X]
    if len(corr) < 3: return None, 0
    f, k1, k2 = intr
    uv, z = project(np.array([X[t] for _, t in corr]), R_c, t_c, f, k1, k2)
    e = np.linalg.norm(uv - kps[c][[k for k, _ in corr]], axis=1); e[z <= 0] = 1e3
    return np.median(e), len(corr)
def try_pnp(c):
    corr = [(k, t) for k, t in obs_by_img[c].items() if t in X]
    if len(corr) < 8: return None
    f, k1, k2 = intr
    p2d = kps[c][[k for k, _ in corr]]; p3d = np.array([X[t] for _, t in corr])
    Kc = np.array([[f, 0, cx], [0, f, cy], [0, 0, 1]])
    ok, rv, tv, inl = cv2.solvePnPRansac(p3d, p2d, Kc, np.array([k1, k2, 0, 0]), iterationsCount=3000, reprojectionError=4.0, confidence=0.999, flags=cv2.SOLVEPNP_EPNP)
    if not ok or inl is None or len(inl) < 6: return None
    rv, tv = cv2.solvePnPRefineLM(p3d[inl.ravel()], p2d[inl.ravel()], Kc, np.array([k1, k2, 0, 0]), rv, tv)
    return cv2.Rodrigues(rv)[0], tv.ravel(), 'pnp %d' % len(inl)
def try_relative(c, b_):
    """Rotation and direction from the pair's essential matrix; distance from the shared 3D points."""
    pa, pb = pair_pts(c, b_)
    f, k1, k2 = intr
    na = undist_norm(pb, f, k1, k2); nc = undist_norm(pa, f, k1, k2)   # b -> c
    E, mask = cv2.findEssentialMat(na, nc, np.eye(3), cv2.RANSAC, 0.999, 1.5 / f)
    if E is None or E.shape != (3, 3): return None
    _, R_rel, t_dir, _ = cv2.recoverPose(E, na, nc, np.eye(3), mask=mask)
    R_b, t_b = Rt(b_); R_c = R_rel @ R_b; t_dir = t_dir.ravel()
    best_ = None
    for sc in np.exp(np.linspace(np.log(1e-3), np.log(1e3), 400)) * np.median(np.abs(list(X.values()))):
        t_c = R_rel @ t_b + sc * t_dir
        e, n = reproj(c, R_c, t_c)
        if e is None: return None
        if best_ is None or e < best_[0]: best_ = (e, t_c)
    return R_c, best_[1], 'relative to %d' % b_
def rot_err(c, b_, R_c):
    # photos from (almost) the same spot: points map through the rotation alone
    pa, pb = pair_pts(c, b_); f, k1, k2 = intr
    na = undist_norm(pa, f, k1, k2); R_b, _ = Rt(b_); R = R_b @ R_c.T
    x = np.c_[na, np.ones(len(na))] @ R.T; x = x[:, :2] / x[:, 2:3]
    return np.median(np.linalg.norm(x - undist_norm(pb, f, k1, k2), axis=1)) * f
def validate(c, R_c, t_c):
    C_c = -R_c.T @ t_c
    depth = np.median([np.linalg.norm(np.array(list(X.values()))[:200] - C_c, axis=1)]) if X else 1
    errs = []
    for n_, b_ in partners(c):
        if n_ < 30: continue
        R_b, t_b = Rt(b_); base = np.linalg.norm(-R_b.T @ t_b - C_c)
        errs.append(epi_err(c, b_, R_c, t_c) if base > 0.03 * depth else rot_err(c, b_, R_c))
    return np.median(errs) if errs else 99
failed = set()
while True:
    cand = []
    for c in range(N):
        if c in poses or c in failed: continue
        p = partners(c)
        if p: cand.append((p[0][0], c, p))
    if not cand: break
    cand.sort(reverse=True)
    _, c, p = cand[0]
    b_ = p[0][1]
    done = None; why = []
    for attempt in (lambda: try_pnp(c), lambda: try_relative(c, b_)):
        r = attempt()
        if r is None: why.append('none'); continue
        R_c, t_c, how = r
        ee = validate(c, R_c, t_c); re_, nre = reproj(c, R_c, t_c)
        why.append('%s: epi %.1f reproj %s/%d' % (how, ee, 'na' if re_ is None else '%.1f' % re_, nre))
        if (how.startswith('pnp') and int(how.split()[1]) >= 30 and re_ is not None and re_ < 3 and ee < 8) or (ee < 3 and (re_ is None or re_ < 6)):
            done = (R_c, t_c, how, ee, re_); break
    if done is None:
        failed.add(c); log('could not register', c, '(best partner %d, %d matches)' % (b_, p[0][0]), '; '.join(why)); continue
    R_c, t_c, how, ee, re_ = done
    poses[c] = (cv2.Rodrigues(R_c)[0].ravel(), t_c)
    nnew = triangulate([t for t in obs_by_img[c].values()])
    log('registered', c, how, 'epipolar %.2f px' % ee, 'new points', nnew, 'total cams', len(poses))
    if len(poses) % 3 == 0:
        e, nb = bundle(); log('  BA rms %.2f px, dropped %d' % (e, nb))
    failed.clear()
triangulate(range(len(tracks)))
for _ in range(2):
    e, nb = bundle(iters=100); log('final BA rms %.2f px, dropped %d, points %d' % (e, nb, len(X)))
log('cameras', len(poses), 'of', N, 'intrinsics f=%.1f k1=%.3f k2=%.3f' % tuple(intr))

ids = sorted(poses)
tids = sorted(X)
cols = []
for t in tids:
    i, k = next(iter(tracks[t].items()))
    x, y = kps[i][k].astype(int)
    cols.append(imgs[i][min(y, H - 1), min(x, Wd - 1)][::-1])
np.savez(f'{OUT}/sfm.npz', files=np.array(files), ids=np.array(ids), rvecs=np.array([poses[i][0] for i in ids]), tvecs=np.array([poses[i][1] for i in ids]),
         intr=intr, size=np.array([Wd, H]), pts=np.array([X[t] for t in tids]), cols=np.array(cols, np.uint8),
         nobs=np.array([sum(1 for i in tracks[t] if i in poses) for t in tids]))
log('saved')
