"""
Embranzida · motor d'il·lustracions d'exercicis
Figura construïda per cinemàtica directa a partir dels angles de les articulacions.
Estil: cos gris clar amb volum, pantalons foscos, material gris fosc, fons blanc i els
músculs treballats en vermell.

Vista lateral (coordenades de pantalla, y cap avall, la figura mira cap a +x):
  · extremitats: angle des de la vertical cap avall; positiu = cap endavant (90 = horitzontal endavant, 180 = amunt)
  · tronc: angle des de la vertical cap amunt; positiu = inclinat endavant (−90 = estirat d'esquena, cap a l'esquerra)
Vista frontal: la figura mira a qui observa; el costat dret (R) queda a l'esquerra de la pantalla.
  · extremitats: angle des de la vertical cap avall; positiu = cap enfora
  · tronc: inclinació lateral; positiu = cap a la dreta de la pantalla
"""
from math import sin, cos, radians, hypot, atan2, degrees, acos

L = dict(shin=44, thigh=47, torso=56, neck=7, uarm=31, farm=28, foot=16, head=10.5)
SKIN, SKIN_FAR, LINE, SHORTS, SHORTS_FAR = '#e7e9ed', '#c9cdd4', '#7b818c', '#3b4049', '#2a2e35'
RED, RED_FAR = '#e2453d', '#b9342e'
EQUIP, EQUIP_DARK, EQUIP_LIGHT, FRAME, FRAME_LINE = '#2b2f36', '#1c1f24', '#9aa1ab', '#eceef1', '#9aa1ab'

# perfils musculats: (posició al llarg del segment, ample davant, ample darrere)
PROF = dict(
    thigh=[(-0.06, 10, 12), (0.22, 12.5, 12.5), (0.55, 11, 10), (0.85, 8, 7.5), (1.0, 6.5, 6.5), (1.07, 4.5, 4.5)],
    shin=[(-0.06, 5.5, 6), (0.22, 5.8, 9.5), (0.5, 4.8, 7), (0.85, 3.6, 4), (1.0, 3.6, 3.6), (1.06, 2.5, 2.5)],
    uarm=[(-0.2, 7, 7), (-0.02, 9, 9), (0.3, 7.2, 7.4), (0.6, 6.6, 6.2), (0.92, 4.6, 4.8), (1.05, 3.6, 3.6)],
    farm=[(-0.06, 4.2, 4.2), (0.22, 6, 5.4), (0.55, 4.6, 4.2), (0.95, 3.2, 3.2), (1.05, 2.6, 2.6)],
)
TORSO = [(-0.08, 10, 14), (0.12, 11, 15), (0.38, 10.5, 12), (0.62, 13.5, 13.5), (0.82, 16.5, 14.5), (1.0, 12, 12.5), (1.08, 7, 8)]

def v(a, length):
    r = radians(a); return (sin(r) * length, cos(r) * length)
def vt(t, length):
    r = radians(t); return (sin(r) * length, -cos(r) * length)
def add(p, q, k=1): return (p[0] + q[0] * k, p[1] + q[1] * k)
def sub(p, q): return (p[0] - q[0], p[1] - q[1])
def lerp(p, q, k): return (p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k)
def dist(p, q): return hypot(q[0] - p[0], q[1] - p[1])
def unit(p, q):
    d = dist(p, q) or 1; return ((q[0] - p[0]) / d, (q[1] - p[1]) / d)
def ang(p, q):
    """Angle d'extremitat (convenció lateral) del segment p→q."""
    return degrees(atan2(q[0] - p[0], q[1] - p[1]))

def ik(a, target, l1, l2, side):
    """Dos segments des de `a` fins a `target`. side: −1 genoll (davant), +1 colze (darrere)."""
    d = min(dist(a, target), l1 + l2 - 0.01)
    base = atan2(target[0] - a[0], target[1] - a[1])
    off = acos(max(-1, min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))))
    best = None
    for s in (1, -1):
        a1 = base + s * off
        mid = (a[0] + sin(a1) * l1, a[1] + cos(a1) * l1)
        cr = (target[0] - a[0]) * (mid[1] - a[1]) - (target[1] - a[1]) * (mid[0] - a[0])
        if (cr > 0) == (side > 0) or best is None:
            best = (degrees(a1), ang(mid, target))
            if (cr > 0) == (side > 0): break
    return best

