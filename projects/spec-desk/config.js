// Spec Desk: deployment settings.
//
// Left blank, Spec Desk works as before on its own: documents and projects stay in this browser,
// Save/Split buttons download files, and the AI features are off (they still work when the page is
// opened inside claude.ai). Fill in the Microsoft 365 values to let people sign in with their CIM work
// account, open files from SharePoint or OneDrive, and save projects to SharePoint for the team.
// Fill in claudeEndpoint as well to turn the AI features on through CIM's own Claude service.
// See setup/SETUP.md for where each value comes from.
//
// None of these values are secrets. The Claude API key lives only in the Azure Function's
// settings, never in this file or anywhere else in this repo.
window.SD_CONFIG = {
  // Entra ID (Azure AD) app registration
  tenantId: '',        // Directory (tenant) ID
  clientId: '',        // Application (client) ID of the "CIM Spec Desk" app registration

  // SharePoint site whose Documents library holds shared projects (and is offered first when opening files).
  // Leave blank to use each person's own OneDrive instead.
  siteHostname: '',    // e.g. 'contoso.sharepoint.com'
  sitePath: '',        // e.g. '/sites/Estimating'
  projectsFolder: 'Spec Desk Projects', // folder in that Documents library (created on first save)

  // Azure Function that calls Claude (setup/SETUP.md, step 3). Leave blank to keep the AI features off.
  claudeEndpoint: '',  // e.g. 'https://cim-spec-desk.azurewebsites.net/api/claude'
};
