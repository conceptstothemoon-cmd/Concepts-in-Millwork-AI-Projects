// Online version only (index.html). Signs in with Microsoft 365, reads the private price file
// from SharePoint, then starts the page with it. The price file never goes in this repo.
// Who can open it is decided by the file's SharePoint permissions.
(function () {
  'use strict';
  var C = window.PD_CONFIG || {};
  var SCOPES = ['User.Read', 'Sites.Read.All'];
  var GRAPH = 'https://graph.microsoft.com/v1.0';
  var view = document.getElementById('view');

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function show(title, text, button) {
    view.innerHTML = '<section class="panel" style="border-color:var(--accent)"><div class="panel-head"><div><h2>' + esc(title) + '</h2><p class="muted">' + esc(text) + '</p></div></div>' +
      (button ? '<div class="actions"><button class="btn primary big" type="button" id="pdSignIn">' + esc(button) + '</button></div>' : '') + '</section>';
  }

  if (!C.clientId || !C.siteHostname || !C.dataFile) {
    show('Not connected yet', 'This page loads CIM’s supplier prices from SharePoint after you sign in. It hasn’t been connected to Microsoft 365 yet. IT: see setup/SETUP.md in the Purchasing Desk folder.');
    return;
  }
  if (!window.msal) { show('Sign-in didn’t load', 'Reload the page. If this keeps happening, tell IT the Microsoft sign-in library is missing.'); return; }

  var redirectUri = location.origin + location.pathname.replace(/index\.html$/, '');
  var pca = new msal.PublicClientApplication({
    auth: { clientId: C.clientId, authority: 'https://login.microsoftonline.com/' + (C.tenantId || 'organizations'), redirectUri: redirectUri },
    cache: { cacheLocation: 'localStorage' }
  });

  async function token(account) {
    try { return (await pca.acquireTokenSilent({ scopes: SCOPES, account: account })).accessToken; }
    catch (e) {
      if (e instanceof msal.InteractionRequiredAuthError) await pca.acquireTokenRedirect({ scopes: SCOPES, account: account });
      throw e;
    }
  }
  async function graph(t, url) {
    var res = await fetch(GRAPH + url, { headers: { Authorization: 'Bearer ' + t } });
    if (!res.ok) { var err = new Error('SharePoint said ' + res.status); err.status = res.status; throw err; }
    return res.json();
  }
  function addSignOut(account) {
    var wrap = document.querySelector('header.top .wrap'); if (!wrap) return;
    var span = document.createElement('span'); span.className = 'small muted'; span.textContent = account.name || account.username;
    var btn = document.createElement('button'); btn.className = 'btn small'; btn.type = 'button'; btn.textContent = 'Sign out';
    btn.addEventListener('click', function () { pca.logoutRedirect({ account: account, postLogoutRedirectUri: redirectUri }); });
    wrap.appendChild(span); wrap.appendChild(btn);
  }

  (async function () {
    try {
      await pca.initialize();
      var result = await pca.handleRedirectPromise();
      var account = (result && result.account) || pca.getAllAccounts()[0] || null;
      if (!account) {
        show('Sign in to see your prices', 'Use your Concepts in Millwork Microsoft 365 account. Your supplier prices are kept in SharePoint, not on this website.', 'Sign in');
        document.getElementById('pdSignIn').addEventListener('click', function () { pca.loginRedirect({ scopes: SCOPES }); });
        return;
      }
      pca.setActiveAccount(account);
      addSignOut(account);
      view.innerHTML = '<p class="muted">Loading your supplier prices…</p>';
      var t = await token(account);
      var site = await graph(t, '/sites/' + C.siteHostname + ':' + C.sitePath);
      var path = C.dataFile.split('/').map(encodeURIComponent).join('/');
      var item = await graph(t, '/sites/' + site.id + '/drive/root:/' + path + '?select=id,lastModifiedDateTime,@microsoft.graph.downloadUrl');
      var res = await fetch(item['@microsoft.graph.downloadUrl']);
      if (!res.ok) throw new Error('Download failed (' + res.status + ')');
      var data = await res.json();
      view.innerHTML = '';
      window.PD_APP(data);
    } catch (e) {
      var denied = e && (e.status === 403 || e.status === 404);
      show(denied ? 'You don’t have access to the prices' : 'The prices couldn’t be loaded',
        denied ? 'Your account can’t open the Purchasing Desk price file in SharePoint. Ask IT to give you access to it.'
               : 'Check your internet connection and reload the page. (' + ((e && e.message) || e) + ')');
    }
  })();
})();
