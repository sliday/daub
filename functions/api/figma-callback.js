// Cloudflare Pages Function — Figma OAuth callback
// GET /api/figma-callback?code=...&state=...

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return htmlRedirect('Error: ' + error);
  }

  if (!code) {
    return htmlRedirect('No authorization code received');
  }

  const clientId = env.FIGMA_CLIENT_ID;
  const clientSecret = env.FIGMA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return htmlRedirect('Server misconfigured: missing Figma OAuth credentials');
  }

  // Exchange code for access token
  try {
    const basicAuth = btoa(clientId + ':' + clientSecret);
    const tokenRes = await fetch('https://api.figma.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + basicAuth,
      },
      body: new URLSearchParams({
        redirect_uri: new URL('/api/figma-callback', url.origin).toString(),
        code: code,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return htmlRedirect('Token exchange failed: ' + errText.substring(0, 200));
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || '';
    const expiresIn = tokenData.expires_in || 0;

    if (!accessToken) {
      return htmlRedirect('No access token in response');
    }

    // Return HTML that posts the token to the opener window and closes
    return new Response(tokenPage(accessToken, refreshToken, expiresIn), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (e) {
    return htmlRedirect('OAuth error: ' + e.message);
  }
}

function htmlRedirect(errorMsg) {
  return new Response(`<!DOCTYPE html><html><body><script>
    window.opener && window.opener.postMessage({ type: 'figma-oauth-error', error: ${JSON.stringify(errorMsg)} }, '*');
    window.close();
  </script><p>${errorMsg}</p></body></html>`, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function tokenPage(accessToken, refreshToken, expiresIn) {
  return `<!DOCTYPE html><html><body><script>
    window.opener && window.opener.postMessage({
      type: 'figma-oauth-success',
      accessToken: ${JSON.stringify(accessToken)},
      refreshToken: ${JSON.stringify(refreshToken)},
      expiresIn: ${expiresIn}
    }, window.location.origin);
    window.close();
  </script><p>Figma connected! This window should close automatically.</p></body></html>`;
}
