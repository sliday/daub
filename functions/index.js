// Markdown for Agents — content negotiation on /
// Requests with Accept: text/markdown receive the llms-compact.txt
// as text/markdown; browsers (text/html) fall through to index.html.
export async function onRequestGet({ request, env, next }) {
  const accept = (request.headers.get("Accept") || "").toLowerCase();
  const wantsMarkdown =
    accept.includes("text/markdown") &&
    !accept.includes("text/html");

  if (!wantsMarkdown) {
    return next();
  }

  const url = new URL(request.url);
  const mdUrl = new URL("/llms-compact.txt", url.origin);
  const mdReq = new Request(mdUrl.toString(), { method: "GET" });

  const assets = env && env.ASSETS;
  const upstream = assets
    ? await assets.fetch(mdReq)
    : await fetch(mdReq);

  if (!upstream.ok) return next();

  const body = await upstream.text();
  const tokens = Math.ceil(body.length / 4);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Markdown-Tokens": String(tokens),
      "Vary": "Accept",
      "Cache-Control": "public, max-age=300, must-revalidate",
      "Access-Control-Allow-Origin": "*",
      "Link": '</llms.txt>; rel="service-doc"; type="text/plain", </components.json>; rel="describedby"; type="application/json", </.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json", </.well-known/agent-skills/index.json>; rel="agent-skills"; type="application/json", </.well-known/mcp/server-card.json>; rel="mcp-server"; type="application/json"'
    }
  });
}
