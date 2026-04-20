// RFC 9727 — API Catalog
// Advertises DAUB's APIs as a linkset+json document
export async function onRequestGet({ request }) {
  const origin = new URL(request.url).origin;

  const linkset = {
    linkset: [
      {
        anchor: `${origin}/api/mcp`,
        "service-desc": [
          { href: `${origin}/.well-known/mcp/server-card.json`, type: "application/json" }
        ],
        "service-doc": [
          { href: `${origin}/llms.txt`, type: "text/plain" }
        ],
        "describedby": [
          { href: `${origin}/.well-known/ai-plugin.json`, type: "application/json" }
        ]
      },
      {
        anchor: `${origin}/api/generate`,
        "service-doc": [
          { href: `${origin}/llms.txt`, type: "text/plain" }
        ]
      },
      {
        anchor: `${origin}/api/weblook`,
        "service-doc": [
          { href: `${origin}/llms.txt`, type: "text/plain" }
        ]
      }
    ]
  };

  return new Response(JSON.stringify(linkset, null, 2), {
    headers: {
      "Content-Type": "application/linkset+json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
