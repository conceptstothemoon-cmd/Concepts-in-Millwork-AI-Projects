// Bid Screener: connection to Microsoft 365 and Claude.
//
// The page (index.html) talks to three small interfaces, created here:
//   db     - shared documents grouped in collections (gcs, invites, decisions, feedback,
//            estimates, estrows, settings). Live mode: one SharePoint list, read and written
//            through Microsoft Graph. Demo mode: this browser's localStorage, seeded with
//            made-up examples from sample-data.js.
//   user   - who is signed in.
//   sample - asks Claude, through the Azure Function in api/. Only in live mode, and only
//            when BS_CONFIG.claudeEndpoint is filled in.
//
// SharePoint list columns (setup/Create-BidScreenerList.ps1 makes them):
//   Title          "<collection>/<id>", unique, indexed: the document's key
//   DocCollection  collection name
//   DocId          id inside the collection
//   DocData        the document as JSON (plain multi-line text)
window.BS = (() => {
  'use strict';
  const C = window.BS_CONFIG || {};
  const GRAPH = 'https://graph.microsoft.com/v1.0';
  const GRAPH_SCOPES = ['User.Read', 'Sites.ReadWrite.All'];
  const DEMO_KEY = 'bid-screener-demo-v1';
  const MAX_DOC_CHARS = 60000; // stays under SharePoint's limit for a multi-line text column

  const isLive = () => Boolean(C.clientId);
  const aiOn = () => isLive() && Boolean(C.claudeEndpoint);
  const apiScope = () => `api://${C.clientId}/access_as_user`;
  const fail = (code, message) => Object.assign(new Error(message || code), { code });

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
    if (!account) throw fail('not_granted', 'Not signed in');
    try {
      return (await pca.acquireTokenSilent({ scopes, account })).accessToken;
    } catch (e) {
      if (e instanceof msal.InteractionRequiredAuthError) await pca.acquireTokenRedirect({ scopes, account });
      throw e;
    }
  }
  const signIn = () => pca.loginRedirect({ scopes: GRAPH_SCOPES, extraScopesToConsent: aiOn() ? [apiScope()] : [] });
  const signOut = () => pca.logoutRedirect({ account, postLogoutRedirectUri: redirectUri() });

  /* ---------- Storage back ends: each returns Map(key -> data) and writes one key ---------- */
  const demoBackend = {
    read() {
      try { const saved = JSON.parse(localStorage.getItem(DEMO_KEY)); if (saved && typeof saved === 'object') return saved; } catch (e) { /* seed below */ }
      const seeded = window.BS_SAMPLE ? window.BS_SAMPLE() : {};
      this.write(seeded);
      return seeded;
    },
    write(all) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(all)); } catch (e) { /* storage blocked: lasts until reload */ } },
    async loadAll() { return new Map(Object.entries(this.read()).map(([k, v]) => [k, { data: v }])); },
    async put(key, data) { const all = this.read(); all[key] = data; this.write(all); return {}; },
    async remove(key) { const all = this.read(); delete all[key]; this.write(all); },
  };

  let listUrl = null;
  async function graph(url, options = {}) {
    const t = await token(GRAPH_SCOPES);
    const res = await fetch(url.startsWith('http') ? url : GRAPH + url, {
      ...options,
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).error.message; } catch (e) { /* no JSON body */ }
      throw fail(res.status === 401 || res.status === 403 ? 'not_granted' : res.status === 429 ? 'rate_limited' : 'sharepoint_' + res.status, `SharePoint request failed (${res.status}) ${detail}`);
    }
    return res.status === 204 ? null : res.json();
  }
  async function getListUrl() {
    if (listUrl) return listUrl;
    const site = await graph(`/sites/${C.siteHostname}:${C.sitePath}`);
    listUrl = `/sites/${site.id}/lists/${encodeURIComponent(C.listName || 'Bid Screener Data')}`;
    return listUrl;
  }
  const spBackend = {
    async loadAll() {
      const base = await getListUrl(); const out = new Map();
      let url = `${base}/items?expand=fields(select=Title,DocData)&$top=999`;
      while (url) {
        const page = await graph(url);
        for (const it of page.value) {
          const f = it.fields || {}; if (!f.Title) continue;
          try { out.set(f.Title, { data: JSON.parse(f.DocData || '{}'), itemId: it.id }); } catch (e) { /* skip a damaged row */ }
        }
        url = page['@odata.nextLink'] || null;
      }
      return out;
    },
    async findItemId(key) {
      const base = await getListUrl();
      const q = `${base}/items?expand=fields(select=Title)&$filter=fields/Title eq '${key.replace(/'/g, "''")}'`;
      const r = await graph(q, { headers: { Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' } });
      return r.value[0] ? r.value[0].id : null;
    },
    async put(key, data, itemId) {
      const base = await getListUrl(); const [coll, ...rest] = key.split('/');
      const fields = { Title: key, DocCollection: coll, DocId: rest.join('/'), DocData: JSON.stringify(data) };
      if (!itemId) itemId = await this.findItemId(key);
      if (itemId) { await graph(`${base}/items/${itemId}/fields`, { method: 'PATCH', body: JSON.stringify(fields) }); return { itemId }; }
      const it = await graph(`${base}/items`, { method: 'POST', body: JSON.stringify({ fields }) });
      return { itemId: it.id };
    },
    async fetchOne(key, itemId) {
      const base = await getListUrl();
      if (!itemId) itemId = await this.findItemId(key);
      if (!itemId) return null;
      const it = await graph(`${base}/items/${itemId}?expand=fields(select=Title,DocData)`);
      return { itemId, data: JSON.parse((it.fields && it.fields.DocData) || '{}') };
    },
    async remove(key, itemId) {
      const base = await getListUrl();
      if (!itemId) itemId = await this.findItemId(key);
      if (itemId) await graph(`${base}/items/${itemId}`, { method: 'DELETE' });
    },
  };

  /* ---------- Shared document store with change listeners (same shape for both back ends) ---------- */
  function makeDb(backend, live) {
    let docs = new Map();           // key -> {data, itemId}
    const subs = new Set();         // {coll | key, cb, err}
    let writesStarted = 0, writesRunning = 0, loaded = false;
    const copy = v => JSON.parse(JSON.stringify(v));
    const notify = (only) => {
      for (const s of subs) {
        if (only && s.err !== only) continue;
        if (s.coll) {
          const prefix = s.coll + '/';
          const list = [...docs.entries()].filter(([k]) => k.startsWith(prefix)).map(([k, d]) => ({ id: k.slice(prefix.length), data: () => copy(d.data) }));
          s.cb({ docs: list, size: list.length, empty: !list.length });
        } else {
          const d = docs.get(s.key);
          s.cb({ id: s.key.split('/').pop(), exists: Boolean(d), data: () => (d ? copy(d.data) : undefined) });
        }
      }
    };
    const fails = (e) => { for (const s of subs) if (s.err) s.err(e); };
    async function refresh() {
      const startedAt = writesStarted;
      try {
        const fresh = await backend.loadAll();
        if (writesRunning || writesStarted !== startedAt) return; // a write happened meanwhile; next refresh picks it up
        docs = fresh; loaded = true; notify();
      } catch (e) { if (!loaded) fails(e); else console.warn('Refresh failed', e); }
    }
    async function writing(fn) {
      writesStarted++; writesRunning++;
      try { return await fn(); } finally { writesRunning--; }
    }
    const checkSize = (data) => { if (JSON.stringify(data).length > MAX_DOC_CHARS) throw fail('too_large', 'This item is too large to save.'); };
    function docRef(key) {
      return {
        async set(data) {
          checkSize(data); const prev = docs.get(key);
          docs.set(key, { data: copy(data), itemId: prev && prev.itemId }); notify();
          await writing(async () => { const r = await backend.put(key, data, prev && prev.itemId); const d = docs.get(key); if (d && r.itemId) d.itemId = r.itemId; });
        },
        async update(patch) {
          const prev = docs.get(key);
          docs.set(key, { data: { ...(prev ? prev.data : {}), ...copy(patch) }, itemId: prev && prev.itemId }); notify();
          await writing(async () => {
            // Merge into the latest saved copy so a teammate's change to another field isn't lost.
            const latest = live ? await backend.fetchOne(key, prev && prev.itemId) : null;
            const merged = { ...(latest ? latest.data : prev ? prev.data : {}), ...patch };
            checkSize(merged);
            const r = await backend.put(key, merged, latest ? latest.itemId : prev && prev.itemId);
            docs.set(key, { data: merged, itemId: r.itemId || (latest && latest.itemId) }); notify();
          });
        },
        async delete() {
          const prev = docs.get(key); docs.delete(key); notify();
          await writing(() => backend.remove(key, prev && prev.itemId));
        },
        onSnapshot(cb, err) { const s = { key, cb, err }; subs.add(s); if (loaded) notify(err); return () => subs.delete(s); },
      };
    }
    let timer = null;
    return {
      ready: refresh,
      startPolling(seconds) {
        if (timer || !live) return;
        timer = setInterval(refresh, Math.max(15, seconds || 45) * 1000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
      },
      doc: (path) => docRef(path),
      collection(name) {
        return {
          onSnapshot(cb, err) { const s = { coll: name, cb, err }; subs.add(s); if (loaded) notify(err); return () => subs.delete(s); },
          async add(data) { const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7); await docRef(name + '/' + id).set(data); return { id }; },
        };
      },
    };
  }

  /* ---------- Claude, through the Azure Function ---------- */
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
      let msg = ''; try { msg = (await res.json()).error || ''; } catch (e) { /* no JSON body */ }
      const code = { 401: 'not_granted', 403: 'not_granted', 413: 'prompt_too_large', 429: 'rate_limited' }[res.status] || 'server_error';
      throw fail(code, msg || `Claude service error (${res.status})`);
    }
    return res.json();
  }
  const textOf = msg => (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
  function makeSample() {
    // sample(input, {tools, signal, onText, effort}) runs Claude's tool loop here in the browser,
    // because the tools read the GC list, invites and estimates already loaded on this page.
    async function sample(input, opts = {}) {
      const tools = opts.tools || [];
      const defs = tools.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema || { type: 'object', properties: {} } }));
      const messages = [{ role: 'user', content: String(input) }];
      for (let turn = 0; turn < 12; turn++) {
        const msg = await callClaude({ messages, tools: defs.length ? defs : undefined, effort: opts.effort || 'medium' }, opts.signal);
        if (msg.stop_reason === 'refusal') throw fail('refused', 'Claude declined to answer this one.');
        // Send Claude's whole reply back unchanged on the next turn (its thinking blocks included).
        messages.push({ role: 'assistant', content: msg.content });
        const uses = (msg.content || []).filter(b => b.type === 'tool_use');
        if (msg.stop_reason !== 'tool_use' || !uses.length) {
          const text = textOf(msg) || 'No answer came back. Try asking again.';
          if (opts.onText) opts.onText({ text });
          return { text };
        }
        const results = [];
        for (const u of uses) {
          const tool = tools.find(t => t.name === u.name);
          try {
            if (!tool) throw new Error('Unknown tool ' + u.name);
            results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(await tool.execute(u.input || {})) });
          } catch (e) {
            results.push({ type: 'tool_result', tool_use_id: u.id, content: String((e && e.message) || e), is_error: true });
          }
        }
        messages.push({ role: 'user', content: results }); // all results in one message
      }
      throw fail('server_error', 'Claude took too many steps on this question.');
    }
    sample.json = async (prompt, opts = {}) => {
      const msg = await callClaude({ messages: [{ role: 'user', content: String(prompt) }], effort: opts.effort || 'low' }, opts.signal);
      if (msg.stop_reason === 'refusal') throw fail('refused');
      const t = textOf(msg); const a = t.indexOf('{'), b = t.lastIndexOf('}');
      if (a < 0 || b < a) throw fail('invalid_json');
      try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { throw fail('invalid_json'); }
    };
    sample.limits = async () => ({ tools: true });
    return sample;
  }

  /* ---------- Entry point used by the page ---------- */
  async function connect() {
    if (!isLive()) {
      const db = makeDb(demoBackend, false);
      await db.ready();
      return { mode: 'demo', signedIn: false, db, sample: null,
        user: { id: async () => 'You (demo)', profiles: async ids => Object.fromEntries(ids.map(i => [i, { name: i }])) },
        resetDemo() { try { localStorage.removeItem(DEMO_KEY); } catch (e) { /* ignore */ } location.reload(); } };
    }
    if (!window.msal) throw fail('setup', 'The Microsoft sign-in library didn’t load.');
    await initAuth();
    if (!account) return { mode: 'live', signedIn: false, db: null, sample: null, user: null, signIn };
    const name = account.name || account.username;
    const db = makeDb(spBackend, true);
    return {
      mode: 'live', signedIn: true, account: { name, email: account.username }, db, signIn, signOut,
      sample: aiOn() ? makeSample() : null,
      user: { id: async () => name, profiles: async ids => Object.fromEntries(ids.map(i => [i, { name: i }])) },
      start() { db.ready(); db.startPolling(C.refreshSeconds); },
    };
  }

  return { connect, isLive, aiOn };
})();
