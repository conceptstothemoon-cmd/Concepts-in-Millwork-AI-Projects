// Bid Screener: deployment settings.
//
// Leave clientId blank to run in DEMO MODE: made-up example data, saved only in this browser.
// Fill in the Microsoft 365 values to run in LIVE MODE: sign in with a CIM work account,
// data shared by everyone in a SharePoint list.
// Fill in claudeEndpoint as well to turn on reading invites and "Ask a question".
// See setup/SETUP.md for where each value comes from.
//
// None of these values are secrets. The Claude API key lives only in the Azure Function's
// settings, never in this file or anywhere else in this repo.
window.BS_CONFIG = {
  // Entra ID (Azure AD) app registration
  tenantId: '',        // Directory (tenant) ID
  clientId: '',        // Application (client) ID of the "CIM Bid Screener" app registration

  // SharePoint site that holds the list
  siteHostname: '',    // e.g. 'contoso.sharepoint.com'
  sitePath: '',        // e.g. '/sites/Sales'
  listName: 'Bid Screener Data',

  // Azure Function that calls Claude (setup/SETUP.md, step 3). Leave blank to turn AI features off.
  claudeEndpoint: '',  // e.g. 'https://cim-bid-screener.azurewebsites.net/api/claude'

  // How often each open page checks SharePoint for changes other people made, in seconds.
  refreshSeconds: 45,
};
