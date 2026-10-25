"""Plane-sweep depth for one reference photo against its neighbours (ZNCC)."""
import numpy as np, cv2
from scipy import ndimage

def load_cams(d, SC, clahe=True, uw=False):
    f, k1, k2 = d['intr']; Wd, H = [int(v) for v in d['size']]
    K = np.array([[f, 0, Wd / 2], [0, f, H / 2], [0, 0, 1.]]); dist = np.array([k1, k2, 0, 0, 0])
    Ks = K.copy(); Ks[:2] *= SC
    w2, h2 = int(Wd * SC), int(H * SC)
    src = d['src_w'] if 'src_w' in d.files else None
    cams = []
    cl = cv2.createCLAHE(2.0, (8, 8))
    for n, i in enumerate(d['ids']):
        im = cv2.imread(str(d['files'][i]))
        im = cv2.resize(im, (Wd, H), interpolation=cv2.INTER_AREA)
        und = cv2.undistort(im, K, dist)
        small = cv2.resize(und, (w2, h2), interpolation=cv2.INTER_AREA) if SC != 1 else und
        if uw: g = uw_restore(small)
        else:
            g = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
            if clahe: g = cl.apply(g)
        R = cv2.Rodrigues(d['rvecs'][n])[0]; t = d['tvecs'][n]
        cams.append(dict(i=int(i), img=und, small=small, g=g.astype(np.float32) / 255, R=R, t=t, C=-R.T @ t, z=R[2] / np.linalg.norm(R[2])))
    return cams, K, Ks, (w2, h2)

def visible(P, c, Ks, wh):
    Pc = P @ c['R'].T + c['t']; z = Pc[:, 2]
    with np.errstate(divide='ignore', invalid='ignore'):
        u = Pc[:, 0] / z * Ks[0, 0] + Ks[0, 2]; v = Pc[:, 1] / z * Ks[1, 1] + Ks[1, 2]
    m = (z > 0) & (u >= 0) & (u < wh[0]) & (v >= 0) & (v < wh[1])
    return m, z, u, v

def neighbours(a, cams, P, Ks, wh, nmax=4, amin=3, amax=40, zpad=0.85):
    ma, za, _, _ = visible(P, a, Ks, wh)
    zm = np.median(za[ma])
    cand = []
    for b in cams:
        if b is a: continue
        ang = np.degrees(np.arccos(np.clip(a['z'] @ b['z'], -1, 1)))
        base = np.linalg.norm(a['C'] - b['C']) / zm
        mb, _, _, _ = visible(P, b, Ks, wh)
        overlap = (ma & mb).sum() / max(ma.sum(), 1)
        if amin < ang < amax and 0.04 < base < 0.8 and overlap > 0.35:
            cand.append((abs(base - 0.2) - 0.3 * overlap, b))
    cand.sort(key=lambda x: x[0])
    return [x[1] for x in cand[:nmax]], np.percentile(za[ma], 1) * zpad, np.percentile(za[ma], 99) * (2 - zpad)

