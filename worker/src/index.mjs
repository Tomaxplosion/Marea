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
    if (!env.SEARCH_RATE_LIMITER) {
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
