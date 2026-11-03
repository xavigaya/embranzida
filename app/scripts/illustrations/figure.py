"""
Embranzida · motor d'il·lustracions d'exercicis
Figura vista de costat construïda per cinemàtica directa a partir dels angles de les
articulacions. Estil: cos gris clar amb volum, pantalons foscos, material gris fosc,
fons blanc i els músculs treballats en vermell.

Convencions (coordenades de pantalla, y cap avall, la figura mira cap a +x):
  · extremitats: angle des de la vertical cap avall; positiu = cap endavant (90 = horitzontal endavant, 180 = amunt)
  · tronc: angle des de la vertical cap amunt; positiu = inclinat endavant (−90 = estirat d'esquena, cap a l'esquerra)
"""
from math import sin, cos, radians, hypot

L = dict(shin=44, thigh=47, torso=56, neck=7, uarm=31, farm=28, foot=16, head=10.5)
W = dict(thigh=(10.5, 7), shin=(7.5, 4.6), uarm=(6.2, 4.8), farm=(5, 3.6))
SKIN, SKIN_FAR, LINE, SHORTS, SHORTS_FAR = '#e7e9ed', '#c9cdd4', '#7b818c', '#3b4049', '#2a2e35'
RED, RED_FAR = '#e2453d', '#b9342e'
EQUIP, EQUIP_DARK, EQUIP_LIGHT = '#2b2f36', '#1c1f24', '#9aa1ab'

def v(a, length):  # extremitat
    r = radians(a); return (sin(r) * length, cos(r) * length)
def vt(t, length):  # tronc
    r = radians(t); return (sin(r) * length, -cos(r) * length)
def add(p, q, k=1): return (p[0] + q[0] * k, p[1] + q[1] * k)
def lerp(p, q, k): return (p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k)
def unit(p, q):
    d = hypot(q[0] - p[0], q[1] - p[1]) or 1; return ((q[0] - p[0]) / d, (q[1] - p[1]) / d)

DEFAULT = dict(hip=(0, 0), torso=0, head=0, thigh=(0, 0), shin=(0, 0), uarm=(0, 0), farm=(0, 0), foot=(90, 90))

def solve(pose):
    """Calcula les articulacions. Les tuples són (proper, llunyà)."""
    p = {**DEFAULT, **pose}
    J = {}
    J['hip'] = p['hip']
    J['shoulder'] = add(J['hip'], vt(p['torso'], L['torso']))
    J['neck'] = add(J['shoulder'], vt(p['torso'] + p['head'], L['neck']))
    J['headc'] = add(J['neck'], vt(p['torso'] + p['head'], L['head'] + 2))
    for side, k in (('n', 0), ('f', 1)):
        hip = add(J['hip'], (0, 0))
        sh = J['shoulder']
        knee = add(hip, v(p['thigh'][k], L['thigh']))
        ankle = add(knee, v(p['shin'][k], L['shin']))
        toe = add(ankle, v(p['foot'][k], L['foot']))
        elbow = add(sh, v(p['uarm'][k], L['uarm']))
        wrist = add(elbow, v(p['farm'][k], L['farm']))
        J.update({f'knee{side}': knee, f'ankle{side}': ankle, f'toe{side}': toe, f'elbow{side}': elbow, f'wrist{side}': wrist})
        J[f'hand{side}'] = add(wrist, unit(elbow, wrist), 4)
    J['torso_t'] = p['torso']
    return J

def capsule(a, b, ra, rb):
    ux, uy = unit(a, b); nx, ny = -uy, ux
    p1 = (a[0] + nx * ra, a[1] + ny * ra); p2 = (b[0] + nx * rb, b[1] + ny * rb)
    p3 = (b[0] - nx * rb, b[1] - ny * rb); p4 = (a[0] - nx * ra, a[1] - ny * ra)
    f = lambda p: f'{p[0]:.1f},{p[1]:.1f}'
    return f'M{f(p1)} L{f(p2)} A{rb:.1f},{rb:.1f} 0 0 0 {f(p3)} L{f(p4)} A{ra:.1f},{ra:.1f} 0 0 0 {f(p1)} Z'

def front_normal(a, b, limb=True):
    ux, uy = unit(a, b)
    return (uy, -ux) if limb else (-uy, ux)

