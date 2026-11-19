// Lit le chat Stripchat et transmet chaque nouveau tip au service worker (background.js),
// qui décide de l'animation (feed / cuddle / high five) et prévient OBS.
//
// Les repères (sélecteurs) sont réglables à distance : background.js télécharge extension/rules.json
// depuis la page GitHub et le range dans chrome.storage.local ; on le relit ici.
(() => {
  const DEFAULT_RULES = {
    // ligne de tip (côté viewer en 2026 : <div data-message-id class="TipMessage#xx … m-bg-tip-v2 message">)
    row: ['.message[class*="TipMessage"]', '[data-message-id][class*="TipMessage"]',
          '.m-bg-tip-v2', '.m-bg-public-tip', '[class*="tip-message"]'],
    // repère « tip du tip menu » (la pastille « Menu des pourboires » / « Menu tiền bo » / « Tip Menu »)
    menu: ['[class*="commentTipMenu"]', '[class*="tipMenuLink"]', '[class*="TipMenuLink"]', '[class*="TipMenu"]', '[class*="tip-menu"]'],
    // texte de l'item (ou message du tipeur)
    comment: ['[class*="TipMessage__commentBody"]', '[class*="commentBody"]', '.tip-comment', '[class*="TipMessage__comment"]'],
    user: ['.user-levels-username-text', '.message-username', '.username', '[class*="username"]'],
    amount: ['[class*="TipMessage__amount"]', '[class*="amountHighlight"]'],
    delay: 400,   // ms : on lit la ligne un peu après son apparition (elle peut se remplir en deux temps)
  };
  let R = DEFAULT_RULES;
  const useRules = (r) => { R = { ...DEFAULT_RULES, ...(r || {}) }; };
  try {
    chrome.storage.local.get('rules').then(({ rules }) => useRules(rules));
    chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && c.rules) useRules(c.rules.newValue); });
  } catch (e) {}

  const safe = (fn) => { try { return fn(); } catch (e) { return null; } };
  const first = (root, sels) => { for (const s of sels) { const e = safe(() => root.querySelector(s)); if (e) return e; } return null; };
  const isRow = (el) => R.row.some((s) => safe(() => el.matches(s)));
  const clean = (t) => (t || '').replace(/\s+/g, ' ').trim();
  const TIP_TEXT = /\d[\d\s.,]*\s*(tk|tks|tokens?|jt|jts|jetons?)\b/i;

  function rowsIn(n) {
    const out = [];
    if (isRow(n)) out.push(n);
    for (const s of R.row) safe(() => n.querySelectorAll(s).forEach((r) => out.push(r)));
    // un nœud ajouté à l'intérieur d'une ligne de tip déjà présente
    const up = safe(() => n.parentElement && n.parentElement.closest(R.row.join(',')));
    if (up) out.push(up);
    return out;
  }

  function parse(row) {
    const text = clean(row.innerText || row.textContent);
    const userEl = first(row, R.user);
    const user = clean(userEl && userEl.textContent) || 'someone';
    const amountEl = first(row, R.amount);
    const m = (amountEl && amountEl.textContent.match(/(\d[\d\s., ]*)/)) || text.match(/(\d[\d\s.,]*)\s*(?:tk|tks|tokens?|jt|jts|jetons?)\b/i);
    const amount = m ? parseInt(m[1].replace(/\D/g, ''), 10) || 0 : 0;
    const commentEl = first(row, R.comment);
    const comment = clean(commentEl && (commentEl.innerText || commentEl.textContent));
    // tip du tip menu : repère connu, ou un bouton dont le texte contient « menu » (toutes langues)
    const menu = !!first(row, R.menu) || [...row.querySelectorAll('button, a')].some((b) => /menu/i.test(b.textContent || ''));
    return { user, amount, menu, comment: comment.slice(0, 200), text: text.slice(0, 300) };
  }

  const seen = new WeakSet();
  const recent = new Map();   // signature -> heure, pour ignorer un même message ré-affiché
  const msg = (m) => { try { chrome.runtime.sendMessage(m).catch(() => {}); } catch (e) { /* extension rechargée : actualiser la page */ } };

  // Les tips déjà présents à l'ouverture de la page ne déclenchent rien.
  for (const s of DEFAULT_RULES.row) safe(() => document.querySelectorAll(s).forEach((n) => seen.add(n)));
  msg({ type: 'hello', frame: window === top ? 'top' : 'frame', url: location.hostname + location.pathname });

  function handle(rows) {
    // Si le chat se ré-affiche d'un coup (changement d'onglet, défilement), on ne rejoue pas l'historique.
    rows = [...new Set(rows)].filter((r) => !seen.has(r));
    // un élément contenu dans une autre ligne de tip n'est pas un tip à part (ex. le pseudo)
    rows = rows.filter((r) => !rows.some((o) => o !== r && o.contains(r)));
    if (rows.length > 5) { rows.forEach((r) => seen.add(r)); return; }
    for (const row of rows) {
      seen.add(row);
      setTimeout(() => {
        const tip = parse(row);
        const now = Date.now();
        for (const [k, t] of recent) if (now - t > 3000) recent.delete(k);
        const sig = tip.user + '|' + tip.amount + '|' + tip.text;
        if (recent.has(sig)) return;
        recent.set(sig, now);
        msg({ type: 'tip', ...tip });
      }, R.delay);
    }
  }

  // Filet de sécurité qui ne dépend pas de la structure du chat :
  // un message ajouté qui contient un montant (« 18 tk ») ET le nom d'un item réglé dans l'extension = un tip à animer.
  // Sinon, s'il ressemble à un tip, on le signale au diagnostic (ses classes disent quels repères ajouter).
  const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  let labels = [];
  const useLabels = (actions) => { labels = (actions || []).map((a) => norm(a.label)).filter(Boolean); };
  try {
    chrome.storage.local.get('actions').then(({ actions }) => useLabels(actions));
    chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && c.actions) useLabels(c.actions.newValue); });
  } catch (e) {}
  const done = new WeakSet();
  const handled = (n) => { for (let e = n; e; e = e.parentElement) if (done.has(e) || seen.has(e)) return true; return false; };
  let unknownSent = 0;
  function maybeTextTip(n) {
    setTimeout(() => {
      if (!n.isConnected || handled(n)) return;
      const t = clean(n.innerText || n.textContent);
      if (!t || t.length > 400 || !TIP_TEXT.test(t)) return;
      if (safe(() => n.closest(R.row.join(',')))) return;
      const nt = norm(t);
      if (labels.some((l) => nt.includes(l))) {
        done.add(n);
        const m = t.match(/(\d[\d\s.,]*)\s*(?:tk|tks|tokens?|jt|jts|jetons?)\b/i);
        // pseudo : repère connu, sinon le premier mot du message
        const userEl = first(n, R.user);
        const tip = { user: clean(userEl && userEl.textContent) || (t.split(' ')[0] || 'someone').slice(0, 32), amount: m ? parseInt(m[1].replace(/\D/g, ''), 10) || 0 : 0, menu: false, comment: '', text: t.slice(0, 300) };
        const now = Date.now();
        for (const [k, v] of recent) if (now - v > 3000) recent.delete(k);
        if (recent.has(tip.text)) return;
        recent.set(tip.text, now);
        msg({ type: 'tip', ...tip });
      } else if (unknownSent < 5) {
        unknownSent++;
        const cls = (e) => (e && typeof e.className === 'string' ? e.className : '').slice(0, 120);
        msg({ type: 'unknown', sample: `${n.tagName.toLowerCase()}.${cls(n)} > ${cls(n.firstElementChild)} | ${t.slice(0, 80)}` });
      }
    }, R.delay);
  }

  new MutationObserver((muts) => {
    const rows = [];
    for (const mu of muts) {
      for (const n of mu.addedNodes) {
        if (n.nodeType !== 1) continue;
        const found = rowsIn(n);
        if (found.length) rows.push(...found); else maybeTextTip(n);
      }
    }
    if (rows.length) handle(rows);
  }).observe(document.body || document.documentElement, { childList: true, subtree: true });
})();
