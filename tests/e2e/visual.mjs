// Contrôle visuel de la version web (Contrôle béton).
// Lance : BASE=http://localhost:8081 node tests/e2e/visual.mjs
// Sortie : rapport complet (jamais tronqué) + captures dans e2e-out/. Code de sortie 1 s'il reste une alerte.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:8081';
const OUT = 'e2e-out';
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = { petit: { width: 360, height: 740 }, telephone: { width: 393, height: 851 }, tablette: { width: 820, height: 1180 } };
const SCHEMES = ['light', 'dark'];
const ROUTES = { aujourdhui: '/', semaine: '/semaine', objectifs: '/objectifs', journal: '/journal', reglages: '/reglages' };
const MORNING = '2026-11-25T08:00:00';
const EVENING = '2026-11-25T19:30:00';

const issues = [];
const report = (where, kind, detail) => issues.push({ where, kind, detail });

// ——— Détecteurs (exécutés dans la page) ———
function detect() {
  const out = [];
  const vw = document.documentElement.clientWidth;
  const label = (el) => {
    const t = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
    return `${el.tagName.toLowerCase()}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''} « ${t.slice(0, 60)} »`;
  };
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const scrollsX = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 1) return true;
    }
    return false;
  };

  // 1. La page ou un panneau défile de côté.
  const root = document.scrollingElement;
  if (root.scrollWidth > root.clientWidth + 1) out.push(['défilement latéral', `page : ${root.scrollWidth} > ${root.clientWidth}`]);
  for (const el of document.querySelectorAll('*')) {
    const s = getComputedStyle(el);
    // Tout panneau qui défile de côté est signalé ; on examine ensuite si c'est voulu.
    if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1) out.push(['défilement latéral', `panneau ${label(el)} : ${el.scrollWidth} > ${el.clientWidth}`]);
  }

  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || scrollsX(el)) continue;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    // 2. Bloc qui sort de l'écran.
    if (r.right > vw + 1 || r.left < -1) out.push(['débordement bloc', `${label(el)} : ${Math.round(r.left)}→${Math.round(r.right)} (largeur ${vw})`]);
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const hidesX = s.overflowX === 'hidden' || s.overflowX === 'clip';
    const hidesY = s.overflowY === 'hidden' || s.overflowY === 'clip';
    const ellipsis = s.textOverflow === 'ellipsis' || (s.webkitLineClamp && s.webkitLineClamp !== 'none');
    const cutX = el.scrollWidth > el.clientWidth + 1;
    const cutY = el.scrollHeight > el.clientHeight + 1;
    // 3. Texte coupé en silence par un conteneur qui masque le débordement.
    if (hasText && ((hidesX && cutX) || (hidesY && cutY)) && !ellipsis) out.push(['texte coupé en silence', label(el)]);
    // 4. Texte court coupé par des points de suspension.
    if (hasText && ellipsis && (cutX || cutY)) {
      const txt = el.innerText.trim();
      if (txt.length <= 24) out.push(['texte court tronqué', `${label(el)} (largeur ${Math.round(r.width)} px)`]);
    }
    // 5. Mot qui sort de son cadre (texte plus large que son bloc, sans être masqué).
    if (hasText && !hidesX && el.scrollWidth > el.clientWidth + 1 && s.display !== 'inline') out.push(['mot qui déborde', `${label(el)} : ${el.scrollWidth} > ${el.clientWidth}`]);
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (!n.textContent.trim() || !n.parentElement || !visible(n.parentElement) || scrollsX(n.parentElement)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const rr = range.getBoundingClientRect();
    if (rr.width && (rr.right > vw + 1 || rr.left < -1)) out.push(['texte hors écran', `${label(n.parentElement)} : ${Math.round(rr.left)}→${Math.round(rr.right)}`]);
  }

  // 6. Textes cassés.
  const text = document.body.innerText;
  for (const [re, kind] of [
    [/\bundefined\b/g, 'texte « undefined »'],
    [/\bNaN\b/g, 'texte « NaN »'],
    [/\[object Object\]/g, 'texte « [object Object] »'],
    [/\bnull\b/g, 'texte « null »'],
    [/\bInfinity\b/g, 'texte « Infinity »'],
    [/\b[01] (jours|nuits|créneaux|habitudes|notes|réveils|pages|fois les|semaines|mois cochés|séries)\b/g, 'pluriel faux'],
    [/\b([2-9]|\d{2,}) (jour|nuit|créneau|habitude|note|réveil|semaine)\b(?![-’'])/g, 'singulier faux'],
  ]) {
    const m = text.match(re);
    if (m) out.push([kind, [...new Set(m)].join(', ')]);
  }
  return out;
}

async function check(page, where) {
  const found = await page.evaluate(detect);
  // Un même élément répété (liste) ne masque pas les autres : on garde tout, sans tronquer.
  for (const [kind, detail] of found) report(where, kind, detail);
  return found.length;
}

// ——— Vérification des détecteurs sur de vrais bugs (règle 4) ———
async function selfTest(browser) {
  const page = await browser.newPage({ viewport: VIEWPORTS.telephone });
  const cases = {
    'défilement latéral': '<div style="width:600px">large</div>',
    'débordement bloc': '<div style="overflow:visible;width:100px"><div style="position:relative;left:350px;width:100px">sort</div></div>',
    'texte coupé en silence': '<div style="width:80px;height:20px;overflow:hidden">un texte bien trop long pour cette petite boîte de rien du tout</div>',
    'texte court tronqué': '<div style="width:30px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">Valider</div>',
    'mot qui déborde': '<div style="width:100px">Anticonstitutionnellementpasdutout</div>',
    'texte « undefined »': '<p>Durée : undefined</p>',
    'texte « NaN »': '<p>NaN %</p>',
    'pluriel faux': '<p>1 jours</p>',
    'singulier faux': '<p>3 nuit</p>',
  };
  const ok = [];
  for (const [kind, html] of Object.entries(cases)) {
    await page.setContent(`<body style="margin:0">${html}</body>`);
    const found = await page.evaluate(detect);
    if (!found.some(([k]) => k === kind)) report('auto-test des détecteurs', 'détecteur aveugle', `« ${kind} » n'a pas vu son bug`);
    else ok.push(kind);
  }
  await page.setContent('<body style="margin:0"><p>3 jours, 1 jour, 0 note, une page propre</p><div style="width:100px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">Un nom vraiment très long dans une colonne étroite</div></body>');
  const clean = await page.evaluate(detect);
  if (clean.length) report('auto-test des détecteurs', 'faux positif', JSON.stringify(clean));
  await page.close();
  console.log(`Détecteurs vérifiés sur un vrai bug : ${ok.length}/${Object.keys(cases).length}`);
}

function watchConsole(page, whereRef) {
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') report(whereRef.current, `console ${m.type()}`, m.text());
  });
  page.on('pageerror', (e) => report(whereRef.current, 'erreur JavaScript', `${e.message}\n${e.stack ?? ''}`));
}

