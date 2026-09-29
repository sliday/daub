// Cloudflare Pages Function: licensed stock-photo redirector for generated pages
// GET /api/photo?q=<1-6 words>&w=<16-2000>&h=<16-2000>[&i=<0-9>]
//   302 -> a CC0 / public-domain photo matching q (no attribution needed). The same (q, w, h, i) gives the same photo
//   while the search result is cached. Fallback chain: Openverse curated stock providers -> Wikimedia Commons CC0/PD ->
//   inline DAUB placeholder SVG. The Location host always comes from REDIRECT_HOSTS, never from the request.
// No key needed. Optional secrets OPENVERSE_CLIENT_ID / OPENVERSE_CLIENT_SECRET raise the Openverse limit.

const UA = 'DAUB/1.0 (+https://daub.dev; photo proxy; https://github.com/sliday/daub)';
const OPENVERSE = 'https://api.openverse.org/v1';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
// Openverse providers whose CC0 sets are modern stock photography (rawpixel PD set, WP Photo Directory, StockSnap, Nappy)
const STOCK_SOURCES = 'rawpixel,wordpress,stocksnap,nappy';
// Openverse images go through its cached thumbnail proxy, so the page never hotlinks rawpixel/StockSnap/WP directly.
const REDIRECT_HOSTS = new Set(['api.openverse.org', 'thumb.wikimedia.org', 'upload.wikimedia.org']);
const COMMONS_BUCKETS = [250, 330, 500, 960, 1280, 1920]; // upload.wikimedia.org answers 400 for other thumb widths
const HIT_TTL = 7 * 86400, EMPTY_TTL = 600, REDIRECT_TTL = 86400, FALLBACK_REDIRECT_TTL = 300;
const OPENVERSE_WAIT_MS = 3000, COMMONS_WAIT_MS = 2500, BREAKER_MS = 60000;
const CACHE_NAME = 'daub-photo-v1';
const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'with', 'in', 'on', 'at', 'of', 'for', 'to', 'from', 'by', 'photo', 'photograph', 'image', 'picture', 'product', 'shot', 'stock']);
const PREP = new Set(['with', 'in', 'on', 'at', 'of', 'for', 'from', 'by', 'to']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const BASE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Referrer-Policy': 'no-referrer', // applies to the redirected image fetch: third-party hosts never see the page URL
  'X-Content-Type-Options': 'nosniff',
};

// NFKD, strip diacritics, lowercase, keep [a-z0-9 -], at most 6 words; null unless one real (non-stop) word remains
export function normalizeQuery(raw) {
  if (typeof raw !== 'string' || raw.length > 120) return null;
  const s = raw.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const words = s.split(' ').filter(Boolean).slice(0, 6);
  if (!words.some(w => !STOP.has(w) && w.length > 1)) return null;
  return words.join(' ');
}

function intParam(v, lo, hi, dflt) {
  if (v == null || v === '') return dflt;
  if (!/^\d{1,5}$/.test(v)) return null;
  return Math.min(hi, Math.max(lo, Number(v)));
}

// Openverse matches every word, so widen: all content words -> phrase before the first preposition -> drop leading words.
// At most 3 upstream calls per query.
export function ladder(q) {
  const words = q.split(' ');
  const rungs = [words.filter(w => !STOP.has(w)).join(' ')];
  const pi = words.findIndex(w => PREP.has(w));
  let core = (pi > 0 ? words.slice(0, pi) : words).filter(w => !STOP.has(w));
  if (core.length) rungs.push(core.join(' '));
  while (core.length > 1) { core = core.slice(1); rungs.push(core.join(' ')); }
  return [...new Set(rungs)].filter(Boolean).slice(0, 3);
}

export function safeUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && !x.username && !x.password && !x.port && REDIRECT_HOSTS.has(x.hostname) ? x.toString() : null;
  } catch { return null; }
}

let ovDownUntil = 0; // per-isolate circuit breaker: after an Openverse error or timeout, misses go straight to Commons
let ovToken = null; // { token, exp } per isolate; optional registered Openverse app (100/min, 10k/day vs anonymous 20/min, 200/day)
async function openverseHeaders(env) {
  const h = { 'User-Agent': UA, Accept: 'application/json' };
  if (!env.OPENVERSE_CLIENT_ID || !env.OPENVERSE_CLIENT_SECRET) return h;
  try {
    if (!ovToken || ovToken.exp < Date.now()) {
      const r = await fetch(`${OPENVERSE}/auth_tokens/token/`, {
        method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.OPENVERSE_CLIENT_ID, client_secret: env.OPENVERSE_CLIENT_SECRET }),
        signal: AbortSignal.timeout(2000),
      });
      const j = await r.json();
      if (r.ok && j.access_token) ovToken = { token: j.access_token, exp: Date.now() + Math.max(60, (j.expires_in || 3600) - 300) * 1000 };
    }
    if (ovToken) h.Authorization = 'Bearer ' + ovToken.token;
  } catch {}
  return h;
}

