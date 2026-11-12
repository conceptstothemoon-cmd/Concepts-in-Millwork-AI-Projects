// Data access for both pages.
//   Demo mode: issues live in this browser's localStorage, seeded with sample data.
//   Live mode: issues live in the SharePoint list, read/written through Microsoft Graph.
//
// Issue shape used by the pages:
//   { id, itemId, date:'YYYY-MM-DD', project, category, description, severity, caught, created,
//     rootCause, correctiveAction, cost, reporter, status, mNumber }
window.CIM = window.CIM || {};

CIM.data = (() => {
  const DEMO_KEY = 'cim-quality-demo-issues';
  const GRAPH = 'https://graph.microsoft.com/v1.0';
  const idFor = itemId => 'QI-' + (1000 + Number(itemId));

  // ─── Demo mode (localStorage) ───
  const demo = {
    load() {
      try {
        const saved = JSON.parse(localStorage.getItem(DEMO_KEY));
        if (Array.isArray(saved)) return saved;
      } catch (e) { /* fall through to seed */ }
      const seeded = CIM.generateSampleIssues();
      demo.save(seeded);
      return seeded;
    },
    save(issues) {
      try { localStorage.setItem(DEMO_KEY, JSON.stringify(issues)); } catch (e) { /* storage blocked: data lasts until reload */ }
    },
    async getIssues() { return demo.load(); },
    async createIssue(fields) {
      const issues = demo.load();
      const itemId = Math.max(0, ...issues.map(i => i.itemId)) + 1;
      const issue = { ...fields, itemId, id: idFor(itemId) };
      issues.push(issue);
      demo.save(issues);
      return issue;
    },
    async updateIssue(itemId, fields) {
      const issues = demo.load();
      const idx = issues.findIndex(i => i.itemId === itemId);
      if (idx === -1) throw new Error('Issue not found');
      issues[idx] = { ...issues[idx], ...fields };
      demo.save(issues);
      return issues[idx];
    },
  };

  // ─── Live mode (SharePoint via Microsoft Graph) ───
  // SharePoint column internal names ↔ page field names. Must match setup/Create-QualityList.ps1.
  const toFields = i => ({
    Title: (i.description || '').slice(0, 255),
    Project: i.project,
    // Noon UTC keeps the date-only column on the same calendar day in any US time zone.
    DateReported: i.date ? i.date + 'T12:00:00Z' : null,
    MNumber: i.mNumber || '',
    Category: i.category,
    IssueDescription: i.description,
    Severity: i.severity,
    CaughtBy: i.caught,
    CreatedByDept: i.created,
    ReportedBy: i.reporter,
    RootCause: i.rootCause || 'Pending',
    CorrectiveAction: i.correctiveAction || '',
    CostImpact: Number(i.cost) || 0,
    Status: i.status || 'Open',
  });
  const fromItem = item => {
    const f = item.fields || {};
    return {
      itemId: Number(item.id),
      id: idFor(item.id),
      date: (f.DateReported || f.Created || '').slice(0, 10),
      project: f.Project || '',
      category: f.Category || '',
      description: f.IssueDescription || f.Title || '',
      severity: f.Severity || 'Low',
      caught: f.CaughtBy || '',
      created: f.CreatedByDept || '',
      reporter: f.ReportedBy || '',
      rootCause: f.RootCause || 'Pending',
      correctiveAction: f.CorrectiveAction || '',
      cost: Number(f.CostImpact) || 0,
      status: f.Status || 'Open',
      mNumber: f.MNumber || '',
    };
  };

  let listUrl = null;
  async function graph(url, options = {}) {
    const token = await CIM.auth.getToken();
    const res = await fetch(url.startsWith('http') ? url : GRAPH + url, {
      ...options,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).error.message; } catch (e) { /* no JSON body */ }
      throw new Error(`SharePoint request failed (${res.status}) ${detail}`);
    }
    return res.status === 204 ? null : res.json();
  }
  async function getListUrl() {
    if (listUrl) return listUrl;
    const site = await graph(`/sites/${CIM_CONFIG.siteHostname}:${CIM_CONFIG.sitePath}`);
    listUrl = `/sites/${site.id}/lists/${encodeURIComponent(CIM_CONFIG.listName)}`;
    return listUrl;
  }

  const live = {
    async getIssues() {
      const base = await getListUrl();
      let url = `${base}/items?expand=fields&$top=999`;
      const out = [];
      while (url) {
        const page = await graph(url);
        out.push(...page.value.map(fromItem));
        url = page['@odata.nextLink'] || null;
      }
      return out;
    },
    async createIssue(fields) {
      const base = await getListUrl();
      const item = await graph(`${base}/items`, { method: 'POST', body: JSON.stringify({ fields: toFields(fields) }) });
      return fromItem(item);
    },
    async updateIssue(itemId, fields) {
      const base = await getListUrl();
      await graph(`${base}/items/${itemId}/fields`, { method: 'PATCH', body: JSON.stringify(toFields(fields)) });
      return { ...fields, itemId, id: idFor(itemId) };
    },
  };

  const impl = () => (CIM.isLiveMode() ? live : demo);
  return {
    getIssues: () => impl().getIssues(),
    createIssue: f => impl().createIssue(f),
    updateIssue: (itemId, f) => impl().updateIssue(itemId, f),
    resetDemo() { try { localStorage.removeItem(DEMO_KEY); } catch (e) { /* ignore */ } },
  };
})();
