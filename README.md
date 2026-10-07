# Marea

Aplicación de escritorio para organizar tareas, personalizar sesiones Pomodoro y reproducir una biblioteca de música local.

## Desarrollo

Requisitos: Node.js y npm.

```powershell
npm.cmd install
npm.cmd start
```

En la sección **Música**, añade archivos de audio desde el equipo. La biblioteca se guarda localmente en la aplicación.

## Búsqueda de YouTube

La búsqueda usa el Worker de Cloudflare incluido en `worker/`. La clave de YouTube se guarda como secreto del Worker, nunca en React ni en Git.

1. Crea una clave de YouTube Data API v3 en Google Cloud y restringe su uso a esa API.
2. Instala Wrangler si hace falta, inicia sesión y despliega el Worker:

	```powershell
	cd worker
	npx wrangler login
	npx wrangler secret put YOUTUBE_API_KEY
	npx wrangler deploy
	```

	Introduce la clave directamente cuando Wrangler la solicite. El despliegue mostrará la URL pública del Worker.
3. En la raíz del proyecto, copia `.env.example` como `.env.local` y sustituye el subdominio de ejemplo por la URL del Worker:

	```env
	VITE_YOUTUBE_API_URL=https://marea-youtube-api.TU-SUBDOMINIO.workers.dev
	```

4. Ejecuta `npm.cmd start`. Para empaquetar la aplicación, conserva `.env.local` configurado y ejecuta `npm.cmd run dist`.

Para probar el Worker en local, copia `worker/.dev.vars.example` como `worker/.dev.vars`, añade allí la clave, ejecuta `npx wrangler dev` desde `worker/` y configura `VITE_YOUTUBE_API_URL=http://127.0.0.1:8787` en `.env.local`. Estos archivos locales están excluidos de Git.

El endpoint desplegado es público. Antes de distribuir la app, configura límites de peticiones en Cloudflare y vigila la cuota de YouTube para reducir el riesgo de abuso.

## Empaquetar para Windows

```powershell
npm.cmd run dist
```

El instalador y la versión portátil se generan en `release/`.