DEFAULT = dict(hip=(0, 0), torso=0, head=0, thigh=(0, 0), shin=(0, 0), uarm=(0, 0), farm=(0, 0), foot=(90, 90),
               shrug=0, arch=0, hand=None)

def solve(pose):
    p = {**DEFAULT, **pose}
    J = {'hip': p['hip']}
    base_sh = add(J['hip'], vt(p['torso'], L['torso']))
    J['shoulder'] = add(J['hip'], vt(p['torso'], L['torso'] + p['shrug']))
    J['neck'] = add(base_sh, vt(p['torso'] + p['head'], L['neck']))
    J['arch'] = p['arch']
    J['headc'] = add(J['neck'], vt(p['torso'] + p['head'], L['head'] + 2))
    for side, k in (('n', 0), ('f', 1)):
        knee = add(J['hip'], v(p['thigh'][k], L['thigh']))
        ankle = add(knee, v(p['shin'][k], L['shin']))
        toe = add(ankle, v(p['foot'][k], L['foot']))
        elbow = add(J['shoulder'], v(p['uarm'][k], L['uarm']))
        wrist = add(elbow, v(p['farm'][k], L['farm']))
        J.update({f'knee{side}': knee, f'ankle{side}': ankle, f'toe{side}': toe, f'elbow{side}': elbow, f'wrist{side}': wrist})
        J[f'hand{side}'] = add(wrist, v(p['hand'][k], 6) if p['hand'] else unit(elbow, wrist), 1 if p['hand'] else 4.5)
    J['torso_t'] = p['torso']
    return J

def fmt(p): return f'{p[0]:.1f},{p[1]:.1f}'

def capsule(a, b, ra, rb):
    ux, uy = unit(a, b); nx, ny = -uy, ux
    p1 = (a[0] + nx * ra, a[1] + ny * ra); p2 = (b[0] + nx * rb, b[1] + ny * rb)
    p3 = (b[0] - nx * rb, b[1] - ny * rb); p4 = (a[0] - nx * ra, a[1] - ny * ra)
    return f'M{fmt(p1)} L{fmt(p2)} A{rb:.1f},{rb:.1f} 0 0 0 {fmt(p3)} L{fmt(p4)} A{ra:.1f},{ra:.1f} 0 0 0 {fmt(p1)} Z'

def circle_d(c, r):
    return f'M{c[0] - r:.1f},{c[1]:.1f} a{r:.1f},{r:.1f} 0 1 0 {2 * r:.1f},0 a{r:.1f},{r:.1f} 0 1 0 {-2 * r:.1f},0 Z'

def front_normal(a, b):
    ux, uy = unit(a, b); return (uy, -ux)

def smooth_closed(pts):
    n = len(pts); s = ''
    for i in range(n):
        p0, p1 = pts[i], pts[(i + 1) % n]
        m = ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
        s += (f'M{fmt(m)} ' if i == 0 else f'Q{fmt(p0)} {fmt(m)} ')
    p0, p1 = pts[0], pts[1]; m = ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
    return s + f'Q{fmt(p0)} {fmt(m)} Z'

def profile_path(a, b, prof, n=None, scale=1.0, arch=0.0):
    """Silueta suau al llarg de a→b. n = normal 'davant'. arch desplaça el centre (corba la columna)."""
    from math import pi
    ux, uy = unit(a, b); length = dist(a, b)
    nx, ny = n or front_normal(a, b)
    sh = lambda t: arch * sin(pi * max(0, min(1, t)))
    front = [(a[0] + ux * t * length + nx * (f * scale + sh(t)), a[1] + uy * t * length + ny * (f * scale + sh(t))) for t, f, _ in prof]
    back = [(a[0] + ux * t * length - nx * (bk * scale - sh(t)), a[1] + uy * t * length - ny * (bk * scale - sh(t))) for t, _, bk in prof]
    tip = (a[0] + ux * (prof[-1][0] + 0.03) * length, a[1] + uy * (prof[-1][0] + 0.03) * length)
    tail = (a[0] + ux * (prof[0][0] - 0.03) * length, a[1] + uy * (prof[0][0] - 0.03) * length)
    return smooth_closed([tail] + front + [tip] + back[::-1])

