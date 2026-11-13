// HR Hub: Microsoft 365 settings. See setup/SETUP.md for where each value comes from.
//
// None of these values are secrets. Who can see what is decided by the permissions on the
// three SharePoint lists, not by this file.
window.HR_CONFIG = {
  tenantId: '',      // Directory (tenant) ID
  clientId: '',      // Application (client) ID of the "CIM HR Hub" app registration
  siteHostname: '',  // e.g. 'contoso.sharepoint.com'
  sitePath: '',      // e.g. '/sites/HR'
  lists: {
    private: 'HR Hub Private',    // people, interviews, paper inbox, feedback: HR only
    tasks: 'HR Hub Tasks',        // checklist tasks: HR edits, task owners update their own
    settings: 'HR Hub Settings',  // rules, messages, questions, fields, departments: HR edits, everyone reads
  },
  refreshSeconds: 45,  // how often an open page checks for changes made by others
};
