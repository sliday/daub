export async function onRequestGet({ request }) {
  const origin = new URL(request.url).origin;
  const metadata = {
    resource: origin,
    authorization_servers: [origin],
    scopes_supported: ["mcp:tools", "ui:generate", "ui:read", "blocks:read"],
    bearer_methods_supported: ["header"],
    resource_name: "DAUB API",
    resource_documentation: `${origin}/docs.html`,
    jwks_uri: `${origin}/.well-known/jwks.json`
  };

  return new Response(JSON.stringify(metadata, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
