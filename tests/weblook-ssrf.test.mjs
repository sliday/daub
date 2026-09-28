import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isBlockedHost,
  isBlockedIp,
  resolveHost,
  checkHost,
  navigationHosts,
  onRequestPost,
} from '../functions/api/weblook.js';

// Hostnames go through the same WHATWG parser the Worker uses
const host = url => new URL(url).hostname;
const blocked = url => isBlockedHost(host(url));

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

// Fake Cloudflare DoH. zone: { name: { A: [...], AAAA: [...], Status } }; an Error value throws.
function doh(zone) {
  return (url) => {
    const u = new URL(url);
    const name = u.searchParams.get('name');
    const type = u.searchParams.get('type');
    const rec = zone[name];
    if (!rec) return json({ Status: 3 });
    if (rec[type] instanceof Error) throw rec[type];
    if (rec.http) return json({}, rec.http);
    const code = type === 'A' ? 1 : 28;
    const answers = (rec[type] || []).map(data => ({ name, type: code, TTL: 60, data }));
    if (rec.cname) answers.unshift({ name, type: 5, TTL: 60, data: rec.cname });
    return json({ Status: rec.Status ?? 0, Answer: answers });
  };
}

describe('isBlockedHost: cases from PR #5', () => {
  for (const url of [
    'http://localhost/',
    'http://app.localhost/',
    'http://[::1]/',
    'http://169.254.169.254/latest/meta-data/',
    'http://127.0.0.1/',
    'http://10.1.2.3/',
    'http://0.0.0.0/',
    'http://169.254.1.1/',
    'http://172.16.0.1/',
    'http://172.31.255.255/',
    'http://192.168.1.1/',
  ]) {
    it(`blocks ${url}`, () => assert.equal(blocked(url), true));
  }
});

describe('isBlockedHost: IPv4 ranges missing from PR #5', () => {
  for (const url of [
    'http://100.64.0.1/',        // CGNAT low edge
    'http://100.100.100.200/',   // Alibaba Cloud metadata
    'http://100.127.255.255/',   // CGNAT high edge
    'http://192.0.0.8/',
    'http://198.18.0.1/',
    'http://198.19.255.255/',
    'http://224.0.0.1/',
    'http://239.255.255.250/',
    'http://240.0.0.1/',
    'http://255.255.255.255/',
  ]) {
    it(`blocks ${url}`, () => assert.equal(blocked(url), true));
  }
  for (const url of [
    'http://8.8.8.8/',
    'http://1.1.1.1/',
    'http://100.63.255.255/',
    'http://100.128.0.0/',
    'http://172.15.255.255/',
    'http://172.32.0.0/',
    'http://192.0.1.1/',
    'http://198.17.255.255/',
    'http://198.20.0.0/',
    'http://223.255.255.255/',
  ]) {
    it(`allows ${url}`, () => assert.equal(blocked(url), false));
  }
});

describe('isBlockedHost: WHATWG normalization closes encoding tricks', () => {
  for (const [url, normalized] of [
    ['http://2130706433/', '127.0.0.1'],
    ['http://0x7f000001/', '127.0.0.1'],
    ['http://0x7f.1/', '127.0.0.1'],
    ['http://0177.0.0.1/', '127.0.0.1'],
    ['http://127.1/', '127.0.0.1'],
    ['http://0/', '0.0.0.0'],
    ['http://0xa9fea9fe/', '169.254.169.254'],
    ['http://0251.0376.0251.0376/', '169.254.169.254'],
    ['http://%31%32%37.0.0.1/', '127.0.0.1'],
    ['http://１２７.0.0.1/', '127.0.0.1'], // full-width digits
    ['http://127.0.0.1./', '127.0.0.1'],
    ['http://user@127.0.0.1/', '127.0.0.1'],
  ]) {
    it(`${url} parses to ${normalized} and is blocked`, () => {
      assert.equal(host(url), normalized);
      assert.equal(isBlockedHost(host(url)), true);
    });
  }
  it('userinfo that looks like an IP does not change the host', () => {
    assert.equal(host('http://127.0.0.1:80@example.com/'), 'example.com');
    assert.equal(blocked('http://127.0.0.1:80@example.com/'), false);
  });
});

