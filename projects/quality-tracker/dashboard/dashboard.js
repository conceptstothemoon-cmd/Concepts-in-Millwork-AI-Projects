// CIM Quality Dashboard.
// Data comes from CIM.data (shared/data.js): demo mode = this browser, live mode = SharePoint.
// Chart drawing helpers below are unchanged from the original mock-up, except bars can carry their own color.

let issues = [];

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ─── Navigation ───
document.getElementById('nav').addEventListener('click', e => {
  if (e.target.tagName !== 'BUTTON') return;
  document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + e.target.dataset.page).classList.add('active');
  renderAll(); // charts size themselves to their container, which is 0 wide while hidden
});

// ─── Tooltip ───
const ttEl = document.getElementById('tooltip');
function showTooltip(html, x, y) {
  ttEl.innerHTML = html;
  ttEl.style.display = 'block';
  const r = ttEl.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  ttEl.style.left = Math.min(x + 12, vw - r.width - 8) + 'px';
  ttEl.style.top = Math.min(y - 8, vh - r.height - 8) + 'px';
}
function hideTooltip() { ttEl.style.display = 'none'; }

// ─── Chart Helpers ───
function getCS(prop) { return getComputedStyle(document.documentElement).getPropertyValue(prop).trim(); }

function drawBarChart(container, data, {barColor, height=220, showCumLine=false, cumColor, maxVal, yLabel='Count'} = {}) {
  const el = typeof container === 'string' ? document.getElementById(container) : container;
  el.innerHTML = '';
  if (!data.length) return;

  const ml = 44, mr = showCumLine ? 40 : 16, mt = 12, mb = 60;
  const w = el.clientWidth || 400, h = height;
  const pw = w - ml - mr, ph = h - mt - mb;

  const max = maxVal || Math.max(...data.map(d=>d.value)) * 1.15;
  const barW = Math.min(24, (pw / data.length) * 0.65);
  const gap = (pw - barW * data.length) / (data.length + 1);

  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', h);
  svg.style.overflow = 'visible';

  // Grid
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const y = mt + ph - (ph * i / steps);
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    Object.entries({x1:ml,x2:w-mr,y1:y,y2:y}).forEach(([k,v])=>line.setAttribute(k,v));
    line.setAttribute('class','grid-line');
    svg.appendChild(line);
    const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
    txt.setAttribute('x', ml - 6); txt.setAttribute('y', y + 4);
    txt.setAttribute('text-anchor','end'); txt.setAttribute('class','axis-label-v');
    txt.textContent = Math.round(max * i / steps);
    svg.appendChild(txt);
  }

  // Baseline
  const bl = document.createElementNS('http://www.w3.org/2000/svg','line');
  Object.entries({x1:ml,x2:w-mr,y1:mt+ph,y2:mt+ph}).forEach(([k,v])=>bl.setAttribute(k,v));
  bl.setAttribute('class','axis-line');
  svg.appendChild(bl);

  // Bars
  data.forEach((d, i) => {
    const x = ml + gap + i * (barW + gap);
    const bh = (d.value / max) * ph;
    const y = mt + ph - bh;
    const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
    rect.setAttribute('x', x); rect.setAttribute('y', y);
    rect.setAttribute('width', barW); rect.setAttribute('height', Math.max(bh, 0));
    rect.setAttribute('rx', 4); rect.setAttribute('fill', d.color || barColor || getCS('--s1'));
    // Square bottom
    if (bh > 8) {
      const rectBot = document.createElementNS('http://www.w3.org/2000/svg','rect');
      rectBot.setAttribute('x', x); rectBot.setAttribute('y', y + bh - 4);
      rectBot.setAttribute('width', barW); rectBot.setAttribute('height', 4);
      rectBot.setAttribute('fill', d.color || barColor || getCS('--s1'));
      svg.appendChild(rectBot);
    }
    svg.appendChild(rect);

    // Hit target
    const hit = document.createElementNS('http://www.w3.org/2000/svg','rect');
    hit.setAttribute('x', x - 4); hit.setAttribute('y', mt);
    hit.setAttribute('width', barW + 8); hit.setAttribute('height', ph);
    hit.setAttribute('fill', 'transparent'); hit.style.cursor = 'pointer';
    hit.addEventListener('pointerenter', ev => {
      rect.style.opacity = '0.8';
      let html = `<div class="tt-label">${d.label}</div><div class="tt-value">${d.value}</div>`;
      if (d.cumPct !== undefined) html += `<div style="color:var(--ink-muted);font-size:11px">Cumulative: ${d.cumPct}%</div>`;
      showTooltip(html, ev.clientX, ev.clientY);
    });
    hit.addEventListener('pointermove', ev => {
      let html = `<div class="tt-label">${d.label}</div><div class="tt-value">${d.value}</div>`;
      if (d.cumPct !== undefined) html += `<div style="color:var(--ink-muted);font-size:11px">Cumulative: ${d.cumPct}%</div>`;
      showTooltip(html, ev.clientX, ev.clientY);
    });
    hit.addEventListener('pointerleave', () => { rect.style.opacity = '1'; hideTooltip(); });
    svg.appendChild(hit);

    // X label
    const lbl = document.createElementNS('http://www.w3.org/2000/svg','text');
    lbl.setAttribute('x', x + barW/2); lbl.setAttribute('y', mt + ph + 14);
    lbl.setAttribute('text-anchor','end'); lbl.setAttribute('class','axis-label');
    lbl.setAttribute('transform', `rotate(-40, ${x+barW/2}, ${mt+ph+14})`);
    lbl.textContent = d.label.length > 14 ? d.label.slice(0,12)+'…' : d.label;
    svg.appendChild(lbl);
  });

  // Cumulative line
  if (showCumLine && data.some(d => d.cumPct !== undefined)) {
    const pts = data.map((d, i) => {
      const x = ml + gap + i * (barW + gap) + barW / 2;
      const y = mt + ph - (d.cumPct / 100) * ph;
      return `${x},${y}`;
    });
    const polyline = document.createElementNS('http://www.w3.org/2000/svg','polyline');
    polyline.setAttribute('points', pts.join(' '));
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', cumColor || getCS('--cumline'));
    polyline.setAttribute('stroke-width', '2');
    polyline.setAttribute('stroke-linejoin', 'round');
    polyline.setAttribute('stroke-linecap', 'round');
    svg.appendChild(polyline);

    // Dots
    data.forEach((d, i) => {
      const x = ml + gap + i * (barW + gap) + barW / 2;
      const y = mt + ph - (d.cumPct / 100) * ph;
      const ring = document.createElementNS('http://www.w3.org/2000/svg','circle');
      ring.setAttribute('cx', x); ring.setAttribute('cy', y); ring.setAttribute('r', 6);
      ring.setAttribute('fill', getCS('--surface'));
      svg.appendChild(ring);
      const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
      dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', 4);
      dot.setAttribute('fill', cumColor || getCS('--cumline'));
      svg.appendChild(dot);
    });

    // Right-side % axis
    for (let i = 0; i <= 4; i++) {
      const y = mt + ph - (ph * i / 4);
      const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
      txt.setAttribute('x', w - mr + 6); txt.setAttribute('y', y + 4);
      txt.setAttribute('text-anchor','start'); txt.setAttribute('class','axis-label-v');
      txt.textContent = (25 * i) + '%';
      svg.appendChild(txt);
    }
  }

  el.appendChild(svg);
}

