"""Genera les il·lustracions (2 fotogrames) de tots els exercicis amb l'estil propi d'Embranzida.
Ús: python3 render.py <carpeta_sortida> [n ...]
"""
import json, sys, os
from math import sin, cos, radians, atan2, degrees
from figure import *

HERE = os.path.dirname(os.path.abspath(__file__))
EXS = {e['n']: e for e in json.load(open(os.path.join(HERE, '../../src/data/exercises.json')))}

MUSCLE_MAP = [
    ('quàdriceps', 'quads'), ('glut', 'glutes'), ('isquio', 'hams'), ('pectoral', 'pecs'),
    ('tríceps', 'triceps'), ('deltoide', 'delts'), ('espatll', 'delts'), ('dorsal', 'lats'),
    ('romboid', 'upperback'), ('trapezi', 'upperback'), ('esquena alta', 'upperback'), ('bíceps', 'biceps'),
    ('abdominal', 'abs'), ('core', 'abs'), ('oblic', 'obliques'), ('lumbar', 'lowback'),
    ('bessons', 'calves'), ('soli', 'calves'), ('panxell', 'calves'), ('avantbra', 'forearms'), ('adductor', 'adductors'),
    ('psoes', 'quads'), ('cames', 'quads'), ('cames', 'calves'),
]
def regions(n):
    out = set()
    for m in EXS[n]['muscles']:
        ml = m.lower()
        if ml == 'esquena': out |= {'upperback', 'lowback'}
        for k, r in MUSCLE_MAP:
            if k in ml: out.add(r)
    return out

# ---------------- utilitats ----------------
class Fr:
    def __init__(self, view, pose, back=None, front=None, rot=0, floor=True, hl=None, lift=None):
        self.view, self.pose, self.back, self.front, self.rot, self.floor, self.hl = view, pose, back, front, rot, floor, hl
        self.J = solve(pose) if view == 'side' else fsolve(pose)

def setk(p, key, i, val):
    t = list(p.get(key, DEFAULT.get(key, (0, 0)))); t[i] = val; p[key] = tuple(t); return p

SIDE_CONTACTS = [('toen', 2.8), ('toef', 2.8), ('anklen', 4.6), ('anklef', 4.6), ('kneen', 7.5), ('kneef', 7.5),
                 ('handn', 4.6), ('handf', 4.6), ('elbown', 5.5), ('elbowf', 5.5), ('hip', 13), ('shoulder', 13), ('headc', 10.5)]
def ground(p, anchor='anklen', x=0, lift=0, contacts=None):
    p = dict(p); p.setdefault('hip', (0, 0))
    J = solve(p)
    cs = contacts or SIDE_CONTACTS
    low = max(J[j][1] + r for j, r in cs)
    dx = (x - J[anchor][0]) if anchor else 0
    p['hip'] = (p['hip'][0] + dx, p['hip'][1] - low - lift)
    return p

def place(p, joint, target):
    p = dict(p); p.setdefault('hip', (0, 0))
    J = solve(p); q = J[joint]
    p['hip'] = (p['hip'][0] + target[0] - q[0], p['hip'][1] + target[1] - q[1]); return p

def arm_to(p, i, target):
    J = solve(p); a1, a2 = ik(J['shoulder'], target, L['uarm'], L['farm'] + 4.5, +1)
    setk(p, 'uarm', i, a1); setk(p, 'farm', i, a2); return p
def arms_to(p, tn, tf=None):
    arm_to(p, 0, tn); arm_to(p, 1, tf or add(tn, (-2, 0))); return p
def leg_to(p, i, target):
    J = solve(p); a1, a2 = ik(J['hip'], target, L['thigh'], L['shin'], -1)
    setk(p, 'thigh', i, a1); setk(p, 'shin', i, a2); return p

def straight_body(p, ankle, t, leg_len=None):
    """Cos recte (taló/punta a `ankle`) amb el tronc a l'angle t."""
    p = dict(p); p['torso'] = t; p['thigh'] = (-t, -t); p['shin'] = (-t, -t)
    J = solve({**p, 'hip': (0, 0)})
    p['hip'] = (ankle[0] - J['anklen'][0], ankle[1] - J['anklen'][1]); return p

def plank_h(p, ankle, hand_y, h):
    """Cos recte amb l'espatlla a una alçada h per sobre de la mà."""
    best = None
    for i in range(0, 1801):
        t = i * 0.1
        q = straight_body(p, ankle, t); J = solve(q)
        d = abs(J['shoulder'][1] - (hand_y - h))
        if best is None or d < best[0]: best = (d, t)
    return straight_body(p, ankle, best[1])
def plank_pair(k, ankle, hand_y, h0=58, h1=24, p=None, dx=2):
    p = p or dict(head=-4, foot=(30, 30))
    sx = [solve(plank_h(p, ankle, hand_y, h))['shoulder'][0] for h in (h0, h1)]
    hand = ((sx[0] + sx[1]) / 2 + dx, hand_y)
    q = plank_h(p, ankle, hand_y, h0 if k == 0 else h1)
    return arms_to(q, hand, add(hand, (-1, 0)))
def plank_to(p, ankle, hand, reach):
    """Cerca l'angle del cos perquè l'espatlla quedi a `reach` de la mà."""
    best = None
    for i in range(0, 1801):
        t = -90 + i * 0.1
        q = straight_body(p, ankle, t); J = solve(q)
        d = abs(dist(J['shoulder'], hand) - reach)
        if J['shoulder'][1] < hand[1] or True:
            if best is None or d < best[0]: best = (d, t)
    q = straight_body(p, ankle, best[1])
    return arms_to(q, hand, add(hand, (-1, 0)))

def fik_arm(p, nm, target):
    s = -1 if nm == 'R' else 1; i = 0 if nm == 'R' else 1
    J = fsolve(p); a1, a2 = ik(J['sh' + nm], target, L['uarm'], L['farm'] + 4.5, -s)
    setk(p, 'uarm', i, s * a1); setk(p, 'farm', i, s * a2); return p
def fik_leg(p, nm, target, bend=1):
    s = -1 if nm == 'R' else 1; i = 0 if nm == 'R' else 1
    J = fsolve(p); a1, a2 = ik(J['hip' + nm], target, L['thigh'], L['shin'], s * bend)
    setk(p, 'thigh', i, s * a1); setk(p, 'shin', i, s * a2); return p
def fground(p, lift=0, cx=0):
    p = dict(p); p.setdefault('hip', (0, 0)); p = {**FDEFAULT, **p}
    J = fsolve(p)
    cs = [('ankleR', 8), ('ankleL', 8), ('handR', 4.6), ('handL', 4.6), ('kneeR', 7), ('kneeL', 7), ('elbowR', 5.5), ('elbowL', 5.5), ('hip', 15), ('headc', 11)]
    low = max(J[j][1] + r for j, r in cs)
    p['hip'] = (p['hip'][0] + cx - J['hip'][0] if cx is not None else p['hip'][0], p['hip'][1] - low - lift); return p

STAND = dict(torso=2, thigh=(0, 0), shin=(0, 0), uarm=(4, -4), farm=(8, 2), foot=(90, 90))
def stand(**kw): return ground({**STAND, **kw})
BENCH = -36   # alçada del banc
def tup(a, b=None): return (a, a if b is None else b)

# ---- material habitual (funcions de dibuix) ----
def bar_at(where='handn', off=(0, 0), r=19):
    def f(D, J): c = add(J[where], off); plate(D, c, r); bar_end(D, c)
    return f
def db_at(*wheres, r=7.5):
    def f(D, J):
        for w in wheres: dumbbell(D, J[w], r)
    return f
def kb_at(where='handn', off=(0, 13)):
    def f(D, J): kettlebell(D, J[where], off)
    return f
def both(*fs):
    def f(D, J):
        for g in fs:
            if g: g(D, J)
    return f
def mat_under(x0=-20, x1=20):
    def f(D, J):
        xs = [J[k][0] for k in J if k not in ('up', 'side') and isinstance(J[k], tuple) and len(J[k]) == 2 and isinstance(J[k][0], (int, float))]
        mat(D, min(xs) + x0, max(xs) + x1)
    return f
def bench_under(x0, x1, top=BENCH):
    def f(D, J): bench(D, x0, x1, top)
    return f

# ======================= EXERCICIS =======================
E = {}
def ex(*ns):
    def deco(fn):
        for n in ns: E[n] = fn
        return fn
    return deco

# --- sentadilles ---
def squat_pose(k, torso_bottom=42, arms=None):
    if k == 0: p = dict(torso=5, thigh=(0, 2), shin=(0, -2))
    else: p = dict(torso=torso_bottom, thigh=(84, 86), shin=(-32, -34))
    p.update(arms or {})
    return ground(p)

@ex(1)
def _(k):
    p = squat_pose(k, arms=dict(uarm=(-35, -30), farm=(150, 150)) if k == 0 else dict(uarm=(-8, -4), farm=(140, 140)))
    return Fr('side', p, front=bar_at('shoulder', (-7, -4)))

