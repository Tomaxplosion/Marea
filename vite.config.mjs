import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const endpoint = new URL(env.VITE_YOUTUBE_API_URL || 'https://marea-youtube-api.spamtom4444.workers.dev');
  if (!['https:', 'http:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) {
    throw new Error('VITE_YOUTUBE_API_URL debe ser una URL HTTP(S) sin credenciales.');
  }
  if (endpoint.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(endpoint.hostname)) {
    throw new Error('El endpoint público de YouTube debe usar HTTPS.');
  }
  const csp = [
    "default-src 'self'",
    "script-src 'self' https://www.youtube.com https://s.ytimg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://i.ytimg.com https://yt3.ggpht.com",
    "media-src 'self' blob:",
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
    `connect-src 'self' ${endpoint.origin} ${mode === 'development' ? 'ws://127.0.0.1:5173' : ''}`,
    "object-src 'none'", "base-uri 'none'", "form-action 'none'"
  ].join('; ');
  return { plugins: [{ name: 'marea-csp', transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' }
  ] }] };
});
