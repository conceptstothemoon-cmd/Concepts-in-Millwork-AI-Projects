// CIM Quality — deployment settings.
//
// Leave clientId blank to run in DEMO MODE (sample data stored in this browser only).
// Fill in all values to run in LIVE MODE (Microsoft 365 sign-in, data in SharePoint).
// See setup/AZURE-SETUP.md for where each value comes from.
//
// None of these values are secrets: they identify the app and the SharePoint site,
// and every request still requires the user to sign in with a CIM Microsoft 365 account.
window.CIM_CONFIG = {
  // Azure / Entra ID app registration
  tenantId: '',          // Directory (tenant) ID, e.g. 'contoso.onmicrosoft.com' or a GUID
  clientId: '',          // Application (client) ID of the "CIM Quality" app registration

  // SharePoint site that holds the list
  siteHostname: '',      // e.g. 'contoso.sharepoint.com'
  sitePath: '',          // e.g. '/sites/Quality'
  listName: 'Quality Issues',
};
