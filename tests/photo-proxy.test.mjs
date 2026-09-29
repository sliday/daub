import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Fresh module per test: the Openverse circuit breaker and app token live at module scope.
let seq = 0;
const load = () => import(`../functions/api/photo.js?fresh=${++seq}`);

const BASE = 'https://daub.dev/api/photo';
const ALLOWED = new Set(['api.openverse.org', 'thumb.wikimedia.org', 'upload.wikimedia.org']);
const DAY = 86400, WEEK = 7 * 86400;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

// Replace global fetch for one test; returns the list of calls it saw
function mockFetch(t, handler) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url, init);
  };
  t.after(() => { globalThis.fetch = original; });
  return calls;
}

// In-memory stand-in for the Workers Cache API (caches.open(name) -> match/put by URL)
function mockCaches(t, { broken = false } = {}) {
  const stores = new Map();
  const original = globalThis.caches;
  globalThis.caches = {
    async open(name) {
      if (broken) throw new Error('cache unavailable');
      if (!stores.has(name)) stores.set(name, new Map());
      const m = stores.get(name);
      return {
        async match(req) {
          const e = m.get(req.url);
          return e ? new Response(e.body, { headers: e.headers }) : undefined;
        },
        async put(req, res) {
          m.set(req.url, { body: await res.text(), headers: Object.fromEntries(res.headers) });
        },
      };
    },
  };
  t.after(() => { if (original === undefined) delete globalThis.caches; else globalThis.caches = original; });
  return stores;
}

// Route mocked upstream calls by host. Each handler gets the search term and returns a Response (or throws).
function upstream({ openverse, commons, token } = {}) {
  return (url, init) => {
    const u = new URL(url);
    if (u.hostname === 'api.openverse.org' && u.pathname === '/v1/auth_tokens/token/') return token(init);
    if (u.hostname === 'api.openverse.org') return openverse ? openverse(u.searchParams.get('q'), u, init) : json({ results: [] });
    if (u.hostname === 'commons.wikimedia.org') return commons ? commons(u.searchParams.get('gsrsearch'), u, init) : json({ query: { pages: [] } });
    throw new Error('unexpected fetch ' + url);
  };
}

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ovHit = (n, w, h, extra = {}) => ({ id: uuid(n), license: 'cc0', width: w, height: h, foreign_landing_url: `https://stocksnap.io/photo/${n}`, ...extra });
// Landscape, portrait, landscape, portrait, square
const OV = [ovHit(1, 1200, 800), ovHit(2, 800, 1200), ovHit(3, 1200, 800), ovHit(4, 800, 1200), ovHit(5, 1000, 1000)];
const ovThumb = (n, full) => `https://api.openverse.org/v1/images/${uuid(n)}/thumb/` + (full ? '?full_size=true' : '');

const cmPage = (n, { host = 'upload.wikimedia.org', proto = 'https', width = 4000, height = 3000 } = {}) => ({
  pageid: 100 + n, index: n,
  imageinfo: [{ thumburl: `${proto}://${host}/wikipedia/commons/thumb/a/ab/Cake_${n}.jpg/960px-Cake_${n}.jpg`, width, height, descriptionurl: `https://commons.wikimedia.org/wiki/File:Cake_${n}.jpg` }],
});
const cmThumb = (n, px) => `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Cake_${n}.jpg/${px}px-Cake_${n}.jpg`;

function ctx(qs, { env = {}, method = 'GET', ip = '203.0.113.7' } = {}) {
  const waits = [];
  return { request: new Request(BASE + qs, { method, headers: { 'CF-Connecting-IP': ip } }), env, waitUntil: p => waits.push(p), waits };
}

const isSvg = r => r.status === 200 && /^image\/svg\+xml/.test(r.headers.get('content-type')) && !r.headers.get('location');
const ovCalls = calls => calls.filter(c => c.url.startsWith('https://api.openverse.org/v1/images/'));
const cmCalls = calls => calls.filter(c => c.url.startsWith('https://commons.wikimedia.org/'));

