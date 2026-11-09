// Room schedule, Microvellum transfer, reading RE: references from pictures, scoring against redlines.
const { setup, FX } = require('./harness');
const XLSX = require('xlsx');

(async () => {
  const { page, log, ev, calls, shot, done } = await setup(process.argv[2]);
  const waitIdle = () => page.waitForFunction(() => !dwgBusy, null, { timeout: 30000 });

  await page.setInputFiles('#fileInput', FX('spec-book.pdf'));
  await page.waitForFunction(() => state.sections.length > 0 && !document.querySelector('.tabs').hidden, null, { timeout: 30000 });
  await page.click('.tabs button[data-tab="drawings"]');
  await page.selectOption('#dwgKind', 'Architectural');
  await page.setInputFiles('#dwgFile', FX('arch-A501.pdf')); await page.waitForFunction(() => state.dwg.sets.length === 1); await waitIdle();
  await page.selectOption('#dwgKind', 'Shop drawings');
  await page.setInputFiles('#dwgFile', FX('shop-M01.pdf')); await page.waitForFunction(() => state.dwg.sets.length === 2); await waitIdle();
  await page.setInputFiles('#dwgFile', FX('shop-redlines-cad.pdf')); await page.waitForFunction(() => state.dwg.sets.length === 3); await waitIdle();

  // ---------- CAD plot without text: plot stamp, markups ----------
  const cad = await ev(() => { const s = state.dwg.sets[2]; return { sheets: s.pages.map(p => p.sheet && { disp: p.sheet.disp, fromStamp: !!p.sheet.fromStamp }), chunks: s.pages.map(p => p.chunks.length), issues: state.dwg.issues.filter(i => i.title.includes(s.name)).map(i => i.title), status: document.querySelector('#dwgStatus').textContent }; });
  log('CAD plot: sheet numbers taken from the plot stamp (M.02, M.03)', cad.sheets.every(Boolean) && cad.sheets.map(s => s.disp).join() === 'M.02,M.03' && cad.sheets.every(s => s.fromStamp), JSON.stringify(cad));
  log('CAD plot: "no readable text" warning shown', cad.issues.some(t => /no readable text layer/.test(t)) && /almost no text/.test(cad.status), cad.issues.join(' | '));
  const mk = await ev(() => allMarks().map(x => ({ t: x.mk.t, a: x.mk.a, d: pdfDate(x.mk.d), stamp: x.status, sheet: x.pg.sheet && x.pg.sheet.disp })));
  log('Markups: 5 reviewer comments read with author and date (stamp kept apart)', mk.length === 5 && mk.every(m => m.a && m.d), JSON.stringify(mk));
  log('Markups: "PICKED UP" stamp linked to the comment beside it', mk.some(m => /Countertop height/.test(m.t) && m.stamp === 'PICKED UP') && mk.filter(m => m.stamp).length === 1, mk.filter(m => m.stamp).map(m => m.t + ' -> ' + m.stamp).join());
  const mkUi = await ev(() => ({ rows: document.querySelectorAll('#mkBox tbody tr').length }));
  log('Markups: table in the Drawings tab', mkUi.rows === 5, `${mkUi.rows} rows`);
  await page.click('#mkBox summary');
  await page.click('#mkCsv');
  await page.waitForTimeout(300);
  const mkCsv = await ev(() => (window.__saves.find(s => s.filename === 'reviewer-markups.csv') || {}).text || '');
  log('Markups: Save markups (CSV)', mkCsv.split('\n').length === 6 && /J\. Ortiz/.test(mkCsv), mkCsv.split('\n').slice(0, 3).join(' / '));
  await shot('20-cad-markups');

  // ---------- Reading RE: references from the picture ----------
  await page.click('.tabs button[data-tab="review"]');
  await page.waitForTimeout(600);
  const before = await ev(() => ({ btn: document.querySelector('#rvReadAll').textContent, hidden: document.querySelector('#rvReadAll').hidden, pairs: pairedSheets().length }));
  log('RE: button offered for shop sheets without text', !before.hidden && /2 shop sheets/.test(before.btn), JSON.stringify(before));
  const n0 = (await calls()).length;
  await page.click('#rvReadAll');
  await page.waitForFunction(() => /^Read /.test(document.querySelector('#rvStatus').textContent) || document.querySelector('#rvStatus .err'), null, { timeout: 60000 });
  const reCalls = (await calls()).slice(n0);
  const after = await ev(() => ({ status: document.querySelector('#rvStatus').textContent, reRefs: state.reRefs, pairs: pairedSheets().map(p => `${pageLabel(findSet(p.shop.sid), p.shop.n)} -> ${pageLabel(findSet(p.arch.sid), p.arch.n)}`),
    missing: state.dwg.issues.filter(i => /missing sheet/.test(i.type)).map(i => i.title), sheets: state.dwg.sets[2].pages.map(p => p.sheet.disp + (p.sheet.fromClaude ? ' (read by Claude)' : '')) }));
  log('RE: each reading sends 5 JPEG images (whole + quarters) to the quick model', reCalls.every(c => c.images === 5 && c.tier === 'quick' && c.imgTypes.join() === 'image/jpeg'), JSON.stringify(reCalls.map(c => ({ images: c.images, tier: c.tier, kb: Math.round(c.imgBytes / 1024) }))));
  const reChk = await ev(() => state.reRefsChk);
  log('Auto-check (RE:): sheets read again until two readings agree (M.02: 4 readings, M.03: 2)', reCalls.length === 6 && JSON.stringify(Object.values(reChk).map(x => x.reads)) === '[4,2]', JSON.stringify(reChk));
  log('Auto-check (RE:): a reference seen in only one reading (C9/A-777) is marked uncertain', JSON.stringify(Object.values(reChk).map(x => x.uncertain)) === '[["C9/A-777"],[]]', '');
  log('RE: references read from picture pair M.02 with A-501', after.pairs.some(p => /^M\.02.*A-501/.test(p)), after.pairs.join(' | '));
  log('RE: "RE: -" ignored and reference to unloaded A-458 reported', !JSON.stringify(after.reRefs).includes('RE: -') && after.missing.some(t => /A-?458/.test(t)), after.missing.join(' | '));

  // ---------- Drawing review of the image-only sheet, then scoring against the redlines ----------
  await page.selectOption('#rv-shop-set', await ev(() => state.dwg.sets[2].id));
  await page.waitForTimeout(500);
  const pairNow = await ev(() => ({ shop: pageLabel(findSet(rv.shop.sid), rv.shop.n), arch: rv.arch.sid ? pageLabel(findSet(rv.arch.sid), rv.arch.n) : null }));
  log('Review: picking M.02 auto-opens A-501', pairNow.arch && /A-501/.test(pairNow.arch), JSON.stringify(pairNow));
  const n1 = (await calls()).length;
  await page.click('#rvGo');
  await page.waitForFunction(() => state.reviews.length > 0 || document.querySelector('#rvStatus .err'), null, { timeout: 60000 });
  await page.waitForTimeout(300);
  const rvCall = await ev(n => window.__calls[n], n1);
  log('Review: markups are NOT sent to Claude (comparison stays independent)', !/Line weights|PICKED UP|Ortiz/.test(rvCall.prompt), 'checked the prompt text');
  const rvImgCheck = await ev(async () => {   // does the image sent to Claude contain the red markup? count reddish pixels
    const set = state.dwg.sets[2]; const b = await renderRegionBlob(set, 1, FULL, 1400); const bm = await createImageBitmap(b);
    const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d'); x.drawImage(bm, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let red = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] < 90 && d[i + 2] < 90) red++; return red; });
  log('Review: images sent to Claude have no markups drawn on them', rvImgCheck === 0, `${rvImgCheck} red pixels`);
  const benchBtn = await page.locator('[data-bench]').count();
  log('Review: "Score against the redlines" offered (4 markups on M.02)', benchBtn === 1, await page.locator('.bench').first().textContent().catch(() => ''));
  await page.click('[data-bench]');
  await page.waitForFunction(() => state.reviews[0].bench && !state.reviews[0].bench.running, null, { timeout: 30000 });
  await page.waitForTimeout(300);
  const bench = await ev(() => ({ text: document.querySelector('.bench').innerText.replace(/\s+/g, ' ').slice(0, 400), marks: state.reviews[0].bench.marks.map(m => `${m.kind}: ${m.t.slice(0, 30)} -> ${m.found.join(';') || '-'}`), total: document.querySelector('#rvBenchTotal').textContent, newFinds: state.reviews[0].bench.newFinds }));
  log('Scoring: 1 of 2 comparison redlines caught, 2 drafting comments set aside', /caught 1 of 2 comparison-type redlines; 2 more are drafting/.test(bench.text), bench.marks.join(' | '));
  log('Scoring: findings not in the redlines listed', bench.newFinds.length >= 1, JSON.stringify(bench.newFinds));
  await shot('21-scoring');
  await page.locator('#rvOut').screenshot({ path: require('path').join(__dirname, 'shots', '21b-scoring.png') }).catch(() => {});

  // ---------- Room schedule ----------
  await page.click('.tabs button[data-tab="rooms"]');
  await page.waitForTimeout(500);
  const picked = await ev(() => [...rsUi.picked].map(k => { const [s, n] = k.split(':'); return pageLabel(findSet(s), +n); }));
  log('Room schedule: suggested sheets ticked automatically', picked.length >= 1, picked.join(', '));
  await ev(() => { for (const s of state.dwg.sets) for (const p of s.pages) rsUi.picked.add(s.id + ':' + p.n); drawRsPicker(); });
  await page.click('#rsGo');
  await page.waitForFunction(() => /^Finished/.test(document.querySelector('#rsStatus').textContent) || document.querySelector('#rsStatus .err'), null, { timeout: 60000 });
  const rs = await ev(() => ({ status: document.querySelector('#rsStatus').textContent, counts: document.querySelector('#rsCounts').textContent,
    rows: state.rs.rows.map(r => `${r.f.room} ${r.f.item || r.f.desc} d=${r.f.depth} [${r.src.label}]${r.conf ? ' CONFLICT:' + [...r.conf].join(',') : ''}`),
    redCells: document.querySelectorAll('#rsTable td.rs-conf').length, checkFlags: [...document.querySelectorAll('#rsTable .vbad')].map(e => e.closest('tr').querySelector('[data-f="desc"]').value),
    issues: rsIssues().map(i => i.title + ': ' + i.detail) }));
  log('Room schedule: rows read from all 4 sheets, grouped by room (6 + 1 found by the check)', rs.rows.length === 7, rs.rows.join(' | '));
  const rck = await ev(() => ({ rows: state.rs.rows.map(r => `${r.chk ? r.chk.status : 'unchecked'}${r.round ? ' (added r' + r.round + ')' : ''}: ${r.f.item || r.f.desc} w=${r.f.width} d=${r.f.depth} [${r.src.label}]${r.chk && r.chk.status !== 'confirmed' ? ' — ' + (r.chk.was ? 'was ' + r.chk.was + '; ' : '') + r.chk.note : ''}`), status: document.querySelector('#rsStatus').textContent, issues: rsIssues().filter(i => i.type === 'Row not confirmed').map(i => i.title) }));
  console.log('     ' + rck.rows.join('\n     '));
  log('Auto-check (rooms): misread width 12\'-0" corrected to 11\'-11 1/2", which is in the sheet text', rck.rows.some(r => /^corrected: 201\.01 w=11'-11 1\/2"/.test(r)), rck.rows.filter(r => /201\.01/.test(r)).join(' | '));
  log('Auto-check (rooms): item not on the sheet ("Tall storage") flagged, kept for a person', rck.rows.some(r => /^disputed: Tall storage/.test(r)) && rck.issues.some(t => /Tall storage/.test(t)), rck.issues.join(' | '));
  log('Auto-check (rooms): on the CAD plot without text, a suggested correction goes to a person', rck.rows.some(r => /^disputed: 201\.01 w=11'-11 1\/2" d=24" \[M\.02/.test(r) && /no text to confirm/.test(r)), '');
  log('Auto-check (rooms): missed "Scribe filler" added by the second look and then confirmed', rck.rows.some(r => /^confirmed \(added r1\): Scribe filler/.test(r)), rck.status);
  log('Room schedule: M.01 (23 1/4") vs M.02 (24") depth disagreement turns red', rs.redCells >= 2 && rs.issues.some(t => /201\.01: depth differs/.test(t)), rs.issues.join(' | '));
  log('Room schedule: row whose evidence is not on the sheet gets "check"', rs.checkFlags.length === 1 && /Tall storage/.test(rs.checkFlags[0]), JSON.stringify(rs.checkFlags));
  await page.click('#rsTable [data-rsver]');
  const ver = await ev(() => document.querySelector('#rsCounts').textContent);
  log('Room schedule: Verified tick updates the count', /1 verified/.test(ver), ver);

  // estimate lines
  await page.setInputFiles('#rsEstFile', FX('estimate.xlsx'));
  await page.waitForFunction(() => /Added|couldn/.test(document.querySelector('#rsStatus').textContent), null, { timeout: 15000 });
  const est = await ev(() => ({ status: document.querySelector('#rsStatus').textContent, hdr: state.mv.estimate.headerRow, sheet: state.mv.estimate.sheet, rows: state.rs.rows.filter(r => r.origin === 'estimate').map(r => `${r.f.room}|${r.f.item}|${r.f.desc}|${r.f.width}|${r.f.depth}|${r.f.finish}|${r.f.notes} <${r.est}>`) }));
  log('Estimate: "Project Spreadsheet" tab and header row 13 found by themselves', est.sheet === 'Project Spreadsheet' && est.hdr === 13, est.status);
  log('Estimate: all 6 products added, incl. first line 201.01, the $0 product 201.03 and "Delivery drawer pedestal" (has an item number)',
    est.rows.length === 6 && ['201.01', '201.03', '105.02'].every(t => est.rows.some(r => r.includes('|' + t + '|'))), est.rows.join(' || '));
  log('Estimate: "Freight" and "Sales tax" lines (no item number) skipped and named in the message', !est.rows.some(r => /Freight|Sales tax/.test(r)) && /Skipped 2 non-product lines \(Freight, Sales tax 8\.25%\)/.test(est.status), est.status);
  log('Estimate: item identifier goes to Item / tag, description to Product', est.rows.some(r => r.startsWith('201|201.03|Owner-furnished shelf standards')), '');
  await page.click('#rsXlsx'); await page.click('#rsCsv'); await page.waitForTimeout(500);
  const rsx = await ev(() => window.__saves.filter(s => /room schedule/.test(s.filename)).map(s => ({ f: s.filename, b64: s.b64, text: s.text })));
  const wb = rsx.find(s => s.f.endsWith('.xlsx')) ? XLSX.read(Buffer.from(rsx.find(s => s.f.endsWith('.xlsx')).b64, 'base64')) : null;
  const aoa = wb ? XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) : [];
  log('Room schedule: saves as Excel and CSV (opens, one row per item)', aoa.length === state_rows(est, rs) + 1 && rsx.some(s => s.f.endsWith('.csv')), `xlsx ${aoa.length - 1} rows, headers: ${(aoa[0] || []).join(', ')}`);
  await shot('22-rooms');

  // ---------- Microvellum ----------
  await page.setInputFiles('#mvTplFile', FX('microvellum-import.xlsx'));
  await page.waitForTimeout(500);
  const mv1 = await ev(() => ({ layout: state.mv.layout.name, headers: state.mv.layout.headers, map: state.mv.map, source: state.mv.source }));
  log('Microvellum: column layout copied from a file Microvellum accepts', mv1.headers.join() === 'Room Number,Product Name,Item Tag,Quantity,Width,Height,Depth,Material,Comments', JSON.stringify(mv1.headers));
  await page.check('input[name="mvsrc"][value="schedule"]');
  await page.click('#mvAuto');
  await page.selectOption('#mvUnits', 'in');
  await page.waitForTimeout(300);
  const mvMap = await ev(() => Object.entries(state.mv.map).map(([k, v]) => `${k}=${v.type}:${v.v ?? ''}`));
  log('Microvellum: Match by name maps schedule fields', mvMap.filter(s => /field:/.test(s)).length >= 7, mvMap.join(', '));
  const n2 = (await calls()).length;
  await page.click('#mvClaude');
  await page.waitForFunction(() => /filled in|couldn/i.test(document.querySelector('#mvStatus').textContent), null, { timeout: 15000 });
  const mvc = (await calls()).slice(n2)[0];
  log('Microvellum: "Suggest with Claude" uses the quick model and fills the map', mvc && mvc.tier === 'quick', await page.locator('#mvStatus').textContent());
  await page.click('#mvCsv'); await page.click('#mvXlsx'); await page.waitForTimeout(500);
  const mvOut = await ev(() => window.__saves.filter(s => /Microvellum/.test(s.filename)).map(s => ({ f: s.filename, text: s.text, b64: s.b64 })));
  const csv = (mvOut.find(s => s.f.endsWith('.csv')) || {}).text || '';
  const lines = csv.split('\r\n');
  log('Microvellum: dimensions converted to decimal inches (11\'-11 1/2" -> 143.5, 23 1/4" -> 23.25)', /143\.5/.test(csv) && /23\.25/.test(csv), lines.slice(0, 4).join(' / '));
  const mvx = mvOut.find(s => s.f.endsWith('.xlsx'));
  const mwb = mvx ? XLSX.read(Buffer.from(mvx.b64, 'base64')) : null;
  log('Microvellum: CSV and Excel saved with the template columns', lines[0] === 'Room Number,Product Name,Item Tag,Quantity,Width,Height,Depth,Material,Comments' && mwb && mwb.SheetNames[0] === 'Import', `CSV ${lines.length - 1} rows; Excel tab ${mwb && mwb.SheetNames[0]}`);
  // estimate as the source
  await page.check('input[name="mvsrc"][value="estimate"]');
  await page.waitForTimeout(300);
  const mvEst = await ev(() => ({ map: Object.entries(state.mv.map).map(([k, v]) => `${k}=${v.type === 'col' ? state.mv.estimate.headers[v.v] : v.type}`), out: mvOutput().slice(0, 6).map(r => r.join(' | ')) }));
  log('Microvellum: estimate columns mapped (Item Tag=ITEM TO BE PRICED, Product Name=DESCRIPTION, LENGTH->Width)', ['Room Number=ROOM', 'Item Tag=ITEM TO BE PRICED', 'Product Name=DESCRIPTION', 'Width=LENGTH', 'Quantity=QTY'].every(x => mvEst.map.includes(x)), mvEst.map.join(', '));
  const mvAll = await ev(() => ({ out: mvOutput().slice(1).map(r => r.join(' | ')), note: [...document.querySelectorAll('#mvBox p.note')].map(p => p.textContent).find(t => /Estimate:/.test(t)) }));
  log('Microvellum from the estimate: 6 products, Freight and Sales tax left out, $0 product kept', mvAll.out.length === 6 && !mvAll.out.some(r => /Freight|Sales tax/.test(r)) && mvAll.out.some(r => /Owner-furnished/.test(r)) && /Left out 2 non-product lines/.test(mvAll.note), mvAll.note);
  await page.click('#mvClaude');
  await page.waitForFunction(() => /filled in|couldn/i.test(document.querySelector('#mvStatus').textContent), null, { timeout: 15000 });
  const mvHint = await ev(() => window.__calls[window.__calls.length - 1].prompt);
  log('Microvellum: Claude is told ITEM TO BE PRICED is the item identifier', /"ITEM TO BE PRICED" is the item identifier/.test(mvHint), '');
  log('Microvellum: estimate rows converted (8\'-0" -> 96)', mvEst.out.some(r => / 96 /.test(' ' + r + ' ')), mvEst.out.join(' || '));
  await shot('23-microvellum');
  await page.locator('#mvBox').screenshot({ path: require('path').join(__dirname, 'shots', '23b-microvellum.png') }).catch(() => {});

  // ---------- Deep check cross-reference: estimate rooms vs drawing rooms ----------
  await page.click('.tabs button[data-tab="deep"]');
  await page.waitForTimeout(300);
  await ev(() => { for (const k of ['spec', 'verify', 'cmp', 'dwg']) dp.passes[k] = false; dp.passes.xref = true; });
  await page.click('#dpGo');
  await page.waitForFunction(() => !state.deep.running && /finished|Stopped/i.test(document.querySelector('#dpStatus').textContent), null, { timeout: 30000 });
  const xr = await ev(() => state.deep.xrefs.map(x => x.title));
  log('Cross-reference: room 110 priced in the estimate but on no sheet read', xr.some(t => /Room 110 is priced/.test(t)), xr.join(' | '));
  log('Cross-reference: rooms 201 and 105 match between estimate and drawings', !xr.some(t => /Room (201|105)/.test(t)), '');

  await done('results2.json');
  function state_rows(est, rs) { return est.rows.length + rs.rows.length; }
})().catch(e => { console.error('HARNESS CRASH', e); process.exit(1); });
