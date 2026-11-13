// Purchasing Desk (online version): where to sign in and where the price file is.
// See setup/SETUP.md for where each value comes from.
//
// None of these values are secrets. The prices themselves are in SharePoint, and only
// people with access to that file can load them.
window.PD_CONFIG = {
  tenantId: '',      // Directory (tenant) ID
  clientId: '',      // Application (client) ID of the "CIM Purchasing Desk" app registration
  siteHostname: '',  // e.g. 'contoso.sharepoint.com'
  sitePath: '',      // e.g. '/sites/Purchasing'
  dataFile: 'Purchasing Desk/purchasing-desk-data.json', // path inside that site's Documents library
};
