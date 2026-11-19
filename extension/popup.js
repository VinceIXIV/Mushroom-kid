const $ = (id) => document.getElementById(id);

/* ---------- Langue de la popup : anglais / vietnamien (drapeaux à côté du titre) ---------- */
const TEXT = {
  en: {
    reconnect: 'Reconnect to OBS', tryIt: 'Try it', bubbleName: 'Name shown in the bubble', resetWarmth: 'Reset warmth',
    triggers: 'Tip menu',
    triggersHelp: '⚠️ Make each name and price match an item of your Stripchat tip menu (emojis and capitals don\'t matter), then click Save. The price is what the item adds to the warmth gauge. New interactions appear here by themselves. Leave a name empty to turn it off.',
    price: 'price (tk)',
    gauge: 'Warmth gauge', fullAt: 'The gauge is full (100%) at', tokens: 'tokens',
    gaugeHelp: 'Each tip menu animation adds its price (above) to the gauge. On stream, the gauge shows the percentage of this total.',
    password: 'WebSocket password', port: 'Port', save: 'Save', saved: 'Saved ✓',
    diag: '🔧 Diagnostics', diagHelp: 'If a tip menu tip does nothing: open your Stripchat page, wait for a tip, then take a screenshot of this box.',
    update: 'A new version of the extension is available ({v}). Download it again from the guide, extract it over the old folder, then click ↻ in chrome://extensions.',
    latest: 'Latest animations', none: 'None yet.', test: '(test)', warmthReset: 'warmth reset',
    status: { '': 'not connected yet', 'connected': 'connected', 'connecting…': 'connecting…', 'wrong OBS password': 'wrong OBS password',
      'cannot reach OBS (WebSocket server on? port?)': 'cannot reach OBS (WebSocket server on? port?)', 'OBS is not responding': 'OBS is not responding' },
  },
  vi: {
    reconnect: 'Kết nối lại với OBS', tryIt: 'Thử', bubbleName: 'Tên hiện trong bong bóng', resetWarmth: 'Đặt lại độ ấm',
    triggers: 'Tip menu',
    triggersHelp: '⚠️ Sửa tên và giá của mỗi dòng cho giống một món trong tip menu Stripchat của bạn (emoji và chữ hoa không ảnh hưởng), rồi bấm Lưu. Giá là số token món đó cộng vào thanh độ ấm. Các hoạt động mới sẽ tự hiện ở đây. Để trống tên nếu không dùng.',
    price: 'giá (tk)',
    gauge: 'Thanh độ ấm', fullAt: 'Thanh đầy (100%) khi đạt', tokens: 'token',
    gaugeHelp: 'Mỗi hoạt ảnh từ tip menu cộng giá của món đó (ở trên) vào thanh. Trên stream, thanh hiện phần trăm so với tổng này.',
    password: 'Mật khẩu WebSocket', port: 'Cổng', save: 'Lưu', saved: 'Đã lưu ✓',
    diag: '🔧 Chẩn đoán', diagHelp: 'Nếu tip một món mà bé không phản ứng: mở trang Stripchat của bạn, đợi có tip, rồi chụp màn hình khung này.',
    update: 'Có phiên bản mới của tiện ích ({v}). Tải lại ở trang hướng dẫn, giải nén đè lên thư mục cũ, rồi bấm ↻ trong chrome://extensions.',
    latest: 'Hoạt ảnh gần đây', none: 'Chưa có.', test: '(thử)', warmthReset: 'đặt lại độ ấm',
    status: { '': 'chưa kết nối', 'connected': 'đã kết nối', 'connecting…': 'đang kết nối…', 'wrong OBS password': 'sai mật khẩu OBS',
      'cannot reach OBS (WebSocket server on? port?)': 'không kết nối được với OBS (đã bật WebSocket chưa? đúng cổng chưa?)', 'OBS is not responding': 'OBS không phản hồi' },
  },
};
let lang = (chrome.i18n.getUILanguage() || '').startsWith('vi') ? 'vi' : 'en';
const t = (k) => TEXT[lang][k];

