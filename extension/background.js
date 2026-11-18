// Reçoit les tips du chat, choisit l'action (feed / cuddle) et l'envoie à OBS
// par le serveur WebSocket intégré d'OBS (v5) : requête BroadcastCustomEvent,
// que l'overlay des enfants reçoit sous forme d'événement CustomEvent.

const DEFAULTS = {
  obsPort: 4455,
  obsPassword: '',
  room: '',          // vide = toutes les rooms ; sinon nom de la room (dans l'URL) à surveiller
  testMode: false,   // true = n'importe quel tip déclenche une animation (alternativement feed / cuddle)
  heatMax: 2000,     // tokens pour remplir la jauge de chaleur à 100 %
  actions: [
    { type: 'feed',   label: 'Feed the kids',   amount: 25 },
    { type: 'cuddle', label: 'Cuddle the kids', amount: 50 },
  ],
};
const APP = 'enfants-champignons';

async function getSettings() {
  const s = await chrome.storage.local.get(null);
  return { ...DEFAULTS, ...s, actions: s.actions || DEFAULTS.actions };
}

/* ---------------- Journal (affiché dans la popup) ---------------- */
async function log(entry) {
  const { log = [] } = await chrome.storage.session.get('log');
  log.unshift({ time: Date.now(), ...entry });
  await chrome.storage.session.set({ log: log.slice(0, 12) });
}
function setStatus(s) { chrome.storage.session.set({ obsStatus: s }); }

/* ---------------- Client WebSocket OBS ---------------- */
let ws = null;
let ready = null;
let reqId = 0;

async function b64sha(str) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return btoa(String.fromCharCode(...new Uint8Array(h)));
}

async function connect() {
  if (ws && ws.readyState === WebSocket.OPEN && ready) return ready;
  if (ws && ws.readyState === WebSocket.CONNECTING && ready) return ready;
  const s = await getSettings();
  setStatus('connecting…');
  ready = new Promise((resolve, reject) => {
    const sock = new WebSocket(`ws://127.0.0.1:${s.obsPort}`);
    ws = sock;
    const timer = setTimeout(() => { reject(new Error('OBS is not responding')); try { sock.close(); } catch (e) {} }, 5000);
    sock.onmessage = async (e) => {
      const m = JSON.parse(e.data);
      if (m.op === 0) { // Hello
        const d = { rpcVersion: 1, eventSubscriptions: 0 };
        if (m.d.authentication) {
          const { challenge, salt } = m.d.authentication;
          d.authentication = await b64sha((await b64sha(s.obsPassword + salt)) + challenge);
        }
        sock.send(JSON.stringify({ op: 1, d }));
      } else if (m.op === 2) { // Identified
        clearTimeout(timer);
        setStatus('connected');
        resolve();
      }
    };
    sock.onerror = () => {};
    sock.onclose = (e) => {
      clearTimeout(timer);
      if (ws === sock) { ws = null; ready = null; }
      const why = e.code === 4009 ? 'wrong OBS password' : 'cannot reach OBS (WebSocket server on? port?)';
      setStatus(why);
      reject(new Error(why));
    };
  });
  ready.catch(() => {});
  return ready;
}

// Chaque événement porte aussi le réglage de la jauge : l'overlay le retient.
async function sendToOBS(eventData) {
  await connect();
  const { heatMax } = await getSettings();
  ws.send(JSON.stringify({
    op: 6,
    d: { requestType: 'BroadcastCustomEvent', requestId: String(++reqId), requestData: { eventData: { app: APP, heatMax: Number(heatMax) || 2000, ...eventData } } },
  }));
}

// Garde le service worker et la connexion en vie pendant le live.
setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ op: 6, d: { requestType: 'GetVersion', requestId: 'ping' + (++reqId) } }));
  }
}, 20000);

/* ---------------- Choix de l'action ---------------- */
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
let testToggle = false;

function decide(tip, s) {
  if (s.room && !norm(tip.url).includes(norm(s.room))) return null;
  const text = norm(tip.text);
  for (const a of s.actions) if (a.label && text.includes(norm(a.label))) return a.type;   // item du tip menu
  for (const a of s.actions) if (Number(a.amount) > 0 && tip.amount === Number(a.amount)) return a.type; // montant exact
  if (s.testMode) { testToggle = !testToggle; return testToggle ? 'feed' : 'cuddle'; }
  return null;
}

/* ---------------- Messages (content script et popup) ---------------- */
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  (async () => {
    const s = await getSettings();
    if (msg.type === 'tip') {
      const action = decide(msg, s);
      let sent = false, error = '';
      if (action) {
        try { await sendToOBS({ type: action, user: msg.user, amount: msg.amount }); sent = true; }
        catch (e) { error = e.message; }
      }
      await log({ user: msg.user, amount: msg.amount, action, sent, error });
      reply({ ok: true });
    } else if (msg.type === 'simulate') {
      const a = s.actions.find((x) => x.type === msg.action);
      const ev = msg.action === 'reset' ? { type: 'reset' } : { type: msg.action, user: msg.user || 'Tester', amount: a ? Number(a.amount) : 0 };
      try { await sendToOBS(ev); await log({ user: ev.user || '—', amount: ev.amount || 0, action: msg.action, sent: true, simulated: true }); reply({ ok: true }); }
      catch (e) { reply({ ok: false, error: e.message }); }
    } else if (msg.type === 'reconnect') {
      try { if (ws) ws.close(); } catch (e) {}
      ws = null; ready = null;
      // (appelé aussi par Save) : envoie tout de suite le réglage de la jauge à l'overlay
      try { await connect(); await sendToOBS({ type: 'config' }); reply({ ok: true }); } catch (e) { reply({ ok: false, error: e.message }); }
    }
  })();
  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  const s = await chrome.storage.local.get(null);
  await chrome.storage.local.set({ ...DEFAULTS, ...s });
});