def sweep(a, nb, zlo, zhi, Ks, wh, ND=128, WIN=9, keep=2, cmax=0.4, varmin=3e-4, Kn=None, amb=0.05):
    w2, h2 = wh
    Kinv = np.linalg.inv(Ks); Kn = Ks if Kn is None else Kn
    def stats(g):
        m = cv2.blur(g, (WIN, WIN)); m2 = cv2.blur(g * g, (WIN, WIN)); return m, np.maximum(m2 - m * m, 1e-6)
    inv = np.linspace(1 / zhi, 1 / zlo, ND)
    ga = a['g']; ma, va = stats(ga)
    costs = np.empty((ND, len(nb), h2, w2), np.float32)
    for j, b in enumerate(nb):
        R_rel = b['R'] @ a['R'].T; t_rel = b['t'] - R_rel @ a['t']
        for k, iv in enumerate(inv):
            Hm = Kn @ (R_rel + np.outer(t_rel, [0, 0, 1]) * iv) @ Kinv
            wb = cv2.warpPerspective(b['g'], Hm, (w2, h2), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderValue=-1)
            valid = wb >= 0
            wb = np.where(valid, wb, ga)
            mb, vb = stats(wb)
            zn = (cv2.blur(ga * wb, (WIN, WIN)) - ma * mb) / np.sqrt(va * vb)
            zn[~valid] = -1
            costs[k, j] = 1 - zn
    costs.sort(axis=1)
    C = costs[:, :keep].mean(1)
    kbest = C.argmin(0); cmin = np.take_along_axis(C, kbest[None], 0)[0]
    k0 = np.clip(kbest, 1, ND - 2)
    cm = np.take_along_axis(C, (k0 - 1)[None], 0)[0]; cp = np.take_along_axis(C, (k0 + 1)[None], 0)[0]; c0 = np.take_along_axis(C, k0[None], 0)[0]
    den = cm - 2 * c0 + cp
    with np.errstate(divide='ignore', invalid='ignore'):
        off = np.where(den > 1e-6, 0.5 * (cm - cp) / den, 0).clip(-0.5, 0.5)
    D = (1 / (inv[k0] + off * (inv[1] - inv[0]))).astype(np.float32)
    # second-best distinct minimum: reject ambiguous matches (repetitive coral texture)
    # a rival only counts if it is a clearly different depth (>3% away), whatever the plane spacing
    far = np.abs(inv[:, None, None] - inv[kbest][None]) > 0.03 * inv[kbest][None]
    c2 = np.where(far, C, 9).min(0)
    ok = (cmin < cmax) & (va > varmin) & (kbest > 0) & (kbest < ND - 1) & (c2 - cmin > amb)
    D[~ok] = np.nan
    Dmf = ndimage.median_filter(np.nan_to_num(D, nan=0), 5); D[np.abs(D - Dmf) > 0.03 * Dmf] = np.nan
    return D

def score(D, a, P, Ks, wh):
    m, z, u, v = visible(P, a, Ks, wh)
    dd = D[v[m].astype(int), u[m].astype(int)]; ok = np.isfinite(dd)
    if ok.sum() < 20: return 0, 0
    rel = np.abs(dd[ok] - z[m][ok]) / z[m][ok]
    return (rel < 0.02).mean(), ok.mean()

def rot(axis, deg):
    a = np.radians(deg); x, y, z = axis
    K_ = np.array([[0, -z, y], [z, 0, -x], [-y, x, 0]])
    return np.eye(3) + np.sin(a) * K_ + (1 - np.cos(a)) * K_ @ K_

