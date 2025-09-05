# Progetto Cassa

## Prerequisiti

- Node.js (consigliata versione >= 18)
- npm (installato con Node.js)

## Installazione

### 1. Clona il repository

```bash
git clone https://github.com/massimiliano743/progetto-cassa.git
cd progetto-cassa
```

### 2. Installa le dipendenze del server

```bash
cd server
npm install
```

### 3. Installa le dipendenze del client

```bash
cd ../client
npm install
```

## Avvio del progetto

### 1. Avvia il server

```bash
cd ../server
npm start
```

Il server sarà attivo sulla porta 3000 (o quella configurata in index.js).

### 2. Avvia il client

Apri un nuovo terminale e lancia:

```bash
cd client
npm run dev
```

Il client sarà attivo sulla porta 5173 (o quella configurata da Vite).

## Build e distribuzione con Electron

### 1. Prepara la build del frontend

Dalla cartella principale del progetto:

```bash
cd client
npm run build
cd ..
```

### 2. Installa le dipendenze Electron (se non già fatto)

```bash
npm install
```

### 3. Avvio in modalità sviluppo Electron

Dalla root del progetto:

```bash
npm run electron
```

### 4. Genera l’eseguibile desktop

Dalla root del progetto:

```bash
npm run dist
```

Al termine troverai l’eseguibile nella cartella `dist/` (ad esempio `.app` o `.dmg` su macOS, `.exe` su Windows).

### Note

- Puoi personalizzare nome, icona e altri parametri modificando la sezione `build` nel file `package.json` principale.
- Per la distribuzione su macOS senza avvisi di sicurezza, consulta la documentazione Electron per la notarizzazione.

## Note aggiuntive

- Assicurati che le porte 3000 (server) e 5173 (client) siano libere.
- I database SQLite sono già inclusi nella cartella `server/dbs`.
- Per la stampa scontrini, verifica che la stampante sia correttamente collegata e configurata.
- Se usi Windows, potrebbero essere necessari driver aggiuntivi per la stampante USB.
- Per modificare le impostazioni, accedi alle relative sezioni nel client.

## Risoluzione problemi

- Se hai errori di permessi sui file SQLite, assicurati che la cartella `server/dbs` sia scrivibile.
- Se la stampante non viene rilevata, verifica i collegamenti USB e i permessi.
- Per problemi con le dipendenze, prova a cancellare la cartella `node_modules` e il file `package-lock.json`, poi rilancia `npm install`.

## Struttura delle cartelle

- `client/` : frontend Vue 3
- `server/` : backend Node.js + Express
- `server/dbs/` : database SQLite
- `server/img/` : immagini e loghi
- `server/scontrini/` : PDF e immagini degli scontrini

## Contatti

Per assistenza tecnica, contattare lo sviluppatore.
