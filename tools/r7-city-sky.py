# R7: from one night photo, bake the "Tel Aviv" twin: the same frame and the same stars,
# under urban skyglow. Faint stars are lost in the glow; only the brightest survive.
import sys, numpy as np
from PIL import Image, ImageFilter
src, out, horizon = sys.argv[1], sys.argv[2], float(sys.argv[3])  # horizon: fraction of height
im = Image.open(src).convert('RGB')
W, H = im.size
a = np.asarray(im).astype(float)
# sky without stars: a median wipes out point sources, a light blur smooths what is left
smooth = np.asarray(im.filter(ImageFilter.MedianFilter(9)).filter(ImageFilter.GaussianBlur(2))).astype(float)
stars = np.clip(a - smooth, 0, None)
lum = stars.mean(2)
keep = lum > np.percentile(lum[: int(H * horizon)], 99.97)  # the brightest ~0.15% of sky pixels
keep = np.asarray(Image.fromarray((keep * 255).astype('uint8')).filter(ImageFilter.MaxFilter(3))) > 0
y = np.arange(H)[:, None] / H
# skyglow: sodium orange at the horizon, fading to a dull brown-grey overhead
d = np.clip((horizon - y) / horizon, 0, 1)  # 0 at horizon, 1 at top
glow_amt = 0.45 + 0.75 * np.exp(-d * 3.2)
glow_col = np.array([150, 92, 58]) * (1 - d[..., None]) + np.array([62, 52, 58]) * d[..., None]
# the real skyline, per column: in a night shot the sky brightens toward the horizon and the land
# below is darker, so the skyline is the sharpest bright-to-dark drop going down each column
L = np.asarray(im.convert('L').filter(ImageFilter.GaussianBlur(3))).astype(float)
lo, hi = int(H * (horizon - 0.06)), int(H * (horizon + 0.05))
d = L[lo + 4:hi] - L[lo:hi - 4]  # change over 4 rows; most negative = the drop
edge = lo + 2 + np.argmin(d, axis=0).astype(float)
# a wide median drops stray columns (a star, a rock), then a light blur keeps the line natural
k = 90
edge = np.array([np.median(edge[max(0, i - k):i + k]) for i in range(W)])
edge = np.convolve(np.pad(edge, 12, mode='edge'), np.ones(25) / 25, 'valid')
sky_mask = np.clip((edge[None, :] - np.arange(H)[:, None]) / 3 + 0.5, 0, 1)[..., None]  # soft 3px edge
sky = smooth * 0.3 + glow_col * glow_amt[..., None] + stars * keep[..., None] * 0.75
# the ground picks up a little of the city's light
ground = a * 0.85 + np.array([40, 24, 14]) * 0.6
res = sky * sky_mask + ground * (1 - sky_mask)
Image.fromarray(np.clip(res, 0, 255).astype('uint8')).save(out)
print('kept stars px', keep[: int(H * horizon)].mean())