def sweep_multi(a, nb, zlo, zhi, Ks, wh, up_w=None, tilts=30, ND=96, WIN=9, keep=2, cmax=0.4, varmin=3e-4):
    """Plane sweep over several plane orientations: facing the camera, parallel to the seabed,
    and tilted. Each pixel keeps the best (orientation, depth)."""
    w2, h2 = wh
    Kinv = np.linalg.inv(Ks)
    uu, vv = np.meshgrid(np.arange(w2), np.arange(h2))
    rays = np.stack([(uu - Ks[0, 2]) / Ks[0, 0], (vv - Ks[1, 2]) / Ks[1, 1], np.ones_like(uu, float)], -1)
    normals = [np.array([0, 0, 1.0])]
    if tilts:
        for ax_ in ([1, 0, 0], [0, 1, 0]):
            for s in (-1, 1): normals.append(rot(ax_, s * tilts) @ np.array([0, 0, 1.0]))
    if up_w is not None:
        n_g = a['R'] @ up_w
        if n_g[2] < 0: n_g = -n_g
        if n_g[2] > 0.2: normals.append(n_g / np.linalg.norm(n_g))
    def stats(g):
        m = cv2.blur(g, (WIN, WIN)); m2 = cv2.blur(g * g, (WIN, WIN)); return m, np.maximum(m2 - m * m, 1e-6)
    ga = a['g']; ma, va = stats(ga)
    best_c = np.full((h2, w2), 9, np.float32); best_d = np.full((h2, w2), np.nan, np.float32); second = np.full((h2, w2), 9, np.float32)
    inv = np.linspace(1 / zhi, 1 / zlo, ND)
    for n in normals:
        ndr = rays @ n                       # n · ray per pixel
        costs = np.empty((ND, len(nb), h2, w2), np.float32)
        for j, b in enumerate(nb):
            R_rel = b['R'] @ a['R'].T; t_rel = b['t'] - R_rel @ a['t']
            for k, iv in enumerate(inv):
                dpl = n[2] / iv              # plane through depth 1/iv on the optical axis
                Hm = Ks @ (R_rel + np.outer(t_rel, n) / dpl) @ Kinv
                wb = cv2.warpPerspective(b['g'], Hm, (w2, h2), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderValue=-1)
                valid = wb >= 0
                wb = np.where(valid, wb, ga)
                mb, vb = stats(wb)
                zn = (cv2.blur(ga * wb, (WIN, WIN)) - ma * mb) / np.sqrt(va * vb)
                zn[~valid] = -1
                costs[k, j] = 1 - zn
        costs.sort(axis=1)
        C = costs[:, :keep].mean(1)
        kb = C.argmin(0); cmin = np.take_along_axis(C, kb[None], 0)[0]
        far = np.abs(inv[:, None, None] - inv[kb][None]) > 0.03 * inv[kb][None]
        c2 = np.where(far, C, 9).min(0)
        with np.errstate(divide='ignore', invalid='ignore'):
            dep = (n[2] / inv[kb]) / ndr     # depth along each pixel's ray
        edge = (kb == 0) | (kb == ND - 1) | (ndr < 0.15)
        cmin = np.where(edge, 9, cmin)
        better = cmin < best_c
        second = np.where(better, c2, second)
        best_d = np.where(better, dep, best_d); best_c = np.where(better, cmin, best_c)
    D = best_d.astype(np.float32)
    ok = (best_c < cmax) & (va > varmin) & (second - best_c > 0.03) & (D > zlo) & (D < zhi)
    D[~ok] = np.nan
    Dmf = ndimage.median_filter(np.nan_to_num(D, nan=0), 5); D[np.abs(D - Dmf) > 0.03 * Dmf] = np.nan
    return D

def uw_restore(bgr):
    """Underwater colour restoration (red-channel compensation + grey-world balance), then grey + CLAHE."""
    im = bgr.astype(np.float32) / 255
    b, g, r = im[..., 0], im[..., 1], im[..., 2]
    r = r + 1.0 * (g.mean() - r.mean()) * (1 - r) * g          # put back the red the water absorbed
    b = b + 0.3 * (g.mean() - b.mean()) * (1 - b) * g
    im = np.stack([b, g, r], -1)
    im = im / (im.reshape(-1, 3).mean(0) / im.mean() + 1e-6)    # grey world
    im = np.clip(im, 0, 1)
    lab = cv2.cvtColor((im * 255).astype(np.uint8), cv2.COLOR_BGR2LAB)
    return cv2.createCLAHE(3.0, (8, 8)).apply(lab[..., 0])

def cost_volume(a, nb, inv, Ks, wh, WIN=7, keep=2, Kn=None):
    w2, h2 = wh
    Kinv = np.linalg.inv(Ks); Kn = Ks if Kn is None else Kn
    def stats(g):
        m = cv2.blur(g, (WIN, WIN)); m2 = cv2.blur(g * g, (WIN, WIN)); return m, np.maximum(m2 - m * m, 1e-6)
    ga = a['g']; ma, va = stats(ga)
    ND = len(inv)
    costs = np.empty((ND, len(nb), h2, w2), np.float32)
    for j, b in enumerate(nb):
        R_rel = b['R'] @ a['R'].T; t_rel = b['t'] - R_rel @ a['t']
        for k, iv in enumerate(inv):
            Hm = Kn @ (R_rel + np.outer(t_rel, [0, 0, 1]) * iv) @ Kinv
            wb = cv2.warpPerspective(b['g'], Hm, (w2, h2), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderValue=-1)
            valid = wb >= 0
            wb = np.where(valid, wb, ga)
            mb, vb = stats(wb)
            zn = (cv2.blur(ga * wb, (WIN, WIN)) - ma * mb) / np.sqrt(va * vb)
            zn[~valid] = -1
            costs[k, j] = 1 - zn
    costs.sort(axis=1)
    return costs[:, :keep].mean(1), va

