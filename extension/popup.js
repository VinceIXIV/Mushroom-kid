const $ = (id) => document.getElementById(id);
const DEFAULT_ACTIONS = [
  { type: 'feed', label: 'Feed the kids', amount: 25 },
  { type: 'cuddle', label: 'Cuddle the kids', amount: 50 },
];

async function load() {
  const s = await chrome.storage.local.get(null);
  const actions = s.actions || DEFAULT_ACTIONS;
  const feed = actions.find((a) => a.type === 'feed') || DEFAULT_ACTIONS[0];
  const cuddle = actions.find((a) => a.type === 'cuddle') || DEFAULT_ACTIONS[1];
  $('feedLabel').value = feed.label;
  $('feedAmount').value = feed.amount;
  $('cuddleLabel').value = cuddle.label;
  $('cuddleAmount').value = cuddle.amount;
  $('testMode').checked = !!s.testMode;
  $('room').value = s.room || '';
  $('obsPassword').value = s.obsPassword || '';
  $('obsPort').value = s.obsPort || 4455;
  $('heatMax').value = s.heatMax || 2000;
}

async function save() {
  await chrome.storage.local.set({
    actions: [
      { type: 'feed', label: $('feedLabel').value.trim(), amount: Number($('feedAmount').value) || 0 },
      { type: 'cuddle', label: $('cuddleLabel').value.trim(), amount: Number($('cuddleAmount').value) || 0 },
    ],
    testMode: $('testMode').checked,
    room: $('room').value.trim(),
    obsPassword: $('obsPassword').value,
    obsPort: Number($('obsPort').value) || 4455,
    heatMax: Math.max(1, Number($('heatMax').value) || 2000),
  });
  $('saved').textContent = 'Saved ✓';
  setTimeout(() => ($('saved').textContent = ''), 1500);
  chrome.runtime.sendMessage({ type: 'reconnect' });
}

function showStatus(text) {
  $('statusText').textContent = 'OBS: ' + (text || 'not connected yet');
  $('status').className = 'status' + (text === 'connected' ? ' ok' : text && text !== 'connecting…' ? ' err' : '');
}

const LABELS = { feed: '🍪 feed', cuddle: '🤗 cuddle', reset: 'warmth reset' };
function showLog(log = []) {
  const ul = $('log');
  ul.innerHTML = '';
  if (!log.length) { ul.innerHTML = '<li><small>None yet.</small></li>'; return; }
  for (const e of log) {
    const li = document.createElement('li');
    const who = document.createElement('span');
    const time = new Date(e.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    who.textContent = `${time}  ${e.user} · ${e.amount} tk`;
    const what = document.createElement('span');
    what.className = 'a';
    what.textContent = !e.action ? 'ignored' : (LABELS[e.action] || e.action) + (e.simulated ? ' (test)' : '') + (e.sent ? ' ✓' : ' ✗ ' + (e.error || ''));
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
$('dump').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const r = await chrome.tabs.sendMessage(tab.id, { type: 'dump' });
    if (!r || !r.messages.length) { $('dumpInfo').textContent = 'No new chat messages since the page was opened.'; return; }
    await navigator.clipboard.writeText(`URL: ${r.url}\n\n` + r.messages.join('\n\n----------\n\n'));
    $('dumpInfo').textContent = `${r.messages.length} messages copied ✓ Paste them in a message to your helper.`;
  } catch (e) {
    $('dumpInfo').textContent = 'Open the Stripchat tab first (and refresh it if the extension was just installed).';
  }
});
chrome.storage.onChanged.addListener((_, area) => { if (area === 'session') refresh(); });

load();
refresh();
