// Second batch of fixtures: CAD plot without text + redlines, estimate workbook, Microvellum
// template, a 900-page spec book and a ~500 MB / 512-sheet drawing set.
// Usage: node make-fixtures2.js [small|big|all]   (default all)
const { chromium } = require('playwright');
const { PDFDocument, PDFName, PDFString, StandardFonts, rgb } = require('pdf-lib');
const XLSX = require('xlsx');
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, 'fixtures');
const what = process.argv[2] || 'all';
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// ---------- CAD plot shop drawings (no text layer) with Bluebeam-style redlines ----------
function sheetPage(items) {
  return `<html><body style="margin:0;width:1700px;height:1100px;position:relative;font-family:Arial;background:#fff">
  ${items.map(([x, y, t, s]) => `<div style="position:absolute;left:${x * 17}px;top:${y * 11}px;font-size:${(s || 9) * 1.4}px;white-space:nowrap">${esc(t)}</div>`).join('')}
  <svg style="position:absolute;left:0;top:0" width="1700" height="1100"><rect x="20" y="20" width="1660" height="1060" fill="none" stroke="#000" stroke-width="3"/><line x1="1380" y1="20" x2="1380" y2="1080" stroke="#000" stroke-width="2"/>
  <rect x="200" y="330" width="600" height="360" fill="none" stroke="#000" stroke-width="2"/><line x1="200" y1="510" x2="800" y2="510" stroke="#000"/><line x1="400" y1="330" x2="400" y2="690" stroke="#000"/><line x1="600" y1="330" x2="600" y2="690" stroke="#000"/></svg></body></html>`;
}
const M02 = [
  [12, 22, '1', 14], [12, 26, 'ELEVATION - BREAK ROOM 201  1/2" = 1\'-0"  RE: 3/A-501', 11],
  [25, 30, '11\'-11 1/2"', 9], [8, 45, '36"', 9], [8, 58, '36"', 9], [25, 50, 'PL-1', 8], [25, 66, 'SS-1 SOLID SURFACE', 8], [30, 56, '201.01', 9],
  [12, 80, '2', 14], [12, 84, 'SECTION - BREAK ROOM 201  RE: 4/A-501', 11], [50, 88, 'BASE CAB DEPTH 24"', 8],
  [83, 80, 'CASEWORK ELEVATIONS', 10], [86, 90, 'M.02', 26]];
const M03 = [
  [12, 22, '1', 14], [12, 26, 'ELEVATION - RECEPTION 105  1/2" = 1\'-0"  RE: C4/A-458', 11],
  [25, 30, '10\'-0"', 9], [8, 50, '42"', 9], [30, 56, '105.01', 9], [25, 66, 'QZ-1 QUARTZ TOP', 8],
  [83, 80, 'CASEWORK ELEVATIONS', 10], [86, 90, 'M.03', 26]];

