const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { app, BrowserWindow, dialog, Menu, ipcMain } = require('electron');
const path = require('node:path');
const { isTrustedURL, validateNotes, youtubeEmbedHeaders, MAX_BACKUP_BYTES } = require('./security.cjs');
const openedNotes = new Map();
const trustedContents = new Set();

function handle(channel, callback) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!trustedContents.has(event.sender) || event.senderFrame !== event.sender.mainFrame ||
      !isTrustedURL(event.senderFrame.url, app.isPackaged, __dirname)) {
      throw new Error('Origen IPC no autorizado.');
    }
    return callback(event, ...args);
  });
}

handle('backup:export', async (event, data) => {
  const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
    title: 'Exportar copia de Marea', defaultPath: `Marea-${new Date().toISOString().slice(0, 10)}.marea`,
    filters: [{ name: 'Copia de Marea', extensions: ['marea'] }]
  });
  if (canceled || !filePath) return false;
  const directory = path.join(await findProjectRoot(), 'notas');
  const notes = [];
  let entries = [];
  try { entries = await fs.readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  entries = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.txt'));
  if (entries.length > 1000) throw new RangeError('La copia admite hasta 1000 notas.');
  let noteBytes = 0;
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.txt')) {
      const notePath = path.join(directory, entry.name);
      const size = (await fs.stat(notePath)).size;
      noteBytes += size;
      if (size > 2_000_000 || noteBytes > 20_000_000) throw new RangeError('Las notas superan el límite de la copia.');
      notes.push({ name: entry.name, content: await fs.readFile(notePath, 'utf8') });
    }
  }
  validateNotes(notes);
  const serialized = JSON.stringify({ ...data, notes });
  if (Buffer.byteLength(serialized, 'utf8') > MAX_BACKUP_BYTES) throw new RangeError('La copia supera los 256 MB.');
  await fs.writeFile(filePath, serialized, 'utf8');
  return true;
});

handle('backup:open', async (event) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    title: 'Importar copia de Marea', properties: ['openFile'],
    filters: [{ name: 'Copia de Marea', extensions: ['marea'] }]
  });
  if (canceled) return null;
  const file = await fs.open(filePaths[0], 'r');
  try {
    const stats = await file.stat();
    if (!stats.isFile() || stats.size > MAX_BACKUP_BYTES) throw new RangeError('La copia supera los 256 MB o no es un archivo.');
    const buffer = Buffer.alloc(stats.size + 1);
    let count = 0;
    while (count < buffer.length) {
      const { bytesRead } = await file.read(buffer, count, buffer.length - count, null);
      if (!bytesRead) break;
      count += bytesRead;
    }
    if (count > stats.size) throw new Error('El archivo cambió durante la lectura.');
    return buffer.subarray(0, count).toString('utf8');
  } finally { await file.close(); }
});

handle('backup:notes', async (_event, notes) => {
  validateNotes(notes);
  const directory = path.join(await findProjectRoot(), 'notas');
  await fs.mkdir(directory, { recursive: true });
  const originals = new Map();
  let originalBytes = 0;
  for (const note of notes) {
    try {
      const stats = await fs.lstat(path.join(directory, note.name));
      if (!stats.isFile() || stats.isSymbolicLink() || stats.size > 2_000_000) throw new Error('Destino de nota no permitido.');
      originalBytes += stats.size;
      if (originalBytes > 20_000_000) throw new RangeError('Las notas existentes superan los 20 MB.');
      originals.set(note.name, await fs.readFile(path.join(directory, note.name)));
    }
    catch (error) { if (error.code !== 'ENOENT') throw error; originals.set(note.name, null); }
  }
  try {
    for (const note of notes) await fs.writeFile(path.join(directory, note.name), note.content, 'utf8');
  } catch (error) {
    for (const [name, content] of originals) {
      if (content === null) await fs.rm(path.join(directory, name), { force: true });
      else await fs.writeFile(path.join(directory, name), content);
    }
    throw error;
  }
  openedNotes.clear();
});

