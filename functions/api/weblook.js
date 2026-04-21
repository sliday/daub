// Cloudflare Pages Function — Web Look (Browserbase proxy)
// POST /api/weblook  { url: "https://..." }

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = ['https://daub.dev', 'https://daub.pages.dev'];
  const isAllowed = allowedOrigins.some(o => origin === o || origin.endsWith('.daub.pages.dev'));
  const corsOrigin = isAllowed ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  // Top-level safety net — always return JSON, never let CF serve HTML error page
  try {
    return await handleRequest(request, env, corsHeaders);
  } catch (e) {
    return jsonResponse({ error: 'Internal error: ' + (e.message || String(e)) }, 500, corsHeaders);
  }
}

async function handleRequest(request, env, corsHeaders) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400, corsHeaders);
  }

  const url = (body.url || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return jsonResponse({ error: 'Valid URL required (must start with http:// or https://)' }, 400, corsHeaders);
  }

  const apiKey = env.BROWSERBASE_API_KEY;
  const projectId = env.BROWSERBASE_PROJECT_ID;
  if (!apiKey || !projectId) {
    return jsonResponse({ error: 'Server misconfigured: missing Browserbase credentials' }, 500, corsHeaders);
  }

  // 1. Create Browserbase session
  let connectUrl;
  try {
    const sessionRes = await fetch('https://api.browserbase.com/v1/sessions', {
      method: 'POST',
      headers: { 'X-BB-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!sessionRes.ok) {
      const errText = await sessionRes.text();
      return jsonResponse({ error: 'Browserbase session failed: ' + errText.substring(0, 200) }, 502, corsHeaders);
    }
    const session = await sessionRes.json();
    connectUrl = session.connectUrl;
    if (!connectUrl) {
      return jsonResponse({ error: 'No connectUrl in session response' }, 502, corsHeaders);
    }
  } catch (e) {
    if (e && (e.name === 'AbortError' || e.name === 'TimeoutError')) {
      return jsonResponse({ error: 'Gateway Timeout: Browserbase session creation timed out' }, 504, corsHeaders);
    }
    return jsonResponse({ error: 'Session creation failed: ' + e.message }, 502, corsHeaders);
  }

  // 2. Connect via CDP WebSocket and capture page
  try {
    const result = await runCDP(connectUrl, url);
    return jsonResponse(result, 200, corsHeaders);
  } catch (e) {
    if (e && (e.name === 'AbortError' || e.name === 'TimeoutError')) {
      return jsonResponse({ error: 'Gateway Timeout: Browserbase CDP did not respond in time' }, 504, corsHeaders);
    }
    return jsonResponse({ error: 'Page capture failed: ' + e.message }, 502, corsHeaders);
  }
}

// Simplified HTML extraction script — runs inside the browser via Runtime.evaluate
// Preserves structural tags (grid, flex, sections) but strips noise (scripts, styles, tracking)
const DOM_TO_HTML_SCRIPT = `(function() {
  var SKIP = {SCRIPT:1,STYLE:1,NOSCRIPT:1,IFRAME:1,OBJECT:1,EMBED:1,TEMPLATE:1,LINK:1,META:1};
  var KEEP_ATTRS = ['class','id','href','src','alt','role','aria-label','type','placeholder',
    'data-theme','style','width','height','colspan','rowspan','for','name','value','action','method'];
  var VOID = {IMG:1,INPUT:1,BR:1,HR:1,META:1,LINK:1,AREA:1,COL:1};

  function simplifyStyle(style) {
    if (!style) return '';
    // Keep only layout-relevant CSS properties
    var keep = ['display','grid','flex','gap','justify','align','width','height','max-width',
      'min-height','padding','margin','position','top','left','right','bottom','grid-template',
      'grid-column','grid-row','flex-direction','flex-wrap','order','background-color','color',
      'font-size','font-weight','border-radius','overflow','text-align'];
    var parts = style.split(';').filter(function(p) {
      var prop = p.split(':')[0].trim().toLowerCase();
      return keep.some(function(k) { return prop.indexOf(k) === 0; });
    });
    return parts.length ? parts.join(';').trim() : '';
  }

  function walk(node) {
    if (!node) return '';
    if (node.nodeType === 3) {
      var t = node.textContent;
      if (!t || !t.trim()) return '';
      return t.replace(/\\s+/g, ' ');
    }
    if (node.nodeType === 8) return '';
    if (node.nodeType !== 1) return '';
    var tag = node.tagName;
    if (SKIP[tag]) return '';
    if (node.getAttribute('aria-hidden') === 'true') return '';
    if (node.hidden) return '';
    try {
      var cs = window.getComputedStyle(node);
      if (cs.display === 'none' || cs.visibility === 'hidden') return '';
    } catch(e) {}

    // SVG: just note it exists
    if (tag === 'SVG') {
      var label = node.getAttribute('aria-label') || '';
      return label ? '<svg aria-label="' + label + '"/>' : '';
    }

    var ltag = tag.toLowerCase();
    var attrs = '';
    for (var i = 0; i < KEEP_ATTRS.length; i++) {
      var a = KEEP_ATTRS[i];
      var v = node.getAttribute(a);
      if (!v) continue;
      if (a === 'style') { v = simplifyStyle(v); if (!v) continue; }
      if (a === 'class') { v = v.replace(/\\s+/g, ' ').trim(); if (!v) continue; }
      if (a === 'src' && v.startsWith('data:')) { v = '[data-uri]'; }
      attrs += ' ' + a + '="' + v.replace(/"/g, '&quot;').substring(0, 200) + '"';
    }

    // Also capture computed layout hints for divs/sections without explicit style
    if ((tag === 'DIV' || tag === 'SECTION' || tag === 'MAIN' || tag === 'NAV' || tag === 'HEADER' || tag === 'FOOTER' || tag === 'ASIDE') && !node.getAttribute('style')) {
      try {
        var cs2 = window.getComputedStyle(node);
        var d = cs2.display;
        if (d === 'flex' || d === 'grid' || d === 'inline-flex' || d === 'inline-grid') {
          var hint = 'display:' + d;
          if (d.indexOf('flex') >= 0) hint += ';flex-direction:' + cs2.flexDirection;
          if (d.indexOf('grid') >= 0 && cs2.gridTemplateColumns !== 'none') hint += ';grid-template-columns:' + cs2.gridTemplateColumns;
          if (cs2.gap && cs2.gap !== 'normal') hint += ';gap:' + cs2.gap;
          attrs += ' data-layout="' + hint + '"';
        }
      } catch(e) {}
    }

    if (VOID[tag]) return '<' + ltag + attrs + '/>';

    var children = node.childNodes;
    var inner = '';
    for (var j = 0; j < children.length; j++) {
      inner += walk(children[j]);
    }
    if (!inner.trim() && !VOID[tag]) return '';
    return '<' + ltag + attrs + '>' + inner + '</' + ltag + '>';
  }

  var root = document.querySelector('main, [role="main"], article') || document.body;
  if (!root) return '';
  var html = walk(root);
  return html.substring(0, 16000);
})()`;

// CF Workers outbound WebSocket via fetch + Upgrade header
async function runCDP(connectUrl, targetUrl) {
  // CF Workers fetch() requires https:// not wss:// for WebSocket upgrade
  const httpUrl = connectUrl.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
  const wsResp = await fetch(httpUrl, {
    headers: { Upgrade: 'websocket' },
    signal: AbortSignal.timeout(30_000),
  });

  const ws = wsResp.webSocket;
  if (!ws) {
    throw new Error('WebSocket upgrade failed (status ' + wsResp.status + ')');
  }
  ws.accept();

  let msgId = 1;
  const pending = new Map();
  const eventWaiters = new Map();

  ws.addEventListener('message', (evt) => {
    let msg;
    try { msg = JSON.parse(typeof evt.data === 'string' ? evt.data : new TextDecoder().decode(evt.data)); } catch { return; }
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
    // Browserbase connectUrl is a browser-level CDP endpoint.
    // We need to discover the page target and attach to it.
    const targets = await send('Target.getTargets');
    let pageTarget = null;
    if (targets && targets.targetInfos) {
      pageTarget = targets.targetInfos.find(t => t.type === 'page');
    }

    let sessionId = null;
    if (pageTarget) {
      // Attach to existing page target — get a sessionId for scoped commands
      const attached = await send('Target.attachToTarget', {
        targetId: pageTarget.targetId,
        flatten: true,
      });
      sessionId = attached.sessionId;
    }

    // Helper to send commands scoped to the page session
    function pageSend(method, params = {}) {
      if (sessionId) {
        const id = msgId++;
        return new Promise((res, rej) => {
          pending.set(id, { res, rej });
          ws.send(JSON.stringify({ id, method, params, sessionId }));
        });
      }
      return send(method, params);
    }

    await pageSend('Page.enable');
    const loadPromise = waitForEvent('Page.loadEventFired', 15000);
    await pageSend('Page.navigate', { url: targetUrl });
    await loadPromise;

    // Small delay for JS rendering
    await new Promise(r => setTimeout(r, 1500));

    const titleResult = await pageSend('Runtime.evaluate', { expression: 'document.title' });
    const title = (titleResult && titleResult.result && titleResult.result.value) || '';

    // Extract AI-friendly markdown from the page DOM
    const mdResult = await pageSend('Runtime.evaluate', { expression: DOM_TO_HTML_SCRIPT });
    const content = (mdResult && mdResult.result && mdResult.result.value) || '';

    const ssResult = await pageSend('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
    const screenshot = (ssResult && ssResult.data) || '';

    try { ws.close(); } catch {}
    return { title, url: targetUrl, content, screenshot };
  } catch (e) {
    try { ws.close(); } catch {}
    throw e;
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request),
  });
}
