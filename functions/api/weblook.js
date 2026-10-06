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

// ── SSRF guard ──────────────────────────────────────────────────────────────
// Browserbase opens whatever URL we pass and we return its screenshot + HTML,
// so a URL that reaches loopback, private, link-local or cloud-metadata space
// would leak that page to the caller. Hostnames must already be WHATWG-parsed
// (new URL(...).hostname): the parser folds 2130706433, 0x7f.1, 0177.0.0.1 and
// 127.1 into 127.0.0.1 and writes IPv6 in compressed hex inside brackets.

const HOST_BLOCKED = { status: 400, error: 'URL host not allowed' };
const HOST_UNRESOLVED = { status: 400, error: 'Could not resolve URL host' };
// No web page committed (204, download, slow first byte): refuse without blaming the host
const PAGE_NOT_LOADED = { status: 502, error: 'Page capture failed: page did not load' };

// [network, prefix length]
const BLOCKED_V4 = [
  ['0.0.0.0', 8],       // "this network"
  ['10.0.0.0', 8],      // private
  ['100.64.0.0', 10],   // carrier-grade NAT (Alibaba metadata sits at 100.100.100.200)
  ['127.0.0.0', 8],     // loopback
  ['169.254.0.0', 16],  // link-local, AWS/GCP/Azure/OCI metadata
  ['172.16.0.0', 12],   // private
  ['192.0.0.0', 24],    // IETF protocol assignments
  ['192.168.0.0', 16],  // private
  ['198.18.0.0', 15],   // benchmarking
  ['224.0.0.0', 3],     // multicast 224/4, reserved 240/4, broadcast
].map(([net, bits]) => [parseIPv4(net), bits]);

function parseIPv4(str) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(str);
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  if (octets.some(o => o > 255)) return null;
  return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
}

