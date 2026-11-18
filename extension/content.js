// Lit le chat Stripchat et transmet chaque nouveau tip au service worker (background.js),
// qui décide s'il s'agit de « feed » ou « cuddle » et prévient OBS.
(() => {
  // Ligne de tip dans le chat. Format actuel (2026) : <div data-message-id class="TipMessage#xx … m-bg-tip-v2 message">.
  // Les suffixes « #xx » des classes changent à chaque mise à jour de Stripchat : on ne s'y fie pas.
  // .m-bg-public-tip = ancien format, gardé au cas où.
  // (même repère que l'extension stripchat-gemini, qui fonctionne sur le Stripchat actuel)
  const TIP_SEL = '.message[class*="TipMessage"], .m-bg-tip-v2, .m-bg-public-tip';
  const USER_SEL = '.user-levels-username-text, .message-username, .username, [class*="username"]';
  const AMOUNT_SEL = '[class*="TipMessage__amount"]';    // « 25 jt », « 25 tk »… selon la langue
  const COMMENT_SEL = '[class*="TipMessage__commentBody"]'; // message du tipeur (ou item du tip menu)

  const seen = new WeakSet();
  const recent = new Map(); // signature -> heure, pour ignorer un même message ré-affiché

  // Les tips déjà présents à l'ouverture de la page ne déclenchent rien.
  document.querySelectorAll(TIP_SEL).forEach((n) => seen.add(n));

  function parse(row) {
    const text = (row.innerText || row.textContent || '').replace(/\s+/g, ' ').trim();
    const userEl = row.querySelector(USER_SEL);
    const user = (userEl ? userEl.textContent : '').trim() || 'someone';
    // Montant : d'abord l'élément dédié, sinon dans le texte (tk, tks, tokens, jt, jetons…)
    const amountEl = row.querySelector(AMOUNT_SEL);
    const m = (amountEl && amountEl.textContent.match(/(\d[\d\s., ]*)/))
      || text.match(/(\d[\d\s.,]*)\s*(?:tk|tks|tokens?|jt|jts|jetons?)\b/i) || text.match(/\b(\d{1,6})\b/);
    const amount = m ? parseInt(m[1].replace(/\D/g, ''), 10) || 0 : 0;
    const commentEl = row.querySelector(COMMENT_SEL);
    const comment = commentEl ? (commentEl.innerText || commentEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
    // Tip du tip menu : le commentaire porte « TipMessage__commentTipMenu » et un bouton « Menu des pourboires » ;
    // le commentBody contient alors le nom de l'item (ex. « 💏 A Flying Kiss 😙💕 »).
    const menu = !!row.querySelector('[class*="TipMessage__commentTipMenu"], [class*="TipMessage__tipMenuLink"]');
    return { user, amount, menu, comment: comment.slice(0, 200), text: text.slice(0, 300) };
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
        chrome.runtime.sendMessage({ type: 'tip', ...tip }).catch(() => {});
      } catch (e) { /* extension rechargée : il faut actualiser la page */ }
    }
  }

  new MutationObserver((muts) => {
    const rows = [];
    for (const mu of muts) {
      for (const n of mu.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.matches(TIP_SEL)) rows.push(n);
        else n.querySelectorAll(TIP_SEL).forEach((r) => rows.push(r));
      }
    }
    if (rows.length) send(rows);
  }).observe(document.body, { childList: true, subtree: true });
})();
