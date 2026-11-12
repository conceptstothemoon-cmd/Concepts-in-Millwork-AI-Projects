// CIM Quality Entry — installable PWA.
// Data goes through CIM.data (shared/data.js): demo mode = this browser, live mode = SharePoint.

let issues = [];
let selectedSev = '';
let editingItemId = null;
let currentUser = 'Ray Tilley'; // demo-mode reporter; replaced by the signed-in M365 user in live mode

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ─── Banner (errors / info) ───
function showBanner(msg, kind = 'error') {
  const b = $('banner');
  b.className = 'banner show ' + kind;
  b.innerHTML = msg;
}
function hideBanner() { $('banner').className = 'banner'; }

// ─── Dropdowns from shared/lists.js ───
function fillSelect(sel, values, placeholder) {
  sel.innerHTML = (placeholder ? `<option value="">${esc(placeholder)}</option>` : '') +
    values.map(v => `<option>${esc(v)}</option>`).join('');
}
function fillProjects() {
  const sel = $('f-project');
  const current = sel.value;
  const names = [...new Set([...CIM.DEFAULT_PROJECTS, ...issues.map(i => i.project).filter(Boolean)])].sort();
  fillSelect(sel, names, 'Select a project…');
  sel.insertAdjacentHTML('beforeend', '<option value="__add__">+ Add New Project</option>');
  if (current && current !== '__add__') sel.value = current;
}
function initDropdowns() {
  fillSelect($('f-category'), CIM.CATEGORIES, 'Select category…');
  fillSelect($('f-caught'), CIM.DEPTS, 'Select department…');
  fillSelect($('f-created'), CIM.DEPTS, 'Select department…');
  fillSelect($('f-root'), CIM.ROOT_CAUSES.filter(r => r !== 'Pending'), 'Select if known…');
  fillSelect($('f-status'), CIM.STATUSES);
  $('filter-status').insertAdjacentHTML('beforeend', CIM.STATUSES.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join(''));
  $('filter-sev').insertAdjacentHTML('beforeend', CIM.SEVERITIES.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join(''));
  fillProjects();
}

// ─── Tab navigation ───
const tabs = document.querySelectorAll('.nav-tab');
const pages = document.querySelectorAll('.page');
function showTab(name) {
  tabs.forEach(x => x.classList.toggle('active', x.dataset.tab === name));
  pages.forEach(x => x.classList.toggle('active', x.id === 'page-' + name));
}
tabs.forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));

// ─── Severity pills ───
function pickSev(el) {
  document.querySelectorAll('.sev-pill').forEach(p => p.classList.remove('selected'));
  el.classList.add('selected');
  selectedSev = el.dataset.sev;
}

// ─── Collapsible additional details ───
function setAdditional(open) {
  document.querySelector('.collapsible-toggle').setAttribute('aria-expanded', String(open));
  $('additional-details').classList.toggle('open', open);
}
function toggleAdditional(btn) { setAdditional(btn.getAttribute('aria-expanded') !== 'true'); }

// ─── Add project ───
function onProjectChange(sel) {
  const adding = sel.value === '__add__';
  $('add-project-row').classList.toggle('show', adding);
  if (adding) $('new-project-name').focus();
}
function confirmAddProject() {
  const name = $('new-project-name').value.trim();
  if (!name) return;
  const sel = $('f-project');
  const newOpt = document.createElement('option');
  newOpt.textContent = name;
  newOpt.value = name;
  sel.insertBefore(newOpt, sel.querySelector('option[value="__add__"]'));
  sel.value = name;
  $('new-project-name').value = '';
  $('add-project-row').classList.remove('show');
}
function cancelAddProject() {
  $('f-project').value = '';
  $('new-project-name').value = '';
  $('add-project-row').classList.remove('show');
}
$('new-project-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); confirmAddProject(); }
  if (e.key === 'Escape') cancelAddProject();
});

