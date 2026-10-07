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
  async fetch(request, env) {
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

    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      videoCategoryId: '10',
      maxResults: '10',
      q: `${query} lofi music`,
      key: env.YOUTUBE_API_KEY
    });
    const pageToken = url.searchParams.get('pageToken');
    if (pageToken) params.set('pageToken', pageToken);

    try {
      const youtubeResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
      const payload = await youtubeResponse.json();
      if (!youtubeResponse.ok) {
        return jsonResponse({ error: { message: payload.error?.message || 'YouTube rechazó la búsqueda.' } }, 502);
      }

      return jsonResponse(payload, 200, { 'Cache-Control': 'public, max-age=300' });
    } catch {
      return jsonResponse({ error: { message: 'No se pudo conectar con YouTube.' } }, 502);
    }
  }
};