def ellipse_on(a, b, t0, t1, side, width, off):
    """El·lipse al llarg del segment a→b entre t0 i t1, desplaçada cap al costat (front=+1, back=−1)."""
    n = front_normal(a, b)
    c = add(lerp(a, b, (t0 + t1) / 2), n, side * off)
    ux, uy = unit(a, b)
    from math import atan2, degrees
    ang = degrees(atan2(uy, ux))
    rx = hypot(b[0] - a[0], b[1] - a[1]) * (t1 - t0) / 2
    return f'<ellipse cx="{c[0]:.1f}" cy="{c[1]:.1f}" rx="{rx:.1f}" ry="{width:.1f}" transform="rotate({ang:.1f} {c[0]:.1f} {c[1]:.1f})"/>'

def torso_path(J):
    hip, sh = J['hip'], J['shoulder']
    ux, uy = unit(hip, sh); nx, ny = uy, -ux  # front normal (per al tronc: endavant)
    nx, ny = -nx, -ny
    # perfil: (posició al llarg, ample davant, ample darrere)
    prof = [(-0.08, 9, 13), (0.12, 10, 14), (0.38, 9.5, 10.5), (0.62, 12, 11), (0.82, 14, 12), (1.0, 10, 10), (1.08, 6, 7)]
    length = hypot(sh[0] - hip[0], sh[1] - hip[1])
    front = [(hip[0] + ux * t * length + nx * f, hip[1] + uy * t * length + ny * f) for t, f, _ in prof]
    back = [(hip[0] + ux * t * length - nx * b, hip[1] + uy * t * length - ny * b) for t, _, b in prof]
    pts = front + back[::-1]
    return smooth_closed(pts), (ux, uy), (nx, ny), length

def smooth_closed(pts):
    n = len(pts); s = ''
    for i in range(n):
        p0, p1 = pts[i], pts[(i + 1) % n]
        m = ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
        if i == 0: s += f'M{m[0]:.1f},{m[1]:.1f} '
        else: s += f'Q{p0[0]:.1f},{p0[1]:.1f} {m[0]:.1f},{m[1]:.1f} '
    p0, p1 = pts[0], pts[1]; m = ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
    return s + f'Q{p0[0]:.1f},{p0[1]:.1f} {m[0]:.1f},{m[1]:.1f} Z'

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
    """Conjunt de formes que es fusionen en una sola silueta (contorn exterior únic)."""
    def __init__(self, D, color, red):
        self.D, self.color, self.red, self.shapes, self.muscles = D, color, red, [], []
    def shape(self, d, pts=(), color=None):
        self.shapes.append((d, color)); self.D.pts.extend(pts)
    def muscle(self, d_clip, ellipses):
        if ellipses: self.muscles.append((d_clip, ellipses))
    def flush(self):
        D = self.D
        out = ''.join(f'<path d="{d}" fill="{LINE}" stroke="{LINE}" stroke-width="2.6"/>' for d, _ in self.shapes)
        inner = ''.join(f'<path d="{d}" fill="{c or self.color}"/>' for d, c in self.shapes)
        for d, els in self.muscles:
            cid = D.clip(d)
            inner += f'<g clip-path="url(#{cid})" fill="{self.red}">' + ''.join(els) + '</g>'
        D.add(out + f'<g filter="url(#vol)">{inner}</g>')