// ─── Lists ───
function renderIssueCard(iss) {
  const sc = iss.status === 'Open' ? 'open' : iss.status === 'In Progress' ? 'in-progress' : 'resolved';
  return `<div class="issue-card" onclick="openIssue(${Number(iss.itemId)})">
    <span class="sev-dot ${esc(iss.severity.toLowerCase())}" title="${esc(iss.severity)}"></span>
    <div class="issue-info">
      <div class="issue-title">${esc(iss.id)}: ${esc(iss.description)}</div>
      <div class="issue-meta">
        <span>${esc(iss.date)}</span>
        <span>${esc(iss.project)}</span>
        <span>${esc(iss.mNumber)}</span>
        <span>Caught: ${esc(iss.caught)}</span>
        <span>Created: ${esc(iss.created)}</span>
        <span>$${Number(iss.cost || 0).toLocaleString()}</span>
      </div>
    </div>
    <span class="status-badge ${sc}">${esc(iss.status)}</span>
  </div>`;
}

function filterIssues() {
  const q = document.querySelector('.search-input').value.toLowerCase();
  const st = $('filter-status').value;
  const sv = $('filter-sev').value;
  const filtered = issues.filter(iss => {
    if (st && iss.status !== st) return false;
    if (sv && iss.severity !== sv) return false;
    if (q && !(iss.id + iss.description + iss.project + iss.caught + iss.created + iss.reporter).toLowerCase().includes(q)) return false;
    return true;
  });
  $('issues-list').innerHTML = filtered.length
    ? filtered.map(renderIssueCard).join('')
    : '<div class="empty-state"><div class="empty-icon">🔍</div><p>No issues match your filters</p></div>';
}

function renderMyIssues() {
  const mine = issues.filter(i => i.reporter === currentUser);
  const count = s => mine.filter(i => i.status === s).length;
  $('my-stats').innerHTML = `
    <div class="stat-card"><div class="stat-val">${mine.length}</div><div class="stat-label">My Issues</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--critical)">${count('Open')}</div><div class="stat-label">Open</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--accent)">${count('In Progress')}</div><div class="stat-label">In Progress</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--good)">${count('Resolved')}</div><div class="stat-label">Resolved</div></div>
  `;
  $('my-issues-list').innerHTML = mine.length
    ? mine.map(renderIssueCard).join('')
    : '<div class="empty-state"><div class="empty-icon">📋</div><p>No issues reported by you yet</p></div>';
}

function renderAll() {
  issues.sort((a, b) => b.date.localeCompare(a.date) || b.itemId - a.itemId);
  fillProjects();
  filterIssues();
  renderMyIssues();
}

async function loadIssues() {
  try {
    issues = await CIM.data.getIssues();
    renderAll();
  } catch (e) {
    showBanner('Could not load issues: ' + esc(e.message));
  }
}

// ─── Submit / edit ───
function readForm() {
  return {
    project: $('f-project').value,
    date: $('f-date').value,
    category: $('f-category').value,
    description: $('f-desc').value.trim(),
    severity: selectedSev ? selectedSev.charAt(0).toUpperCase() + selectedSev.slice(1) : '',
    caught: $('f-caught').value,
    created: $('f-created').value,
    mNumber: $('f-mnumber').value.trim(),
    rootCause: $('f-root').value || 'Pending',
    correctiveAction: $('f-action').value.trim(),
    cost: parseFloat($('f-cost').value) || 0,
  };
}

async function submitIssue() {
  const f = readForm();
  if (!f.project || f.project === '__add__' || !f.date || !f.category || !f.description || !f.severity || !f.caught || !f.created) {
    alert('Please fill in all required fields.');
    return;
  }
  if (!navigator.onLine) {
    showBanner('You are offline. Reconnect to submit — your entries are still in the form.');
    return;
  }
  const btn = $('form-submit-btn');
  btn.disabled = true;
  hideBanner();
  try {
    if (editingItemId) {
      const existing = issues.find(i => i.itemId === editingItemId);
      const updated = await CIM.data.updateIssue(editingItemId, { ...existing, ...f, status: $('f-status').value });
      issues = issues.map(i => (i.itemId === editingItemId ? { ...i, ...updated } : i));
      $('modal-title').textContent = 'Changes Saved';
    } else {
      const created = await CIM.data.createIssue({ ...f, reporter: currentUser, status: 'Open' });
      issues.push(created);
      $('modal-title').textContent = 'Issue Submitted — ' + created.id;
    }
    renderAll();
    $('successModal').classList.add('show');
  } catch (e) {
    showBanner('Could not save: ' + esc(e.message) + '. Your entries are still in the form.');
  } finally {
    btn.disabled = false;
  }
}