async function makeRedlines(browser) {
  const p = await browser.newPage({ viewport: { width: 1700, height: 1100 } });
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const W = 1224, Hh = 792;   // 17 x 11 in
  const marks = {
    'M.02': [
      ['FreeText', 6, 61, 22, 66, 'Countertop height s/b 34 1/2" per 3/A-501', 'J. Ortiz'],
      ['FreeText', 48, 91, 70, 95, 'Base cab depth must be 24" per arch section 4/A-501. Check.', 'J. Ortiz'],
      ['Text', 40, 20, 42, 22, 'Line weights too heavy on this elevation - use CMI standard pens', 'M. Reyes'],
      ['FreeText', 28, 58, 40, 61, 'Remove item tag 201.02, duplicate', 'M. Reyes'],
      ['Stamp', 6, 67, 14, 70, 'PICKED UP', 'Drafting'],
    ],
    'M.03': [['FreeText', 6, 53, 20, 57, 'Counter height 42" ok per arch', 'J. Ortiz']],
  };
  for (const [name, items] of [['M.02', M02], ['M.03', M03]]) {
    await p.setContent(sheetPage(items));
    const png = await p.screenshot({ type: 'png' });
    const img = await doc.embedPng(png);
    const pg = doc.addPage([W, Hh]);
    pg.drawImage(img, { x: 0, y: 0, width: W, height: Hh });
    pg.drawText(`C:\\CMI\\LAREDO\\${name}.dwg, 11/1/2026 2:14 PM`, { x: 30, y: 8, size: 5, font, color: rgb(0, 0, 0) });   // AutoCAD plot stamp: the only text on the page
    const ctx = doc.context; const annots = [];
    for (const [sub, x1, y1, x2, y2, txt, who] of marks[name]) {
      const rect = [x1 / 100 * W, Hh - y2 / 100 * Hh, x2 / 100 * W, Hh - y1 / 100 * Hh];
      const a = ctx.obj({ Type: 'Annot', Subtype: sub, Rect: rect, Contents: PDFString.of(txt), T: PDFString.of(who), M: PDFString.of('D:20261101141500'), C: [1, 0, 0], DA: PDFString.of('/Helv 9 Tf 1 0 0 rg'), F: 4 });
      annots.push(ctx.register(a));
    }
    pg.node.set(PDFName.of('Annots'), ctx.obj(annots));
  }
  fs.writeFileSync(path.join(OUT, 'shop-redlines-cad.pdf'), await doc.save());
  await p.close();
}

// ---------- estimate workbook (Laredo layout: "Project Spreadsheet" tab, header on row 13) ----------
function makeEstimate() {
  const aoa = [['LAREDO TEST PROJECT'], ['ESTIMATE 24-117'], ['Prepared by CMI estimating'], [], ['Bid date', '11/1/2026'], [], [], [], [], [], [], [],
    ['ROOM', 'ITEM TO BE PRICED', 'DESCRIPTION', 'QTY', 'LENGTH', 'HEIGHT', 'DEPTH', 'FINISH ID', 'ARCH ELEV', 'COMMENTS', 'PRICE'],
    ['201', '201.01', 'Base cabinet run with SS top', '1', '11\'-11 1/2"', '34 1/2"', '24"', 'PL-1', '3/A-501', 'Scribe at wall', '$6,400'],
    ['201', '201.02', 'Wall cabinets', '1', '8\'-0"', '30"', '12"', 'PL-1', '3/A-501', '', '$2,900'],
    ['201', '201.03', 'Owner-furnished shelf standards, install only', '4', '0', '0', '0', '', '', 'No charge', '$0'],
    ['105', '105.01', 'Reception counter', '1', '10\'-0"', '42"', '30"', 'QZ-1', 'C4/A-458', '', '$9,800'],
    ['105', '105.02', 'Delivery drawer pedestal', '1', '15"', '28"', '24"', 'PL-1', '', '', '$700'],
    ['112', '', 'Overhead cabinets, open shelving', '3', '3\'-0"', '30"', '12"', 'PL-1', '', 'No item number yet', '$1,500'],
    ['', '', 'Overhead', '1', '', '', '', '', '', '', '$2,400'],
    ['110', '110.01', 'Workroom base cabinets', '2', '6\'-0"', '34 1/2"', '24"', 'PL-2', '', 'Not on any sheet read', '$4,100'],
    ['', '', 'Freight', '0', '0', '0', '0', '', '', '', '$0'],
    ['', '', 'Sales tax 8.25%', '1', '', '', '', '', '', '', '$1,980'],
    ['', '', 'TOTAL', '', '', '', '', '', '', '']];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Summary'], ['Total', '$48,200']]), 'Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Project Spreadsheet');
  XLSX.writeFile(wb, path.join(OUT, 'estimate.xlsx'));
  const tpl = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(tpl, XLSX.utils.aoa_to_sheet([['Room Number', 'Product Name', 'Item Tag', 'Quantity', 'Width', 'Height', 'Depth', 'Material', 'Comments']]), 'Import');
  XLSX.writeFile(tpl, path.join(OUT, 'microvellum-import.xlsx'));
}