async function searchOpenverse(q, env) {
  const headers = await openverseHeaders(env);
  for (const rung of ladder(q)) {
    const u = `${OPENVERSE}/images/?` + new URLSearchParams({ q: rung, license: 'cc0,pdm', extension: 'jpg', mature: 'false', page_size: '20', source: STOCK_SOURCES });
    const r = await fetch(u, { headers, signal: AbortSignal.timeout(8000) });
    if (r.status === 401) ovToken = null; // expired or revoked app token: fetch a new one next time
    if (!r.ok) throw Object.assign(new Error('openverse ' + r.status), { status: r.status });
    const j = await r.json();
    const hits = (j.results || []).filter(x => UUID.test(x.id) && ['cc0', 'pdm'].includes(x.license)).map(x => ({
      src: 'openverse', id: x.id, w: x.width || 0, h: x.height || 0, license: x.license, landing: x.foreign_landing_url,
    }));
    if (hits.length) return { src: 'openverse', rung, hits };
  }
  return { src: 'openverse', rung: null, hits: [] };
}

async function searchCommons(q) {
  for (const rung of ladder(q).slice(0, 2)) {
    const u = COMMONS + '?' + new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', generator: 'search', gsrnamespace: '6', gsrlimit: '20',
      gsrsearch: `${rung} filemime:image/jpeg filew:>799 haswbstatement:P275=Q6938433|P6216=Q19652`,
      prop: 'imageinfo', iiprop: 'url|size', iiurlwidth: '960',
    });
    const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(COMMONS_WAIT_MS) });
    if (!r.ok) throw new Error('commons ' + r.status);
    const j = await r.json();
    const hits = (j.query?.pages || []).sort((a, b) => a.index - b.index).map(p => {
      const ii = p.imageinfo?.[0] || {};
      const t = safeUrl(ii.thumburl);
      return t && /\/960px-/.test(t) ? { src: 'commons', id: String(p.pageid), w: ii.width || 0, h: ii.height || 0, license: 'cc0-or-pd', thumb: t.split('?')[0], landing: ii.descriptionurl } : null;
    }).filter(Boolean);
    if (hits.length) return { src: 'commons', rung, hits };
  }
  return { src: 'commons', rung: null, hits: [] };
}

// The i-th hit that matches the slot orientation (landscape if w >= 1.15h, portrait if h >= 1.15w), else the i-th hit
function pick(hits, w, h, i) {
  const want = w >= h * 1.15 ? 'land' : h >= w * 1.15 ? 'port' : 'any';
  const pref = want === 'any' ? hits : hits.filter(x => x.w && x.h && (want === 'land' ? x.w > x.h : x.h > x.w));
  const pool = pref.length > i ? pref : hits;
  return pool[i % pool.length];
}

function imageUrl(hit, w) {
  if (hit.src === 'openverse') {
    // thumb/ is 600px wide; full_size=true is the provider's copy (about 1024px for these sources), both cached by Openverse
    return `${OPENVERSE}/images/${hit.id}/thumb/` + (w > 600 ? '?full_size=true' : '');
  }
  const bucket = COMMONS_BUCKETS.find(b => b >= w) || 1920;
  return bucket <= hit.w ? hit.thumb.replace('/960px-', `/${bucket}px-`) : hit.thumb;
}