def sgm(C, P1=0.08, P2=0.5, dirs=8):
    """Semi-global aggregation of a cost volume C[ND, H, W] along 4 or 8 directions."""
    ND, H_, W_ = C.shape
    S = np.zeros_like(C)
    def scan(Cv):           # aggregate along axis 2 (left to right) of Cv[ND, rows, cols]
        L = np.empty_like(Cv); L[:, :, 0] = Cv[:, :, 0]
        for x in range(1, Cv.shape[2]):
            prev = L[:, :, x - 1]; pmin = prev.min(0)
            up = np.empty_like(prev); up[1:] = prev[:-1]; up[0] = np.inf
            dn = np.empty_like(prev); dn[:-1] = prev[1:]; dn[-1] = np.inf
            L[:, :, x] = Cv[:, :, x] + np.minimum(np.minimum(prev, np.minimum(up, dn) + P1), pmin + P2) - pmin
        return L
    S += scan(C); S += scan(C[:, :, ::-1])[:, :, ::-1]
    Ct = C.transpose(0, 2, 1)
    S += scan(Ct).transpose(0, 2, 1); S += scan(Ct[:, :, ::-1])[:, :, ::-1].transpose(0, 2, 1)
    if dirs == 8:
        # diagonals: shear the volume so a diagonal becomes a row
        for sgn in (1, -1):
            sh = np.zeros((ND, H_, W_ + H_), C.dtype) + 2.0
            for y in range(H_):
                o = y if sgn > 0 else H_ - 1 - y
                sh[:, y, o:o + W_] = C[:, y]
            for flip in (False, True):
                Lsh = scan(sh[:, :, ::-1])[:, :, ::-1] if flip else scan(sh)
                for y in range(H_):
                    o = y if sgn > 0 else H_ - 1 - y
                    S[:, y] += Lsh[:, y, o:o + W_]
    return S

def sweep_sgm(a, nb, zlo, zhi, Ks, wh, ND=96, WIN=7, keep=2, P1=0.08, P2=0.5, dirs=4, umax=0.6, varmin=2e-4, Kn=None):
    inv = np.linspace(1 / zhi, 1 / zlo, ND)
    C, va = cost_volume(a, nb, inv, Ks, wh, WIN=WIN, keep=keep, Kn=Kn)
    C = np.nan_to_num(C, nan=2.0)
    S = sgm(C, P1, P2, dirs)
    kb = S.argmin(0)
    k0 = np.clip(kb, 1, ND - 2)
    cm = np.take_along_axis(S, (k0 - 1)[None], 0)[0]; cp = np.take_along_axis(S, (k0 + 1)[None], 0)[0]; c0 = np.take_along_axis(S, k0[None], 0)[0]
    den = cm - 2 * c0 + cp
    with np.errstate(divide='ignore', invalid='ignore'):
        off = np.where(den > 1e-6, 0.5 * (cm - cp) / den, 0).clip(-0.5, 0.5)
    D = (1 / (inv[k0] + off * (inv[1] - inv[0]))).astype(np.float32)
    raw = np.take_along_axis(C, kb[None], 0)[0]           # the photo-consistency at the chosen depth
    ok = (raw < umax) & (va > varmin) & (kb > 0) & (kb < ND - 1)
    D[~ok] = np.nan
    return D
