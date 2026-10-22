# R7, the city side: the real Tel Aviv skyline (Unsplash photo) under the very same sky as the
# crater side. The sky is the crater frame with city skyglow (r7-city-sky.py), so every star that
# survives the glow sits exactly where it is over Ramon; the towers, road and lamps are the photo.
import sys, numpy as np
from PIL import Image, ImageFilter
city_sky, ta, out = sys.argv[1], sys.argv[2], sys.argv[3]
sky = Image.open(city_sky).convert('RGB'); W, H = sky.size
HORIZON = 0.665  # the crater frame's horizon, as a fraction of its height
im = Image.open(ta).convert('RGB')
s = W / im.width; th = round(im.height * s)
im = im.resize((W, th), Image.LANCZOS).crop((0, th - H, W, th))  # bottom-aligned: keep the road
a = np.asarray(im).astype(float)
# The skyline, traced by hand in the source photo's coordinates (1800 x 1200): automatic
# segmentation confused the street lamps' halos with buildings. Everything under the low
# skyline (trees, low roofs, the bridge and the road) is city too.
from PIL import ImageDraw
SRC_W, SRC_H = 1800, 1200
towers = [
    [(690, 305), (750, 305), (750, 318), (795, 330), (797, 900), (652, 900), (655, 330), (690, 318)],
    [(805, 440), (850, 440), (850, 385), (995, 385), (1000, 900), (805, 900)],
    [(465, 605), (600, 605), (600, 900), (465, 900)],
    [(1040, 688), (1240, 688), (1240, 900), (1040, 900)],
    [(1285, 698), (1360, 698), (1362, 900), (1283, 900)],
    [(1445, 668), (1505, 668), (1512, 668), (1572, 668), (1580, 900), (1445, 900)],
]
# the low skyline (trees, roofs) is ragged in the photo: a soft band, not a ruler line
mask = Image.new('L', (SRC_W, SRC_H), 0)
d = ImageDraw.Draw(mask)
for poly in towers:
    d.polygon(poly, fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(1.2))
low = Image.new('L', (SRC_W, SRC_H), 0)
ImageDraw.Draw(low).rectangle((0, 872, SRC_W, SRC_H), fill=255)
low = low.filter(ImageFilter.GaussianBlur(7))
mask = Image.fromarray(np.maximum(np.asarray(mask), np.asarray(low)))
mask = mask.resize((W, th), Image.LANCZOS).crop((0, th - H, W, th))
fg = (np.asarray(mask).astype(float) / 255)[..., None]
# the sky: the crater frame with skyglow down to its horizon; below that, where the crater's land
# would be, continue the glow gradient (no stars that low over a city anyway)
b = np.asarray(sky).astype(float)
hz = int(H * HORIZON) - 6
band = b[hz - 30:hz].mean(0)
b[hz:] = band[None, :, :] * 1.05

# lamps and lit tops above the skyline add their light to the new sky
light = np.clip(a - 22, 0, None) * (1 - fg)
res = a * fg + (b + light) * (1 - fg)
Image.fromarray(np.clip(res, 0, 255).astype('uint8')).save(out)