describe('isBlockedHost: IPv6 gaps in PR #5', () => {
  for (const url of [
    'http://[::]/',
    'http://[::1]/',
    'http://[0:0:0:0:0:0:0:1]/',
    'http://[::ffff:127.0.0.1]/',        // mapped, parser rewrites to [::ffff:7f00:1]
    'http://[::ffff:7f00:1]/',
    'http://[::FFFF:169.254.169.254]/',
    'http://[0:0:0:0:0:ffff:a00:1]/',     // mapped 10.0.0.1
    'http://[::ffff:0:a9fe:a9fe]/',       // SIIT-translated 169.254.169.254
    'http://[::127.0.0.1]/',              // deprecated IPv4-compatible
    'http://[64:ff9b::169.254.169.254]/', // NAT64 to metadata
    'http://[64:ff9b:1::1]/',             // local-use NAT64
    'http://[2002:a9fe:a9fe::1]/',        // 6to4 wrapping 169.254.169.254
    'http://[2002:7f00:1::]/',            // 6to4 wrapping 127.0.0.1
    'http://[2001:0:4136:e378::1]/',      // Teredo
    'http://[fc00::1]/',
    'http://[fd00:ec2::254]/',            // AWS IMDS over IPv6
    'http://[fe80::1]/',
    'http://[febf:ffff::1]/',
    'http://[fec0::1]/',
    'http://[ff02::1]/',
  ]) {
    it(`blocks ${url}`, () => assert.equal(blocked(url), true));
  }
  for (const url of [
    'http://[2606:4700:4700::1111]/',
    'http://[2001:4860:4860::8888]/',
    'http://[::ffff:8.8.8.8]/',
    'http://[64:ff9b::808:808]/',
    'http://[2002:808:808::1]/',
  ]) {
    it(`allows ${url}`, () => assert.equal(blocked(url), false));
  }
});

describe('isBlockedHost: reserved names', () => {
  for (const url of [
    'http://LOCALHOST/',
    'http://localhost./',
    'http://a.b.localhost/',
    'http://metadata.google.internal/computeMetadata/v1/',
    'http://metadata.google.internal./',
    'http://kube-dns.cluster.internal/',
  ]) {
    it(`blocks ${url}`, () => assert.equal(blocked(url), true));
  }
  for (const url of ['https://daub.dev/', 'http://localhost.example.com/', 'http://internal.example.com/', 'http://mylocalhost/']) {
    it(`allows ${url} (DNS decides)`, () => assert.equal(blocked(url), false));
  }
  it('treats an empty hostname as blocked', () => assert.equal(isBlockedHost(''), true));
});

