// Stand-in for window.claude in the claude.ai artifact runtime. It answers from the
// passages in each prompt (so quotes are real), and plants known mistakes so we can
// check that Spec Desk catches them.
(() => {
  const calls = []; window.__calls = calls; window.__saves = [];
  window.__mock = { mode: 'ok', delay: 30 };
  const STOP = new Set('a an the and or of to in on for with by at as is are be shall will from that this these those it its into not no any all each per than then such other which who may must can if under over provide include includes section'.split(' '));
  const words = s => (String(s).toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => w.length > 2 && !STOP.has(w));
  const first = (t, n) => t.split(/\s+/).slice(0, n).join(' ');
  const passages = (prompt, letter) => {
    const out = [];
    const rx = new RegExp(`^\\[(${letter}\\d+)\\] \\(([^)]*)\\)(?: \\[Article: [^\\]]*\\])? (.*)$`, 'gm');
    for (const m of prompt.matchAll(rx)) out.push({ id: m[1], where: m[2], text: m[3] });
    return out;
  };
  const nums = s => (String(s).match(/\d+(?:[.\/]\d+)?/g) || []);
  const overlap = (a, b) => { const B = new Set(words(b)); return words(a).filter(w => B.has(w)).length; };
  const sentences = t => t.split(/(?<=\.)\s+/).filter(Boolean);
  const KEYS = ['hinge', 'slide', 'pull', 'lock', 'shelf', 'warranty', 'edgebanding', 'laminate', 'particleboard', 'mockup', 'certific', 'thickness', 'bracket', 'backsplash', 'grade', 'samples', 'shop drawings', 'seams', 'sealant', 'color'];
  const keyOf = t => KEYS.find(k => t.toLowerCase().includes(k));

  function answer(prompt, opts) {
    // ---- section summary: one point per paragraph, but miss "Locks" and get two wrong on purpose
    if (prompt.startsWith('You are summarizing one section')) {
      const points = [];
      for (const p of passages(prompt, 'R')) {
        if (p.text.length < 30) continue;
        if (/^Locks:/.test(p.text)) continue;                                   // planted miss: the deep check should find it
        let statement = p.text, quote = first(p.text, 10);
        if (/^Hinges:/.test(p.text)) { statement = 'Hinges are concealed European-style with a 110 degree opening.'; quote = 'Hinges: Concealed European-style, self-closing, 110 degree opening'; } // planted bad quote + wrong value
        if (/^Drawer Slides/.test(p.text)) statement = 'Drawer slides are full-extension, ball-bearing, 75 lbf load rating.';     // planted wrong value, real quote
        points.push({ category: /warranty/i.test(p.text) ? 'Warranty' : /submit|samples/i.test(p.text) ? 'Submittals' : 'Products', statement, citations: [{ ref: p.id, quote }] });
      }
      return { points };
    }
    // ---- Ask the spec
    if (prompt.startsWith('You are answering a question about a construction specification')) {
      const q = (prompt.match(/^Question: (.*)$/m) || [])[1] || '';
      const ps = passages(prompt, 'R').map(p => ({ p, s: overlap(q, p.text) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3);
      if (!ps.length) return { answer: 'The passages do not cover this.', points: [], not_found: 'Nothing about this in the passages read.' };
      return { answer: ps.map(x => x.p.text).join(' ').slice(0, 300),
        points: [...ps.map(x => ({ statement: x.p.text, citations: [{ ref: x.p.id, quote: first(x.p.text, 9) }] })),
                 { statement: 'Hinges must be stainless steel.', citations: [{ ref: ps[0].p.id, quote: 'all hinges shall be stainless steel construction' }] }], // planted invented quote
        not_found: '' };
    }
    // ---- Compare spec section vs other document
    if (prompt.startsWith('Compare a construction specification section against')) {
      const S = passages(prompt, 'S'), O = passages(prompt, 'O');
      const items = [];
      for (const s of S) {
        if (s.text.length < 30 || /^Section includes/.test(s.text)) continue;
        const k = keyOf(s.text); if (!k) continue;
        let hit = null;
        for (const o of O) for (const sen of sentences(o.text)) if (sen.toLowerCase().includes(k) && !hit) hit = { o, sen };
        const topic = k[0].toUpperCase() + k.slice(1);
        if (!hit || k === 'edgebanding') { items.push({ topic, status: 'gap', spec: { ref: s.id, quote: first(s.text, 10) }, other: null, note: 'Not addressed.' }); continue; } // edgebanding: planted false gap
        const excl = /exclud|not included|by others/i.test(hit.sen);
        const sn = new Set(nums(s.text)), on = nums(hit.sen);
        const same = on.length === 0 || on.every(n => sn.has(n));
        items.push({ topic, status: excl ? 'exclusion' : same ? 'match' : 'conflict', spec: { ref: s.id, quote: first(s.text, 10) }, other: { ref: hit.o.id, quote: first(hit.sen, 12) }, note: `Spec: ${s.text.slice(0, 80)} / Other: ${hit.sen.slice(0, 80)}` });
      }
      items.push({ topic: 'Field painting', status: 'extra', spec: null, other: { ref: O[O.length - 1].id, quote: 'Field painting excluded' }, note: 'Extra item.' });
      return { items };
    }
    // ---- Deep check pass 1: anything missing from the summary?
    if (prompt.startsWith('You are double-checking a summary')) {
      const have = (prompt.split('ALREADY IN THE SUMMARY:')[1] || '').split('\nSection:')[0];
      const missing = [];
      for (const p of passages(prompt, 'R')) {
        if (p.text.length < 30) continue;
        if (!have.includes(p.text.slice(0, 25))) missing.push({ category: 'Products', statement: p.text, citations: [{ ref: p.id, quote: first(p.text, 9) }] });
      }
      // the planted hinge and slide statements differ from their paragraphs, so drop anything about those (the verify pass handles them)
      return { missing: missing.filter(m => !/^(Hinges|Drawer Slides)/.test(m.statement)) };
    }
    // ---- Deep check pass 2: verify statements against source
    if (prompt.startsWith('Check each statement against ONLY')) {
      const checks = [];
      for (const blk of prompt.split(/\n(?=V\d+: )/).slice(1)) {
        const id = blk.match(/^(V\d+):/)[1];
        const stmt = blk.split('\n')[0].replace(/^V\d+: /, '');
        const src = blk.split('\n').slice(1).join(' ');
        const bad = nums(stmt).filter(n => !nums(src).includes(n));
        if (/source not found|no source cited/.test(src)) checks.push({ id, verdict: 'not_supported', fix: '', note: 'No source.' });
        else if (bad.length) checks.push({ id, verdict: 'partly', fix: src.replace(/^\s*\[[RS]\d+\] [^:]*: /, '').trim(), note: `Source does not say ${bad.join(', ')}.` });
        else checks.push({ id, verdict: 'supported', fix: '', note: 'Matches.' });
      }
      return { checks };
    }
    // ---- Deep check pass 3: look again in the other document
    if (prompt.startsWith('An earlier check said this specification requirement was')) {
      const req = (prompt.match(/^Requirement \([^)]*\): (.*)$/m) || [])[1] || '';
      const was = (prompt.match(/requirement was "(\w+)"/) || [])[1];
      const k = keyOf(req);
      for (const o of passages(prompt, 'O')) for (const sen of sentences(o.text)) if (k && sen.toLowerCase().includes(k)) return { status: 'match', other: { ref: o.id, quote: first(sen, 10) }, note: 'Found on second look.' };
      return { status: was, other: null, note: 'Still not found.' };
    }
    // ---- Drawing review
    if (prompt.startsWith('You are a millwork project reviewer')) {
      const grab = tag => { const m = prompt.split(tag)[1]; if (!m) return []; return m.split('\n\n')[0].split('\n').slice(1).map(l => l.match(/^\((\d+),(\d+)\) (.*)$/)).filter(Boolean).map(m => ({ x: +m[1], y: +m[2], t: m[3] })); };
      const shop = grab('CMI SHOP DRAWING TEXT'), arch = grab('ARCHITECT’S DRAWING TEXT');
      const items = [];
      const dim = t => /\d+\s*(?:\d+\/\d+)?"|'-/.test(t);
      for (const s of shop) {
        const a = arch.filter(a => Math.abs(a.x - s.x) <= 3 && Math.abs(a.y - s.y) <= 3)[0];
        if (!a || !dim(s.t) || !dim(a.t)) continue;
        const box = (p) => [p.x - 1, p.y - 1, p.x + 6, p.y + 2];
        if (a.t === s.t) items.push({ category: 'Dimension', status: 'match', topic: `Dimension at ${s.x},${s.y}`, shop_text: s.t, arch_text: a.t, shop_box: box(s), arch_box: box(a), from_image: false, spec: null, possibly_intentional: false, note: 'Same.' });
        else items.push({ category: 'Dimension', status: 'conflict', topic: `Dimension at ${s.x},${s.y}`, shop_text: s.t, arch_text: a.t, shop_box: box(s), arch_box: box(a), from_image: false, spec: null, possibly_intentional: /'-/.test(s.t), note: `Shop ${s.t} vs architect ${a.t}.` });
      }
      const R = passages(prompt, 'R').find(p => /Countertop Height/.test(p.text));
      if (R) items.push({ category: 'Spec requirement', status: 'spec_conflict', topic: 'Countertop height vs spec', shop_text: '36"', arch_text: '34 1/2"', shop_box: null, arch_box: null, from_image: false, spec: { ref: R.id, quote: first(R.text, 10) }, possibly_intentional: false, note: 'Spec allows 34 inches max at accessible locations.' });
      items.push({ category: 'Hardware', status: 'missing_in_shop', topic: 'Pull type not shown', shop_text: '4" WIRE PULL', arch_text: null, shop_box: [40, 40, 45, 42], arch_box: null, from_image: false, spec: null, possibly_intentional: false, note: 'Planted: this text is not on the shop sheet.' }); // planted hallucination
      items.push({ category: 'Material', status: 'unclear', topic: 'Hatch at base cabinet end panel', shop_text: 'PLYWOOD', arch_text: null, shop_box: null, arch_box: null, from_image: true, spec: null, possibly_intentional: false, note: 'Read from the hatch pattern in the image.' });
      return { summary: `Compared ${shop.length} shop text items with ${arch.length} architect items. Images: ${(opts.images || []).length}.`, items };
    }
    // ---- Deep check pass 4: close-up re-read
    if (prompt.startsWith('An earlier comparison of a millwork shop drawing')) {
      const shopVal = (prompt.match(/^Shop drawing value: (.*)$/m) || [])[1] || '';
      if (shopVal === '4" WIRE PULL') return { verdict: 'wrong', shop_text: null, arch_text: null, note: 'No pull callout in the close-up.' };
      if (/PLYWOOD/.test(shopVal)) return { verdict: 'cannot_tell', shop_text: null, arch_text: null, note: 'Hatch too small.' };
      return { verdict: 'confirmed', shop_text: shopVal, arch_text: null, note: 'Values read the same close up.' };
    }
    // ---- Ask the drawings
    if (prompt.startsWith('You are helping a millwork company')) {
      const q = (prompt.match(/^Question: (.*)$/m) || [])[1] || '';
      const pts = [];
      for (const blk of prompt.split(/\n(?=SHEET P\d+:)/).slice(1)) {
        const ref = blk.match(/^SHEET (P\d+)/)[1];
        for (const l of blk.split('\n').slice(1)) { const m = l.match(/^\((\d+),(\d+)\) (.*)$/); if (m && overlap(q, m[3]) > 0) pts.push({ statement: `${m[3]} is shown on ${ref}.`, sources: [{ ref, text: m[3], box: [+m[1] - 1, +m[2] - 1, +m[1] + 8, +m[2] + 2], from_image: false }] }); }
      }
      pts.push({ statement: 'Planted: invented value.', sources: [{ ref: 'P1', text: '42" COUNTER HEIGHT', box: null, from_image: false }] });
      return { answer: `Found ${pts.length - 1} matching notes.`, points: pts.slice(0, 6), not_found: '' };
    }
    if (prompt.includes('Reply with only JSON: {"sheet"')) return { sheet: '', refs: [] };
    return { note: 'mock: unrecognized prompt' };
  }

  const kindOf = p => p.slice(0, 60);
  const sample = async (prompt, opts = {}) => JSON.stringify(await sample.json(prompt, opts));
  sample.json = (prompt, opts = {}) => new Promise((resolve, reject) => {
    const imgs = opts.images || [];
    calls.push({ kind: kindOf(prompt), len: prompt.length, tier: opts.modelTier, images: imgs.length, imgTypes: [...new Set(imgs.map(b => b && b.type))], imgBytes: imgs.reduce((n, b) => n + (b ? b.size : 0), 0), prompt });
    const mode = window.__mock.mode;
    const t = setTimeout(() => {
      if (mode === 'rate_limited' || mode === 'invalid_json' || mode === 'prompt_too_large') return reject({ code: mode, message: mode });
      try { resolve(answer(prompt, opts)); } catch (e) { console.error('mock error', e); reject({ code: 'mock_bug', message: String(e) }); }
    }, mode === 'slow' ? 4000 : window.__mock.delay);
    if (opts.signal) opts.signal.addEventListener('abort', () => { clearTimeout(t); reject({ code: 'cancelled', message: 'cancelled' }); });
  });
  sample.limits = async () => ({ images: { maxCount: 20 } });
  const downloads = { save: async ({ filename, data }) => { window.__saves.push({ filename, size: typeof data === 'string' ? data.length : data.size, text: typeof data === 'string' ? data.slice(0, 4000) : null }); } };
  window.claude = { use: async name => name === 'sample' ? sample : name === 'downloads' ? downloads : null };
})();
