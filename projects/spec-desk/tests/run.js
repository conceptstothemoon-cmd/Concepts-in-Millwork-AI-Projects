const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const H = __dirname, APP = process.argv[2];
const FX = f => path.join(H, 'fixtures', f);
const SHOTS = path.join(H, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
const LIB = {
  'pdf.js/3.11.174/pdf.min.js': 'node_modules/pdfjs-dist/build/pdf.min.js',
  'pdf.js/3.11.174/pdf.worker.min.js': 'node_modules/pdfjs-dist/build/pdf.worker.min.js',
  'pdf-lib/1.17.1/pdf-lib.min.js': 'node_modules/pdf-lib/dist/pdf-lib.min.js',
  'jszip/3.10.1/jszip.min.js': 'node_modules/jszip/dist/jszip.min.js',
  'xlsx/0.18.5/xlsx.full.min.js': 'node_modules/xlsx/dist/xlsx.full.min.js',
};
const results = []; const log = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  await ctx.addInitScript({ path: path.join(H, 'mock-claude.js') });
  await ctx.route('**/*', async route => {
    const u = route.request().url();
    if (u.startsWith('http://specdesk.test/')) return route.fulfill({ path: APP, contentType: 'text/html' });
    const lib = Object.keys(LIB).find(k => u.endsWith(k));
    if (lib) return route.fulfill({ path: path.join(H, LIB[lib]), contentType: 'application/javascript' });
    if (/fonts\.(googleapis|gstatic)/.test(u)) return route.fulfill({ body: '', contentType: 'text/css' });
    return route.abort();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const shot = n => page.screenshot({ path: path.join(SHOTS, n + '.png'), fullPage: false });
  const ev = (f, a) => page.evaluate(f, a);
  const calls = () => ev(() => window.__calls.map(c => ({ kind: c.kind, len: c.len, images: c.images, imgTypes: c.imgTypes, imgBytes: c.imgBytes })));

  await page.goto('http://specdesk.test/');
  await page.waitForTimeout(500);
  log('Page loads, AI buttons enabled by window.claude', await ev(() => caps.ready && !!caps.sample && !!caps.downloads));

  // ---------- spec book ----------
  await page.setInputFiles('#fileInput', FX('spec-book.pdf'));
  await page.waitForFunction(() => state.sections.length > 0 && !document.querySelector('.tabs').hidden, null, { timeout: 30000 });
  const secs = await ev(() => state.sections.map(s => ({ num: s.num, title: s.title, recs: s.records.length, pages: s.first + '-' + s.last, issues: s.issues.length })));
  log('Spec book split into CSI sections', secs.length === 3, JSON.stringify(secs));
  const recSample = await ev(() => state.secMap.get('06 41 16').records.filter(r => /Hinges|Locks|Countertop Height/.test(r.text)).map(r => ({ label: r.label, page: r.page, text: r.text })));
  log('Paragraph records keep numbering and page', recSample.length === 3, JSON.stringify(recSample));
  await shot('01-spec');

  // ---------- section summary ----------
  await page.click('#btnSum');
  await page.waitForFunction(() => { const s = state.summaries.get('06 41 16'); return s && !s.running; }, null, { timeout: 30000 });
  await page.waitForTimeout(200);
  const sumBad = await page.locator('#sumBox .cite .vbad').count();
  const sumPts = await ev(() => state.summaries.get('06 41 16').points.length);
  log('Summary with sources: invented quote marked red', sumBad === 1, `${sumPts} points, ${sumBad} flagged`);
  await shot('02-summary');

  // ---------- Ask ----------
  await page.click('.tabs button[data-tab="ask"]');
  await page.fill('#askQ', 'What hinges and drawer slides are specified for the cabinets?');
  await page.click('#askGo');
  await page.waitForSelector('#askOut .answer h2', { timeout: 20000 });
  const ask = await ev(() => ({ cites: document.querySelectorAll('#askOut .cite').length, bad: document.querySelectorAll('#askOut .vbad').length, lead: document.querySelector('#askOut .lead').textContent.slice(0, 120), refs: [...document.querySelectorAll('#askOut .cite .ref[data-rid]')].map(b => b.textContent) }));
  log('Ask: answer with cited quotes; invented quote flagged', ask.cites >= 3 && ask.bad === 1, JSON.stringify(ask));
  await shot('03-ask');

  // ---------- Compare ----------
  await page.click('.tabs button[data-tab="compare"]');
  await page.setInputFiles('#otherFile', FX('proposal.pdf'));
  await page.waitForFunction(() => state.other && state.other.chunks.length, null, { timeout: 20000 });
  await page.fill('#pickFilter', '06 41');
  await page.click('#pickShown');
  await page.fill('#pickFilter', '12 36');
  await page.click('#pickShown');
  await page.fill('#pickFilter', '');
  await page.click('#cmpGo');
  await page.waitForFunction(() => /^Finished/.test(document.querySelector('#cmpStatus').textContent) || document.querySelector('#cmpStatus .err'), null, { timeout: 30000 });
  const cmp = await ev(() => ({ status: document.querySelector('#cmpStatus').textContent, items: state.cmpItems.map(i => `${i.sec} ${i.status}: ${i.topic}`), bad: document.querySelectorAll('#cmpOut .vbad').length }));
  const st = s => cmp.items.filter(i => i.includes(s));
  log('Compare: conflicts found (hinge 170 vs 110, slides 100 vs 75)', st('conflict').length >= 2, st('conflict').join(' | '));
  log('Compare: gaps and exclusions found', st('gap').length >= 1 && st('exclusion').length >= 1, [...st('gap'), ...st('exclusion')].join(' | '));
  log('Compare: all quotes verified against both documents', cmp.bad === 0, `${cmp.bad} unverified; ${cmp.status}`);
  await page.click('#cmpCsv');
  await page.waitForTimeout(300);
  const saves1 = await ev(() => window.__saves.map(s => s.filename + ' ' + s.size));
  log('Compare: Save findings (CSV) goes through downloads', saves1.some(s => s.startsWith('spec-comparison.csv')), saves1.join(', '));
  await shot('04-compare');

  // ---------- Drawings ----------
  await page.click('.tabs button[data-tab="drawings"]');
  await page.selectOption('#dwgKind', 'Architectural');
  await page.setInputFiles('#dwgFile', FX('arch-A501.pdf'));
  await page.waitForFunction(() => state.dwg.sets.length === 1 && !dwgBusy, null, { timeout: 20000 });
  await page.selectOption('#dwgKind', 'Shop drawings');
  await page.setInputFiles('#dwgFile', FX('shop-M01.pdf'));
  await page.waitForFunction(() => state.dwg.sets.length === 2 && !dwgBusy, null, { timeout: 20000 });
  const dw = await ev(() => ({ sheets: [...state.dwg.sheets.keys()], issues: state.dwg.issues.map(i => i.title), tags: [...state.dwg.tags.keys()] }));
  log('Drawings: sheet numbers detected (A-501, M.01)', dw.sheets.includes('A501') && dw.sheets.includes('M01'), JSON.stringify(dw.sheets));
  log('Drawings: missing sheet reference A-502 flagged', dw.issues.some(t => /A-502/.test(t)), dw.issues.join(' | '));
  log('Drawings: tags found (PL-1, SS-1, item 201.01)', ['PL-1', 'SS-1', 'Item 201.01'].every(t => dw.tags.includes(t)), dw.tags.join(', '));
  await shot('05-drawings');

  // ---------- Ask the drawings ----------
  await page.fill('#daQ', 'What backsplash height and countertop material are shown?');
  await page.click('#daGo');
  await page.waitForSelector('#daOut .answer', { timeout: 30000 });
  const da = await ev(() => ({ srcs: [...document.querySelectorAll('#daOut .cite .q')].map(q => q.textContent + (q.classList.contains('bad') ? ' [FLAGGED]' : '')), lead: document.querySelector('#daOut .lead').textContent }));
  log('Ask the drawings: answers cite sheet text; invented value flagged', da.srcs.some(s => /BACKSPLASH/.test(s) && !/FLAGGED/.test(s)) && da.srcs.some(s => /42" COUNTER HEIGHT \[FLAGGED\]/.test(s)), JSON.stringify(da));
  const daCall = (await calls()).filter(c => c.kind.startsWith('You are helping')).pop();
  log('Ask the drawings: sheet images sent as JPEG', daCall && daCall.images > 0 && daCall.imgTypes.includes('image/jpeg'), JSON.stringify(daCall));

  // ---------- Drawing review ----------
  await page.click('.tabs button[data-tab="review"]');
  await page.waitForTimeout(800);
  const pair = await ev(() => ({ shop: rv.shop, arch: rv.arch, refs: document.querySelector('#rv-refs').textContent.trim(), pairs: pairedSheets().length }));
  log('Drawing review: RE: 3/A-501 auto-pairs M.01 with A-501', !!pair.arch.sid && pair.pairs === 1, JSON.stringify(pair));
  await page.click('#rvGo');
  await page.waitForFunction(() => state.reviews.length > 0 || document.querySelector('#rvStatus .err'), null, { timeout: 60000 });
  await page.waitForTimeout(300);
  const rvr = await ev(() => { const r = state.reviews[0]; return { items: r.items.map(i => `${i.status}: ${i.shop_text} / ${i.arch_text}${i.possibly_intentional ? ' (possibly intentional)' : ''}`), images: r.images, specCount: r.specCount,
    flagged: [...document.querySelectorAll('#rvOut .vbad')].map(e => e.closest('.cite').querySelector('.q').textContent), fromImg: [...document.querySelectorAll('#rvOut .cite')].filter(c => /Read from the image/.test(c.textContent)).map(c => c.querySelector('.q').textContent) }; });
  log('Drawing review: dimension conflicts found (12\'-0" vs 11\'-11 1/2", 34 1/2" vs 36")', rvr.items.filter(i => i.startsWith('conflict')).length >= 2, rvr.items.join(' | '));
  log('Drawing review: value not on the sheet is flagged red', rvr.flagged.includes('4" WIRE PULL'), 'flagged: ' + JSON.stringify(rvr.flagged));
  log('Drawing review: image-only value labeled', rvr.fromImg.includes('PLYWOOD'), JSON.stringify(rvr.fromImg));
  log('Drawing review: spec passages + images included', rvr.specCount > 0 && rvr.images > 0, `images ${rvr.images}, spec paragraphs ${rvr.specCount}`);
  await shot('06-review');

  // ---------- Deep check ----------
  await page.click('.tabs button[data-tab="deep"]');
  await page.waitForTimeout(300);
  await page.selectOption('#dpRounds', '4');
  const callsBefore = (await calls()).length;
  await page.click('#dpGo');
  await page.waitForFunction(() => !state.deep.running && /finished|Stopped|couldn/i.test(document.querySelector('#dpStatus').textContent), null, { timeout: 120000 });
  await page.waitForTimeout(300);
  const deep = await ev(() => ({ log: state.deep.log[0], status: document.querySelector('#dpStatus').textContent,
    sumPoints: [...state.summaries.entries()].map(([k, s]) => [k, s.points.map(p => `${p.chk ? p.chk.status + (p.chk.n > 1 ? 'x' + p.chk.n : '') : 'unchecked'}${p.round ? ' (round ' + p.round + ')' : ''}: ${p.statement.slice(0, 70)}`)]),
    cmp: state.cmpItems.filter(i => i.chk).map(i => `${i.chk.status}: ${i.topic} -> ${i.status}`),
    dwg: state.reviews[0].items.filter(i => i.chk).map(i => `${i.chk.status}: ${i.topic}`),
    xrefs: state.deep.xrefs.map(x => x.title), issues: document.querySelector('#issueCount') ? document.querySelector('#issueCount').textContent : '' }));
  const deepCalls = (await calls()).slice(callsBefore);
  const byKind = {}; for (const c of deepCalls) byKind[c.kind.slice(0, 40)] = (byKind[c.kind.slice(0, 40)] || 0) + 1;
  console.log('\nDEEP LOG', JSON.stringify(deep.log, null, 1), '\nCALLS', byKind, '\n');
  for (const [k, pts] of deep.sumPoints) console.log('SUMMARY', k, '\n  ' + pts.join('\n  '));
  console.log('CMP', deep.cmp.join('\n    '), '\nDWG', deep.dwg.join('\n    '), '\nXREF', deep.xrefs);
  const flat = deep.sumPoints.flatMap(x => x[1]);
  log('Deep check: loop ran more than one round and stopped by itself', deep.log.rounds.length > 1 && /settled|full/.test(deep.log.stopped), `${deep.log.rounds.length} rounds; ${deep.log.stopped}`);
  log('Deep check: found the missed Locks requirement on a later round', flat.some(s => /round [2-9]/.test(s) && /Locks/.test(s)));
  log('Deep check: corrected the wrong drawer-slide value (75 -> 100 lbf)', flat.some(s => /^corrected.*Drawer Slides: Full-extension/.test(s)), flat.filter(s => /slide/i.test(s)).join(' | '));
  log('Deep check: hinge point whose quote is NOT in the spec is not silently "corrected"', !flat.some(s => /^corrected.*Hinges/.test(s)), flat.filter(s => /hinge/i.test(s)).join(' | '));
  log('Deep check: false gap (edgebanding) re-searched and corrected to match', deep.cmp.some(s => /corrected: Edgebanding -> match/.test(s)), deep.cmp.join(' | '));
  log('Deep check: hallucinated drawing value disputed on close-up', deep.dwg.some(s => /disputed: Pull type/.test(s)), deep.dwg.join(' | '));
  const dwgCall = deepCalls.find(c => c.kind.startsWith('An earlier comparison of a millwork'));
  log('Deep check: drawing close-ups sent as images', dwgCall && dwgCall.images > 0, JSON.stringify(dwgCall));
  await shot('07-deep');
  await page.locator('#pane-deep').screenshot({ path: path.join(SHOTS, '07b-deep-pane.png') }).catch(() => {});

  // ---------- Error handling ----------
  await page.click('.tabs button[data-tab="ask"]');
  for (const mode of ['rate_limited', 'prompt_too_large', 'invalid_json']) {
    await ev(m => window.__mock.mode = m, mode);
    await page.click('#askGo');
    await page.waitForFunction(() => document.querySelector('#askOut .warn') && !document.querySelector('#askGo').disabled, null, { timeout: 10000 });
    log(`Error message shown for ${mode}`, true, await page.locator('#askOut .warn').first().textContent());
  }
  await ev(() => window.__mock.mode = 'slow');
  await page.click('#askGo');
  await page.waitForTimeout(400);
  await page.click('#askStop');
  await page.waitForFunction(() => !document.querySelector('#askGo').disabled, null, { timeout: 5000 });
  log('Stop button cancels a running request', /Stopped/.test(await page.locator('#askOut').textContent()));
  await ev(() => window.__mock.mode = 'ok');

  // ---------- Persistence: reload and reopen the project ----------
  await page.waitForTimeout(2500);
  await page.reload(); await page.waitForTimeout(800);
  const recent = await ev(() => [...document.querySelectorAll('[data-popen]')].map(b => b.dataset.popen));
  if (recent.length) { await page.click(`[data-popen="${recent[0]}"]`); await page.waitForFunction(() => state.sections.length > 0, null, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1500); }
  const back = await ev(() => ({ secs: state.sections.length, sums: state.summaries.size, cmp: state.cmpItems.length, rv: (state.reviews || []).length, sets: state.dwg.sets.length, deep: state.deep.log.length }));
  log('Project reopens after reload with work kept', back.secs === 3 && back.cmp > 0 && back.rv > 0 && back.sets === 2, JSON.stringify(back));

  console.log('\nPAGE ERRORS:', errors.length ? errors : 'none');
  console.log('AI CALLS:', (await calls()).length);
  fs.writeFileSync(path.join(H, 'results.json'), JSON.stringify({ results, errors }, null, 1));
  console.log(`\n${results.filter(r => r.ok).length}/${results.length} passed`);
  await browser.close();
})().catch(e => { console.error('HARNESS CRASH', e); process.exit(1); });
