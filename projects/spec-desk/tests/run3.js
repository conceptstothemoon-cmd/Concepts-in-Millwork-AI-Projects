// Large files: a ~900-page spec book and a ~500 MB, 512-sheet drawing set.
const { setup, FX } = require('./harness');
const fs = require('fs');

(async () => {
  const { page, log, ev, calls, shot, done, heapMB, rssMB } = await setup(process.argv[2]);
  const t = () => Date.now();
  const mem = async label => { const h = await heapMB(), r = rssMB(); console.log(`MEM  ${label}: JS heap ${h} MB, browser processes ${r} MB`); return { h, r }; };
  await mem('start');

  // ---------- 921-page spec book ----------
  let t0 = t();
  await page.setInputFiles('#fileInput', FX('spec-900.pdf'));
  await page.waitForFunction(() => state.sections.length > 0 && !document.querySelector('.tabs').hidden, null, { timeout: 600000 });
  const specSecs = (t() - t0) / 1000;
  const sp = await ev(() => ({ pages: state.pages.length, sections: state.sections.length, records: state.records.length, info: document.querySelector('#fileInfo').textContent,
    s0641: (() => { const s = state.secMap.get('06 41 16'); return s && { pages: `${s.first}-${s.last}`, recs: s.records.length, hinge: s.records.filter(r => /^Hinges:/.test(r.text)).map(r => r.label + ' p.' + r.page) }; })(),
    lowConf: state.sections.filter(s => s.conf && s.conf.score < 90).length, withIssues: state.sections.filter(s => s.issues.length).map(s => s.num + ': ' + s.issues.join('; ')).slice(0, 5) }));
  log(`Spec 921 pages: read in ${specSecs.toFixed(0)} s`, sp.pages === 921 && specSecs < 300, sp.info);
  log('Spec 921 pages: all 177 sections found, none with problems', sp.sections === 177 && sp.withIssues.length === 0, `${sp.sections} sections, ${sp.records} paragraphs, ${sp.lowConf} low-confidence; ${sp.withIssues.join(' | ')}`);
  log('Spec 921 pages: 40-page section 06 41 16 kept whole with its facts', sp.s0641 && sp.s0641.hinge.length === 1, JSON.stringify(sp.s0641));
  await mem('after spec book');

  // coverage
  await page.click('.tabs button[data-tab="coverage"]');
  await page.waitForTimeout(800);
  const cov = await ev(() => { const c = {}; for (const el of document.querySelectorAll('#pane-coverage .pc[data-page]')) { const k = [...el.classList].filter(x => x !== 'pc').join(' ') || 'plain'; c[k] = (c[k] || 0) + 1; } return c; });
  log('Coverage check: every one of the 921 pages accounted for', Object.values(cov).reduce((a, b) => a + b, 0) === 921, JSON.stringify(cov));
  await shot('30-coverage-900');

  // Ask the whole book
  await page.click('.tabs button[data-tab="ask"]');
  await page.fill('#askQ', 'What cabinet hinges and drawer slides are required?');
  let n = (await calls()).length; t0 = t();
  await page.click('#askGo');
  await page.waitForSelector('#askOut .answer h2', { timeout: 60000 });
  const askC = (await calls()).slice(n);
  const askR = await ev(() => ({ refs: [...document.querySelectorAll('#askOut .cite .ref[data-rid]')].map(b => b.textContent), read: document.querySelector('#askOut details summary').textContent }));
  log('Ask over the whole 921-page book: finds the hinge paragraph in 06 41 16', askR.refs.some(r => /^06 41 16/.test(r)), `${askR.read}; prompt ${Math.round(askC[0].len / 1000)}k chars; cites ${askR.refs.slice(0, 3).join(', ')}; ${(t() - t0)} ms in the app`);

  // Summarize the 40-page section (several requests)
  await page.click('.tabs button[data-tab="section"]');
  await page.fill('#secFilter', '06 41 16');
  await page.click('.sec-btn[data-sec="06 41 16"]');
  n = (await calls()).length;
  await page.click('#btnSum');
  await page.waitForFunction(() => { const s = state.summaries.get('06 41 16'); return s && !s.running; }, null, { timeout: 60000 });
  const sumC = (await calls()).slice(n);
  const sumR = await ev(() => { const s = state.secMap.get('06 41 16'); const sum = state.summaries.get('06 41 16'); return { recs: s.records.length, chunks: sum.chunks, points: sum.points.length }; });
  const sentIds = new Set(); for (const c of await ev(k => window.__calls.slice(k).map(c => c.prompt), n)) for (const m of c.matchAll(/^\[R(\d+)\]/gm)) sentIds.add(m[1]);
  log('Summary of the 40-page section: split into several requests, every paragraph sent once', sumC.length > 1 && sentIds.size === sumR.recs, `${sumC.length} requests (${sumC.map(c => Math.round(c.len / 1000) + 'k').join(', ')} chars), ${sentIds.size} of ${sumR.recs} paragraphs sent, ${sumR.points} points`);

  // Compare 06 41 16 against the proposal
  await page.click('.tabs button[data-tab="compare"]');
  await page.setInputFiles('#otherFile', FX('proposal.pdf'));
  await page.waitForFunction(() => state.other && state.other.chunks.length, null, { timeout: 20000 });
  await page.fill('#pickFilter', '06 41 16'); await page.click('#pickShown'); await page.fill('#pickFilter', '');
  n = (await calls()).length;
  await page.click('#cmpGo');
  await page.waitForFunction(() => /^Finished/.test(document.querySelector('#cmpStatus').textContent) || document.querySelector('#cmpStatus .err'), null, { timeout: 60000 });
  const cmpC = (await calls()).slice(n);
  const cmpR = await ev(() => ({ status: document.querySelector('#cmpStatus').textContent, conflicts: state.cmpItems.filter(i => i.status === 'conflict').map(i => i.topic) }));
  log('Compare the 40-page section: split into parts, conflicts still found', cmpC.length > 1 && cmpR.conflicts.length >= 2, `${cmpC.length} requests; ${cmpR.status}; conflicts: ${cmpR.conflicts.join(', ')}`);

  // Deep check on the two millwork sections
  await page.click('.tabs button[data-tab="deep"]');
  await page.waitForTimeout(500);
  const dpInfo = await ev(() => ({ keys: [...dp.keys], cost: document.querySelector('#dpCost').textContent }));
  n = (await calls()).length; t0 = t();
  await page.click('#dpGo');
  await page.waitForFunction(() => !state.deep.running && /finished|Stopped|couldn/i.test(document.querySelector('#dpStatus').textContent), null, { timeout: 300000 });
  const dpC = (await calls()).slice(n);
  const dpR = await ev(() => state.deep.log[0]);
  log('Deep check on the big book (millwork sections chosen by default)', dpR.rounds.length >= 2 && /settled|full/.test(dpR.stopped), `sections ${dpInfo.keys.join(', ')}; ${dpC.length} requests; ${dpR.rounds.length} rounds; ${dpR.stopped}`);
  console.log('     estimate shown before running:', dpInfo.cost);
  await mem('after spec work');

  // ---------- 507 MB, 512-sheet drawing set ----------
  const size = fs.statSync(FX('arch-512-sheets.pdf')).size / 1e6;
  await page.click('.tabs button[data-tab="drawings"]');
  await page.selectOption('#dwgKind', 'Architectural');
  t0 = t();
  await page.setInputFiles('#dwgFile', FX('arch-512-sheets.pdf'));
  await page.waitForFunction(() => state.dwg.sets.length === 1 && !dwgBusy, null, { timeout: 1200000, polling: 2000 });
  const dwgSecs = (t() - t0) / 1000;
  const m1 = await mem('after loading the drawing set');
  const dw = await ev(() => { const s = state.dwg.sets[0]; return { pages: s.pages.length, withSheet: s.pages.filter(p => p.sheet).length, idx: s.pages.filter(p => p.isIndex).map(p => p.n),
    issues: state.dwg.issues.map(i => i.type + ': ' + i.title + (i.detail ? ' [' + i.detail.slice(0, 60) + ']' : '')), status: document.querySelector('#dwgStatus').textContent, refs: [...state.dwg.refsTo.values()].reduce((a, l) => a + l.length, 0), tags: state.dwg.tags.size }; });
  log(`Drawing set ${size.toFixed(0)} MB / 512 sheets: loaded in ${dwgSecs.toFixed(0)} s`, dw.pages === 512 && !/couldn/.test(dw.status), dw.status);
  log('Drawing set: sheet number found on all 512 sheets; page 1 recognized as the index', dw.withSheet === 512 && dw.idx.join() === '1', `${dw.withSheet} sheets numbered; index pages ${dw.idx.join(',')}; ${dw.refs} references, ${dw.tags} tags`);
  log('Drawing set: A-999 (on index, not in set) and A-777 (referenced, missing) flagged, nothing else', dw.issues.length === 2 && dw.issues.some(t => /A-999/.test(t)) && dw.issues.some(t => /A-777/.test(t)), dw.issues.join(' | '));
  await shot('31-drawings-512');

  // Ask the drawings across 512 sheets
  await page.fill('#daQ', 'Which sheets show the interior elevation for room 150 and what plastic laminate is used?');
  n = (await calls()).length; t0 = t();
  await page.click('#daGo');
  await page.waitForSelector('#daOut .answer, #daOut .warn', { timeout: 300000 });
  const daC = (await calls()).slice(n);
  const daR = await ev(() => ({ looked: [...document.querySelectorAll('#daOut details.read li')].map(l => l.textContent.trim().slice(0, 40)), srcs: [...document.querySelectorAll('#daOut .cite .q')].slice(0, 4).map(q => q.textContent) }));
  log('Ask the drawings across 512 sheets: picks the right sheets and renders them', daC.length === 1 && daR.looked.some(l => /A-\d+/.test(l)), `${(t() - t0) / 1000}s; looked at ${daR.looked.join(' / ')}; ${daC[0] && daC[0].images} images, ${daC[0] && Math.round(daC[0].imgBytes / 1e6 * 10) / 10} MB`);
  await mem('after asking the drawings');

  // Reopen the project from the browser's storage
  await page.waitForTimeout(3000);
  t0 = t();
  await page.reload(); await page.waitForTimeout(800);
  const pid = await ev(() => (document.querySelector('[data-popen]') || {}).dataset?.popen);
  if (pid) await page.click(`[data-popen="${pid}"]`);
  await page.waitForFunction(() => state.sections.length > 0 && state.dwg.sets.length === 1, null, { timeout: 600000, polling: 2000 }).catch(() => {});
  const reopen = await ev(() => ({ secs: state.sections.length, pages: state.pages.length, sets: state.dwg.sets.length, dwgPages: state.dwg.sets[0] ? state.dwg.sets[0].pages.length : 0, sums: state.summaries.size, cmp: state.cmpItems.length }));
  log(`Project with both big files reopens from browser storage (${((t() - t0) / 1000).toFixed(0)} s)`, reopen.secs === 177 && reopen.dwgPages === 512 && reopen.cmp > 0, JSON.stringify(reopen));
  // render a sheet from the reopened (stored) PDF
  const pv = await ev(async () => { const s = state.dwg.sets[0]; const t0 = performance.now(); const b = await renderRegionBlob(s, 300, FULL, 1400); return { kb: Math.round(b.size / 1024), ms: Math.round(performance.now() - t0) }; });
  log('Reopened drawing set still renders sheets', pv.kb > 20, JSON.stringify(pv));
  await mem('after reopening');

  await done('results3.json');
})().catch(e => { console.error('HARNESS CRASH', e); process.exit(1); });