function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang));
  renderInteractions();
  refresh();
}
document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
  lang = b.dataset.lang;
  chrome.storage.local.set({ uiLang: lang });
  applyLang();
}));

// Les interactions viennent du fichier extension/interactions.json sur la page GitHub (via background.js).
// Cette liste-ci ne sert que s'il n'a encore jamais pu être téléchargé (mêmes valeurs que background.js).
const BUILTIN_INTERACTIONS = [
  { id: 'feed',   type: 'feed',     label: 'Feed the baby',   amount: 8,  emoji: '🍪', name: { en: 'Feed', vi: 'Cho ăn' } },
  { id: 'cuddle', type: 'cuddle',   label: 'Cuddle the baby', amount: 16, emoji: '🤗', name: { en: 'Cuddle', vi: 'Ôm' } },
  { id: 'hf0',    type: 'highfive', label: 'High five baby',  amount: 3,  emoji: '✋', name: { en: 'High five', vi: 'Đập tay' } },
];
let interactions = BUILTIN_INTERACTIONS;
let overrides = {};   // ses noms et prix à elle, par identifiant d'interaction
const nameOf = (a) => (a.name && (a.name[lang] || a.name.en)) || a.type;

// Boutons de test et liste des items, construits à partir de la liste
function renderInteractions() {
  const tests = $('tests'), items = $('items');
  tests.innerHTML = ''; items.innerHTML = '';
  for (const a of interactions) {
    const b = document.createElement('button');
    b.textContent = `${a.emoji || ''} ${nameOf(a)}`.trim();
    b.addEventListener('click', () => simulate(a.id));
    tests.appendChild(b);
    const mine = overrides[a.id] || {};
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.id = a.id;
    const l1 = document.createElement('label');
    const cap = document.createElement('span'); cap.className = 'what'; cap.textContent = `${a.emoji || ''} ${nameOf(a)}`.trim();
    const name = document.createElement('input'); name.type = 'text'; name.className = 'lbl-in';
    name.value = mine.label !== undefined ? mine.label : a.label;
    l1.append(cap, name);
    const l2 = document.createElement('label');
    const cap2 = document.createElement('span'); cap2.className = 'what'; cap2.textContent = t('price');
    const price = document.createElement('input'); price.type = 'number'; price.min = '0'; price.className = 'amt-in';
    price.value = mine.amount !== undefined ? mine.amount : a.amount;
    l2.append(cap2, price);
    row.append(l1, l2);
    items.appendChild(row);
  }
}
async function loadInteractions() {
  const { interactions: list, overrides: o } = await chrome.storage.local.get(['interactions', 'overrides']);
  interactions = Array.isArray(list) && list.length ? list : BUILTIN_INTERACTIONS;
  overrides = o || {};
  renderInteractions();
}

async function simulate(action) {
  const r = await chrome.runtime.sendMessage({ type: 'simulate', action, user: $('testUser').value.trim() || 'Phi' });
  if (r && !r.ok) showStatus(r.error);
}

async function load() {
  const s = await chrome.storage.local.get(null);
  $('obsPassword').value = s.obsPassword || '';
  $('obsPort').value = s.obsPort || 4455;
  $('heatMax').value = s.heatMax || 200;
}

async function save() {
  // ses noms et prix, ligne par ligne (gardés même si la liste distante change)
  document.querySelectorAll('#items .row').forEach((row) => {
    overrides[row.dataset.id] = { label: row.querySelector('.lbl-in').value.trim(), amount: Number(row.querySelector('.amt-in').value) || 0 };
  });
  await chrome.storage.local.set({
    overrides,
    obsPassword: $('obsPassword').value,
    obsPort: Number($('obsPort').value) || 4455,
    heatMax: Math.max(1, Number($('heatMax').value) || 200),
  });
  $('saved').textContent = t('saved');
  setTimeout(() => ($('saved').textContent = ''), 1500);
  chrome.runtime.sendMessage({ type: 'reconnect' });
}