def ellipse_on(a, b, t0, t1, side, width, off, n=None):
    nn = n or front_normal(a, b)
    c = add(lerp(a, b, (t0 + t1) / 2), nn, side * off)
    ux, uy = unit(a, b)
    rx = dist(a, b) * (t1 - t0) / 2
    return f'<ellipse cx="{c[0]:.1f}" cy="{c[1]:.1f}" rx="{rx:.1f}" ry="{width:.1f}" transform="rotate({degrees(atan2(uy, ux)):.1f} {c[0]:.1f} {c[1]:.1f})"/>'

class Drawing:
    def __init__(self): self.parts = []; self.defs = []; self.pts = []; self.cid = 0
    def add(self, svg, pts=()): self.parts.append(svg); self.pts.extend(pts)
    def clip(self, path_d):
        self.cid += 1; i = f'c{self.cid}'
        self.defs.append(f'<clipPath id="{i}"><path d="{path_d}"/></clipPath>'); return i

VOL_FILTER = ('<filter id="vol" x="-10%" y="-10%" width="120%" height="120%">'
              '<feGaussianBlur in="SourceAlpha" stdDeviation="3.2"/><feOffset dx="2.2" dy="2.6" result="o"/>'
              '<feComposite in="SourceAlpha" in2="o" operator="out" result="edge"/>'
              '<feFlood flood-color="#5d636e" flood-opacity="0.38"/><feComposite in2="edge" operator="in" result="sh"/>'
              '<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="sh"/></feMerge></filter>')

class Layer:
    """Conjunt de formes fusionades en una sola silueta amb un únic contorn exterior."""
    def __init__(self, D, color, red):
        self.D, self.color, self.red, self.shapes, self.muscles = D, color, red, [], []
    def shape(self, d, pts=(), color=None):
        self.shapes.append((d, color)); self.D.pts.extend(pts)
    def muscle(self, d_clip, ellipses):
        if ellipses: self.muscles.append((d_clip, ellipses))
    def flush(self):
        D = self.D
        if not any('id="vol"' in x for x in D.defs): D.defs.append(VOL_FILTER)
        out = ''.join(f'<path d="{d}" fill="{LINE}" stroke="{LINE}" stroke-width="2.6"/>' for d, _ in self.shapes)
        inner = ''.join(f'<path d="{d}" fill="{c or self.color}"/>' for d, c in self.shapes)
        for d, els in self.muscles:
            cid = D.clip(d)
            inner += f'<g clip-path="url(#{cid})" fill="{self.red}">' + ''.join(els) + '</g>'
        D.add(out + f'<g filter="url(#vol)">{inner}</g>')

def bbox_pts(a, b, r):
    return [add(a, (r, r)), add(a, (-r, -r)), add(b, (r, r)), add(b, (-r, -r))]

