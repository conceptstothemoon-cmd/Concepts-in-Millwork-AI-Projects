// Choice values shared by the entry app, the dashboard, and the SharePoint list.
// If you change these, also update the choices on the SharePoint list
// (setup/Create-QualityList.ps1 reads the same values).
window.CIM = window.CIM || {};

CIM.DEPTS = [
  'Estimating', 'Engineering', 'Project Management', 'Procurement', 'Programming',
  'Case Work', 'Millwork', 'Layup', 'CNC', 'Edge Banding', 'Delivery', 'Installation',
];

CIM.CATEGORIES = [
  'Dimensional Error', 'Material Defect', 'Finish Quality', 'Hardware Issue', 'Design Mismatch',
  'Assembly Error', 'Documentation Error', 'Shipping Damage', 'Installation Issue', 'Other',
];

CIM.ROOT_CAUSES = [
  'Human Error', 'Process Gap', 'Training Gap', 'Equipment Malfunction', 'Material Issue',
  'Communication Failure', 'Design Error', 'Vendor Issue', 'Pending',
];

CIM.SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];

CIM.STATUSES = ['Open', 'In Progress', 'Resolved'];

// Starting project list. Users can add more from the entry form; any project
// already used on an issue also appears in the dropdown.
CIM.DEFAULT_PROJECTS = [
  'Metro Tower Lobby', 'Riverside Medical Office', 'Pinnacle Hotel Reception',
  'Heritage Bank Branch', 'Central Library Renovation', 'Summit Office Tower',
];