describe('normalizeQuery', async () => {
  const { normalizeQuery } = await load();
  it('folds case, diacritics and punctuation', () => {
    assert.equal(normalizeQuery('  Crème BRÛLÉE!! '), 'creme brulee');
    assert.equal(normalizeQuery('latte-art, in a cup'), 'latte-art in a cup');
  });
  it('keeps at most 6 words', () => {
    assert.equal(normalizeQuery('one two three four five six seven eight'), 'one two three four five six');
  });
  it('rejects empty, stopword-only, single-letter, non-string and over-long input', () => {
    for (const bad of [null, undefined, 42, '', '   ', 'the of a photo', 'x', '!!!', 'a'.repeat(121)]) assert.equal(normalizeQuery(bad), null, String(bad));
  });
  it('reduces markup and URLs to plain words', () => {
    assert.equal(normalizeQuery('<script>alert(1)</script> cake'), 'script alert 1 script cake');
    assert.equal(normalizeQuery('https://evil.example/x.jpg'), 'https evil example x jpg');
  });
});

describe('ladder', async () => {
  const { ladder } = await load();
  it('widens a multi-word query in at most 3 rungs', () => {
    assert.deepEqual(ladder('white leather sneaker'), ['white leather sneaker', 'leather sneaker', 'sneaker']);
    assert.deepEqual(ladder('hotel room with ocean view'), ['hotel room ocean view', 'hotel room', 'room']);
    assert.deepEqual(ladder('pasta carbonara'), ['pasta carbonara', 'carbonara']);
    assert.deepEqual(ladder('cake'), ['cake']);
  });
});

describe('safeUrl (redirect host allowlist)', async () => {
  const { safeUrl } = await load();
  it('accepts https on the three image hosts', () => {
    assert.ok(safeUrl(ovThumb(1)));
    assert.ok(safeUrl(cmThumb(1, 960)));
    assert.ok(safeUrl('https://thumb.wikimedia.org/x.jpg'));
  });
  it('rejects other schemes, hosts, ports, userinfo and lookalikes', () => {
    for (const bad of [
      'http://api.openverse.org/v1/images/x/thumb/', 'https://evil.example/x.jpg', 'https://upload.wikimedia.org.evil.example/x.jpg',
      'https://user:pw@upload.wikimedia.org/x.jpg', 'https://upload.wikimedia.org:8443/x.jpg', 'javascript:alert(1)',
      'data:image/svg+xml,<svg/>', '//upload.wikimedia.org/x.jpg', '', undefined,
    ]) assert.equal(safeUrl(bad), null, String(bad));
  });
});

describe('input validation', () => {
  for (const [label, qs] of [
    ['missing q', '?w=640&h=480'], ['stopwords only', '?q=the%20of%20a'], ['non-numeric w', '?q=cake&w=abc&h=480'],
    ['negative h', '?q=cake&w=640&h=-5'], ['exponent w', '?q=cake&w=1e3'], ['non-numeric i', '?q=cake&i=x'],
    ['q too long', '?q=' + 'a'.repeat(130)],
  ]) {
    it(`${label} -> SVG placeholder, no upstream call`, async t => {
      const mod = await load();
      mockCaches(t);
      const calls = mockFetch(t, upstream());
      const r = await mod.onRequestGet(ctx(qs));
      assert.ok(isSvg(r));
      assert.equal(r.headers.get('x-photo-status'), 'invalid');
      assert.match(r.headers.get('content-security-policy'), /default-src 'none'/);
      const body = await r.text();
      assert.doesNotMatch(body, /<script|onload\s*=/i);
      assert.equal(calls.length, 0);
    });
  }

  it('markup in q never reaches the SVG as markup', async t => {
    const mod = await load();
    mockCaches(t);
    mockFetch(t, upstream());
    const r = await mod.onRequestGet(ctx('?q=' + encodeURIComponent('<svg onload=alert(1)><script>x</script>') + '&w=320&h=240'));
    assert.ok(isSvg(r));
    assert.equal(r.headers.get('x-photo-status'), 'no-match');
    const body = await r.text();
    assert.doesNotMatch(body, /<script|onload\s*=|<svg onload/i);
    assert.match(body, />svg onload alert 1 script x</); // 6-word cap
  });

  it('clamps w and h to 16..2000', async t => {
    const mod = await load();
    mockCaches(t);
    mockFetch(t, upstream());
    const r = await mod.onRequestGet(ctx('?q=zzqxv%20plorfnik&w=5000&h=1'));
    const body = await r.text();
    assert.match(body, /^<svg [^>]*width="2000" height="16"/);
  });
});