# ====================== Vista lateral ======================
def figure(D, J, hl, far_hidden=False):
    def mus(seg):
        m = []
        if seg == 'thigh':
            if 'quads' in hl: m.append((0.36, 0.92, +1, 6.5, 4.5))
            if 'hams' in hl: m.append((0.36, 0.9, -1, 6, 4.5))
        if seg == 'shin' and 'calves' in hl: m.append((0.08, 0.6, -1, 5.5, 4.5))
        if seg == 'uarm':
            if 'biceps' in hl: m.append((0.25, 0.88, +1, 4.4, 3.2))
            if 'triceps' in hl: m.append((0.2, 0.88, -1, 4.4, 3.2))
            if 'delts' in hl: m.append((-0.2, 0.36, 0, 9, 0))
        if seg == 'farm' and 'forearms' in hl: m.append((0.0, 0.6, 0, 5.5, 0))
        return m
    def limb(Ly, a, b, seg):
        d = profile_path(a, b, PROF[seg])
        Ly.shape(d, bbox_pts(a, b, 9))
        Ly.muscle(d, [ellipse_on(a, b, *m) for m in mus(seg)])
    def leg(Ly, s, shorts):
        hip, knee, ankle, toe = J['hip'], J['knee' + s], J['ankle' + s], J['toe' + s]
        limb(Ly, knee, ankle, 'shin')
        Ly.shape(capsule(ankle, toe, 4.6, 2.8), [toe, ankle])
        limb(Ly, hip, knee, 'thigh')
        end = lerp(hip, knee, 0.36)
        sd = capsule(hip, end, 13, 11.5)
        Ly.shape(sd, color=shorts)
        if 'glutes' in hl:
            Ly.muscle(sd, [ellipse_on(hip, end, -0.6, 0.9, -1, 8.5, 7)])
    def arm(Ly, s):
        sh, el, wr, hd = J['shoulder'], J['elbow' + s], J['wrist' + s], J['hand' + s]
        limb(Ly, el, wr, 'farm')
        Ly.shape(capsule(wr, hd, 3.8, 4.6), [hd])
        limb(Ly, sh, el, 'uarm')
    if not far_hidden:
        far = Layer(D, SKIN_FAR, RED_FAR); leg(far, 'f', SHORTS_FAR); arm(far, 'f'); far.flush()
    T = Layer(D, SKIN, RED)
    hip, sh = J['hip'], J['shoulder']
    u = unit(hip, sh); n = (-u[1], u[0])
    n = (-n[0], -n[1]) if (n[0] * cos(radians(J['torso_t'])) + n[1] * sin(radians(J['torso_t']))) < 0 else n
    length = L['torso']
    tp = profile_path(hip, sh, TORSO, n=n, arch=J.get('arch', 0))
    hc = J['headc']; r = L['head']
    T.shape(capsule(sh, J['neck'], 6.2, 5.2))
    T.shape(circle_d(hc, r), [add(hc, (11, 11)), add(hc, (-11, -11))])
    T.shape(tp, bbox_pts(hip, sh, 14))
    ang_u = degrees(atan2(u[1], u[0]))
    els = []
    def reg(t0, t1, side, w, off):
        a = add(hip, u, t0 * length); b = add(hip, u, t1 * length)
        from math import pi
        tm = (t0 + t1) / 2
        c = add(lerp(a, b, 0.5), n, side * off + J.get('arch', 0) * sin(pi * max(0, min(1, tm))))
        els.append(f'<ellipse cx="{c[0]:.1f}" cy="{c[1]:.1f}" rx="{(t1 - t0) * length / 2:.1f}" ry="{w:.1f}" transform="rotate({ang_u:.1f} {c[0]:.1f} {c[1]:.1f})"/>')
    if 'pecs' in hl: reg(0.6, 0.98, +1, 7.5, 11)
    if 'abs' in hl: reg(0.1, 0.62, +1, 5, 9)
    if 'obliques' in hl: reg(0.12, 0.6, 0, 5.5, 3)
    if 'lats' in hl: reg(0.4, 0.92, -1, 7, 7)
    if 'lowback' in hl: reg(0.06, 0.42, -1, 4.5, 11)
    if 'upperback' in hl: reg(0.74, 1.08, -1, 6, 10)
    T.muscle(tp, els)
    a = add(hip, u, -0.06 * length); b = add(hip, u, 0.16 * length)
    pel = capsule(a, b, 13.5, 12.5)
    T.shape(pel, color=SHORTS)
    if 'glutes' in hl:
        c = add(lerp(a, b, 0.4), n, -8)
        T.muscle(pel, [f'<ellipse cx="{c[0]:.1f}" cy="{c[1]:.1f}" rx="10" ry="8.5" transform="rotate({ang_u:.1f} {c[0]:.1f} {c[1]:.1f})"/>'])
    T.flush()
    NL = Layer(D, SKIN, RED); leg(NL, 'n', SHORTS); NL.flush()
    NA = Layer(D, SKIN, RED); arm(NA, 'n'); NA.flush()

# ====================== Vista frontal ======================
FDEFAULT = dict(hip=(0, 0), bend=0, head=0, hdy=0, tscale=1.0, lscale=(1.0, 1.0), sscale=(1.0, 1.0),
                thigh=(4, 4), shin=(0, 0), uarm=(8, 8), farm=(4, 4), foot=(0, 0))  # tuples: (R, L)