def figure(D, J, hl):
    """Dibuixa la figura. hl = conjunt de grups musculars a destacar."""
    def mus(seg):
        m = []
        if seg == 'thigh':
            if 'quads' in hl: m.append((0.36, 0.92, +1, 5.5, 4))
            if 'hams' in hl: m.append((0.36, 0.88, -1, 5, 4))
        if seg == 'shin' and 'calves' in hl: m.append((0.1, 0.55, -1, 4.2, 3))
        if seg == 'uarm':
            if 'biceps' in hl: m.append((0.3, 0.88, +1, 3.6, 2.4))
            if 'triceps' in hl: m.append((0.25, 0.88, -1, 3.6, 2.4))
            if 'delts' in hl: m.append((-0.12, 0.34, 0, 7, 0))
        if seg == 'farm' and 'forearms' in hl: m.append((0.05, 0.6, 0, 4.5, 0))
        return m
    def limb(Ly, a, b, w, seg):
        d = capsule(a, b, w[0], w[1])
        Ly.shape(d, [add(a, (w[0], w[0])), add(a, (-w[0], -w[0])), add(b, (w[1], w[1])), add(b, (-w[1], -w[1]))])
        Ly.muscle(d, [ellipse_on(a, b, *m) for m in mus(seg)])
    def leg(Ly, s, shorts):
        hip, knee, ankle, toe = J['hip'], J['knee' + s], J['ankle' + s], J['toe' + s]
        limb(Ly, knee, ankle, W['shin'], 'shin')
        Ly.shape(capsule(ankle, toe, 4.4, 2.6), [toe, ankle])
        limb(Ly, hip, knee, W['thigh'], 'thigh')
        sd = capsule(hip, lerp(hip, knee, 0.36), W['thigh'][0] + 1, 10)
        Ly.shape(sd, color=shorts)
        if 'glutes' in hl:
            Ly.muscle(sd, [ellipse_on(hip, lerp(hip, knee, 0.36), -0.6, 0.9, -1, 7.5, 6)])
    def arm(Ly, s):
        sh, el, wr, hd = J['shoulder'], J['elbow' + s], J['wrist' + s], J['hand' + s]
        limb(Ly, el, wr, W['farm'], 'farm')
        Ly.shape(capsule(wr, hd, 3.8, 4.4), [hd])
        limb(Ly, sh, el, W['uarm'], 'uarm')
    if not any('id="vol"' in x for x in D.defs): D.defs.append(VOL_FILTER)
    # capa llunyana
    far = Layer(D, SKIN_FAR, RED_FAR); leg(far, 'f', SHORTS_FAR); arm(far, 'f'); far.flush()
    # tronc, coll i cap
    T = Layer(D, SKIN, RED)
    tp, u, n, length = torso_path(J)
    hip = J['hip']
    hc = J['headc']; r = L['head']
    T.shape(capsule(J['shoulder'], J['neck'], 5.4, 4.8))
    T.shape(f'M{hc[0] - r:.1f},{hc[1]:.1f} a{r},{r} 0 1 0 {2 * r},0 a{r},{r} 0 1 0 {-2 * r},0 Z', [add(hc, (11, 11)), add(hc, (-11, -11))])
    T.shape(tp, [J['hip'], J['shoulder']])
    from math import atan2, degrees
    ang = degrees(atan2(u[1], u[0]))
    els = []
    def reg(t0, t1, side, w, off):
        a = add(hip, u, t0 * length); b = add(hip, u, t1 * length)
        c = add(lerp(a, b, 0.5), n, side * off)
        els.append(f'<ellipse cx="{c[0]:.1f}" cy="{c[1]:.1f}" rx="{(t1 - t0) * length / 2:.1f}" ry="{w:.1f}" transform="rotate({ang:.1f} {c[0]:.1f} {c[1]:.1f})"/>')
    if 'pecs' in hl: reg(0.6, 0.97, +1, 6.5, 9)
    if 'abs' in hl: reg(0.12, 0.62, +1, 4.5, 7.5)
    if 'obliques' in hl: reg(0.15, 0.6, 0, 5, 2)
    if 'lats' in hl: reg(0.42, 0.9, -1, 6, 6)
    if 'lowback' in hl: reg(0.08, 0.42, -1, 4, 9)
    if 'upperback' in hl: reg(0.76, 1.05, -1, 5, 8)
    T.muscle(tp, els)
    # pantaló (pelvis)
    a = add(hip, u, -0.06 * length); b = add(hip, u, 0.16 * length)
    gl = []
    if 'glutes' in hl:
        c = add(lerp(a, b, 0.4), n, -7)
        gl.append(f'<ellipse cx="{c[0]:.1f}" cy="{c[1]:.1f}" rx="9" ry="7.5" transform="rotate({ang:.1f} {c[0]:.1f} {c[1]:.1f})"/>')
    pel = capsule(a, b, 12.2, 11.5)
    T.shape(pel, color=SHORTS)
    T.muscle(pel, gl)
    T.flush()
    # capa propera
    NL = Layer(D, SKIN, RED); leg(NL, 'n', SHORTS); NL.flush()
    NA = Layer(D, SKIN, RED); arm(NA, 'n'); NA.flush()

