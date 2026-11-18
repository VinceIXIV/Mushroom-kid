const $ = (id) => document.getElementById(id);

/* ---------- Langue de la popup : anglais / vietnamien (drapeaux à côté du titre) ---------- */
const TEXT = {
  en: {
    reconnect: 'Reconnect to OBS', tryIt: 'Try it', bubbleName: 'Name shown in the bubble', resetWarmth: 'Reset warmth',
    triggers: 'Tip menu', itemFeed: 'Tip menu item "feed"', itemCuddle: 'Tip menu item "cuddle"',
    itemHf0: 'Item "high five", cream cap kid', itemHf1: 'Item "high five", mint cap kid', price: 'price (tk)',
    triggersHelp: '⚠️ Add these items to your Stripchat tip menu, with the same names as here. Emojis around the name and capitals don\'t matter. When a viewer tips one of them, the kids play that animation. Leave a name empty to turn it off.',
    priceHelp: 'Price: a tip of exactly this amount also triggers it, even outside the tip menu (0 = off).',
    gauge: 'Warmth gauge', fullAt: 'The gauge is full (100%) at', tokens: 'tokens',
    gaugeHelp: 'Each feed or cuddle tip adds its tokens to the gauge.',
    password: 'WebSocket password', port: 'Port', save: 'Save', saved: 'Saved ✓',
    latest: 'Latest animations', none: 'None yet.', test: '(test)', warmthReset: 'warmth reset',
    status: { '': 'not connected yet', 'connected': 'connected', 'connecting…': 'connecting…', 'wrong OBS password': 'wrong OBS password',
      'cannot reach OBS (WebSocket server on? port?)': 'cannot reach OBS (WebSocket server on? port?)', 'OBS is not responding': 'OBS is not responding' },
  },
  vi: {
    reconnect: 'Kết nối lại với OBS', tryIt: 'Thử', bubbleName: 'Tên hiện trong bong bóng', resetWarmth: 'Đặt lại độ ấm',
    triggers: 'Tip menu', itemFeed: 'Món tip menu "feed"', itemCuddle: 'Món tip menu "cuddle"',
    itemHf0: 'Món "high five", bé mũ kem', itemHf1: 'Món "high five", bé mũ xanh bạc hà', price: 'giá (tk)',
    triggersHelp: '⚠️ Hãy thêm các món này vào tip menu Stripchat của bạn, với đúng tên như ở đây. Có thể thêm emoji quanh tên, chữ hoa hay chữ thường đều được. Khi viewer tip một món, hai bé sẽ làm hoạt ảnh tương ứng. Để trống tên nếu không dùng món đó.',
    priceHelp: 'Giá: tip đúng số token này cũng sẽ kích hoạt, kể cả ngoài tip menu (0 = tắt).',
    gauge: 'Thanh độ ấm', fullAt: 'Thanh đầy (100%) khi đạt', tokens: 'token',
    gaugeHelp: 'Mỗi tip feed hoặc cuddle cộng số token đó vào thanh.',
    password: 'Mật khẩu WebSocket', port: 'Cổng', save: 'Lưu', saved: 'Đã lưu ✓',
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
  { id: 'feed',   type: 'feed',     label: 'Feed the kids',   amount: 25 },
  { id: 'cuddle', type: 'cuddle',   label: 'Cuddle the kids', amount: 50 },
  { id: 'hf0',    type: 'highfive', kid: 0, label: 'Bibi high five',  amount: 0 },
  { id: 'hf1',    type: 'highfive', kid: 1, label: 'Pouic high five', amount: 0 },
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
  const LABELS = { feed: '🍪 feed', cuddle: '🤗 cuddle', hf0: '✋ high five 1', hf1: '✋ high five 2', reset: t('warmthReset') };
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
  const { obsStatus, log } = await chrome.storage.session.get(['obsStatus', 'log']);
  showStatus(obsStatus);
  showLog(log);
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
