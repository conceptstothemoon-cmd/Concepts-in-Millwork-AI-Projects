// Stand-ins for Microsoft 365 used by run5.js:
//   - a fake MSAL sign-in library (served in place of vendor/msal-browser.min.js)
//   - a fake Microsoft Graph with one SharePoint site and one OneDrive, kept in memory
//   - the Spec Desk Claude service: the REAL api/src/handler.js, with only Claude itself simulated
//     (the simulated answers come from mock-claude.js running in the page)
const fs = require('fs'), path = require('path');
const API = path.join(__dirname, '..', 'api');

exports.CONFIG = {
  tenantId: '11111111-2222-3333-4444-555555555555', clientId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  siteHostname: 'cim.sharepoint.com', sitePath: '/sites/Estimating', projectsFolder: 'Spec Desk Projects',
  claudeEndpoint: 'https://cim-spec-desk.example/api/claude',
};

exports.FAKE_MSAL = `window.msal = (() => {
  class InteractionRequiredAuthError extends Error {}
  class PublicClientApplication {
    constructor(cfg) { window.__msalCfg = cfg; }
    async initialize() {}
    async handleRedirectPromise() {
      if (!sessionStorage.getItem('fake-msal-redirect')) return null;
      sessionStorage.removeItem('fake-msal-redirect');
      localStorage.setItem('fake-msal-acct', JSON.stringify({ name: 'Pat Estimator', username: 'pat@cim.example' }));
      return { account: this.getAllAccounts()[0] };
    }
    getAllAccounts() { const a = localStorage.getItem('fake-msal-acct'); return a ? [JSON.parse(a)] : []; }
    setActiveAccount() {}
    async acquireTokenSilent({ scopes }) {
      (window.__tokenScopes = window.__tokenScopes || []).push(scopes.join(' '));
      return { accessToken: scopes.some(s => s.startsWith('api://')) ? (window.__badApiToken ? 'not-a-real-token' : window.__apiToken) : 'graph-token' };
    }
    async loginRedirect(req) { localStorage.setItem('fake-msal-login', JSON.stringify(req)); sessionStorage.setItem('fake-msal-redirect', '1'); location.reload(); }
    async logoutRedirect() { localStorage.removeItem('fake-msal-acct'); location.reload(); }
    async acquireTokenRedirect() {}
  }
  return { PublicClientApplication, InteractionRequiredAuthError };
})();`;