async function findProjectRoot() {
  // Installed resources are read-only. Keep notes alongside the user's app data.
  if (app.isPackaged) return app.getPath('userData');
  const executableDirectory = path.dirname(app.getPath('exe'));
  const startPaths = [
    app.isPackaged ? executableDirectory : app.getAppPath(),
    process.cwd(),
    app.getAppPath()
  ];
  const visited = new Set();

  for (const startPath of startPaths) {
    let directory = path.resolve(startPath);
    while (!visited.has(directory)) {
      visited.add(directory);
      try {
        const packageInfo = JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8'));
        if (packageInfo.name === 'marea-lofi') return directory;
      } catch {}

      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
  }

  return app.isPackaged ? executableDirectory : app.getAppPath();
}

handle('notes:open', async (event) => {
  const projectRoot = await findProjectRoot();
  const notesDirectory = path.join(projectRoot, 'notas');
  let defaultPath = projectRoot;
  try {
    await fs.access(notesDirectory);
    defaultPath = notesDirectory;
  } catch {}

  const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    title: 'Abrir nota de texto',
    defaultPath,
    properties: ['openFile'],
    filters: [{ name: 'Archivos de texto', extensions: ['txt'] }]
  });
  if (canceled || filePaths.length === 0) return null;

  const filePath = filePaths[0];
  if (path.extname(filePath).toLowerCase() !== '.txt') throw new TypeError('Solo se pueden abrir archivos .txt.');
  const stats = await fs.stat(filePath);
  if (stats.size > 2_000_000) throw new RangeError('La nota supera el tamaño máximo de 2 MB.');

  const noteId = randomUUID();
  const fileName = path.basename(filePath);
  openedNotes.clear();
  openedNotes.set(noteId, filePath);
  return {
    noteId,
    fileName,
    title: path.basename(fileName, path.extname(fileName)),
    content: await fs.readFile(filePath, 'utf8')
  };
});

handle('notes:save', async (_event, note) => {
  if (typeof note?.title !== 'string' || typeof note?.content !== 'string') {
    throw new TypeError('La nota debe incluir un nombre y texto.');
  }
  if (Buffer.byteLength(note.content, 'utf8') > 2_000_000) {
    throw new RangeError('La nota supera el tamaño máximo de 2 MB.');
  }

  const safeName = note.title
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/[. ]+$/g, '')
    .slice(0, 100);
  const projectRoot = await findProjectRoot();
  const notesDirectory = path.join(projectRoot, 'notas');
  const originalPath = typeof note.noteId === 'string' ? openedNotes.get(note.noteId) : undefined;
  if (note.noteId && !originalPath) throw new Error('La nota original ya no está abierta.');
  const filePath = originalPath ?? path.join(notesDirectory, `${safeName || 'Nota'}.txt`);
  if (!originalPath) validateNotes([{ name: path.basename(filePath), content: note.content }]);

  if (!originalPath) {
    await fs.mkdir(notesDirectory, { recursive: true });
    try {
      const stats = await fs.lstat(filePath);
      if (!stats.isFile() || stats.isSymbolicLink()) throw new Error('Destino de nota no permitido.');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await fs.writeFile(filePath, note.content, 'utf8');
  const noteId = note.noteId ?? randomUUID();
  openedNotes.set(noteId, filePath);
  return { fileName: path.basename(filePath), noteId };
});

handle('window:is-fullscreen', (event) => {
  return BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false;
});

handle('window:toggle-fullscreen', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return false;
  window.setFullScreen(!window.isFullScreen());
  return window.isFullScreen();
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 760,
    minHeight: 620,
    backgroundColor: '#f7f6f0',
    title: 'Marea',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  const contents = window.webContents;
  trustedContents.add(contents);
  contents.once('destroyed', () => trustedContents.delete(contents));
  contents.session.webRequest.onBeforeSendHeaders({ urls: [
    'https://www.youtube.com/embed/*', 'https://www.youtube-nocookie.com/embed/*'
  ] }, (details, callback) => {
    const trustedWindow = [...trustedContents].some((entry) => entry.id === details.webContentsId);
    callback({ requestHeaders: youtubeEmbedHeaders(details, trustedWindow) });
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedURL(url, app.isPackaged, __dirname)) event.preventDefault();
  });
  window.webContents.on('will-redirect', (event, url) => {
    if (!isTrustedURL(url, app.isPackaged, __dirname)) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);

  window.on('enter-full-screen', () => window.webContents.send('window:fullscreen-changed', true));
  window.on('leave-full-screen', () => window.webContents.send('window:fullscreen-changed', false));
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.key !== 'F11') return;
    event.preventDefault();
    window.setFullScreen(!window.isFullScreen());
  });

  if (!app.isPackaged) {
    window.loadURL('http://127.0.0.1:5173');
  } else {
    window.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.marea.lofi');
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
