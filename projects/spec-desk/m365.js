// Spec Desk: Microsoft 365 connection.
//
// Gives index.html the same two features it gets inside claude.ai, plus SharePoint:
//   downloads.save({filename, data})   a normal browser download (works with or without Microsoft 365)
//   sample(prompt, opts) / sample.json / sample.limits   Claude, through CIM's Azure Function (api/)
//   files: browse and open from SharePoint or OneDrive; save and list project files in SharePoint
// Settings are in config.js. Sign-in uses Microsoft's MSAL library (vendor/), the same as CIM's other tools.
window.SD = (() => {
  'use strict';
  const C = window.SD_CONFIG || {};
  const GRAPH = 'https://graph.microsoft.com/v1.0';
  const GRAPH_SCOPES = ['User.Read', 'Files.ReadWrite.All', 'Sites.ReadWrite.All'];
  const SIMPLE_UPLOAD_MAX = C.simpleUploadMax || 4 * 1024 * 1024;   // bigger files go up in 10 MB pieces
  const CHUNK = 320 * 1024 * 32;                                      // 10 MiB; Graph wants multiples of 320 KiB

  const configured = () => Boolean(C.clientId);
  const aiOn = () => configured() && Boolean(C.claudeEndpoint);
  const siteOn = () => configured() && Boolean(C.siteHostname && C.sitePath);
  const apiScope = () => `api://${C.clientId}/access_as_user`;
  const fail = (code, message) => Object.assign(new Error(message || code), { code });

  /* ---------- Saving files: a normal browser download ---------- */
  const downloads = {
    async save({ filename, data }) {
      let blob = data;
      if (!(data instanceof Blob)) {
        const csv = /\.csv$/i.test(filename);
        // a byte-order mark lets Excel read accented letters and curly quotes in a CSV correctly
        blob = new Blob([csv ? '﻿' + String(data) : String(data)], { type: csv ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8' });
      }
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: filename });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    },
  };

  /* ---------- Sign-in (MSAL) ---------- */
  let pca = null, account = null;
  const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, '');
  async function initAuth() {
    pca = new msal.PublicClientApplication({
      auth: { clientId: C.clientId, authority: 'https://login.microsoftonline.com/' + (C.tenantId || 'organizations'), redirectUri: redirectUri() },
      cache: { cacheLocation: 'localStorage' },
    });
    await pca.initialize();
    const result = await pca.handleRedirectPromise();
    account = (result && result.account) || pca.getAllAccounts()[0] || null;
    if (account) pca.setActiveAccount(account);
  }
  async function token(scopes) {
    if (!account) throw fail('not_granted', 'Sign in with Microsoft first.');
    try {
      return (await pca.acquireTokenSilent({ scopes, account })).accessToken;
    } catch (e) {
      if (e instanceof msal.InteractionRequiredAuthError) await pca.acquireTokenRedirect({ scopes, account });
      throw fail('not_granted', 'Your Microsoft sign-in needs to be renewed.');
    }
  }
  const signIn = () => pca.loginRedirect({ scopes: GRAPH_SCOPES, extraScopesToConsent: aiOn() ? [apiScope()] : [] });
  const signOut = () => pca.logoutRedirect({ account, postLogoutRedirectUri: redirectUri() });

  /* ---------- Claude, through the Azure Function ---------- */
  const blobToBase64 = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
  async function callClaude(body, signal) {
    const t = await token([apiScope()]);
    let res;
    try {
      res = await fetch(C.claudeEndpoint, { method: 'POST', signal, headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch (e) {
      if (e && e.name === 'AbortError') throw fail('cancelled');
      throw fail('network', 'Couldn’t reach the Claude service.');
    }
    if (!res.ok) {
      let j = {}; try { j = await res.json(); } catch { /* no JSON body */ }
      const code = j.code || ({ 400: 'invalid_request', 401: 'not_granted', 403: 'not_granted', 413: 'prompt_too_large', 429: 'rate_limited' }[res.status]) || 'server_error';
      throw fail(code, j.error || `Claude service error (${res.status})`);
    }
    // The reply is newline-delimited JSON: pings while Claude works, then {done} or {error}.
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '', final = null;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        for (let i; (i = buf.indexOf('\n')) >= 0;) {
          const ln = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!ln) continue;
          const ev = JSON.parse(ln);
          if (ev.error) throw fail(ev.code || 'server_error', ev.error);
          if (ev.done) final = ev;
        }
      }
    } catch (e) {
      if (e && e.name === 'AbortError') throw fail('cancelled');
      if (e && e.code) throw e;
      throw fail('network', 'The connection to the Claude service dropped.');
    }
    if (!final) throw fail('server_error', 'The Claude service stopped before answering.');
    return final;
  }
  // Tolerant JSON: the whole reply, else a fenced block, else the first { or [ to the last } or ].
  function parseJson(text) {
    const t = String(text || '').trim();
    try { return JSON.parse(t); } catch { /* try the next form */ }
    const f = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (f) { try { return JSON.parse(f[1]); } catch { /* next */ } }
    const a = t.search(/[{[]/), b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* fall through */ } }
    throw fail('invalid_json');
  }
  function makeSample() {
    async function sample(input, opts = {}) {
      const images = [];
      for (const b of opts.images || []) images.push({ media_type: b.type === 'image/png' ? 'image/png' : 'image/jpeg', data: await blobToBase64(b) });
      const out = await callClaude({ prompt: String(input), images, tier: opts.modelTier === 'quick' ? 'quick' : 'default' }, opts.signal);
      if (out.stop_reason === 'refusal') throw fail('refused', 'Claude declined this request.');
      return { text: out.text || '', truncated: out.stop_reason === 'max_tokens' };
    }
    sample.json = async (input, opts) => parseJson((await sample(input, opts)).text);
    sample.limits = async () => ({ images: { maxCount: 20, maxBytes: 5 * 1024 * 1024, mediaTypes: ['image/jpeg', 'image/png'] } });
    return sample;
  }

  /* ---------- SharePoint and OneDrive (Microsoft Graph) ---------- */
  async function graph(path, opts = {}) {
    const t = await token(GRAPH_SCOPES);
    let res;
    try { res = await fetch(path.startsWith('http') ? path : GRAPH + path, { ...opts, headers: { Authorization: 'Bearer ' + t, ...(opts.headers || {}) } }); }
    catch { throw fail('network', 'Couldn’t reach Microsoft 365.'); }
    if (!res.ok) {
      let m = ''; try { m = (await res.json()).error.message; } catch { /* no body */ }
      throw Object.assign(fail({ 401: 'not_granted', 403: 'not_granted', 404: 'not_found' }[res.status] || 'graph_error', m || `Microsoft 365 request failed (${res.status})`), { status: res.status });
    }
    return res;
  }
  const gjson = async (path, opts) => (await graph(path, opts)).json();
  const enc = p => p.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  let site = null;
  async function siteDrive() {
    if (!site) {
      const s = await gjson(`/sites/${C.siteHostname}:${C.sitePath}`);
      const d = await gjson(`/sites/${s.id}/drive?$select=id`);
      site = { drive: `/drives/${d.id}`, name: s.displayName || 'SharePoint' };
    }
    return site;
  }
  // Where the file browser starts: the team site (if set up), then the person's OneDrive.
  async function places() {
    const out = [];
    if (siteOn()) { try { const s = await siteDrive(); out.push({ id: 'site', name: `${s.name} (SharePoint)`, drive: s.drive }); } catch (e) { if (e.code !== 'not_found' && e.code !== 'not_granted') throw e; } }
    out.push({ id: 'me', name: 'My OneDrive', drive: '/me/drive' });
    return out;
  }
  async function list(drive, itemId) {
    let r = await gjson(`${drive}/${itemId ? 'items/' + encodeURIComponent(itemId) : 'root'}/children?$top=200&$select=id,name,size,folder,file,lastModifiedDateTime`);
    let items = r.value || [];
    while (r['@odata.nextLink'] && items.length < 3000) { r = await gjson(r['@odata.nextLink']); items = items.concat(r.value || []); }
    return items;
  }
  // The pre-signed download address avoids a cross-site redirect the browser would block.
  async function download(drive, item, onPct) {
    const meta = await gjson(`${drive}/items/${encodeURIComponent(item.id)}?$select=id,name,size,lastModifiedDateTime,@microsoft.graph.downloadUrl`);
    const url = meta['@microsoft.graph.downloadUrl'];
    if (!url) throw fail('graph_error', `${item.name} can’t be downloaded.`);
    const res = await fetch(url);
    if (!res.ok) throw fail('graph_error', `Downloading ${item.name} failed (${res.status}).`);
    let blob;
    if (onPct && res.body && meta.size) {
      const reader = res.body.getReader(), parts = []; let got = 0;
      for (;;) { const { value, done } = await reader.read(); if (done) break; parts.push(value); got += value.length; onPct(got / meta.size); }
      blob = new Blob(parts);
    } else blob = await res.blob();
    const type = /\.pdf$/i.test(item.name) ? 'application/pdf' : /\.zip$/i.test(item.name) ? 'application/zip' : (blob.type || '');
    return new File([blob], item.name, { type, lastModified: Date.parse(meta.lastModifiedDateTime) || Date.now() });
  }
  // The shared projects folder. Only saving creates it (create: true); browsing just looks for it and
  // returns null when it isn't there yet.
  async function projectsHome({ create = false } = {}) {
    const folder = C.projectsFolder || 'Spec Desk Projects';
    const drive = siteOn() ? (await siteDrive()).drive : '/me/drive';
    const lookup = () => gjson(`${drive}/root:/${enc(folder)}?$select=id,name`);
    let item;
    try { item = await lookup(); }
    catch (e) {
      if (e.code !== 'not_found') throw e;
      if (!create) return null;
      try { item = await gjson(`${drive}/root/children`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: folder, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }) }); }
      catch (e2) { if (e2.status !== 409) throw e2; item = await lookup(); }   // someone else created it at the same moment
    }
    return { drive, folder, id: item.id, where: siteOn() ? `${site.name} › ${folder}` : `OneDrive › ${folder}` };
  }
  // Is there already a file with this name in the projects folder? Returns who saved it and when, or null.
  async function existing(drive, folder, name) {
    try {
      const it = await gjson(`${drive}/root:/${enc(folder)}/${encodeURIComponent(name)}?$select=id,name,lastModifiedDateTime,lastModifiedBy`);
      return { by: (it.lastModifiedBy && it.lastModifiedBy.user && it.lastModifiedBy.user.displayName) || '', at: it.lastModifiedDateTime || '' };
    } catch (e) { if (e.code === 'not_found') return null; throw e; }
  }
  async function upload(drive, folder, name, blob, onPct) {
    const path = `${drive}/root:/${enc(folder)}/${encodeURIComponent(name)}`;
    if (blob.size <= SIMPLE_UPLOAD_MAX) {
      const r = await graph(`${path}:/content?@microsoft.graph.conflictBehavior=replace`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: blob });
      onPct && onPct(1); return r.json();
    }
    const s = await gjson(`${path}:/createUploadSession`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }) });
    let last = null;
    for (let off = 0; off < blob.size; off += CHUNK) {
      const end = Math.min(blob.size, off + CHUNK);
      let r;
      // the upload address is pre-signed: it must not get the sign-in header
      try { r = await fetch(s.uploadUrl, { method: 'PUT', headers: { 'Content-Range': `bytes ${off}-${end - 1}/${blob.size}` }, body: blob.slice(off, end) }); }
      catch { throw fail('network', 'The upload to SharePoint was interrupted.'); }
      if (!r.ok) throw fail('graph_error', `The upload to SharePoint stopped (${r.status}).`);
      last = r; onPct && onPct(end / blob.size);
    }
    return last.json();
  }

  /* ---------- Entry point used by the page ---------- */
  async function connect() {
    if (!configured()) return { configured: false, signedIn: false, downloads };
    if (!window.msal) return { configured: true, signedIn: false, downloads, error: 'The Microsoft sign-in library didn’t load.' };
    try { await initAuth(); }
    catch (e) { return { configured: true, signedIn: false, downloads, signIn: () => location.reload(), error: 'Microsoft sign-in failed: ' + (e.message || e) }; }
    if (!account) return { configured: true, signedIn: false, downloads, aiOn: aiOn(), signIn };
    return {
      configured: true, signedIn: true, aiOn: aiOn(), siteOn: siteOn(),
      account: { name: account.name || account.username, email: account.username },
      signIn, signOut, downloads,
      sample: aiOn() ? makeSample() : null,
      files: {
        places, list, download,
        projectsHome,
        // Refuses with code 'exists' (and who saved it, when) unless replace is set, so nobody overwrites a colleague's project by accident.
        saveProject: async (name, blob, onPct, { replace = false } = {}) => {
          const h = await projectsHome({ create: true });
          if (!replace) { const ex = await existing(h.drive, h.folder, name); if (ex) throw Object.assign(fail('exists', `${name} is already in ${h.where}`), ex, { where: h.where }); }
          await upload(h.drive, h.folder, name, blob, onPct); return h.where;
        },
      },
    };
  }
  return { connect, configured, aiOn, parseJson };
})();