describe('redirects and determinism', () => {
  it('miss -> 302 to the Openverse thumb proxy, with licence headers and a day of browser cache', async t => {
    const mod = await load();
    mockCaches(t);
    const calls = mockFetch(t, upstream({ openverse: () => json({ results: OV }) }));
    const r = await mod.onRequestGet(ctx('?q=blueberry%20pancakes&w=640&h=480'));
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('location'), ovThumb(1, true));
    assert.equal(r.headers.get('x-photo-source'), 'openverse');
    assert.equal(r.headers.get('x-photo-license'), 'cc0');
    assert.equal(r.headers.get('x-photo-status'), 'miss');
    assert.equal(r.headers.get('x-photo-landing'), 'https://stocksnap.io/photo/1');
    assert.equal(r.headers.get('cache-control'), `public, max-age=${DAY}`);
    const u = new URL(ovCalls(calls)[0].url);
    assert.equal(u.searchParams.get('q'), 'blueberry pancakes');
    assert.equal(u.searchParams.get('license'), 'cc0,pdm');
    assert.equal(u.searchParams.get('source'), 'rawpixel,wordpress,stocksnap,nappy');
    assert.equal(u.searchParams.get('mature'), 'false');
    assert.equal(u.searchParams.get('extension'), 'jpg');
    assert.match(ovCalls(calls)[0].init.headers['User-Agent'], /^DAUB\//);
    assert.equal(cmCalls(calls).length, 0);
  });

  it('same (q,w,h,i) gives the same Location; normalised variants share it; i picks another photo', async t => {
    const mod = await load();
    mockCaches(t);
    const calls = mockFetch(t, upstream({ openverse: () => json({ results: OV }) }));
    const a = await mod.onRequestGet(ctx('?q=blueberry%20pancakes&w=640&h=480'));
    const b = await mod.onRequestGet(ctx('?q=blueberry%20pancakes&w=640&h=480'));
    const c = await mod.onRequestGet(ctx('?q=%20Blueberry%20PANCAKES!!&w=640&h=480'));
    const d = await mod.onRequestGet(ctx('?q=blueberry%20pancakes&w=640&h=480&i=1'));
    assert.equal(b.headers.get('location'), a.headers.get('location'));
    assert.equal(c.headers.get('location'), a.headers.get('location'));
    assert.equal(d.headers.get('location'), ovThumb(3, true)); // 2nd landscape hit
    for (const r of [b, c, d]) assert.equal(r.headers.get('x-photo-status'), 'hit');
    assert.equal(ovCalls(calls).length, 1, 'one upstream search serves every size and index');
  });

  it('picks by slot orientation and serves 600px thumbs up to w=600', async t => {
    const mod = await load();
    mockCaches(t);
    mockFetch(t, upstream({ openverse: () => json({ results: OV }) }));
    const loc = async qs => (await mod.onRequestGet(ctx(qs))).headers.get('location');
    assert.equal(await loc('?q=cake&w=400&h=600'), ovThumb(2)); // portrait slot -> 1st portrait hit
    assert.equal(await loc('?q=cake&w=400&h=600&i=1'), ovThumb(4)); // 2nd portrait hit
    assert.equal(await loc('?q=cake&w=500&h=500&i=4'), ovThumb(5)); // square slot -> i-th hit of all
    assert.equal(await loc('?q=cake&w=600&h=400'), ovThumb(1)); // landscape, thumb
    assert.equal(await loc('?q=cake&w=601&h=400'), ovThumb(1, true)); // wider -> provider copy
    assert.equal(await loc('?q=cake&w=400&h=600&i=5'), ovThumb(1)); // not enough portraits -> i-th of all (wraps)
    assert.equal(await loc('?q=cake&w=640&h=480&i=15'), await loc('?q=cake&w=640&h=480&i=9')); // i clamps to 0..9
  });

  it('defaults to 800x600 when w and h are absent', async t => {
    const mod = await load();
    mockCaches(t);
    mockFetch(t, upstream({ openverse: () => json({ results: OV }) }));
    const r = await mod.onRequestGet(ctx('?q=cake'));
    assert.equal(r.headers.get('location'), ovThumb(1, true));
  });

  it('walks the ladder until a rung matches', async t => {
    const mod = await load();
    mockCaches(t);
    const calls = mockFetch(t, upstream({ openverse: q => json({ results: q === 'leather sneaker' ? OV : [] }) }));
    const r = await mod.onRequestGet(ctx('?q=white%20leather%20sneaker&w=640&h=480'));
    assert.equal(r.status, 302);
    assert.deepEqual(ovCalls(calls).map(c => new URL(c.url).searchParams.get('q')), ['white leather sneaker', 'leather sneaker']);
  });

  it('drops Openverse hits without a UUID id or a CC0/PDM licence', async t => {
    const mod = await load();
    mockCaches(t);
    mockFetch(t, upstream({ openverse: () => json({ results: [
      { id: '../../evil.example', license: 'cc0', width: 1200, height: 800 },
      ovHit(9, 1200, 800, { license: 'by' }),
      ovHit(3, 1200, 800),
    ] }) }));
    const r = await mod.onRequestGet(ctx('?q=cake&w=640&h=480'));
    assert.equal(r.headers.get('location'), ovThumb(3, true));
  });
});

