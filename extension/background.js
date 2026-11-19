// Reçoit les tips du chat, choisit l'action (feed / cuddle) et l'envoie à OBS
// par le serveur WebSocket intégré d'OBS (v5) : requête BroadcastCustomEvent,
// que l'overlay des enfants reçoit sous forme d'événement CustomEvent.

// Réglages propres à la streameuse (modifiables dans la popup) : seulement OBS et la jauge.
const DEFAULTS = {
  obsPort: 4455,
  obsPassword: '',
  heatMax: 200,      // tokens pour remplir la jauge de chaleur à 100 %
};
const APP = 'enfants-champignons';
const SITE = 'https://vinceixiv.github.io/Mushroom-kid/extension/';

// Les interactions (items du tip menu, prix, boutons de test) viennent du fichier extension/interactions.json
// sur la page GitHub : on le modifie là-bas, et l'extension suit toute seule, sans mise à jour.
// Cette liste-ci ne sert que si le fichier n'a encore jamais pu être téléchargé.
const BUILTIN_INTERACTIONS = [
  { id: 'feed',   type: 'feed',     label: 'Feed the baby',   amount: 8,  emoji: '🍪', name: { en: 'Feed', vi: 'Cho ăn' } },
  { id: 'cuddle', type: 'cuddle',   label: 'Cuddle the baby', amount: 16, emoji: '🤗', name: { en: 'Cuddle', vi: 'Ôm' } },
  { id: 'hf0',    type: 'highfive', label: 'High five baby',  amount: 3,  emoji: '✋', name: { en: 'High five', vi: 'Đập tay' } },
];