@ex(2)
def _(k):
    p = squat_pose(k, 26)
    J = solve(p); arms_to(p, add(J['shoulder'], (16, 22)))
    return Fr('side', p, front=lambda D, J: kettlebell(D, J['handn'], (2, 12)))

@ex(13)
def _(k):
    p = squat_pose(k, 32, dict(uarm=(8, 4), farm=(10, 6)) if k == 0 else dict(uarm=(88, 86), farm=(90, 88)))
    return Fr('side', p)

@ex(45)
def _(k):
    p = squat_pose(k, 34, dict(uarm=(0, 0), farm=(0, 0)))
    if k == 1: p = dict(p); p['uarm'] = (-6, -6); p['farm'] = (-6, -6)
    return Fr('side', p, back=db_at('handf'), front=db_at('handn'))

@ex(50)
def _(k):
    p = squat_pose(k, 16 if k else 2, dict(uarm=(80, 80), farm=(-150, -150)))
    return Fr('side', p, front=bar_at('shoulder', (9, -5)))

@ex(103)
def _(k):
    if k == 0:
        p = squat_pose(1, 40, dict(uarm=(-40, -36), farm=(-30, -26)))
        return Fr('side', p)
    p = ground(dict(torso=4, thigh=(4, 0), shin=(-4, -8), foot=(40, 40), uarm=(160, 156), farm=(170, 166)), lift=26)
    return Fr('side', p)

@ex(106)
def _(k):
    if k == 0:
        return Fr('side', squat_pose(1, 36, dict(uarm=(-40, -36), farm=(-30, -26))))
    p = ground(dict(torso=18, thigh=(100, 96), shin=(-10, -14), foot=(60, 60), uarm=(60, 56), farm=(100, 96)), lift=30)
    return Fr('side', p)

# --- gambes ---
def lunge(k, depth=1.0, back_leg='far', arms=None, hip_x=0):
    if k == 0:
        p = dict(STAND); p.update(arms or {}); return ground(p, x=hip_x)
    hy = -96 + 44 * depth
    p = dict(torso=4, hip=(hip_x, hy)); p.update(arms or {})
    fi, bi = (0, 1) if back_leg == 'far' else (1, 0)
    leg_to(p, fi, (hip_x + 34, -4.6))
    leg_to(p, bi, (hip_x - 58, -12 - (1 - depth) * 20))
    setk(p, 'foot', bi, 30)
    return p

@ex(21)
def _(k): return Fr('side', lunge(k, arms=dict(uarm=(4, -6), farm=(10, 0))))
@ex(47)
def _(k):
    p = lunge(k, arms=dict(uarm=(0, 0), farm=(0, 0)))
    return Fr('side', p, back=db_at('handf'), front=db_at('handn'))
@ex(46)
def _(k):
    p = lunge(1, depth=0.35 if k == 0 else 1.0, arms=dict(uarm=(0, 0), farm=(0, 0)))
    return Fr('side', p, back=db_at('handf'), front=db_at('handn'))
@ex(49)
def _(k):
    p = lunge(k, arms=dict(uarm=(-35, -30), farm=(150, 150)))
    return Fr('side', p, front=bar_at('shoulder', (-7, -4)))
@ex(104)
def _(k):
    if k == 0: return Fr('side', lunge(1, arms=dict(uarm=(30, -30), farm=(70, -10))))
    p = dict(torso=4, thigh=(40, -20), shin=(-20, -60), foot=(60, 30), uarm=(-30, 30), farm=(-10, 70))
    return Fr('side', ground(p, lift=22))

# --- pujades ---
def stepup(k, h, arms=None, db=False):
    BX0, BX1 = 18, 70
    if k == 0:
        p = dict(torso=10, hip=(0, -86)); p.update(arms or {})
        leg_to(p, 0, (40, h - 4.6)); leg_to(p, 1, (-6, -4.6))
    else:
        p = dict(torso=4, hip=(38, h - 96)); p.update(arms or {})
        leg_to(p, 0, (42, h - 4.6)); setk(p, 'thigh', 1, 30); setk(p, 'shin', 1, -40)
    def back(D, J): box(D, BX0, BX1, h) if not db else bench(D, BX0 - 10, BX1 + 20, h)
    return Fr('side', p, back=both(back, db_at('handf') if arms and db else None), front=db_at('handn') if db else None)
@ex(44)
def _(k): return stepup(k, -30, dict(uarm=(10, -10), farm=(30, 0)))
@ex(48)
def _(k): return stepup(k, BENCH - 6, dict(uarm=(0, 0), farm=(0, 0)), db=True)

# --- frontissa ---
@ex(3, 15)
def _(k, n=None):
    if k == 0: p = dict(torso=4, uarm=(4, 2), farm=(2, 0))
    else: p = dict(torso=72, thigh=(-14, -12), shin=(4, 6), uarm=(0, 2), farm=(0, 0))
    return p
def rdl(k, prop):
    p = E[3](k); p = ground(p)
    return Fr('side', p, **prop)
E[3] = (lambda f: (lambda k: Fr('side', ground(f(k)), front=bar_at('handn', (0, 2)))))(E[3])
_rdl_pose = lambda k: dict(torso=4, uarm=(4, 2), farm=(2, 0)) if k == 0 else dict(torso=72, thigh=(-14, -12), shin=(4, 6), uarm=(0, 2), farm=(0, 0))
E[15] = lambda k: Fr('side', ground(_rdl_pose(k)), back=db_at('handf'), front=db_at('handn'))

@ex(57)
def _(k):
    p = dict(torso=4, uarm=(-35, -30), farm=(150, 150)) if k == 0 else dict(torso=76, thigh=(-12, -10), shin=(6, 8), uarm=(40, 44), farm=(-120, -116))
    return Fr('side', ground(p), front=bar_at('shoulder', (-7, -4)))

@ex(22)
def _(k):
    if k == 1: return Fr('side', ground(_rdl_pose(0)), front=bar_at('handn', (0, 2)))
    bar = (16, -19)
    p = dict(torso=55)
    sh = (bar[0] + 2, bar[1] - 62)
    p['hip'] = sub(sh, vt(55, L['torso']))
    leg_to(p, 0, (0, -4.6)); leg_to(p, 1, (-2, -4.6)); arms_to(p, bar)
    return Fr('side', p, front=lambda D, J: (plate(D, bar), bar_end(D, bar)))

@ex(25)
def _(k):
    if k == 0:
        p = ground(dict(torso=68, thigh=(-14, -12), shin=(14, 16), uarm=(-12, -14), farm=(-16, -18)))
        return Fr('side', p, front=lambda D, J: kettlebell(D, J['handn'], (-2, 12)))
    p = ground(dict(torso=-4, uarm=(92, 90), farm=(92, 90)))
    return Fr('side', p, front=lambda D, J: kettlebell(D, J['handn'], (12, 2)))

@ex(56)
def _(k):
    if k == 0: p = dict(torso=2, thigh=(0, 10), shin=(0, -30), uarm=(2, 0), farm=(2, 0))
    else: p = dict(torso=84, thigh=(-6, -92), shin=(6, -92), foot=(90, 0), uarm=(0, 0), farm=(0, 0))
    return Fr('side', ground(p), front=lambda D, J: kettlebell(D, J['handn'], (0, 12)))

@ex(58)
def _(k):
    if k == 0: p = ground(dict(torso=70, thigh=(-14, -12), shin=(14, 16), uarm=(-14, -14), farm=(-20, -20)))
    else: p = ground(dict(torso=-2, uarm=(14, 12), farm=(14, 12)))
    return Fr('side', p, back=lambda D, J: cable(D, (-70, -18), J['handn'], x_col=-76))

@ex(4)
def _(k):
    sh = (-6, BENCH - 8)
    t = -94 if k == 1 else -70
    p = dict(torso=t, head=(-10 if k else 10)); p['hip'] = sub(sh, vt(t, L['torso']))
    leg_to(p, 0, (100, -4.6)); leg_to(p, 1, (98, -4.6))
    J = solve(p); barc = add(J['hip'], (2, -17)); arms_to(p, barc)
    return Fr('side', p, back=lambda D, J: bench(D, -70, 4, BENCH), front=lambda D, J: (plate(D, barc), bar_end(D, barc)))

def bridge(k, single=False, arms_floor=True):
    sh = (-40, -12)
    t = -92 if k == 0 else -116
    p = dict(torso=t, head=-6); p['hip'] = sub(sh, vt(t, L['torso']))
    leg_to(p, 1, (68, -4.6))
    if single:
        a = 112 if k == 0 else -t
        setk(p, 'thigh', 0, a); setk(p, 'shin', 0, a); setk(p, 'foot', 0, a + 80)
    else: leg_to(p, 0, (70, -4.6))
    J = solve(p)
    arms_to(p, (J['shoulder'][0] + 52, -4.6), (J['shoulder'][0] + 50, -4.6))
    return Fr('side', p, back=mat_under())
@ex(14)
def _(k): return bridge(k)
@ex(55)
def _(k): return bridge(k, single=True)