describe('Commons fallback and allowlist', () => {
  it('Openverse finds nothing -> Commons hit, cached for a week, sized to the nearest thumb bucket', async t => {
    const mod = await load();
    const stores = mockCaches(t);
    const calls = mockFetch(t, upstream({ commons: () => json({ query: { pages: [cmPage(1), cmPage(2, { width: 1000, height: 700 })] } }) }));
    const r = await mod.onRequestGet(ctx('?q=chocolate%20layer%20cake&w=640&h=480'));
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('location'), cmThumb(1, 960));
    assert.equal(r.headers.get('x-photo-source'), 'commons');
    assert.equal(r.headers.get('x-photo-license'), 'cc0-or-pd');
    assert.equal(r.headers.get('x-photo-status'), 'miss-fallback');
    assert.equal(r.headers.get('cache-control'), `public, max-age=${DAY}`);
    const gsr = new URL(cmCalls(calls)[0].url).searchParams.get('gsrsearch');
    assert.match(gsr, /^chocolate layer cake filemime:image\/jpeg filew:>799 haswbstatement:P275=Q6938433\|P6216=Q19652$/);
    const entry = JSON.parse([...stores.get('daub-photo-v1').values()][0].body);
    assert.equal(entry.ttl, WEEK);

    const loc = async qs => (await mod.onRequestGet(ctx(qs))).headers.get('location');
    assert.equal(await loc('?q=chocolate%20layer%20cake&w=200&h=150'), cmThumb(1, 250));
    assert.equal(await loc('?q=chocolate%20layer%20cake&w=1200&h=900'), cmThumb(1, 1280));
    assert.equal(await loc('?q=chocolate%20layer%20cake&w=1200&h=900&i=1'), cmThumb(2, 960)); // original too narrow for 1280
  });

  it('drops Commons thumbs off the allowlist or not on https', async t => {
    const mod = await load();
    mockCaches(t);
    mockFetch(t, upstream({ commons: () => json({ query: { pages: [
      cmPage(1, { host: 'evil.example' }), cmPage(2, { proto: 'http' }), cmPage(3, { host: 'upload.wikimedia.org.evil.example' }),
    ] } }) }));
    const r = await mod.onRequestGet(ctx('?q=cake&w=640&h=480'));
    assert.ok(isSvg(r));
    assert.equal(r.headers.get('x-photo-status'), 'no-match');
  });

  it('a URL-looking q never redirects off the allowlist', async t => {
    const mod = await load();
    mockCaches(t);
    mockFetch(t, upstream({ openverse: () => json({ results: OV }) }));
    const r = await mod.onRequestGet(ctx('?q=' + encodeURIComponent('https://evil.example/x.jpg') + '&w=640&h=480'));
    assert.ok(ALLOWED.has(new URL(r.headers.get('location')).hostname));
  });
});