// Returns 8 hextets, or null when the text is not an IPv6 address.
function parseIPv6(str) {
  let s = str.toLowerCase();
  const lastColon = s.lastIndexOf(':');
  if (lastColon === -1) return null;
  if (s.includes('.', lastColon)) {
    // Trailing dotted quad (::ffff:1.2.3.4) becomes two hextets
    const v4 = parseIPv4(s.slice(lastColon + 1));
    if (v4 === null) return null;
    s = s.slice(0, lastColon + 1) + (v4 >>> 16).toString(16) + ':' + (v4 & 0xffff).toString(16);
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const groupsOf = part => (part === '' ? [] : part.split(':'));
  const head = groupsOf(halves[0]);
  const tail = halves.length === 2 ? groupsOf(halves[1]) : [];
  let groups = head;
  if (halves.length === 2) {
    if (head.length + tail.length > 7) return null;
    groups = [...head, ...Array(8 - head.length - tail.length).fill('0'), ...tail];
  }
  if (groups.length !== 8 || !groups.every(g => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map(g => parseInt(g, 16));
}

function isBlockedIPv4(n) {
  return BLOCKED_V4.some(([net, bits]) => (n >>> (32 - bits)) === (net >>> (32 - bits)));
}

function isBlockedIPv6(h) {
  const zeros = (from, to) => h.slice(from, to).every(x => x === 0);
  const v4 = (hi, lo) => ((h[hi] << 16) | h[lo]) >>> 0;
  // Forms that carry an IPv4 address: decode it and re-check
  if (zeros(0, 5) && h[5] === 0xffff) return isBlockedIPv4(v4(6, 7));              // ::ffff:a.b.c.d mapped
  if (zeros(0, 4) && h[4] === 0xffff && h[5] === 0) return isBlockedIPv4(v4(6, 7)); // ::ffff:0:a.b.c.d translated
  if (h[0] === 0x64 && h[1] === 0xff9b && zeros(2, 6)) return isBlockedIPv4(v4(6, 7)); // 64:ff9b::/96 NAT64
  if (h[0] === 0x2002) return isBlockedIPv4(v4(1, 2));                                 // 2002::/16 6to4
  if (zeros(0, 6)) return true;                              // ::, ::1, ::a.b.c.d (deprecated IPv4-compatible)
  if (h[0] === 0x2001 && h[1] === 0) return true;            // 2001::/32 Teredo (embedded IPv4 is obfuscated)
  if (h[0] === 0x64 && h[1] === 0xff9b && h[2] === 1) return true; // 64:ff9b:1::/48 local-use NAT64
  if ((h[0] & 0xfe00) === 0xfc00) return true;               // fc00::/7 unique local (AWS metadata fd00:ec2::254)
  if ((h[0] & 0xffc0) === 0xfe80) return true;               // fe80::/10 link-local
  if ((h[0] & 0xffc0) === 0xfec0) return true;               // fec0::/10 deprecated site-local
  if ((h[0] & 0xff00) === 0xff00) return true;               // ff00::/8 multicast
  return false;
}

// Bare IPv4 or IPv6 text (DNS answers). Anything unparseable counts as blocked.
export function isBlockedIp(ip) {
  const v4 = parseIPv4(ip);
  if (v4 !== null) return isBlockedIPv4(v4);
  const v6 = parseIPv6(ip);
  return v6 === null || isBlockedIPv6(v6);
}

function isIpLiteral(hostname) {
  return hostname.startsWith('[') || parseIPv4(hostname) !== null;
}

// Literal check on a WHATWG-parsed hostname, no DNS.
export function isBlockedHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (h.startsWith('[') && h.endsWith(']')) return isBlockedIp(h.slice(1, -1));
  const name = h.replace(/\.+$/, ''); // "localhost." resolves like "localhost"
  if (!name) return true;
  const v4 = parseIPv4(name);
  if (v4 !== null) return isBlockedIPv4(v4);
  if (name.includes(':')) return isBlockedIp(name);
  // localhost, *.localhost, metadata.google.internal and every other *.internal
  return /(^|\.)(localhost|internal)$/.test(name);
}

// A and AAAA addresses via Cloudflare DNS-over-HTTPS. Throws when either lookup
// fails, so the caller can refuse a host it could not fully vet.
export async function resolveHost(hostname) {
  const name = hostname.replace(/\.+$/, '');
  const lookups = [['A', 1], ['AAAA', 28]].map(async ([type, code]) => {
    const res = await fetch(
      'https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(name) + '&type=' + type,
      { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) throw new Error('DoH ' + type + ' HTTP ' + res.status);
    const data = await res.json();
    // 0 = NOERROR, 3 = NXDOMAIN. SERVFAIL, REFUSED etc. leave the answer unknown.
    if (data.Status !== 0 && data.Status !== 3) throw new Error('DoH ' + type + ' status ' + data.Status);
    return (data.Answer || []).filter(a => a.type === code).map(a => String(a.data));
  });
  return (await Promise.all(lookups)).flat();
}

// null when the host is safe to open, otherwise { status, error } for the response.
export async function checkHost(hostname) {
  if (isBlockedHost(hostname)) return HOST_BLOCKED;
  if (isIpLiteral(hostname)) return null;
  let addresses;
  try {
    addresses = await resolveHost(hostname);
  } catch {
    return HOST_UNRESOLVED;
  }
  if (!addresses.length) return HOST_UNRESOLVED;
  return addresses.some(isBlockedIp) ? HOST_BLOCKED : null;
}

// Hostnames of every web page the tab committed, from CDP Page.getNavigationHistory.
// Entry URLs follow HTTP redirects, and a failed load keeps the URL it tried
// (location.href would read chrome-error://chromewebdata/). Returns null when the
// current entry is not an http(s) page, which the caller refuses as PAGE_NOT_LOADED.
export function navigationHosts(history) {
  const entries = (history && history.entries) || [];
  const current = entries[history && history.currentIndex];
  const web = url => {
    try {
      const u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:' ? u.hostname : null;
    } catch {
      return null;
    }
  };
  if (!current || !web(current.url)) return null;
  return [...new Set(entries.map(e => web(e.url)).filter(Boolean))];
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  if (env.RL_WEBLOOK) {
    try {
      const key = request.headers.get('CF-Connecting-IP') || 'unknown';
      const { success } = await env.RL_WEBLOOK.limit({ key });
      if (!success) return jsonResponse({ error: 'Rate limit exceeded — 30 req/min per IP' }, 429, corsHeaders);
    } catch {}
  }

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

  let target;
  try {
    target = new URL(url);
  } catch {
    return jsonResponse({ error: 'Valid URL required (must start with http:// or https://)' }, 400, corsHeaders);
  }

  // One verdict per hostname per request: the redirect check reuses the entry host's result
  const verdicts = new Map();
  const verifyHost = (hostname) => {
    if (!verdicts.has(hostname)) verdicts.set(hostname, checkHost(hostname));
    return verdicts.get(hostname);
  };
  const verdict = await verifyHost(target.hostname);
  if (verdict) {
    return jsonResponse({ error: verdict.error }, verdict.status, corsHeaders);
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
    const result = await runCDP(connectUrl, url, verifyHost);
    return jsonResponse(result, 200, corsHeaders);
  } catch (e) {
    if (e && e.verdict) {
      return jsonResponse({ error: e.verdict.error }, e.verdict.status, corsHeaders);
    }
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
async function runCDP(connectUrl, targetUrl, verifyHost) {
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

  function rejectAll(reason) {
    for (const { rej } of pending.values()) rej(new Error(reason));
    pending.clear();
  }
  ws.addEventListener('close', () => rejectAll('CDP WebSocket closed'));
  ws.addEventListener('error', () => rejectAll('CDP WebSocket error'));

  function call(payload) {
    const id = msgId++;
    return new Promise((res, rej) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        const err = new Error('CDP ' + payload.method + ' timed out');
        err.name = 'TimeoutError';
        rej(err);
      }, 20_000);
      pending.set(id, {
        res: (v) => { clearTimeout(timer); res(v); },
        rej: (e) => { clearTimeout(timer); rej(e); },
      });
      ws.send(JSON.stringify(Object.assign({ id }, payload)));
    });
  }

  function send(method, params = {}) {
    return call({ method, params });
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
        return call({ method, params, sessionId });
      }
      return send(method, params);
    }

    // A vetted URL can still redirect (HTTP 3xx, meta refresh, JS) to an internal
    // host, so vet every page the tab has committed before handing anything back.
    async function assertNavigationAllowed() {
      const hosts = navigationHosts(await pageSend('Page.getNavigationHistory'));
      const found = hosts ? (await Promise.all(hosts.map(verifyHost))).find(Boolean) : PAGE_NOT_LOADED;
      if (found) throw Object.assign(new Error(found.error), { verdict: found });
    }

    await pageSend('Page.enable');
    const loadPromise = waitForEvent('Page.loadEventFired', 15000);
    await pageSend('Page.navigate', { url: targetUrl });
    await loadPromise;

    // Small delay for JS rendering
    await new Promise(r => setTimeout(r, 1500));
    await assertNavigationAllowed();

    const titleResult = await pageSend('Runtime.evaluate', { expression: 'document.title', timeout: 10_000 });
    const title = (titleResult && titleResult.result && titleResult.result.value) || '';

    // Extract AI-friendly markdown from the page DOM
    const mdResult = await pageSend('Runtime.evaluate', { expression: DOM_TO_HTML_SCRIPT, timeout: 10_000 });
    const content = (mdResult && mdResult.result && mdResult.result.value) || '';

    const ssResult = await pageSend('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
    const screenshot = (ssResult && ssResult.data) || '';

    // Again after capture: the page may have navigated while we read it
    await assertNavigationAllowed();

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
