"""Check every registered camera: fresh SIFT matches against its best partner, epipolar error with the saved poses."""
import sys, numpy as np, cv2
key=sys.argv[1]; d=np.load(f'out/{key}/sfm.npz'); f,k1,k2=d['intr']; W,H=[int(v) for v in d['size']]
K=np.array([[f,0,W/2],[0,f,H/2],[0,0,1.]]); dist=np.array([k1,k2,0,0,0])
ids=list(d['ids']); pos={i:n for n,i in enumerate(ids)}
sift=cv2.SIFT_create(6000); feat={}
for i in ids:
    g=cv2.cvtColor(cv2.resize(cv2.imread(str(d['files'][i])),(W,H)),cv2.COLOR_BGR2GRAY); g=cv2.createCLAHE(2.5,(8,8)).apply(g)
    feat[i]=sift.detectAndCompute(g,None)
bf=cv2.BFMatcher()
def pose(i): return cv2.Rodrigues(d['rvecs'][pos[i]])[0], d['tvecs'][pos[i]]
for a in ids:
    best=None
    for b in ids:
        if b==a: continue
        (ka,da),(kb,db)=feat[a],feat[b]
        m=[x for x,y in bf.knnMatch(da,db,k=2) if x.distance<0.75*y.distance]
        if len(m)<20: continue
        pa=np.float32([ka[x.queryIdx].pt for x in m]); pb=np.float32([kb[x.trainIdx].pt for x in m])
        F,mask=cv2.findFundamentalMat(pa,pb,cv2.USAC_MAGSAC,1.5)
        if F is None: continue
        mask=mask.ravel()>0
        if best is None or mask.sum()>best[0]: best=(mask.sum(),b,pa[mask],pb[mask])
    if best is None: print(a,'no partner'); continue
    n,b,pa,pb=best
    na=cv2.undistortPoints(pa.reshape(-1,1,2),K,dist).reshape(-1,2); nb=cv2.undistortPoints(pb.reshape(-1,1,2),K,dist).reshape(-1,2)
    Ra,ta=pose(a);Rb,tb=pose(b); R=Rb@Ra.T; t=tb-R@ta; tx=np.array([[0,-t[2],t[1]],[t[2],0,-t[0]],[-t[1],t[0],0]]); E=tx@R
    xa=np.c_[na,np.ones(len(na))]; xb=np.c_[nb,np.ones(len(nb))]; Ex=xa@E.T; Etx=xb@E
    s=np.sqrt((xb*Ex).sum(1)**2/(Ex[:,0]**2+Ex[:,1]**2+Etx[:,0]**2+Etx[:,1]**2))*f
    print(f'{key} cam {a:2d} partner {b:2d} matches {n:4d} median epipolar error {np.median(s):6.2f} px', 'OK' if np.median(s)<3 else 'BAD')