def fvec(s, a, length):  # s: −1 dreta (pantalla esquerra), +1 esquerra
    r = radians(a); return (s * sin(r) * length, cos(r) * length)

def fsolve(pose):
    p = {**FDEFAULT, **pose}
    J = {'hip': p['hip'], 'bend': p['bend']}
    up = vt(p['bend'], 1)
    side = (-up[1], up[0])  # perpendicular cap a la dreta de la pantalla
    side = (-side[0], -side[1]) if side[0] < 0 or (side[0] == 0 and side[1] < 0) else side
    J['shoulder_c'] = add(J['hip'], up, L['torso'] * p['tscale'])
    J['tscale'] = p['tscale']
    J['neck'] = add(J['shoulder_c'], vt(p['bend'] + p['head'], 1), L['neck'])
    J['headc'] = add(J['neck'], vt(p['bend'] + p['head'], 1), L['head'] + 3)
    J['up'], J['side'] = up, side
    J['headc'] = add(J['headc'], up, -p['hdy']); J['neck'] = add(J['neck'], up, -p['hdy'] * 0.6)
    for nm, s, k in (('R', -1, 0), ('L', 1, 1)):
        hip = add(J['hip'], side, s * 9.5)
        sh = add(J['shoulder_c'], side, s * 17)
        knee = add(hip, fvec(s, p['thigh'][k], L['thigh'] * p['lscale'][k]))
        ankle = add(knee, fvec(s, p['shin'][k], L['shin'] * p['sscale'][k]))
        elbow = add(sh, fvec(s, p['uarm'][k], L['uarm']))
        wrist = add(elbow, fvec(s, p['farm'][k], L['farm']))
        J.update({f'hip{nm}': hip, f'sh{nm}': sh, f'knee{nm}': knee, f'ankle{nm}': ankle, f'elbow{nm}': elbow, f'wrist{nm}': wrist,
                  f'hand{nm}': add(wrist, unit(elbow, wrist), 4.5), f'foot{nm}': p['foot'][k]})
    return J

FTORSO = [(-0.1, 14), (0.1, 14.5), (0.35, 12.5), (0.6, 15), (0.8, 18.5), (0.95, 20), (1.04, 16), (1.1, 8)]
FPROF = dict(
    thigh=[(-0.06, 8.5, 8.5), (0.2, 10.5, 9), (0.55, 9, 8), (0.88, 6.5, 6.5), (1.02, 6, 6), (1.07, 4.5, 4.5)],
    shin=[(-0.06, 5.5, 5.5), (0.22, 7, 6.5), (0.5, 5.5, 5), (0.88, 3.6, 3.4), (1.02, 3.6, 3.6), (1.06, 2.5, 2.5)],
    uarm=[(-0.2, 6, 6), (-0.02, 9.5, 6), (0.3, 7, 6.6), (0.6, 6.2, 6), (0.92, 4.6, 4.6), (1.05, 3.6, 3.6)],
    farm=[(-0.06, 4.2, 4.2), (0.22, 5.6, 5.4), (0.55, 4.6, 4.2), (0.95, 3.2, 3.2), (1.05, 2.6, 2.6)],
)

