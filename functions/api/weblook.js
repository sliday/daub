// Cloudflare Pages Function — Web Look (Browserbase proxy)
// POST /api/weblook  { url: "https://..." }

export async function onRequestPost(context) {
  const { request, env } = context;

  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = ['https://daub.dev', 'https://daub.pages.dev'];
  const isAllowed = allowedOrigins.some(o => origin === o || origin.endsWith('.daub.pages.dev'));
  const corsOrigin = isAllowed ? origin : allowedOrigins[0];

  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: jsonHeaders });
  }

  const url = (body.url || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return new Response(JSON.stringify({ error: 'Valid URL required (must start with http:// or https://)' }), { status: 400, headers: jsonHeaders });
  }

  const apiKey = env.BROWSERBASE_API_KEY;
  const projectId = env.BROWSERBASE_PROJECT_ID;
  if (!apiKey || !projectId) {
    return new Response(JSON.stringify({ error: 'Server misconfigured: missing Browserbase credentials' }), { status: 500, headers: jsonHeaders });
  }

  let connectUrl;
  try {
    const sessionRes = await fetch('https://api.browserbase.com/v1/sessions', {
      method: 'POST',
      headers: { 'X-BB-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    });
    if (!sessionRes.ok) {
      const errText = await sessionRes.text();
      return new Response(JSON.stringify({ error: 'Browserbase session failed: ' + errText }), { status: 502, headers: jsonHeaders });
    }
    const session = await sessionRes.json();
    connectUrl = session.connectUrl;
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to create browser session: ' + e.message }), { status: 502, headers: jsonHeaders });
  }

  try {
    const result = await runCDP(connectUrl, url);
    return new Response(JSON.stringify(result), { status: 200, headers: jsonHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Page capture failed: ' + e.message }), { status: 502, headers: jsonHeaders });
  }
}

// CF Workers WebSocket: use fetch() with Upgrade header, then resp.webSocket
async function runCDP(connectUrl, targetUrl) {
  const wsResp = await fetch(connectUrl, {
    headers: { Upgrade: 'websocket' },
  });
  const ws = wsResp.webSocket;
  if (!ws) throw new Error('WebSocket upgrade failed');
  ws.accept();

  let msgId = 1;
  const pending = new Map();
  const eventWaiters = new Map();

  ws.addEventListener('message', (evt) => {
    let msg;
    try { msg = JSON.parse(evt.data); } catch { return; }
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(msg.error.message));
      else res(msg.result);
    }
    if (msg.method && eventWaiters.has(msg.method)) {
      eventWaiters.get(msg.method)(msg.params);
    }
  });

  function send(method, params = {}) {
    const id = msgId++;
    return new Promise((res, rej) => {
      pending.set(id, { res, rej });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  function waitForEvent(name, timeoutMs = 15000) {
    return new Promise((res) => {
      const timer = setTimeout(() => {
        eventWaiters.delete(name);
        res(null);
      }, timeoutMs);
      eventWaiters.set(name, (params) => {
        clearTimeout(timer);
        eventWaiters.delete(name);
        res(params);
      });
    });
  }

  try {
    await send('Page.enable');
    const loadPromise = waitForEvent('Page.loadEventFired', 15000);
    await send('Page.navigate', { url: targetUrl });
    await loadPromise;

    // Small delay for JS rendering
    await new Promise(r => setTimeout(r, 1500));

    const titleResult = await send('Runtime.evaluate', { expression: 'document.title' });
    const title = (titleResult && titleResult.result && titleResult.result.value) || '';

    const textResult = await send('Runtime.evaluate', {
      expression: `(function() {
        var el = document.body;
        if (!el) return '';
        var text = el.innerText || el.textContent || '';
        return text.substring(0, 8000);
      })()`
    });
    const content = (textResult && textResult.result && textResult.result.value) || '';

    const ssResult = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
    const screenshot = (ssResult && ssResult.data) || '';

    try { ws.close(); } catch {}
    return { title, url: targetUrl, content, screenshot };
  } catch (e) {
    try { ws.close(); } catch {}
    throw e;
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://daub.dev',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