function showStatus(text) {
  $('statusText').textContent = 'OBS: ' + (t('status')[text || ''] || text);
  $('status').className = 'status' + (text === 'connected' ? ' ok' : text && text !== 'connecting…' ? ' err' : '');
}

function showLog(log = []) {
  const LABELS = { reset: t('warmthReset') };
  for (const a of interactions) LABELS[a.id] = `${a.emoji || ''} ${nameOf(a)}`.trim();
  const ul = $('log');
  ul.innerHTML = '';
  if (!log.length) { const li = document.createElement('li'); li.innerHTML = '<small></small>'; li.firstChild.textContent = t('none'); ul.appendChild(li); return; }
  for (const e of log) {
    const li = document.createElement('li');
    const who = document.createElement('span');
    const time = new Date(e.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    who.textContent = `${time}  ${e.user} · ${e.amount} tk` + (e.item ? ` · menu: “${e.item}”` : '');
    const what = document.createElement('span');
    what.className = 'a';
    what.textContent = (LABELS[e.action] || e.action) + (e.simulated ? ' ' + t('test') : '') + (e.sent ? ' ✓' : ' ✗ ' + (e.error || ''));
    li.append(who, what);
    ul.appendChild(li);
  }
}

async function refresh() {
  const { obsStatus, log, diag } = await chrome.storage.session.get(['obsStatus', 'log', 'diag']);
  showStatus(obsStatus);
  showLog(log);
  showDiag(diag);
}

// Diagnostic : ce que l'extension voit dans le chat (à envoyer en capture d'écran si ça ne marche pas)
async function showDiag(d = {}) {
  const { remoteAt, interactions: remote } = await chrome.storage.local.get(['remoteAt', 'interactions']);
  const L = d.last;
  const lines = [
    `v${chrome.runtime.getManifest().version} · remote ${remoteAt ? new Date(remoteAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'} · ${remote ? remote.length : 'built-in'} items`,
    `pages: ${(d.frames || []).join(' | ') || '—'}`,
    `tips seen: ${d.tips || 0}`,
    L ? `last: ${L.user} · ${L.amount} tk · menu ${L.menu ? 'yes' : 'no'} · "${L.comment || ''}" → ${L.action || 'no match'}` : 'last: —',
    L ? `text: ${L.text}` : '',
    ...(d.unknown || []).map((u) => `? ${u}`),
  ].filter(Boolean);
  $('diagText').textContent = lines.join('\n');
}

// Nouvelle version publiée sur la page GitHub ?
async function checkUpdate() {
  try {
    const r = await fetch('https://vinceixiv.github.io/Mushroom-kid/extension/manifest.json?t=' + Date.now(), { cache: 'no-store' });
    const latest = (await r.json()).version;
    const mine = chrome.runtime.getManifest().version;
    const newer = latest.split('.').map(Number).some((n, i, a) => n > (mine.split('.').map(Number)[i] || 0) && a.slice(0, i).every((x, j) => x === (mine.split('.').map(Number)[j] || 0)));
    if (newer) { $('update').textContent = t('update').replace('{v}', latest); $('update').hidden = false; }
  } catch (e) { /* hors ligne */ }
}

$('resetBtn').addEventListener('click', () => simulate('reset'));
$('save').addEventListener('click', save);
$('reconnect').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'reconnect' }));
chrome.storage.onChanged.addListener((c, area) => {
  if (area === 'session') refresh();
  if (area === 'local' && c.interactions) loadInteractions();
});

chrome.storage.local.get('uiLang').then(({ uiLang }) => { if (uiLang) lang = uiLang; applyLang(); });
load();
loadInteractions();
chrome.runtime.sendMessage({ type: 'refreshRemote' });   // relit la liste sur GitHub à chaque ouverture
checkUpdate();
