// Seeded sample issues for demo mode and for setup/sample-issues.csv.
// Same seed = same issues every time; dates are spread over the 180 days before `today`.
window.CIM = window.CIM || {};

CIM.generateSampleIssues = function (count = 240, today = new Date()) {
  let s = 42;
  const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const wPick = (arr, weights) => {
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = rand() * sum, acc = 0;
    for (let i = 0; i < arr.length; i++) { acc += weights[i]; if (r < acc) return arr[i]; }
    return arr[arr.length - 1];
  };

  const NAMES = ['Ray Tilley', 'Mike Santos', 'Sarah Chen', 'Tom Bauer', 'Lisa Park', 'Dave Wilson',
    'Amy Rodriguez', 'James Mitchell', 'Karen Thompson', 'Chris Davis'];
  const DESCRIPTIONS = [
    'Panel width 1/4" over spec', 'Wrong laminate applied to face', 'Hinge bore spacing off by 2mm',
    'Drawer slide mounting holes misaligned', 'Edge band peeling at corner', 'Crown molding profile wrong',
    'Countertop seam visible', 'Door overlay inconsistent', 'Shelf pin holes 32mm off pattern',
    'Veneer grain direction reversed', 'Base cabinet toe kick short', 'Pull hardware bore spacing wrong',
    'Filler strip not flush', 'Scribe molding gap too wide', 'Back panel bowing out',
    'Soft close mechanism not engaging', 'European hinge cup depth off', 'Melamine chip at cut edge',
  ];
  const caughtW = [2, 4, 5, 2, 3, 15, 8, 4, 6, 5, 10, 18];
  const createdW = [6, 18, 8, 5, 10, 12, 14, 4, 3, 3, 2, 5];
  const categories = CIM.CATEGORIES.filter(c => c !== 'Other');
  const roots = CIM.ROOT_CAUSES.filter(r => r !== 'Pending');

  const issues = [];
  for (let i = 0; i < count; i++) {
    const sev = wPick(['Low', 'Medium', 'High', 'Critical'], [25, 35, 25, 15]);
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - Math.floor(rand() * 180));
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const cost = sev === 'Critical' ? Math.round(rand() * 8000 + 2000)
      : sev === 'High' ? Math.round(rand() * 4000 + 500)
      : Math.round(rand() * 1500 + 100);
    issues.push({
      id: 'QI-' + (1001 + i),
      itemId: 1 + i,
      date,
      project: pick(CIM.DEFAULT_PROJECTS),
      category: pick(categories),
      description: pick(DESCRIPTIONS),
      severity: sev,
      caught: wPick(CIM.DEPTS, caughtW),
      created: wPick(CIM.DEPTS, createdW),
      rootCause: pick(roots),
      correctiveAction: '',
      cost,
      reporter: pick(NAMES),
      status: wPick(CIM.STATUSES, [30, 25, 45]),
      mNumber: 'M' + String(Math.floor(rand() * 30) + 1).padStart(2, '0'),
    });
  }
  return issues;
};