function placeholder(q, w, h, status, extra = {}) {
  const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  const r1 = v => Math.round(v * 10) / 10;
  const s = Math.min(w, h), g = Math.round(s * 0.18), cx = r1(w / 2), cy = r1(h / 2 - (q ? s * 0.05 : 0));
  const label = q ? `<text x="${cx}" y="${r1(cy + g * 1.1)}" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="${Math.max(10, Math.round(s * 0.06))}" fill="#2A2520" fill-opacity=".55">${esc(q)}</text>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(q || 'image')}">`
    + `<rect width="${w}" height="${h}" fill="#EDE7D4"/>`
    + `<g transform="translate(${r1(cx - g / 2)} ${r1(cy - g * 0.75)})" fill="#D4C4A8"><rect width="${g}" height="${r1(g * 0.75)}" rx="${r1(g * 0.08)}" fill="none" stroke="#D4C4A8" stroke-width="${r1(Math.max(1.5, g * 0.06))}"/>`
    + `<circle cx="${r1(g * 0.3)}" cy="${r1(g * 0.27)}" r="${r1(g * 0.08)}"/><path d="M${r1(g * 0.1)} ${r1(g * 0.65)} L${r1(g * 0.38)} ${r1(g * 0.38)} L${r1(g * 0.56)} ${r1(g * 0.55)} L${r1(g * 0.7)} ${r1(g * 0.45)} L${r1(g * 0.9)} ${r1(g * 0.65)} Z"/></g>${label}</svg>`;
  return new Response(svg, {
    status: 200,
    headers: { ...BASE_HEADERS, 'Content-Type': 'image/svg+xml; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'", 'Cache-Control': `public, max-age=${FALLBACK_REDIRECT_TTL}`, 'X-Photo-Status': status, ...extra },
  });
}

const safeHeader = s => String(s).replace(/[^\x20-\x7e]/g, '').slice(0, 300);

function redirect(hit, w, fromFallback, cacheState) {
  const loc = safeUrl(imageUrl(hit, w));
  if (!loc) return null;
  return new Response(null, {
    status: 302,
    headers: {
      ...BASE_HEADERS, Location: loc, 'Cache-Control': `public, max-age=${fromFallback ? FALLBACK_REDIRECT_TTL : REDIRECT_TTL}`,
      'X-Photo-Source': hit.src, 'X-Photo-License': hit.license, 'X-Photo-Status': cacheState, ...(hit.landing ? { 'X-Photo-Landing': safeHeader(hit.landing) } : {}),
    },
  });
}

// Named Cache API cache (never served to clients). Cache errors degrade to "no cache", never to a broken image.
async function openCache() {
  try { return await caches.open(CACHE_NAME); } catch { return null; }
}

async function cacheGet(cache, key) {
  try { const r = cache && await cache.match(key); return r ? await r.json() : null; } catch { return null; }
}

async function cachePut(cache, key, result, ttl) {
  if (!cache) return;
  try {
    await cache.put(key, new Response(JSON.stringify({ ...result, ttl }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttl}` } }));
  } catch {}
}

function raceTimeout(promise, ms) {
  let timer;
  const t = new Promise(r => { timer = setTimeout(() => r('timeout'), ms); });
  return Promise.race([promise, t]).finally(() => clearTimeout(timer));
}

export async function onRequestGet(context) {
  const { request, env = {} } = context;
  const url = new URL(request.url);
  const w = intParam(url.searchParams.get('w'), 16, 2000, 800);
  const h = intParam(url.searchParams.get('h'), 16, 2000, 600);
  const i = intParam(url.searchParams.get('i'), 0, 9, 0);
  const q = normalizeQuery(url.searchParams.get('q'));
  if (w == null || h == null || i == null || !q) return placeholder(q, w || 800, h || 600, 'invalid');

  const cache = await openCache();
  const key = new Request(`${url.origin}/api/photo/__cache/v1?q=${encodeURIComponent(q)}`); // the key is the normalised q only
  const cached = await cacheGet(cache, key);
  if (cached && Array.isArray(cached.hits)) {
    if (!cached.hits.length) return placeholder(q, w, h, 'cached-empty');
    return redirect(pick(cached.hits, w, h, i), w, cached.ttl < HIT_TTL, 'hit') || placeholder(q, w, h, 'bad-url');
  }

  // Only cache misses reach upstream, so only misses count against the per-IP limit (same 60/min as /api/generate).
  if (env.RL_PHOTO) {
    try {
      const { success } = await env.RL_PHOTO.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
      if (!success) return placeholder(q, w, h, 'rate-limited', { 'Cache-Control': 'no-store', 'Retry-After': '60' });
    } catch {}
  }

  let result = null, late = null;
  if (Date.now() >= ovDownUntil) {
    const ov = searchOpenverse(q, env).catch(e => {
      if (!e.status || e.status === 429 || e.status >= 500) ovDownUntil = Date.now() + BREAKER_MS; // not on a per-query 4xx
      return null;
    });
    result = await raceTimeout(ov, OPENVERSE_WAIT_MS);
    if (result === 'timeout') {
      // Openverse is slow: answer from Commons now, then let Openverse finish in the background and replace the entry.
      ovDownUntil = Date.now() + BREAKER_MS;
      late = ov;
      result = null;
    } else if (result) {
      await cachePut(cache, key, result, result.hits.length ? HIT_TTL : EMPTY_TTL);
    }
  }
  // Registered after any Commons write below, so a late Openverse answer always wins the cache slot.
  const finish = res => {
    if (late && context.waitUntil) context.waitUntil(late.then(r => r && r.hits.length && cachePut(cache, key, r, HIT_TTL)).catch(() => {}));
    return res;
  };
  if (result && result.hits.length) return redirect(pick(result.hits, w, h, i), w, false, 'miss') || placeholder(q, w, h, 'bad-url');

  const cm = await searchCommons(q).catch(() => null);
  if (cm && cm.hits.length) {
    // Openverse had no match: Commons is the stable answer. Openverse slow or down: hold Commons briefly, retry later.
    await cachePut(cache, key, cm, result ? HIT_TTL : FALLBACK_REDIRECT_TTL);
    return finish(redirect(pick(cm.hits, w, h, i), w, !result, 'miss-fallback') || placeholder(q, w, h, 'bad-url'));
  }
  return finish(placeholder(q, w, h, result || cm ? 'no-match' : 'upstream-down'));
}

export const onRequestHead = onRequestGet;

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { ...BASE_HEADERS, 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS', 'Access-Control-Max-Age': '86400' } });
}
