// Splitting: drawing sets by sheet, spec books and drawing sets by size.
const { setup, FX } = require('./harness');
(async () => {
  const { page, log, ev, done, rssMB } = await setup(process.argv[2]);
  // opens a saved ZIP inside the page and reports every PDF in it
  const inspect = name => ev(async name => {
    const z = await JSZip.loadAsync(window.__blobs[name]); const out = [];
    for (const f of Object.keys(z.files).sort()) { if (z.files[f].dir) continue; const u = await z.file(f).async('uint8array');
      if (!f.endsWith('.pdf')) { out.push({ f, size: u.length, text: new TextDecoder().decode(u).slice(0, 3000) }); continue; }
      const d = await PDFLib.PDFDocument.load(u, { updateMetadata: false }); out.push({ f, size: u.length, pages: d.getPageCount() }); }
    return out; }, name);
  const waitSave = rx => page.waitForFunction(r => Object.keys(window.__blobs || {}).some(k => new RegExp(r).test(k)), rx.source, { timeout: 1200000, polling: 1000 });
  const savedName = rx => ev(r => Object.keys(window.__blobs).find(k => new RegExp(r).test(k)), rx.source);
  const MB = 1048576;

  // ---------- small sets: split by sheet ----------
  await page.click('#btnDwgOnly');
  await page.selectOption('#dwgKind', 'Architectural');
  await page.setInputFiles('#dwgFile', FX('arch-A501.pdf')); await page.waitForFunction(() => state.dwg.sets.length === 1 && !dwgBusy);
  await page.selectOption('#dwgKind', 'Shop drawings');
  await page.setInputFiles('#dwgFile', FX('shop-redlines-cad.pdf')); await page.waitForFunction(() => state.dwg.sets.length === 2 && !dwgBusy);
  const ids = await ev(() => state.dwg.sets.map(s => s.id));
  await page.click(`[data-splitsheets="${ids[0]}"]`); await waitSave(/arch-A501 - split by sheet/);
  let z = await inspect(await savedName(/arch-A501 - split by sheet/));
  log('By sheet: A-501 saved as "A/A-501 INTERIOR ELEVATIONS.pdf" (sheet number + title from the title block)', z.some(x => x.f === 'A/A-501 INTERIOR ELEVATIONS.pdf' && x.pages === 1), z.map(x => x.f).join(', '));
  log('By sheet: sheet list CSV included', z.some(x => x.f === 'Sheet list.csv' && /A-501,INTERIOR ELEVATIONS,A,1/.test(x.text)), (z.find(x => x.f === 'Sheet list.csv') || {}).text);
  await page.click(`[data-splitsheets="${ids[1]}"]`); await waitSave(/shop-redlines-cad - split by sheet/);
  z = await inspect(await savedName(/shop-redlines-cad - split by sheet/));
  log('By sheet: CAD plot without text named from the plot stamp (M.02, M.03), one page each', z.filter(x => x.pages === 1).map(x => x.f).join() === 'M/M.02.pdf,M/M.03.pdf', z.map(x => x.f).join(', '));

  // ---------- 921-page spec book: split by size ----------
  await page.setInputFiles('#fileInput', FX('spec-900.pdf'));
  await page.waitForFunction(() => state.sections.length > 100 && !document.querySelector('.tabs').hidden, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  await ev(() => { const s = document.querySelector('#splitMb'); s.insertAdjacentHTML('beforeend', '<option value="0.25">under 0.25 MB</option>'); s.value = '0.25'; });  // the test book is only 2 MB
  let t0 = Date.now();
  await page.click('#btnSplitSize'); await waitSave(/spec-900 - parts under/);
  z = await inspect(await savedName(/spec-900 - parts under/));
  const specParts = z.filter(x => x.f.endsWith('.pdf')), csv = z.find(x => x.f === 'Parts list.csv').text;
  const secPages = await ev(() => state.sections.map(s => [s.num, s.pageList]));
  const partOfPage = {}; csv.split('\r\n').slice(1).forEach(l => { const m = l.match(/^(\d+),.*,"?([\d, –-]+)"?,\d+$/); if (m) for (const r of m[2].split(',')) { const [a, b] = r.trim().split(/[–-]/).map(Number); for (let p = a; p <= (b || a); p++) partOfPage[p] = +m[1]; } });
  const splitSecs = secPages.filter(([, pl]) => new Set(pl.map(p => partOfPage[p])).size > 1).map(([n]) => n);
  log(`By size (spec): ${specParts.length} parts in ${((Date.now() - t0) / 1000).toFixed(0)} s, every part under the limit`, specParts.length > 3 && specParts.every(x => x.size <= 0.25 * MB), specParts.map(x => (x.size / 1024).toFixed(0) + 'k').join(' '));
  log('By size (spec): all 921 pages, each in exactly one part, in order', specParts.reduce((n, x) => n + x.pages, 0) === 921 && Object.keys(partOfPage).length === 921, specParts.slice(0, 2).map(x => x.f).join(' | '));
  log('By size (spec): no section split across parts', splitSecs.length === 0, `split: ${splitSecs.join(', ') || 'none'}; ${await page.locator('#fileInfo').textContent()}`);
  // a limit smaller than the 40-page section (92 KB): that section alone is spread over parts, and the message says so
  await ev(() => { delete window.__blobs[Object.keys(window.__blobs).find(k => /spec-900 - parts/.test(k))]; const s = document.querySelector('#splitMb'); s.insertAdjacentHTML('beforeend', '<option value="0.05">under 0.05 MB</option>'); s.value = '0.05'; });
  await page.waitForFunction(() => !document.querySelector('#btnSplitSize').disabled);
  await page.click('#btnSplitSize'); await waitSave(/spec-900 - parts under 0.05 MB/);
  z = await inspect(await savedName(/spec-900 - parts under 0.05 MB/));
  const msg2 = await page.locator('#fileInfo').textContent();
  log('By size (spec): a section bigger than the limit is spread over parts and reported; parts still under the limit', z.filter(x => x.f.endsWith('.pdf')).every(x => x.size <= 0.05 * MB) && /06 41 16 \(40 pages, .*\) is bigger than the limit/.test(msg2) && z.filter(x => x.f.endsWith('.pdf')).reduce((n, x) => n + x.pages, 0) === 921, msg2);

  // ---------- 507 MB set: by size and by sheet ----------
  await page.click('.tabs button[data-tab="drawings"]');
  await page.selectOption('#dwgKind', 'Architectural');
  await page.setInputFiles('#dwgFile', FX('arch-512-sheets.pdf')); await page.waitForFunction(() => state.dwg.sets.length === 3 && !dwgBusy, null, { timeout: 600000, polling: 1000 });
  const big = await ev(() => state.dwg.sets[2].id);
  await page.selectOption('#dwgSplitMb', '25');
  t0 = Date.now();
  await page.click(`[data-splitsize="${big}"]`); await waitSave(/arch-512-sheets - parts under 25 MB/);
  const tSize = (Date.now() - t0) / 1000, rss1 = rssMB();
  z = await inspect(await savedName(/arch-512-sheets - parts under 25 MB/));
  const bp = z.filter(x => x.f.endsWith('.pdf'));
  log(`By size (507 MB set, 25 MB): ${bp.length} parts in ${tSize.toFixed(0)} s, all under 25 MB, all 512 sheets`, bp.every(x => x.size <= 25 * MB) && bp.reduce((n, x) => n + x.pages, 0) === 512, `${bp.slice(0, 2).map(x => x.f + ' ' + (x.size / MB).toFixed(1) + ' MB').join(' | ')}; browser memory ${rss1} MB`);
  t0 = Date.now();
  await page.click(`[data-splitsheets="${big}"]`); await waitSave(/arch-512-sheets - split by sheet/);
  const tSheet = (Date.now() - t0) / 1000, rss2 = rssMB();
  z = await inspect(await savedName(/arch-512-sheets - split by sheet/));
  const sp = z.filter(x => x.f.endsWith('.pdf'));
  log(`By sheet (507 MB set): 512 one-page PDFs in ${tSheet.toFixed(0)} s, named by sheet and title`, sp.length === 512 && sp.every(x => x.pages === 1) && sp.some(x => x.f === 'A/A-150 INTERIOR ELEVATIONS.pdf'), `${sp.slice(0, 3).map(x => x.f).join(' | ')}; browser memory ${rss2} MB`);
  log('Status message after splitting', /split into 512 sheet PDFs/.test(await page.locator('#dwgStatus').textContent()), await page.locator('#dwgStatus').textContent());
  await done('results4.json');
})().catch(e => { console.error('HARNESS CRASH', e); process.exit(1); });