// ---------- 900-page spec book ----------
function rng(seed) { let s = seed; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; }
const VOCAB = 'provide install submit comply manufacturer product material system finish surface panel frame anchor joint sealant fastener coating primer substrate assembly opening hardware component accessory warranty sample mockup testing inspection tolerance clearance alignment protection cleaning adjusting delivery storage handling field verify coordinate approved equal standard grade thickness gauge width height depth minimum maximum nominal concealed exposed interior exterior'.split(' ');
function sentence(r, n) { const w = []; for (let i = 0; i < n; i++) w.push(VOCAB[Math.floor(r() * VOCAB.length)]); w[0] = w[0][0].toUpperCase() + w[0].slice(1); return w.join(' ') + '.'; }
function makeSpecSections() {
  const r = rng(7), secs = [];
  const divs = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '14', '21', '22', '23', '26', '27', '28', '31', '32', '33'];
  let k = 0;
  while (secs.length < 175) {
    const d = divs[k % divs.length], num = `${d} ${String(10 + (k * 7) % 80).padStart(2, '0')} ${String((k * 13) % 90 + 10).padStart(2, '0')}`; k++;
    if (secs.some(s => s.num === num)) continue;
    secs.push({ num, title: ['GENERAL REQUIREMENTS', 'METAL FABRICATIONS', 'ROUGH CARPENTRY', 'JOINT SEALANTS', 'GYPSUM BOARD', 'TOILET ACCESSORIES', 'DOOR HARDWARE', 'ACOUSTICAL CEILINGS', 'RESILIENT FLOORING', 'SIGNAGE'][k % 10] + ' ' + k, pages: 5 });
  }
  // the millwork sections that matter, with known facts; 06 41 16 is long so it needs several requests
  secs.push({ num: '06 41 16', title: 'PLASTIC-LAMINATE-FACED ARCHITECTURAL CABINETS', pages: 40, facts: [
    'Hinges: Concealed European-style, self-closing, 170 degree opening, BHMA A156.9, Grade 1.',
    'Drawer Slides: Full-extension, ball-bearing, 100 lbf load rating, BHMA A156.9, Grade 1.',
    'Locks: Provide cam locks on all drawers and doors where indicated, keyed alike within each room.',
    'Countertop Height: 36 inches above finished floor unless otherwise indicated; 34 inches maximum at accessible locations.'] });
  secs.push({ num: '12 36 61', title: 'SIMULATED STONE COUNTERTOPS', pages: 6, facts: ['Thickness: 3 cm (1-1/4 inch) quartz agglomerate, Caesarstone 4141 Misty Carrera.'] });
  secs.sort((a, b) => a.num.localeCompare(b.num));
  return secs;
}
function specBigHtml() {
  const r = rng(11);
  const pages = [];
  for (const s of makeSpecSections()) {
    const lines = [`SECTION ${s.num} - ${s.title}`];
    const facts = [...(s.facts || [])];
    let art = 0, part = 0;
    const target = s.pages * 22 - 2;
    while (lines.length < target) {
      if (part === 0 || (lines.length > target * part / 3 && part < 3)) { part++; art = 0; lines.push(`PART ${part} - ${['GENERAL', 'PRODUCTS', 'EXECUTION'][part - 1]}`); }
      art++; lines.push(`${part}.${art} ${sentence(r, 2).toUpperCase().replace('.', '')}`);
      for (let p = 0; p < 4 && lines.length < target; p++) {
        const L = 'ABCDEFGH'[p];
        const txt = facts.length && r() < 0.3 ? facts.shift() : sentence(r, 14 + Math.floor(r() * 10));
        lines.push(`${L}. ${txt}`);
      }
    }
    for (const f of facts) lines.push(`H. ${f}`);
    lines.push(`END OF SECTION ${s.num}`);
    for (let i = 0, n = 1; i < lines.length; i += 22, n++) pages.push({ s, n, lines: lines.slice(i, i + 22) });
  }
  const body = pages.map(p => `<div class="pg"><div class="hdr">LAREDO TEST PROJECT</div>${p.lines.map(l => `<p>${esc(l)}</p>`).join('')}<div class="ftr">${p.s.title} &nbsp;&nbsp; ${p.s.num} - ${p.n}</div></div>`).join('');
  console.log('spec pages:', pages.length);
  return `<html><head><style>@page{size:8.5in 11in;margin:0}body{margin:0;font:10.5pt Arial}.pg{width:8.5in;height:11in;padding:.8in;box-sizing:border-box;position:relative;page-break-after:always;overflow:hidden}.hdr{font-size:9pt;margin-bottom:.25in}.ftr{position:absolute;bottom:.5in;left:.8in;right:.8in;text-align:center;font-size:9pt}p{margin:0 0 6pt 0}</style></head><body>${body}</body></html>`;
}

