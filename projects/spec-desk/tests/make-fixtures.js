// Builds test PDFs with real text layers using Chromium's PDF printer.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'fixtures');
fs.mkdirSync(OUT, { recursive: true });

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// ---------- spec book ----------
const SECTIONS = [
  { num: '06 41 16', title: 'PLASTIC-LAMINATE-FACED ARCHITECTURAL CABINETS', body: `
PART 1 - GENERAL
1.1 SUMMARY
A. Section includes plastic-laminate-faced architectural cabinets, cabinet hardware and accessories, and countertops at casework.
1.2 SUBMITTALS
A. Shop Drawings: Show location of each item, dimensioned plans and elevations, large-scale details, attachment devices, and other components.
B. Samples: Submit plastic laminate samples, 8 by 10 inches, for each type, color, pattern, and surface finish.
C. Product Certificates: Submit AWI Quality Certification Program labels and certificates for each type of casework.
1.3 QUALITY ASSURANCE
A. Fabricator Qualifications: Shop that employs skilled workers who custom fabricate products similar to those required for this Project and whose products have a record of successful in-service performance.
B. Mockups: Build mockup of typical base cabinet, wall cabinet, and countertop, approximately 8 feet long.
1.4 WARRANTY
A. Provide a two-year warranty on all casework, hardware, and installation, starting at Substantial Completion.
PART 2 - PRODUCTS
2.1 PLASTIC-LAMINATE-FACED CABINETS
A. Grade: Custom grade in accordance with AWI/AWMAC/WI Architectural Woodwork Standards, 2nd Edition.
B. Type of Construction: Frameless.
C. Cabinet Style: Flush overlay.
D. Laminate Cladding for Exposed Surfaces: High-pressure decorative laminate, NEMA LD 3, Grade HGS, 0.048 inch nominal thickness.
E. Edgebanding: 3 mm PVC edgebanding matching laminate in color and pattern at all exposed edges.
F. Core Material: Particleboard, ANSI A208.1, Grade M-2, 3/4 inch thick, with no added urea formaldehyde.
2.2 CABINET HARDWARE
A. Hinges: Concealed European-style, self-closing, 170 degree opening, BHMA A156.9, Grade 1.
1. Basis of Design: Blum Clip Top 170.
B. Drawer Slides: Full-extension, ball-bearing, 100 lbf load rating, BHMA A156.9, Grade 1.
C. Pulls: Back-mounted 4 inch wire pulls, satin stainless steel finish.
D. Locks: Provide cam locks on all drawers and doors where indicated, keyed alike within each room.
E. Shelf Supports: 5 mm metal pin supports, 32 mm system spacing.
2.3 COUNTERTOPS
A. Solid Surface Countertops: 1/2 inch thick, ANSI Z124.3, with 4 inch high integral backsplash.
B. Countertop Height: 36 inches above finished floor unless otherwise indicated; 34 inches maximum at accessible locations.
PART 3 - EXECUTION
3.1 INSTALLATION
A. Install cabinets level, plumb, and true; shim as required using concealed shims. Maximum variation 1/8 inch in 96 inches.
B. Anchor cabinets to in-wall blocking with No. 10 wafer-head screws at 16 inches on center.
C. Scribe and cut casework to fit adjoining work; refinish cut surfaces.
END OF SECTION 06 41 16` },
  { num: '12 36 61', title: 'SIMULATED STONE COUNTERTOPS', body: `
PART 1 - GENERAL
1.1 SUMMARY
A. Section includes quartz agglomerate countertops, backsplashes, and support brackets.
1.2 SUBMITTALS
A. Samples: Submit 6 by 6 inch samples of each color and finish.
B. Maintenance Data: Provide care and maintenance instructions.
1.3 WARRANTY
A. Manufacturer warranty: 10 years against defects in materials.
PART 2 - PRODUCTS
2.1 QUARTZ COUNTERTOPS
A. Manufacturers: Caesarstone, Silestone, or approved equal.
B. Thickness: 3 cm (1-1/4 inch).
C. Edge Profile: Eased edge, 1/8 inch radius.
D. Color: QZ-1, Caesarstone 4141 Misty Carrera, polished finish.
2.2 SUPPORT BRACKETS
A. Concealed steel countertop support brackets, powder-coated, rated 1000 lbs per pair, at 36 inches on center maximum.
PART 3 - EXECUTION
3.1 INSTALLATION
A. Seams: Locate seams as shown on approved shop drawings, maximum one seam per run under 10 feet.
B. Sealant: Seal joints with mildew-resistant silicone sealant matching countertop color.
END OF SECTION 12 36 61` },
  { num: '09 91 23', title: 'INTERIOR PAINTING', body: `
PART 1 - GENERAL
1.1 SUMMARY
A. Section includes surface preparation and field painting of interior substrates.
PART 2 - PRODUCTS
2.1 PAINT
A. Manufacturers: Sherwin-Williams, Benjamin Moore, or approved equal.
B. Interior Latex: Eggshell finish, two coats over primer.
PART 3 - EXECUTION
3.1 APPLICATION
A. Apply paint at manufacturer's recommended spreading rate.
END OF SECTION 09 91 23` },
];

