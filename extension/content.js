// Lit le chat Stripchat et transmet chaque nouveau tip au service worker (background.js),
// qui décide s'il s'agit de « feed » ou « cuddle » et prévient OBS.
(() => {
  // Message de tip public dans le chat (même repère que l'extension chat-translate).
  const TIP_SEL = '.m-bg-public-tip';
  const USER_SEL = '.username, .message-username, [class*="username"]';

  const seen = new WeakSet();
  const recent = new Map(); // signature -> heure, pour ignorer un même message ré-affiché

  // Les tips déjà présents à l'ouverture de la page ne déclenchent rien.
  document.querySelectorAll(TIP_SEL).forEach((n) => seen.add(n));

  function parse(row) {
    const text = (row.innerText || row.textContent || '').replace(/\s+/g, ' ').trim();
    const userEl = row.querySelector(USER_SEL);
    const user = (userEl ? userEl.textContent : '').trim() || 'someone';
    const m = text.match(/(\d[\d\s.,]*)\s*(?:tk|tks|tokens?|jetons?)\b/i) || text.match(/\b(\d{1,6})\b/);
    const amount = m ? parseInt(m[1].replace(/\D/g, ''), 10) || 0 : 0;
    return { user, amount, text: text.slice(0, 300) };
  }

  function send(rows) {
    // Si le chat se ré-affiche d'un coup (changement d'onglet, défilement), on ne rejoue pas l'historique.
    if (rows.length > 5) { rows.forEach((r) => seen.add(r)); return; }
    const now = Date.now();
    for (const [k, t] of recent) if (now - t > 3000) recent.delete(k);
    for (const row of rows) {
      if (seen.has(row)) continue;
      seen.add(row);
      const tip = parse(row);
      const sig = tip.user + '|' + tip.amount + '|' + tip.text;
      if (recent.has(sig)) continue;
      recent.set(sig, now);
      try {
        chrome.runtime.sendMessage({ type: 'tip', ...tip, url: location.href }).catch(() => {});
      } catch (e) { /* extension rechargée : il faut actualiser la page */ }
    }
  }

  // Outil de diagnostic : garde le HTML des derniers messages ajoutés au chat,
  // pour que la popup puisse les copier (format des tips du tip menu à identifier).
  const lastMessages = [];
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (msg.type === 'dump') reply({ url: location.href, messages: lastMessages.slice() });
  });

  new MutationObserver((muts) => {
    const rows = [];
    for (const mu of muts) {
      for (const n of mu.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.closest && n.closest('.messages, [class*="messages"], [class*="Chat"], [class*="chat"]') && (n.textContent || '').trim()) {
          lastMessages.push(n.outerHTML.slice(0, 4000));
          if (lastMessages.length > 15) lastMessages.shift();
        }
        if (n.matches(TIP_SEL)) rows.push(n);
        else n.querySelectorAll(TIP_SEL).forEach((r) => rows.push(r));
      }
    }
    if (rows.length) send(rows);
  }).observe(document.body, { childList: true, subtree: true });
})();
