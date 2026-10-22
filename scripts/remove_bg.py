import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

SRC = 'renderer/assets/pet-sprite.jpg'
DST = 'renderer/assets/pet-sprite.png'
WHITE_THRESHOLD = 240  # channel value above which a pixel counts as "near white"

im = Image.open(SRC).convert('RGB')
arr = np.array(im)

near_white = np.all(arr >= WHITE_THRESHOLD, axis=2)

# The character outline is sometimes too faint/thin, letting the body's
# near-white interior leak into the surrounding near-white background
# through a 1-2px gap. Erode first to sever those leaks, find which
# component actually touches the border, then dilate back to the
# original extent (intersected with the original mask) to restore the
# true background shape without the leaked gaps.
SEAL_ITER = 10
eroded = ndimage.binary_erosion(near_white, iterations=SEAL_ITER, border_value=1)

labels, n = ndimage.label(eroded, structure=np.ones((3, 3)))

border_labels = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
border_labels.discard(0)

background_seed = np.isin(labels, list(border_labels))
background_mask = ndimage.binary_dilation(background_seed, iterations=SEAL_ITER) & near_white

alpha = np.where(background_mask, 0, 255).astype(np.uint8)

# JPEG compression noise in otherwise-plain-white areas sometimes dips a
# pixel or two just below WHITE_THRESHOLD, so it's never classified as
# background at all and survives as a tiny stray opaque speck/sliver.
# Each real design element (the character, hearts, sparkles, the wave
# marks, ...) is a sizeable connected blob, so drop any opaque component
# below a minimum pixel area as noise.
MIN_FOREGROUND_AREA = 90
fg_labels, fg_n = ndimage.label(alpha > 10, structure=np.ones((3, 3)))
if fg_n > 0:
    sizes = ndimage.sum(alpha > 10, fg_labels, index=np.arange(1, fg_n + 1))
    noise_labels = np.flatnonzero(sizes < MIN_FOREGROUND_AREA) + 1
    alpha[np.isin(fg_labels, noise_labels)] = 0

# A thinner kind of noise: a 1-2px wide stray bridge that stays attached
# to the main character silhouette (so the area filter above can't tell
# it apart), trailing off into empty space like a hair. A morphological
# opening erases anything narrower than SPUR_WIDTH while leaving the
# (much wider) real silhouette untouched.
SPUR_WIDTH = 3
opaque_mask = alpha > 10
opened = ndimage.binary_opening(opaque_mask, structure=np.ones((3, 3)), iterations=SPUR_WIDTH)
alpha[opaque_mask & ~opened] = 0