# --- empentes ---
def bench_press(k, prop='bar', incline=0):
    if incline:
        t = -90 + incline
        hipp = (40, BENCH - 13)
        p = dict(torso=t, head=-8 if k else -4, hip=hipp, thigh=(70, 66), shin=(0, -4))
        J = solve(p); sh = J['shoulder']
        up = vt(t - 90, 1)  # perpendicular al tronc, cap amunt-davant
        tgt = add(sh, (0, -60)) if k == 0 else add(sh, (6, -14))
    else:
        p = dict(torso=-90, head=-8, hip=(40, BENCH - 13), thigh=(78, 70), shin=(-6, -10))
        J = solve(p); sh = J['shoulder']
        tgt = add(sh, (2, -62)) if k == 0 else add(sh, (6, -16))
    leg_to(p, 0, (p['hip'][0] + 58, -4.6)); leg_to(p, 1, (p['hip'][0] + 54, -4.6))
    arms_to(p, tgt, add(tgt, (-1, 0)))
    def back(D, J):
        bench(D, J['hip'][0] - 70, J['hip'][0] + 16, BENCH)
        if incline:
            hip = J['hip']; sh = J['shoulder']
            pad(D, add(hip, unit(hip, sh), -6), add(sh, unit(hip, sh), 18), 8) if False else None
            a = add(hip, (-12, 10)); b = add(sh, vt(incline - 90, 1), 0); b = add(J['shoulder'], (-12, -6))
            pad(D, add(J['hip'], (-6, 10)), add(J['headc'], (-14, 0)), -8)
        elif prop == 'bar':
            rack(D, J['shoulder'][0] - 26, J['shoulder'][1] - 76, J['shoulder'][1] - 68)
    if prop == 'bar': front = bar_at('handn')
    else: front = db_at('handn')
    return Fr('side', p, back=both(back, db_at('handf') if prop == 'db' else None), front=front)
@ex(5)
def _(k): return bench_press(k)
@ex(16)
def _(k): return bench_press(k, 'db')
@ex(62)
def _(k): return bench_press(k, 'db', incline=40)
@ex(63)
def _(k): return bench_press(k, 'bar', incline=40)

@ex(76)
def _(k):
    p = dict(torso=-90, head=-8, hip=(40, BENCH - 13), thigh=(78, 70), shin=(-6, -10))
    leg_to(p, 0, (98, -4.6)); leg_to(p, 1, (94, -4.6))
    if k == 0: p.update(uarm=(176, 178), farm=(180, 182))
    else: p.update(uarm=(160, 162), farm=(-100, -98))
    return Fr('side', p, back=both(bench_under(-30, 56), db_at('handf')), front=db_at('handn'))

def pushup(k, ankle_y=-3, hand=None, wide=False):
    return plank_pair(k, (-30, ankle_y), -4.6)
@ex(6, 67, 68)
def _(k):
    return Fr('side', pushup(k), back=mat_under())
@ex(18)
def _(k):
    p = plank_pair(k, (-30, -3), BENCH - 1, 58, 22)
    return Fr('side', p, back=lambda D, J: bench(D, J['handn'][0] - 20, J['handn'][0] + 50, BENCH))
@ex(69)
def _(k):
    p = plank_pair(k, (-40, BENCH - 6), -4.6, 58, 26)
    return Fr('side', p, back=lambda D, J: bench(D, -80, -20, BENCH))

@ex(7)
def _(k):
    p = stand(torso=-2)
    J = solve(p)
    tgt = add(J['shoulder'], (14, -4)) if k == 0 else add(J['shoulder'], (4, -62))
    arms_to(p, tgt)
    return Fr('side', p, front=bar_at('handn'))
@ex(17, 70)
def _(k):
    p = stand(torso=-2); J = solve(p)
    tgt = add(J['shoulder'], (6, -16)) if k == 0 else add(J['shoulder'], (4, -62))
    arms_to(p, tgt, add(tgt, (-3, 0)))
    return Fr('side', p, back=db_at('handf'), front=db_at('handn'))
def _arnold(k):
    p = stand(torso=-2); J = solve(p)
    tgt = add(J['shoulder'], (18, -22)) if k == 0 else add(J['shoulder'], (4, -62))
    arms_to(p, tgt, add(tgt, (-3, 0)))
    return Fr('side', p, back=db_at('handf'), front=lambda D, J: dumbbell_h(D, J['handn'], 90, 18))
E[70] = _arnold

@ex(78)
def _(k):
    hand = (-8, BENCH - 2)
    hip = (14, BENCH - 8) if k == 0 else (16, BENCH + 22)
    p = dict(torso=2, hip=hip)
    arms_to(p, hand, add(hand, (-2, 0)))
    leg_to(p, 0, (96, -4.6)); leg_to(p, 1, (94, -4.6))
    return Fr('side', p, back=lambda D, J: bench(D, -70, -2, BENCH))

# --- estirades ---
@ex(8)
def _(k):
    base = dict(torso=80, head=-10, thigh=(12, 0), shin=(-4, -90), foot=(90, 180))
    if k == 0: base.update(uarm=(0, 14), farm=(0, 0))
    else: base.update(uarm=(-62, 14), farm=(14, 0))
    p = ground(base)
    return Fr('side', p, back=lambda D, J: bench(D, J['kneef'][0] - 50, J['handf'][0] + 14, J['kneef'][1] + 6), front=db_at('handn'))
@ex(81)
def _(k):
    f = E[8](k); f.front = lambda D, J: kettlebell(D, J['handn'], (0, 12)); return f

@ex(79, 80)
def _(k): pass
def _row_hinge(prop):
    def f(k):
        p = ground(dict(torso=62, thigh=(-12, -10), shin=(18, 20), uarm=(0, 0), farm=(0, 0)))
        if k == 1:
            J = solve(p); u = unit(J['hip'], J['shoulder']); n = (cos(radians(62)), sin(radians(62)))
            tgt = add(add(J['hip'], u, 22), n, 16); arms_to(p, tgt, add(tgt, (-2, 0)))
        if prop == 'bar': return Fr('side', p, front=bar_at('handn'))
        return Fr('side', p, back=db_at('handf'), front=db_at('handn'))
    return f
E[79] = _row_hinge('bar'); E[80] = _row_hinge('db')

@ex(9, 82)
def _(k):
    if k == 0: base = dict(torso=-4, uarm=(176, 176), farm=(180, 180), thigh=(12, 14), shin=(-24, -22), foot=(70, 70))
    else: base = dict(torso=-14, head=-6, uarm=(28, 28), farm=(176, 176), thigh=(18, 20), shin=(-30, -28), foot=(70, 70))
    p = place(base, 'handn', (40, -205))
    return Fr('side', p, back=lambda D, J: pullup_bar(D, J['handn']), front=lambda D, J: bar_end(D, add(J['handn'], (0, -1))))

@ex(19)
def _(k):
    barp = (40, -130)
    p = dict(head=-4, foot=(100, 100))
    ank = (40 + 132, -5)
    best = None
    for i in range(0, 900):
        t = -90 + i * 0.1
        q = straight_body(p, ank, t); J = solve(q)
        if J['shoulder'][1] < barp[1] + 8: continue
        d = abs(dist(J['shoulder'], barp) - (58 if k == 0 else 26))
        if best is None or d < best[0]: best = (d, t)
    q = straight_body(p, ank, best[1]); arms_to(q, barp, add(barp, (-1, 0)))
    def back(D, J): post(D, barp[0] - 40, barp[1] - 4); beam(D, (barp[0] - 40, barp[1]), barp, 4)
    return Fr('side', q, back=back, front=lambda D, J: bar_end(D, barp))

def seated_machine(k, torso, tgt_fn, seat_h=-46, pulley=None, col_x=None, pad_knee=False):
    p = dict(torso=torso, hip=(0, seat_h - 12), thigh=(84, 86), shin=(0, 2))
    J = solve(p); tn = tgt_fn(J); arms_to(p, tn, add(tn, (-2, 0)))
    def back(D, J):
        box(D, -20, 24, seat_h, 0) if False else None
        poly(D, [(-16, seat_h), (22, seat_h), (22, seat_h + 7), (-16, seat_h + 7)])
        post(D, 2, seat_h + 6, 0, 6)
        if pulley: cable(D, pulley, J['handn'], x_col=col_x if col_x is not None else pulley[0] + 4)
        if pad_knee: dumbbell(D, add(J['kneen'], (0, -12)), 6)
    return Fr('side', p, back=back, front=lambda D, J: bar_end(D, J['handn']) if pulley else None)

@ex(10, 83)
def _(k):
    t = -14
    fn = (lambda J: add(J['shoulder'], (4, -60))) if k == 0 else (lambda J: add(J['shoulder'], (12, -6)))
    return seated_machine(k, t, fn, pulley=(10, -196), col_x=-36, pad_knee=True)

@ex(20)
def _(k):
    t = 14 if k == 0 else -6
    p = dict(torso=t, hip=(0, -12), thigh=(78, 80), shin=(110, 112), foot=(0, 0))
    J = solve(p)
    tgt = add(J['shoulder'], (60, 14)) if k == 0 else add(J['hip'], (30, -24))
    arms_to(p, tgt, add(tgt, (-2, 0)))
    def back(D, J):
        poly(D, [(-14, -8), (24, -8), (24, 0), (-14, 0)])
        cable_col(D, 140, 0, -60); poly(D, [(118, -40), (126, -40), (126, 0), (118, 0)], fill='#d8dbe0')
        D.add(f'<line x1="134" y1="-24" x2="{J["handn"][0]:.1f}" y2="{J["handn"][1]:.1f}" stroke="#4b5059" stroke-width="1.6"/>')
    return Fr('side', p, back=back, front=lambda D, J: handle(D, J['handn']))

