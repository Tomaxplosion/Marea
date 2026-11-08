# Marea

Aplicación de escritorio para organizar tareas, personalizar sesiones Pomodoro y reproducir una biblioteca de música local.

## Desarrollo

Requisitos: Node.js y npm.

```powershell
npm.cmd install
npm.cmd start
```

También puedes usar `npm run start`. En PowerShell, usa `npm.cmd run start` si la política de ejecución bloquea `npm.ps1`.

El arranque abre la ventana de Electron y sirve la interfaz en `http://127.0.0.1:5173`. Ese puerto debe estar libre. Si acabas de clonar el proyecto, instala primero las dependencias con `npm.cmd ci`.

En la sección **Música**, añade archivos de audio desde el equipo. La biblioteca se guarda localmente en la aplicación.

## Copias portátiles

En la esquina superior derecha, pulsa el icono **Exportar copia** para guardar un archivo `.marea`. En el otro ordenador, abre Marea y pulsa el icono **Importar copia** para seleccionarlo y confirmar la restauración. Al pasar el cursor sobre cada icono aparece su nombre.

La copia contiene tareas, calendario, preferencias, tiempo restante del Pomodoro, volumen, borrador de la nota abierta, listas de reproducción, referencias de YouTube y los archivos de audio locales completos. También incluye los `.txt` de la carpeta `notas`. No necesitas cuenta ni servidor para transferirla. El archivo puede ocupar más que tu biblioteca de audio.

La importación reemplaza los datos y la biblioteca actuales. Las notas con el mismo nombre se sobrescriben; las demás se conservan. Las notas abiertas desde otras carpetas se incluyen como borrador, sin conservar su ruta original. El temporizador y la reproducción quedan en pausa; la posición de reproducción no se transfiere. YouTube sigue necesitando Internet.

Guarda antes una copia del ordenador de destino si quieres conservar su estado. El archivo contiene tus datos sin cifrar.

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

Descarga el instalador `Marea-Setup-1.0.0.exe` desde [la última versión de GitHub](https://github.com/Tomaxplosion/Marea/releases/latest). No hace falta instalar Node.js: ejecuta el setup y sigue el asistente. Crea accesos directos con el icono de Marea en el escritorio y en Inicio.

Esta versión corrige el error 153 de YouTube en la aplicación instalada: identifica Marea mediante el encabezado `Referer` en las peticiones del reproductor. Si el autor de un vídeo prohíbe su reproducción fuera de YouTube, se muestra un mensaje específico y puedes elegir otro vídeo.

Las notas de la versión instalada se guardan en la carpeta de datos del usuario (`%APPDATA%/marea-lofi/notas`). Usa una copia `.marea` para llevar tus datos de desarrollo a la versión instalada o a otro ordenador.

Los ejecutables no tienen firma digital: Windows puede mostrar el aviso de editor desconocido o SmartScreen. Para distribuir con firma hace falta configurar un certificado de firma de código.

Para generar los ejecutables localmente:

```powershell
npm.cmd run dist
```

El instalador y la versión portátil se generan en `release/`.

El workflow `.github/workflows/release.yml` compila y publica los instaladores cuando se sube una etiqueta `v` seguida de la versión de `package.json` (por ejemplo, `v1.0.0`). También puede ejecutarse manualmente para obtener los ejecutables como artefactos de Actions sin publicar una versión.

## Seguridad

Consulta [SECURITY.md](SECURITY.md) para los límites del Worker, las protecciones de Electron, los avisos pendientes de las herramientas y las propuestas de cifrado y formato de copias. Las copias admiten hasta 128 MiB de audio total y 64 MiB por pista; no están cifradas.

## Inmersión

En Ajustes, activa **Inmersión** para adaptar la interfaz a los tonos de la miniatura de la canción de YouTube seleccionada. La paleta se actualiza al cambiar de pista; no se capturan los fotogramas del reproductor. Durante este modo, Ambiente y Modo oscuro quedan bloqueados. Al desactivarlo se recuperan tus preferencias anteriores.

Con audio local o si no se puede obtener la miniatura, se mantiene el tema habitual. La opción se guarda entre sesiones y se incluye en las copias portátiles.