async function waitReady(page) {
  await page.getByText("Aujourd'hui", { exact: false }).first().waitFor({ timeout: 180_000 });
  await page.waitForTimeout(600);
}

// ——— Passage visuel : toutes les combinaisons ———
async function visualPass(browser, data) {
  const context = await browser.newContext({ viewport: VIEWPORTS.telephone, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const page = await context.newPage();
  const where = { current: `${data} : chargement` };
  watchConsole(page, where);
  await page.clock.setFixedTime(new Date(MORNING));
  await page.goto(`${BASE}/?seed=${data}`);
  await waitReady(page);

  for (const [vp, size] of Object.entries(VIEWPORTS)) {
    await page.setViewportSize(size);
    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const [name, route] of Object.entries(ROUTES)) {
        const times = name === 'aujourdhui' ? { matin: MORNING, soir: EVENING } : { matin: MORNING };
        for (const [moment, time] of Object.entries(times)) {
          where.current = `${data} · ${vp} · ${scheme} · ${name}${name === 'aujourdhui' ? ` · ${moment}` : ''}`;
          await page.clock.setFixedTime(new Date(time));
          await page.goto(`${BASE}${route}`);
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(500);
          await check(page, where.current);
          await page.screenshot({ path: `${OUT}/${data}-${vp}-${scheme}-${name}${name === 'aujourdhui' ? `-${moment}` : ''}.png`, fullPage: true });
        }
      }
    }
  }
  // Feuilles (fenêtres qui montent du bas) : ouvrir celles d'Aujourd'hui au petit écran.
  await page.setViewportSize(VIEWPORTS.petit);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(800);
  for (const name of ['Ajouter un créneau', 'Nouvelle habitude', 'Gérer les habitudes']) {
    const btn = page.getByRole('button', { name }).first();
    if (!(await btn.count())) continue;
    where.current = `${data} · petit · dark · feuille « ${name} »`;
    await btn.click();
    await page.waitForTimeout(600);
    await check(page, where.current);
    await page.screenshot({ path: `${OUT}/${data}-feuille-${name.replace(/\W+/g, '-')}.png` });
    await page.keyboard.press('Escape');
    await page.goto(`${BASE}/`);
    await page.waitForTimeout(600);
  }
  await context.close();
}

