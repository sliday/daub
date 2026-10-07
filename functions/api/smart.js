// Cloudflare Pages Function — Smart mode daily quota (10 runs per caller per UTC day)
// GET  /api/smart -> 200 { limit, used, remaining, resetAt }       read only, spends nothing
// POST /api/smart -> 200 { granted: true, remaining, resetAt }     spends one Smart run
//                    429 { granted: false, remaining: 0, resetAt } budget spent until resetAt
// Both -> 503 { granted: false, reason: 'unavailable' } when the SMART_QUOTA KV binding is missing or KV throws.
// Future Smart callers must treat any non-200 as "stay in normal mode" (fail closed).
//
// This is a UI budget, not abuse protection. KV is eventually consistent and accepts about one write per
// second per key, so parallel POSTs from one caller can read the same count and slightly exceed LIMIT.
// Before enabling Smart, verify rate-limit coverage for /api/* on production and Pages hostnames.
//
// KV key: q:<yyyy-mm-dd UTC>:<sha256(salt|day|caller)>. The raw IP never reaches KV. IPv6 callers count
// per /64, so rotating addresses inside one allocation does not refill the budget. The default salt is
// public (this repo); set the SMART_QUOTA_SALT secret once to make the hashes unguessable. Changing it
// mid-day resets that day's counts.

export const LIMIT = 10;
const TTL_SECONDS = 30 * 3600; // outlives the UTC day it counts, then KV drops the key
const DEFAULT_SALT = 'daub-smart-quota-v1';

function allowsOrigin(request) {
  const origin = request.headers.get('Origin') || '';
  if (!origin || origin === 'null') return false;
  return origin === new URL(request.url).origin || origin === 'https://daub.dev'
    || origin === 'https://daub.pages.dev' || /^https:\/\/[a-z0-9-]+\.daub\.pages\.dev$/.test(origin);
}

function corsFor(request) {
  const origin = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': allowsOrigin(request) ? origin : 'https://daub.dev',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// IPv4 as is; IPv6 reduced to its /64 prefix (an IPv4-mapped address counts as the IPv4 address).
export function callerBucket(ip) {
  let s = String(ip || '').trim().toLowerCase();
  if (!s.includes(':')) return s || 'unknown';
  try {
    s = new URL(`http://[${s}]/`).hostname.slice(1, -1);
  } catch { return s; }
  const halves = s.split('::');
  if (halves.length > 2) return s;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const groups = halves.length === 2 ? [...head, ...Array(8 - head.length - tail.length).fill('0'), ...tail] : head;
  if (groups.length !== 8 || !groups.every(g => /^[0-9a-f]{1,4}$/.test(g))) return s;
  if (groups.slice(0, 5).every(g => parseInt(g, 16) === 0) && parseInt(groups[5], 16) === 0xffff) {
    return groups.slice(6).flatMap(g => [parseInt(g, 16) >> 8, parseInt(g, 16) & 255]).join('.');
  }
  return groups.slice(0, 4).map(g => parseInt(g, 16).toString(16)).join(':') + '::/64';
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function quotaKey(ip, day, salt = DEFAULT_SALT) {
  return `q:${day}:${await sha256Hex(`${salt}|${day}|${callerBucket(ip)}`)}`;
}

function parseCount(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function onRequest(context) {
  const { request, env = {} } = context;
  const corsHeaders = corsFor(request);
  const json = (obj, status, extra) => new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  });

  const method = request.method;
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (method !== 'GET' && method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST, OPTIONS' });
  }
  if (method === 'POST' && (request.headers.has('Origin')
    ? !allowsOrigin(request)
    : request.headers.get('Sec-Fetch-Site') === 'cross-site')) {
    return json({ granted: false, reason: 'forbidden' }, 403);
  }

  const unavailable = () => json({ granted: false, reason: 'unavailable' }, 503);
  const kv = env.SMART_QUOTA;
  if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') return unavailable();

  const now = Date.now();
  const today = new Date(now);
  const day = today.toISOString().slice(0, 10);
  const resetMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1);
  const resetAt = new Date(resetMs).toISOString();

  try {
    const key = await quotaKey(request.headers.get('CF-Connecting-IP'), day, env.SMART_QUOTA_SALT || DEFAULT_SALT);
    const used = parseCount(await kv.get(key));
    if (method === 'GET') {
      return json({ limit: LIMIT, used: Math.min(used, LIMIT), remaining: Math.max(0, LIMIT - used), resetAt }, 200);
    }
    if (used >= LIMIT) {
      return json({ granted: false, remaining: 0, resetAt }, 429, { 'Retry-After': String(Math.ceil((resetMs - now) / 1000)) });
    }
    await kv.put(key, String(used + 1), { expirationTtl: TTL_SECONDS });
    return json({ granted: true, remaining: LIMIT - used - 1, resetAt }, 200);
  } catch {
    return unavailable();
  }
}
