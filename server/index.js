const fs = require('fs');
const path = require('path');
// Scrive il log nella cartella dist del progetto (una cartella sopra rispetto a server/)
console.log('Avvio backend:', Date.now());
console.log('Caricamento express...', Date.now());
const express = require('express')
console.log('Caricamento http...', Date.now());
const http = require('http')
console.log('Caricamento socket.io...', Date.now());
const { Server } = require('socket.io')
console.log('Caricamento cors...', Date.now());
const cors = require('cors')
console.log('Caricamento better-sqlite3...', Date.now());
const Database = require('better-sqlite3')
console.log('Caricamento path...', Date.now());
const fsp = require('fs/promises');
console.log('Caricamento child_process...', Date.now());
const { exec, execSync } = require('child_process');
console.log('Caricamento os...', Date.now());
const os = require('os');
console.log('Caricamento sharp...', Date.now());
const sharp = require('sharp');
console.log('Caricamento multer...', Date.now());
const multer = require('multer');
console.log('Tutti i require completati:', Date.now());

const app = express()
app.use(cors())
app.use(express.json());

const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: '*',
    }
})
const APP_CONFIG_PATH = path.join(__dirname, 'config.json');
function readAppConfig() {
    try {
        return JSON.parse(fs.readFileSync(APP_CONFIG_PATH, 'utf-8'));
    } catch {
        return { printSummaryReceipt: false };
    }
}
const PREAMBOLO_STAMPA = Buffer.from([0x1B,0x40, 0x1B,0x32, 0x0A,0x0A]); // ESC @, ESC 2, LF, LF