def ffigure(D, J, hl):
    """Figura de cara. Els perfils posen el costat 'davant' cap enfora."""
    def outward(s, a, b):
        n = front_normal(a, b); c = cross_side = n[0] * J['side'][0] + n[1] * J['side'][1]
        return n if (c * s) >= 0 else (-n[0], -n[1])
    def limb(Ly, s, a, b, seg, mus):
        n = outward(s, a, b)
        d = profile_path(a, b, FPROF[seg], n=n)
        Ly.shape(d, bbox_pts(a, b, 9))
        Ly.muscle(d, [ellipse_on(a, b, *m, n=n) for m in mus])
    def leg(Ly, nm, s):
        hip, knee, ankle = J['hip' + nm], J['knee' + nm], J['ankle' + nm]
        m = []
        if 'calves' in hl: m += [(0.12, 0.55, +1, 3.5, 3.5), (0.12, 0.5, -1, 3, 3.5)]
        limb(Ly, s, knee, ankle, 'shin', m)
        fa = J['foot' + nm]
        toe = add(ankle, fvec(s, 90, 1), 0)
        foot_end = add(ankle, (s * (6 + 4 * sin(radians(fa))), 4))
        Ly.shape(capsule(add(ankle, (0, 1)), foot_end, 4.5, 3.5), [foot_end, ankle])
        m = []
        if 'quads' in hl: m.append((0.3, 0.9, 0, 6, 0))
        if 'adductors' in hl: m.append((0.12, 0.6, -1, 4.5, 5))
        limb(Ly, s, hip, knee, 'thigh', m)
        sd = capsule(hip, lerp(hip, knee, 0.32), 11, 10.5)
        Ly.shape(sd, color=SHORTS)
    def arm(Ly, nm, s):
        sh, el, wr, hd = J['sh' + nm], J['elbow' + nm], J['wrist' + nm], J['hand' + nm]
        m = []
        if 'forearms' in hl: m.append((0.0, 0.6, 0, 5, 0))
        limb(Ly, s, el, wr, 'farm', m)
        Ly.shape(capsule(wr, hd, 3.8, 4.6), [hd])
        m = []
        if 'biceps' in hl: m.append((0.28, 0.88, -0.3, 4, 1.5))
        if 'triceps' in hl: m.append((0.25, 0.88, +1, 3.5, 4))
        if 'delts' in hl: m.append((-0.2, 0.36, +0.4, 8.5, 2))
        limb(Ly, s, sh, el, 'uarm', m)
    LG = Layer(D, SKIN, RED); leg(LG, 'R', -1); leg(LG, 'L', 1); LG.flush()
    T = Layer(D, SKIN, RED)
    hip, up, side = J['hip'], J['up'], J['side']
    sc = J['shoulder_c']
    TL = L['torso'] * J['tscale']
    pts = [add(add(hip, up, t * TL), side, w) for t, w in FTORSO] + \
          [add(add(hip, up, t * TL), side, -w) for t, w in FTORSO[::-1]]
    tp = smooth_closed(pts)
    hc = J['headc']
    T.shape(capsule(sc, J['neck'], 7, 6))
    T.shape(f'<ellipse/>' if False else circle_d(hc, L['head'] + 0.5), [add(hc, (12, 12)), add(hc, (-12, -12))])
    T.shape(tp, [add(hip, side, 22), add(hip, side, -22), add(sc, side, 22), add(sc, side, -22)])
    ang_u = degrees(atan2(up[1], up[0]))
    els = []
    def reg(t0, t1, off, w):
        c = add(add(hip, up, (t0 + t1) / 2 * TL), side, off)
        els.append(f'<ellipse cx="{c[0]:.1f}" cy="{c[1]:.1f}" rx="{(t1 - t0) * TL / 2:.1f}" ry="{w:.1f}" transform="rotate({ang_u:.1f} {c[0]:.1f} {c[1]:.1f})"/>')
    if 'pecs' in hl: reg(0.66, 0.94, -8.5, 7.5); reg(0.66, 0.94, 8.5, 7.5)
    if 'abs' in hl: reg(0.1, 0.62, 0, 6)
    if 'obliques' in hl: reg(0.14, 0.58, -11, 4); reg(0.14, 0.58, 11, 4)
    if 'lats' in hl: reg(0.45, 0.82, -15.5, 3.5); reg(0.45, 0.82, 15.5, 3.5)
    if 'upperback' in hl: reg(0.95, 1.08, -9, 5); reg(0.95, 1.08, 9, 5)
    T.muscle(tp, els)
    pel = smooth_closed([add(add(hip, up, t * L['torso']), side, w) for t, w in ((-0.18, 12), (-0.05, 17), (0.16, 15))] +
                        [add(add(hip, up, t * L['torso']), side, -w) for t, w in ((0.16, 15), (-0.05, 17), (-0.18, 12))])
    T.shape(pel, color=SHORTS)
    if 'glutes' in hl:
        g = []
        for s in (-1, 1):
            c = add(add(hip, up, 0.04 * L['torso']), side, s * 15)
            g.append(f'<ellipse cx="{c[0]:.1f}" cy="{c[1]:.1f}" rx="6" ry="4.5" transform="rotate({ang_u:.1f} {c[0]:.1f} {c[1]:.1f})"/>')
        T.muscle(pel, g)
    T.flush()
    AR = Layer(D, SKIN, RED); arm(AR, 'R', -1); arm(AR, 'L', 1); AR.flush()

