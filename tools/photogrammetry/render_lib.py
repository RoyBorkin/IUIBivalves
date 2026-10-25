import numpy as np, cv2
def view(V, F, C, mask, az, el, S=520, tint=False):
    a, e = np.radians(az), np.radians(el)
    Rz = np.array([[np.cos(a), -np.sin(a), 0], [np.sin(a), np.cos(a), 0], [0, 0, 1]])
    Rx = np.array([[1, 0, 0], [0, np.cos(e), -np.sin(e)], [0, np.sin(e), np.cos(e)]])
    P = (V - V.mean(0)) @ (Rx @ Rz).T
    sc = S * 0.45 / np.abs(P[:, [0, 2]]).max()
    img = np.full((S, S, 3), 235, np.uint8)
    tri = P[F]; order = np.argsort(-tri[:, :, 1].mean(1))
    pts = np.stack([S / 2 + tri[:, :, 0] * sc, S / 2 - tri[:, :, 2] * sc], -1).astype(np.int32)
    n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]); n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    shade = 0.6 + 0.4 * np.abs(n[:, 1]); col = C[F].mean(1)
    if tint: col = np.where(mask[F].all(1)[:, None], col * 0.5 + [255, 0, 160], col)
    for i in order: cv2.fillConvexPoly(img, pts[i], (col[i] * shade[i]).clip(0, 255)[::-1].tolist())
    return img
def preview(V, F, C, mask, path):
    row = np.hstack([view(V, F, C, mask, 0, 30), view(V, F, C, mask, 110, 30), view(V, F, C, mask, 0, 80, tint=True)])
    cv2.imwrite(path, row)