@ex(84)
def _(k):
    p = stand(torso=16, thigh=(-6, -4), shin=(8, 8)); J = solve(p)
    tgt = add(J['shoulder'], (40, -48)) if k == 0 else add(J['hip'], (14, 22))
    arms_to(p, tgt)
    J = solve(p)
    return Fr('side', p, back=lambda D, J: cable(D, (110, -220), J['handn'], x_col=118), front=lambda D, J: bar_end(D, J['handn']))

@ex(74)
def _(k):
    p = stand(torso=-6); J = solve(p)
    if k == 0: arms_to(p, add(J['shoulder'], (56, -24)))
    else: p.update(uarm=(84, 82), farm=(150, 148))
    return Fr('side', p, back=lambda D, J: cable(D, (120, -180), J['handn'], x_col=126), front=lambda D, J: handle(D, J['handn']))

@ex(75)
def _(k):
    p = stand(torso=12, thigh=(-4, -2), shin=(4, 4))
    if k == 0: p.update(uarm=(-6, -6), farm=(90, 90))
    else: p.update(uarm=(-4, -4), farm=(4, 4))
    return Fr('side', p, back=lambda D, J: cable(D, (64, -190), J['handn'], x_col=70), front=lambda D, J: handle(D, J['handn']))

@ex(73)
def _(k):
    p = dict(bend=0, tscale=0.46, hdy=18, head=0, thigh=(4, 4), shin=(-2, -2),
             uarm=(6, 6) if k == 0 else (84, 84), farm=(4, 4) if k == 0 else (80, 80))
    p = fground(p)
    return Fr('front', p, front=lambda D, J: (dumbbell(D, J['handR'], 7), dumbbell(D, J['handL'], 7)))

@ex(77)
def _(k):
    p = ground(dict(torso=72, thigh=(-14, -12), shin=(16, 18), uarm=(-80, 10), farm=(0 if k == 0 else -80, 10)))
    return Fr('side', p, back=db_at('handf'), front=db_at('handn'))

# --- braços ---
def curl(k, prop):
    p = stand(torso=2)
    if k == 0: p.update(uarm=(2, 0), farm=(4, 2))
    else: p.update(uarm=(-6, -6), farm=(150, 150))
    if prop == 'bar': return Fr('side', p, front=bar_at('handn'))
    if prop == 'ham':
        rot = lambda J, s: degrees(atan2(J['wrist' + s][1] - J['elbow' + s][1], J['wrist' + s][0] - J['elbow' + s][0])) + 90
        return Fr('side', p, back=lambda D, J: dumbbell_h(D, J['handf'], rot(J, 'f'), 18), front=lambda D, J: dumbbell_h(D, J['handn'], rot(J, 'n'), 18))
    return Fr('side', p, back=db_at('handf'), front=db_at('handn'))
E[85] = lambda k: curl(k, 'db'); E[86] = lambda k: curl(k, 'ham'); E[87] = lambda k: curl(k, 'bar')

@ex(88)
def _(k):
    p = stand(torso=2, uarm=(2, 0), farm=(2, 0), shrug=(0 if k == 0 else 7))
    return Fr('side', p, back=db_at('handf'), front=db_at('handn'))

@ex(71)
def _(k):
    p = fground(dict(uarm=(6, 6) if k == 0 else (86, 86), farm=(4, 4) if k == 0 else (84, 84)))
    return Fr('front', p, front=lambda D, J: (dumbbell(D, J['handR'], 7), dumbbell(D, J['handL'], 7)))
@ex(72)
def _(k):
    p = stand(torso=2, uarm=(2, 0) if k == 0 else (88, 86), farm=(2, 0) if k == 0 else (90, 88))
    return Fr('side', p, back=db_at('handf'), front=db_at('handn'))

# --- cames a màquina ---
@ex(51)
def _(k):
    t = -50
    p = dict(torso=t, hip=(0, -40), head=6, uarm=(30, 30), farm=(60, 60))
    d = (cos(radians(40)), -sin(radians(40)))
    foot = add((0, -40), d, 50 if k == 0 else 84)
    leg_to(p, 0, foot); leg_to(p, 1, add(foot, (-1, 0)))
    setk(p, 'foot', 0, 140); setk(p, 'foot', 1, 140)
    def back(D, J):
        pad(D, add(J['hip'], (2, 14)), add(J['shoulder'], (-6, 10)), 8)
        poly(D, [(-30, -22), (40, -22), (40, 0), (-30, 0)], fill='#d8dbe0')
        f = add(foot, d, 5); n = (-d[1], d[0])
        poly(D, [add(f, (sin(radians(40)) * 22, cos(radians(40)) * 22)), add(f, (-sin(radians(40)) * 22, -cos(radians(40)) * 22)),
                 add(f, (-sin(radians(40)) * 22 + d[0] * 6, -cos(radians(40)) * 22 + d[1] * 6)), add(f, (sin(radians(40)) * 22 + d[0] * 6, cos(radians(40)) * 22 + d[1] * 6))])
        beam(D, add(f, d, 6), (150, -120), 6)
    return Fr('side', p, back=back)

@ex(52, 54)
def _(k, curl_=False): pass
def seat_legs(k, mode):
    p = dict(torso=-6, hip=(0, -62), uarm=(10, 10), farm=(60, 60))
    if mode == 'ext': p.update(thigh=(84, 86), shin=(4, 6) if k == 0 else (88, 88), foot=(90, 90) if k == 0 else (170, 170))
    else: p.update(thigh=(84, 86), shin=(88, 88) if k == 0 else (-6, -4), foot=(170, 170) if k == 0 else (90, 90))
    def back(D, J):
        poly(D, [(-16, -50), (40, -50), (40, -42), (-16, -42)]); post(D, 10, -44, 0, 8)
        pad(D, add(J['hip'], (-14, 6)), add(J['shoulder'], (-14, -6)), 7)
    def front(D, J):
        a = J['anklen']; off = (8, 0) if (mode == 'ext' and k == 0) else ((0, -7) if mode == 'ext' else ((0, 7) if k == 0 else (-8, 0)))
        if mode == 'ext' and k == 1: off = (0, -7)
        D.add(f'<circle cx="{a[0] + off[0]:.1f}" cy="{a[1] + off[1]:.1f}" r="5.5" fill="{EQUIP}"/>', [add(a, off)])
    return Fr('side', p, back=back, front=front)
E[52] = lambda k: seat_legs(k, 'ext'); E[54] = lambda k: seat_legs(k, 'curl')

@ex(53)
def _(k):
    p = dict(torso=90, head=-14, hip=(0, BENCH - 12), thigh=(-92, -92), shin=(-92, -92) if k == 0 else (160, 156), foot=(0, 0) if k == 0 else (-110, -110),
             uarm=(10, 10), farm=(40, 40))
    arms_to(p, (66, BENCH + 2), (64, BENCH + 2))
    def front(D, J):
        a = J['anklen']; off = (0, -7) if k == 0 else (7, 2)
        D.add(f'<circle cx="{a[0] + off[0]:.1f}" cy="{a[1] + off[1]:.1f}" r="5.5" fill="{EQUIP}"/>', [add(a, off)])
    return Fr('side', p, back=lambda D, J: bench(D, -90, 70, BENCH), front=front)

@ex(59)
def _(k):
    p = ground(dict(torso=2, foot=(102, 102) if k == 0 else (52, 52), uarm=(-30, -30), farm=(150, 150)), lift=12 if k == 0 else 10)
    J = solve(p)
    def back(D, J):
        box(D, J['toen'][0] - 10, J['toen'][0] + 14, -10)
        post(D, -34, -190, 0, 10); beam(D, (-34, J['shoulder'][1] - 14), (J['shoulder'][0] + 8, J['shoulder'][1] - 14), 7)
    return Fr('side', p, back=back)
@ex(60)
def _(k):
    p = ground(dict(torso=2, foot=(90, 90) if k == 0 else (46, 46), uarm=(2, 0), farm=(2, 0)))
    return Fr('side', p, back=db_at('handf'), front=db_at('handn'))

@ex(61)
def _(k):
    sp = 6 if k == 0 else 44
    p = dict(hip=(0, -62), lscale=(0.34, 0.34), thigh=(sp, sp), shin=(-sp * 0.2, -sp * 0.2), uarm=(14, 14), farm=(10, 10))
    def back(D, J):
        poly(D, [(-26, -56), (26, -56), (26, -48), (-26, -48)], fill=EQUIP)
        poly(D, [(-22, -128), (22, -128), (22, -56), (-22, -56)], fill='#3a3f47')
        post(D, -40, -150, 0, 6); post(D, 40, -150, 0, 6); post(D, 0, -48, 0, 8)
    def front(D, J):
        for nm, s in (('R', -1), ('L', 1)):
            c = add(J['knee' + nm], (s * 9, 0))
            D.add(f'<rect x="{c[0] - 3.5:.1f}" y="{c[1] - 9:.1f}" width="7" height="18" rx="3" fill="{EQUIP}"/>', [c])
    return Fr('front', p, back=back, front=front)

