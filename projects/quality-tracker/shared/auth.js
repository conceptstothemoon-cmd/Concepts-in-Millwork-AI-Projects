// Microsoft 365 sign-in (MSAL.js). Only used in live mode.
// Requires shared/vendor/msal-browser.min.js and shared/config.js loaded first.
window.CIM = window.CIM || {};

CIM.isLiveMode = () => Boolean(window.CIM_CONFIG && CIM_CONFIG.clientId);

CIM.auth = (() => {
  const SCOPES = ['User.Read', 'Sites.ReadWrite.All'];
  let pca = null;
  let account = null;

  // Each page signs in back to itself, so both page URLs must be registered
  // as SPA redirect URIs (see setup/AZURE-SETUP.md).
  const redirectUri = () => window.location.origin + window.location.pathname.replace(/index\.html$/, '');

  async function init() {
    if (!CIM.isLiveMode()) return null;
    pca = new msal.PublicClientApplication({
      auth: {
        clientId: CIM_CONFIG.clientId,
        authority: 'https://login.microsoftonline.com/' + (CIM_CONFIG.tenantId || 'organizations'),
        redirectUri: redirectUri(),
      },
      cache: { cacheLocation: 'localStorage' },
    });
    await pca.initialize();
    const result = await pca.handleRedirectPromise();
    account = (result && result.account) || pca.getAllAccounts()[0] || null;
    if (account) pca.setActiveAccount(account);
    return account;
  }

  function signIn() {
    return pca.loginRedirect({ scopes: SCOPES });
  }

  function signOut() {
    return pca.logoutRedirect({ account, postLogoutRedirectUri: redirectUri() });
  }

  async function getToken() {
    if (!account) throw new Error('Not signed in');
    try {
      const r = await pca.acquireTokenSilent({ scopes: SCOPES, account });
      return r.accessToken;
    } catch (e) {
      if (e instanceof msal.InteractionRequiredAuthError) {
        await pca.acquireTokenRedirect({ scopes: SCOPES, account });
      }
      throw e;
    }
  }

  return {
    init,
    signIn,
    signOut,
    getToken,
    get user() { return account ? { name: account.name || account.username, email: account.username } : null; },
  };
})();