function closeModal() {
  $('successModal').classList.remove('show');
  resetForm();
}

function openIssue(itemId) {
  const iss = issues.find(i => i.itemId === itemId);
  if (!iss) return;
  editingItemId = itemId;
  showTab('new');
  $('form-heading').textContent = 'Edit Issue — ' + iss.id;
  $('form-subtitle').innerHTML = 'Viewing issue <strong>' + esc(iss.id) + '</strong>. Modify fields and save, or clear to start a new issue.';
  $('form-submit-btn').textContent = 'Save Changes';
  const projSel = $('f-project');
  if (![...projSel.options].some(o => o.value === iss.project)) {
    const newOpt = document.createElement('option');
    newOpt.textContent = iss.project; newOpt.value = iss.project;
    projSel.insertBefore(newOpt, projSel.querySelector('option[value="__add__"]'));
  }
  projSel.value = iss.project;
  $('f-date').value = iss.date;
  $('f-category').value = iss.category;
  $('f-desc').value = iss.description;
  $('f-caught').value = iss.caught;
  $('f-created').value = iss.created;
  $('f-mnumber').value = iss.mNumber || '';
  $('f-root').value = iss.rootCause === 'Pending' ? '' : iss.rootCause;
  $('f-action').value = iss.correctiveAction || '';
  $('f-cost').value = iss.cost || '';
  $('f-reporter').value = iss.reporter;
  $('f-status').value = iss.status;
  $('status-row').classList.add('show');
  setAdditional(true);
  const sevKey = iss.severity.toLowerCase();
  document.querySelectorAll('.sev-pill').forEach(p => p.classList.toggle('selected', p.dataset.sev === sevKey));
  selectedSev = sevKey;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  editingItemId = null;
  $('issueForm').reset();
  document.querySelectorAll('.sev-pill').forEach(p => p.classList.remove('selected'));
  selectedSev = '';
  // Local date (valueAsDate would use the UTC date, which is tomorrow during US evenings)
  const now = new Date();
  $('f-date').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  $('form-heading').textContent = 'Report Quality Issue';
  $('form-subtitle').innerHTML = 'Submit a new quality issue to the SharePoint Quality Issues list. All required fields marked with <span style="color:var(--critical)">*</span>';
  $('form-submit-btn').textContent = 'Submit Issue';
  $('add-project-row').classList.remove('show');
  $('status-row').classList.remove('show');
  $('f-reporter').value = currentUser;
  setAdditional(false);
}

// ─── Startup ───
async function start() {
  initDropdowns();
  resetForm();
  const authBtn = $('auth-btn');

  if (!CIM.isLiveMode()) {
    $('mode-badge').hidden = false;
    showBanner('Demo mode — sample data saved in this browser only. Fill in <code>shared/config.js</code> to connect to SharePoint.', 'info');
    await loadIssues();
    return;
  }

  try {
    await CIM.auth.init();
  } catch (e) {
    showBanner('Sign-in error: ' + esc(e.message));
  }
  const user = CIM.auth.user;
  authBtn.hidden = false;
  if (!user) {
    authBtn.textContent = 'Sign in';
    authBtn.onclick = () => CIM.auth.signIn();
    showBanner('Sign in with your CIM Microsoft 365 account to report and view issues.', 'info');
    return;
  }
  currentUser = user.name;
  $('f-reporter').value = currentUser;
  $('user-name').textContent = user.name;
  authBtn.textContent = 'Sign out';
  authBtn.onclick = () => CIM.auth.signOut();
  await loadIssues();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* app still works without offline cache */ });
}
start();