function specHtml() {
  let pages = [];
  for (const s of SECTIONS) {
    const lines = [`SECTION ${s.num} - ${s.title}`, ...s.body.trim().split('\n')];
    const per = 22;
    for (let i = 0, k = 1; i < lines.length; i += per, k++) pages.push({ s, k, lines: lines.slice(i, i + per) });
  }
  const pageHtml = pages.map(p => `<div class="pg"><div class="hdr">LAREDO TEST PROJECT</div>${p.lines.map(l => `<p class="${/^(SECTION|PART|END)/.test(l) ? 'b' : ''}">${esc(l)}</p>`).join('')}<div class="ftr">${p.s.title} &nbsp;&nbsp;&nbsp; ${p.s.num} - ${p.k}</div></div>`).join('');
  return `<html><head><style>@page{size:8.5in 11in;margin:0}body{margin:0;font:11pt Arial}.pg{width:8.5in;height:11in;padding:.8in;box-sizing:border-box;position:relative;page-break-after:always}.hdr{font-size:9pt;margin-bottom:.3in}.ftr{position:absolute;bottom:.5in;left:.8in;right:.8in;text-align:center;font-size:9pt}p{margin:0 0 7pt 0}.b{font-weight:bold}</style></head><body>${pageHtml}</body></html>`;
}

// ---------- proposal ----------
const PROPOSAL = `CONCEPTS IN MILLWORK - PROPOSAL 24-117
Project: Laredo Test Project. Scope: Architectural casework and countertops per Sections 06 41 16 and 12 36 61.

Casework will be fabricated to AWI Custom grade, frameless construction, flush overlay. Exposed surfaces: high-pressure decorative laminate, Grade HGS. Edges: 3 mm PVC edgebanding to match.

Cabinet boxes: 3/4 inch particleboard core, ANSI A208.1 Grade M-2.

Hardware: Blum concealed self-closing hinges, 110 degree opening. Drawer slides: full-extension ball-bearing, 75 lbf rating. Pulls: 4 inch wire pulls, satin stainless. Shelf pins: 5 mm metal.

Countertops at casework: solid surface, 1/2 inch thick with 4 inch integral backsplash.

Quartz countertops: Caesarstone 4141 Misty Carrera, 2 cm thickness, eased edge. Support brackets by others.

Submittals: shop drawings and plastic laminate samples will be provided. AWI QCP certification is not included.

Warranty: One-year warranty on materials and workmanship.

Exclusions: Cam locks are excluded. Blocking in walls by others. Field painting excluded.`;

function proposalHtml() {
  return `<html><head><style>@page{size:8.5in 11in;margin:.9in}body{font:11pt Arial}p{margin:0 0 10pt 0}</style></head><body>${PROPOSAL.split('\n\n').map(p => `<p>${esc(p)}</p>`).join('')}</body></html>`;
}

