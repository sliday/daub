import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest, callerBucket, quotaKey, LIMIT } from '../functions/api/smart.js';

const URL_ = 'https://daub.dev/api/smart';
const IP_A = '203.0.113.7';
const IP_B = '198.51.100.23';

// In-memory stand-in for a KV namespace: get(key) -> string | null, put(key, value, opts)
function mockKV({ failGet = false, failPut = false } = {}) {
  const store = new Map();
  const puts = [];
  return {
    store, puts,
    async get(key) {
      if (failGet) throw new Error('KV get failed');
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value, opts) {
      if (failPut) throw new Error('KV put failed');
      puts.push({ key, value, opts });
      store.set(key, value);
    },
  };
}

function call(method, { ip = IP_A, env, origin } = {}) {
  const headers = {};
  if (ip) headers['CF-Connecting-IP'] = ip;
  if (origin) headers.Origin = origin;
  return onRequest({ request: new Request(URL_, { method, headers }), env });
}

async function body(res) { return JSON.parse(await res.text()); }

describe('/api/smart quota', () => {
  it(`grants ${LIMIT} runs, then answers 429 until the next UTC midnight`, async () => {
    assert.equal(LIMIT, 10);
    const kv = mockKV();
    const env = { SMART_QUOTA: kv };
    for (let i = 1; i <= LIMIT; i++) {
      const res = await call('POST', { env });
      assert.equal(res.status, 200);
      const b = await body(res);
      assert.equal(b.granted, true);
      assert.equal(b.remaining, LIMIT - i);
      assert.match(b.resetAt, /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    }
    const res = await call('POST', { env });
    assert.equal(res.status, 429);
    const b = await body(res);
    assert.deepEqual(Object.keys(b).sort(), ['granted', 'remaining', 'resetAt']);
    assert.equal(b.granted, false);
    assert.equal(b.remaining, 0);
    const retry = Number(res.headers.get('Retry-After'));
    assert.ok(retry > 0 && retry <= 86400, `Retry-After ${retry}`);
    assert.equal(kv.puts.length, LIMIT, 'a denied POST writes nothing');
  });

  it('stores the count with a ~30 h expirationTtl', async () => {
    const kv = mockKV();
    await call('POST', { env: { SMART_QUOTA: kv } });
    assert.equal(kv.puts.length, 1);
    assert.equal(kv.puts[0].value, '1');
    const ttl = kv.puts[0].opts.expirationTtl;
    assert.ok(ttl > 86400 && ttl <= 36 * 3600, `expirationTtl ${ttl}`);
  });

  it('GET reports usage and has no side effect', async () => {
    const kv = mockKV();
    const env = { SMART_QUOTA: kv };
    for (let i = 0; i < 2; i++) {
      const res = await call('GET', { env });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('Cache-Control'), 'no-store');
      const b = await body(res);
      assert.deepEqual({ limit: b.limit, used: b.used, remaining: b.remaining }, { limit: LIMIT, used: 0, remaining: LIMIT });
      assert.match(b.resetAt, /T00:00:00\.000Z$/);
    }
    assert.equal(kv.puts.length, 0);
    assert.equal(kv.store.size, 0);

    await call('POST', { env });
    const before = kv.puts.length;
    const b = await body(await call('GET', { env }));
    assert.deepEqual({ used: b.used, remaining: b.remaining }, { used: 1, remaining: LIMIT - 1 });
    assert.equal(kv.puts.length, before);
  });

  it('counts different IPs independently', async () => {
    const env = { SMART_QUOTA: mockKV() };
    for (let i = 0; i < LIMIT; i++) await call('POST', { env, ip: IP_A });
    assert.equal((await call('POST', { env, ip: IP_A })).status, 429);
    const res = await call('POST', { env, ip: IP_B });
    assert.equal(res.status, 200);
    assert.equal((await body(res)).remaining, LIMIT - 1);
  });

  it('counts IPv6 callers per /64', async () => {
    const env = { SMART_QUOTA: mockKV() };
    for (let i = 0; i < LIMIT; i++) await call('POST', { env, ip: `2001:db8:1:2::${(i + 1).toString(16)}` });
    assert.equal((await call('POST', { env, ip: '2001:db8:1:2:aaaa:bbbb:cccc:dddd' })).status, 429);
    assert.equal((await call('POST', { env, ip: '2001:db8:1:3::1' })).status, 200);

    assert.equal(callerBucket('2001:0DB8:0001:0002:0000:0000:0000:0001'), '2001:db8:1:2::/64');
    assert.equal(callerBucket('::ffff:203.0.113.7'), IP_A);
    assert.equal(callerBucket(IP_A), IP_A);
    assert.equal(callerBucket(''), 'unknown');
  });

  it('resets at UTC midnight', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 8, 29, 23, 59, 30) });
    const kv = mockKV();
    const env = { SMART_QUOTA: kv };
    for (let i = 0; i < LIMIT; i++) await call('POST', { env });
    const denied = await call('POST', { env });
    assert.equal(denied.status, 429);
    assert.equal((await body(denied)).resetAt, '2026-09-30T00:00:00.000Z');
    assert.equal(denied.headers.get('Retry-After'), '30');

    t.mock.timers.setTime(Date.UTC(2026, 8, 30, 0, 0, 1));
    const g = await body(await call('GET', { env }));
    assert.deepEqual({ used: g.used, remaining: g.remaining, resetAt: g.resetAt }, { used: 0, remaining: LIMIT, resetAt: '2026-10-01T00:00:00.000Z' });
    const res = await call('POST', { env });
    assert.equal(res.status, 200);
    assert.equal((await body(res)).remaining, LIMIT - 1);
    assert.deepEqual([...new Set([...kv.store.keys()].map(k => k.slice(0, 12)))], ['q:2026-09-29', 'q:2026-09-30']);
  });

  it('never stores the raw IP', async () => {
    const kv = mockKV();
    const env = { SMART_QUOTA: kv };
    const ips = [IP_A, IP_B, '2001:db8:1:2::1'];
    for (const ip of ips) await call('POST', { env, ip });
    assert.equal(kv.store.size, ips.length);
    for (const [key, value] of kv.store) {
      assert.match(key, /^q:\d{4}-\d{2}-\d{2}:[0-9a-f]{64}$/);
      for (const ip of ips) {
        assert.ok(!key.includes(ip) && !value.includes(ip), `raw IP ${ip} leaked into ${key}=${value}`);
      }
      assert.ok(!key.includes('2001:db8'), 'IPv6 prefix leaked');
    }
  });

  it('salts the hash (SMART_QUOTA_SALT changes the key)', async () => {
    const day = '2026-09-29';
    assert.notEqual(await quotaKey(IP_A, day), await quotaKey(IP_A, day, 'other-secret'));
    assert.notEqual(await quotaKey(IP_A, day), await quotaKey(IP_A, '2026-09-30'));
    const kv = mockKV();
    await call('POST', { env: { SMART_QUOTA: kv, SMART_QUOTA_SALT: 'other-secret' } });
    assert.equal([...kv.store.keys()][0], await quotaKey(IP_A, new Date().toISOString().slice(0, 10), 'other-secret'));
  });

  it('fails closed with 503 when the KV binding is missing', async () => {
    for (const env of [{}, undefined, { SMART_QUOTA: {} }]) {
      for (const method of ['GET', 'POST']) {
        const res = await call(method, { env });
        assert.equal(res.status, 503, `${method} with env ${JSON.stringify(env)}`);
        assert.deepEqual(await body(res), { granted: false, reason: 'unavailable' });
      }
    }
  });

  it('fails closed with 503 when KV throws', async () => {
    for (const kv of [mockKV({ failGet: true }), mockKV({ failPut: true })]) {
      const res = await call('POST', { env: { SMART_QUOTA: kv } });
      assert.equal(res.status, 503);
      assert.deepEqual(await body(res), { granted: false, reason: 'unavailable' });
    }
    assert.equal((await call('GET', { env: { SMART_QUOTA: mockKV({ failGet: true }) } })).status, 503);
  });

  it('answers OPTIONS preflight with CORS headers', async () => {
    const res = await call('OPTIONS', { env: {}, origin: 'https://daub.dev' });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://daub.dev');
    assert.match(res.headers.get('Access-Control-Allow-Methods'), /GET/);
    assert.match(res.headers.get('Access-Control-Allow-Methods'), /POST/);

    const preview = await call('GET', { env: { SMART_QUOTA: mockKV() }, origin: 'https://abc123.daub.pages.dev' });
    assert.equal(preview.headers.get('Access-Control-Allow-Origin'), 'https://abc123.daub.pages.dev');
    const foreign = await call('POST', { env: { SMART_QUOTA: mockKV() }, origin: 'https://evil.example' });
    assert.equal(foreign.headers.get('Access-Control-Allow-Origin'), 'https://daub.dev');
  });

  it('answers other methods with 405', async () => {
    const kv = mockKV();
    for (const method of ['PUT', 'DELETE', 'PATCH']) {
      const res = await call(method, { env: { SMART_QUOTA: kv } });
      assert.equal(res.status, 405, method);
      assert.equal(res.headers.get('Allow'), 'GET, POST, OPTIONS');
    }
    assert.equal(kv.puts.length, 0);
  });
});