describe('isBlockedIp: DNS answer text', () => {
  for (const ip of ['10.0.0.1', '127.0.0.53', '169.254.169.254', 'fd00::1', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', 'FE80::1']) {
    it(`blocks ${ip}`, () => assert.equal(isBlockedIp(ip), true));
  }
  for (const ip of ['93.184.215.14', '2606:2800:21f:cb07:6820:80da:af6b:8b2c', '::ffff:1.1.1.1']) {
    it(`allows ${ip}`, () => assert.equal(isBlockedIp(ip), false));
  }
  for (const junk of ['', 'example.com', '1.2.3', '256.1.1.1', '1::2::3', '1:2:3:4:5:6:7:8:9', '12345::1', ':1', '::ffff:1.2.3']) {
    it(`fails closed on unparseable ${JSON.stringify(junk)}`, () => assert.equal(isBlockedIp(junk), true));
  }
});

describe('resolveHost / checkHost over mocked DoH', () => {
  it('queries A and AAAA in parallel with the DoH JSON accept header and a timeout', async (t) => {
    const release = [];
    const calls = mockFetch(t, () => new Promise(res => release.push(() => res(json({ Status: 0, Answer: [] })))));
    const pending = resolveHost('example.com.');
    await new Promise(r => setImmediate(r));
    assert.equal(calls.length, 2, 'both lookups start before either answers');
    const urls = calls.map(c => new URL(c.url));
    assert.deepEqual(urls.map(u => u.origin + u.pathname), Array(2).fill('https://cloudflare-dns.com/dns-query'));
    assert.deepEqual(urls.map(u => u.searchParams.get('name')), ['example.com', 'example.com']);
    assert.deepEqual(urls.map(u => u.searchParams.get('type')).sort(), ['A', 'AAAA']);
    for (const c of calls) {
      assert.equal(c.init.headers.accept, 'application/dns-json');
      assert.ok(c.init.signal instanceof AbortSignal);
    }
    release.forEach(fn => fn());
    assert.deepEqual(await pending, []);
  });

  it('skips DNS for IP literals', async (t) => {
    const calls = mockFetch(t, () => { throw new Error('no DNS expected'); });
    assert.equal(await checkHost('8.8.8.8'), null);
    assert.equal((await checkHost('10.0.0.1')).error, 'URL host not allowed');
    assert.equal(await checkHost('[2606:4700:4700::1111]'), null);
    assert.equal(calls.length, 0);
  });

  it('skips DNS for blocked names', async (t) => {
    const calls = mockFetch(t, () => { throw new Error('no DNS expected'); });
    assert.equal((await checkHost('metadata.google.internal')).error, 'URL host not allowed');
    assert.equal(calls.length, 0);
  });

  it('allows a host whose A and AAAA answers are public', async (t) => {
    mockFetch(t, doh({ 'daub.dev': { A: ['104.21.1.1', '172.67.1.1'], AAAA: ['2606:4700:3030::6815:101'] } }));
    assert.equal(await checkHost('daub.dev'), null);
  });

  it('blocks a host whose A record is private (nip.io style)', async (t) => {
    mockFetch(t, doh({ '169.254.169.254.nip.io': { A: ['169.254.169.254'] } }));
    const v = await checkHost('169.254.169.254.nip.io');
    assert.deepEqual(v, { status: 400, error: 'URL host not allowed' });
  });

  it('blocks when only the AAAA answer is private', async (t) => {
    mockFetch(t, doh({ 'mixed.example': { A: ['93.184.215.14'], AAAA: ['fd00::1'] } }));
    assert.equal((await checkHost('mixed.example')).error, 'URL host not allowed');
  });

  it('checks the final addresses of a CNAME chain', async (t) => {
    mockFetch(t, doh({ 'alias.example': { cname: 'db.corp.example.', A: ['10.0.0.5'] } }));
    assert.equal((await checkHost('alias.example')).error, 'URL host not allowed');
  });

  it('blocks when an answer is not an IP address', async (t) => {
    mockFetch(t, doh({ 'odd.example': { A: ['not-an-ip'] } }));
    assert.equal((await checkHost('odd.example')).error, 'URL host not allowed');
  });

  for (const [label, zone] of [
    ['NXDOMAIN', {}],
    ['no A or AAAA records', { 'empty.example': { A: [], AAAA: [] } }],
    ['SERVFAIL on AAAA', { 'empty.example': { A: ['93.184.215.14'], AAAA: [], Status: 2 } }],
    ['DoH HTTP 500', { 'empty.example': { http: 500 } }],
    ['network error', { 'empty.example': { A: new TypeError('fetch failed'), AAAA: [] } }],
    ['timeout on one lookup', { 'empty.example': { A: ['93.184.215.14'], AAAA: Object.assign(new Error('timed out'), { name: 'TimeoutError' }) } }],
  ]) {
    it(`fails closed on ${label}`, async (t) => {
      mockFetch(t, doh(zone));
      assert.deepEqual(await checkHost('empty.example'), { status: 400, error: 'Could not resolve URL host' });
    });
  }
});

describe('navigationHosts: CDP Page.getNavigationHistory', () => {
  // Shapes captured from headless Chromium
  it('reports the post-redirect host', () => {
    const h = { currentIndex: 1, entries: [{ url: 'about:blank' }, { url: 'http://127.0.0.1:8931/secret' }] };
    assert.deepEqual(navigationHosts(h), ['127.0.0.1']);
  });
  it('reports every committed web page, deduplicated', () => {
    const h = { currentIndex: 3, entries: [
      { url: 'about:blank' },
      { url: 'https://public.example/a' },
      { url: 'http://10.0.0.1/admin' },
      { url: 'https://public.example/b' },
    ] };
    assert.deepEqual(navigationHosts(h), ['public.example', '10.0.0.1']);
  });
  it('keeps the attempted host for an error page', () => {
    const h = { currentIndex: 1, entries: [{ url: 'about:blank' }, { url: 'http://127.0.0.1:1/' }] };
    assert.deepEqual(navigationHosts(h), ['127.0.0.1']);
  });
  for (const [label, h] of [
    ['a current about:blank', { currentIndex: 0, entries: [{ url: 'about:blank' }] }],
    ['a current data: URL', { currentIndex: 1, entries: [{ url: 'https://a.example/' }, { url: 'data:text/html,hi' }] }],
    ['an out-of-range index', { currentIndex: 5, entries: [{ url: 'https://a.example/' }] }],
    ['a missing result', undefined],
  ]) {
    it(`returns null for ${label}`, () => assert.equal(navigationHosts(h), null));
  }
});

// ── Handler wiring ──────────────────────────────────────────────────────────

const ENV = { BROWSERBASE_API_KEY: 'test-key', BROWSERBASE_PROJECT_ID: 'test-project' };

function post(url, env = ENV) {
  const request = new Request('https://daub.dev/api/weblook', {
    method: 'POST',
    headers: { Origin: 'https://daub.dev', 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return onRequestPost({ request, env });
}

// Minimal Workers-style WebSocket that answers CDP like a Browserbase page
function fakeCdpSocket(historyAt) {
  const listeners = { message: [], close: [], error: [] };
  let historyCalls = 0;
  const emit = data => queueMicrotask(() => listeners.message.forEach(fn => fn({ data: JSON.stringify(data) })));
  return {
    accept() {},
    close() {},
    addEventListener(type, fn) { listeners[type].push(fn); },
    send(raw) {
      const { id, method } = JSON.parse(raw);
      const reply = result => emit({ id, result });
      switch (method) {
        case 'Target.getTargets': return reply({ targetInfos: [{ type: 'page', targetId: 'T1', url: 'about:blank' }] });
        case 'Target.attachToTarget': return reply({ sessionId: 'S1' });
        case 'Page.navigate': reply({ frameId: 'F1' }); return emit({ method: 'Page.loadEventFired', params: {} });
        case 'Page.getNavigationHistory': return reply(historyAt(historyCalls++));
        case 'Runtime.evaluate': return reply({ result: { value: 'INTERNAL PAGE TEXT' } });
        case 'Page.captureScreenshot': return reply({ data: 'SCREENSHOT' });
        default: return reply({});
      }
    },
  };
}

const page = (...urls) => ({ currentIndex: urls.length, entries: [{ url: 'about:blank' }, ...urls.map(url => ({ url }))] });

function mockBrowserbase(t, zone, historyAt) {
  const dns = doh(zone);
  return mockFetch(t, (url) => {
    if (url.startsWith('https://cloudflare-dns.com/')) return dns(url);
    if (url === 'https://api.browserbase.com/v1/sessions') return json({ connectUrl: 'wss://connect.test/session' });
    if (url === 'https://connect.test/session') return { status: 101, webSocket: fakeCdpSocket(historyAt) };
    throw new Error('unexpected fetch ' + url);
  });
}

describe('onRequestPost: entry URL', () => {
  for (const url of ['http://169.254.169.254/latest/meta-data/', 'http://[::ffff:7f00:1]:8080/', 'http://2130706433/', 'http://metadata.google.internal/']) {
    it(`rejects ${url} before calling Browserbase`, async (t) => {
      const calls = mockFetch(t, () => { throw new Error('no fetch expected'); });
      const res = await post(url);
      assert.equal(res.status, 400);
      assert.deepEqual(await res.json(), { error: 'URL host not allowed' });
      assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://daub.dev');
      assert.equal(calls.length, 0);
    });
  }

  it('rejects a hostname that resolves to a private address', async (t) => {
    const calls = mockFetch(t, doh({ 'rebind.example': { A: ['127.0.0.1'] } }));
    const res = await post('https://rebind.example/');
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: 'URL host not allowed' });
    assert.ok(calls.every(c => c.url.startsWith('https://cloudflare-dns.com/')));
  });

  it('rejects with a clear 400 when DNS fails', async (t) => {
    const calls = mockFetch(t, doh({ 'down.example': { A: new TypeError('fetch failed'), AAAA: new TypeError('fetch failed') } }));
    const res = await post('https://down.example/');
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: 'Could not resolve URL host' });
    assert.ok(calls.every(c => c.url.startsWith('https://cloudflare-dns.com/')));
  });

  it('keeps the existing shape for malformed URLs', async (t) => {
    mockFetch(t, () => { throw new Error('no fetch expected'); });
    for (const url of ['ftp://example.com/', 'http://', 'https://exa mple.com/']) {
      const res = await post(url);
      assert.equal(res.status, 400);
      assert.deepEqual(await res.json(), { error: 'Valid URL required (must start with http:// or https://)' });
    }
  });
});

