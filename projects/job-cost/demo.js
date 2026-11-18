// Job Cost Pilot: offline demo mode.
//
// Used only when the page is opened straight from a file (file://) or with ?demo=1 in the address.
// The normal site (https:// or http://localhost) never loads this mode and keeps using Microsoft 365.
//
// It gives the page the same interfaces as m365.js (db, user, downloads, assets), but everything is
// saved in this browser's localStorage. Nothing is shared and nothing reaches SharePoint.
// It starts empty: load job-cost-setup.json or job-cost-demo.json from the setup panel. Those files
// list customer jobs and installers' names, so they are never stored in this repository.
window.JCDemo = (() => {
  'use strict';
  const KEY = 'jcDemo:v1';
  const isDemo = () => location.protocol === 'file:' || /[?&]demo=1(&|$)/.test(location.search);

  let docs = new Map(), storageOk = true;
  try { const raw = localStorage.getItem(KEY); if (raw) docs = new Map(Object.entries(JSON.parse(raw))); }
  catch (e) { storageOk = false; }
  const persist = () => {
    if (!storageOk) return;
    try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(docs))); }
    catch (e) { storageOk = false; }
  };

  const subs = new Set();
  const copy = v => JSON.parse(JSON.stringify(v));
  const collSnap = coll => { const p = coll + '/'; const list = [...docs.entries()].filter(([k]) => k.startsWith(p)).map(([k, d]) => ({ id: k.slice(p.length), data: () => copy(d) })); return { docs: list, size: list.length, empty: !list.length }; };
  const docSnap = key => { const d = docs.get(key); return { id: key.split('/').pop(), exists: d !== undefined, data: () => (d !== undefined ? copy(d) : undefined) }; };
  const notify = only => { for (const s of subs) if (!only || s === only) s.cb(s.coll ? collSnap(s.coll) : docSnap(s.key)); };
  const subscribe = s => { subs.add(s); setTimeout(() => notify(s), 0); return () => subs.delete(s); };

  const db = {
    doc: key => ({
      async get() { return docSnap(key); },
      async set(data) { docs.set(key, copy(data)); persist(); notify(); },
      async update(patch) { docs.set(key, { ...(docs.get(key) || {}), ...copy(patch) }); persist(); notify(); },
      async delete() { docs.delete(key); persist(); notify(); },
      onSnapshot: (cb, err) => subscribe({ key, cb, err }),
    }),
    collection: name => ({ onSnapshot: (cb, err) => subscribe({ coll: name, cb, err }) }),
  };

  const downloads = { async save({ filename, data }) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: typeof data === 'string' ? 'text/csv;charset=utf-8' : 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } };
  // Receipt photos aren't kept in the demo; the trip still records the parking amount.
  const assets = { async upload() { return { id: '' }; } };

  function reset() {
    docs = new Map();
    try { localStorage.removeItem(KEY); } catch (e) { /* storage blocked */ }
    location.reload();
  }

  async function connect() {
    const name = 'Demo user';
    return {
      state: 'ready', demo: true, storageOk, account: { name, email: '' }, db, downloads, assets,
      signOut: reset, // the header button reads "Reset demo" in this mode
      user: { id: async () => name, can: async () => true, profiles: async ids => Object.fromEntries(ids.map(i => [i, { name: i }])) },
      start() {},
    };
  }
  return { isDemo, connect, reset };
})();
