# Fabrique demo.html : copie de l'overlay avec un fond "stream", hasard reproductible, sans nom ni OBS,
# et un scénario choisi par ?demo=idle|feed|cuddle|warmth
import sys
src, out = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()

seed = """<script>
(function(){ let a = 12345; Math.random = function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
try { localStorage.clear(); } catch (e) {}
(function(){ const k = Number(new URLSearchParams(location.search).get('slow')) || 1; if (k === 1) return; const st = window.setTimeout; window.setTimeout = (f, ms, ...a) => st(f, (ms || 0) * k, ...a); })();
</script>
<style>
  html, body { background: radial-gradient(ellipse at 50% 30%, #6b4a6e 0%, #3a2a45 55%, #221a2c 100%) !important; }
  .kid .name { display: none; }
</style>
<script>"""
s = s.replace("<script>", seed, 1)

driver = """
const demo = new URLSearchParams(location.search).get("demo");
const W = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  if (demo === "idle") {
    heatTokens = 900; render();
    await W(1200); await IDLE_SCENES[1](); resetPoses();
    await W(1200); await IDLE_SCENES[2](); resetPoses();
    await W(1000); await IDLE_SCENES[3](); resetPoses();
  } else if (demo === "feed") {
    heatTokens = 875; render();
    await W(900); kids.feed("LuckyTipper", 25);
  } else if (demo === "cuddle") {
    heatTokens = 1150; render();
    await W(900); kids.cuddle("SweetViewer", 50);
  } else if (demo === "warmth") {
    heatTokens = 0; render();
    await W(3200);
    for (let i = 0; i < 10; i++) { addHeat(200); await W(450); }
  }
})();
"""
import re
s = re.sub(r"idleLoop\(\);\s*\n.*connectOBS\(\);[^\n]*", lambda m: driver, s)
assert "const demo" in s
open(out, 'w', encoding='utf-8').write(s)
print("ok")