describe('source-down fallback', () => {
  it('Openverse 5xx -> Commons, held 5 minutes, and the breaker skips Openverse on the next miss', async t => {
    const mod = await load();
    const stores = mockCaches(t);
    const calls = mockFetch(t, upstream({ openverse: () => json({ detail: 'down' }, 503), commons: () => json({ query: { pages: [cmPage(1)] } }) }));
    const a = await mod.onRequestGet(ctx('?q=cake&w=640&h=480'));
    assert.equal(a.status, 302);
    assert.equal(a.headers.get('x-photo-source'), 'commons');
    assert.equal(a.headers.get('cache-control'), 'public, max-age=300');
    assert.equal(JSON.parse([...stores.get('daub-photo-v1').values()][0].body).ttl, 300);
    assert.equal(ovCalls(calls).length, 1);

    const b = await mod.onRequestGet(ctx('?q=pasta%20carbonara&w=640&h=480'));
    assert.equal(b.headers.get('x-photo-source'), 'commons');
    assert.equal(ovCalls(calls).length, 1, 'breaker open: no second Openverse call');

    const c = await mod.onRequestGet(ctx('?q=cake&w=640&h=480'));
    assert.equal(c.headers.get('x-photo-status'), 'hit');
    assert.equal(c.headers.get('cache-control'), 'public, max-age=300', 'fallback entries keep the short redirect TTL');
  });

  for (const [label, fail, trips] of [
    ['429', () => json({}, 429), true],
    ['network error', () => { throw new TypeError('network'); }, true],
    ['per-query 400', () => json({}, 400), false],
  ]) {
    it(`Openverse ${label} ${trips ? 'trips' : 'does not trip'} the breaker`, async t => {
      const mod = await load();
      mockCaches(t);
      const calls = mockFetch(t, upstream({ openverse: fail, commons: () => json({ query: { pages: [cmPage(1)] } }) }));
      const a = await mod.onRequestGet(ctx('?q=cake'));
      assert.equal(a.headers.get('x-photo-source'), 'commons');
      await mod.onRequestGet(ctx('?q=bread'));
      assert.equal(ovCalls(calls).length, trips ? 1 : 2);
    });
  }

  it('both upstreams down -> placeholder, nothing cached', async t => {
    const mod = await load();
    const stores = mockCaches(t);
    mockFetch(t, upstream({ openverse: () => json({}, 500), commons: () => { throw new TypeError('network'); } }));
    const r = await mod.onRequestGet(ctx('?q=cake&w=640&h=480'));
    assert.ok(isSvg(r));
    assert.equal(r.headers.get('x-photo-status'), 'upstream-down');
    assert.equal(r.headers.get('cache-control'), 'public, max-age=300');
    assert.equal(stores.get('daub-photo-v1').size, 0);
  });

  it('slow Openverse -> Commons after 3 s, then the late Openverse answer replaces the cache entry', async t => {
    const mod = await load();
    mockCaches(t);
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let release;
    const slow = new Promise(r => { release = r; });
    let ovStarted = false;
    mockFetch(t, upstream({
      openverse: () => { ovStarted = true; return slow; },
      commons: () => json({ query: { pages: [cmPage(1)] } }),
    }));
    const c = ctx('?q=cake&w=640&h=480');
    const pending = mod.onRequestGet(c);
    for (let k = 0; k < 100 && !ovStarted; k++) await new Promise(r => setImmediate(r));
    assert.ok(ovStarted);
    t.mock.timers.tick(3000);
    const r = await pending;
    assert.equal(r.headers.get('x-photo-source'), 'commons');
    assert.equal(r.headers.get('cache-control'), 'public, max-age=300');
    assert.equal(c.waits.length, 1, 'late Openverse write is handed to waitUntil');

    release(json({ results: OV }));
    await Promise.all(c.waits);
    const again = await mod.onRequestGet(ctx('?q=cake&w=640&h=480'));
    assert.equal(again.headers.get('x-photo-status'), 'hit');
    assert.equal(again.headers.get('x-photo-source'), 'openverse');
    assert.equal(again.headers.get('location'), ovThumb(1, true));
  });
});