# --- pit i politja ---
@ex(64)
def _(k):
    p = dict(hip=(0, 0), uarm=(24, 24) if k == 0 else (82, 82), farm=(-24, -24) if k == 0 else (70, 70), thigh=(10, 10), shin=(-4, -4))
    def back(D, J): poly(D, [(-14, 30), (14, 30), (14, -76), (-14, -76)], fill=EQUIP)
    def front(D, J):
        for nm in 'RL': dumbbell(D, J['hand' + nm], 7)
    return Fr('front', p, back=back, front=front, rot=-90, floor=False)

@ex(65)
def _(k):
    p = fground(dict(thigh=(5, 5)))
    if k == 0:
        p.update(uarm=(118, 118), farm=(110, 110))
    else:
        J = fsolve(p); c = add(J['hip'], (0, -10)); fik_arm(p, 'R', add(c, (-4, 0))); fik_arm(p, 'L', add(c, (4, 0)))
    def back(D, J):
        for x in (-100, 100):
            cable_col(D, x)
            D.add(f'<line x1="{x:.1f}" y1="-160" x2="{J["handR" if x < 0 else "handL"][0]:.1f}" y2="{J["handR" if x < 0 else "handL"][1]:.1f}" stroke="#4b5059" stroke-width="1.6"/>')
    return Fr('front', p, back=back, front=lambda D, J: (handle(D, J['handR']), handle(D, J['handL'])))

@ex(66)
def _(k):
    fn = (lambda J: add(J['shoulder'], (14, 10))) if k == 0 else (lambda J: add(J['shoulder'], (58, 8)))
    f = seated_machine(k, -6, fn)
    ob = f.back
    def back(D, J):
        ob(D, J); pad(D, add(J['hip'], (-14, 8)), add(J['shoulder'], (-14, -10)), 7)
        beam(D, (J['handn'][0], J['handn'][1]), (J['handn'][0] - 10, J['handn'][1] - 40), 5); post(D, -40, -170, 0, 10)
    f.back = back; f.front = lambda D, J: handle(D, J['handn'])
    return f

# --- core ---
@ex(11)
def _(k):
    p = dict(uarm=(0, 0), farm=(90, 90), foot=(20, 20), head=-4)
    def fit(t): return {**p, 'torso': t, 'thigh': (-t, -t), 'shin': (-t, -t)}
    best = min((abs(solve(fit(t / 4))['toen'][1] - solve(fit(t / 4))['elbown'][1]), t / 4) for t in range(240, 400))
    q = ground(fit(best[1]), anchor='elbown', x=60)
    return Fr('side', q, back=mat_under())

@ex(23)
def _(k):
    b = 64 if k == 0 else 72
    p = dict(bend=b, thigh=(b, -b), shin=(b, -b), uarm=(b, 0), farm=(b, 90))
    p = fground(p)
    return Fr('front', p, back=mat_under())

@ex(96)
def _(k):
    b = 70
    p = dict(bend=b, thigh=(b, -b), shin=(b, -b), uarm=(b if k == 0 else 180, 0), farm=(b if k == 0 else 180, 0))
    p = fground(p)
    return Fr('front', p, back=mat_under())

@ex(24)
def _(k):
    p = dict(torso=-90, head=-6, hip=(0, -13))
    if k == 0: p.update(uarm=(180, 178), farm=(180, 178), thigh=(180, 178), shin=(90, 90), foot=(180, 180))
    else: p.update(uarm=(-96, 178), farm=(-96, 178), thigh=(180, 98), shin=(90, 96), foot=(180, 180))
    return Fr('side', p, back=mat_under())

@ex(89)
def _(k):
    t = -90 if k == 0 else -64
    p = dict(torso=t, head=(-4 if k == 0 else 14), hip=(0, -13), arch=(0 if k == 0 else -5))
    leg_to(p, 0, (62, -4.6)); leg_to(p, 1, (60, -4.6))
    J = solve(p); arms_to(p, add(J['headc'], (-4, -6)), add(J['headc'], (-6, -6)))
    return Fr('side', p, back=mat_under())

@ex(90)
def _(k):
    if k == 0: p = dict(torso=-90, hip=(0, -13), thigh=(180, 178), shin=(92, 92), foot=(180, 180))
    else: p = dict(torso=-104, hip=(0, -24), thigh=(-140, -142), shin=(140, 140), foot=(180, 180), arch=-3)
    p['uarm'] = (90 if k == 0 else 104, 90 if k == 0 else 104); p['farm'] = p['uarm']
    return Fr('side', p, back=mat_under())

@ex(91)
def _(k):
    p = ground(dict(torso=-42, hip=(0, -13), head=8, thigh=(124, 126), shin=(76, 78), foot=(150, 150)), anchor=None)
    J = solve(p)
    if k == 0: arms_to(p, add(J['shoulder'], (30, 12)))
    else: arms_to(p, add(J['hip'], (14, 2)), add(J['hip'], (12, 2)))
    return Fr('side', p, back=mat_under(), front=lambda D, J: dumbbell(D, J['handn'], 6.5))

@ex(92)
def _(k):
    a, b = (106, 84) if k == 0 else (84, 104)
    p = dict(torso=-90, head=-8, hip=(0, -13), thigh=(a, b), shin=(a, b), foot=(a + 90, b + 90), uarm=(84, 84), farm=(86, 86))
    return Fr('side', p, back=mat_under())

@ex(93)
def _(k):
    a = 90 if k == 0 else 178
    p = dict(torso=-90, head=-6, hip=(40, BENCH - 13), thigh=(a, a), shin=(a, a), foot=(a + 90, a + 90))
    J = solve(p); arms_to(p, add(J['headc'], (-16, 10)), add(J['headc'], (-18, 10)))
    return Fr('side', p, back=bench_under(-40, 60))

@ex(94)
def _(k):
    p = stand(torso=2, thigh=(-4, 4), shin=(4, -2)); J = solve(p)
    tgt = add(J['shoulder'], (12, 18)) if k == 0 else add(J['shoulder'], (58, 14))
    arms_to(p, tgt)
    def back(D, J):
        post(D, -6, -170, 0, 12)
        D.add(f'<circle cx="-6" cy="{tgt[1]:.1f}" r="5" fill="{EQUIP}"/><line x1="-6" y1="{tgt[1]:.1f}" x2="{tgt[0]:.1f}" y2="{tgt[1]:.1f}" stroke="#4b5059" stroke-width="1.6"/>')
    return Fr('side', p, back=back, front=lambda D, J: handle(D, J['handn']))

@ex(95)
def _(k):
    knee = (0, -7)
    if k == 0: p = dict(torso=58, thigh=(10, 10), shin=(-92, -92), foot=(-80, -80))
    else: p = dict(torso=92, thigh=(64, 64), shin=(-92, -92), foot=(-80, -80))
    p['hip'] = (0, 0); J = solve(p); p['hip'] = sub(knee, sub(J['kneen'], (0, 0)))
    J = solve(p)
    bar = (J['shoulder'][0] + (16 if k == 0 else 50), -19)
    arms_to(p, bar)
    return Fr('side', p, back=mat_under(), front=lambda D, J: (plate(D, bar), bar_end(D, bar)))

@ex(97)
def _(k):
    p = pushup(0)
    if k == 1:
        J = solve(p); leg_to(p, 0, add(J['elbown'], (-6, 44)))
    return Fr('side', p, back=mat_under())

@ex(98)
def _(k):
    if k == 0: p = dict(torso=90, head=-6, hip=(0, -12), thigh=(-90, -90), shin=(-90, -90), foot=(0, 0), uarm=(90, 90), farm=(90, 90))
    else: p = dict(torso=96, head=-16, hip=(0, -12), thigh=(-100, -98), shin=(-104, -102), foot=(-10, -10), uarm=(104, 102), farm=(106, 104), arch=-3)
    return Fr('side', p, back=mat_under())

@ex(99)
def _(k):
    p = fground(dict(thigh=(10, 10), bend=(-8 if k == 0 else 10)))
    J = fsolve(p)
    tgt = add(J['shoulder_c'], (-38, -40)) if k == 0 else add(J['hip'], (34, 22))
    fik_arm(p, 'R', add(tgt, (-3, 0))); fik_arm(p, 'L', add(tgt, (3, 0)))
    def back(D, J):
        cable_col(D, -110); D.add(f'<line x1="-110" y1="-168" x2="{tgt[0]:.1f}" y2="{tgt[1]:.1f}" stroke="#4b5059" stroke-width="1.6"/><circle cx="-110" cy="-168" r="5" fill="{EQUIP}"/>')
    return Fr('front', p, back=back, front=lambda D, J: handle(D, tgt))