// ---------- ~500 MB, 512-sheet architectural set ----------
async function makeBigDrawings(browser) {
  const p = await browser.newPage();
  const jpgB64 = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 1850; c.height = 1233; const x = c.getContext('2d'); const d = x.createImageData(c.width, c.height);
    for (let i = 0; i < d.data.length; i += 4) { const v = 200 + Math.random() * 55; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); return c.toDataURL('image/jpeg', 0.9).split(',')[1]; });
  await p.close();
  const jpg = Buffer.from(jpgB64, 'base64');
  console.log('raster per sheet:', (jpg.length / 1e6).toFixed(2), 'MB');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const W = 2592, Hh = 1728;   // 36 x 24 in
  const N = 512;
  const sheetNo = i => `A-${String(100 + i).padStart(3, '0')}`;
  for (let i = 1; i <= N; i++) {
    const pg = doc.addPage([W, Hh]);
    const img = await doc.embedJpg(jpg);           // embedded separately on every sheet, like a scanned/raster-heavy set
    pg.drawImage(img, { x: 0, y: 0, width: W * 0.78, height: Hh });
    const t = (s, x, y, size) => pg.drawText(s, { x, y: Hh - y, size: size || 14, font });
    if (i === 1) {
      t('SHEET INDEX', 2050, 120, 24);
      for (let k = 2; k <= N; k++) t(sheetNo(k), 2030 + Math.floor((k - 2) / 100) * 80, 160 + ((k - 2) % 100) * 14, 11);
      t('A-999', 2030, 1650, 11);          // listed on the index but not in the set
      t('COVER SHEET / INDEX', 2050, 1560, 18);
    } else {
      const room = 100 + (i % 120);
      t(`${i % 9 + 1}`, 200, 300, 30); t(`INTERIOR ELEVATION - ROOM ${room}`, 200, 340, 22);
      t(`SEE ${(i % 6) + 1}/${sheetNo(i % (N - 1) + 2)}`, 200, 380, 14);
      t(`PL-${i % 4 + 1} PLASTIC LAMINATE`, 600, 700, 14); t(`SS-${i % 2 + 1} SOLID SURFACE`, 600, 760, 14);
      t(`${30 + i % 7}"`, 150, 900, 14); t(`${8 + i % 4}'-${i % 12}"`, 700, 450, 14);
      if (i === 300) t('SEE 2/A-777', 200, 420, 14);   // reference to a sheet that isn't in the set
      t('INTERIOR ELEVATIONS', 2050, 1560, 18);
    }
    t(sheetNo(i), 2150, 1660, 48);
    if (i % 64 === 0) console.log('sheet', i);
  }
  const bytes = await doc.save({ useObjectStreams: false });
  fs.writeFileSync(path.join(OUT, 'arch-512-sheets.pdf'), bytes);
  console.log('arch set size:', (bytes.length / 1e6).toFixed(0), 'MB');
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  if (what !== 'big') { await makeRedlines(b); makeEstimate(); }
  if (what !== 'small') {
    const p = await b.newPage();
    await p.setContent(specBigHtml());
    await p.pdf({ path: path.join(OUT, 'spec-900.pdf'), preferCSSPageSize: true, timeout: 0 });
    await p.close();
    await makeBigDrawings(b);
  }
  await b.close();
  for (const f of fs.readdirSync(OUT)) console.log(f, (fs.statSync(path.join(OUT, f)).size / 1e6).toFixed(1) + ' MB');
})();