// ---------- drawings (17x11 landscape) ----------
// Items are [xPct, yPct, text, sizePt]. Title block number is big, lower right.
function sheetHtml(sheets) {
  const W = 17, H = 11;
  const body = sheets.map(items => `<div class="sh">${items.map(([x, y, t, s]) => `<div style="left:${x / 100 * W}in;top:${y / 100 * H}in;font-size:${s || 9}pt">${esc(t)}</div>`).join('')}
    <svg class="ln" viewBox="0 0 1700 1100"><rect x="20" y="20" width="1660" height="1060" fill="none" stroke="#000" stroke-width="3"/><line x1="1380" y1="20" x2="1380" y2="1080" stroke="#000" stroke-width="2"/>
    <rect x="200" y="330" width="600" height="360" fill="none" stroke="#000" stroke-width="2"/><line x1="200" y1="510" x2="800" y2="510" stroke="#000"/><line x1="400" y1="330" x2="400" y2="690" stroke="#000"/><line x1="600" y1="330" x2="600" y2="690" stroke="#000"/></svg></div>`).join('');
  return `<html><head><style>@page{size:${W}in ${H}in;margin:0}body{margin:0;font-family:Arial}.sh{width:${W}in;height:${H}in;position:relative;page-break-after:always;overflow:hidden}.sh div{position:absolute;white-space:nowrap}.ln{position:absolute;left:0;top:0;width:100%;height:100%}</style></head><body>${body}</body></html>`;
}
const ARCH = [
  [ // A-501 interior elevations
    [12, 22, '3', 14], [12, 26, 'BREAK ROOM 201 - ELEVATION', 11], [12, 29, 'SCALE: 1/2" = 1\'-0"', 8],
    [25, 30, '12\'-0"', 9], [8, 45, '36"', 9], [8, 58, '34 1/2"', 9],
    [25, 50, 'PL-1 PLASTIC LAMINATE', 8], [25, 66, 'SS-1 SOLID SURFACE COUNTERTOP', 8], [52, 47, '4" BACKSPLASH', 8],
    [40, 72, 'SEE 5/A-502 FOR COUNTERTOP SUPPORT', 8],
    [12, 80, '4', 14], [12, 84, 'BREAK ROOM 201 - SECTION', 11], [25, 88, 'WALL CABINET DEPTH 12"', 8], [50, 88, 'BASE CABINET DEPTH 24"', 8],
    [83, 15, 'FINISH LEGEND', 9], [83, 19, 'PL-1: WILSONART 7980-60 DESIGNER WHITE', 8], [83, 22, 'SS-1: CORIAN GLACIER WHITE', 8], [83, 25, 'QZ-1: CAESARSTONE 4141', 8],
    [83, 80, 'INTERIOR ELEVATIONS', 10], [86, 90, 'A-501', 26],
  ],
];
const SHOP = [
  [ // M.01 shop drawing
    [12, 22, '1', 14], [12, 26, 'ELEVATION - BREAK ROOM 201  1/2" = 1\'-0"  RE: 3/A-501', 11],
    [25, 30, '11\'-11 1/2"', 9], [8, 45, '36"', 9], [8, 58, '36"', 9],
    [25, 50, 'PL-1', 8], [25, 66, 'SS-1 SOLID SURFACE', 8], [52, 47, '4" BACKSPLASH', 8], [60, 30, '1/2" SCRIBE', 8],
    [30, 56, '201.01', 9], [50, 56, '201.02', 9],
    [12, 80, '2', 14], [12, 84, 'SECTION - BREAK ROOM 201  RE: 4/A-501', 11], [25, 88, 'WALL CAB DEPTH 12"', 8], [50, 88, 'BASE CAB DEPTH 23 1/4"', 8],
    [83, 15, 'MATERIALS', 9], [83, 19, 'PL-1: WILSONART 7980-60', 8], [83, 22, 'SS-1: CORIAN GLACIER WHITE', 8],
    [83, 80, 'CASEWORK ELEVATIONS', 10], [86, 90, 'M.01', 26],
  ],
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const make = async (html, file, opts) => { await p.setContent(html); await p.pdf({ path: path.join(OUT, file), preferCSSPageSize: true, printBackground: true, ...opts }); };
  await make(specHtml(), 'spec-book.pdf');
  await make(proposalHtml(), 'proposal.pdf');
  await make(sheetHtml(ARCH), 'arch-A501.pdf');
  await make(sheetHtml(SHOP), 'shop-M01.pdf');
  await b.close();
  console.log(fs.readdirSync(OUT));
})();