function writeAppConfig(partial) {
    const current = readAppConfig();
    const updated = { ...current, ...partial };
    fs.writeFileSync(APP_CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
}

function getPrintSummarySetting() {
    const cfg = readAppConfig();
    return !!cfg.printSummaryReceipt;
}

// ================== SISTEMA DI STAMPA TERMICA UNIVERSALE ==================
const net = require('net');
const PRINTER_CONFIG_PATH = path.join(__dirname, 'stampante-selezionata.json');
const isWindows = os.platform() === 'win32';

const ESC = '\x1B';
const GS  = '\x1D';

const ESC_POS_COMMANDS = {
    TAGLIA_CARTA:     `${GS}V\x00`,
    TESTO_GRANDE:     `${ESC}!\x30`,
    TESTO_NORMALE:    `${ESC}!\x00`,
    TESTO_MEDIO:      `${ESC}!\x10`,
    TESTO_LARGO:      `${ESC}!\x20`,
    FONT_B:           `${ESC}M\x01`,
    FONT_A:           `${ESC}M\x00`,
    SOTTOLINEATO:     `${ESC}-\x01`,
    SOTTOLINEATO_OFF: `${ESC}-\x00`,
    INVERTI:          `${ESC}B\x01`,
    INVERTI_OFF:      `${ESC}B\x00`,
    CENTRA:           `${ESC}a\x01`,
    ALLINEA_SINISTRA: `${ESC}a\x00`,
    ALLINEA_DESTRA:   `${ESC}a\x02`,
    GRASSETTO:        `${ESC}E\x01`,
    GRASSETTO_OFF:    `${ESC}E\x00`,
};

// --- Config stampante ---

function readPrinterConfig() {
    try {
        return JSON.parse(fs.readFileSync(PRINTER_CONFIG_PATH, 'utf-8'));
    } catch {
        return { tipo: 'sistema', printer: null, tcpHost: null, tcpPort: 9100 };
    }
}

function writePrinterConfig(partial) {
    const current = readPrinterConfig();
    const updated = { ...current, ...partial, lastUpdated: new Date().toISOString() };
    fs.writeFileSync(PRINTER_CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
}

function initPrinterConfig() {
    if (!fs.existsSync(PRINTER_CONFIG_PATH)) {
        fs.writeFileSync(PRINTER_CONFIG_PATH, JSON.stringify(
            { tipo: 'sistema', printer: null, tcpHost: null, tcpPort: 9100 }, null, 2
        ), 'utf-8');
    }
}
initPrinterConfig();

// Compatibilità con codice esistente
function getSelectedPrinter() {
    const cfg = readPrinterConfig();
    if (cfg.tipo === 'tcp') return cfg.tcpHost ? `tcp://${cfg.tcpHost}:${cfg.tcpPort || 9100}` : null;
    return cfg.printer || null;
}

function setSelectedPrinter(printerName) {
    writePrinterConfig({ tipo: 'sistema', printer: printerName, tcpHost: null });
}

function getDefaultPrinter() {
    try {
        if (isWindows) {
            const stdout = execSync('wmic printer get name,default').toString();
            const match = stdout.match(/True\s+([^\r\n]+)/);
            return match ? match[1].trim() : null;
        } else {
            const stdout = execSync('lpstat -d').toString();
            const match = stdout.match(/system default destination:\s*(\S+)/);
            return match ? match[1] : null;
        }
    } catch (e) {
        console.error('Errore rilevamento stampante predefinita:', e);
        return null;
    }
}

async function getPrinterList() {
    try {
        if (isWindows) {
            const stdout = execSync('wmic printer get name').toString();
            return stdout.split('\r\r\n').slice(1).map(p => p.trim()).filter(Boolean);
        } else {
            const stdout = execSync('lpstat -e').toString();
            return stdout.split('\n').map(line => line.trim()).filter(Boolean);
        }
    } catch (error) {
        console.error('Errore lista stampanti:', error);
        return [];
    }
}

// --- Stampa TCP diretta (porta 9100) ---

function printViaTcp(host, port, data) {
    return new Promise((resolve, reject) => {
        const printData = Buffer.isBuffer(data) ? data : Buffer.from(data);
        const client = new net.Socket();
        let settled = false;

        const done = (err) => {
            if (settled) return;
            settled = true;
            client.destroy();
            if (err) reject(err); else resolve();
        };

        client.setTimeout(5000);
        client.on('timeout', () => done(new Error(`Timeout connessione TCP a ${host}:${port}`)));
        client.on('error', done);
        client.connect(port, host, () => {
            client.write(printData, (err) => done(err || null));
        });
    });
}

// --- Stampa via sistema operativo (lpr / PowerShell) ---

function printViaSystem(printerName, printData) {
    if (isWindows) {
        const base64 = printData.toString('base64');
        const safePrinterName = printerName.replace(/'/g, "''");
        const psScript = `
$printerName = '${safePrinterName}'
$bytes = [Convert]::FromBase64String('${base64}')

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrint {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.drv", CharSet=CharSet.Auto, SetLastError=true)]
    public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr h);
    [DllImport("winspool.drv", CharSet=CharSet.Auto, SetLastError=true)]
    public static extern int StartDocPrinter(IntPtr h, int l, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr h, IntPtr p, int c, out int w);
}
"@

$hPrinter = [IntPtr]::Zero
[RawPrint]::OpenPrinter($printerName, [ref]$hPrinter, [IntPtr]::Zero) | Out-Null
$di = New-Object RawPrint+DOCINFOA
$di.pDocName = 'Scontrino'
$di.pOutputFile = $null
$di.pDataType = 'RAW'
[RawPrint]::StartDocPrinter($hPrinter, 1, $di) | Out-Null
[RawPrint]::StartPagePrinter($hPrinter) | Out-Null
$ptr = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
[Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
$written = 0
[RawPrint]::WritePrinter($hPrinter, $ptr, $bytes.Length, [ref]$written) | Out-Null
[Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
[RawPrint]::EndPagePrinter($hPrinter) | Out-Null
[RawPrint]::EndDocPrinter($hPrinter) | Out-Null
[RawPrint]::ClosePrinter($hPrinter) | Out-Null
`;
        return new Promise((resolve, reject) => {
            const scriptPath = path.join(os.tmpdir(), `print_${Date.now()}.ps1`);
            try { fs.writeFileSync(scriptPath, psScript, 'utf-8'); } catch (err) { return reject(err); }
            exec(`powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, (error, stdout, stderr) => {
                try { fs.unlinkSync(scriptPath); } catch {}
                if (error) { console.error('[STAMPA Windows] Errore:', stderr); reject(error); }
                else { console.log('[STAMPA Windows] Completata'); resolve(); }
            });
        });
    } else {
        return new Promise((resolve, reject) => {
            const tempFile = path.join(os.tmpdir(), `print_${Date.now()}.bin`);
            try { fs.writeFileSync(tempFile, printData); } catch (err) { return reject(err); }
            exec(`lpr -P "${printerName}" -o raw "${tempFile}"`, (error, stdout, stderr) => {
                try { fs.unlinkSync(tempFile); } catch {}
                if (error) { console.error('[STAMPA lpr] Errore:', stderr); reject(error); }
                else { console.log('[STAMPA lpr] Completata'); resolve(); }
            });
        });
    }
}

// --- Entry point unificato ---

async function printWithPrinter(printerName, content) {
    const printData = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const cfg = readPrinterConfig();

    if (cfg.tipo === 'tcp') {
        const host = cfg.tcpHost;
        const port = cfg.tcpPort || 9100;
        if (!host) throw new Error('Indirizzo IP stampante TCP non configurato');
        console.log(`[STAMPA TCP] ${host}:${port}`);
        return printViaTcp(host, port, printData);
    }

    console.log(`[STAMPA Sistema] ${printerName}`);
    return printViaSystem(printerName, printData);
}

// Mapping Unicode → CP858 per caratteri italiani e latini comuni
const CP858_MAP = {
    0xC7: 0x80, 0xFC: 0x81, 0xE9: 0x82, 0xE2: 0x83, 0xE4: 0x84,
    0xE0: 0x85, 0xE5: 0x86, 0xE7: 0x87, 0xEA: 0x88, 0xEB: 0x89,
    0xE8: 0x8A, 0xEF: 0x8B, 0xEE: 0x8C, 0xEC: 0x8D, 0xC4: 0x8E,
    0xC5: 0x8F, 0xC9: 0x90, 0xE6: 0x91, 0xC6: 0x92, 0xF4: 0x93,
    0xF6: 0x94, 0xF2: 0x95, 0xFB: 0x96, 0xF9: 0x97, 0xFF: 0x98,
    0xD6: 0x99, 0xDC: 0x9A, 0xF8: 0x9B, 0xA3: 0x9C, 0xD8: 0x9D,
    0xE1: 0xA0, 0xED: 0xA1, 0xF3: 0xA2, 0xFA: 0xA3, 0xF1: 0xA4,
    0xC1: 0xB5, 0xC2: 0xB6, 0xC0: 0xB7, 0xC8: 0xD4, 0xCC: 0xDE,
    0xD2: 0xE3, 0xD9: 0xEB, 0x20AC: 0xD5, // €
};

function unicodeToCP858(charCode) {
    if (charCode < 128) return charCode;
    return CP858_MAP[charCode] !== undefined ? CP858_MAP[charCode] : 0x3F; // '?' per caratteri non mappati
}

function generateEscPosContent(receiptContent) {
    let escPosBytes = [];

    // Inizializza stampante (ESC @) e seleziona Code Page CP858 (ESC t 0x10)
    escPosBytes.push(ESC.charCodeAt(0), '@'.charCodeAt(0));
    escPosBytes.push(0x1F, 0x1B, 0x10, 0x12, 0x12, 0x01); // attiva euro su Munbyn
    escPosBytes.push(ESC.charCodeAt(0), 't'.charCodeAt(0), 0x10); // CP858

    const lines = receiptContent.split('\n');

    lines.forEach(line => {
        let processedLine = line;

        for (const [commandName, escPosSequence] of Object.entries(ESC_POS_COMMANDS)) {
            const commandPlaceholder = `[COMANDO:${commandName}]`;
            processedLine = processedLine.split(commandPlaceholder).join(escPosSequence);
        }

        for (let i = 0; i < processedLine.length; i++) {
            escPosBytes.push(unicodeToCP858(processedLine.charCodeAt(i)));
        }

        escPosBytes.push(0x0A); // Line Feed
    });

    return Buffer.from(escPosBytes);
}

async function getLogoEscPosBuffer(logoPath) {
    try {
        // Converte il logo in PNG monocromatico, larghezza max 384px (compatibile con la maggior parte delle termiche)
        const image = await sharp(logoPath)
            .resize({ width: 384 })
            .threshold(128)
            .png()
            .toBuffer();
        // Leggi i byte PNG
        const PNG = require('pngjs').PNG;
        const png = PNG.sync.read(image);
        const width = png.width;
        const height = png.height;
        const bytesPerLine = Math.ceil(width / 8);
        let escpos = Buffer.alloc(0);
        for (let y = 0; y < height; y++) {
            let line = Buffer.alloc(bytesPerLine);
            for (let x = 0; x < width; x++) {
                const idx = (width * y + x) << 2;
                // Conversione RGB -> bianco/nero
                const r = png.data[idx];
                const g = png.data[idx + 1];
                const b = png.data[idx + 2];
                // Calcolo luminosità media
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                if (lum < 128) {
                    line[Math.floor(x / 8)] |= (0x80 >> (x % 8));
                }
            }
            escpos = Buffer.concat([escpos, line]);
        }
        // Comando ESC/POS GS v 0
        const header = Buffer.from([
            0x1D, 0x76, 0x30, 0x00,
            bytesPerLine & 0xFF,
            (bytesPerLine >> 8) & 0xFF,
            height & 0xFF,
            (height >> 8) & 0xFF
        ]);
        return Buffer.concat([header, escpos]);
    } catch (e) {
        console.error('Errore generazione buffer logo ESC/POS:', e);
        return Buffer.alloc(0);
    }
}

// API per la gestione della stampante
// Elenco stampanti di sistema (usato solo in modalità "sistema")
app.get('/stampanti', async (req, res) => {
    try {
        const printers = await getPrinterList();
        res.json(printers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Config completa stampante (include tipo, tcpHost, tcpPort)
app.get('/stampante-config', (req, res) => {
    res.json(readPrinterConfig());
});

// Selezione stampante — supporta sia sistema che TCP
app.post('/seleziona-stampante', (req, res) => {
    const { tipo, printerName, tcpHost, tcpPort } = req.body;
    if (tipo === 'tcp') {
        if (!tcpHost) return res.status(400).json({ error: 'tcpHost mancante' });
        writePrinterConfig({ tipo: 'tcp', tcpHost, tcpPort: tcpPort || 9100, printer: null });
    } else {
        if (!printerName) return res.status(400).json({ error: 'Nome stampante mancante' });
        writePrinterConfig({ tipo: 'sistema', printer: printerName, tcpHost: null });
    }
    res.json({ success: true, config: readPrinterConfig() });
});

// Test connessione TCP (senza stampare nulla di visibile)
app.post('/test-tcp', async (req, res) => {
    const { tcpHost, tcpPort } = req.body;
    if (!tcpHost) return res.status(400).json({ error: 'tcpHost mancante' });
    const port = tcpPort || 9100;
    try {
        // ESC @ = reset stampante: comando innocuo per testare la connessione
        await printViaTcp(tcpHost, port, Buffer.from([0x1B, 0x40]));
        res.json({ success: true, message: `Connessione TCP a ${tcpHost}:${port} riuscita` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Stampa testo ESC/POS generico via HTTP
app.post('/stampa', async (req, res) => {
    try {
        const { testo } = req.body;
        if (!testo) return res.status(400).json({ error: 'Testo mancante' });
        const printerName = risolviStampante();
        if (!printerName) return res.status(400).json({ error: 'Nessuna stampante disponibile' });
        const content = generateEscPosContent(testo);
        await printWithPrinter(printerName, content);
        res.json({ success: true });
    } catch (error) {
        console.error('Errore stampa:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/stampante-stato', async (req, res) => {
    try {
        const cfg = readPrinterConfig();
        if (cfg.tipo === 'tcp') {
            res.json({ tipo: 'tcp', selected: !!cfg.tcpHost, tcpHost: cfg.tcpHost, tcpPort: cfg.tcpPort || 9100 });
        } else {
            const printers = await getPrinterList();
            res.json({ tipo: 'sistema', selected: !!cfg.printer, printersAvailable: printers.length > 0 });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/stampante-selezionata', (req, res) => {
    const selected = getSelectedPrinter();
    if (!selected) return res.status(404).json({ error: 'Nessuna stampante selezionata' });
    res.json({ printer: selected, config: readPrinterConfig() });
});

app.get('/set-db', (req, res) => {
    const dbName = req.query.dbName;
    if (!dbName) return res.status(400).json({ error: 'Nome database mancante' });
    currentDbName = dbName;
    db = openDb(currentDbName);
    res.json({ success: true });
});

app.get('/create-db', (req, res) => {
    const dbName = req.query.dbName;
    if (!dbName) return res.status(400).json({ error: 'Nome database mancante' });
    try {
        openDb(dbName); // crea se non esiste
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Configurazione Multer per upload immagini
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'img'));
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        const timestamp = Date.now();
        cb(null, `uploaded_${timestamp}${ext}`);
    }
});
const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
            cb(null, true);
        } else {
            cb(new Error('Solo PNG o JPEG sono accettati.'));
        }
    }
});

// Endpoint per upload immagine
app.post('/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nessun file caricato o formato non valido.' });
    }
    res.json({ message: 'Immagine caricata con successo!' });
});

// ================== FINE SISTEMA DI STAMPA ==================

let currentDbName = null;
let db = null;
const dbFolder = path.join(__dirname, 'dbs');

// Middleware per leggere il dbName dalla sessione client (header o query)
app.use((req, res, next) => {
    // Prova a leggere da header personalizzato
    const dbNameFromHeader = req.headers['x-db-name'];
    if (dbNameFromHeader && dbNameFromHeader !== currentDbName) {
        currentDbName = dbNameFromHeader;
        db = openDb(currentDbName);
    }
    next();
});

function getDbPath(dbName) {
    return path.join(dbFolder, dbName + '.sqlite3');
}

function openDb(dbName) {
    const dbPath = getDbPath(dbName);
    if (!fs.existsSync(dbPath)) {
        // Se non esiste, crea il file e le tabelle
        const newDb = new Database(dbPath);
        newDb.pragma('journal_mode = WAL');
        newDb.prepare(`CREATE TABLE IF NOT EXISTS prodotti
            (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                quantita INTEGER NOT NULL,
                tipologia TEXT NOT NULL,
                prezzo REAL NOT NULL
            )`).run();
        newDb.prepare(`CREATE TABLE IF NOT EXISTS orders
            (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid TEXT,
                recapOrdine TEXT,
                totale REAL,
                timestamp TEXT,
                note TEXT CHECK(LENGTH(note) <= 1000)
            )`).run();
        newDb.prepare(`CREATE TABLE IF NOT EXISTS categories
            (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                color TEXT,
                enable Boolean DEFAULT 1
            )`).run();
        return newDb;
    } else {
        const existingDb = new Database(dbPath);
        existingDb.pragma('journal_mode = WAL');
        return existingDb;
    }
}

let orders = []
let products = []
let masterId = null;

const users = [
    { username: 'admin', password: 'admin' },
    { username: 'user', password: 'user' }
];


const helpers = {
    creaRigaColonne: function(colSinistra, colCentro, colDestra, larghezze) {
        const [larghSinistra, larghCentro, larghDestra] = larghezze;
        let righe = [];
        let testoSinistraRimanente = colSinistra;
        let primoGiro = true;

        while (testoSinistraRimanente.length > 0) {
            let parteSinistra = testoSinistraRimanente.substring(0, larghSinistra);
            testoSinistraRimanente = testoSinistraRimanente.substring(larghSinistra);
            parteSinistra = parteSinistra.padEnd(larghSinistra, ' ');

            if (primoGiro) {
                const parteCentro = colCentro.padStart(larghCentro, ' ');
                const parteDestra = colDestra.padStart(larghDestra, ' ');
                righe.push(parteSinistra + parteCentro + parteDestra);
                primoGiro = false;
            } else {
                righe.push(parteSinistra);
            }
        }
        return righe;
    },
    creaSeparatore: function(larghezzaTotale) {
        return ''.padEnd(larghezzaTotale, '-');
    }
};

function generaScontrinoTermicoAvanzato(datiOrdine, config = { larghezzaCaratteri: 42 }) {
    const { larghezzaCaratteri } = config;
    let scontrino = [];

    const dataOraOrdine = new Date(datiOrdine.dataOra);
    const addLeadingZero = (num) => num < 10 ? '0' + num : num;
    const giorno = addLeadingZero(dataOraOrdine.getDate());
    const mese = addLeadingZero(dataOraOrdine.getMonth() + 1);
    const anno = dataOraOrdine.getFullYear();
    const ore = addLeadingZero(dataOraOrdine.getHours());
    const minuti = addLeadingZero(dataOraOrdine.getMinutes());

    const dataFormattata = `${giorno}/${mese}/${anno} ${ore}:${minuti}`;

    scontrino.push('');
    scontrino.push(`[COMANDO:CENTRA][COMANDO:TESTO_GRANDE]${datiOrdine.titoloAzienda}[COMANDO:TESTO_NORMALE]`);
    scontrino.push('[COMANDO:TESTO_NORMALE]');
    scontrino.push(`[COMANDO:CENTRA][COMANDO:TESTO_GRANDE][COMANDO:FONT_A][COMANDO:SOTTOLINEATO]${datiOrdine.sottotitoloAzienda}[COMANDO:SOTTOLINEATO_OFF][COMANDO:TESTO_NORMALE]`);
    scontrino.push('');
    scontrino.push('[COMANDO:ALLINEA_SINISTRA][COMANDO:TESTO_NORMALE]');
    scontrino.push(`Data: ${dataFormattata}`);
    scontrino.push(`Numero scontrino: [COMANDO:TESTO_GRANDE]${datiOrdine.numeroScontrino}[COMANDO:TESTO_NORMALE]`);
    scontrino.push(helpers.creaSeparatore(larghezzaCaratteri));
    const larghezzeColonne = [
        Math.floor(larghezzaCaratteri * 0.5),
        Math.floor(larghezzaCaratteri * 0.2),
        Math.floor(larghezzaCaratteri * 0.3)
    ];

    const sommaLarghezze = larghezzeColonne[0] + larghezzeColonne[1] + larghezzeColonne[2];
    if (sommaLarghezze < larghezzaCaratteri) {
        larghezzeColonne[0] += (larghezzaCaratteri - sommaLarghezze);
    }

    scontrino.push(...helpers.creaRigaColonne('Prodotto', 'N\xb0', 'TOT', larghezzeColonne));
    scontrino.push(helpers.creaSeparatore(larghezzaCaratteri));
    datiOrdine.prodotti.forEach(p => {
        let nomeProdotto = `${p.nome}`;
        let extra = '';
        if (p.note && p.note.trim() !== "") {
            extra += ` - ${p.note}`;
        }
        if (p.quantita > 1) {
            const prezzoUnitarioFormat = Number(p.prezzoUnitario || p.prezzo).toFixed(2);
            extra += ` (${prezzoUnitarioFormat} cad.)`;
        }
        nomeProdotto = nomeProdotto.toUpperCase() + extra;
        const qta = p.quantita.toString();
        const totaleRiga = Number(p.totale).toFixed(2);
        const righeProd = helpers.creaRigaColonne(nomeProdotto, qta, totaleRiga, larghezzeColonne);
        if (righeProd.length > 0) {
            righeProd[0] = `[COMANDO:TESTO_MEDIO]` + righeProd[0];
        }
        scontrino.push(...righeProd);
    });
    scontrino.push(helpers.creaSeparatore(larghezzaCaratteri));
    const testoTotale = `Totale: ` + Number(datiOrdine.totaleOrdine).toFixed(2);
    scontrino.push(`[COMANDO:ALLINEA_DESTRA][COMANDO:TESTO_GRANDE]${testoTotale}[COMANDO:TESTO_NORMALE]`);
    scontrino.push('');
    if (datiOrdine.note && datiOrdine.note.trim() !== "") {
        scontrino.push('');
        scontrino.push(`[COMANDO:CENTRA]Nota:[COMANDO:TESTO_NORMALE] [COMANDO:GRASSETTO] ${datiOrdine.note}[COMANDO:GRASSETTO_OFF] [COMANDO:TESTO_NORMALE]`);
        scontrino.push(helpers.creaSeparatore(larghezzaCaratteri));
        scontrino.push('');
        scontrino.push('');
        scontrino.push('');
    }
    scontrino.push('[COMANDO:CENTRA]Grazie per il tuo acquisto!');
    scontrino.push('');
    scontrino.push('');
    scontrino.push('');
    scontrino.push('');
    scontrino.push('');
    scontrino.push('');
    scontrino.push('[COMANDO:TAGLIA_CARTA]');
    return scontrino.join('\n');
}

// ================== HELPER DI STAMPA ==================

async function getLogoBuffer() {
    const imgDir = path.join(__dirname, 'img');
    try {
        const files = fs.readdirSync(imgDir)
            .filter(f => f.startsWith('uploaded_') && (f.endsWith('.png') || f.endsWith('.jpg')))
            .sort((a, b) => {
                const getTs = name => {
                    const match = name.match(/uploaded_(\d+)/);
                    return match ? parseInt(match[1]) : 0;
                };
                return getTs(b) - getTs(a);
            });
        const logoPath = files.length > 0
            ? path.join(imgDir, files[0])
            : fs.existsSync(path.join(imgDir, 'logo.png')) ? path.join(imgDir, 'logo.png') : null;
        if (!logoPath) return Buffer.alloc(0);
        return await getLogoEscPosBuffer(logoPath);
    } catch (e) {
        console.error('Errore caricamento logo:', e);
        return Buffer.alloc(0);
    }
}

function risolviStampante() {
    const cfg = readPrinterConfig();
    if (cfg.tipo === 'tcp') return cfg.tcpHost ? `tcp://${cfg.tcpHost}:${cfg.tcpPort || 9100}` : null;
    let printerName = cfg.printer;
    if (!printerName) {
        printerName = getDefaultPrinter();
        if (printerName) writePrinterConfig({ tipo: 'sistema', printer: printerName, tcpHost: null });
    }
    return printerName;
}

function parseRecapProdotti(recapOrdine) {
    try {
        const arr = JSON.parse(recapOrdine);
        if (Array.isArray(arr)) return arr;
    } catch { /* legacy format */ }
    const prodottiMap = {};
    recapOrdine.split(',').map(p => p.trim()).filter(Boolean).forEach(entry => {
        const [productIdStr, prezzoStr] = entry.split(':');
        const productId = parseInt(productIdStr);
        const prezzo = parseFloat(prezzoStr);
        if (!isNaN(productId)) {
            if (!prodottiMap[productId]) {
                const prodottoDB = db.prepare('SELECT nome FROM prodotti WHERE id = ?').get(productId);
                prodottiMap[productId] = {
                    id: productId,
                    nome: prodottoDB ? prodottoDB.nome : `Prodotto #${productId}`,
                    prezzo,
                    quantita: 1,
                    note: ""
                };
            } else {
                prodottiMap[productId].quantita += 1;
            }
        }
    });
    return Object.values(prodottiMap);
}

function raggruppaPerCategoria(prodotti) {
    const prodottiPerCategoria = {};
    prodotti.forEach(p => {
        const prodDb = db.prepare('SELECT tipologia FROM prodotti WHERE id = ?').get(p.id);
        const tipologia = prodDb ? String(prodDb.tipologia) : 'senza_categoria';
        if (!prodottiPerCategoria[tipologia]) prodottiPerCategoria[tipologia] = [];
        prodottiPerCategoria[tipologia].push({
            nome: p.nome,
            quantita: p.quantita,
            prezzo: p.prezzo,
            totale: Number(p.prezzo) * Number(p.quantita),
            note: p.note || ""
        });
    });
    const categorieNomi = {};
    Object.keys(prodottiPerCategoria).forEach(catId => {
        const cat = db.prepare('SELECT name FROM categories WHERE id = ?').get(catId);
        categorieNomi[catId] = cat ? cat.name : `Categoria #${catId}`;
    });
    return { prodottiPerCategoria, categorieNomi };
}

async function costruisciBufferStampa({ orderId, timestamp, prodotti, totaleOrdine, note, suffissoTitolo }) {
    const CONFIG_STAMPANTE = { larghezzaCaratteri: 42 };
    const { prodottiPerCategoria, categorieNomi } = raggruppaPerCategoria(prodotti);
    const logoBuffer = await getLogoBuffer();
    let bufferUnico = Buffer.alloc(0);

    for (const [catId, prodottiCat] of Object.entries(prodottiPerCategoria)) {
        const sottotitolo = suffissoTitolo ? `${categorieNomi[catId]} ${suffissoTitolo}` : categorieNomi[catId];
        const dati = {
            numeroScontrino: orderId,
            dataOra: timestamp,
            titoloAzienda: currentDbName,
            sottotitoloAzienda: sottotitolo,
            prodotti: prodottiCat,
            totaleOrdine: prodottiCat.reduce((acc, p) => acc + Number(p.totale), 0),
            note: ''
        };
        const content = generateEscPosContent(generaScontrinoTermicoAvanzato(dati, CONFIG_STAMPANTE));
        bufferUnico = Buffer.concat([bufferUnico, logoBuffer, content]);
    }

    if (getPrintSummarySetting()) {
        const sottotitoloRiepilogo = suffissoTitolo ? `Riepilogo Ordine ${suffissoTitolo}` : 'Riepilogo Ordine';
        const datiRiepilogo = {
            numeroScontrino: orderId,
            dataOra: timestamp,
            titoloAzienda: currentDbName,
            sottotitoloAzienda: sottotitoloRiepilogo,
            prodotti: prodotti.map(p => ({
                nome: p.nome,
                quantita: p.quantita,
                prezzo: p.prezzo,
                totale: Number(p.prezzo) * Number(p.quantita),
                note: p.note || ''
            })),
            totaleOrdine,
            note: note || ''
        };
        const contentRiepilogo = generateEscPosContent(generaScontrinoTermicoAvanzato(datiRiepilogo, CONFIG_STAMPANTE));
        bufferUnico = Buffer.concat([bufferUnico, logoBuffer, Buffer.from([0x0A]), contentRiepilogo]);
    }

    return bufferUnico;
}

async function stampaOrdineById(orderId) {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) throw new Error(`Ordine con ID ${orderId} non trovato.`);

    const printerName = risolviStampante();
    if (!printerName) throw new Error('Nessuna stampante disponibile o configurata.');

    const prodotti = parseRecapProdotti(order.recapOrdine);
    const bufferUnico = await costruisciBufferStampa({
        orderId: order.id,
        timestamp: order.timestamp,
        prodotti,
        totaleOrdine: order.totale,
        note: order.note || '',
        suffissoTitolo: null
    });

    await printWithPrinter(printerName, bufferUnico);
    console.log(`Ristampa termica dell'ordine #${orderId} completata.`);
}

// ================== FINE HELPER DI STAMPA ==================

io.on('connection', socket => {
    console.log('Nuovo client connesso')

    // === CRUD prodotti ===
    socket.on('get-prodotti', (cb) => {
        const prodotti = db.prepare('SELECT * FROM prodotti').all().map(p => {
            const cat = db.prepare('SELECT name, color FROM categories WHERE id = ?').get(p.tipologia);
            return { ...p, tipologia: cat ? cat.name : p.tipologia, colore: cat ? cat.color : null };
        });
        if (cb) cb(prodotti);
        io.emit('product-list', prodotti);
    });

    socket.on('add-prodotto', (prodotto, cb) => {
        const categoria = db.prepare('SELECT * FROM categories WHERE id = ?').get(prodotto.tipologia);
        if (!categoria) {
            if (cb) cb({ error: 'Categoria non trovata' });
            return;
        }
        const stmt = db.prepare('INSERT INTO prodotti (nome, quantita, tipologia, prezzo) VALUES (?, ?, ?, ?)');
        const info = stmt.run(prodotto.nome, prodotto.quantita, prodotto.tipologia, prodotto.prezzo);
        const nuovoProdotto = { id: info.lastInsertRowid, ...prodotto, tipologia: categoria.name, colore: categoria.color };
        io.emit('product-list', db.prepare('SELECT * FROM prodotti').all().map(p => {
            const cat = db.prepare('SELECT name, color FROM categories WHERE id = ?').get(p.tipologia);
            return { ...p, tipologia: cat ? cat.name : p.tipologia, colore: cat ? cat.color : null };
        }));
        if (cb) cb(nuovoProdotto);
    });

    socket.on('update-prodotto', (prodotto, cb) => {
        const stmt = db.prepare('UPDATE prodotti SET nome=?, quantita=?, tipologia=?, prezzo=? WHERE id=?');
        stmt.run(prodotto.nome, prodotto.quantita, prodotto.tipologia, prodotto.prezzo, prodotto.id);
        io.emit('product-list', db.prepare('SELECT * FROM prodotti').all().map(p => {
            const cat = db.prepare('SELECT name, color FROM categories WHERE id = ?').get(p.tipologia);
            return { ...p, tipologia: cat ? cat.name : p.tipologia, colore: cat ? cat.color : null };
        }));
        if (cb) cb(true);
    });

    socket.on('remove-prodotto', (id, cb) => {
        db.prepare('DELETE FROM prodotti WHERE id=?').run(id);
        io.emit('product-list', db.prepare('SELECT * FROM prodotti').all().map(p => {
            const cat = db.prepare('SELECT name, color FROM categories WHERE id = ?').get(p.tipologia);
            return { ...p, tipologia: cat ? cat.name : p.tipologia, colore: cat ? cat.color : null };
        }));
        if (cb) cb(true);
    });

    socket.on('clear-prodotti', (cb) => {
        db.prepare('DELETE FROM prodotti').run();
        io.emit('product-list', []);
        if (cb) cb(true);
    });

    socket.on('check-quantity-prodotto', (idProdotti, cb) => {
        try {
            if (!Array.isArray(idProdotti) || idProdotti.length === 0) {
                if (cb) cb([]);
                return;
            }
            const result = db.prepare(
                `SELECT id, nome, quantita FROM prodotti`
            ).all();
            const prodottiNonDisponibili = result
                .filter(p => idProdotti.includes(p.id) && p.quantita < 1)
                .map(p => ({ id: p.id, nome: p.nome }));
            if (cb) cb(prodottiNonDisponibili);
        } catch (err) {
            console.error('Errore check-quantity-prodotto:', err);
            if (cb) cb({ error: 'Errore database: ' + err.message });
        }
    });

    // Assegna ruolo solo dopo login/registerDevice
    socket.on('registerDevice', (data, callback) => {
        let ruolo = 'client';
        if (!masterId) {
            masterId = socket.id;
            ruolo = 'master';
            console.log('Assegnato MASTER a', socket.id);
        } else {
            console.log('Assegnato CLIENT a', socket.id);
        }
        if (callback) callback(ruolo);
    });

    socket.on('get-category', (cb) => {
        const categorie = db.prepare('SELECT * FROM categories').all();
        if (cb) cb(categorie);
    })

    socket.on('add-category', (category, cb) => {
        const stmt = db.prepare('INSERT INTO categories (name, color, enable) VALUES (?, ?, ?)');
        const info = stmt.run(category.name, category.color, category.enable);
        const nuovaCategory = { id: info.lastInsertRowid, ...category };
        io.emit('category-list', db.prepare('SELECT * FROM categories').all());
        if (cb) cb(nuovaCategory);
    });

    socket.on('remove-category', (id, cb) => {
        db.prepare('DELETE FROM categories WHERE id=?').run(id);
        io.emit('category-list', db.prepare('SELECT * FROM categories').all());
        if (cb) cb(true);
    });

    socket.on('update-category', (category, cb) => {
        const stmt = db.prepare('UPDATE categories SET name=?, color=?, enable=? WHERE id=?');
        stmt.run(category.name, category.color, category.enable, category.id);
        io.emit('category-list', db.prepare('SELECT * FROM categories').all());
        if (cb) cb(true);
    });

    socket.on('clear-categories', (cb) => {
        db.prepare('DELETE FROM categories').run();
        io.emit('category-list', []);
        if (cb) cb(true);
    });

    // Invia gli ordini correnti appena si connette
    socket.emit('sync-orders', orders)
    socket.emit('sync-product', products)

    socket.on('new-order', async (order, cb) => {
        console.log('Nuovo ordine ricevuto:', order);

        // 1. Conta le occorrenze di ogni id prodotto e salva i prezzi pagati
        const counts = {};
        const prezziPagati = {};
        let prodottiArray = [];
        // Gestione formato array di oggetti prodotto
        if (Array.isArray(order.prodotti)) {
            prodottiArray = order.prodotti;
        } else {
            // Fallback per vecchio formato stringa
            try {
                prodottiArray = JSON.parse(order.prodotti);
            } catch {
                prodottiArray = [];
            }
        }
        prodottiArray.forEach(item => {
            const id = item.id;
            const count = item.quantita || 1;
            counts[id] = (counts[id] || 0) + count;
            if (!prezziPagati[id]) prezziPagati[id] = [];
            prezziPagati[id].push(parseFloat(item.prezzo));
        });

        // 2. Aggiorna la quantità nel database
        Object.entries(counts).forEach(([id, count]) => {
            const result = db.prepare('UPDATE prodotti SET quantita = quantita - ? WHERE id = ?').run(count, id);
            console.log(`Prodotto id: ${id}, decremento: ${count}, righe modificate: ${result.changes}`);
        });

        // 3. Invia al FE la lista aggiornata dei prodotti
        const prodottiAggiornati = db.prepare('SELECT * FROM prodotti').all().map(p => {
            const cat = db.prepare('SELECT name, color FROM categories WHERE id = ?').get(p.tipologia);
            return { ...p, tipologia: cat ? cat.name : p.tipologia, colore: cat ? cat.color : null };
        });
        io.emit('product-list', prodottiAggiornati);

        // 4. Salva l'ordine
        // Serializza i prodotti come JSON per permettere la nota per ogni prodotto
        const prodottiJson = JSON.stringify(prodottiArray);
        const stmt = db.prepare('INSERT INTO orders (uuid, recapOrdine, totale, timestamp, note) VALUES (?, ?, ?, ?, ?)');
        const info = stmt.run(
            String(order.uuid),
            prodottiJson,
            order.totale,
            order.timestamp,
            order.note ? String(order.note).substring(0, 1000) : null
        );
        const nuovoOrder = { id: info.lastInsertRowid, ...order };

        orders.push(order);
        socket.broadcast.emit('order-added', order);
        if (cb) cb(nuovoOrder);

        // Aggiorna riepiloghi dopo aggiunta ordine
        try {
            // Ultimo scontrino
            const lastOrder = db.prepare('SELECT * FROM orders ORDER BY timestamp DESC LIMIT 1').get();
            const totale = lastOrder ? lastOrder.totale : 0;
            const riepilogo = lastOrder && lastOrder.recapOrdine ? parseRecapOrdine(lastOrder.recapOrdine, db) : {};
            io.emit('ultimoScontrino', { riepilogo, totale });

            // Tutti gli ordini
            const allOrders = db.prepare('SELECT * FROM orders ORDER BY timestamp DESC').all();
            const elaboratedOrders = allOrders.map(order => ({
                id: order.id,
                timestamp: order.timestamp,
                totale: order.totale,
                dettagli: order.recapOrdine ? parseRecapOrdine(order.recapOrdine, db) : {}
            }));
            io.emit('recapScontrini', { orders: elaboratedOrders });

            // Analisi prodotti (periodo completo)
            const ordersForAnalysis = db.prepare('SELECT recapOrdine, timestamp FROM orders').all();
            const prodottiMap = {};
            let totaleDef = 0;
            for (const order of ordersForAnalysis) {
                const recap = order.recapOrdine;
                if (!recap) continue;

                let items = [];
                try {
                    // Prova a parsare come JSON (nuovo formato)
                    items = JSON.parse(recap);
                } catch {
                    // Fallback per vecchi ordini con formato stringa
                    items = recap.split(',').map(i => i.trim()).filter(Boolean)
                        .map(item => {
                            const [id, prezzo] = item.split(':');
                            return { id: id.trim(), prezzo: parseFloat(prezzo.trim()) };
                        });
                }

                for (const item of items) {
                    const idProdotto = String(item.id);
                    const prezzoFloat = Number(item.prezzo);
                    if (!prodottiMap[idProdotto]) {
                        prodottiMap[idProdotto] = {
                            pezziVenduti: 0,
                            totaleProdotto: 0,
                        };
                    }
                    prodottiMap[idProdotto].pezziVenduti += 1;
                    prodottiMap[idProdotto].totaleProdotto += prezzoFloat;
                    totaleDef += prezzoFloat;
                }
            }
            const result = [];
            const stmt = db.prepare('SELECT nome FROM prodotti WHERE id = ?');
            for (const id in prodottiMap) {
                const prodotto = prodottiMap[id];
                const nomeProdotto = stmt.get(id)?.nome || `Prodotto #${id}`;
                result.push({
                    prodotto: nomeProdotto,
                    pezziVenduti: prodotto.pezziVenduti,
                    totaleProdotto: parseFloat(prodotto.totaleProdotto.toFixed(2)),
                });
            }
            io.emit('analisi-prodotti', { vendite: result, TotaleDef: parseFloat(totaleDef.toFixed(2)) });
        } catch (e) {
            console.error('Errore invio dati riepilogo dopo new-order:', e);
        }

        // 5. Stampa termica automatica
        try {
            const printerName = risolviStampante();
            if (printerName) {
                const prodotti = Array.isArray(order.prodotti) ? order.prodotti : [];
                costruisciBufferStampa({
                    orderId: info.lastInsertRowid,
                    timestamp: order.timestamp,
                    prodotti,
                    totaleOrdine: order.totale,
                    note: order.note || '',
                    suffissoTitolo: null
                }).then(bufferUnico => printWithPrinter(printerName, bufferUnico))
                  .then(() => console.log('Stampa termica completata.'))
                  .catch(err => console.error('Errore stampa termica:', err));
            }
        } catch (e) {
            console.error('Errore generazione scontrino termico:', e);
        }
    });

    socket.on('remove-order', (id, cb) => {
        try {
            const order = db.prepare('SELECT recapOrdine FROM orders WHERE id = ?').get(id);
            if (!order) {
                console.log('Ordine non trovato:', id);
                if (cb) cb({ success: false, error: 'Ordine non trovato' });
                return;
            }

            const recap = order.recapOrdine;
            const productMap = {};

            // Gestisce sia formato JSON che stringa
            try {
                // Prova a parsare come JSON (nuovo formato)
                const items = JSON.parse(recap);
                items.forEach(item => {
                    const productId = parseInt(item.id);
                    if (!isNaN(productId)) {
                        productMap[productId] = (productMap[productId] || 0) + (item.quantita || 1);
                    }
                });
            } catch {
                // Fallback per vecchi ordini con formato stringa
                const entries = recap.split(',').map(p => p.trim()).filter(p => p);
                entries.forEach(entry => {
                    const [productIdStr] = entry.split(':');
                    const productId = parseInt(productIdStr);
                    if (!isNaN(productId)) {
                        productMap[productId] = (productMap[productId] || 0) + 1;
                    }
                });
            }

            const update = db.prepare('UPDATE prodotti SET quantita = quantita + ? WHERE id = ?');
            const check = db.prepare('SELECT id FROM prodotti WHERE id = ?');

            for (const [productIdStr, count] of Object.entries(productMap)) {
                const productId = parseInt(productIdStr);
                const exists = check.get(productId);
                if (!exists) continue;
                update.run(count, productId);
            }

            db.prepare('DELETE FROM orders WHERE id = ?').run(id);
            const prodottiAggiornati = db.prepare('SELECT * FROM prodotti').all();
            io.emit('product-list', prodottiAggiornati.map(p => {
                const cat = db.prepare('SELECT name, color FROM categories WHERE id = ?').get(p.tipologia);
                return { ...p, tipologia: cat ? cat.name : p.tipologia, colore: cat ? cat.color : null };
            }));

            if (cb) cb({ success: true });

            // Aggiorna riepiloghi dopo rimozione ordine
            try {
                // Ultimo scontrino
                const lastOrder = db.prepare('SELECT * FROM orders ORDER BY timestamp DESC LIMIT 1').get();
                const totale = lastOrder ? lastOrder.totale : 0;
                const riepilogo = lastOrder && lastOrder.recapOrdine ? parseRecapOrdine(lastOrder.recapOrdine, db) : {};
                io.emit('ultimoScontrino', { riepilogo, totale });

                // Tutti gli ordini
                const allOrders = db.prepare('SELECT * FROM orders ORDER BY timestamp DESC').all();
                const elaboratedOrders = allOrders.map(order => ({
                    id: order.id,
                    timestamp: order.timestamp,
                    totale: order.totale,
                    dettagli: order.recapOrdine ? parseRecapOrdine(order.recapOrdine, db) : {}
                }));
                io.emit('recapScontrini', { orders: elaboratedOrders });

                // Analisi prodotti (periodo completo)
                const ordersForAnalysis = db.prepare('SELECT recapOrdine, timestamp FROM orders').all();
                const prodottiMap = {};
                let totaleDef = 0;
                for (const order of ordersForAnalysis) {
                    const recap = order.recapOrdine;
                    if (!recap) continue;
                    let items = [];
                    try {
                        // Prova a parsare come JSON (nuovo formato)
                        items = JSON.parse(recap);
                    } catch {
                        // Fallback per vecchi ordini con formato stringa
                        items = recap.split(',').map(i => i.trim()).filter(Boolean)
                            .map(item => {
                                const [id, prezzo] = item.split(':');
                                return { id: id.trim(), prezzo: parseFloat(prezzo.trim()) };
                            });
                    }

                    for (const item of items) {
                        const idProdotto = String(item.id);
                        const prezzoFloat = Number(item.prezzo);
                        if (!prodottiMap[idProdotto]) {
                            prodottiMap[idProdotto] = {
                                pezziVenduti: 0,
                                totaleProdotto: 0,
                            };
                        }
                        prodottiMap[idProdotto].pezziVenduti += 1;
                        prodottiMap[idProdotto].totaleProdotto += prezzoFloat;
                        totaleDef += prezzoFloat;
                    }
                }
                const result = [];
                const stmt = db.prepare('SELECT nome FROM prodotti WHERE id = ?');
                for (const id in prodottiMap) {
                    const prodotto = prodottiMap[id];
                    const nomeProdotto = stmt.get(id)?.nome || `Prodotto #${id}`;
                    result.push({
                        prodotto: nomeProdotto,
                        pezziVenduti: prodotto.pezziVenduti,
                        totaleProdotto: parseFloat(prodotto.totaleProdotto.toFixed(2)),
                    });
                }
                io.emit('analisi-prodotti', { vendite: result, TotaleDef: parseFloat(totaleDef.toFixed(2)) });
            } catch (e) {
                console.error('Errore invio dati riepilogo dopo remove-order:', e);
            }
        } catch (error) {
            console.error('Errore durante remove-order:', error);
            if (cb) cb({ success: false, error: error.message });
        }
    });

    socket.on('remove-single-product-in-order', (id, cb) => {
        try {
            const order = getOrderById(id);
            if (!order) {
                console.log('Ordine non trovato:', id);
                if (cb) cb({ success: false, error: 'Ordine non trovato' });
                return;
            }

            const recap = order.recapOrdine;
            let prodotti = [];

            try {
                // Prova a parsare come JSON (nuovo formato)
                prodotti = JSON.parse(recap);
            } catch {
                // Fallback per vecchi ordini con formato stringa
                const entries = recap.split(',').map(p => p.trim()).filter(p => p);
                const prodottiMap = {};

                entries.forEach(entry => {
                    const [productIdStr] = entry.split(':');
                    const productId = parseInt(productIdStr);
                    if (!isNaN(productId)) {
                        if (!prodottiMap[productId]) {
                            const prodotto = db.prepare('SELECT nome FROM prodotti WHERE id = ?').get(productId);
                            if (prodotto) {
                                prodottiMap[productId] = { id: productId, nome: prodotto.nome, quantita: 1 };
                            }
                        } else {
                            prodottiMap[productId].quantita += 1;
                        }
                    }
                });

                prodotti = Object.values(prodottiMap);
            }

            if (cb) cb({ prodotti, orderId: id });
        } catch (e) {
            console.error('Errore durante remove-single-product-in-order:', e);
            if (cb) cb({ success: false, error: e.message });
        }
    });

    socket.on('updateOrder', (id, newOrder, cb) => {
        try {
            const order = getOrderById(id);
            if (!order) {
                if (cb) cb({ success: false, error: 'Ordine non trovato' });
                return;
            }

            let recap = order.recapOrdine;
            let currentProdotti = [];
            const dbTransaction = db.transaction(() => {
                // Parse del formato corrente (JSON o vecchio formato stringa)
                try {
                    currentProdotti = JSON.parse(recap);
                } catch {
                    // Fallback per vecchi ordini con formato stringa
                    const entries = recap.split(',').map(p => p.trim()).filter(p => p);
                    const prodottiMap = {};

                    entries.forEach(entry => {
                        const [productIdStr, prezzoStr] = entry.split(':');
                        const productId = parseInt(productIdStr);
                        const prezzo = parseFloat(prezzoStr);
                        if (!isNaN(productId)) {
                            if (!prodottiMap[productId]) {
                                const prodottoDB = db.prepare('SELECT nome FROM prodotti WHERE id = ?').get(productId);
                                prodottiMap[productId] = {
                                    id: productId,
                                    nome: prodottoDB ? prodottoDB.nome : `Prodotto #${productId}`,
                                    prezzo: prezzo,
                                    quantita: 1,
                                    note: "" // Sempre vuote per ordini convertiti dal vecchio formato
                                };
                            } else {
                                prodottiMap[productId].quantita += 1;
                            }
                        }
                    });

                    currentProdotti = Object.values(prodottiMap);
                }

                // 1. Ripristina le quantità dei prodotti dell'ordine originale
                const originalCounts = {};
                currentProdotti.forEach(p => {
                    originalCounts[p.id] = (originalCounts[p.id] || 0) + (p.quantita || 1);
                });
                for (const [productId, count] of Object.entries(originalCounts)) {
                    db.prepare('UPDATE prodotti SET quantita = quantita + ? WHERE id = ?').run(count, productId);
                }


                const newQuantities = {};
                if (Array.isArray(newOrder)) {
                    newOrder.forEach(p => {
                        newQuantities[p.id] = p.quantita;
                    });
                }

                // 2. Controlla la disponibilità e sottrai le nuove quantità
                const insufficientProducts = [];
                const newProdottiArray = [];
                let totaleNuovo = 0;

                for (const productIdStr in newQuantities) {
                    const productId = parseInt(productIdStr);
                    const newQ = newQuantities[productIdStr];

                    if (newQ > 0) {
                        const prodottoDB = db.prepare('SELECT nome, prezzo, quantita FROM prodotti WHERE id = ?').get(productId);

                        if (!prodottoDB || prodottoDB.quantita < newQ) {
                            insufficientProducts.push({ id: productId, richiesti: newQ, disponibili: prodottoDB ? prodottoDB.quantita : 0 });
                        } else {
                            db.prepare('UPDATE prodotti SET quantita = quantita - ? WHERE id = ?').run(newQ, productId);

                            for (let i = 0; i < newQ; i++) {
                                newProdottiArray.push({
                                    id: productId,
                                    nome: prodottoDB.nome,
                                    prezzo: prodottoDB.prezzo,
                                    quantita: 1,
                                    note: "" // Le note andrebbero gestite se necessario
                                });
                            }
                            totaleNuovo += prodottoDB.prezzo * newQ;
                        }
                    }
                }


                if (insufficientProducts.length > 0) {
                    // Se ci sono prodotti insufficienti, la transazione farà un rollback automatico
                    if (cb) cb({
                        success: false,
                        error: 'Quantità insufficienti per alcuni prodotti dopo il ripristino.',
                        dettagli: insufficientProducts
                    });
                    return; // Interrompe l'esecuzione
                }


                // Aggiorna ordine con il nuovo formato JSON
                db.prepare('UPDATE orders SET totale = ? WHERE id = ?').run(totaleNuovo, id);
                const newRecapJson = JSON.stringify(newProdottiArray);
                db.prepare('UPDATE orders SET recapOrdine = ? WHERE id = ?').run(newRecapJson, id);

                const prodottiAggiornati = db.prepare('SELECT * FROM prodotti').all();
                io.emit('product-list', prodottiAggiornati.map(p => {
                    const cat = db.prepare('SELECT name, color FROM categories WHERE id = ?').get(p.tipologia);
                    return { ...p, tipologia: cat ? cat.name : p.tipologia, colore: cat ? cat.color : null };
                }));

                if (cb) cb({ success: true, recap: newRecapJson, order, totaleNuovo });
            });
            dbTransaction();
        } catch (e) {
            if (cb) cb({ success: false, error: e.message });
        }
    });

    socket.on('print-modified-order', async (orderId, cb) => {
        try {
            const order = getOrderById(orderId);
            if (!order) { if (cb) cb({ success: false, error: 'Ordine non trovato' }); return; }

            const printerName = risolviStampante();
            if (!printerName) { if (cb) cb({ success: false, error: 'Nessuna stampante disponibile' }); return; }

            const prodotti = parseRecapProdotti(order.recapOrdine);
            const bufferUnico = await costruisciBufferStampa({
                orderId: order.id,
                timestamp: order.timestamp,
                prodotti,
                totaleOrdine: order.totale,
                note: order.note || '',
                suffissoTitolo: '(MODIFICATO)'
            });

            await printWithPrinter(printerName, bufferUnico);
            console.log(`Stampa termica completata per ordine modificato #${order.id}`);
            if (cb) cb({ success: true, message: 'Scontrino stampato con successo' });
        } catch (e) {
            console.error('Errore stampa ordine modificato:', e);
            if (cb) cb({ success: false, error: e.message });
        }
    });
    // === API via socket: ultimoScontrino ===
    socket.on('ultimoScontrino', (cb) => {
        try {
            const lastOrder = db.prepare('SELECT * FROM orders ORDER BY timestamp DESC LIMIT 1').get();
            const totale = lastOrder ? lastOrder.totale : 0;
            if (!lastOrder || !lastOrder.recapOrdine) {
                if (cb) cb({ error: 'no data available' });
                return;
            }
            const riepilogo = parseRecapOrdine(lastOrder.recapOrdine, db);
            if (cb) cb({ riepilogo, totale });
        } catch (error) {
            if (cb) cb({ error: error.message });
        }
    });

    // === API via socket: recapScontrini ===
    socket.on('recapScontrini', (cb) => {
        try {
            const allOrders = db.prepare('SELECT * FROM orders ORDER BY timestamp DESC').all();
            if (!allOrders || allOrders.length === 0) {
                if (cb) cb({ error: 'no data available' });
                return;
            }
            const elaboratedOrders = allOrders.map(order => ({
                id: order.id,
                timestamp: order.timestamp,
                totale: order.totale,
                dettagli: order.recapOrdine ? parseRecapOrdine(order.recapOrdine, db) : {}
            }));
            if (cb) cb({ orders: elaboratedOrders });
        } catch (error) {
            if (cb) cb({ error: error.message });
        }
    });

    // === API via socket: analisi-prodotti ===
    socket.on('analisi-prodotti', (params, cb) => {
        try {
            let { start, end } = params || {};
            if (!start || start === "") {
                start = "1900-01-01T00:00";
            }
            if (!end || end === "") {
                const now = new Date();
                const pad = n => n < 10 ? '0' + n : n;
                end = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
            }
            const startMs = new Date(start).getTime();
            const endMs = new Date(end).getTime();
            // Filtro direttamente in SQL per migliorare le performance
            const orders = db.prepare('SELECT recapOrdine, timestamp FROM orders WHERE timestamp >= ? AND timestamp <= ?').all(startMs, endMs);
            const prodottiMap = {}; // id -> { pezziVenduti, totaleProdotto }
            let totaleDef = 0;
            for (const order of orders) {
                const recap = order.recapOrdine;
                if (!recap) continue;
                let items = [];
                let parsedOk = false;
                // Prova nuovo formato JSON
                try {
                    const arr = JSON.parse(recap);
                    if (Array.isArray(arr)) {
                        items = arr.map(p => ({ id: p.id, prezzo: parseFloat(p.prezzo), quantita: p.quantita || 1 }));
                        parsedOk = true;
                    }
                } catch { /* ignore */ }
                if (!parsedOk) {
                    // Vecchio formato: "id:prezzo,id:prezzo,..."
                    items = recap.split(',').map(i => i.trim()).filter(Boolean).map(token => {
                        const [id, prezzo] = token.split(':');
                        return { id: id && id.replace(/[^0-9]/g,'') || id, prezzo: parseFloat((prezzo||'').trim()), quantita: 1 };
                    }).filter(x => !isNaN(x.prezzo));
                }
                for (const item of items) {
                    const idProdotto = String(item.id);
                    const prezzoTot = item.prezzo * (item.quantita || 1);
                    if (!prodottiMap[idProdotto]) {
                        prodottiMap[idProdotto] = { pezziVenduti: 0, totaleProdotto: 0 };
                    }
                    prodottiMap[idProdotto].pezziVenduti += (item.quantita || 1);
                    prodottiMap[idProdotto].totaleProdotto += prezzoTot;
                    totaleDef += prezzoTot;
                }
            }
            const result = [];
            const stmtNome = db.prepare('SELECT nome FROM prodotti WHERE id = ?');
            for (const id in prodottiMap) {
                const dato = prodottiMap[id];
                const nomeProdotto = stmtNome.get(id)?.nome || `Prodotto #${id}`;
                result.push({
                    prodotto: nomeProdotto,
                    pezziVenduti: dato.pezziVenduti,
                    totaleProdotto: parseFloat(dato.totaleProdotto.toFixed(2))
                });
            }
            if (cb) cb({ vendite: result, TotaleDef: parseFloat(totaleDef.toFixed(2)) });
        } catch (error) {
            if (cb) cb({ error: 'Errore nel calcolo vendite' });
        }
    });
    socket.on('product', product => {
        products.push(product)
        console.log('Nuovo prodotto ricevuto:', product)
        socket.broadcast.emit('product-modify', product);
    })
    socket.on('validate-license', (key, callback) => {
        console.log('Validazione licenza tentata con dati:', key);

        try {
            // Provo a estrarre la data dalla licenza
            let data = extractDateSafe(key.numero_licenza);
            if (data) {
                callback({ success: true, data: data });
            } else {
                callback({ success: false, message: 'Licenza non valida' });
            }
        } catch (e) {
            // Qualsiasi errore interno viene catturato
            console.error('Errore nella validazione licenza:', e);
            callback({ success: false, message: 'Licenza non valida' });
        }
    });

// Funzione wrapper che cattura eventuali errori
    function extractDateSafe(key) {
        try {
            return extractDate(key);
        } catch {
            return null; // se c'è un errore restituisce null
        }
    }

// Funzione originale
    function extractDate(key) {
        const numBig = fromBase62Big(key);
        const numStr = numBig.toString().padStart(14, "0"); // sempre 14 cifre
        const raw = numStr.slice(0, 12); // YYYYMMDD + salt
        const h = numStr.slice(12, 14);
        if (tinyHash(raw) !== h) throw new Error("Chiave non valida");
        const dateStr = raw.slice(0, 8);
        return dateStr.slice(0, 4) + "-" + dateStr.slice(4, 6) + "-" + dateStr.slice(6, 8);
    }

// Funzione originale
    const base62chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    function fromBase62Big(s) {
        try {
            let n = 0n;
            for (let c of s) {
                const idx = base62chars.indexOf(c);
                if (idx < 0) throw new Error("Carattere non valido");
                n = n * 62n + BigInt(idx);
            }
            return n;
        } catch {
            // In caso di errore ritorno null
            return null;
        }
    }

    // --- Hash di controllo (2 cifre) ---
    function tinyHash(str) {
        let h = 0;
        for (let c of str) h = (h * 31 + c.charCodeAt(0)) % 100;
        return h.toString().padStart(2, "0");
    }

    socket.on('login', (data, callback) => {
        console.log('log-in tentato con dati:', data);
        const user = users.find(
            u => u.username === data.username && u.password === data.password
        );
        if (user) {
            callback({ success: true });
        } else {
            callback({ success: false, message: 'Credenziali non valide' });
        }
    });
    socket.on('disconnect', () => {
        if (socket.id === masterId) {
            console.log('Master disconnesso');
            masterId = null;
        }
    });

    socket.on('stampa-ordine', async (orderId, cb) => {
        try {
            await stampaOrdineById(orderId);
            if (cb) cb({ success: true, message: `Ordine #${orderId} inviato alla stampante.` });
        } catch (error) {
            console.error(`Errore durante la stampa dell'ordine #${orderId}:`, error);
            if (cb) cb({ success: false, error: error.message });
        }
    });

})
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('Backend pronto:', Date.now());
    console.log(`Server in ascolto su http://0.0.0.0:${PORT}`);
});

function getOrderById(id) {
        return db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    }
    app.get('/get-socket-ip', (req, res) => {
        console.log('Backend: Richiesta ricevuta su /get-socket-ip');
        res.json({ ip: 'localhost', port: 3000 });
    });



function parseRecapOrdine(recapOrdine, db) {
    // Restituisce oggetto: { [id]: { nome, totalePrezzo, totaleSingoloProdotto, quantità } }
    if (!recapOrdine || typeof recapOrdine !== 'string') return {};
    let items = [];
    let parsedJson = false;
    // Nuovo formato JSON: array di prodotti {id, nome, prezzo, quantita, note}
    try {
        const arr = JSON.parse(recapOrdine);
        if (Array.isArray(arr)) {
            items = arr.map(p => ({
                id: p.id,
                prezzo: parseFloat(p.prezzo),
                quantita: p.quantita || 1
            })).filter(p => !isNaN(p.prezzo));
            parsedJson = true;
        }
    } catch { /* ignore */ }
    if (!parsedJson) {
        // Vecchio formato: id:prezzo,id:prezzo,... (quantità implicita = numero di occorrenze)
        items = recapOrdine.split(',')
            .map(s => s.trim())
            .filter(Boolean)
            .map(token => {
                const [idRaw, prezzoRaw] = token.split(':');
                const id = idRaw && idRaw.replace(/[^0-9]/g,'') || idRaw; // pulizia eventuali caratteri JSON residui
                const prezzo = parseFloat((prezzoRaw||'').trim());
                return { id, prezzo, quantita: 1 };
            })
            .filter(p => p.id != null && !isNaN(p.prezzo));
    }
    const totals = {}; // id -> { totale, quantità }
    for (const item of items) {
        const id = String(item.id);
        if (!totals[id]) totals[id] = { totale: 0, quantità: 0 };
        const qty = item.quantita || 1;
        totals[id].totale += (item.prezzo * qty);
        totals[id].quantità += qty;
    }
    const result = {};
    const stmt = db.prepare('SELECT nome FROM prodotti WHERE id = ?');
    for (const id in totals) {
        const prodotto = stmt.get(id);
        const totale = totals[id].totale;
        const qta = totals[id].quantità || 1;
        const prezzoUnit = qta > 0 ? (totale / qta) : 0;
        result[id] = {
            nome: prodotto ? prodotto.nome : 'Prodotto sconosciuto',
            totalePrezzo: parseFloat(totale.toFixed(2)),
            totaleSingoloProdotto: parseFloat(prezzoUnit.toFixed(2)),
            quantità: qta
        };
    }
    return result;
}

app.get("/get-db-from-folder", (req, res) => {
    try {
        const dbs = fs
            .readdirSync(dbFolder)
            .filter(file => file.endsWith(".sqlite3") || file.endsWith(".sqlite"))
            .map(file => file.replace(/\.(sqlite3|sqlite)$/, "")); // opzionale: rimuove estensione

        res.json({ databases: dbs });
    } catch (err) {
        console.error("Errore nel recupero dei database:", err);
        res.status(500).json({ error: "Impossibile leggere la cartella dei database" });
    }
});
// ================== API CONFIG SCONTRINO ==================
app.get('/api/print-summary-receipt', (req, res) => {
    try {
        res.json({ value: getPrintSummarySetting() });
    } catch {
        res.status(500).json({ error: 'Impossibile leggere la preferenza' });
    }
});

app.post('/api/print-summary-receipt', (req, res) => {
    try {
        const value = !!(req.body && req.body.value);
        const updated = writeAppConfig({ printSummaryReceipt: value });
        res.json({ value: !!updated.printSummaryReceipt });
    } catch {
        res.status(500).json({ error: 'Impossibile salvare la preferenza' });
    }
});
// ================== FINE API CONFIG SCONTRINO ==================

// Serve i file statici del frontend Vue
const staticPath = path.join(__dirname, '../client/dist');
app.use(express.static(staticPath));

/*
// Route catch-all SOLO per richieste non gestite dalle API
app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});*/

