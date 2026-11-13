// Job Cost Pilot: connection to Microsoft 365.
//
// The page (index.html) was built against claude.ai's artifact runtime. This file provides the
// same interfaces from Microsoft 365, so the screens and math didn't change:
//   db        - documents in collections (jobs, legs, config, trips, mileage, parking, wip,
//               imports, lines, closes, reviews), stored as rows of one SharePoint list.
//   user      - who is signed in.
//   downloads - saves a file to the computer.
//   assets    - uploads a parking receipt photo to a SharePoint folder; returns its web link.
//
// List columns (setup/Create-JobCostList.ps1 makes them):
//   Title "<collection>/<id>" (unique, indexed), DocCollection, DocId, DocData (JSON, plain text)
window.JCM365 = (() => {
  'use strict';
  const C = window.JC_CONFIG || {};
  const GRAPH = 'https://graph.microsoft.com/v1.0';
  const SCOPES = ['User.Read', 'Sites.ReadWrite.All'];
  const MAX_DOC_CHARS = 60000;
  const configured = () => Boolean(C.clientId && C.siteHostname && C.sitePath);
  const fail = (code, message, status) => Object.assign(new Error(message || code), { code, status });

  /* ---------- Sign-in ---------- */
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
  async function token() {
    try { return (await pca.acquireTokenSilent({ scopes: SCOPES, account })).accessToken; }
    catch (e) { if (e instanceof msal.InteractionRequiredAuthError) await pca.acquireTokenRedirect({ scopes: SCOPES, account }); throw e; }
  }

  /* ---------- Graph ---------- */
  async function graph(url, options = {}) {
    const t = await token();
    const headers = { Authorization: 'Bearer ' + t, ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
    const res = await fetch(url.startsWith('http') ? url : GRAPH + url, { ...options, headers });
    if (!res.ok) {
      let detail = ''; try { detail = (await res.json()).error.message; } catch (e) { /* no body */ }
      // invalid_argument is the code the page already treats as "no permission to save".
      const code = res.status === 401 || res.status === 403 ? 'invalid_argument' : res.status === 404 ? 'not_found' : res.status === 429 ? 'rate_limited' : 'sharepoint_error';
      throw fail(code, res.status === 403 ? 'your account can’t change the Job Cost list' : `SharePoint request failed (${res.status}) ${detail}`, res.status);
    }
    return res.status === 204 ? null : res.json();
  }
  let siteId = null;
  async function getSiteId() { if (!siteId) siteId = (await graph(`/sites/${C.siteHostname}:${C.sitePath}`)).id; return siteId; }
  const listBase = async () => `/sites/${await getSiteId()}/lists/${encodeURIComponent(C.listName || 'Job Cost Data')}`;
  async function findItemId(key) {
    const r = await graph(`${await listBase()}/items?expand=fields(select=Title)&$filter=fields/Title eq '${key.replace(/'/g, "''")}'`, { headers: { Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' } });
    return r.value[0] ? r.value[0].id : null;
  }
  const backend = {
    async loadAll() {
      const out = new Map(); let url = `${await listBase()}/items?expand=fields(select=Title,DocData)&$top=999`;
      while (url) {
        const page = await graph(url);
        for (const it of page.value) { const f = it.fields || {}; if (!f.Title) continue; try { out.set(f.Title, { data: JSON.parse(f.DocData || '{}'), itemId: it.id }); } catch (e) { /* skip damaged row */ } }
        url = page['@odata.nextLink'] || null;
      }
      return out;
    },
    async put(key, data, itemId) {
      const [coll, ...rest] = key.split('/');
      const fields = { Title: key, DocCollection: coll, DocId: rest.join('/'), DocData: JSON.stringify(data) };
      if (!itemId) itemId = await findItemId(key);
      if (itemId) { await graph(`${await listBase()}/items/${itemId}/fields`, { method: 'PATCH', body: JSON.stringify(fields) }); return { itemId }; }
      const it = await graph(`${await listBase()}/items`, { method: 'POST', body: JSON.stringify({ fields }) });
      return { itemId: it.id };
    },
    async fetchOne(key, itemId) {
      if (!itemId) itemId = await findItemId(key);
      if (!itemId) return null;
      const it = await graph(`${await listBase()}/items/${itemId}?expand=fields(select=Title,DocData)`);
      return { itemId, data: JSON.parse((it.fields && it.fields.DocData) || '{}') };
    },
    async remove(key, itemId) {
      if (!itemId) itemId = await findItemId(key);
      if (itemId) await graph(`${await listBase()}/items/${itemId}`, { method: 'DELETE' });
    },
  };

  /* ---------- Document store with change listeners ---------- */
  function makeDb() {
    let docs = new Map(), loaded = false, lastError = null, writesStarted = 0, writesRunning = 0;
    const subs = new Set();
    const copy = v => JSON.parse(JSON.stringify(v));
    const collSnap = coll => { const p = coll + '/'; const list = [...docs.entries()].filter(([k]) => k.startsWith(p)).map(([k, d]) => ({ id: k.slice(p.length), data: () => copy(d.data) })); return { docs: list, size: list.length, empty: !list.length }; };
    const docSnap = key => { const d = docs.get(key); return { id: key.split('/').pop(), exists: Boolean(d), data: () => (d ? copy(d.data) : undefined) }; };
    const notify = only => { for (const s of subs) if (!only || s === only) s.cb(s.coll ? collSnap(s.coll) : docSnap(s.key)); };
    async function refresh() {
      const started = writesStarted;
      try {
        const fresh = await backend.loadAll();
        if (writesRunning || writesStarted !== started) return;
        docs = fresh; loaded = true; lastError = null; notify();
      } catch (e) { lastError = e; if (!loaded) for (const s of subs) if (s.err) s.err(e); }
    }
    const writing = async fn => { writesStarted++; writesRunning++; try { return await fn(); } finally { writesRunning--; } };
    const checkSize = d => { if (JSON.stringify(d).length > MAX_DOC_CHARS) throw fail('too_large', 'this item is too large to save'); };
    const subscribe = s => { subs.add(s); if (loaded) notify(s); else if (lastError && s.err) s.err(lastError); return () => subs.delete(s); };
    function doc(key) {
      return {
        async get() { return docSnap(key); },
        async set(data) {
          checkSize(data); const prev = docs.get(key);
          docs.set(key, { data: copy(data), itemId: prev && prev.itemId }); notify();
          try { await writing(async () => { const r = await backend.put(key, data, prev && prev.itemId); const d = docs.get(key); if (d) d.itemId = r.itemId; }); }
          catch (e) { if (prev) docs.set(key, prev); else docs.delete(key); notify(); throw e; }
        },
        async update(patch) {
          const prev = docs.get(key);
          docs.set(key, { data: { ...(prev ? prev.data : {}), ...copy(patch) }, itemId: prev && prev.itemId }); notify();
          try {
            await writing(async () => {
              // Merge into the latest saved copy so someone else's change to another field isn't lost.
              const latest = await backend.fetchOne(key, prev && prev.itemId);
              const merged = { ...(latest ? latest.data : prev ? prev.data : {}), ...patch };
              checkSize(merged);
              const r = await backend.put(key, merged, latest ? latest.itemId : prev && prev.itemId);
              docs.set(key, { data: merged, itemId: r.itemId }); notify();
            });
          } catch (e) { if (prev) docs.set(key, prev); else docs.delete(key); notify(); throw e; }
        },
        async delete() {
          const prev = docs.get(key); docs.delete(key); notify();
          try { await writing(() => backend.remove(key, prev && prev.itemId)); }
          catch (e) { if (prev) docs.set(key, prev); notify(); throw e; }
        },
        onSnapshot: (cb, err) => subscribe({ key, cb, err }),
      };
    }
    return {
      refresh, get loaded() { return loaded; }, get lastError() { return lastError; },
      doc,
      collection: name => ({ onSnapshot: (cb, err) => subscribe({ coll: name, cb, err }) }),
    };
  }

  /* ---------- Downloads and receipt uploads ---------- */
  const downloads = { async save({ filename, data }) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: typeof data === 'string' ? 'text/csv;charset=utf-8' : 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } };
  const assets = { async upload(file) {
    const safe = String(file.name || 'receipt.jpg').replace(/[^A-Za-z0-9._-]+/g, '_');
    const name = new Date().toISOString().replace(/[:.]/g, '-') + '-' + safe;
    const path = [C.receiptsFolder || 'Job Cost Receipts', name].map(encodeURIComponent).join('/');
    const item = await graph(`/sites/${await getSiteId()}/drive/root:/${path}:/content`, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
    return { id: item.webUrl }; // the page links to the receipt with this
  } };

  /* ---------- Entry point ---------- */
  async function connect() {
    if (!configured()) return { state: 'not_configured' };
    if (!window.msal) return { state: 'error', message: 'The Microsoft sign-in library didn’t load. Reload the page.' };
    await initAuth();
    if (!account) return { state: 'signed_out', signIn: () => pca.loginRedirect({ scopes: SCOPES }) };
    const name = account.name || account.username;
    const db = makeDb();
    let timer = null;
    return {
      state: 'ready', account: { name, email: account.username }, db, downloads, assets,
      signOut: () => pca.logoutRedirect({ account, postLogoutRedirectUri: redirectUri() }),
      // Reviews and closes store the reviewer's name, so a name is all profiles() needs to return.
      user: { id: async () => name, can: async () => true, profiles: async ids => Object.fromEntries(ids.map(i => [i, { name: i }])) },
      start() {
        db.refresh();
        if (timer) return;
        timer = setInterval(() => db.refresh(), Math.max(15, C.refreshSeconds || 45) * 1000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) db.refresh(); });
      },
    };
  }
  return { connect };
})();
