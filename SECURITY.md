# Seguridad de Marea

## Búsqueda de YouTube

El Worker mantiene la clave de Google como secreto del servidor. No se incluye ninguna contraseña compartida en la app. Un cliente de escritorio distribuido no puede mantener secreta una contraseña que todos sus usuarios comparten.

La búsqueda pública se protege con 6 peticiones por minuto e IP (limitador de Cloudflare por ubicación), caché de cinco minutos y un contador global persistente que permite como máximo 80 llamadas a YouTube por día del Pacífico. El contador reserva antes de llamar a Google; también cuenta intentos fallidos. Si faltan las protecciones, el servicio se cierra con 503. No se persisten IPs ni búsquedas en ese contador.

Los límites protegen la cuota, pero no autentican usuarios: un atacante aún puede agotar las 80 consultas permitidas y dejar sin búsquedas al resto. Para uso privado, protege el Worker con Cloudflare Access y exige inicio de sesión. Para distribución pública con usuarios identificados se necesitaría un flujo OAuth/Access y cuotas por usuario; no basta una clave embebida en React o Electron.

En Google Cloud restringe la clave a YouTube Data API v3, configura la cuota del proyecto y alertas, y evita reutilizar la misma clave en otros servicios. Ajusta `DAILY_SEARCH_LIMIT` al presupuesto real del proyecto. No se ha modificado la configuración del proyecto de Google desde este repositorio.

## Copias portátiles

Las copias `.marea` siguen sin cifrar. Incluyen notas, tareas y audio: trátalas como documentos personales. Se ignoran en Git, al igual que la carpeta de notas. Los archivos ya versionados se han retirado del índice; las copias locales se conservan.

Se aplican límites de 256 MiB por archivo, 128 MiB de audio total, 64 MiB por pista, 1000 pistas y 1000 notas. Cada nota admite 2 MB y el conjunto de notas 20 MB. La lectura nativa comprueba el tamaño antes de cargar; la validación del audio evita expresiones regulares con repetición anidada. Estos límites reducen el riesgo de agotamiento de memoria, pero JSON y base64 aún requieren varias copias en memoria.

Mejoras propuestas para una próxima versión:

1. Contenedor con manifiesto JSON y entradas binarias leídas por bloques. Elimina el sobrecoste de base64 y permite bibliotecas grandes, límites durante la extracción, cancelación y progreso.
2. Cifrado opcional con contraseña: AES-256-GCM y una clave derivada mediante scrypt con sal aleatoria. La contraseña no se guarda en la copia. Requiere un formato nuevo, pruebas de manipulación y un aviso de que no hay recuperación si se pierde la contraseña.
3. Exportación sin audio para copias pequeñas, conservando las listas y señalando las pistas que deben añadirse en el destino.

## Dependencias y publicaciones

Electron y las herramientas se han actualizado. `npm audit --audit-level=high` se ejecuta en el workflow. Persisten 15 avisos moderados transitivos de `minimatch` en la cadena de Electron Builder 26.18.1: el rango del aviso afecta también a las últimas ramas compatibles que usa Builder. No se han forzado APIs incompatibles ni degradado Builder. Se procesan patrones del proyecto controlados, pero conviene repetir la auditoría y actualizar cuando exista una solución compatible.

El workflow fija las acciones oficiales por SHA, no conserva credenciales de checkout y separa el empaquetado (solo lectura) de la publicación (escritura). El escáner revisa patrones de secretos y correos personales del historial sin imprimir valores. No sustituye una revisión humana ni garantiza detectar secretos de cualquier formato.

Los instaladores anteriores no reciben estas defensas automáticamente. Instala la versión 1.0.1 o posterior. Los binarios aún no están firmados digitalmente.

## Historial y privacidad

El historial publicado utiliza el correo privado de GitHub. Después de una reescritura, otros colaboradores deben clonar de nuevo para no reintroducir los commits antiguos.

Una reescritura no borra clones ajenos, forks ni vistas almacenadas por GitHub. Si los commits antiguos siguen accesibles por su identificador, consulta el procedimiento de [eliminación de datos sensibles de GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository). Puede ser necesaria la intervención de GitHub Support; no se puede prometer un borrado universal desde Git.