function drawHorizBarChart(container, data, {barColor, height=280} = {}) {
  const el = typeof container === 'string' ? document.getElementById(container) : container;
  el.innerHTML = '';
  if (!data.length) return;
  const sorted = [...data].sort((a,b) => b.value - a.value);
  const ml = 120, mr = 50, mt = 8, mb = 8;
  const w = el.clientWidth || 400;
  const barH = 20, gap = 6;
  const h = mt + mb + sorted.length * (barH + gap);
  const pw = w - ml - mr;
  const max = Math.max(...sorted.map(d => d.value)) * 1.15;

  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', h);

  sorted.forEach((d, i) => {
    const y = mt + i * (barH + gap);
    const bw = (d.value / max) * pw;
    // Label
    const lbl = document.createElementNS('http://www.w3.org/2000/svg','text');
    lbl.setAttribute('x', ml - 8); lbl.setAttribute('y', y + barH/2 + 4);
    lbl.setAttribute('text-anchor','end'); lbl.setAttribute('class','axis-label');
    lbl.textContent = d.label.length > 18 ? d.label.slice(0,16)+'…' : d.label;
    svg.appendChild(lbl);
    // Bar
    const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
    rect.setAttribute('x', ml); rect.setAttribute('y', y);
    rect.setAttribute('width', Math.max(bw, 0)); rect.setAttribute('height', barH);
    rect.setAttribute('rx', 4); rect.setAttribute('fill', barColor || getCS('--s1'));
    // Square left
    if (bw > 8) {
      const rectL = document.createElementNS('http://www.w3.org/2000/svg','rect');
      rectL.setAttribute('x', ml); rectL.setAttribute('y', y);
      rectL.setAttribute('width', 4); rectL.setAttribute('height', barH);
      rectL.setAttribute('fill', barColor || getCS('--s1'));
      svg.appendChild(rectL);
    }
    svg.appendChild(rect);
    // Value label
    const val = document.createElementNS('http://www.w3.org/2000/svg','text');
    val.setAttribute('x', ml + bw + 6); val.setAttribute('y', y + barH/2 + 4);
    val.setAttribute('text-anchor','start'); val.setAttribute('class','axis-label-v');
    val.style.fontWeight = '600';
    val.textContent = d.value;
    svg.appendChild(val);
    // Hit
    const hit = document.createElementNS('http://www.w3.org/2000/svg','rect');
    hit.setAttribute('x', ml); hit.setAttribute('y', y);
    hit.setAttribute('width', pw); hit.setAttribute('height', barH);
    hit.setAttribute('fill','transparent'); hit.style.cursor = 'pointer';
    hit.addEventListener('pointerenter', ev => {
      rect.style.opacity = '0.8';
      showTooltip(`<div class="tt-label">${d.label}</div><div class="tt-value">${d.value}</div>`, ev.clientX, ev.clientY);
    });
    hit.addEventListener('pointermove', ev => {
      showTooltip(`<div class="tt-label">${d.label}</div><div class="tt-value">${d.value}</div>`, ev.clientX, ev.clientY);
    });
    hit.addEventListener('pointerleave', () => { rect.style.opacity='1'; hideTooltip(); });
    svg.appendChild(hit);
  });

  el.appendChild(svg);
}

