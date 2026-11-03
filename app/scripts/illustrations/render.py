"""Genera les il·lustracions (2 fotogrames) dels exercicis amb l'estil propi d'Embranzida.
Ús: python3 render.py <carpeta_sortida> [n ...]
"""
import json, sys, os
from figure import *

HERE = os.path.dirname(os.path.abspath(__file__))
EXS = {e['n']: e for e in json.load(open(os.path.join(HERE, '../../src/data/exercises.json')))}

MUSCLE_MAP = [
    ('quàdriceps', 'quads'), ('glut', 'glutes'), ('isquio', 'hams'), ('pectoral', 'pecs'),
    ('tríceps', 'triceps'), ('deltoide', 'delts'), ('espatll', 'delts'), ('dorsal', 'lats'),
    ('romboid', 'upperback'), ('trapezi', 'upperback'), ('esquena', 'upperback'), ('bíceps', 'biceps'),
    ('abdominal', 'abs'), ('core', 'abs'), ('oblic', 'obliques'), ('oblíc', 'obliques'), ('lumbar', 'lowback'),
    ('bessons', 'calves'), ('panxell', 'calves'), ('avantbra', 'forearms'), ('adductor', 'quads'),
]
def regions(n):
    out = set()
    for m in EXS[n]['muscles']:
        for k, r in MUSCLE_MAP:
            if k in m.lower(): out.add(r)
    return out

# ---------- utilitats de posa ----------
def place(pose, joint, target):
    """Desplaça la figura perquè l'articulació `joint` caigui a `target`."""
    J = solve({**pose, 'hip': (0, 0)})
    p = J[joint]
    return {**pose, 'hip': (target[0] - p[0], target[1] - p[1])}

def level(pose, key, a, b, lo, hi):
    """Busca el valor de pose[key] (escalar) entre lo i hi perquè les articulacions a i b quedin a la mateixa alçada."""
    best = None
    for i in range(0, 401):
        val = lo + (hi - lo) * i / 400
        J = solve({**pose, key: val})
        d = abs(J[a][1] - J[b][1])
        if best is None or d < best[0]: best = (d, val)
    return {**pose, key: best[1]}

FLOOR = 0.0
def feet(pose):  # recolza el peu proper a terra (turmell 4.5 per sobre)
    return place(pose, 'anklen', (0, FLOOR - 4.5))

# ---------- exercicis ----------
def ex_squat(k):
    if k == 0:
        p = dict(torso=6, thigh=(0, 2), shin=(0, -2), uarm=(-35, -30), farm=(150, 150))
    else:
        p = dict(torso=42, thigh=(82, 84), shin=(-30, -32), uarm=(-5, 0), farm=(140, 140))
    p = feet(p)
    def props(D, J, back):
        if back: return
        c = add(J['shoulder'], (-7, -4))
        plate(D, c, 19); bar_end(D, c)
    return p, props

def ex_bench(k):
    base = dict(torso=-90, head=-8, thigh=(78, 70), shin=(-6, -10), foot=(90, 90))
    if k == 0: base.update(uarm=(180, 180), farm=(180, 180))
    else: base.update(uarm=(-48, -48), farm=(150, 150))
    p = place(base, 'hip', (40, -45))
    def props(D, J, back):
        if back:
            bench(D, J['hip'][0] - 92, J['hip'][0] + 14, J['hip'][1] + 13, FLOOR)
            rack(D, J['shoulder'][0] - 26, J['shoulder'][1] - 72, FLOOR, hooks=(J['shoulder'][1] - 66,))
            return
        c = J['handn']; plate(D, c, 22); bar_end(D, c)
    return p, props

def ex_rdl(k):
    if k == 0:
        p = dict(torso=4, thigh=(0, 0), shin=(0, 0), uarm=(4, 2), farm=(2, 0))
    else:
        p = dict(torso=72, thigh=(-14, -12), shin=(4, 6), uarm=(0, 2), farm=(0, 0))
    p = feet(p)
    def props(D, J, back):
        if back: return
        c = add(J['handn'], (0, 2)); plate(D, c, 22); bar_end(D, c)
    return p, props

def ex_pushup(k):
    if k == 0: p = dict(uarm=(4, 4), farm=(2, 2))
    else: p = dict(uarm=(-58, -58), farm=(22, 22))
    p.update(foot=(20, 20), head=-6)
    def fit(t):
        q = {**p, 'torso': t, 'thigh': (-t, -t), 'shin': (-t, -t)}
        return q
    best = min(((abs(solve(fit(t / 4))['toen'][1] - solve(fit(t / 4))['handn'][1]), t / 4) for t in range(200, 400)))
    q = fit(best[1])
    q = place(q, 'handn', (60, FLOOR - 4))
    def props(D, J, back):
        if back: mat(D, J['toen'][0] - 10, J['handn'][0] + 18, FLOOR)
    return q, props

