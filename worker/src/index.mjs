const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders
    }
  });
}

// One globally named object serializes reservations across all edge locations.
// Only a day and a counter are persisted; no IPs or search history are stored.
export class SearchBudget {
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch() {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles',
      year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const limit = Number(this.env.DAILY_SEARCH_LIMIT);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10000) return new Response(null, { status: 503 });
    const allowed = await this.state.storage.transaction(async (storage) => {
      const saved = await storage.get('budget');
      const count = saved?.day === day ? saved.count : 0;
      if (count >= limit) return false;
      await storage.put('budget', { day, count: count + 1 });
      return true;
    });
    return new Response(null, { status: allowed ? 204 : 429 });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method !== 'GET') {
      return jsonResponse({ error: { message: 'Método no permitido.' } }, 405);
    }
    if (url.pathname !== '/api/search') {
      return jsonResponse({ error: { message: 'Ruta no encontrada.' } }, 404);
    }

    const query = url.searchParams.get('q')?.trim();
    if (!query || query.length > 100) {
      return jsonResponse({ error: { message: 'La búsqueda debe tener entre 1 y 100 caracteres.' } }, 400);
    }
    if (!env.YOUTUBE_API_KEY) {
      return jsonResponse({ error: { message: 'El backend no tiene configurada la clave de YouTube.' } }, 503);
    }
    const pageToken = url.searchParams.get('pageToken');
    if (pageToken && (pageToken.length > 512 || !/^[A-Za-z0-9_=-]+$/.test(pageToken))) {
      return jsonResponse({ error: { message: 'Página no válida.' } }, 400);
    }
    // Fail closed: removing a binding must never expose an unlimited proxy.
    if (!env.SEARCH_RATE_LIMITER || !env.SEARCH_BUDGET) {
      return jsonResponse({ error: { message: 'La protección de búsqueda no está configurada.' } }, 503);
    }
    let stage = 'rate-limit';
    try {
      const ip = request.headers.get('CF-Connecting-IP');
      if (!ip || !(await env.SEARCH_RATE_LIMITER.limit({ key: ip })).success) {
        return jsonResponse({ error: { message: 'Demasiadas búsquedas. Espera un minuto.' } }, 429, { 'Retry-After': '60' });
      }
      stage = 'cache';
      const cacheURL = new URL('/api/search', url.origin);
      cacheURL.searchParams.set('q', query.toLowerCase());
      if (pageToken) cacheURL.searchParams.set('pageToken', pageToken);
      const cacheKey = new Request(cacheURL);
      const cached = await caches.default.match(cacheKey);
      if (cached) return cached;
      stage = 'budget';
      const budget = env.SEARCH_BUDGET.get(env.SEARCH_BUDGET.idFromName('global-youtube-budget'));
      const reservation = await budget.fetch('https://budget.internal/reserve', { method: 'POST' });
      if (reservation.status !== 204) {
        return jsonResponse({ error: { message: reservation.status === 429
          ? 'Se ha alcanzado el límite diario de búsqueda. Inténtalo mañana.'
          : 'Búsqueda temporalmente no disponible.' } }, reservation.status === 429 ? 429 : 503);
      }

    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      videoCategoryId: '10',
      maxResults: '10',
      q: `${query} lofi music`,
      key: env.YOUTUBE_API_KEY
    });
    if (pageToken) params.set('pageToken', pageToken);

      stage = 'youtube';
      const youtubeResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
        signal: AbortSignal.timeout(10000), redirect: 'manual'
      });
      const payload = await youtubeResponse.json();
      if (!youtubeResponse.ok) {
        const quota = ['quotaExceeded', 'dailyLimitExceeded'].includes(payload.error?.errors?.[0]?.reason);
        return jsonResponse({ error: { code: quota ? 'YOUTUBE_QUOTA_EXCEEDED' : 'YOUTUBE_UPSTREAM_ERROR',
          message: quota ? 'La cuota de YouTube está agotada. Inténtalo mañana.' : 'YouTube no pudo completar la búsqueda.' } }, quota ? 429 : 502);
      }

      const response = jsonResponse(payload, 200, { 'Cache-Control': 'public, max-age=300' });
      ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
      return response;
    } catch (error) {
      console.warn('Search failed', stage, error?.name || 'Error');
      return jsonResponse({ error: { code: 'SEARCH_BACKEND_ERROR', message: 'Búsqueda temporalmente no disponible.' } }, 503);
    }
  }
};
