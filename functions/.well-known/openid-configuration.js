export async function onRequestGet({ request }) {
  const origin = new URL(request.url).origin;
  const metadata = buildAuthorizationServerMetadata(origin);

  return json(metadata);
}

function buildAuthorizationServerMetadata(origin) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    jwks_uri: `${origin}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "client_credentials"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["mcp:tools", "ui:generate", "ui:read", "blocks:read"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    service_documentation: `${origin}/docs.html`
  };
}

function json(body) {
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