def trim_head_bump(alpha, rgb, cell_box, margin=3):
    """Remove the furry peak that sticks up above the crown, between the
    two ear tips, leaving the crown's own silhouette as the new top edge.
    Detects the ear/bump/ear peak pattern from the alpha silhouette and
    the crown from its blue hue; skips the cell untouched if either
    pattern isn't confidently found (e.g. back/turn/sleep poses)."""
    x0, y0, x1, y1 = cell_box
    a = alpha[y0:y1, x0:x1]
    rgb_cell = rgb[y0:y1, x0:x1]
    h, w = a.shape
    opaque = a > 10

    lo, hi = int(w * 0.15), int(w * 0.85)
    top_y = np.full(w, h)
    for x in range(lo, hi):
        col = np.where(opaque[:, x])[0]
        if len(col):
            top_y[x] = col[0]

    region_top = top_y[lo:hi]
    if region_top.min() >= h * 0.6:
        return  # nothing confidently found near the top in this cell

    smoothed = ndimage.uniform_filter1d(region_top.astype(float), size=5)

    # local minima = peaks poking up (ears / center bump)
    peaks = []
    for i in range(2, len(smoothed) - 2):
        if smoothed[i] <= smoothed[i - 2] and smoothed[i] <= smoothed[i + 2] and smoothed[i] < h * 0.55:
            peaks.append(i + lo)
    merged = []
    for p in peaks:
        if merged and p - merged[-1][-1] <= 10:
            merged[-1].append(p)
        else:
            merged.append([p])
    peak_xs = [int(np.mean(g)) for g in merged]
    if len(peak_xs) < 3:
        return  # need left ear / center bump / right ear to identify the bump

    peak_ys = [int(top_y[x]) for x in peak_xs]
    center_i = int(np.argmin(peak_ys))  # tallest peak = the center bump
    if center_i == 0 or center_i == len(peak_xs) - 1:
        return  # tallest peak isn't in the middle; pattern doesn't match

    left_x, bump_x, right_x = peak_xs[center_i - 1], peak_xs[center_i], peak_xs[center_i + 1]

    def saddle(a_x, b_x):
        seg = top_y[a_x:b_x + 1]
        i = int(np.argmax(seg))
        return a_x + i, int(seg[i])

    left_sx, left_sy = saddle(left_x, bump_x)
    right_sx, right_sy = saddle(bump_x, right_x)

    r, g, b = rgb_cell[:, :, 0].astype(int), rgb_cell[:, :, 1].astype(int), rgb_cell[:, :, 2].astype(int)
    is_blue = opaque & (b - r > 15) & (b > 180)

    for x in range(left_sx, right_sx + 1):
        t = (x - left_sx) / max(1, (right_sx - left_sx))
        saddle_y = left_sy + t * (right_sy - left_sy)
        col_blue = np.where(is_blue[:, x])[0]
        target_y = (col_blue.min() - margin) if len(col_blue) else saddle_y
        cut_y = int(min(saddle_y, target_y))
        if cut_y > 0:
            a[0:cut_y, x] = 0

    alpha[y0:y1, x0:x1] = a


# The 12 poses are NOT laid out on an evenly-spaced grid (some rows/
# cells need more room than others), so slicing by a uniform w/4 x h/3
# grid cuts into neighbouring frames. Find the real boundaries instead,
# from the gaps (rows/columns with no opaque pixels at all) between the
# actual artwork.
def find_gaps(counts, total, min_gap=15):
    """Runs of all-empty rows/columns, filtered to drop noise-width gaps.
    Margins touching the image edge are kept regardless of width (there's
    no neighbouring cell to confuse them with); only *internal* gaps need
    the width filter to avoid false boundaries from stray single-pixel
    rows of zero opacity."""
    gaps = []
    in_gap = counts[0] == 0
    start = 0
    for i in range(1, total):
        empty = counts[i] == 0
        if empty and not in_gap:
            start, in_gap = i, True
        elif not empty and in_gap:
            is_edge = start == 0
            if is_edge or i - start >= min_gap:
                gaps.append((start, i))
            in_gap = False
    if in_gap:
        gaps.append((start, total))
    return gaps


opaque_full = alpha > 10
row_gaps = find_gaps(opaque_full.sum(axis=1), alpha.shape[0])
col_gaps = find_gaps(opaque_full.sum(axis=0), alpha.shape[1])

# internal boundaries = gaps that don't touch either edge of the sheet
row_internal = [g for g in row_gaps if g[0] > 0 and g[1] < alpha.shape[0]]
col_internal = [g for g in col_gaps if g[0] > 0 and g[1] < alpha.shape[1]]

