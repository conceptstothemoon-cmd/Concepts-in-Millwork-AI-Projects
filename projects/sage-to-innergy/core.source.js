// Sage invoices -> Innergy added expenses: shared logic (browser and Node test harness).
(function (root) {
  'use strict';
  // Sage prints credits with a trailing minus ("500.00-").
  const num = s => { if (s == null) return null; let t = String(s).replace(/[$,\s]/g, ''), neg = false; if (/-$/.test(t)) { neg = true; t = t.slice(0, -1); } if (/^-/.test(t)) { neg = !neg; t = t.slice(1); } if (!/^\d*\.?\d+$/.test(t)) return null; const v = Math.round(parseFloat(t) * 100) / 100; return neg ? -v : v; };
  const AMT = /(-?[\d,]*\.\d{2}-?)\s*$/;
  const mdy = s => { const m = /(\d{1,2})-(\d{1,2})-(\d{2,4})/.exec(s || ''); if (!m) return null; let y = +m[3]; if (y < 100) y += 2000; return y + '-' + String(m[1]).padStart(2, '0') + '-' + String(m[2]).padStart(2, '0'); };
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();

  // ---- 1. PDF -> text lines (pdf.js text items grouped by their row on the page)
  async function pdfLines(pdfjsLib, data) {
    const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
    const out = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const rows = [];
      for (const it of tc.items) {
        if (!it.str || !it.str.trim()) continue;
        const x = it.transform[4], y = it.transform[5];
        let r = rows.find(r => Math.abs(r.y - y) < 2.5);
        if (!r) { r = { y, items: [] }; rows.push(r); }
        r.items.push({ x, w: it.width || 0, s: it.str });
      }
      rows.sort((a, b) => b.y - a.y);
      for (const r of rows) {
        r.items.sort((a, b) => a.x - b.x);
        let t = '', end = null;
        for (const it of r.items) { if (end != null && it.x - end > 1) t += ' '; t += it.s; end = it.x + it.w; }
        out.push({ page: p, text: clean(t) });
      }
    }
    return out;
  }

  // ---- 2. Sage "Accounts Payable Enter Invoices Journal" lines -> invoices and job lines
  function parseJournal(lines) {
    const invoices = [], recap = [], jobNames = {};
    let inv = null, dst = null, card = null, section = 'entries', batch = '', company = '', kind = '';
    const HEAD = /^(\S+)\s+(.+?)\s+-\s+Invoice\s+(.+?)(\s+-\s+Continued)?$/;
    const finishDst = () => { if (dst && inv) inv.lines.push(dst); dst = null; };
    for (const { page, text } of lines) {
      if (/^ENTRY TOTALS/i.test(text)) { finishDst(); inv = null; section = 'totals'; continue; }
      if (/^JOB COST RECAP/i.test(text)) { section = 'recap'; continue; }
      if (/^GL POSTING INFORMATION/i.test(text)) { section = 'after'; continue; }
      if (/^JOB COST POST ENTRIES/i.test(text)) { section = 'posted'; continue; }
      if (/Accounts Payable .*Journal|Accounts Payable Import Invoices/i.test(text)) { if (!company) company = clean(text.split(/Accounts Payable/i)[0]); if (!kind) kind = clean((/Accounts Payable (.*?)(Journal|\d{1,2}-\d{1,2}-\d{4})/i.exec(text) || [])[1] || ''); continue; }
      if (/^System date and time|^Dst Amount|^Page \d/i.test(text)) continue;
      const b = /^Batch\s+(\d+)/.exec(text); if (b) { batch = batch || b[1]; continue; }
      if (section === 'recap') { const m = /^(\S+)\s+(\d+-\d+-\d+)\s+(-?[\d,]*\.\d{2}-?)$/.exec(text); if (m) recap.push({ job: m[1], costCode: m[2], amount: num(m[3]) }); continue; }
      if (section === 'posted') { const m = /^(\d{3,})\s+([A-Za-z].*)$/.exec(text); if (m && !/Total|Category|Cost/.test(m[2])) jobNames[m[1]] = clean(m[2]); continue; }
      if (section !== 'entries') continue;
      // Credit card journal: "ZionsVISA 081426A credit card 9-14-2026 CCDELIV1 Credit Card Chgs-Delivery 1 384.38"
      const cc = /^(\S+)\s+(\S+)\s+credit card\s+(\S+)\s+(\S+)\s+(.+?)\s+(-?[\d,]*\.\d{2}-?)$/i.exec(text);
      if (cc) { finishDst(); inv = null; card = { vendorCode: cc[4], vendorName: clean(cc[5]), card: cc[1], ref: cc[2] }; continue; }
      const ci = card && /^Invoice\s+(?!date:)(.+?)(\s+-\s+Continued)?$/i.exec(text);
      if (ci) {
        if (ci[2] && inv && inv.invoice === clean(ci[1])) continue; // continued on the next page: keep the open line
        finishDst();
        inv = { vendorCode: card.vendorCode, vendorName: card.vendorName, invoice: clean(ci[1]), desc: '', invDate: null, dueDate: null, total: null, page, lines: [], card: card.card };
        invoices.push(inv); continue;
      }
      const h = HEAD.exec(text);
      if (h) { card = null;
        if (h[4] && inv && inv.invoice === clean(h[3])) continue; // continued on the next page: keep the open line
        finishDst();
        inv = { vendorCode: h[1], vendorName: clean(h[2]), invoice: clean(h[3]), desc: '', invDate: null, dueDate: null, total: null, page, lines: [] };
        invoices.push(inv); continue;
      }
      if (!inv) continue;
      let m;
      if (!dst && (m = /^Description:\s*(.*)$/.exec(text))) { inv.desc = clean(m[1]); continue; }
      if ((m = /Invoice date:\s*(\S+)/.exec(text))) { inv.invDate = mdy(m[1]); const p = /Payment:\s*(\S+)/.exec(text); if (p) inv.dueDate = mdy(p[1]); continue; }
      if (/^Tax:/.test(text) && !dst && inv.total == null) { const a = AMT.exec(text); if (a) inv.total = num(a[1]); continue; }
      if (/^Default payment type/i.test(text)) continue;
      if ((m = /^Debit acct:\s*(\S+)/.exec(text))) { finishDst(); dst = { debit: m[1], job: '', costCode: '', category: '', desc: '', amount: null, page }; continue; }
      if (!dst) continue;
      if (/^Commitment:/.test(text)) {
        const j = /Job:\s*(.*?)\s*Bldg\/Area\/Floor:/.exec(text); dst.job = j ? clean(j[1]) : '';
        const c = /Cost Code:\s*(\S*)/.exec(text); dst.costCode = c ? c[1] : '';
        continue;
      }
      if ((m = /^Category:\s*(.*?)\s*Draw:/.exec(text))) { dst.category = clean(m[1]); continue; }
      if ((m = /^Description:\s*(.*?)\s*Tax Group:/.exec(text))) { dst.desc = clean(m[1]); continue; }
      if (/^Units:/.test(text)) { const a = AMT.exec(text); if (a) dst.amount = num(a[1]); finishDst(); continue; }
    }
    finishDst();
    const total = lines.map(l => /Total invoice amount:\s*([\d,.-]+)/.exec(l.text)).find(Boolean);
    return { company, batch, kind, invoices, recap, jobNames, entryTotal: total ? num(total[1]) : null };
  }

  // ---- 3. Match to Innergy lists and Dani's rules -> rows for the costInput table
  const KINDS = { payTo: 'Vendor -> Pay To', wo: 'Job -> Work order', bg: 'Cost code -> Budget group', gl: 'Debit account -> GL account', terms: 'Vendor -> Terms' };
  const norm = s => clean(s).toLowerCase().replace(/[.,'&]/g, '').replace(/\b(inc|llc|co|corp|company|ltd)\b/g, '').replace(/\s+/g, ' ').trim();
  const ruleGet = (rules, kind, key) => { const k = norm(key); const r = rules.find(r => r.kind === kind && norm(r.from) === k); return r ? r.to : ''; };
  // Innergy project number = P-<first 2 digits>-<last 4 digits> of the Sage job (261151 -> P-26-1151)
  function jobToProject(job) { const d = String(job || '').replace(/\D/g, ''); return d.length >= 4 ? 'P-' + d.slice(0, 2) + '-' + d.slice(-4) : ''; }

  function buildRows(parsed, lists, rules) {
    const rows = [], skipped = [];
    const inList = (list, v) => !list.length || list.some(x => clean(x).toLowerCase() === clean(v).toLowerCase());
    for (const inv of parsed.invoices) {
      const jobLines = inv.lines.filter(l => l.job);
      if (!jobLines.length) { skipped.push(inv); continue; }
      jobLines.forEach((l, i) => {
        const flags = [];
        // Pay To: rule, else exact list name, else a list name that starts with the vendor's name, else the PDF name
        let payTo = ruleGet(rules, 'payTo', inv.vendorName) || ruleGet(rules, 'payTo', inv.vendorCode);
        if (!payTo) { const n = norm(inv.vendorName); payTo = lists.payTo.find(x => norm(x) === n) || lists.payTo.find(x => norm(x.split(' - ')[0]) === n) || ''; }
        if (!payTo) { payTo = inv.vendorName; if (lists.payTo.length) flags.push('Pay To not in Innergy list'); }
        // Work order: rule, else the only work order for that project, else the first one (flagged)
        let wo = ruleGet(rules, 'wo', l.job);
        if (!wo) {
          const proj = jobToProject(l.job);
          const cands = proj ? lists.wo.filter(x => x.toUpperCase().startsWith(proj + '-')) : [];
          if (cands.length === 1) wo = cands[0];
          else if (cands.length > 1) { wo = cands[0]; flags.push(cands.length + ' work orders on ' + proj + ': check this is the right one'); }
          else { wo = proj || l.job; flags.push(proj ? 'Pick the ' + proj + ' work order (not in the workbook\u2019s list yet)' : 'Sage job ' + l.job + ' has no Innergy number'); }
        } else if (!inList(lists.wo, wo)) flags.push('Work order not in Innergy list');
        // Budget group is always Other unless a rule says otherwise
        const bg = ruleGet(rules, 'bg', l.costCode) || 'Other';
        if (!inList(lists.bg, bg)) flags.push('Budget group ' + bg + ' not in Innergy list');
        const gl = ruleGet(rules, 'gl', l.debit);
        const terms = ruleGet(rules, 'terms', inv.vendorName);
        if (!inv.invDate) flags.push('No invoice date found');
        if (l.amount == null) flags.push('No amount found');
        const ext = (inv.vendorCode + '-' + inv.invoice + '-' + (i + 1)).replace(/\s+/g, '');
        rows.push({
          WorkOrder: wo, BudgetGroup: bg, LaborItem: '', Hours: null, Cost: l.amount, PostDate: inv.invDate, Status: 'Open',
          ExternalId: ext, Notes: l.desc || inv.desc, 'GL Account': gl, Terms: terms, 'Pay To': payTo,
          VendorInvoiceNumber: inv.invoice, InvoiceDate: inv.invDate, DueDate: inv.dueDate,
          src: { vendorCode: inv.vendorCode, vendorName: inv.vendorName, invoice: inv.invoice, total: inv.total, job: l.job, jobName: parsed.jobNames[l.job] || '', costCode: l.costCode, category: l.category, debit: l.debit, desc: l.desc, page: l.page, file: parsed.file || '' },
          flags,
        });
      });
    }
    // Cross-check against the journal's own Job Cost Recap
    const pulled = Math.round(rows.reduce((a, r) => a + (r.Cost || 0), 0) * 100) / 100;
    const recapTotal = parsed.recap.length ? Math.round(parsed.recap.reduce((a, r) => a + r.amount, 0) * 100) / 100 : null;
    return { rows, skipped, pulled, recapTotal, recapCount: parsed.recap.length };
  }

  // ---- 4. Learn from Dani's edits: compare what the tool put in (Review sheet) with what's in costInput now
  function learn(review, current, rules) {
    const learned = [];
    const set = (kind, from, to) => {
      if (!from || !to) return; const k = norm(from);
      const r = rules.find(r => r.kind === kind && norm(r.from) === k);
      if (r) { if (r.to !== to) { r.to = to; r.learned = today(); learned.push([kind, from, to]); } }
      else { rules.push({ kind, from, to, learned: today() }); learned.push([kind, from, to]); }
    };
    for (const rv of review) {
      const cur = current.find(c => clean(c.ExternalId) === clean(rv.ExternalId)); if (!cur) continue;
      if (cur.WorkOrder && cur.WorkOrder !== rv.WorkOrder) set('wo', rv.job, cur.WorkOrder);
      if (cur.BudgetGroup && cur.BudgetGroup !== rv.BudgetGroup) set('bg', rv.costCode, cur.BudgetGroup);
      if (cur['GL Account'] && cur['GL Account'] !== rv['GL Account']) set('gl', rv.debit, cur['GL Account']);
      if (cur['Pay To'] && cur['Pay To'] !== rv['Pay To']) set('payTo', rv.vendorName, cur['Pay To']);
      if (cur.Terms && cur.Terms !== rv.Terms) set('terms', rv.vendorName, cur.Terms);
    }
    return learned;
  }
  function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  root.SageInv = { pdfLines, parseJournal, buildRows, learn, KINDS, norm, num, clean, today };
})(typeof window !== 'undefined' ? window : globalThis);

// ---- 5. The workbook: read lists/rules/review with SheetJS, write changes straight into the file's XML with JSZip,
// so the macros, the Setup sheet (API key), the Power Query connections and the lists stay exactly as they were.
(function (root) {
  'use strict';
  const S = root.SageInv;
  const XE = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const col = n => { let s = ''; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const colNum = c => c.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const serial = ymd => { if (!ymd) return null; const [y, m, d] = ymd.split('-').map(Number); return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5); };
  const COLS = ['WorkOrder', 'BudgetGroup', 'LaborItem', 'Hours', 'Cost', 'PostDate', 'Status', 'ExternalId', 'Notes', 'GL Account', 'Terms', 'Pay To', 'VendorInvoiceNumber', 'InvoiceDate', 'DueDate'];
  const DATE = { PostDate: 1, InvoiceDate: 1, DueDate: 1 }, NUM = { Hours: 1, Cost: 1 };
  const KIND_BY_LABEL = Object.fromEntries(Object.entries(S.KINDS).map(([k, v]) => [v.toLowerCase(), k]));
  const REVIEW_HEAD = ['Input row', 'ExternalId', 'Check', 'Vendor code', 'Vendor (PDF)', 'Invoice', 'Invoice date', 'Invoice total', 'Line amount', 'Sage job', 'Job name (PDF)', 'Cost code', 'Category', 'Debit acct', 'Line description', 'PDF file', 'Page', 'Tool put WorkOrder', 'Tool put BudgetGroup', 'Tool put GL Account', 'Tool put Pay To', 'Tool put Terms'];

  // Read what the tool needs from the workbook (read only)
  function readWorkbook(XLSX, buf) {
    const wb = XLSX.read(buf, { type: 'array', cellDates: false, bookVBA: false });
    const firstCol = n => { const ws = wb.Sheets[n]; if (!ws) return []; return XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false }).slice(1).map(r => r[0]).filter(v => v != null && String(v).trim() !== '').map(String); };
    if (!wb.Sheets.Input) throw new Error('This workbook has no Input sheet. Use the INNERGY_addedExpenses workbook.');
    const lists = { wo: firstCol('workOrderNameList'), payTo: firstCol('payToList'), bg: firstCol('budgetGroupList'), gl: firstCol('coaList'), terms: firstCol('termsList') };
    // costInput table: header on row 4, columns B..P
    const inRows = XLSX.utils.sheet_to_json(wb.Sheets.Input, { header: 1, defval: null, blankrows: true });
    const hi = inRows.findIndex(r => r && r.includes('WorkOrder')), k0 = hi >= 0 ? inRows[hi].indexOf('WorkOrder') : 0;
    const current = [];
    if (hi >= 0) for (let i = hi + 1; i < inRows.length; i++) { const r = inRows[i] || []; const o = {}; COLS.forEach((c, k) => o[c] = r[k0 + k] == null ? '' : r[k0 + k]); if (COLS.some(c => o[c] !== '' && c !== 'Status')) current.push(o); }
    // Rules
    const rules = [];
    if (wb.Sheets.Rules) for (const r of XLSX.utils.sheet_to_json(wb.Sheets.Rules, { header: 1, blankrows: true, range: 0 }).slice(4)) {
      const kind = KIND_BY_LABEL[String(r[0] || '').trim().toLowerCase()]; if (kind && r[1] != null && r[2] != null && String(r[2]).trim()) rules.push({ kind, from: String(r[1]).trim(), to: String(r[2]).trim(), learned: r[3] ? String(r[3]) : '' });
    }
    // Review: what the tool filled last time (first block, until a blank row)
    const review = [];
    if (wb.Sheets.Review) {
      const rr = XLSX.utils.sheet_to_json(wb.Sheets.Review, { header: 1, blankrows: true, range: 0 });
      const h = rr.findIndex(r => r && r[0] === 'Input row');
      if (h >= 0) for (let i = h + 1; i < rr.length; i++) { const r = rr[i]; if (!r || r[1] == null) break;
        review.push({ ExternalId: String(r[1]), vendorName: r[4] || '', job: r[9] != null ? String(r[9]) : '', costCode: r[11] || '', debit: r[13] || '', WorkOrder: r[17] || '', BudgetGroup: r[18] || '', 'GL Account': r[19] || '', 'Pay To': r[20] || '', Terms: r[21] || '' }); }
    }
    return { lists, current, rules, review };
  }

  async function sheetPath(zip, name) {
    const wbx = await zip.file('xl/workbook.xml').async('string');
    const m = new RegExp('<sheet [^>]*name="' + name + '"[^>]*r:id="([^"]+)"').exec(wbx); if (!m) return null;
    const rels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
    const t = new RegExp('<Relationship [^>]*Id="' + m[1] + '"[^>]*Target="([^"]+)"').exec(rels) || new RegExp('<Relationship [^>]*Target="([^"]+)"[^>]*Id="' + m[1] + '"').exec(rels);
    return 'xl/' + t[1].replace(/^\/?xl\//, '');
  }

  // inline-string / number cell
  const cell = (ref, v, s) => { const st = s != null ? ' s="' + s + '"' : ''; if (v == null || v === '') return '<c r="' + ref + '"' + st + '/>'; if (typeof v === 'number') return '<c r="' + ref + '"' + st + '><v>' + v + '</v></c>'; return '<c r="' + ref + '"' + st + ' t="inlineStr"><is><t xml:space="preserve">' + XE(v) + '</t></is></c>'; };

  async function addStyles(zip) {
    // one yellow "check" fill, reusing the template's own fonts and borders; returns style ids
    let st = await zip.file('xl/styles.xml').async('string');
    const fills = /<fills count="(\d+)">([\s\S]*?)<\/fills>/.exec(st);
    const fillId = +fills[1];
    st = st.replace(fills[0], '<fills count="' + (fillId + 1) + '">' + fills[2] + '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill></fills>');
    const xfs = /<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/.exec(st);
    const base = +xfs[1];
    const add = ['<xf numFmtId="0" fontId="0" fillId="' + fillId + '" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>',
                 '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>'];
    st = st.replace(xfs[0], '<cellXfs count="' + (base + add.length) + '">' + xfs[2] + add.join('') + '</cellXfs>');
    zip.file('xl/styles.xml', st);
    return { check: base, wrap: base + 1 };
  }

  async function putSheet(zip, name, xml, afterName) {
    const existing = await sheetPath(zip, name);
    if (existing) { zip.file(existing, xml); return; }
    let wbx = await zip.file('xl/workbook.xml').async('string');
    let rels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
    let ct = await zip.file('[Content_Types].xml').async('string');
    let n = 1; while (zip.file('xl/worksheets/sheet' + n + '.xml')) n++;
    const path = 'xl/worksheets/sheet' + n + '.xml';
    zip.file(path, xml);
    const ids = [...rels.matchAll(/Id="rId(\d+)"/g)].map(m => +m[1]); const rid = 'rId' + (Math.max(0, ...ids) + 1);
    rels = rels.replace('</Relationships>', '<Relationship Id="' + rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + n + '.xml"/></Relationships>');
    const sids = [...wbx.matchAll(/sheetId="(\d+)"/g)].map(m => +m[1]); const sid = Math.max(0, ...sids) + 1;
    const tag = '<sheet name="' + name + '" sheetId="' + sid + '" r:id="' + rid + '"/>';
    const after = new RegExp('<sheet [^>]*name="' + afterName + '"[^>]*/>').exec(wbx);
    // sheets are positional; a sheet inserted mid-list shifts the index that localSheetId names refer to
    const idx = after ? (wbx.slice(0, after.index).match(/<sheet /g) || []).length + 1 : null;
    if (after && idx != null) {
      wbx = wbx.replace(after[0], after[0] + tag);
      wbx = wbx.replace(/localSheetId="(\d+)"/g, (m, k) => 'localSheetId="' + (+k >= idx ? +k + 1 : +k) + '"');
      wbx = wbx.replace(/(<workbookView [^>]*activeTab=")(\d+)"/, (m, a, k) => a + (+k >= idx ? +k + 1 : +k) + '"').replace(/(<workbookView [^>]*firstSheet=")(\d+)"/, (m, a, k) => a + (+k >= idx ? +k + 1 : +k) + '"');
    } else wbx = wbx.replace('</sheets>', tag + '</sheets>');
    ct = ct.replace('</Types>', '<Override PartName="/' + path + '" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
    zip.file('xl/workbook.xml', wbx); zip.file('xl/_rels/workbook.xml.rels', rels); zip.file('[Content_Types].xml', ct);
  }

  function sheetXml(rows, widths, extra) {
    const cols = '<cols>' + widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>';
    const last = rows.length ? rows[rows.length - 1].r : 1;
    const body = rows.map(r => '<row r="' + r.r + '">' + r.cells.map(([c, v, s]) => cell(col(c) + r.r, v, s)).join('') + '</row>').join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:' + col(widths.length - 1) + last + '"/><sheetViews><sheetView workbookViewId="0"' + (extra && extra.freeze ? '><pane ySplit="' + (extra.freeze - 1) + '" topLeftCell="A' + extra.freeze + '" activePane="bottomLeft" state="frozen"/></sheetView>' : '/>') + '</sheetViews><sheetFormatPr defaultRowHeight="15"/>' + cols + '<sheetData>' + body + '</sheetData><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>';
  }

  // Write: rows into costInput (Input sheet), plus Review and Rules sheets
  async function fillWorkbook(JSZip, buf, rows, info, rules) {
    const zip = await JSZip.loadAsync(buf);
    const inputPath = await sheetPath(zip, 'Input');
    let tablePath = null, tableXml = null;
    for (const f of Object.keys(zip.files).filter(f => /^xl\/tables\/table\d+\.xml$/.test(f))) { const x = await zip.file(f).async('string'); if (/ name="costInput"/.test(x)) { tablePath = f; tableXml = x; } }
    if (!inputPath || !tablePath) throw new Error('Could not find the costInput table on the Input sheet.');
    const ref = / ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/.exec(tableXml);
    const c0 = colNum(ref[1]), headRow = +ref[2], c1 = colNum(ref[3]), oldLast = +ref[4];
    if (c1 - c0 + 1 !== COLS.length) throw new Error('The costInput table has ' + (c1 - c0 + 1) + ' columns; expected ' + COLS.length + '.');
    const first = headRow + 1, n = Math.max(rows.length, 1), newLast = headRow + n;
    let sx = await zip.file(inputPath).async('string');
    // styles of the first data row, per column (falls back to the template's)
    const styleOf = {}; const r1 = new RegExp('<row r="' + first + '"[^>]*>([\\s\\S]*?)</row>').exec(sx);
    if (r1) for (const m of r1[1].matchAll(/<c r="([A-Z]+)\d+"(?: s="(\d+)")?/g)) styleOf[m[1]] = m[2];
    const rowRe = /<row r="(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g;
    const keep = {}; // other cells in data rows (outside B..P); results column R is cleared because it belongs to the last post
    sx = sx.replace(/<sheetData>([\s\S]*?)<\/sheetData>|<sheetData\/>/, (all, inner) => {
      const out = []; const seen = new Set();
      for (const m of (inner || '').matchAll(rowRe)) {
        const r = +m[1];
        if (r < first) { out.push(m[0]); continue; }
        const cells = [...(m[2] || '').matchAll(/<c r="([A-Z]+)(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)].filter(c => { const k = colNum(c[1]); return k < c0 || k > c1; })
          .map(c => { const st = /\ss="(\d+)"/.exec(c[0]); return '<c r="' + c[1] + r + '"' + (st ? ' s="' + st[1] + '"' : '') + '/>'; });
        keep[r] = cells; seen.add(r);
      }
      const last = Math.max(newLast, ...Object.keys(keep).map(Number));
      for (let r = first; r <= last; r++) {
        const cells = [];
        if (r <= newLast && rows[r - first]) { const row = rows[r - first];
          COLS.forEach((c, k) => { const L = col(c0 + k); let v = row[c]; if (DATE[c]) v = serial(v); cells.push([colNum(L), cell(L + r, v == null ? '' : v, styleOf[L])]); });
        } else if (r <= newLast) COLS.forEach((c, k) => { const L = col(c0 + k); cells.push([colNum(L), cell(L + r, '', styleOf[L])]); });
        for (const kc of keep[r] || []) cells.push([colNum(/r="([A-Z]+)/.exec(kc)[1]), kc]);
        if (!cells.length) continue;
        cells.sort((a, b) => a[0] - b[0]);
        out.push('<row r="' + r + '">' + cells.map(c => c[1]).join('') + '</row>');
      }
      return '<sheetData>' + out.join('') + '</sheetData>';
    });
    const vEnd = Math.max(newLast, oldLast);
    sx = sx.replace(/(<dimension ref="[A-Z]+\d+:[A-Z]+)(\d+)"/, (m, a, b) => a + Math.max(+b, vEnd) + '"');
    // stretch the dropdowns (data validation) on table columns to the new last row
    const stretch = s => s.split(' ').map(rg => { const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(rg); if (!m || m[1] !== m[3] || colNum(m[1]) < c0 || colNum(m[1]) > c1 || +m[2] !== first) return rg; return m[1] + first + ':' + m[1] + Math.max(+m[4], vEnd); }).join(' ');
    sx = sx.replace(/sqref="([^"]+)"/g, (m, s) => 'sqref="' + stretch(s) + '"').replace(/<xm:sqref>([^<]+)<\/xm:sqref>/g, (m, s) => '<xm:sqref>' + stretch(s) + '</xm:sqref>');
    zip.file(inputPath, sx);
    tableXml = tableXml.replace(/ ref="[A-Z]+\d+:[A-Z]+\d+"/g, ' ref="' + ref[1] + headRow + ':' + ref[3] + newLast + '"');
    zip.file(tablePath, tableXml);

    const sty = await addStyles(zip);
    // Review sheet
    const rv = [];
    rv.push({ r: 1, cells: [[0, 'Review: what the tool pulled from the Sage PDFs', 6]] });
    rv.push({ r: 2, cells: [[0, info.summary]] });
    rv.push({ r: 3, cells: [[0, 'Change anything on the Input sheet before posting (the dropdowns there are Innergy’s lists). Next time, give the tool this workbook again and it learns your changes into the Rules sheet.']] });
    rv.push({ r: 5, cells: REVIEW_HEAD.map((h, i) => [i, h, 6]) });
    rows.forEach((x, i) => { const r = 6 + i, s = x.src; const ck = x.flags.length ? sty.check : null;
      rv.push({ r, cells: [[0, first + i], [1, x.ExternalId], [2, x.flags.join('; ') || 'OK', ck], [3, s.vendorCode], [4, s.vendorName], [5, s.invoice], [6, serial(x.InvoiceDate), 15], [7, s.total, 14], [8, x.Cost, 14], [9, s.job], [10, s.jobName], [11, s.costCode], [12, s.category], [13, s.debit], [14, s.desc], [15, s.file], [16, s.page], [17, x.WorkOrder], [18, x.BudgetGroup], [19, x['GL Account']], [20, x['Pay To']], [21, x.Terms]] }); });
    let r = 6 + rows.length + 2;
    rv.push({ r: r++, cells: [[0, 'Skipped: no job number (' + info.skipped.length + ' invoices, not sent to Innergy)', 6]] });
    rv.push({ r: r++, cells: [[3, 'Vendor code', 6], [4, 'Vendor (PDF)', 6], [5, 'Invoice', 6], [6, 'Invoice date', 6], [7, 'Invoice total', 6], [13, 'Debit acct', 6], [14, 'Description', 6], [15, 'PDF file', 6], [16, 'Page', 6]] });
    for (const s of info.skipped) rv.push({ r: r++, cells: [[3, s.vendorCode], [4, s.vendorName], [5, s.invoice], [6, serial(s.invDate), 15], [7, s.total, 14], [13, (s.lines[0] || {}).debit || ''], [14, s.desc], [15, s.file || ''], [16, s.page]] });
    await putSheet(zip, 'Review', sheetXml(rv, [10, 26, 40, 12, 30, 16, 12, 13, 13, 10, 28, 10, 9, 13, 32, 30, 6, 40, 18, 22, 28, 14], { freeze: 6 }), 'Input');
    // Rules sheet
    const ru = [{ r: 1, cells: [[0, 'Rules: how Sage names turn into Innergy names', 6]] },
      { r: 2, cells: [[0, 'Add or fix a row any time. "Use in Innergy" must match Innergy’s name exactly. The tool also adds rows when you change a value on the Input sheet. Kinds: ' + Object.values(S.KINDS).join(', ') + '.']] },
      { r: 4, cells: [[0, 'What', 6], [1, 'When Sage says', 6], [2, 'Use in Innergy', 6], [3, 'Added', 6]] }];
    rules.forEach((x, i) => ru.push({ r: 5 + i, cells: [[0, S.KINDS[x.kind]], [1, x.from], [2, x.to], [3, x.learned || '']] }));
    await putSheet(zip, 'Rules', sheetXml(ru, [28, 36, 60, 12]), 'Review');
    // copy files only (no folder entries), in the original order, so the package looks like Excel wrote it
    const out = new JSZip();
    for (const name of Object.keys(zip.files)) { const f = zip.files[name]; if (!f.dir) out.file(name, await f.async('uint8array'), { date: f.date, createFolders: false }); }
    return out.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 }, mimeType: 'application/vnd.ms-excel.sheet.macroEnabled.12' });
  }
  S.readWorkbook = readWorkbook; S.fillWorkbook = fillWorkbook; S.COLS = COLS;
})(typeof window !== 'undefined' ? window : globalThis);
