const { spawn } = require('node:child_process');
const path = require('node:path');
const electron = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electron, [path.resolve(__dirname, '..')], {
  env,
  stdio: 'inherit'
});

child.on('error', (error) => {
  console.error('No se pudo iniciar Electron:', error.message);
  process.exitCode = 1;
});

child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
