// Made-up example data for DEMO MODE only (BS_CONFIG.clientId blank).
// Every company, person and project here is fictional. Live mode never loads this file's data.
window.BS_SAMPLE = () => {
  const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const now = new Date().toISOString();
  const gc = (name, tier, extra) => ({ name, aka: '', domains: '', tier, why: 'Example GC', notes: '', trend: '', revisit: '', score: null, check: '', updatedBy: 'Example', updatedAt: now, ...extra });
  const inv = (extra) => ({ emailType: 'New invite', platform: 'BuildingConnected', received: day(-1), dueTime: '2:00 PM', hasRfpLink: true, sample: true, extraFlags: [], ...extra });
  return {
    'gcs/summit-ridge-builders': gc('Summit Ridge Builders', 'Top', { domains: 'summitridge.example', trend: 'Growing', notes: 'Healthcare work, negotiated often' }),
    'gcs/front-range-constructors': gc('Front Range Constructors', 'Mid', { aka: 'FRC', domains: 'frontrange.example' }),
    'gcs/prairie-wind-construction': gc('Prairie Wind Construction', 'Low'),
    'gcs/canyon-gate-contractors': gc('Canyon Gate Contractors', 'Watch', { check: 'Did they pay on time on the last job?' }),
    'gcs/fastline-build-group': gc('Fastline Build Group', 'Do Not Bid', { notes: 'Example: slow pay history' }),

    'invites/ex-1': inv({ project: 'Example Medical Pavilion Expansion', gcText: 'Summit Ridge Builders', contactName: 'Pat Example', contactEmail: 'pat@summitridge.example', due: day(12), location: '100 Example Ave, Colorado Springs, CO 80903', package: '06 40 00 Architectural Woodwork', stage: '100% CD', segment: 'Large Healthcare', award: 'Negotiated', bidType: 'Award', description: 'Two-story clinic addition with nurse stations, exam rooms and lobby millwork.' }),
    'invites/ex-2': inv({ project: 'Example Elementary School Renovation', gcText: 'Front Range Constructors', due: day(5), platform: 'SmartBid', location: '200 Sample St, Pueblo, CO 81003', package: 'Casework', stage: '50% CD', segment: 'K-12 School', award: 'Hard Bid', bidType: 'Budget', description: 'Classroom casework and library counters.' }),
    'invites/ex-3': inv({ project: 'Example Office Tenant Finish', gcText: 'Prairie Wind Construction', due: day(9), platform: 'Procore', location: '300 Demo Blvd, Denver, CO 80202', package: 'Millwork', stage: 'DD', segment: 'Office TI', award: "Don't Know", description: 'Break room and reception desk, restroom vanities.' }),
    'invites/ex-4': inv({ project: 'Example Hotel Lobby Refresh', gcText: 'Fastline Build Group', due: day(7), location: '400 Mock Rd, Santa Fe, NM 87501', segment: 'Hospitality', description: 'Lobby feature wall and front desk.' }),
    'invites/ex-5': inv({ project: 'Example Community Center', gcText: 'Brand New Contractors LLC', due: day(15), platform: 'Direct email', hasRfpLink: false, location: '500 Test Ln, Boise, ID 83702', segment: 'Government', description: 'Community room cabinets and countertops.' }),
    'invites/ex-6': inv({ project: 'Example Medical Pavilion Expansion', emailType: 'Addendum', gcText: 'Summit Ridge Builders', due: day(12), description: 'Addendum 2: revised finish schedule.' }),
    'invites/ex-7': inv({ project: 'Example Library Branch', gcText: 'Canyon Gate Contractors', received: day(-30), due: day(-20), location: '700 Archive Way, Cheyenne, WY 82001', segment: 'Government', archived: true, archivedAt: day(-18) + 'T12:00:00Z', actual: { outcome: 'Sent to bid review', note: 'Example of a past decision' } }),

    'feedback/ex-1': { screen: 'digest', text: 'Example suggestion: show the bid due time on every card.', by: 'Example', at: now, done: false },
  };
};