@ex(100)
def _(k):
    if k == 0:
        p = dict(torso=-90, head=-6, hip=(0, -13), thigh=(120, 90), shin=(30, 90), foot=(120, 180), uarm=(180, 120), farm=(180, 120))
    else:
        p = dict(torso=-48, head=8, hip=(0, -13), thigh=(70, 90), shin=(-10, 90), foot=(90, 180), uarm=(180, -60), farm=(180, -40))
        p = ground(p, anchor=None)
        J = solve(p); arm_to(p, 1, (J['shoulder'][0] - 34, -4.6)); p = ground(p, anchor=None)
    return Fr('side', p, back=mat_under(), front=lambda D, J: kettlebell(D, J['handn'], (-5, -9), 8))

@ex(101)
def _(k):
    if k == 0:
        p = squat_pose(1, 30); J = solve(p); arms_to(p, add(J['shoulder'], (12, 4)))
    else:
        p = stand(torso=-2, uarm=(176, 174), farm=(180, 178))
    return Fr('side', p, front=lambda D, J: kettlebell(D, J['handn'], (-8, 4)))

@ex(102)
def _(k):
    b = 0 if k == 0 else -42
    p = dict(bend=b, thigh=(14, 12), shin=(-6, -10), uarm=(10, 180 + b), farm=(6, 180 + b))
    if k == 1: p['hip'] = (14, 0)
    p = fground(p, cx=(14 if k else 0))
    if k == 1:
        J = fsolve(p); fik_arm(p, 'R', add(J['kneeR'], (-4, 18)))
    return Fr('front', p, front=lambda D, J: kettlebell(D, J['handL'], (6, -10)))

# --- salts i locomoció ---
@ex(105)
def _(k):
    if k == 0: p = fground(dict(thigh=(3, 3), uarm=(10, 10), farm=(6, 6)))
    else: p = fground(dict(thigh=(26, 26), shin=(24, 24), uarm=(140, 140), farm=(150, 150)), lift=22)
    return Fr('front', p)
@ex(107)
def _(k):
    if k == 0: p = fground(dict(hip=(-30, 0), bend=-6, thigh=(4, -8), shin=(0, 52), uarm=(30, 20), farm=(40, 30)), cx=-30)
    else: p = fground(dict(hip=(30, 0), bend=6, thigh=(-8, 4), shin=(52, 0), uarm=(20, 30), farm=(30, 40)), cx=30)
    return Fr('front', p)

def walk(k, run=False):
    if not run:
        a = (18, -16) if k == 0 else (-16, 18)
        p = dict(torso=4, thigh=a, shin=(a[0] - 8 if a[0] > 0 else -8, a[1] - 8 if a[1] > 0 else -8 - 4),
                 foot=(100, 70) if k == 0 else (70, 100), uarm=(-a[0], -a[1]), farm=(-a[0] + 20, -a[1] + 20))
        return ground(p, anchor=None)
    if k == 0:
        p = dict(torso=12, thigh=(50, -30), shin=(-10, -90), foot=(90, 30), uarm=(-40, 40), farm=(50, 120))
    else:
        p = dict(torso=12, thigh=(-28, 46), shin=(-90, -14), foot=(30, 90), uarm=(40, -40), farm=(120, 50))
    return ground(p, anchor=None, lift=6)
@ex(26)
def _(k): return Fr('side', walk(k))
@ex(27)
def _(k): return Fr('side', walk(k, True))
@ex(30)
def _(k): return Fr('side', walk(0) if k == 0 else walk(0, True))
@ex(111)
def _(k):
    a = (92, -4) if k == 0 else (-4, 92)
    p = dict(torso=0, thigh=a, shin=(-6 if a[0] > 0 else 0, -6 if a[1] > 0 else 0), foot=(70 if a[0] > 0 else 50, 70 if a[1] > 0 else 50),
             uarm=(-30 if k == 0 else 40, 40 if k == 0 else -30), farm=(30 if k == 0 else 110, 110 if k == 0 else 30))
    return Fr('side', ground(p, lift=4))
@ex(112)
def _(k):
    p = ground(dict(torso=2, thigh=(4, 2), shin=(-4, -6), foot=(50, 50), uarm=(10, 8), farm=(60, 58)), lift=10 if k else 2)
    def front(D, J):
        a, b = J['handn'], add(J['handn'], (-6, 0))
        top = (J['headc'][1] - 40) if k == 0 else 6
        D.add(f'<path d="M{fmt(a)} C{a[0] - 70:.1f},{top:.1f} {a[0] + 50:.1f},{top:.1f} {fmt(a)}" fill="none" stroke="#4b5059" stroke-width="2"/>', [(a[0] - 40, top), (a[0] + 30, top)])
    return Fr('side', p, front=front)

def bike_frame(D, seat, crank, bar, recl=False):
    beam(D, crank, seat, 6); beam(D, crank, bar, 6)
    poly(D, [add(seat, (-12, -3)), add(seat, (10, -3)), add(seat, (10, 4)), add(seat, (-12, 4))])
    beam(D, (crank[0] - 50, -2), (crank[0] + 40, -2), 6)
    beam(D, crank, (crank[0] - 20, -2), 6)
    D.add(f'<circle cx="{crank[0]:.1f}" cy="{crank[1]:.1f}" r="14" fill="none" stroke="{EQUIP}" stroke-width="3"/>', [crank])
@ex(28)
def _(k):
    seat = (0, -96); crank = (24, -34); r = 17
    p = dict(torso=28, hip=add(seat, (0, -12)))
    a = radians(90 if k == 0 else 270)
    pn = add(crank, (cos(a) * r, sin(a) * r)); pf = add(crank, (-cos(a) * r, -sin(a) * r))
    leg_to(p, 0, add(pn, (-4, -6))); leg_to(p, 1, add(pf, (-4, -6)))
    J = solve(p); bar = (64, -126); arms_to(p, bar)
    return Fr('side', p, back=lambda D, J: bike_frame(D, seat, crank, bar))
@ex(110)
def _(k):
    seat = (0, -46); crank = (84, -40); r = 17
    p = dict(torso=-24, hip=add(seat, (0, -12)))
    a = radians(0 if k == 0 else 180)
    pn = add(crank, (cos(a) * r, sin(a) * r)); pf = add(crank, (-cos(a) * r, -sin(a) * r))
    leg_to(p, 0, add(pn, (-6, -2))); leg_to(p, 1, add(pf, (-6, -2)))
    setk(p, 'foot', 0, 160); setk(p, 'foot', 1, 160)
    J = solve(p); arms_to(p, add(J['hip'], (6, 8)))
    def back(D, J):
        poly(D, [(-16, -46), (20, -46), (20, -38), (-16, -38)]); pad(D, add(J['hip'], (-10, 6)), add(J['shoulder'], (-14, -8)), 8)
        beam(D, (0, -40), crank, 6); beam(D, (-30, -2), (100, -2), 6); post(D, 0, -40, 0, 6)
        D.add(f'<circle cx="{crank[0]:.1f}" cy="{crank[1]:.1f}" r="14" fill="none" stroke="{EQUIP}" stroke-width="3"/>', [crank])
    return Fr('side', p, back=back)
@ex(29)
def _(k):
    fn, ff = ((30, -40), (-20, -24)) if k == 0 else ((-20, -24), (30, -40))
    p = dict(torso=4, hip=(4, -126))
    leg_to(p, 0, add(fn, (0, -5))); leg_to(p, 1, add(ff, (0, -5)))
    J = solve(p)
    hn, hf = (add(J['shoulder'], (36, 10)), add(J['shoulder'], (8, 16))) if k == 0 else (add(J['shoulder'], (8, 16)), add(J['shoulder'], (36, 10)))
    arm_to(p, 0, hn); arm_to(p, 1, hf)
    def back(D, J):
        beam(D, (-60, -6), (90, -6), 8); beam(D, (80, -6), (80, -110), 7)
        for f, h in ((ff, hf), (fn, hn)):
            beam(D, add(f, (-14, 0)), add(f, (14, 0)), 5); beam(D, f, (60, -60), 3); beam(D, h, (64, -60), 4)
    return Fr('side', p, back=back)
@ex(108)
def _(k):
    rail = -20
    if k == 0:
        p = dict(torso=26, hip=(-10, rail - 14)); leg_to(p, 0, (40, -16)); leg_to(p, 1, (38, -16))
        J = solve(p); arms_to(p, (56, -50))
    else:
        p = dict(torso=-22, hip=(-56, rail - 14)); leg_to(p, 0, (40, -16)); leg_to(p, 1, (38, -16))
        J = solve(p); arms_to(p, add(J['shoulder'], (24, 26)))
    for i in (0, 1): setk(p, 'foot', i, 140)
    def back(D, J):
        beam(D, (-110, rail), (70, rail), 6); post(D, -100, rail, 0, 6); post(D, 50, rail, 0, 6)
        poly(D, [add(J['hip'], (-14, 12)), add(J['hip'], (14, 12)), add(J['hip'], (14, 18)), add(J['hip'], (-14, 18))])
        D.add(f'<circle cx="90" cy="-36" r="24" fill="#3a3f47"/><line x1="90" y1="-50" x2="{J["handn"][0]:.1f}" y2="{J["handn"][1]:.1f}" stroke="#4b5059" stroke-width="1.6"/>', [(66, -60), (114, -12)])
        beam(D, (36, -14), (48, -30), 6)
    return Fr('side', p, back=back, front=lambda D, J: handle(D, J['handn']))