row_mids = [0] + [(a + b) // 2 for a, b in row_internal] + [alpha.shape[0]]
col_mids = [0] + [(a + b) // 2 for a, b in col_internal] + [alpha.shape[1]]
ROW_BOUNDS = list(zip(row_mids, row_mids[1:]))
COL_BOUNDS = list(zip(col_mids, col_mids[1:]))
assert len(ROW_BOUNDS) == 3 and len(COL_BOUNDS) == 4, (ROW_BOUNDS, COL_BOUNDS)

# Only needed for the flat-illustration sprite sheet, where the fur
# silhouette pokes up above the crown between the two ear tips. The
# rounder 3D/plush-style sheet doesn't have that problem, and the same
# peak-finding heuristic misfires on its different head shape (it found
# a false "bump" and carved a notch out of an ear instead).
APPLY_HEAD_BUMP_TRIM = False
if APPLY_HEAD_BUMP_TRIM:
    for y0, y1 in ROW_BOUNDS:
        for x0, x1 in COL_BOUNDS:
            trim_head_bump(alpha, arr, (x0, y0, x1, y1))

NAMES = [
    ['idle', 'blink', 'turn', 'back'],
    ['sparkle', 'love', 'confused', 'sleep'],
    ['_unused1', '_unused2', '_unused3', 'wave'],
]

# The "confused" pose's floating "?" reads as a separate, smaller blob
# next to the (much larger) character in its cell, so drop every opaque
# component there except the biggest one.
CELL_OF = {name: (r, c) for r, row in enumerate(NAMES) for c, name in enumerate(row)}
for name in ('confused',):
    r, c = CELL_OF[name]
    y0, y1 = ROW_BOUNDS[r]
    x0, x1 = COL_BOUNDS[c]
    cell_alpha = alpha[y0:y1, x0:x1]
    opaque = cell_alpha > 10
    cell_labels, cell_n = ndimage.label(opaque, structure=np.ones((3, 3)))
    if cell_n > 1:
        sizes = ndimage.sum(opaque, cell_labels, index=np.arange(1, cell_n + 1))
        main_label = int(np.argmax(sizes)) + 1
        cell_alpha[(cell_labels != main_label) & (cell_labels != 0)] = 0

PAD = 6
tight = {}
for r, (y0, y1) in enumerate(ROW_BOUNDS):
    for c, (x0, x1) in enumerate(COL_BOUNDS):
        cell_alpha = alpha[y0:y1, x0:x1]
        ys, xs = np.where(cell_alpha > 10)
        if len(ys) == 0:
            continue  # pose intentionally left blank in the source sheet
        top = max(0, ys.min() - PAD)
        bottom = min(cell_alpha.shape[0], ys.max() + PAD + 1)
        left = max(0, xs.min() - PAD)
        right = min(cell_alpha.shape[1], xs.max() + PAD + 1)
        rgba_cell = np.dstack([arr[y0:y1, x0:x1], cell_alpha])[top:bottom, left:right]
        tight[NAMES[r][c]] = rgba_cell

# Re-pack every pose into a uniform grid, each frame centred horizontally
# and sharing the same bottom baseline, so the CSS background-position
# percentage math (which assumes equal cells) lines up exactly and the
# pet doesn't jump vertically when it switches pose.
cell_w = max(f.shape[1] for f in tight.values())
cell_h = max(f.shape[0] for f in tight.values())
BASELINE_MARGIN = 10

canvas = Image.new('RGBA', (cell_w * 4, cell_h * 3), (0, 0, 0, 0))
for r in range(3):
    for c in range(4):
        f = tight.get(NAMES[r][c])
        if f is None:
            continue
        fh, fw = f.shape[:2]
        x_off = c * cell_w + (cell_w - fw) // 2
        y_off = max(r * cell_h, (r + 1) * cell_h - fh - BASELINE_MARGIN)
        canvas.alpha_composite(Image.fromarray(f, 'RGBA'), (x_off, y_off))

alpha_arr = np.array(canvas)[:, :, 3]
alpha_img = Image.fromarray(alpha_arr, mode='L').filter(ImageFilter.GaussianBlur(radius=0.4))

# Tighten the blurred transition band so the edge reads as deliberately
# anti-aliased rather than faded/smudged, without going fully jagged.
alpha_f = np.array(alpha_img).astype(np.float32)
alpha_f = np.clip((alpha_f - 127.5) * 1.8 + 127.5, 0, 255)

rgb_arr = np.array(canvas)[:, :, :3]
out = Image.fromarray(np.dstack([rgb_arr, alpha_f.astype(np.uint8)]), 'RGBA')
out.save(DST)
print('saved', DST, out.size, 'cell size', cell_w, cell_h)
