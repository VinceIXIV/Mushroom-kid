import json, sys, os
from PIL import Image
src, out, slow = sys.argv[1], sys.argv[2], float(sys.argv[3])
times = [t / slow for t in json.load(open(os.path.join(src, 'times.json')))]
STEP = 40
frames, used = [], []
t, j = 0.0, 0
while t <= times[-1]:
    while j + 1 < len(times) and times[j + 1] <= t: j += 1
    used.append(j); t += STEP
# saute le tout début (rechargement de la page)
used = used[3:]
W = int(sys.argv[4]) if len(sys.argv) > 4 else 480
H = W * 3 // 4
load = lambda j: Image.open(os.path.join(src, 'f%04d.png' % j)).convert('RGB').resize((W, H), Image.LANCZOS)
# une seule palette pour tout le GIF : les images successives ne diffèrent que là où ça bouge
sample = [used[int(k * (len(used) - 1) / 11)] for k in range(12)]
sheet = Image.new('RGB', (W * 4, H * 3))
for k, j in enumerate(sample): sheet.paste(load(j), ((k % 4) * W, (k // 4) * H))
pal = sheet.quantize(colors=255, method=0)
for j in used:
    frames.append(load(j).quantize(palette=pal, dither=0))
frames[0].save(out, save_all=True, append_images=frames[1:], duration=STEP, loop=0, optimize=False)
print(out, len(frames), 'frames', len(set(used)), 'unique', round(os.path.getsize(out) / 1e6, 2), 'MB')