@ex(109)
def _(k):
    H = 22
    steps = [(-60 + i * 30, -i * H) for i in range(6)]
    if k == 0:
        p = dict(torso=8, hip=(10, -2 * H - 92)); leg_to(p, 0, (40, -3 * H - 4.6)); leg_to(p, 1, (8, -2 * H - 4.6))
    else:
        p = dict(torso=8, hip=(40, -3 * H - 94)); leg_to(p, 0, (42, -3 * H - 4.6)); setk(p, 'thigh', 1, 40); setk(p, 'shin', 1, -30)
    p['uarm'] = (20, -20) if k == 0 else (-20, 20); p['farm'] = (40, 0) if k == 0 else (0, 40)
    def back(D, J):
        pts = [(-80, 0)]
        for x, y in steps: pts += [(x, y), (x, y - H)]
        pts += [(steps[-1][0] + 30, steps[-1][1] - H), (steps[-1][0] + 30, 0)]
        poly(D, pts, fill='#e3e5e9', stroke=EQUIP_LIGHT)
    return Fr('side', p, back=back)

# --- mobilitat i estiraments ---
def quad(k=0, **kw):
    p = dict(torso=90, head=-10, thigh=(0, 0), shin=(-90, -90), foot=(-90, -90), uarm=(0, 0), farm=(0, 0))
    p.update(kw); return ground(p, anchor='kneen', x=0)
@ex(31)
def _(k):
    p = quad(thigh=(76, 0), shin=(-20, -90)) if k == 0 else quad(thigh=(-84, 0), shin=(-160, -90), foot=(-60, -90))
    return Fr('side', p, back=mat_under(), hl={'glutes'})
@ex(32)
def _(k):
    p = quad()
    J = solve(p)
    if k == 0: arm_to(p, 0, add(J['headc'], (-4, 2)))
    else: p.update(uarm=(150, 0), farm=(-30, 0))
    return Fr('side', p, back=mat_under(), hl={'upperback', 'obliques'})
@ex(34)
def _(k):
    p = quad(arch=(-7 if k == 0 else 6), head=(-34 if k == 0 else 20))
    return Fr('side', p, back=mat_under(), hl={'upperback', 'lowback', 'abs'})
@ex(119)
def _(k):
    if k == 0: return Fr('side', quad(), back=mat_under(), hl={'upperback', 'lowback'})
    knee = (12, -7); ank = (12 - 42, -6); hip = (-28, -7 - (47 ** 2 - 40 ** 2) ** 0.5)
    th = ang(hip, knee); sh_ = ang(knee, ank)
    p = dict(torso=100, head=10, hip=hip, thigh=(th, th), shin=(sh_, sh_), foot=(-60, -60), arch=-6)
    J = solve(p); arms_to(p, (J['headc'][0] + 46, -4.6))
    return Fr('side', p, back=mat_under(), hl={'upperback', 'lowback', 'lats'})

@ex(33)
def _(k):
    wx = 92
    p = dict(torso=10, hip=(0, -54))
    leg_to(p, 0, (56, -4.6)); leg_to(p, 1, (-46, -12)); setk(p, 'foot', 1, 30)
    if k == 1:
        p['hip'] = (22, -48); leg_to(p, 0, (56, -4.6)); leg_to(p, 1, (-46, -12)); setk(p, 'foot', 1, 30)
    J = solve(p); arms_to(p, (wx - 2, J['shoulder'][1]), (wx - 3, J['shoulder'][1] + 4))
    return Fr('side', p, back=lambda D, J: wall(D, wx), hl={'calves'})

@ex(35)
def _(k):
    p = dict(torso=58, hip=(0, -48), head=-10)
    leg_to(p, 0, (44, -4.6)); leg_to(p, 1, (-58, -10)); setk(p, 'foot', 1, 30)
    J = solve(p)
    if k == 0: arms_to(p, (J['shoulder'][0] + 8, -4.6))
    else: arm_to(p, 1, (J['shoulder'][0] + 8, -4.6)); p['uarm'] = (178, p['uarm'][1]); p['farm'] = (178, p['farm'][1]); p['head'] = -40
    return Fr('side', p, back=mat_under(), hl={'upperback', 'obliques', 'quads'})

@ex(36)
def _(k):
    p = stand(uarm=(70 if k == 0 else 200, -4), farm=(70 if k == 0 else 200, 2))
    J = solve(p)
    def front(D, J):
        sh = J['shoulder']; D.add(f'<circle cx="{sh[0]:.1f}" cy="{sh[1]:.1f}" r="52" fill="none" stroke="{RED}" stroke-width="1.4" stroke-dasharray="3 4" opacity="0.7"/>', [add(sh, (52, 52)), add(sh, (-52, -52))])
    return Fr('side', p, back=front, hl={'delts'})
@ex(117)
def _(k):
    p = stand(torso=2, shrug=(6 if k == 0 else -2))
    def back(D, J):
        sh = J['shoulder']; D.add(f'<circle cx="{sh[0]:.1f}" cy="{sh[1] + 2:.1f}" r="11" fill="none" stroke="{RED}" stroke-width="1.4" stroke-dasharray="3 3" opacity="0.8"/>')
    return Fr('side', p, front=back, hl={'upperback', 'delts'})
@ex(118)
def _(k):
    p = stand(torso=2, uarm=(86, 84), farm=(90, 88), hand=(60 if k == 0 else 130, 60 if k == 0 else 130))
    return Fr('side', p, hl={'forearms'})

@ex(37)
def _(k):
    a = 140 if k == 0 else 172
    p = dict(torso=-90, head=-8, hip=(0, -13), thigh=(a, 92), shin=(a, 92), foot=(a + 90, 180))
    J = solve(p); tgt = lerp(J['hip'], J['kneen'], 1.2); arms_to(p, tgt)
    return Fr('side', p, back=mat_under(), front=lambda D, J: strap(D, J['handn'], add(J['toen'], (-2, -2))), hl={'hams'})
@ex(38)
def _(k):
    hx = 0 if k == 0 else 12
    p = dict(torso=0 if k == 0 else -4, hip=(hx, -56))
    leg_to(p, 1, (46, -4.6)); leg_to(p, 0, (-50, -8)); setk(p, 'foot', 0, 0)
    J = solve(p); arms_to(p, add(J['hip'], (6, -10)))
    return Fr('side', p, back=mat_under(), hl={'quads'})
@ex(39)
def _(k):
    p = stand(torso=2)
    J = solve(p)
    if k == 0: arms_to(p, add(J['hip'], (22, 6)))
    else: arms_to(p, add(J['shoulder'], (-8, -60)))
    return Fr('side', p, front=lambda D, J: D.add(f'<circle cx="{J["handn"][0]:.1f}" cy="{J["handn"][1]:.1f}" r="3.2" fill="#8a6a45"/>'), hl={'pecs', 'delts'})
@ex(40)
def _(k):
    wx = 104
    p = dict(torso=26 if k == 0 else 40, hip=(0, -86) if k == 0 else (14, -80))
    leg_to(p, 1, (44, -4.6)); leg_to(p, 0, (-46, -4.6))
    J = solve(p); arms_to(p, (wx - 2, J['shoulder'][1] - 8), (wx - 3, J['shoulder'][1] - 6))
    return Fr('side', p, back=lambda D, J: wall(D, wx), hl={'calves'})
@ex(41)
def _(k):
    if k == 0: p = dict(torso=-90, head=-6, hip=(0, -13), thigh=(160, 140), shin=(80, 40), foot=(170, 130), uarm=(90, 90), farm=(90, 90))
    else:
        p = dict(torso=-90, head=-6, hip=(0, -13), thigh=(-160, 200), shin=(80, 40), foot=(170, 130))
        J = solve(p); arms_to(p, lerp(J['hip'], J['kneef'], 0.85))
    return Fr('side', p, back=mat_under(), hl={'glutes'})
@ex(42)
def _(k):
    p = stand(thigh=(4, 4 if k == 0 else 70), shin=(-4, -4 if k == 0 else -60), uarm=(4, 40), farm=(8, 60))
    J = solve(p)
    return Fr('side', p, hl={'glutes', 'calves'})
@ex(43)
def _(k):
    if k == 0: p = ground(dict(torso=2, thigh=(10, -6), shin=(0, -12), foot=(90, 80), uarm=(-10, 10), farm=(0, 20)), anchor='anklef')
    else: p = ground(dict(torso=2, thigh=(-6, 10), shin=(-12, 0), foot=(80, 90), uarm=(10, -10), farm=(20, 0)), anchor='anklen')
    return Fr('side', p, hl={'calves', 'glutes'})

@ex(113)
def _(k):
    if k == 0:
        p = ground(dict(torso=128, head=10, thigh=(-6, -6), shin=(0, 0)))
        J = solve(p); arms_to(p, (J['shoulder'][0] + 22, -4.6))
        return Fr('side', p, back=mat_under(), hl={'hams'})
    return Fr('side', pushup(0), back=mat_under(), hl={'abs', 'delts', 'hams'})
