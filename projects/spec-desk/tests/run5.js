// Microsoft 365 mode: sign-in, Claude through CIM's own service (the real api/src/handler.js), files from
// SharePoint and OneDrive, projects saved to and opened from SharePoint, and plain downloads.
// Microsoft is faked (fake-m365.js); Claude's answers come from the simulated Claude in mock-claude.js.
const { setup, FX } = require('./harness');
const { CONFIG, FAKE_MSAL, makeAuth, makeGraph, makeClaudeService } = require('./fake-m365');
const fs = require('fs');

(async () => {
  const APP = process.argv[2];
  const all = [];
  const report = r => all.push(...r);

  // ---------- 1. config.js left blank: works on its own, downloads are real downloads ----------
  {
    const t = await setup(APP, { initScripts: [{ content: 'window.__noWindowClaude = true;' }] });
    const { page, log, ev } = t;
    await page.waitForTimeout(500);
    const st = await ev(() => ({ acct: !document.querySelector('#msAcct').hidden, ai: caps.sample, dl: !!caps.downloads, sp: document.querySelectorAll('.sp-pick').length }));
    log('Blank config: no sign-in, no AI, no SharePoint buttons, but saving works', !st.acct && !st.ai && st.dl && st.sp === 0, JSON.stringify(st));
    await page.setInputFiles('#fileInput', FX('spec-book.pdf'));
    await page.waitForFunction(() => state.sections.length > 0 && !document.querySelector('.tabs').hidden);
    await page.click('.tabs button[data-tab="ask"]');
    const note = await page.locator('#pane-ask .need-ai-off').textContent();
    log('Blank config: the Ask tab explains how to turn Claude on', /Microsoft 365 setup/.test(note), note);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btnIndex')]);
    const txt = fs.readFileSync(await dl.path(), 'utf8');
    log('Save index (CSV) is a normal browser download, readable by Excel', dl.suggestedFilename() === 'spec-book - section index.csv' && txt.charCodeAt(0) === 0xfeff && /06 41 16/.test(txt), dl.suggestedFilename());
    const [zip] = await Promise.all([page.waitForEvent('download'), page.click('#btnZip')]);
    log('Save all sections (ZIP) downloads too', /split by section\.zip$/.test(zip.suggestedFilename()) && fs.statSync(await zip.path()).size > 1000, zip.suggestedFilename());
    report(t.results); await t.browser.close();
  }

  // ---------- 2. Microsoft 365 set up ----------
  const { token, auth } = await makeAuth();
  const graph = makeGraph([
    ['site', 'Specs/spec-book.pdf', FX('spec-book.pdf')], ['site', 'Specs/Notes.docx', null],
    ['site', 'Bids/proposal.pdf', FX('proposal.pdf')], ['site', 'Bids/estimate.xlsx', FX('estimate.xlsx')],
    ['site', 'Drawings/arch-A501.pdf', FX('arch-A501.pdf')], ['site', 'Drawings/shop-M01.pdf', FX('shop-M01.pdf')],
    ['me', 'Personal/old-spec.pdf', FX('spec-book.pdf')],
  ]);
  let current = null;
  const claude = await makeClaudeService(() => current, auth);
  const cfg = `window.SD_CONFIG = ${JSON.stringify({ ...CONFIG, simpleUploadMax: 50 * 1024 })};`;   // small limit so a project goes up in an upload session
  const opts = {
    initScripts: [{ content: `window.__noWindowClaude = true; window.__apiToken = ${JSON.stringify(token)};` }],
    route: async (route, u) => {
      if (u.endsWith('/config.js')) return route.fulfill({ contentType: 'application/javascript', body: cfg }), true;
      if (u.endsWith('/vendor/msal-browser.min.js')) return route.fulfill({ contentType: 'application/javascript', body: FAKE_MSAL }), true;
      if ((await graph.route(route, u)) !== false) return true;   // each fake returns false when the address isn't its own
      if ((await claude.route(route, u)) !== false) return true;
      return false;
    },
  };
  const t = await setup(APP, opts);
  const { page, log, ev, shot } = t; current = page;
  const pick = async (folder, names) => {   // use the SharePoint file browser like a person would
    await page.waitForSelector('#spDlg:not([hidden]) .it');
    if (folder) { await page.click(`#spList .it:has(.nm:text-is("${folder}"))`); await page.waitForSelector(`#spCrumbs button:text-is("${folder}")`); }
    for (const n of names) await page.click(`#spList .it:has(.nm:text-is("${n}"))`);
    await page.click('#spOpen');
    await page.waitForSelector('#spDlg', { state: 'hidden', timeout: 30000 });
  };
  await page.waitForTimeout(500);

  // signed out
  let st = await ev(() => ({ acct: document.querySelector('#msAcct').textContent, ai: !!caps.sample, sp: document.querySelectorAll('.sp-pick').length }));
  log('Signed out: "Sign in with Microsoft" in the header, AI off, no SharePoint buttons', /Sign in with Microsoft/.test(st.acct) && !st.ai && st.sp === 0, JSON.stringify(st));

  // sign in
  await page.click('#msIn');
  await page.waitForFunction(() => /Signed in as/.test(document.querySelector('#msAcct').textContent), null, { timeout: 15000 });
  st = await ev(() => ({ acct: document.querySelector('#msAcct').textContent.replace(/\s+/g, ' '), ai: !!caps.sample, sp: [...document.querySelectorAll('.sp-pick')].map(b => b.dataset.spFor), login: JSON.parse(localStorage.getItem('fake-msal-login')), msal: window.__msalCfg.auth }));
  log('Sign in: name shown, Claude on, "From SharePoint" next to the spec book chooser', /Signed in as Pat Estimator/.test(st.acct) && st.ai && st.sp.includes('fileInput'), JSON.stringify({ acct: st.acct, sp: st.sp }));
  log('Sign in asks for Graph file access and the Spec Desk API scope, for this tenant and app', st.login.scopes.includes('Files.ReadWrite.All') && st.login.extraScopesToConsent[0] === `api://${CONFIG.clientId}/access_as_user` && st.msal.clientId === CONFIG.clientId && st.msal.authority.endsWith(CONFIG.tenantId), JSON.stringify(st.login));
  await shot('50-m365-signed-in');

  // open the spec book from SharePoint
  await page.click('.sp-pick[data-sp-for="fileInput"]:visible');
  await page.waitForSelector('#spDlg:not([hidden]) .it');
  const places = await ev(() => [...document.querySelectorAll('#spPlace option')].map(o => o.textContent));
  log('File browser offers the team site first, then OneDrive', places.join() === 'Estimating (SharePoint),My OneDrive', places.join());
  await page.click('#spList .it:has(.nm:text-is("Specs"))'); await page.waitForSelector('#spList .it:has(.nm:text-is("Notes.docx"))');
  const grey = await ev(() => [...document.querySelectorAll('#spList .it')].map(r => r.querySelector('.nm').textContent + (r.classList.contains('off') ? ' (greyed)' : '')));
  log('Only files the chooser accepts can be picked (Notes.docx greyed out)', grey.includes('Notes.docx (greyed)') && grey.includes('spec-book.pdf'), grey.join(', '));
  await shot('51-m365-file-browser');
  await page.click('#spList .it:has(.nm:text-is("spec-book.pdf"))'); await page.click('#spOpen');
  await page.waitForFunction(() => state.sections.length === 3 && !document.querySelector('.tabs').hidden, null, { timeout: 30000 });
  const dlAuth = graph.log.filter(x => x.kind === 'download');
  log('Spec book opened from SharePoint and split into 3 sections', true, await page.locator('#fileInfo').textContent());
  log('Downloads use the pre-signed address (no sign-in token sent to it)', dlAuth.length >= 1 && dlAuth.every(x => !x.auth), JSON.stringify(dlAuth));

  // Ask, answered through the real Claude service handler
  await page.click('.tabs button[data-tab="ask"]');
  await page.fill('#askQ', 'What hinges and drawer slides are specified for the cabinets?');
  let n0 = claude.requests.length;
  await page.click('#askGo');
  await page.waitForFunction(() => !document.querySelector('#askGo').disabled && document.querySelector('#askOut .answer h2'), null, { timeout: 60000 });
  const ask = await ev(() => ({ pts: state.ask.points.map(p => (p.chk ? p.chk.status : '-') + ': ' + p.statement.slice(0, 40)), log: state.ask.check && state.ask.check.stopped }));
  const askReq = claude.requests.slice(n0);
  log('Ask works through CIM’s Claude service (Opus 5.5, high effort) and is checked automatically', askReq.length >= 2 && askReq[0].model === 'claude-opus-5-5' && askReq[0].effort === 'high' && /Settled/.test(ask.log) && ask.pts.some(p => /^disputed: Hinges must be stainless/.test(p)), `${askReq.length} requests; ${ask.log}`);
  const apiTok = await ev(() => window.__tokenScopes.filter(s => s.startsWith('api://')).length);
  log('Each Claude request carries the Spec Desk API token', apiTok >= askReq.length, `${apiTok} API tokens for ${askReq.length} requests`);

  // Compare against a proposal from SharePoint
  await page.click('.tabs button[data-tab="compare"]');
  await page.click('.sp-pick[data-sp-for="otherFile"]');
  await pick('Bids', ['proposal.pdf']);
  await page.waitForFunction(() => state.other && state.other.chunks.length, null, { timeout: 20000 });
  await page.fill('#pickFilter', '06 41'); await page.click('#pickShown'); await page.fill('#pickFilter', '');
  await page.click('#cmpGo');
  await page.waitForFunction(() => /^Finished/.test(document.querySelector('#cmpStatus').textContent) || document.querySelector('#cmpStatus .err'), null, { timeout: 60000 });
  const cmp = await ev(() => ({ n: state.cmpItems.length, conflicts: state.cmpItems.filter(i => i.status === 'conflict').map(i => i.topic), check: state.cmpCheck && state.cmpCheck.stopped }));
  log('Compare: proposal opened from SharePoint, comparison and its checking done through the service', cmp.conflicts.includes('Hinge') && /Settled/.test(cmp.check), JSON.stringify(cmp));
  const [csv] = await Promise.all([page.waitForEvent('download'), page.click('#cmpCsv')]);
  log('Save findings (CSV) downloads', /spec-comparison\.csv/.test(csv.suggestedFilename()), csv.suggestedFilename());

  // Drawings from SharePoint (two picked at once into one set kind each), then a drawing review with sheet images
  await page.click('.tabs button[data-tab="drawings"]');
  await page.selectOption('#dwgKind', 'Architectural');
  await page.click('.sp-pick[data-sp-for="dwgFile"]');
  await pick('Drawings', ['arch-A501.pdf']);
  await page.waitForFunction(() => state.dwg.sets.length === 1 && !dwgBusy, null, { timeout: 30000 });
  await page.selectOption('#dwgKind', 'Shop drawings');
  await page.click('.sp-pick[data-sp-for="dwgFile"]');
  await pick('Drawings', ['shop-M01.pdf']);
  await page.waitForFunction(() => state.dwg.sets.length === 2 && !dwgBusy, null, { timeout: 30000 });
  log('Drawing sets opened from SharePoint; sheets A-501 and M.01 found', await ev(() => [...state.dwg.sheets.keys()].join() === 'A501,M01'), await ev(() => [...state.dwg.sheets.keys()].join()));
  await page.click('.tabs button[data-tab="review"]'); await page.waitForTimeout(800);
  n0 = claude.requests.length;
  await page.click('#rvGo');
  await page.waitForFunction(() => /^Finished/.test(document.querySelector('#rvStatus').textContent) || document.querySelector('#rvStatus .err'), null, { timeout: 90000 });
  const rvReq = claude.requests.slice(n0);
  const rv = await ev(() => ({ items: state.reviews[0].items.length, check: state.reviews[0].check && state.reviews[0].check.stopped }));
  log('Drawing review: sheet images reach Claude through the service (JPEG), review checked', rvReq[0].images === 10 && rvReq[0].types.join() === 'image/jpeg' && /Settled/.test(rv.check), `first request ${rvReq[0].images} images; ${rvReq.length} requests; ${rv.check}`);


  // Save the project to SharePoint (upload session, since the test limit for one-piece uploads is small)
  await page.click('#btnProjects');
  await page.waitForSelector('[data-psp]');
  await page.click('[data-psp]');
  await page.waitForFunction(() => /Saved “/.test(document.querySelector('#projStatus').textContent) || document.querySelector('#projStatus .err'), null, { timeout: 60000 });
  const saved = await page.locator('#projStatus').textContent();
  const folder = graph.find('site', 'Spec Desk Projects');
  const zipItem = folder && [...graph.items.values()].find(i => i.parent === folder.id && /Spec Desk project\.zip$/.test(i.name));
  const chunks = graph.log.filter(x => x.kind === 'chunk');
  log('Project saved to SharePoint › Spec Desk Projects (folder created on first save)', !!zipItem && /Estimating › Spec Desk Projects/.test(saved), saved);
  log('Large project files go up in an upload session; the pre-signed address gets no sign-in token', chunks.length >= 1 && chunks.every(c => !c.auth && /^bytes 0-\d+\/\d+$/.test(c.range)) && zipItem && zipItem.data.length === +chunks.at(-1).range.split('/')[1], JSON.stringify(chunks));
  await shot('52-m365-projects');

  // errors and Stop through the service
  await page.click('.tabs button[data-tab="ask"]');
  await ev(() => { window.__mock.mode = 'rate_limited'; });
  await page.click('#askGo');
  await page.waitForFunction(() => !document.querySelector('#askGo').disabled && document.querySelector('#askOut .warn'), null, { timeout: 30000 });
  log('Claude busy (rate limit) shows the right message', /Too many requests/.test(await page.locator('#askOut .warn').first().textContent()), await page.locator('#askOut .warn').first().textContent());
  await ev(() => { window.__mock.mode = 'ok'; window.__badApiToken = true; });
  await page.click('#askGo');
  await page.waitForFunction(() => !document.querySelector('#askGo').disabled && document.querySelector('#askOut .warn'), null, { timeout: 30000 });
  log('A sign-in the service rejects is explained', /sign-in wasn’t accepted by the Claude service/.test(await page.locator('#askOut .warn').first().textContent()), await page.locator('#askOut .warn').first().textContent());
  await ev(() => { window.__badApiToken = false; window.__mock.mode = 'slow'; });
  await page.click('#askGo'); await page.waitForTimeout(500); await page.click('#askStop');
  await page.waitForFunction(() => !document.querySelector('#askGo').disabled, null, { timeout: 10000 });
  log('Stop cancels a request to the service', /Stopped/.test(await page.locator('#askOut').textContent()), '');
  await ev(() => { window.__mock.mode = 'ok'; });
  report(t.results);
  const errs1 = t.errorsRef.filter(e => !/Failed to load resource|net::ERR_FAILED/.test(e));
  await t.browser.close();

  // ---------- 3. Another person opens the shared project from SharePoint (fresh browser, nothing stored) ----------
  const t2 = await setup(APP, opts); current = t2.page;
  {
    const { page, log, ev } = t2;
    await page.waitForTimeout(400);
    await page.click('#msIn');
    await page.waitForFunction(() => /Signed in as/.test(document.querySelector('#msAcct').textContent), null, { timeout: 15000 });
    await page.click('#btnProjects');
    await page.waitForSelector('#btnProjSp');
    await page.click('#btnProjSp');
    await page.waitForSelector('#spDlg:not([hidden]) .it');
    const where = await ev(() => document.querySelector('#spPlace option').textContent);
    log('"Open from SharePoint" starts in the shared projects folder', where === 'Estimating › Spec Desk Projects', where);
    await page.click('#spList .it:has(.nm:text-matches("Spec Desk project\\\\.zip$"))'); await page.click('#spOpen');
    await page.waitForFunction(() => state.sections.length === 3 && state.dwg.sets.length === 2, null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const back = await ev(() => ({ secs: state.sections.length, cmp: state.cmpItems.length, sets: state.dwg.sets.length, reviews: (state.reviews || []).length, checked: !!state.cmpCheck, name: state.project && state.project.name }));
    log('The whole project comes back: spec book, comparison and its checks, drawings, drawing review', back.secs === 3 && back.cmp > 0 && back.sets === 2 && back.reviews === 1 && back.checked, JSON.stringify(back));
    // pick two drawing PDFs in one go (tick both)
    await page.click('.tabs button[data-tab="drawings"]');
    await page.selectOption('#dwgKind', 'Other drawings');
    await page.click('.sp-pick[data-sp-for="dwgFile"]');
    await page.waitForSelector('#spDlg:not([hidden]) .it');
    await page.click('#spList .it:has(.nm:text-is("Drawings"))'); await page.waitForSelector('#spCrumbs button:text-is("Drawings")');
    await page.click('#spList .it:has(.nm:text-is("arch-A501.pdf"))'); await page.click('#spList .it:has(.nm:text-is("shop-M01.pdf"))');
    const btnTxt = await page.locator('#spOpen').textContent();
    await page.click('#spOpen');
    await page.waitForFunction(() => state.dwg.sets.length === 4 && !dwgBusy, null, { timeout: 30000 }).catch(() => {});
    const sets = await ev(() => state.dwg.sets.map(s => s.kind + ': ' + s.name));
    log('Several drawings picked at once from SharePoint all load', btnTxt === 'Open 2 files' && sets.filter(x => /^Other drawings/.test(x)).length === 2, `${btnTxt}; ${sets.join(' | ')}`);
    await page.click('#msOut');
    await page.waitForFunction(() => /Sign in with Microsoft/.test(document.querySelector('#msAcct').textContent), null, { timeout: 15000 });
    log('Sign out returns to the signed-out state', await ev(() => !caps.sample && !document.querySelector('.sp-pick')), '');
    report(t2.results);
  }
  const errs2 = t2.errorsRef.filter(e => !/Failed to load resource|net::ERR_FAILED/.test(e));
  await t2.browser.close();

  console.log('\nPAGE ERRORS:', [...errs1, ...errs2].length ? [...errs1, ...errs2] : 'none');
  fs.writeFileSync(require('path').join(__dirname, 'results5.json'), JSON.stringify({ results: all }, null, 1));
  console.log(`\n${all.filter(r => r.ok).length}/${all.length} passed`);
})().catch(e => { console.error('HARNESS CRASH', e); process.exit(1); });
