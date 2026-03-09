// Cloudflare Pages Function — Figma design extraction proxy
// GET  /api/figma          → returns { clientId } for OAuth initiation
// POST /api/figma          → { url, token } → design context extraction
// POST /api/figma?refresh  → { refreshToken } → new access token

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = ['https://daub.dev', 'https://daub.pages.dev'];
  const isAllowed = allowedOrigins.some(o => origin === o || origin.endsWith('.daub.pages.dev'));
  const corsOrigin = isAllowed ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const corsHeaders = getCorsHeaders(request);
  const clientId = env.FIGMA_CLIENT_ID || '';
  if (!clientId) return jsonResponse({ error: 'Figma OAuth not configured' }, 500, corsHeaders);
  return jsonResponse({ clientId }, 200, corsHeaders);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);
  try {
    const url = new URL(request.url);
    if (url.searchParams.has('refresh')) {
      return await handleRefresh(request, env, corsHeaders);
    }
    return await handleRequest(request, env, corsHeaders);
  } catch (e) {
    return jsonResponse({ error: 'Internal error: ' + (e.message || String(e)) }, 500, corsHeaders);
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request),
  });
}

async function handleRefresh(request, env, corsHeaders) {
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: 'Invalid JSON' }, 400, corsHeaders); }
  const refreshToken = (body.refreshToken || '').trim();
  if (!refreshToken) return jsonResponse({ error: 'refreshToken required' }, 400, corsHeaders);

  const clientId = env.FIGMA_CLIENT_ID;
  const clientSecret = env.FIGMA_CLIENT_SECRET;
  if (!clientId || !clientSecret) return jsonResponse({ error: 'Server misconfigured' }, 500, corsHeaders);

  const res = await fetch('https://api.figma.com/v1/oauth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }).toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    return jsonResponse({ error: 'Refresh failed: ' + t.substring(0, 200) }, 502, corsHeaders);
  }
  const data = await res.json();
  return jsonResponse({ accessToken: data.access_token, expiresIn: data.expires_in || 0 }, 200, corsHeaders);
}

// ---- URL parsing ----

function parseFigmaUrl(url) {
  // Supports:
  //   figma.com/file/KEY/Name
  //   figma.com/design/KEY/Name?node-id=1-2
  //   figma.com/design/KEY/Name/frame-name?node-id=1:2&mode=dev
  //   figma.com/proto/KEY/Name
  const m = url.match(/figma\.com\/(?:file|design|proto)\/([a-zA-Z0-9]+)/i);
  if (!m) return null;
  const fileKey = m[1];
  let nodeId = null;
  try {
    const u = new URL(url);
    const nid = u.searchParams.get('node-id');
    if (nid) nodeId = nid.replace(/-/g, ':');
  } catch {}
  return { fileKey, nodeId };
}

// ---- Design context extraction ----

