# Recover the site's baked duotone grade (graded = 0.45*orig + 0.55*map(luminance))
# from the raw/graded photo pairs in public/photos, and save the map as a 256-entry LUT.
import numpy as np, glob, sys
from PIL import Image
A = 0.45
root = sys.argv[1]
sums = np.zeros((256, 3)); cnt = np.zeros(256)
for raw in glob.glob(f'{root}/public/photos/*-800-raw.webp'):
    r = np.asarray(Image.open(raw).convert('RGB')).astype(float)
    g = np.asarray(Image.open(raw.replace('-raw', '')).convert('RGB')).astype(float)
    L = np.clip((0.2126*r[...,0] + 0.7152*r[...,1] + 0.0722*r[...,2]).round().astype(int), 0, 255)
    d = (g - A*r) / (1 - A)
    for c in range(3):
        sums[:, c] += np.bincount(L.ravel(), d[..., c].ravel(), 256)
    cnt += np.bincount(L.ravel(), minlength=256)
ok = cnt > 200
x = np.arange(256)
lut = np.stack([np.interp(x, x[ok], sums[ok, c] / cnt[ok]) for c in range(3)], 1)
k = np.ones(9) / 9  # smooth
lut = np.stack([np.convolve(np.pad(lut[:, c], 4, mode='edge'), k, 'valid') for c in range(3)], 1)
np.save(sys.argv[2], np.clip(lut, 0, 255))
print(lut[::32].round())