// ——— Interactions minutées (règle 9 : aussi sur appareil ralenti ×6) ———
async function timedPass(browser, slow) {
  const tag = slow ? 'ralenti ×6' : 'normal';
  const context = await browser.newContext({ viewport: VIEWPORTS.telephone, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const page = await context.newPage();
  const where = { current: `interactions ${tag}` };
  watchConsole(page, where);
  await page.clock.setFixedTime(new Date(MORNING));
  await page.goto(`${BASE}/?seed=empty`);
  await waitReady(page);
  await page.goto(`${BASE}/`);
  await waitReady(page);
  if (slow) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  }

  // a) Garder le doigt sur « + » : ça défile, puis ça s'arrête au relâcher.
  where.current = `interactions ${tag} · champ d'heure maintenu`;
  const plus = page.getByRole('button', { name: 'Coucher : 15 minutes plus tard' });
  const timeOf = async () => (await page.getByRole('button', { name: /^Coucher : \d\d:\d\d$/ }).getAttribute('aria-label')).slice(-5);
  const before = await timeOf();
  const box = await plus.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1500);
  await page.mouse.up();
  await page.waitForTimeout(200);
  const released = await timeOf();
  await page.waitForTimeout(1500);
  const after = await timeOf();
  if (released === before) report(where.current, 'défilement absent', `l'heure n'a pas bougé (${before})`);
  if (after !== released) report(where.current, 'défilement qui continue', `${released} au relâcher, ${after} 1,5 s après`);
  // Appui simple : un seul pas de 15 min.
  const one = await timeOf();
  await plus.click();
  await page.waitForTimeout(800);
  const [h1, m1] = one.split(':').map(Number);
  const [h2, m2] = (await timeOf()).split(':').map(Number);
  const diff = (h2 * 60 + m2 - (h1 * 60 + m1) + 1440) % 1440;
  if (diff < 1 || diff > 15) report(where.current, 'pas faux', `${one} → ${h2}:${m2} (${diff} min)`);

  // b) Note du matin tapée puis « Terminé » aussitôt : elle doit être enregistrée.
  where.current = `interactions ${tag} · note du matin puis Terminé`;
  await page.getByRole('button', { name: 'Bien', exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByLabel('Ce matin : note').fill('Note éclair du matin');
  await page.getByRole('button', { name: 'Terminé' }).first().click();
  await page.waitForTimeout(1200);
  await page.reload();
  await waitReady(page);
  if (!(await page.getByText('Note éclair du matin', { exact: false }).count())) report(where.current, 'note perdue', 'la note tapée juste avant « Terminé » a disparu après rechargement');

  // c) Notes rapides : ajouter, modifier, relire après rechargement.
  where.current = `interactions ${tag} · notes rapides`;
  await page.getByLabel('Nouvelle note').fill('Ressenti à chaud #test');
  await page.getByRole('button', { name: 'Ajouter la note' }).click();
  await page.waitForTimeout(800);
  await page.getByText('Ressenti à chaud #test').click();
  await page.getByLabel(/^Modifier la note de /).fill('Ressenti modifié');
  await page.getByLabel('Nouvelle note').click(); // quitte le champ : enregistre
  await page.waitForTimeout(1200);
  await page.reload();
  await waitReady(page);
  if (!(await page.getByText('Ressenti modifié').count())) report(where.current, 'note rapide perdue', 'la modification n’a pas été gardée');

  // d) Revue de la semaine tapée puis changement d'onglet aussitôt : elle doit être gardée.
  where.current = `interactions ${tag} · revue de la semaine`;
  await page.goto(`${BASE}/semaine`);
  await page.waitForTimeout(800);
  const good = page.getByLabel("Qu'est-ce qui a bien marché ?");
  if (await good.count()) {
    await good.first().fill('Revue tapée vite');
    await page.goto(`${BASE}/`);
    await waitReady(page);
    await page.goto(`${BASE}/semaine`);
    await page.waitForTimeout(800);
    if ((await good.first().inputValue()) !== 'Revue tapée vite') report(where.current, 'revue perdue', 'le texte tapé juste avant de changer d’onglet a disparu');
  } else report(where.current, 'champ introuvable', 'champ « Qu’est-ce qui a bien marché ? » absent de Semaine');

  await check(page, `interactions ${tag} · écran final`);
  await context.close();
}

const browser = await chromium.launch();
try {
  await selfTest(browser);
  for (const data of ['empty', 'extreme']) await visualPass(browser, data);
  await timedPass(browser, false);
  await timedPass(browser, true);
} catch (e) {
  report('script', 'arrêt du contrôle', `${e.message}\n${e.stack ?? ''}`);
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/rapport.json`, JSON.stringify(issues, null, 2));
// Regroupe les alertes identiques (même type, même détail) et liste toutes les combinaisons touchées.
const groups = new Map();
for (const i of issues) {
  const key = `${i.kind}\u0000${i.detail}`;
  if (!groups.has(key)) groups.set(key, { kind: i.kind, detail: i.detail, where: [] });
  groups.get(key).where.push(i.where);
}
const lines = [...groups.values()].map((g) => `- [${g.kind}] ${g.detail}\n    × ${g.where.length} : ${g.where.join(' | ')}`);
writeFileSync(`${OUT}/rapport.md`, `# Contrôle visuel\n\n${issues.length} alerte(s)\n\n${lines.join('\n')}\n`);
console.log(`${issues.length} alerte(s)`);
for (const l of lines) console.log(l); // rapport complet, jamais tronqué
process.exit(issues.length ? 1 : 0);
