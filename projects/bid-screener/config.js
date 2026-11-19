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
  tenantId: '51a1ef99-8648-4b7f-a9c3-756f3facb23b',        // Directory (tenant) ID
  clientId: 'af7deae7-ee48-4c4d-8f90-8970d30a269b',        // Application (client) ID of the "CIM Bid Screener" app registration

  // SharePoint site that holds the list
  siteHostname: 'concepts365.sharepoint.com',    // e.g. 'contoso.sharepoint.com'
  sitePath: '/sites/SalesandMarketing',        // e.g. '/sites/Sales'
  listName: 'Bid Screener Data',

  // Azure Function that calls Claude (setup/SETUP.md, step 3). Leave blank to turn AI features off.
  claudeEndpoint: 'https://cim-bid-screener-ehd0akdweed3axf8.westus3-01.azurewebsites.net/api/claude',  // e.g. 'https://cim-bid-screener.azurewebsites.net/api/claude'

  // How often each open page checks SharePoint for changes other people made, in seconds.
  refreshSeconds: 45,
};