function drawLineChart(container, seriesData, {labels, height=220, colors} = {}) {
  const el = typeof container === 'string' ? document.getElementById(container) : container;
  el.innerHTML = '';
  const ml = 44, mr = 16, mt = 12, mb = 32;
  const w = el.clientWidth || 400, h = height;
  const pw = w - ml - mr, ph = h - mt - mb;
  const allVals = seriesData.flatMap(s => s.values);
  const max = Math.max(...allVals) * 1.15;
  const n = labels.length;

  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width','100%');
  svg.setAttribute('height', h);

  // Grid
  for (let i = 0; i <= 4; i++) {
    const y = mt + ph - (ph * i / 4);
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    Object.entries({x1:ml,x2:w-mr,y1:y,y2:y}).forEach(([k,v])=>line.setAttribute(k,v));
    line.setAttribute('class','grid-line');
    svg.appendChild(line);
    const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
    txt.setAttribute('x', ml-6); txt.setAttribute('y', y+4);
    txt.setAttribute('text-anchor','end'); txt.setAttribute('class','axis-label-v');
    txt.textContent = Math.round(max * i / 4);
    svg.appendChild(txt);
  }
  // Baseline
  const bl = document.createElementNS('http://www.w3.org/2000/svg','line');
  Object.entries({x1:ml,x2:w-mr,y1:mt+ph,y2:mt+ph}).forEach(([k,v])=>bl.setAttribute(k,v));
  bl.setAttribute('class','axis-line');
  svg.appendChild(bl);
  // X labels
  labels.forEach((l, i) => {
    const x = ml + (pw / (n - 1)) * i;
    const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
    txt.setAttribute('x', x); txt.setAttribute('y', mt + ph + 20);
    txt.setAttribute('text-anchor','middle'); txt.setAttribute('class','axis-label');
    txt.textContent = l;
    svg.appendChild(txt);
  });
  // Lines + area + dots
  seriesData.forEach((series, si) => {
    const col = colors[si] || getCS('--s1');
    const pts = series.values.map((v, i) => {
      const x = ml + (pw / (n - 1)) * i;
      const y = mt + ph - (v / max) * ph;
      return {x, y, v};
    });
    // Area
    const areaPath = `M${pts[0].x},${mt+ph} ${pts.map(p=>`L${p.x},${p.y}`).join(' ')} L${pts[pts.length-1].x},${mt+ph} Z`;
    const area = document.createElementNS('http://www.w3.org/2000/svg','path');
    area.setAttribute('d', areaPath);
    area.setAttribute('fill', col); area.setAttribute('opacity','0.1');
    svg.appendChild(area);
    // Line
    const linePath = pts.map((p,i)=>(i?'L':'M')+p.x+','+p.y).join(' ');
    const line = document.createElementNS('http://www.w3.org/2000/svg','path');
    line.setAttribute('d', linePath);
    line.setAttribute('fill','none'); line.setAttribute('stroke', col);
    line.setAttribute('stroke-width','2'); line.setAttribute('stroke-linejoin','round');
    line.setAttribute('stroke-linecap','round');
    svg.appendChild(line);
    // Dots
    pts.forEach(p => {
      const ring = document.createElementNS('http://www.w3.org/2000/svg','circle');
      ring.setAttribute('cx',p.x); ring.setAttribute('cy',p.y); ring.setAttribute('r',6);
      ring.setAttribute('fill', getCS('--surface'));
      svg.appendChild(ring);
      const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
      dot.setAttribute('cx',p.x); dot.setAttribute('cy',p.y); dot.setAttribute('r',4);
      dot.setAttribute('fill', col);
      svg.appendChild(dot);
    });
    // End label
    const last = pts[pts.length-1];
    const endLbl = document.createElementNS('http://www.w3.org/2000/svg','text');
    endLbl.setAttribute('x', last.x + 8); endLbl.setAttribute('y', last.y + 4);
    endLbl.setAttribute('class','axis-label-v'); endLbl.style.fontWeight = '600';
    endLbl.textContent = last.v;
    svg.appendChild(endLbl);
  });

  // Crosshair hit area
  for (let i = 0; i < n; i++) {
    const x = ml + (pw / (n-1)) * i;
    const hit = document.createElementNS('http://www.w3.org/2000/svg','rect');
    hit.setAttribute('x', x - pw/(n*2)); hit.setAttribute('y', mt);
    hit.setAttribute('width', pw/n); hit.setAttribute('height', ph);
    hit.setAttribute('fill','transparent'); hit.style.cursor='crosshair';
    const idx = i;
    hit.addEventListener('pointerenter', ev => {
      let html = `<div class="tt-label">${labels[idx]}</div>`;
      seriesData.forEach((s,si) => {
        html += `<div class="tt-row"><span class="tt-swatch" style="background:${colors[si]}"></span><span>${s.name}: </span><span class="tt-value">${s.values[idx]}</span></div>`;
      });
      showTooltip(html, ev.clientX, ev.clientY);
    });
    hit.addEventListener('pointermove', ev => {
      let html = `<div class="tt-label">${labels[idx]}</div>`;
      seriesData.forEach((s,si) => {
        html += `<div class="tt-row"><span class="tt-swatch" style="background:${colors[si]}"></span><span>${s.name}: </span><span class="tt-value">${s.values[idx]}</span></div>`;
      });
      showTooltip(html, ev.clientX, ev.clientY);
    });
    hit.addEventListener('pointerleave', hideTooltip);
    svg.appendChild(hit);
  }

  el.appendChild(svg);
}

