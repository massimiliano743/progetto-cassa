const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');

const isProd = app.isPackaged;

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

function startServer() {
  return new Promise((resolve, reject) => {
    console.log('Electron: Avvio backend Node.js integrato...');

    const serverPath = isProd
      ? path.join(process.resourcesPath, 'app', 'server', 'index.js')
      : path.join(__dirname, 'server', 'index.js');

    console.log('Electron: Percorso server:', serverPath);
    console.log('Electron: App packageed:', isProd);

    // Verifica che il file server esista
    const fs = require('fs');
    if (!fs.existsSync(serverPath)) {
      console.error('Electron: File server non trovato:', serverPath);
      reject(new Error('File server non trovato'));
      return;
    }

    try {
      // Salva i percorsi originali
      const originalCwd = process.cwd();
      const originalModulePaths = [...module.paths];

      // Imposta il working directory per il server
      const serverCwd = isProd ? path.dirname(serverPath) : path.join(__dirname, 'server');
      console.log('Electron: Cambio working directory a:', serverCwd);
      process.chdir(serverCwd);

      // Aggiungi il percorso dei node_modules dell'app ai module paths
      if (isProd) {
        const appNodeModulesPath = path.join(__dirname, 'node_modules');
        console.log('Electron: Aggiunto module path:', appNodeModulesPath);
        module.paths.unshift(appNodeModulesPath);
      }

      // Richiede ed esegue il server nel processo corrente
      delete require.cache[require.resolve(serverPath)];
      require(serverPath);

      // Ripristina i percorsi originali
      process.chdir(originalCwd);
      module.paths.length = 0;
      module.paths.push(...originalModulePaths);

      resolve();
    } catch (error) {
      console.error('Electron: Errore nell\'avvio del server integrato:', error);
      reject(error);
    }
  });
}

app.whenReady().then(async () => {
  try {
    await startServer();
    console.log('Electron: Attendo che il backend sia pronto su http://localhost:3000/get-socket-ip...');
    await waitForBackendReady(30, 1000);
    console.log('Electron: Backend pronto, apro la finestra.');
    createWindow();
  } catch (e) {
    console.error('Electron: Errore durante l\'avvio:', e);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  console.log('Electron: Chiusura applicazione...');
});
