// Job Cost Pilot: Microsoft 365 settings. See setup/SETUP.md for where each value comes from.
//
// None of these values are secrets. Who can use the pilot is decided by the permissions on
// the SharePoint list and receipts folder, not by this file.
window.JC_CONFIG = {
  tenantId: '',      // Directory (tenant) ID
  clientId: '',      // Application (client) ID of the "CIM Job Cost Pilot" app registration
  siteHostname: '',  // e.g. 'contoso.sharepoint.com'
  sitePath: '',      // e.g. '/sites/Accounting'
  listName: 'Job Cost Data',
  receiptsFolder: 'Job Cost Receipts', // folder in the site's Documents library for parking receipt photos
  refreshSeconds: 45,                  // how often an open page checks for changes made by others
};