# ---------- Material ----------
def plate(D, c, r=24, behind=True):
    D.add(f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="{r}" fill="{EQUIP_DARK}" stroke="#000" stroke-width="1"/>'
          f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="{r * 0.72:.1f}" fill="none" stroke="#3a3f47" stroke-width="2"/>'
          f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="4.5" fill="{EQUIP_LIGHT}" stroke="#555" stroke-width="1"/>', [add(c, (r, r)), add(c, (-r, -r))])
def bar_end(D, c):
    D.add(f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="3.2" fill="{EQUIP_LIGHT}" stroke="#555" stroke-width="1"/>', [c])
def dumbbell(D, c, r=8):
    D.add(f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="{r}" fill="{EQUIP}" stroke="#000" stroke-width="1"/><circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="2.5" fill="{EQUIP_LIGHT}"/>', [add(c, (r, r)), add(c, (-r, -r))])
def kettlebell(D, hand):
    c = add(hand, (0, 12))
    D.add(f'<path d="M{hand[0]-6:.1f},{hand[1]+4:.1f} Q{hand[0]:.1f},{hand[1]-6:.1f} {hand[0]+6:.1f},{hand[1]+4:.1f}" fill="none" stroke="{EQUIP}" stroke-width="3"/>'
          f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="10" fill="{EQUIP}" stroke="#000" stroke-width="1"/>', [add(c, (10, 10)), add(c, (-10, -10))])
def bench(D, x0, x1, top, floor, incline=None):
    legs = ''.join(f'<rect x="{x - 3:.1f}" y="{top + 6:.1f}" width="6" height="{floor - top - 6:.1f}" fill="#d8dbe0" stroke="{EQUIP_LIGHT}"/>' for x in (x0 + 8, x1 - 8))
    D.add(legs + f'<rect x="{x0:.1f}" y="{top:.1f}" width="{x1 - x0:.1f}" height="8" rx="3" fill="{EQUIP}" />', [(x0, top), (x1, floor)])
def rack(D, x, top, floor, hooks=()):
    s = f'<rect x="{x - 4:.1f}" y="{top:.1f}" width="8" height="{floor - top:.1f}" fill="#eceef1" stroke="{EQUIP_LIGHT}"/>'
    s += ''.join(f'<rect x="{x - 2:.1f}" y="{h:.1f}" width="9" height="3" fill="{EQUIP}"/>' for h in hooks)
    D.add(s, [(x - 4, top), (x + 4, floor)])
def pullup_bar(D, hand, floor, post_dx=-48):
    x, y = hand[0] + post_dx, hand[1] - 1
    D.add(f'<rect x="{x - 3:.1f}" y="{y - 3:.1f}" width="6" height="{floor - y + 3:.1f}" fill="#eceef1" stroke="{EQUIP_LIGHT}"/>'
          f'<rect x="{min(x, hand[0]):.1f}" y="{y - 3:.1f}" width="{abs(hand[0] - x):.1f}" height="5" fill="#eceef1" stroke="{EQUIP_LIGHT}"/>', [(x, y), (x, floor)])
def cable(D, pulley, hand, floor, x_col=None):
    x = x_col if x_col is not None else pulley[0] + 6
    D.add(f'<rect x="{x - 5:.1f}" y="{min(pulley[1], floor - 150) - 6:.1f}" width="10" height="{floor - min(pulley[1], floor - 150) + 6:.1f}" fill="#eceef1" stroke="{EQUIP_LIGHT}"/>'
          f'<line x1="{pulley[0]:.1f}" y1="{pulley[1]:.1f}" x2="{hand[0]:.1f}" y2="{hand[1]:.1f}" stroke="#4b5059" stroke-width="1.6"/>'
          f'<circle cx="{pulley[0]:.1f}" cy="{pulley[1]:.1f}" r="5" fill="{EQUIP}"/>', [pulley, (x, floor)])
def mat(D, x0, x1, floor):
    D.add(f'<rect x="{x0:.1f}" y="{floor - 3:.1f}" width="{x1 - x0:.1f}" height="4" rx="2" fill="#9aa1ab"/>', [(x0, floor - 3), (x1, floor)])
def box(D, x0, x1, top, floor):
    D.add(f'<rect x="{x0:.1f}" y="{top:.1f}" width="{x1 - x0:.1f}" height="{floor - top:.1f}" rx="2" fill="#d8dbe0" stroke="{EQUIP_LIGHT}"/>', [(x0, top), (x1, floor)])