// A signed access token the real handler accepts (local signing key instead of Microsoft's).
exports.makeAuth = async () => {
  const { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet } = await import(path.join(API, 'node_modules/jose/dist/webapi/index.js'));
  const C = exports.CONFIG, { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
  const token = await new SignJWT({ tid: C.tenantId, scp: 'access_as_user', preferred_username: 'pat@cim.example' })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(`https://login.microsoftonline.com/${C.tenantId}/v2.0`)
    .setAudience(`api://${C.clientId}`).setIssuedAt().setExpirationTime('2h').sign(privateKey);
  return { token, auth: { jwks: createLocalJWKSet({ keys: [jwk] }), tenantId: C.tenantId, clientId: C.clientId } };
};

// In-memory Graph. Drives: the SharePoint site's Documents library and the person's OneDrive.
exports.makeGraph = seed => {
  let n = 0; const items = new Map(), sessions = new Map(), log = [];
  const now = () => new Date().toISOString();
  const add = (drive, parent, name, data) => { const id = 'it' + (++n); const it = { id, drive, parent, name, lastModifiedDateTime: now() }; if (data == null) it.folder = true; else it.data = data; items.set(id, it); return it; };
  const roots = { site: add('site', null, '(root)'), me: add('me', null, '(root)') };
  const childrenOf = id => [...items.values()].filter(i => i.parent === id);
  const view = it => ({ id: it.id, name: it.name, lastModifiedDateTime: it.lastModifiedDateTime, ...(it.folder ? { folder: { childCount: childrenOf(it.id).length } } : { file: {}, size: it.data.length }) });
  const byPath = (drive, p) => { let cur = roots[drive]; for (const seg of p.split('/').filter(Boolean)) { cur = childrenOf(cur.id).find(c => c.name === decodeURIComponent(seg)); if (!cur) return null; } return cur; };
  const ensure = (drive, folders) => { let cur = roots[drive]; for (const f of folders) cur = childrenOf(cur.id).find(c => c.name === f && c.folder) || add(drive, cur.id, f); return cur; };
  for (const [drive, p, file] of seed) { const segs = p.split('/'); const parent = ensure(drive, segs.slice(0, -1)); add(drive, parent.id, segs.at(-1), file ? fs.readFileSync(file) : Buffer.from('placeholder')); }
  const put = (drive, p, data) => { const segs = p.split('/').map(decodeURIComponent); const parent = byPath(drive, segs.slice(0, -1).join('/')); if (!parent) return null;
    const old = childrenOf(parent.id).find(c => c.name === segs.at(-1)); if (old) { old.data = data; old.lastModifiedDateTime = now(); return old; } return add(drive, parent.id, segs.at(-1), data); };
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });

  async function route(route, u) {
    const url = new URL(u), req = route.request(), method = req.method();
    if (!['dl.example', 'upload.example', 'graph.microsoft.com'].includes(url.host)) return false;
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (url.host === 'dl.example') { log.push({ kind: 'download', auth: !!req.headers().authorization }); const it = items.get(url.pathname.slice(1)); return it ? route.fulfill({ status: 200, body: it.data, headers: { 'content-type': 'application/octet-stream', 'access-control-allow-origin': '*' } }) : route.fulfill({ status: 404 }); }
    if (url.host === 'upload.example') {
      const s = sessions.get(url.pathname.slice(1)); const range = req.headers()['content-range'] || '';
      log.push({ kind: 'chunk', auth: !!req.headers().authorization, range });
      const m = range.match(/bytes (\d+)-(\d+)\/(\d+)/); if (!s || !m) return route.fulfill({ status: 400 });
      s.parts.push(req.postDataBuffer()); const end = +m[2] + 1, total = +m[3];
      if (end < total) return json(route, 202, { nextExpectedRanges: [`${end}-`] });
      const it = put(s.drive, s.path, Buffer.concat(s.parts)); return json(route, 201, view(it));
    }
    if (url.host !== 'graph.microsoft.com') return false;
    const auth = req.headers().authorization;
    log.push({ kind: 'graph', method, path: decodeURIComponent(url.pathname + url.search), auth });
    if (auth !== 'Bearer graph-token') return json(route, 401, { error: { message: 'Bad token' } });
    let p = url.pathname.replace(/^\/v1\.0/, '');
    if (p === '/sites/cim.sharepoint.com:/sites/Estimating') return json(route, 200, { id: 'site-1', displayName: 'Estimating' });
    if (p === '/sites/site-1/drive') return json(route, 200, { id: 'drv-site' });
    let drive; if (p.startsWith('/drives/drv-site/')) { drive = 'site'; p = p.slice('/drives/drv-site'.length); } else if (p.startsWith('/me/drive/')) { drive = 'me'; p = p.slice('/me/drive'.length); } else return json(route, 404, { error: { message: 'Not found ' + p } });
    let m;
    if (p === '/root/children' && method === 'GET') return json(route, 200, { value: childrenOf(roots[drive].id).map(view) });
    if (p === '/root/children' && method === 'POST') { const b = JSON.parse(req.postData()); if (childrenOf(roots[drive].id).some(c => c.name === b.name)) return json(route, 409, { error: { message: 'exists' } }); return json(route, 201, view(add(drive, roots[drive].id, b.name))); }
    if ((m = p.match(/^\/items\/([^/]+)\/children$/))) return json(route, 200, { value: childrenOf(decodeURIComponent(m[1])).map(view) });
    if ((m = p.match(/^\/items\/([^/]+)$/))) { const it = items.get(decodeURIComponent(m[1])); return it ? json(route, 200, { ...view(it), '@microsoft.graph.downloadUrl': 'https://dl.example/' + it.id }) : json(route, 404, { error: { message: 'no item' } }); }
    if ((m = p.match(/^\/root:\/(.+):\/content$/)) && method === 'PUT') { const it = put(drive, m[1], req.postDataBuffer()); log.push({ kind: 'simple-upload', size: it && it.data.length }); return it ? json(route, 201, view(it)) : json(route, 404, { error: { message: 'no folder' } }); }
    if ((m = p.match(/^\/root:\/(.+):\/createUploadSession$/))) { const id = 's' + (++n); sessions.set(id, { drive, path: m[1], parts: [] }); return json(route, 200, { uploadUrl: 'https://upload.example/' + id }); }
    if ((m = p.match(/^\/root:\/(.+)$/))) { const it = byPath(drive, m[1]); return it ? json(route, 200, view(it)) : json(route, 404, { error: { message: 'The resource could not be found.' } }); }
    return json(route, 404, { error: { message: 'Unhandled ' + p } });
  }
  return { route, log, items, find: (drive, p) => byPath(drive, p) };
};

// The Spec Desk Claude service: the real handler, with Claude answered by the page's simulated Claude.
exports.makeClaudeService = async (getPage, auth) => {
  const { handle } = await import(path.join(API, 'src/handler.js'));
  const Anthropic = (await import(path.join(API, 'node_modules/@anthropic-ai/sdk/index.mjs'))).default;
  const requests = [];
  const client = { beta: { messages: { stream(req) { return { finalMessage: async () => {
    const content = req.messages[0].content, text = content.find(c => c.type === 'text').text;
    const imgs = content.filter(c => c.type === 'image').map(c => ({ size: c.source.data.length, type: c.source.media_type }));
    requests.push({ model: req.model, effort: req.output_config.effort, images: imgs.length, types: [...new Set(imgs.map(i => i.type))], chars: text.length });
    const page = getPage(), mode = await page.evaluate(() => window.__mock.mode);
    if (mode === 'rate_limited') throw new Anthropic.RateLimitError(429, { error: { message: 'rate' } }, 'rate', new Headers());
    if (mode === 'slow') await new Promise(r => setTimeout(r, 4000));
    const answer = await page.evaluate(([t, im]) => window.__mockAnswer(t, { images: im }), [text, imgs]);
    return { content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(answer) }], stop_reason: 'end_turn', model: req.model, usage: { input_tokens: 1, output_tokens: 1 } };
  } }; } } } };
  async function route(route, u) {
    if (u !== exports.CONFIG.claudeEndpoint) return false;
    const req = route.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'POST' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const out = await handle({ authorization: req.headers().authorization, rawBody: req.postData() || '' }, { client, auth, env: {}, pingMs: 50 });
    if (out.json) return route.fulfill({ status: out.status, contentType: 'application/json', headers: cors, body: JSON.stringify(out.json) });
    const reader = out.stream.getReader(), parts = [];
    for (;;) { const { value, done } = await reader.read(); if (done) break; parts.push(Buffer.from(value)); }
    return route.fulfill({ status: 200, contentType: 'application/x-ndjson', headers: cors, body: Buffer.concat(parts) }).catch(() => {});
  }
  return { route, requests };
};
