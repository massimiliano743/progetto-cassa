const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let backendProcess;

const isProd = app.isPackaged;
const serverPath = isProd
  ? path.join(process.resourcesPath, 'app', 'server', 'index.js')
  : path.join(__dirname, 'server', 'index.js');

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Carica il client statico buildato
  const clientPath = isProd
    ? path.join(process.resourcesPath, 'app', 'client', 'dist', 'index.html')
    : path.join(__dirname, 'client', 'dist', 'index.html');

  win.loadFile(clientPath);

  // Apri DevTools solo in development
  if (!isProd) {
    win.webContents.openDevTools();
  }
}

function waitForBackendReady(retries = 30, delay = 1000) {
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get('http://localhost:3000/get-socket-ip', () => resolve())
        .on('error', () => {
          if (retries > 0) {
            console.log(`Electron: Tentativo ${31 - retries}/30 - Riprovo in ${delay}ms...`);
            setTimeout(() => check(--retries), delay);
          } else {
            reject(new Error('Backend non risponde sulla porta 3000'));
          }
        });
    };
    check();
  });
}

app.whenReady().then(async () => {
  console.log('Electron: Avvio backend Node.js...');
  console.log('Electron: Percorso server:', serverPath);
  console.log('Electron: App packageed:', isProd);

  // Verifica che il file server esista
  const fs = require('fs');
  if (!fs.existsSync(serverPath)) {
    console.error('Electron: File server non trovato:', serverPath);
    app.quit();
    return;
  }

  backendProcess = spawn('node', [serverPath], {
    stdio: 'inherit',
    shell: true,
    cwd: isProd ? path.dirname(serverPath) : path.join(__dirname, 'server')
  });

  backendProcess.on('error', (error) => {
    console.error('Electron: Errore nell\'avvio del backend:', error);
    app.quit();
  });

  try {
    console.log('Electron: Attendo che il backend sia pronto su http://localhost:3000/get-socket-ip...');
    await waitForBackendReady(30, 1000);
    console.log('Electron: Backend pronto, apro la finestra.');
    createWindow();
  } catch (e) {
    console.error('Electron: Errore durante l\'attesa del backend:', e);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
  // Termina il backend quando Electron si chiude
  if (backendProcess) backendProcess.kill();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