// ─── Dates & filters ───
const DAY = 86400000;
const toKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const fmtShort = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Current period and the equal-length period right before it (for "vs prev period").
function getPeriod() {
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const v = $('periodFilter').value;
  const start = v === 'mtd' ? new Date(end.getFullYear(), end.getMonth(), 1) : addDays(end, -(Number(v) - 1));
  const len = Math.round((end - start) / DAY) + 1;
  return { start, end, len, prevStart: addDays(start, -len), prevEnd: addDays(start, -1) };
}

const inRange = (iss, a, b) => iss.date >= toKey(a) && iss.date <= toKey(b);

// Severity + department filters (period applied separately).
function attrFiltered() {
  const sev = $('sevFilter').value;
  const dept = $('deptFilter').value;
  return issues.filter(i => (!sev || i.severity === sev) && (!dept || i.caughtBy === dept || i.createdBy === dept));
}

function emptyNote(id, msg = 'No issues for these filters') {
  $(id).innerHTML = `<div class="empty-note">${msg}</div>`;
}

// ─── Render Functions ───
function renderExecSummary() {
  const p = getPeriod();
  const base = attrFiltered();
  const cur = base.filter(i => inRange(i, p.start, p.end));
  const prev = base.filter(i => inRange(i, p.prevStart, p.prevEnd));

  const stats = list => {
    const total = list.length;
    const open = list.filter(i => i.status === 'Open').length;
    const resolved = list.filter(i => i.status === 'Resolved').length;
    return { total, open, resolved, rate: total ? Math.round(resolved / total * 100) : 0 };
  };
  const c = stats(cur), pv = stats(prev);

  // Sparkline: current period split into 12 slices
  const slices = 12;
  const sliceOf = i => Math.min(slices - 1, Math.floor(((new Date(i.date + 'T00:00:00') - p.start) / DAY) * slices / p.len));
  const series = fn => {
    const groups = Array.from({ length: slices }, () => []);
    cur.forEach(i => groups[sliceOf(i)].push(i));
    return groups.map(fn);
  };
  const sparkSvg = (pts, color) => {
    const max = Math.max(...pts), min = Math.min(...pts);
    const w = 80, h = 24;
    const path = pts.map((v, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - ((v - min) / (max - min || 1)) * h;
      return (i ? 'L' : 'M') + x + ',' + y;
    }).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  };
  // goodWhenUp: for Resolved / Rate an increase is good; for Total / Open an increase is bad.
  const delta = (now, before, goodWhenUp, unit = '') => {
    const d = now - before;
    const cls = d === 0 ? '' : (d > 0) === goodWhenUp ? 'up' : 'down';
    return `<div class="tile-delta ${cls}">${d > 0 ? '+' : ''}${d}${unit} vs prev period</div>`;
  };
  const tile = (label, value, deltaHtml, pts, color) =>
    `<div class="tile"><div class="tile-label">${label}</div><div class="tile-value">${value}</div>${deltaHtml}<div class="tile-spark">${sparkSvg(pts, color)}</div></div>`;

  $('exec-tiles').innerHTML =
    tile('Total Issues', c.total, delta(c.total, pv.total, false), series(g => g.length), getCS('--s1')) +
    tile('Open Issues', c.open, delta(c.open, pv.open, false), series(g => g.filter(i => i.status === 'Open').length), getCS('--critical')) +
    tile('Resolved', c.resolved, delta(c.resolved, pv.resolved, true), series(g => g.filter(i => i.status === 'Resolved').length), getCS('--s3')) +
    tile('Resolution Rate', c.rate + '%', delta(c.rate, pv.rate, true, '%'), series(g => g.length ? Math.round(g.filter(i => i.status === 'Resolved').length / g.length * 100) : 0), getCS('--s3'));

  // Trend: daily buckets for short periods, weekly otherwise; last bucket ends today.
  const bucketDays = p.len <= 14 ? 1 : 7;
  const count = Math.max(2, Math.ceil(p.len / bucketDays));
  const labels = [], reported = [], resolved = [];
  for (let b = 0; b < count; b++) {
    const bEnd = addDays(p.end, -(count - 1 - b) * bucketDays);
    const bStart = addDays(bEnd, -(bucketDays - 1));
    const inB = base.filter(i => inRange(i, bStart, bEnd));
    labels.push(fmtShort(bStart));
    reported.push(inB.length);
    resolved.push(inB.filter(i => i.status === 'Resolved').length);
  }
  $('trend-subtitle').textContent = `Issues reported per ${bucketDays === 1 ? 'day' : 'week'}, and how many of those are now resolved`;
  if (reported.some(v => v > 0)) {
    drawLineChart('trend-chart', [
      { name: 'Reported', values: reported },
      { name: 'Resolved', values: resolved },
    ], { labels, colors: [getCS('--s1'), getCS('--s3')] });
  } else emptyNote('trend-chart');

  // Severity chart, each bar in its severity color
  const sevColors = { Critical: getCS('--critical'), High: '#b07800', Medium: getCS('--accent'), Low: getCS('--good') };
  const sevCounts = CIM.SEVERITIES.map(s => ({ label: s, value: cur.filter(i => i.severity === s).length, color: sevColors[s] }));
  if (cur.length) drawBarChart('severity-chart', sevCounts, { height: 220 });
  else emptyNote('severity-chart');

  // Recent table
  const tbody = document.querySelector('#recent-table tbody');
  const recent = [...cur].sort((a, b) => b.date.localeCompare(a.date) || b.itemId - a.itemId).slice(0, 10);
  tbody.innerHTML = recent.length ? '' : '<tr><td colspan="8" class="empty-note">No issues for these filters</td></tr>';
  recent.forEach(iss => {
    const tr = document.createElement('tr');
    const sevClass = 'sev-' + iss.severity.toLowerCase();
    const statusClass = iss.status === 'Open' ? 'status-open' : iss.status === 'In Progress' ? 'status-investigating' : 'status-resolved';
    tr.innerHTML = `
      <td style="font-weight:600;color:var(--accent)">${esc(iss.id)}</td>
      <td>${esc(iss.dateStr)}</td>
      <td>${esc(iss.project)}</td>
      <td style="max-width:200px">${esc(iss.description)}</td>
      <td>${esc(iss.caughtBy)}</td>
      <td>${esc(iss.createdBy)}</td>
      <td><span class="severity-badge ${sevClass}">${esc(iss.severity)}</span></td>
      <td><span class="status-dot ${statusClass}"></span>${esc(iss.status)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function paretoData(list, key) {
  const counts = {};
  list.forEach(i => { if (i[key]) counts[i[key]] = (counts[i[key]] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, v]) => s + v, 0);
  let cum = 0;
  return sorted.map(([label, value]) => {
    cum += value;
    return { label, value, cumPct: Math.round(cum / total * 100) };
  });
}

function renderPareto() {
  const p = getPeriod();
  const cur = attrFiltered().filter(i => inRange(i, p.start, p.end));
  if (!cur.length) {
    emptyNote('pareto-caught'); emptyNote('pareto-created'); emptyNote('matrix-container');
    return;
  }
  drawBarChart('pareto-caught', paretoData(cur, 'caughtBy'), { barColor: getCS('--s1'), height: 280, showCumLine: true, cumColor: getCS('--cumline') });
  drawBarChart('pareto-created', paretoData(cur, 'createdBy'), { barColor: getCS('--s2'), height: 280, showCumLine: true, cumColor: getCS('--cumline') });

  // Matrix
  const matrix = {};
  CIM.DEPTS.forEach(c => { matrix[c] = {}; CIM.DEPTS.forEach(cr => matrix[c][cr] = 0); });
  cur.forEach(i => { if (matrix[i.caughtBy] && i.createdBy in matrix[i.caughtBy]) matrix[i.caughtBy][i.createdBy]++; });
  const activeCaught = CIM.DEPTS.filter(d => cur.some(i => i.caughtBy === d));
  const activeCreated = CIM.DEPTS.filter(d => cur.some(i => i.createdBy === d));
  let tableHTML = '<table class="data-table"><thead><tr><th>Caught \\ Created</th>';
  activeCreated.forEach(d => tableHTML += `<th style="font-size:10px;min-width:60px">${d}</th>`);
  tableHTML += '</tr></thead><tbody>';
  activeCaught.forEach(caught => {
    tableHTML += `<tr><td style="font-weight:600;font-size:12px">${caught}</td>`;
    activeCreated.forEach(created => {
      const v = matrix[caught][created];
      const bg = v > 0 ? `rgba(42,120,214,${Math.min(v / 8, 0.4)})` : 'transparent';
      tableHTML += `<td style="text-align:center;background:${bg};font-variant-numeric:tabular-nums">${v || ''}</td>`;
    });
    tableHTML += '</tr>';
  });
  tableHTML += '</tbody></table>';
  $('matrix-container').innerHTML = tableHTML;
}

function renderAll() {
  renderExecSummary();
  renderPareto();
}

// ─── Data loading ───
function showBanner(msg, kind = 'error') {
  $('banner').className = 'banner show ' + kind;
  $('banner').innerHTML = msg;
}

async function loadIssues() {
  try {
    const raw = await CIM.data.getIssues();
    // Dashboard field names (kept from the mock-up's rendering code)
    issues = raw.map(i => {
      const [y, m, d] = i.date.split('-').map(Number);
      return { ...i, caughtBy: i.caught, createdBy: i.created, dateStr: `${m}/${d}/${y}` };
    });
    renderAll();
  } catch (e) {
    showBanner('Could not load issues: ' + esc(e.message));
  }
}

async function start() {
  CIM.SEVERITIES.forEach(s => $('sevFilter').insertAdjacentHTML('beforeend', `<option>${s}</option>`));
  CIM.DEPTS.forEach(d => $('deptFilter').insertAdjacentHTML('beforeend', `<option>${d}</option>`));
  ['periodFilter', 'sevFilter', 'deptFilter'].forEach(id => $(id).addEventListener('change', renderAll));
  $('refresh-btn').addEventListener('click', loadIssues);

  if (!CIM.isLiveMode()) {
    $('mode-badge').hidden = false;
    await loadIssues();
    return;
  }
  const authBtn = $('auth-btn');
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
    showBanner('Sign in with your CIM Microsoft 365 account to view the dashboard.', 'info');
    return;
  }
  $('user-name').textContent = user.name;
  authBtn.textContent = 'Sign out';
  authBtn.onclick = () => CIM.auth.signOut();
  await loadIssues();
}

// Resize handler
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderAll, 200);
});

start();