# ====================== Material ======================
def plate(D, c, r=19):
    D.add(f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="{r}" fill="{EQUIP_DARK}" stroke="#000" stroke-width="1"/>'
          f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="{r * 0.72:.1f}" fill="none" stroke="#3a3f47" stroke-width="2"/>'
          f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="3.6" fill="{EQUIP_LIGHT}" stroke="#555" stroke-width="1"/>', [add(c, (r, r)), add(c, (-r, -r))])
def bar_end(D, c):
    D.add(f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="3.2" fill="{EQUIP_LIGHT}" stroke="#555" stroke-width="1"/>', [c])
def barbell(D, c, r=19): plate(D, c, r)
def dumbbell(D, c, r=7.5):
    D.add(f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="{r}" fill="{EQUIP}" stroke="#000" stroke-width="1"/><circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="2.3" fill="{EQUIP_LIGHT}"/>', [add(c, (r, r)), add(c, (-r, -r))])
def dumbbell_h(D, c, rot=0, w=26):
    """Manuella vista de llarg (vista frontal o de dalt)."""
    D.add(f'<g transform="rotate({rot:.1f} {c[0]:.1f} {c[1]:.1f})">'
          f'<rect x="{c[0] - w / 2:.1f}" y="{c[1] - 1.6:.1f}" width="{w}" height="3.2" fill="{EQUIP_LIGHT}"/>'
          f'<rect x="{c[0] - w / 2 - 3:.1f}" y="{c[1] - 7:.1f}" width="7" height="14" rx="2" fill="{EQUIP}"/>'
          f'<rect x="{c[0] + w / 2 - 4:.1f}" y="{c[1] - 7:.1f}" width="7" height="14" rx="2" fill="{EQUIP}"/></g>',
          [add(c, (w / 2 + 4, 8)), add(c, (-w / 2 - 4, -8))])
def kettlebell(D, hand, off=(0, 13), r=10):
    c = add(hand, off); m = lerp(hand, c, 0.42)
    D.add(f'<circle cx="{m[0]:.1f}" cy="{m[1]:.1f}" r="6" fill="none" stroke="{EQUIP}" stroke-width="3.2"/>'
          f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="{r}" fill="{EQUIP}" stroke="#000" stroke-width="1"/>', [add(c, (r, r)), add(c, (-r, -r))])
def bench(D, x0, x1, top, floor=0):
    legs = ''.join(f'<rect x="{x - 3:.1f}" y="{top + 6:.1f}" width="6" height="{floor - top - 6:.1f}" fill="#d8dbe0" stroke="{EQUIP_LIGHT}"/>' for x in (x0 + 8, x1 - 8))
    D.add(legs + f'<rect x="{x0:.1f}" y="{top:.1f}" width="{x1 - x0:.1f}" height="8" rx="3" fill="{EQUIP}"/>', [(x0, top), (x1, floor)])
def pad(D, a, b, th=8):
    """Coixí/respatller entre a i b (gruix th) cap a la dreta del segment."""
    ux, uy = unit(a, b); n = (-uy, ux)
    pts = [a, b, add(b, n, th), add(a, n, th)]
    D.add(f'<path d="M{fmt(pts[0])} L{fmt(pts[1])} L{fmt(pts[2])} L{fmt(pts[3])} Z" fill="{EQUIP}" stroke="{EQUIP}" stroke-width="4" stroke-linejoin="round"/>', pts)
def post(D, x, top, floor=0, w=7):
    D.add(f'<rect x="{x - w / 2:.1f}" y="{top:.1f}" width="{w}" height="{floor - top:.1f}" fill="{FRAME}" stroke="{FRAME_LINE}"/>', [(x - w / 2, top), (x + w / 2, floor)])
def beam(D, a, b, w=6):
    D.add(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="{FRAME_LINE}" stroke-width="{w + 2}" stroke-linecap="round"/>'
          f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="{FRAME}" stroke-width="{w}" stroke-linecap="round"/>', [a, b])
def rack(D, x, top, hook_y, floor=0):
    post(D, x, top, floor, 8)
    D.add(f'<rect x="{x - 2:.1f}" y="{hook_y:.1f}" width="10" height="3.5" fill="{EQUIP}"/>')
def pullup_bar(D, hand, floor=0, post_dx=-48):
    x, y = hand[0] + post_dx, hand[1] - 1
    post(D, x, y - 3, floor, 6)
    beam(D, (x, y), (hand[0], y), 5)
def cable_col(D, x, floor=0, top=-170):
    post(D, x, top, floor, 12)
def cable(D, pulley, hand, floor=0, x_col=None, top=-170):
    x = pulley[0] if x_col is None else x_col
    cable_col(D, x, floor, min(top, pulley[1] - 8))
    D.add(f'<line x1="{pulley[0]:.1f}" y1="{pulley[1]:.1f}" x2="{hand[0]:.1f}" y2="{hand[1]:.1f}" stroke="#4b5059" stroke-width="1.6"/>'
          f'<circle cx="{pulley[0]:.1f}" cy="{pulley[1]:.1f}" r="5" fill="{EQUIP}"/>', [pulley])
def handle(D, c):
    D.add(f'<rect x="{c[0] - 2.5:.1f}" y="{c[1] - 6:.1f}" width="5" height="12" rx="2" fill="{EQUIP}"/>', [c])
def mat(D, x0, x1, floor=0):
    D.add(f'<rect x="{x0:.1f}" y="{floor - 3:.1f}" width="{x1 - x0:.1f}" height="4" rx="2" fill="#9aa1ab"/>', [(x0, floor - 3), (x1, floor)])
def box(D, x0, x1, top, floor=0):
    D.add(f'<rect x="{x0:.1f}" y="{top:.1f}" width="{x1 - x0:.1f}" height="{floor - top:.1f}" rx="2" fill="#d8dbe0" stroke="{EQUIP_LIGHT}"/>', [(x0, top), (x1, floor)])
def wall(D, x, top=-200, floor=0, w=10):
    D.add(f'<rect x="{x:.1f}" y="{top:.1f}" width="{w}" height="{floor - top:.1f}" fill="#e3e5e9"/><line x1="{x:.1f}" y1="{top:.1f}" x2="{x:.1f}" y2="{floor:.1f}" stroke="{EQUIP_LIGHT}" stroke-width="1.5"/>', [(x, top), (x + w, floor)])
def stick(D, a, b, w=3):
    D.add(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="#8a6a45" stroke-width="{w}" stroke-linecap="round"/>', [a, b])
def strap(D, a, b):
    D.add(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="{RED}" stroke-opacity="0" />'
          f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="#5b8bd0" stroke-width="3" stroke-linecap="round"/>', [a, b])
def wheel(D, c, r=12):
    D.add(f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="{r}" fill="{EQUIP}" stroke="#000"/><circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="3" fill="{EQUIP_LIGHT}"/>', [add(c, (r, r)), add(c, (-r, -r))])
def rope_line(D, pts):
    d = 'M' + ' Q'.join(fmt(p) for p in pts[:1]) + ''.join(f' L{fmt(p)}' for p in pts[1:])
    D.add(f'<path d="{d}" fill="none" stroke="#4b5059" stroke-width="1.8" stroke-linecap="round"/>', pts)
def curve(D, a, ctrl, b, color='#4b5059', w=1.8):
    D.add(f'<path d="M{fmt(a)} Q{fmt(ctrl)} {fmt(b)}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round"/>', [a, b, ctrl])
def poly(D, pts, fill=EQUIP, stroke=None, w=1):
    d = 'M' + ' L'.join(fmt(p) for p in pts) + ' Z'
    D.add(f'<path d="{d}" fill="{fill}" stroke="{stroke or fill}" stroke-width="{w}" stroke-linejoin="round"/>', pts)
def arrow(D, pts, color='#e2453d'):
    """Fletxa de moviment (corba suau)."""
    a, c, b = pts
    D.add(f'<path d="M{fmt(a)} Q{fmt(c)} {fmt(b)}" fill="none" stroke="{color}" stroke-width="1.6" stroke-dasharray="3 3" stroke-linecap="round"/>', [a, b])