def ex_row(k):
    base = dict(torso=80, head=-10, thigh=(12, 0), shin=(-4, -90), foot=(90, 180))
    if k == 0: base.update(uarm=(0, 14), farm=(0, 0))
    else: base.update(uarm=(-62, 14), farm=(14, 0))
    # genoll llunyà sobre el banc
    def props(D, J, back):
        if back:
            top = J['kneef'][1] + 6
            bench(D, J['kneef'][0] - 50, J['handf'][0] + 14, top, FLOOR)
            return
        dumbbell(D, J['handn'], 8)
    p = feet(base)
    return p, props

def ex_pullup(k):
    if k == 0: base = dict(torso=-4, uarm=(176, 176), farm=(180, 180), thigh=(12, 14), shin=(-24, -22), foot=(70, 70))
    else: base = dict(torso=-14, head=-6, uarm=(28, 28), farm=(176, 176), thigh=(18, 20), shin=(-30, -28), foot=(70, 70))
    p = place(base, 'handn', (40, -205))
    def props(D, J, back):
        if back: pullup_bar(D, J['handn'], FLOOR)
        else: bar_end(D, add(J['handn'], (0, -1)))
    return p, props

def ex_curl(k):
    base = dict(torso=2, thigh=(0, 0), shin=(0, 0))
    if k == 0: base.update(uarm=(2, 0), farm=(4, 2))
    else: base.update(uarm=(-6, -6), farm=(150, 150))
    p = feet(base)
    def props(D, J, back):
        if back: dumbbell(D, J['handf'], 7)
        else: dumbbell(D, J['handn'], 8)
    return p, props

def ex_plank(k):
    p = dict(uarm=(0, 0), farm=(90, 90), foot=(20, 20), head=-4)
    def fit(t): return {**p, 'torso': t, 'thigh': (-t, -t), 'shin': (-t, -t)}
    best = min((abs(solve(fit(t / 4))['toen'][1] - solve(fit(t / 4))['elbown'][1]), t / 4) for t in range(240, 400))
    q = place(fit(best[1]), 'elbown', (60, FLOOR - 5))
    def props(D, J, back):
        if back: mat(D, J['toen'][0] - 10, J['handn'][0] + 14, FLOOR)
    return q, props

EXERCISES = {1: ex_squat, 5: ex_bench, 3: ex_rdl, 6: ex_pushup, 8: ex_row, 9: ex_pullup, 85: ex_curl, 11: ex_plank}

# ---------- composició ----------
VW, VH, PAD = 240, 170, 10

def frame(n, k):
    pose, props = EXERCISES[n](k)
    J = solve(pose)
    D = Drawing()
    props(D, J, True)
    figure(D, J, regions(n))
    props(D, J, False)
    return D

def render(n, outdir):
    frames = [frame(n, 0), frame(n, 1)]
    pts = [p for D in frames for p in D.pts] + [(0, FLOOR)]
    x0 = min(p[0] for p in pts); x1 = max(p[0] for p in pts)
    y0 = min(p[1] for p in pts); y1 = FLOOR
    s = min((VW - 2 * PAD) / (x1 - x0), (VH - 2 * PAD - 6) / (y1 - y0), 1.6)
    tx = VW / 2 - s * (x0 + x1) / 2
    ty = VH - PAD - 6 - s * y1
    for k, D in enumerate(frames):
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VW} {VH}" width="{VW * 2}" height="{VH * 2}">'
               f'<defs>{"".join(D.defs)}</defs>'
               f'<rect width="{VW}" height="{VH}" fill="#ffffff"/>'
               f'<ellipse cx="{VW / 2}" cy="{VH - PAD - 6}" rx="{VW / 2 - 14}" ry="3.5" fill="#eceef1"/>'
               f'<line x1="14" y1="{VH - PAD - 6}" x2="{VW - 14}" y2="{VH - PAD - 6}" stroke="#d3d6db" stroke-width="1"/>'
               f'<g transform="translate({tx:.2f} {ty:.2f}) scale({s:.3f})" stroke-linejoin="round" stroke-linecap="round">'
               + ''.join(D.parts) + '</g></svg>')
        open(os.path.join(outdir, f'{n}-{k}.svg'), 'w').write(svg)

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    ns = [int(a) for a in sys.argv[2:]] or list(EXERCISES)
    for n in ns: render(n, out)
    print('ok', ns)
