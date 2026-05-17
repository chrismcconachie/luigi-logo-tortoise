#!/usr/bin/env python3
"""Convert an image into a Luigi Logo Tortoise prebuilt via potrace.

Pipeline:
  image (PNG/JPG)
    → Pillow (threshold to B/W, optional invert)
      → PBM bitmap
        → potrace (vectorize to SVG with cubic-Bezier paths)
          → parse SVG path 'd' attributes
            → sample Beziers as line segments
              → map SVG coords (top-left, Y down) to Logo coords (center, Y up)
                → emit Logo `.logo` file
                  → (optionally) update prebuilts/index.json + rebuild registry.js

Usage:
  brew install potrace                       # one-time
  python3 -m pip install --user Pillow       # one-time

  python3 tools/image-to-logo.py reference.png \\
      --name mclaren --category scene \\
      --label "McLaren F1" --icon 🏎️ \\
      --width 600 --height 320

  # Light artwork on dark background?  Add --invert.
  # Tweak --threshold (default 128) to tune black/white split.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    print("ERROR: Pillow not installed.  Run: python3 -m pip install --user Pillow",
          file=sys.stderr)
    sys.exit(1)


ROOT = Path(__file__).resolve().parent.parent

# ── potrace integration ──────────────────────────────────────────────

def check_potrace() -> bool:
    try:
        r = subprocess.run(['potrace', '--version'], capture_output=True)
        return r.returncode == 0
    except FileNotFoundError:
        return False


def image_to_pbm(src: str, threshold: int, invert: bool, blur: int, dilate: int) -> str:
    """Read source image, threshold to bilevel, save as a temp PBM."""
    from PIL import ImageFilter
    img = Image.open(src).convert('L')

    if invert:
        img = ImageOps.invert(img)

    if blur > 0:
        img = img.filter(ImageFilter.GaussianBlur(radius=blur))

    bw = img.point(lambda p: 0 if p < threshold else 255, mode='1')

    # Morphological dilation: thickens BLACK regions (foreground in a 'L' or '1' image).
    # MinFilter(N) over a bilevel image acts as a NxN dilation of the dark pixels —
    # exactly what we want to bolden thin lines so they survive turdsize filtering.
    if dilate > 0:
        kernel = 2 * dilate + 1
        bw_l = bw.convert('L')
        for _ in range(1):  # one pass of MinFilter(kernel) — increase repeats for more
            bw_l = bw_l.filter(ImageFilter.MinFilter(kernel))
        bw = bw_l.convert('1')

    fd, pbm = tempfile.mkstemp(suffix='.pbm')
    os.close(fd)
    bw.save(pbm)
    return pbm


def run_potrace(pbm: str, turdsize: int, alphamax: float, opttolerance: float) -> str:
    """Vectorize PBM → SVG.  Returns SVG source as a string."""
    fd, svg = tempfile.mkstemp(suffix='.svg')
    os.close(fd)
    subprocess.run([
        'potrace', pbm,
        '-b', 'svg',
        '-o', svg,
        '--turdsize', str(turdsize),
        '--alphamax', str(alphamax),
        '--opttolerance', str(opttolerance),
    ], check=True)
    text = Path(svg).read_text()
    os.unlink(svg)
    return text


# ── SVG path parsing ─────────────────────────────────────────────────

def sample_cubic(p0, p1, p2, p3, n=12):
    """Sample a cubic Bezier into n points (excluding the start)."""
    pts = []
    for i in range(1, n + 1):
        t = i / n
        mt = 1 - t
        x = (mt ** 3) * p0[0] + 3 * (mt ** 2) * t * p1[0] + 3 * mt * (t ** 2) * p2[0] + (t ** 3) * p3[0]
        y = (mt ** 3) * p0[1] + 3 * (mt ** 2) * t * p1[1] + 3 * mt * (t ** 2) * p2[1] + (t ** 3) * p3[1]
        pts.append((x, y))
    return pts


_TOKEN_RE = re.compile(r'[MLCZHVAQTSmlczhvaqts]|-?\d*\.?\d+(?:[eE][-+]?\d+)?')


def parse_path_d(d: str, curve_samples: int = 12):
    """Parse an SVG path 'd' string into a list of polylines.

    Each polyline is [(x, y), ...].  M starts a new polyline; Z closes
    the current one back to its start.  Cubic Beziers (C) are sampled.
    """
    tokens = _TOKEN_RE.findall(d)
    polylines, current = [], []
    cx, cy = 0.0, 0.0
    sx, sy = 0.0, 0.0
    last_ctrl = None  # for shorthand S/s
    cmd = None
    i = 0

    def num():
        nonlocal i
        v = float(tokens[i]); i += 1; return v

    def is_num(tok):
        return tok[0].isdigit() or tok[0] in '-.'

    while i < len(tokens):
        tok = tokens[i]
        if not is_num(tok):
            cmd = tok
            i += 1
            if cmd in 'Zz':
                if current:
                    if current[-1] != (sx, sy):
                        current.append((sx, sy))
                    polylines.append(current)
                    current = []
                last_ctrl = None
                continue
            continue

        # Number-position — interpret per current command
        if cmd in ('M', 'm'):
            x = num(); y = num()
            if cmd == 'm':
                x += cx; y += cy
            if current:
                polylines.append(current)
            current = [(x, y)]
            cx, cy = x, y
            sx, sy = x, y
            last_ctrl = None
            cmd = 'L' if cmd == 'M' else 'l'

        elif cmd in ('L', 'l'):
            x = num(); y = num()
            if cmd == 'l':
                x += cx; y += cy
            current.append((x, y))
            cx, cy = x, y
            last_ctrl = None

        elif cmd in ('H', 'h'):
            x = num()
            if cmd == 'h':
                x += cx
            current.append((x, cy))
            cx = x
            last_ctrl = None

        elif cmd in ('V', 'v'):
            y = num()
            if cmd == 'v':
                y += cy
            current.append((cx, y))
            cy = y
            last_ctrl = None

        elif cmd in ('C', 'c'):
            x1 = num(); y1 = num()
            x2 = num(); y2 = num()
            x  = num(); y  = num()
            if cmd == 'c':
                x1 += cx; y1 += cy
                x2 += cx; y2 += cy
                x  += cx; y  += cy
            current.extend(sample_cubic((cx, cy), (x1, y1), (x2, y2), (x, y), n=curve_samples))
            last_ctrl = (x2, y2)
            cx, cy = x, y

        elif cmd in ('S', 's'):
            # Smooth cubic: first control is reflection of last_ctrl
            x2 = num(); y2 = num()
            x  = num(); y  = num()
            if cmd == 's':
                x2 += cx; y2 += cy
                x  += cx; y  += cy
            x1, y1 = (2 * cx - last_ctrl[0], 2 * cy - last_ctrl[1]) if last_ctrl else (cx, cy)
            current.extend(sample_cubic((cx, cy), (x1, y1), (x2, y2), (x, y), n=curve_samples))
            last_ctrl = (x2, y2)
            cx, cy = x, y
        else:
            # Unsupported command — skip its number
            i += 1

    if current:
        polylines.append(current)
    return polylines


def extract_paths_and_viewbox(svg: str):
    """Pull each <path d='...'/> out of the SVG and the overall viewBox."""
    path_d = re.findall(r'<path[^>]*d="([^"]*)"', svg)
    vb_match = re.search(r'viewBox="([^"]*)"', svg)
    if vb_match:
        vbx, vby, vbw, vbh = (float(n) for n in vb_match.group(1).split())
    else:
        # potrace also emits width/height + transform.  Compute later from points.
        vbx = vby = 0.0
        vbw = vbh = 1000.0
    return path_d, (vbx, vby, vbw, vbh)


# ── Coordinate mapping ──────────────────────────────────────────────

def map_to_logo(polylines, viewbox, target_w, target_h):
    """SVG (top-left, Y down) → Logo (center, Y up), uniformly scaled to fit."""
    # Compute the actual bounding box of the polyline points (more reliable than viewBox)
    xs = [x for poly in polylines for (x, _) in poly]
    ys = [y for poly in polylines for (_, y) in poly]
    if not xs:
        return []
    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    bw = max(maxx - minx, 1e-6)
    bh = max(maxy - miny, 1e-6)
    cx = (minx + maxx) / 2
    cy = (miny + maxy) / 2

    scale = min(target_w / bw, target_h / bh)

    # potrace's SVG output applies a `scale(1,-1)` transform on the path group,
    # which means the raw path coordinates are already in math-standard (Y-up)
    # orientation.  Logo is also Y-up, so we do NOT flip Y here.
    out = []
    for poly in polylines:
        out.append([((x - cx) * scale, (y - cy) * scale) for (x, y) in poly])
    return out


# ── Polyline simplification ─────────────────────────────────────────

def perpendicular_distance(p, a, b):
    """Distance from p to line segment a–b."""
    ax, ay = a; bx, by = b; px, py = p
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    qx, qy = ax + t * dx, ay + t * dy
    return ((px - qx) ** 2 + (py - qy) ** 2) ** 0.5


def rdp(points, epsilon):
    """Ramer-Douglas-Peucker polyline simplification."""
    if len(points) < 3 or epsilon <= 0:
        return points
    dmax, idx = 0.0, 0
    for i in range(1, len(points) - 1):
        d = perpendicular_distance(points[i], points[0], points[-1])
        if d > dmax:
            dmax, idx = d, i
    if dmax > epsilon:
        left = rdp(points[:idx + 1], epsilon)
        right = rdp(points[idx:], epsilon)
        return left[:-1] + right
    return [points[0], points[-1]]


# ── Circle detection ───────────────────────────────────────────────

def detect_circle(points, tol_radius=0.25, tol_aspect=1.22, min_points=10):
    """If `points` forms an approximate circle, return (cx, cy, r) else None.

    Used to swap noisy traced wheel paths for clean `CIRCLE_AT` calls.
    A polyline is "circular" if:
      - Its bounding box is nearly square (within tol_aspect)
      - All points are within `tol_radius` of the mean distance to the centroid
    """
    if len(points) < min_points:
        return None
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    bw, bh = maxx - minx, maxy - miny
    if bw < 4 or bh < 4:
        return None
    aspect = max(bw, bh) / max(min(bw, bh), 1e-6)
    if aspect > tol_aspect:
        return None

    cx = (minx + maxx) / 2
    cy = (miny + maxy) / 2
    dists = [((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 for (x, y) in points]
    r_mean = sum(dists) / len(dists)
    if r_mean < 3:
        return None
    deviation = max(abs(d - r_mean) for d in dists) / r_mean
    if deviation > tol_radius:
        return None

    return (cx, cy, r_mean)


# ── Logo code emission ─────────────────────────────────────────────

def emit_logo(polylines, proc_name, pen_width=2, simplify_epsilon=0.6, detect_circles=True):
    lines = [
        f'; Auto-traced by tools/image-to-logo.py — edit at your own risk.',
        f'',
        f'TO {proc_name}',
        f'  CS HT',
        f'  SETPC 0 SETPENWIDTH {pen_width}',
        f'',
    ]
    total_points = 0
    drawn_paths = 0
    circles_detected = 0
    for i, poly in enumerate(polylines):
        if len(poly) < 2:
            continue

        # Try circle detection BEFORE simplification (works on the dense
        # original points where the shape is most reliably round).
        if detect_circles:
            circle = detect_circle(poly)
            if circle is not None:
                cx, cy, r = circle
                drawn_paths += 1
                circles_detected += 1
                lines.append(f'  ; path {drawn_paths} — circle')
                lines.append(f'  CIRCLE_AT {cx:.1f} {cy:.1f} {r:.1f}')
                lines.append('')
                continue

        # Otherwise emit as a SETXY polyline (with RDP simplification)
        simplified = rdp(poly, simplify_epsilon) if simplify_epsilon > 0 else poly
        if len(simplified) < 2:
            continue
        total_points += len(simplified)
        drawn_paths += 1
        lines.append(f'  ; path {drawn_paths} — {len(simplified)} points')
        x0, y0 = simplified[0]
        lines.append(f'  PU SETXY {x0:.1f} {y0:.1f} PD')
        for (x, y) in simplified[1:]:
            lines.append(f'  SETXY {x:.1f} {y:.1f}')
        lines.append('')
    lines += [f'END', '', f'{proc_name}', '']
    return '\n'.join(lines), drawn_paths, total_points, circles_detected


# ── Manifest + bundle update ───────────────────────────────────────

def update_manifest(manifest_path: Path, category: str, entry: dict):
    manifest = json.loads(manifest_path.read_text())
    cat = next((c for c in manifest['categories'] if c['id'] == category), None)
    if cat is None:
        cat = {'id': category, 'label': category.title(), 'prebuilts': []}
        manifest['categories'].append(cat)
    # Replace if exists
    existing = next((i for i, p in enumerate(cat['prebuilts']) if p['id'] == entry['id']), None)
    if existing is not None:
        cat['prebuilts'][existing] = entry
    else:
        cat['prebuilts'].append(entry)
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')


# ── CLI ────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description='Convert an image to a Luigi Logo Tortoise prebuilt.')
    ap.add_argument('image', help='Source image path')
    ap.add_argument('--name', required=True, help='Prebuilt id (kebab-case)')
    ap.add_argument('--category', default='scene', help='Prebuilt category (default: scene)')
    ap.add_argument('--label', help='Display label (default: derived from --name)')
    ap.add_argument('--icon', default='🎨', help='Emoji icon')

    ap.add_argument('--width',  type=int, default=600, help='Target Logo width  (default: 600)')
    ap.add_argument('--height', type=int, default=320, help='Target Logo height (default: 320)')

    ap.add_argument('--threshold', type=int, default=128, help='Black/white threshold 0-255 (default: 128)')
    ap.add_argument('--invert', action='store_true', help='Invert the image (use when art is LIGHT on a DARK background)')
    ap.add_argument('--blur', type=int, default=0, help='Gaussian blur radius before thresholding (default: 0)')
    ap.add_argument('--dilate', type=int, default=0, help='Thicken (dilate) foreground lines by N pixels — helps preserve thin features when turdsize is high (default: 0)')

    ap.add_argument('--turdsize',   type=int,   default=5,   help='Suppress speckles smaller than N pixels (default: 5)')
    ap.add_argument('--alphamax',   type=float, default=1.0, help='potrace alphamax — curve smoothness (default: 1.0)')
    ap.add_argument('--opttolerance', type=float, default=0.2, help='potrace opttolerance (default: 0.2)')
    ap.add_argument('--curve-samples', type=int, default=10, help='Points sampled per cubic Bezier (default: 10)')
    ap.add_argument('--simplify',  type=float, default=0.6, help='Ramer-Douglas-Peucker epsilon in Logo units (default: 0.6, 0=off)')

    ap.add_argument('--pen-width', type=int, default=2, help='Logo pen width (default: 2)')
    ap.add_argument('--no-detect-circles', action='store_true',
                    help='Disable auto-replacement of circular paths with CIRCLE_AT calls')

    ap.add_argument('--out-dir', default=str(ROOT / 'prebuilts'), help='Prebuilts root')
    ap.add_argument('--no-manifest', action='store_true', help='Skip updating index.json')
    ap.add_argument('--no-build',    action='store_true', help='Skip rebuilding registry.js')
    ap.add_argument('--dump-svg',    help='Also write the intermediate SVG to this path (for debugging)')

    args = ap.parse_args()

    if not check_potrace():
        print('ERROR: potrace not found.  Install: brew install potrace', file=sys.stderr)
        sys.exit(1)

    label = args.label or args.name.replace('-', ' ').replace('_', ' ').title()
    proc_name = re.sub(r'\W+', '_', args.name.upper()).strip('_') or 'SHAPE'

    print(f'[1/5] Converting {args.image} → PBM ...')
    pbm = image_to_pbm(args.image, args.threshold, args.invert, args.blur, args.dilate)

    print(f'[2/5] Running potrace ...')
    svg = run_potrace(pbm, args.turdsize, args.alphamax, args.opttolerance)
    os.unlink(pbm)

    if args.dump_svg:
        Path(args.dump_svg).write_text(svg)
        print(f'      (intermediate SVG → {args.dump_svg})')

    print(f'[3/5] Parsing SVG paths ...')
    path_d_list, viewbox = extract_paths_and_viewbox(svg)
    polylines = []
    for d in path_d_list:
        polylines.extend(parse_path_d(d, curve_samples=args.curve_samples))
    print(f'      → {len(polylines)} paths')

    print(f'[4/5] Mapping to Logo coords ({args.width} x {args.height}) ...')
    logo_polys = map_to_logo(polylines, viewbox, args.width, args.height)

    print(f'[5/5] Emitting Logo code ...')
    code, path_count, point_count, circle_count = emit_logo(
        logo_polys, proc_name,
        pen_width=args.pen_width,
        simplify_epsilon=args.simplify,
        detect_circles=not args.no_detect_circles,
    )
    print(f'      → {path_count} paths kept '
          f'({circle_count} replaced with CIRCLE_AT), '
          f'{point_count} polyline points')

    cat_dir = Path(args.out_dir) / args.category
    cat_dir.mkdir(parents=True, exist_ok=True)
    out_path = cat_dir / f'{args.name}.logo'
    out_path.write_text(code)
    print(f'\nWrote {out_path}')

    if not args.no_manifest:
        manifest_path = Path(args.out_dir) / 'index.json'
        entry = {
            'id': args.name,
            'label': label,
            'icon': args.icon,
            'file': f'{args.category}/{args.name}.logo',
        }
        update_manifest(manifest_path, args.category, entry)
        print(f'Updated {manifest_path}')

    if not args.no_build:
        build_script = ROOT / 'tools' / 'build-prebuilts.py'
        subprocess.run(['python3', str(build_script)], check=True)


if __name__ == '__main__':
    main()