describe('onRequestPost: redirects checked through CDP', () => {
  const zone = {
    'public.example': { A: ['93.184.215.14'] },
    'intranet.example': { A: ['10.20.30.40'] },
  };

  it('refuses content when the page redirected to an internal IP', async (t) => {
    mockBrowserbase(t, zone, () => page('http://127.0.0.1:8080/admin'));
    const res = await post('https://public.example/');
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.deepEqual(body, { error: 'URL host not allowed' });
    assert.equal(body.screenshot, undefined);
  });

  it('refuses content when the redirect target resolves to a private address', async (t) => {
    mockBrowserbase(t, zone, () => page('http://intranet.example/'));
    const res = await post('https://public.example/');
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: 'URL host not allowed' });
  });

  it('refuses content when the page navigates away while being captured', async (t) => {
    mockBrowserbase(t, zone, n => (n === 0 ? page('https://public.example/') : page('https://public.example/', 'http://169.254.169.254/')));
    const res = await post('https://public.example/');
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: 'URL host not allowed' });
  });

  it('refuses with a load error, not a host error, when no web page committed', async (t) => {
    mockBrowserbase(t, zone, () => page());
    const res = await post('https://public.example/');
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.deepEqual(body, { error: 'Page capture failed: page did not load' });
    assert.equal(body.screenshot, undefined);
  });

  it('returns the capture when every page stayed public, resolving each host once', async (t) => {
    const calls = mockBrowserbase(t, zone, () => page('https://public.example/'));
    const res = await post('https://public.example/');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.url, 'https://public.example/');
    assert.equal(body.screenshot, 'SCREENSHOT');
    assert.equal(calls.filter(c => c.url.startsWith('https://cloudflare-dns.com/')).length, 2);
  });
});
