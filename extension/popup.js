const $ = (id) => document.getElementById(id);

/* ---------- Langue de la popup : anglais / vietnamien (drapeaux à côté du titre) ---------- */
const TEXT = {
  en: {
    reconnect: 'Reconnect to OBS', tryIt: 'Try it', bubbleName: 'Name shown in the bubble', resetWarmth: 'Reset warmth',
    triggers: 'Tip menu', itemFeed: 'Tip menu item "feed"', itemCuddle: 'Tip menu item "cuddle"',
    itemHf0: 'Tip menu item "high five"', price: 'price (tk)',
    triggersHelp: '⚠️ Add these items to your Stripchat tip menu, with the same names as here. Emojis around the name and capitals don\'t matter. When a viewer tips one of them, the mushroom plays that animation. Leave a name empty to turn it off.',
    priceHelp: 'Price: the price of this item in your tip menu. It is what each of these tips adds to the warmth gauge.',
    gauge: 'Warmth gauge', fullAt: 'The gauge is full (100%) at', tokens: 'tokens',
    gaugeHelp: 'Each tip menu animation adds its price (set above) to the gauge. On stream, the gauge shows the percentage of this total.',
    password: 'WebSocket password', port: 'Port', save: 'Save', saved: 'Saved ✓',
    diag: '🔧 Diagnostics', diagHelp: 'If a tip menu tip does nothing: open your Stripchat page, wait for a tip, then take a screenshot of this box.',
    update: 'A new version of the extension is available ({v}). Download it again from the guide, extract it over the old folder, then click ↻ in chrome://extensions.',
    latest: 'Latest animations', none: 'None yet.', test: '(test)', warmthReset: 'warmth reset',
    status: { '': 'not connected yet', 'connected': 'connected', 'connecting…': 'connecting…', 'wrong OBS password': 'wrong OBS password',
      'cannot reach OBS (WebSocket server on? port?)': 'cannot reach OBS (WebSocket server on? port?)', 'OBS is not responding': 'OBS is not responding' },
  },
  vi: {
    reconnect: 'Kết nối lại với OBS', tryIt: 'Thử', bubbleName: 'Tên hiện trong bong bóng', resetWarmth: 'Đặt lại độ ấm',
    triggers: 'Tip menu', itemFeed: 'Món tip menu "feed"', itemCuddle: 'Món tip menu "cuddle"',
    itemHf0: 'Món tip menu "high five"', price: 'giá (tk)',
    triggersHelp: '⚠️ Hãy thêm các món này vào tip menu Stripchat của bạn, với đúng tên như ở đây. Có thể thêm emoji quanh tên, chữ hoa hay chữ thường đều được. Khi viewer tip một món, bé sẽ làm hoạt ảnh tương ứng. Để trống tên nếu không dùng món đó.',
    priceHelp: 'Giá: giá của món này trong tip menu của bạn. Đó là số token mỗi tip này cộng vào thanh độ ấm.',
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
  refresh();
}
document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
  lang = b.dataset.lang;
  chrome.storage.local.set({ uiLang: lang });
  applyLang();
}));

// Mêmes réglages par défaut que background.js
const DEFAULT_ACTIONS = [
  { id: 'feed',   type: 'feed',     label: 'Feed the kid',   amount: 25 },
  { id: 'cuddle', type: 'cuddle',   label: 'Cuddle the kid', amount: 50 },
  { id: 'hf0',    type: 'highfive', label: 'High five kid',  amount: 40 },
];

async function load() {
  const s = await chrome.storage.local.get(null);
  const saved = s.actions || [];
  for (const d of DEFAULT_ACTIONS) {
    const a = { ...d, ...(saved.find((x) => (x.id || x.type) === d.id) || {}) };
    $(d.id + 'Label').value = a.label;
    $(d.id + 'Amount').value = a.amount;
  }
  $('obsPassword').value = s.obsPassword || '';
  $('obsPort').value = s.obsPort || 4455;
  $('heatMax').value = s.heatMax || 2000;
}

async function save() {
  await chrome.storage.local.set({
    actions: DEFAULT_ACTIONS.map((d) => ({ ...d, label: $(d.id + 'Label').value.trim(), amount: Number($(d.id + 'Amount').value) || 0 })),
    obsPassword: $('obsPassword').value,
    obsPort: Number($('obsPort').value) || 4455,
    heatMax: Math.max(1, Number($('heatMax').value) || 2000),
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
  const LABELS = { feed: '🍪 feed', cuddle: '🤗 cuddle', hf0: '✋ high five', reset: t('warmthReset') };
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
  const { rulesAt } = await chrome.storage.local.get('rulesAt');
  const L = d.last;
  const lines = [
    `v${chrome.runtime.getManifest().version} · rules ${rulesAt ? new Date(rulesAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'built-in'}`,
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

document.querySelectorAll('[data-sim]').forEach((b) => b.addEventListener('click', async () => {
  const r = await chrome.runtime.sendMessage({ type: 'simulate', action: b.dataset.sim, user: $('testUser').value.trim() || 'Tester' });
  if (r && !r.ok) showStatus(r.error);
}));
$('save').addEventListener('click', save);
$('reconnect').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'reconnect' }));
chrome.storage.onChanged.addListener((_, area) => { if (area === 'session') refresh(); });

chrome.storage.local.get('uiLang').then(({ uiLang }) => { if (uiLang) lang = uiLang; applyLang(); });
load();
checkUpdate();