describe('cache', () => {
  it('a hit makes no upstream call and skips the rate limiter', async t => {
    const mod = await load();
    mockCaches(t);
    const calls = mockFetch(t, upstream({ openverse: () => json({ results: OV }) }));
    let limits = 0;
    const env = { RL_PHOTO: { limit: async () => { limits++; return { success: true }; } } };
    await mod.onRequestGet(ctx('?q=cake', { env }));
    const n = calls.length;
    const r = await mod.onRequestGet(ctx('?q=cake&w=300&h=300&i=2', { env }));
    assert.equal(r.headers.get('x-photo-status'), 'hit');
    assert.equal(calls.length, n);
    assert.equal(limits, 1);
  });

  it('stores Openverse hits for a week, keyed by normalised q', async t => {
    const mod = await load();
    const stores = mockCaches(t);
    mockFetch(t, upstream({ openverse: () => json({ results: OV }) }));
    await mod.onRequestGet(ctx('?q=Blueberry%20Pancakes!&w=640&h=480'));
    const [[key, e]] = [...stores.get('daub-photo-v1')];
    assert.equal(key, 'https://daub.dev/api/photo/__cache/v1?q=blueberry%20pancakes');
    assert.equal(e.headers['cache-control'], `public, max-age=${WEEK}`);
    const body = JSON.parse(e.body);
    assert.equal(body.ttl, WEEK);
    assert.equal(body.hits.length, OV.length);
  });

  it('no match anywhere is cached briefly and served as cached-empty', async t => {
    const mod = await load();
    const stores = mockCaches(t);
    const calls = mockFetch(t, upstream());
    const a = await mod.onRequestGet(ctx('?q=zzqxv%20plorfnik'));
    assert.equal(a.headers.get('x-photo-status'), 'no-match');
    assert.equal(JSON.parse([...stores.get('daub-photo-v1').values()][0].body).ttl, 600);
    const n = calls.length;
    const b = await mod.onRequestGet(ctx('?q=zzqxv%20plorfnik'));
    assert.ok(isSvg(b));
    assert.equal(b.headers.get('x-photo-status'), 'cached-empty');
    assert.equal(calls.length, n);
  });

  it('a broken Cache API still serves photos', async t => {
    const mod = await load();
    mockCaches(t, { broken: true });
    mockFetch(t, upstream({ openverse: () => json({ results: OV }) }));
    const r = await mod.onRequestGet(ctx('?q=cake&w=640&h=480'));
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('location'), ovThumb(1, true));
  });
});

describe('rate limit (RL_PHOTO)', () => {
  it('over the limit on a miss -> placeholder, no-store, Retry-After, no upstream call', async t => {
    const mod = await load();
    mockCaches(t);
    const calls = mockFetch(t, upstream({ openverse: () => json({ results: OV }) }));
    const keys = [];
    const env = { RL_PHOTO: { limit: async ({ key }) => { keys.push(key); return { success: false }; } } };
    const r = await mod.onRequestGet(ctx('?q=cake', { env, ip: '198.51.100.4' }));
    assert.ok(isSvg(r));
    assert.equal(r.headers.get('x-photo-status'), 'rate-limited');
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal(r.headers.get('retry-after'), '60');
    assert.deepEqual(keys, ['198.51.100.4']);
    assert.equal(calls.length, 0);
  });

  it('fails open when the binding throws', async t => {
    const mod = await load();
    mockCaches(t);
    mockFetch(t, upstream({ openverse: () => json({ results: OV }) }));
    const env = { RL_PHOTO: { limit: async () => { throw new Error('binding error'); } } };
    const r = await mod.onRequestGet(ctx('?q=cake', { env }));
    assert.equal(r.status, 302);
  });
});

