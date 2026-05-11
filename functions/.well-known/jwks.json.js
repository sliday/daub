export async function onRequestGet() {
  return new Response(JSON.stringify({ keys: [] }, null, 2), {
    headers: {
      "Content-Type": "application/jwk-set+json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