function rgbaToHex(c) {
  if (!c) return '#000000';
  const r = Math.round((c.r || 0) * 255);
  const g = Math.round((c.g || 0) * 255);
  const b = Math.round((c.b || 0) * 255);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function extractDesignContext(fileData, nodeIds) {
  const doc = fileData.document || fileData;
  const rootNodes = [];

  if (nodeIds && fileData.nodes) {
    // /v1/file-nodes response
    for (const id of Object.keys(fileData.nodes)) {
      const n = fileData.nodes[id];
      if (n && n.document) rootNodes.push(n.document);
    }
  } else {
    // Full file — use first page or all pages
    const pages = (doc.children || []).filter(c => c.type === 'CANVAS');
    if (pages.length) rootNodes.push(pages[0]);
    else rootNodes.push(doc);
  }

  // Step 1: Color palette
  const colorCounts = {};
  function collectColors(node) {
    if (!node || node.visible === false) return;
    const fills = node.fills || [];
    for (const f of fills) {
      if (f.type === 'SOLID' && f.visible !== false) {
        const hex = rgbaToHex(f.color);
        colorCounts[hex] = (colorCounts[hex] || 0) + 1;
      }
    }
    for (const child of (node.children || [])) collectColors(child);
  }
  for (const root of rootNodes) collectColors(root);

  const topColors = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([hex, count]) => hex + ' (' + count + 'x)')
    .join(', ');

  // Step 2: Typography
  const typeStyles = {};
  function collectTypography(node) {
    if (!node || node.visible === false) return;
    if (node.type === 'TEXT' && node.style) {
      const s = node.style;
      const key = (s.fontFamily || 'Unknown') + ' ' + (s.fontSize || 14) + 'px/' + (s.fontWeight || 400);
      if (!typeStyles[key]) typeStyles[key] = { lh: s.lineHeightPx || null, count: 0 };
      typeStyles[key].count++;
    }
    for (const child of (node.children || [])) collectTypography(child);
  }
  for (const root of rootNodes) collectTypography(root);

  const topType = Object.entries(typeStyles)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)
    .map(([key, v]) => key + (v.lh ? ' lh:' + Math.round(v.lh) : ''))
    .join(', ');

  // Step 3: Layout hierarchy (compact pseudo-structure)
  const MAX_DEPTH = 6;
  const MAX_SIBLINGS = 10;

  function nodeToLayout(node, depth) {
    if (!node || node.visible === false) return '';
    if (depth > MAX_DEPTH) return '';

    const indent = '  '.repeat(depth);
    const type = node.type || 'UNKNOWN';
    const name = node.name || '';
    const w = node.absoluteBoundingBox ? Math.round(node.absoluteBoundingBox.width) : null;
    const h = node.absoluteBoundingBox ? Math.round(node.absoluteBoundingBox.height) : null;
    const dims = (w && h) ? ' (' + w + '\u00d7' + h : '';

    if (type === 'TEXT') {
      const s = node.style || {};
      const chars = (node.characters || '').substring(0, 40);
      const fill = (node.fills || []).find(f => f.type === 'SOLID' && f.visible !== false);
      const color = fill ? ' ' + rgbaToHex(fill.color) : '';
      return indent + 'TEXT "' + chars + '" (' + (s.fontSize || 14) + '/' + (s.fontWeight || 400) + color + ')\n';
    }

    if (type === 'RECTANGLE' || type === 'ELLIPSE' || type === 'LINE' || type === 'VECTOR') {
      const fill = (node.fills || []).find(f => f.type === 'SOLID' && f.visible !== false);
      const fillStr = fill ? ', fill:' + rgbaToHex(fill.color) : '';
      const r = node.cornerRadius ? ', r:' + node.cornerRadius : '';
      return indent + type + ' "' + name + '"' + dims + fillStr + r + ')\n';
    }

    if (type === 'IMAGE' || (node.fills || []).some(f => f.type === 'IMAGE')) {
      return indent + 'IMAGE "' + name + '"' + dims + ')\n';
    }

    // FRAME, GROUP, COMPONENT, INSTANCE, etc.
    const children = (node.children || []).filter(c => c.visible !== false);

    // Collapse single-child groups
    if ((type === 'GROUP' || type === 'FRAME') && children.length === 1) {
      return nodeToLayout(children[0], depth);
    }

    let meta = '';
    if (type === 'INSTANCE' && node.componentId) {
      meta += ', component';
    }
    if (node.layoutMode) {
      meta += ', ' + (node.layoutMode === 'HORIZONTAL' ? 'horizontal' : 'vertical');
      if (node.paddingLeft || node.paddingTop) {
        const pads = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft]
          .map(v => v || 0);
        meta += ', pad:' + pads.join('/');
      }
      if (node.itemSpacing) meta += ', gap:' + node.itemSpacing;
    }

    const fill = (node.fills || []).find(f => f.type === 'SOLID' && f.visible !== false);
    if (fill) meta += ', fill:' + rgbaToHex(fill.color);
    if (node.cornerRadius) meta += ', r:' + node.cornerRadius;

    let line = indent + type + ' "' + name + '"' + dims + meta + ')\n';

    let childLines = '';
    const shown = children.slice(0, MAX_SIBLINGS);
    const extra = children.length - shown.length;
    for (const child of shown) {
      childLines += nodeToLayout(child, depth + 1);
    }
    if (extra > 0) {
      childLines += indent + '  ... +' + extra + ' more\n';
    }

    return line + childLines;
  }

  let layout = '';
  for (const root of rootNodes) {
    const children = (root.children || []).filter(c => c.visible !== false);
    for (const child of children.slice(0, 5)) {
      layout += nodeToLayout(child, 0);
    }
  }
  // Truncate if too long
  if (layout.length > 5000) layout = layout.substring(0, 5000) + '\n... (truncated)\n';

  // Step 4: Components used
  const components = new Set();
  function collectComponents(node) {
    if (!node || node.visible === false) return;
    if (node.type === 'INSTANCE' && node.name) components.add(node.name);
    for (const child of (node.children || [])) collectComponents(child);
  }
  for (const root of rootNodes) collectComponents(root);
  const componentList = [...components].slice(0, 20).join(', ');

  // Assemble
  let context = '';
  if (topColors) context += 'Colors: ' + topColors + '\n\n';
  if (topType) context += 'Typography: ' + topType + '\n\n';
  if (layout) context += 'Layout:\n' + layout + '\n';
  if (componentList) context += 'Components: ' + componentList + '\n';

  return context.trim();
}