async function getSettings() {
  const s = await chrome.storage.local.get(null);
  const list = Array.isArray(s.interactions) && s.interactions.length ? s.interactions : BUILTIN_INTERACTIONS;
  // ses noms et prix à elle (popup) gagnent sur les valeurs par défaut de la liste
  const mine = s.overrides || {};
  const actions = list.filter((a) => a && a.id && a.type).map((a) => ({ ...a, ...(mine[a.id] || {}) })).filter((a) => a.label);
  return { ...DEFAULTS, ...s, actions };
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
    d: { requestType: 'BroadcastCustomEvent', requestId: String(++reqId), requestData: { eventData: { app: APP, heatMax: Number(heatMax) || 200, ...eventData } } },
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

function decide(tip, s) {
  // D'abord dans le nom de l'item du tip menu, puis (filet de sécurité, si l'affichage du chat diffère)
  // dans tout le texte du tip : il faut de toute façon un vrai tip pour arriver ici.
  const places = [tip.menu ? norm(tip.comment) : '', norm(tip.text)];
  for (const where of places) {
    if (!where) continue;
    for (const a of s.actions) if (a.label && where.includes(norm(a.label))) return a;
  }
  return null;
}

/* ---------------- Réglages à distance (page GitHub) ----------------
   - extension/interactions.json : les items du tip menu, leurs prix, les boutons de test
   - extension/rules.json        : les repères pour lire le chat Stripchat
   Relus à l'ouverture de la popup (force) et au chargement d'une page Stripchat (au plus une fois par minute).
   Hors ligne, on garde la dernière version téléchargée. */
async function refreshRemote(force) {
  const { remoteAt = 0 } = await chrome.storage.local.get('remoteAt');
  if (!force && Date.now() - remoteAt < 60 * 1000) return;
  const get = async (f) => { const r = await fetch(SITE + f + '?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error(f); return r.json(); };
  const update = { remoteAt: Date.now() };
  try { const list = await get('interactions.json'); if (Array.isArray(list.interactions) && list.interactions.length) update.interactions = list.interactions; } catch (e) {}
  try { update.rules = await get('rules.json'); } catch (e) {}
  await chrome.storage.local.set(update);
}

/* ---------------- Diagnostic (affiché replié en bas de la popup) ---------------- */
async function diag(update) {
  const { diag: d = { tips: 0, last: null, unknown: [], frames: [] } } = await chrome.storage.session.get('diag');
  update(d);
  await chrome.storage.session.set({ diag: d });
}

/* ---------------- Doublons ----------------
   Le même tip peut être vu plusieurs fois : deux onglets Stripchat de la room (page de diffusion + page viewer),
   plusieurs cadres, ou les deux méthodes de détection. On ne l'anime qu'une fois.
   - avec un identifiant de message (data-message-id) : doublon seulement si on a déjà vu cet identifiant ;
   - sans identifiant : doublon si même pseudo et même montant il y a moins de 8 s. */
const recentTips = new Map();
function isDuplicateTip(msg) {
  const now = Date.now();
  for (const [k, t] of recentTips) if (now - t > 8000) recentTips.delete(k);
  const sig = 'sig:' + String(msg.user || '').toLowerCase() + '|' + msg.amount;
  const id = msg.id ? 'id:' + msg.id : '';
  if (id ? recentTips.has(id) : recentTips.has(sig)) return true;
  if (id) recentTips.set(id, now);
  recentTips.set(sig, now);
  return false;
}

/* ---------------- Messages (content script et popup) ---------------- */
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  // vérifié tout de suite (avant toute attente), pour que deux onglets simultanés ne passent pas tous les deux
  if (msg.type === 'tip' && isDuplicateTip(msg)) { reply({ ok: true, duplicate: true }); return true; }
  (async () => {
    const s = await getSettings();
    if (msg.type === 'hello') {
      refreshRemote(false);
      await diag((d) => { d.frames = [...new Set([msg.frame + ' ' + msg.url, ...(d.frames || [])])].slice(0, 4); });
      reply({ ok: true });
    } else if (msg.type === 'unknown') {
      await diag((d) => { d.unknown = [msg.sample, ...(d.unknown || [])].slice(0, 4); });
      reply({ ok: true });
    } else if (msg.type === 'tip') {
      // Seuls les tips qui déclenchent une animation sont gardés dans la liste de la popup
      const action = decide(msg, s);
      await diag((d) => {
        d.tips = (d.tips || 0) + 1;
        d.last = { user: msg.user, amount: msg.amount, menu: msg.menu, comment: msg.comment, text: msg.text.slice(0, 120), action: action ? action.id : null };
      });
      if (action) {
        let sent = false, error = '';
        // la jauge avance du montant réglé dans l'extension pour cet item (pas du montant lu dans le chat)
        const amount = Number(action.amount) || 0;
        try { await sendToOBS({ type: action.type, kid: action.kid, user: msg.user, amount }); sent = true; }
        catch (e) { error = e.message; }
        await log({ user: msg.user, amount, item: msg.menu ? msg.comment : '', action: action.id, sent, error });
      }
      reply({ ok: true });
    } else if (msg.type === 'simulate') {
      const a = s.actions.find((x) => x.id === msg.action);
      const ev = msg.action === 'reset' || !a ? { type: 'reset' }
        : { type: a.type, kid: a.kid, user: msg.user || 'Phi', amount: Number(a.amount) || 0 };
      try { await sendToOBS(ev); await log({ user: ev.user || '—', amount: ev.amount || 0, action: msg.action, sent: true, simulated: true }); reply({ ok: true }); }
      catch (e) { reply({ ok: false, error: e.message }); }
    } else if (msg.type === 'refreshRemote') {
      await refreshRemote(true);
      reply({ ok: true });
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
  // anciens réglages d'interactions (avant 0.3) : remplacés par la liste distante.
  // Le mot de passe, le port et le total de la jauge sont gardés.
  delete s.actions; delete s.rulesAt;
  await chrome.storage.local.remove(['actions', 'rulesAt']);
  await chrome.storage.local.set({ ...DEFAULTS, ...s, remoteAt: 0 });
  refreshRemote(true);
});
chrome.runtime.onStartup.addListener(() => refreshRemote(true));
