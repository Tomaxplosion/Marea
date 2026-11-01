import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { SearchBudget } from '../worker/src/index.mjs';

const request = (query = 'study') => new Request(`https://worker.example/api/search?q=${query}`, {
  headers: { 'CF-Connecting-IP': '192.0.2.1' }
});
const env = () => ({ YOUTUBE_API_KEY: 'test-only', SEARCH_RATE_LIMITER: { limit: async () => ({ success: true }) },
  SEARCH_BUDGET: { idFromName: () => 'global', get: () => ({ fetch: async () => new Response(null, { status: 204 }) }) } });

test('worker fails closed without protections and rejects invalid inputs', async () => {
  assert.equal((await worker.fetch(request(), { YOUTUBE_API_KEY: 'test' })).status, 503);
  assert.equal((await worker.fetch(request(''), env())).status, 400);
  assert.equal((await worker.fetch(request('a&pageToken=bad!'), env())).status, 400);
});

test('rate and daily budget limits prevent upstream requests; cached results consume no budget', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ items: [] }); };
  globalThis.caches = { default: { match: async () => undefined, put: async () => {} } };
  const limited = env();
  limited.SEARCH_RATE_LIMITER.limit = async () => ({ success: false });
  assert.equal((await worker.fetch(request(), limited)).status, 429);
  const exhausted = env();
  exhausted.SEARCH_BUDGET.get = () => ({ fetch: async () => new Response(null, { status: 429 }) });
  assert.equal((await worker.fetch(request(), exhausted)).status, 429);
  assert.equal(calls, 0);
  globalThis.caches.default.match = async () => Response.json({ items: ['cached'] });
  assert.equal((await worker.fetch(request(), exhausted)).status, 200);
  assert.equal(calls, 0);
  globalThis.caches.default.match = async () => undefined;
  assert.equal((await worker.fetch(request(), env(), { waitUntil() {} })).status, 200);
  assert.equal(calls, 1);
});

test('durable daily budget persists counts, resets on a new day, and fails closed on invalid config', async () => {
  const records = new Map();
  const storage = { get: async (key) => records.get(key), put: async (key, value) => records.set(key, value),
    transaction: (callback) => callback(storage) };
  const budget = new SearchBudget({ storage }, { DAILY_SEARCH_LIMIT: '2' });
  assert.equal((await budget.fetch()).status, 204);
  assert.equal((await budget.fetch()).status, 204);
  assert.equal((await budget.fetch()).status, 429);
  records.set('budget', { day: '2000-01-01', count: 999 });
  assert.equal((await budget.fetch()).status, 204);
  assert.equal((await new SearchBudget({ storage }, {}).fetch()).status, 503);
});