// ---- Main handler ----

async function handleRequest(request, env, corsHeaders) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400, corsHeaders);
  }

  const url = (body.url || '').trim();
  const token = (body.token || '').trim();

  if (!token) {
    return jsonResponse({ error: 'Figma personal access token required' }, 400, corsHeaders);
  }

  const parsed = parseFigmaUrl(url);
  if (!parsed) {
    return jsonResponse({ error: 'Not a valid Figma URL. Expected figma.com/file/... or figma.com/design/...' }, 400, corsHeaders);
  }

  const { fileKey, nodeId } = parsed;
  // OAuth tokens use Bearer auth; personal access tokens use X-Figma-Token
  const figmaHeaders = token.startsWith('figd_')
    ? { 'X-Figma-Token': token }
    : { 'Authorization': 'Bearer ' + token };

  // 1. Fetch file data
  let fileData;
  try {
    let apiUrl;
    if (nodeId) {
      apiUrl = 'https://api.figma.com/v1/files/' + fileKey + '/nodes?ids=' + encodeURIComponent(nodeId) + '&depth=4';
    } else {
      apiUrl = 'https://api.figma.com/v1/files/' + fileKey + '?depth=4';
    }

    const res = await fetch(apiUrl, { headers: figmaHeaders });
    if (res.status === 403) return jsonResponse({ error: 'Invalid or expired Figma token' }, 403, corsHeaders);
    if (res.status === 404) return jsonResponse({ error: 'Figma file not found' }, 404, corsHeaders);
    if (res.status === 429) return jsonResponse({ error: 'Figma API rate limited — try again shortly' }, 429, corsHeaders);
    if (!res.ok) {
      const t = await res.text();
      return jsonResponse({ error: 'Figma API error: ' + t.substring(0, 200) }, 502, corsHeaders);
    }
    fileData = await res.json();
  } catch (e) {
    return jsonResponse({ error: 'Failed to fetch Figma file: ' + e.message }, 502, corsHeaders);
  }

  const fileName = fileData.name || 'Untitled';
  const designContext = extractDesignContext(fileData, nodeId ? [nodeId] : null);

  // 2. Screenshot — find root node ID for image export
  let screenshot = '';
  try {
    let imageNodeId = nodeId;
    if (!imageNodeId) {
      // Use first page's first top-level frame
      const doc = fileData.document || fileData;
      const pages = (doc.children || []).filter(c => c.type === 'CANVAS');
      if (pages.length && pages[0].children && pages[0].children.length) {
        imageNodeId = pages[0].children[0].id;
      }
    }

    if (imageNodeId) {
      const imgRes = await fetch(
        'https://api.figma.com/v1/images/' + fileKey + '?ids=' + encodeURIComponent(imageNodeId) + '&format=png&scale=1',
        { headers: figmaHeaders }
      );
      if (imgRes.ok) {
        const imgData = await imgRes.json();
        const imgUrl = imgData.images && imgData.images[Object.keys(imgData.images)[0]];
        if (imgUrl) {
          const pngRes = await fetch(imgUrl);
          if (pngRes.ok) {
            const buf = await pngRes.arrayBuffer();
            if (buf.byteLength <= 500 * 1024) {
              screenshot = btoa(String.fromCharCode(...new Uint8Array(buf)));
            } else {
              // Retry at half scale
              const imgRes2 = await fetch(
                'https://api.figma.com/v1/images/' + fileKey + '?ids=' + encodeURIComponent(imageNodeId) + '&format=png&scale=0.5',
                { headers: figmaHeaders }
              );
              if (imgRes2.ok) {
                const imgData2 = await imgRes2.json();
                const imgUrl2 = imgData2.images && imgData2.images[Object.keys(imgData2.images)[0]];
                if (imgUrl2) {
                  const pngRes2 = await fetch(imgUrl2);
                  if (pngRes2.ok) {
                    const buf2 = await pngRes2.arrayBuffer();
                    if (buf2.byteLength <= 500 * 1024) {
                      screenshot = btoa(String.fromCharCode(...new Uint8Array(buf2)));
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch {
    // Graceful degradation — return without screenshot
  }

  return jsonResponse({
    name: fileName,
    url: url,
    designContext: designContext,
    screenshot: screenshot,
  }, 200, corsHeaders);
}
