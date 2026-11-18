// Lance Edge headless sur une URL, prend des captures en continu pendant N ms, enregistre frames + timings.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const [, , url, outDir, durMs, port, slowArg] = process.argv;
const slow = Number(slowArg) || 1;
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
fs.mkdirSync(outDir, { recursive: true });
const prof = outDir + '/_profile';
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-sync',
  `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=480,360', url], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let page;
for (let i = 0; i < 40 && !page; i++) {
  await sleep(250);
  try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((p) => p.type === 'page' && p.url.includes('demo.html')); } catch (e) {}
}
if (!page) { console.log('no page'); edge.kill(); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
await new Promise((r) => (ws.onopen = r));
const call = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await call('Emulation.setDeviceMetricsOverride', { width: 480, height: 360, deviceScaleFactor: 1, mobile: false });
await call('Animation.enable');
await call('Animation.setPlaybackRate', { playbackRate: 1 / slow });
await call('Page.reload');   // repart de zéro maintenant que la capture est prête
await call('Animation.setPlaybackRate', { playbackRate: 1 / slow });
await sleep(150);
const t0 = Date.now(); const times = []; let n = 0;
while (Date.now() - t0 < Number(durMs) * slow) {
  const shot = await call('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${outDir}/f${String(n).padStart(4, '0')}.png`, Buffer.from(shot.data, 'base64'));
  times.push(Date.now() - t0); n++;
  await sleep(20);
}
fs.writeFileSync(`${outDir}/times.json`, JSON.stringify(times));
try { await call('Browser.close'); } catch (e) {}
edge.kill();
console.log(outDir, n, 'frames');
process.exit(0);