@ex(114)
def _(k):
    s = -1 if k == 0 else 1
    p = dict(hip=(s * 10, -96), bend=-s * 8)
    fik_leg(p, 'R', (-14, -8)); fik_leg(p, 'L', (14, -8))
    J = fsolve(p); fik_arm(p, 'R', add(J['hipR'], (-12, -14))); fik_arm(p, 'L', add(J['hipL'], (12, -14)))
    return Fr('front', p, front=lambda D, J: arrow(D, [add(J['hip'], (-34, 20)), add(J['hip'], (0, 34)), add(J['hip'], (34, 20))]), hl={'glutes', 'obliques'})
@ex(115)
def _(k):
    p = pushup(0)
    if k == 1:
        J = solve(p); p['hip'] = add(p['hip'], (4, 8)); leg_to(p, 1, add(J['handn'], (-10, 0)))
        J2 = solve(p); arms_to(p, J['handn'])
    return Fr('side', p, back=mat_under(), hl={'glutes', 'quads', 'hams'})
@ex(116)
def _(k):
    p = stand(thigh=(60 if k == 0 else -36, 0), shin=(0 if k == 0 else -40, 0), foot=(110 if k == 0 else 60, 90))
    J = solve(p); arm_to(p, 1, add(J['shoulder'], (-2, 40)))
    return Fr('side', p, back=lambda D, J: post(D, J['handf'][0] + 2, J['handf'][1] - 20, 0, 6), hl={'hams', 'glutes'})
@ex(120)
def _(k):
    p = dict(torso=0, thigh=(-6 if k else 0, 6), shin=(-150 if k else -120, 6), foot=(-60, 90), hip=(0, 0), head=0)
    J = solve(p); arm_to(p, 0, J['anklen']) if True else None
    p['uarm'] = (p['uarm'][0], 180); p['farm'] = (p['farm'][0], 180)
    return Fr('side', p, back=None, rot=-90, hl={'quads'})
@ex(121)
def _(k):
    p = stand(uarm=(176, 4), farm=(-10, 6))
    if k == 1:
        J = solve(p); arm_to(p, 1, J['elbown'])
    return Fr('side', p, hl={'triceps'})
@ex(122)
def _(k):
    p = stand(torso=4 if k == 0 else 10, head=0 if k == 0 else 24, arch=0 if k == 0 else 7, uarm=(86, 84), farm=(88, 86))
    if k == 1: p['uarm'] = (94, 92); p['farm'] = (92, 90)
    return Fr('side', p, hl={'upperback'})
@ex(123)
def _(k):
    sp = 30 if k == 0 else 62
    p = dict(hip=(0, 0), thigh=(sp, sp), uarm=(16, 16), farm=(14, 14))
    J = fsolve(p); c = add(J['hip'], (0, 82 - sp * 0.5))
    fik_leg(p, 'R', add(c, (-6, 0)), bend=-1); fik_leg(p, 'L', add(c, (6, 0)), bend=-1)
    def back(D, J): poly(D, [(-46, 104), (46, 104), (46, -96), (-46, -96)], fill='#eceef1')
    return Fr('front', p, back=back, rot=-90, floor=False, hl={'adductors'})
@ex(124)
def _(k):
    p = dict(torso=(-8 if k == 0 else 6), hip=(0, -13), thigh=(150 if k == 0 else 170, 90), shin=(10, 90), foot=(100, 180))
    J = solve(p); arms_to(p, lerp(J['hip'], J['kneen'], 0.9))
    return Fr('side', p, back=mat_under(), hl={'glutes'})
@ex(125)
def _(k):
    b = 0 if k == 0 else 24
    p = fground(dict(bend=b, thigh=(4, 4), uarm=(170 - b * 0.5, 10), farm=(160 - b, 6)))
    return Fr('front', p, hl={'obliques', 'lats'})
@ex(126)
def _(k):
    p = dict(torso=-4, hip=(0, -13), thigh=(120, 90), shin=(-10, 90), foot=(90, 180))
    J = solve(p)
    if k == 0: arms_to(p, add(J['kneen'], (-2, 4)), add(J['hip'], (-30, 12)))
    else: arm_to(p, 0, add(J['kneen'], (8, 6))); arm_to(p, 1, (J['hip'][0] - 32, -4.6)); p['head'] = -30
    return Fr('side', p, back=mat_under(), hl={'upperback', 'lowback', 'obliques'})
@ex(127)
def _(k):
    if k == 0:
        p = dict(torso=-90, head=-6, hip=(0, -13), uarm=(90, 90), farm=(90, 90)); leg_to(p, 0, (62, -4.6)); leg_to(p, 1, (60, -4.6))
    else:
        p = dict(torso=-94, head=-14, hip=(0, -14), thigh=(-150, -152), shin=(100, 98), foot=(180, 180))
        J = solve(p); arms_to(p, add(J['kneen'], (6, 8)))
    return Fr('side', p, back=mat_under(), hl={'lowback', 'glutes'})
@ex(128)
def _(k):
    t = 20 if k == 0 else 56
    p = dict(torso=t, hip=(0, -54), head=-10)
    leg_to(p, 0, (78, -4.6)); setk(p, 'foot', 0, 160); leg_to(p, 1, (-46, -8)); setk(p, 'foot', 1, 0)
    p['thigh'] = (p['thigh'][0], p['thigh'][1])
    q = dict(p); setk(q, 'thigh', 0, 66 if k == 0 else 62); setk(q, 'shin', 0, 70 if k == 0 else 68)
    q = ground(q, anchor=None)
    J = solve(q); arms_to(q, (J['shoulder'][0] + 12, -4.6))
    return Fr('side', q, back=mat_under(), hl={'hams'})

@ex(12)
def _(k):
    p = walk(k); p['uarm'] = (0, 0); p['farm'] = (0, 0)
    return Fr('side', p, back=db_at('handf'), front=db_at('handn'))

# ======================= composició =======================
VW, VH, PAD = 240, 170, 10
GROUND = VH - PAD - 6

def rot_pt(p, a):
    r = radians(a); return (p[0] * cos(r) - p[1] * sin(r), p[0] * sin(r) + p[1] * cos(r))

def draw_frame(n, k):
    fr = E[n](k)
    hl = fr.hl if fr.hl is not None else regions(n)
    D = Drawing()
    if fr.back: fr.back(D, fr.J)
    (figure if fr.view == 'side' else ffigure)(D, fr.J, hl)
    if fr.front: fr.front(D, fr.J)
    body = ''.join(D.parts)
    pts = D.pts
    if fr.rot:
        pts = [rot_pt(p, fr.rot) for p in pts]
        dy = -max(p[1] for p in pts) if fr.floor else 0
        body = f'<g transform="translate(0 {dy:.2f}) rotate({fr.rot})">{body}</g>'
        pts = [(x, y + dy) for x, y in pts]
        if fr.floor and n == 120:
            xs = [p[0] for p in pts]
            m = Drawing(); mat(m, min(xs) - 10, max(xs) + 10); body = ''.join(m.parts) + body
    return fr, D, body, pts

def render(n, outdir):
    frames = [draw_frame(n, 0), draw_frame(n, 1)]
    has_floor = all(f[0].floor for f in frames)
    pts = [p for f in frames for p in f[3]] + ([(0, 0)] if has_floor else [])
    x0 = min(p[0] for p in pts); x1 = max(p[0] for p in pts)
    y0 = min(p[1] for p in pts); y1 = max(p[1] for p in pts)
    if has_floor: y1 = 0
    avail_h = (GROUND - PAD) if has_floor else (VH - 2 * PAD)
    s = min((VW - 2 * PAD) / (x1 - x0), avail_h / (y1 - y0), 1.25)
    tx = VW / 2 - s * (x0 + x1) / 2
    ty = (GROUND - s * y1) if has_floor else (VH / 2 - s * (y0 + y1) / 2)
    for k, (fr, D, body, _) in enumerate(frames):
        floor = (f'<ellipse cx="{VW / 2}" cy="{GROUND}" rx="{VW / 2 - 14}" ry="3.5" fill="#eceef1"/>'
                 f'<line x1="14" y1="{GROUND}" x2="{VW - 14}" y2="{GROUND}" stroke="#d3d6db" stroke-width="1"/>') if has_floor else ''
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VW} {VH}">'
               f'<defs>{"".join(D.defs)}</defs><rect width="{VW}" height="{VH}" fill="#ffffff"/>{floor}'
               f'<g transform="translate({tx:.2f} {ty:.2f}) scale({s:.3f})" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>')
        open(os.path.join(outdir, f'{n}-{k}.svg'), 'w').write(svg)

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    ns = [int(a) for a in sys.argv[2:]] or sorted(EXS)
    bad = []
    for n in ns:
        try: render(n, out)
        except Exception as e:
            import traceback; bad.append(n); print(n, 'ERROR', repr(e)); traceback.print_exc(limit=2)
    missing = [n for n in sorted(EXS) if n not in E]
    print('fets', len(ns) - len(bad), 'errors', bad, 'sense postura', missing)
