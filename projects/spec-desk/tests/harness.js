// Shared setup: serves index.html and the pinned libraries locally, injects the simulated Claude.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const H = __dirname;
const LIB = {
  'pdf.js/3.11.174/pdf.min.js': 'node_modules/pdfjs-dist/build/pdf.min.js',
  'pdf.js/3.11.174/pdf.worker.min.js': 'node_modules/pdfjs-dist/build/pdf.worker.min.js',
  'pdf-lib/1.17.1/pdf-lib.min.js': 'node_modules/pdf-lib/dist/pdf-lib.min.js',
  'jszip/3.10.1/jszip.min.js': 'node_modules/jszip/dist/jszip.min.js',
  'xlsx/0.18.5/xlsx.full.min.js': 'node_modules/xlsx/dist/xlsx.full.min.js',
};
exports.FX = f => path.join(H, 'fixtures', f);
exports.setup = async (app, { mock = true } = {}) => {
  const browser = await chromium.launch({ args: ['--js-flags=--max-old-space-size=8192'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  if (mock) await ctx.addInitScript({ path: path.join(H, 'mock-claude.js') });
  await ctx.route('**/*', async route => {
    const u = route.request().url();
    if (u.startsWith('http://specdesk.test/')) return route.fulfill({ path: app, contentType: 'text/html' });
    const lib = Object.keys(LIB).find(k => u.endsWith(k));
    if (lib) return route.fulfill({ path: path.join(H, LIB[lib]), contentType: 'application/javascript' });
    if (/fonts\.(googleapis|gstatic)/.test(u)) return route.fulfill({ body: '', contentType: 'text/css' });
    return route.abort();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('crash', () => errors.push('PAGE CRASHED'));
  const results = [];
  const log = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
  const ev = (f, a) => page.evaluate(f, a);
  const calls = () => ev(() => window.__calls.map(c => ({ kind: c.kind, len: c.len, tier: c.tier, images: c.images, imgTypes: c.imgTypes, imgBytes: c.imgBytes })));
  const shotsDir = path.join(H, 'shots'); fs.mkdirSync(shotsDir, { recursive: true });
  const shot = n => page.screenshot({ path: path.join(shotsDir, n + '.png') });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  const heapMB = async () => { const m = await cdp.send('Performance.getMetrics'); const g = k => (m.metrics.find(x => x.name === k) || {}).value || 0; return Math.round(g('JSHeapUsedSize') / 1e6); };
  const rssMB = () => { try { return Math.round(require('child_process').execSync("ps -eo rss=,args= | grep -i -E 'chrom|headless_shell' | grep -v grep || true").toString().split('\n').filter(Boolean).reduce((n, x) => n + (parseInt(x, 10) || 0), 0) / 1024); } catch { return -1; } };
  await page.goto('http://specdesk.test/');
  await page.waitForTimeout(500);
  const done = async (file) => {
    console.log('\nPAGE ERRORS:', errors.length ? errors : 'none');
    fs.writeFileSync(path.join(H, file), JSON.stringify({ results, errors }, null, 1));
    console.log(`\n${results.filter(r => r.ok).length}/${results.length} passed`);
    await browser.close();
  };
  return { browser, ctx, page, log, ev, calls, shot, errors, results, heapMB, rssMB, done };
};
