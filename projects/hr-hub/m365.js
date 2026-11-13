// HR Hub: connection to Microsoft 365.
//
// The page (index.html) uses three small interfaces created here, the same shapes the
// claude.ai version used, so the rest of the page didn't change:
//   db        - documents grouped in collections. Each collection lives in one of three
//               SharePoint lists, read and written through Microsoft Graph:
//                 HR Hub Private:  people, interviews, paper, feedback       (HR only)
//                 HR Hub Tasks:    tasks                                     (owners update)
//                 HR Hub Settings: rules, messages, questions, fields,
//                                  departments, settings                     (everyone reads)
//   user      - who is signed in, and whether they are HR. HR = can open the Private list.
//   downloads - saves a file to the computer.
//
// Each list has the same columns (setup/Create-HRHubLists.ps1 makes them):
//   Title "<collection>/<id>" (unique, indexed), DocCollection, DocId, DocData (JSON, plain text)
window.HRM365 = (() => {
  'use strict';
  const C = window.HR_CONFIG || {};
  const L = C.lists || {};
  const GRAPH = 'https://graph.microsoft.com/v1.0';
  const SCOPES = ['User.Read', 'Sites.ReadWrite.All'];
  const MAX_DOC_CHARS = 60000;
  const LIST_OF = {
    people: 'private', interviews: 'private', paper: 'private', feedback: 'private',
    tasks: 'tasks',
    rules: 'settings', messages: 'settings', questions: 'settings', fields: 'settings', departments: 'settings', settings: 'settings',
  };
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

  /* ---------- Graph and one SharePoint list ---------- */
  async function graph(url, options = {}) {
    const t = await token();
    const res = await fetch(url.startsWith('http') ? url : GRAPH + url, {
      ...options, headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    if (!res.ok) {
      let detail = ''; try { detail = (await res.json()).error.message; } catch (e) { /* no body */ }
      const code = res.status === 401 || res.status === 403 ? 'not_granted' : res.status === 404 ? 'not_found' : res.status === 429 ? 'rate_limited' : 'sharepoint_error';
      throw fail(code, `SharePoint request failed (${res.status}) ${detail}`, res.status);
    }
    return res.status === 204 ? null : res.json();
  }
  let siteId = null;
  async function getSiteId() { if (!siteId) siteId = (await graph(`/sites/${C.siteHostname}:${C.sitePath}`)).id; return siteId; }
  function listBackend(listName) {
    const base = async () => `/sites/${await getSiteId()}/lists/${encodeURIComponent(listName)}`;
    const findItemId = async key => {
      const r = await graph(`${await base()}/items?expand=fields(select=Title)&$filter=fields/Title eq '${key.replace(/'/g, "''")}'`, { headers: { Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' } });
      return r.value[0] ? r.value[0].id : null;
    };
    return {
      async loadAll() {
        const out = new Map(); let url = `${await base()}/items?expand=fields(select=Title,DocData)&$top=999`;
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
        if (itemId) { await graph(`${await base()}/items/${itemId}/fields`, { method: 'PATCH', body: JSON.stringify(fields) }); return { itemId }; }
        const it = await graph(`${await base()}/items`, { method: 'POST', body: JSON.stringify({ fields }) });
        return { itemId: it.id };
      },
      async fetchOne(key, itemId) {
        if (!itemId) itemId = await findItemId(key);
        if (!itemId) return null;
        const it = await graph(`${await base()}/items/${itemId}?expand=fields(select=Title,DocData)`);
        return { itemId, data: JSON.parse((it.fields && it.fields.DocData) || '{}') };
      },
      async remove(key, itemId) {
        if (!itemId) itemId = await findItemId(key);
        if (itemId) await graph(`${await base()}/items/${itemId}`, { method: 'DELETE' });
      },
    };
  }

  /* ---------- Document store for one list, with change listeners ---------- */
  function makeStore(backend) {
    let docs = new Map(), loaded = false, writesStarted = 0, writesRunning = 0, lastError = null;
    const subs = new Set();
    const copy = v => JSON.parse(JSON.stringify(v));
    const snapOf = coll => { const p = coll + '/'; const list = [...docs.entries()].filter(([k]) => k.startsWith(p)).map(([k, d]) => ({ id: k.slice(p.length), data: () => copy(d.data) })); return { docs: list, size: list.length, empty: !list.length, metadata: { fromCache: false } }; };
    const notify = only => { for (const s of subs) if (!only || s === only) s.cb(snapOf(s.coll)); };
    async function refresh() {
      const started = writesStarted;
      try {
        const fresh = await backend.loadAll();
        if (writesRunning || writesStarted !== started) return;
        docs = fresh; loaded = true; lastError = null; notify();
      } catch (e) { lastError = e; if (!loaded) for (const s of subs) if (s.err) s.err(e); }
    }
    const writing = async fn => { writesStarted++; writesRunning++; try { return await fn(); } finally { writesRunning--; } };
    const checkSize = d => { if (JSON.stringify(d).length > MAX_DOC_CHARS) throw fail('too_large', 'This item is too large to save.'); };
    return {
      refresh, get loaded() { return loaded; }, get lastError() { return lastError; },
      subscribe(coll, cb, err) { const s = { coll, cb, err }; subs.add(s); if (loaded) notify(s); else if (lastError && err) err(lastError); return () => subs.delete(s); },
      async set(key, data) {
        checkSize(data); const prev = docs.get(key);
        docs.set(key, { data: copy(data), itemId: prev && prev.itemId }); notify();
        try { await writing(async () => { const r = await backend.put(key, data, prev && prev.itemId); const d = docs.get(key); if (d) d.itemId = r.itemId; }); }
        catch (e) { if (prev) docs.set(key, prev); else docs.delete(key); notify(); throw e; }
      },
      async update(key, patch) {
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
      async remove(key) {
        const prev = docs.get(key); docs.delete(key); notify();
        try { await writing(() => backend.remove(key, prev && prev.itemId)); }
        catch (e) { if (prev) docs.set(key, prev); notify(); throw e; }
      },
    };
  }

  /* ---------- The db interface the page uses, routing each collection to its list ---------- */
  function makeDb(stores) {
    const storeFor = coll => { const s = stores[LIST_OF[coll]]; if (!s) throw fail('not_granted', 'You don’t have access to this.'); return s; };
    const ref = path => { const [coll] = path.split('/'); return {
      set: data => storeFor(coll).set(path, data),
      update: data => storeFor(coll).update(path, data),
      delete: () => storeFor(coll).remove(path),
    }; };
    return {
      doc: ref,
      collection: name => ({
        onSnapshot(cb, err) { try { return storeFor(name).subscribe(name, cb, err); } catch (e) { if (err) err(e); return () => {}; } },
        add: async data => { const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7); await ref(name + '/' + id).set(data); return { id }; },
      }),
    };
  }

  function downloads() {
    return { async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: typeof data === 'string' ? 'text/csv;charset=utf-8' : 'application/octet-stream' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } };
  }

  /* ---------- Entry point ---------- */
  async function connect() {
    if (!configured()) return { state: 'not_configured' };
    if (!window.msal) return { state: 'error', message: 'The Microsoft sign-in library didn’t load. Reload the page.' };
    await initAuth();
    if (!account) return { state: 'signed_out', signIn: () => pca.loginRedirect({ scopes: SCOPES }) };
    const name = account.name || account.username;
    const signOut = () => pca.logoutRedirect({ account, postLogoutRedirectUri: redirectUri() });

    const settings = makeStore(listBackend(L.settings || 'HR Hub Settings'));
    const tasks = makeStore(listBackend(L.tasks || 'HR Hub Tasks'));
    const priv = makeStore(listBackend(L.private || 'HR Hub Private'));
    await Promise.all([settings.refresh(), tasks.refresh(), priv.refresh()]);
    if (!settings.loaded) {
      const e = settings.lastError || {};
      return { state: 'error', signOut, account: { name },
        message: e.code === 'not_granted' || e.code === 'not_found' ? 'Your account can’t open the HR Hub lists in SharePoint. Ask HR to give you access.' : 'The HR Hub couldn’t load from SharePoint. Check your connection and reload. (' + (e.message || 'unknown error') + ')' };
    }
    // HR = can open the Private list. Everyone else sees only My tasks.
    const isHR = priv.loaded;
    const stores = { settings, tasks }; if (isHR) stores.private = priv;
    const db = makeDb(stores);
    let timer = null;
    return {
      state: 'ready', account: { name, email: account.username }, isHR, signOut, db,
      user: { id: async () => name, canEdit: async () => isHR, can: async () => true },
      downloads: downloads(),
      start() {
        if (timer) return;
        const all = Object.values(stores);
        timer = setInterval(() => all.forEach(s => s.refresh()), Math.max(15, C.refreshSeconds || 45) * 1000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) all.forEach(s => s.refresh()); });
      },
    };
  }

  return { connect };
})();