describe('optional Openverse app credentials', () => {
  it('fetches one bearer token per isolate and sends it on searches', async t => {
    const mod = await load();
    mockCaches(t);
    let tokenCalls = 0;
    const calls = mockFetch(t, upstream({
      token: init => { tokenCalls++; assert.match(String(init.body), /grant_type=client_credentials/); return json({ access_token: 'test-token', expires_in: 43200 }); },
      openverse: () => json({ results: OV }),
    }));
    const env = { OPENVERSE_CLIENT_ID: 'id', OPENVERSE_CLIENT_SECRET: 'secret' };
    await mod.onRequestGet(ctx('?q=cake', { env }));
    await mod.onRequestGet(ctx('?q=bread', { env }));
    assert.equal(tokenCalls, 1);
    for (const c of ovCalls(calls)) assert.equal(c.init.headers.Authorization, 'Bearer test-token');
  });

  it('searches anonymously when the token endpoint fails', async t => {
    const mod = await load();
    mockCaches(t);
    const calls = mockFetch(t, upstream({ token: () => json({}, 500), openverse: () => json({ results: OV }) }));
    const r = await mod.onRequestGet(ctx('?q=cake', { env: { OPENVERSE_CLIENT_ID: 'id', OPENVERSE_CLIENT_SECRET: 'secret' } }));
    assert.equal(r.status, 302);
    assert.equal(ovCalls(calls)[0].init.headers.Authorization, undefined);
  });
});

describe('CORS and response headers', () => {
  it('OPTIONS -> 204 with open CORS', async () => {
    const mod = await load();
    const r = await mod.onRequestOptions();
    assert.equal(r.status, 204);
    assert.equal(r.headers.get('access-control-allow-origin'), '*');
    assert.match(r.headers.get('access-control-allow-methods'), /GET/);
  });

  it('redirects and placeholders carry CORS, CORP, nosniff and no-referrer', async t => {
    const mod = await load();
    mockCaches(t);
    mockFetch(t, upstream({ openverse: q => json({ results: q === 'cake' ? OV : [] }) }));
    const redirectRes = await mod.onRequestGet(ctx('?q=cake'));
    const svgRes = await mod.onRequestGet(ctx('?q=the'));
    const noMatch = await mod.onRequestGet(ctx('?q=zzqxv'));
    for (const r of [redirectRes, svgRes, noMatch]) {
      assert.equal(r.headers.get('access-control-allow-origin'), '*');
      assert.equal(r.headers.get('cross-origin-resource-policy'), 'cross-origin');
      assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
    }
  });

  it('strips control characters from the landing-page header', async t => {
    const mod = await load();
    mockCaches(t);
    mockFetch(t, upstream({ openverse: () => json({ results: [ovHit(1, 1200, 800, { foreign_landing_url: 'https://x.example/\r\nSet-Cookie: a=b' })] }) }));
    const r = await mod.onRequestGet(ctx('?q=cake'));
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('set-cookie'), null);
    assert.doesNotMatch(r.headers.get('x-photo-landing'), /[\r\n]/);
  });

  it('HEAD is handled like GET', async t => {
    const mod = await load();
    assert.equal(mod.onRequestHead, mod.onRequestGet);
    mockCaches(t);
    mockFetch(t, upstream({ openverse: () => json({ results: OV }) }));
    const r = await mod.onRequestHead(ctx('?q=cake', { method: 'HEAD' }));
    assert.equal(r.status, 302);
  });
});
