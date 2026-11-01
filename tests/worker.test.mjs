import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/src/index.mjs';

const request = (query = 'study') => new Request(`https://worker.example/api/search?q=${query}`, {
  headers: { 'CF-Connecting-IP': '192.0.2.1' }
});
const env = () => ({ YOUTUBE_API_KEY: 'test-only', SEARCH_RATE_LIMITER: { limit: async () => ({ success: true }) } });

test('worker fails closed without protections and rejects invalid inputs', async () => {
  assert.equal((await worker.fetch(request(), { YOUTUBE_API_KEY: 'test' })).status, 503);
  assert.equal((await worker.fetch(request(''), env())).status, 400);
  assert.equal((await worker.fetch(request('a&pageToken=bad!'), env())).status, 400);
});

test('rate limit prevents upstream requests and is applied before cached responses', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ items: [] }); };
  globalThis.caches = { default: { match: async () => undefined, put: async () => {} } };
  const limited = env();
  limited.SEARCH_RATE_LIMITER.limit = async () => ({ success: false });
  assert.equal((await worker.fetch(request(), limited)).status, 429);
  assert.equal(calls, 0);
  globalThis.caches.default.match = async () => Response.json({ items: ['cached'] });
  assert.equal((await worker.fetch(request(), limited)).status, 429);
  assert.equal((await worker.fetch(request(), env())).status, 200);
  assert.equal(calls, 0);
  globalThis.caches.default.match = async () => undefined;
  assert.equal((await worker.fetch(request(), env(), { waitUntil() {} })).status, 200);
  assert.equal(calls, 1);
});

test('more than 80 searches are allowed when each IP stays within its minute limit', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ items: [] }); };
  globalThis.caches = { default: { match: async () => undefined, put: async () => {} } };
  for (let index = 0; index < 85; index++) {
    const next = new Request('https://worker.example/api/search?q=lofi', { headers: { 'CF-Connecting-IP': `192.0.2.${index + 1}` } });
    assert.equal((await worker.fetch(next, env(), { waitUntil() {} })).status, 200);
  }
  assert.equal(calls, 85);
});
