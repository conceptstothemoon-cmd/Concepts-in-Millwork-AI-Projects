// CIM Quality Tracker: connection settings
// ==========================================
//
// WHAT TO DO: fill in the four empty quotes ('') below with CIM's values.
// Type each value between the quotes. Keep the quotes and the comma at the end of the line.
//
//   Before:  tenantId: '',
//   After:   tenantId: '1a2b3c4d-1111-2222-3333-444455556666',
//
// WHAT THEY DO: they tell the app which company it belongs to and where to save issues.
//   - While they are blank, the app runs in DEMO MODE (fake sample data, nothing is saved to CIM).
//   - Once they are filled in, the app shows a "Sign in" button. Staff sign in with their CIM
//     Microsoft 365 accounts, and every issue is saved to CIM's SharePoint list.
//
// IS IT SAFE TO PUT THESE ON GITHUB? Yes. These values are addresses, not passwords.
// Knowing them does not let anyone in: every request still needs a real CIM Microsoft 365 login.
// Never put a password or client secret in this file. The app does not need one.
//
// Full setup steps: setup/CIM-IT-HANDOFF.md

window.CIM_CONFIG = {

  // 1. tenantId: tells the app to use CIM's Microsoft 365 sign-in (CIM work accounts only).
  //    WHERE TO FIND IT: entra.microsoft.com > App registrations > CIM Quality Tracker > Overview >
  //    "Directory (tenant) ID". It looks like 1a2b3c4d-1111-2222-3333-444455556666.
  tenantId: '',

  // 2. clientId: identifies this app to Microsoft, so Microsoft knows CIM approved it.
  //    WHERE TO FIND IT: on the same Overview page > "Application (client) ID".
  //    It looks like 9f8e7d6c-aaaa-bbbb-cccc-ddddeeeeffff (a different value from tenantId).
  clientId: '',

  // 3. siteHostname: CIM's SharePoint address, without "https://" and without anything after ".com".
  //    WHERE TO FIND IT: open the SharePoint site that has the "Quality Issues" list and look at the
  //    browser address bar. From https://cim.sharepoint.com/sites/Quality, enter: cim.sharepoint.com
  siteHostname: '',

  // 4. sitePath: the part of the site address after ".com". It starts with a forward slash.
  //    From https://cim.sharepoint.com/sites/Quality, enter: /sites/Quality
  sitePath: '',

  // Name of the SharePoint list. Leave as-is unless you named the list something else.
  listName: 'Quality Issues',
};
