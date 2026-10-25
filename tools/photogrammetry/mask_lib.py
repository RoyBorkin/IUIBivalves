import numpy as np, cv2
def cream_mask(bgr):
    lab = cv2.cvtColor(cv2.GaussianBlur(bgr, (7, 7), 0), cv2.COLOR_BGR2LAB).astype(np.float32)
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    db = b - np.median(b); dL = L - np.median(L)
    sc = max(np.percentile(db, 97), 6)
    m = (db > 0.35 * sc) & (dL > -5) & (a - np.median(a) < db + 4)
    m = m.astype(np.uint8)
    k = max(3, int(min(bgr.shape[:2]) * 0.02)) | 1
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((k, k), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3 * k, 3 * k)))
    from scipy import ndimage
    return ndimage.binary_fill_holes(m).astype(np.uint8)
def target_blob(bgr):
    m = cream_mask(bgr)
    n, lab, st, cen = cv2.connectedComponentsWithStats(m)
    h, w = m.shape; best = None
    for i in range(1, n):
        area = st[i, 4]
        if area < 0.004 * h * w: continue
        d = np.hypot((cen[i, 0] - w / 2) / w, (cen[i, 1] - h / 2) / h)
        sc = np.sqrt(area / (h * w)) / (0.15 + d)
        if best is None or sc > best[0]: best = (sc, i)
    if best is None: return None
    return (lab == best[1]).astype(np.uint8)
