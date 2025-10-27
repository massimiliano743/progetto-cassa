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
console.log('Caricamento handlebars...', Date.now());
const handlebars = require('handlebars');
console.log('Caricamento pdfkit...', Date.now());
const PDFDocument = require('pdfkit');
console.log('Caricamento puppeteer...', Date.now());
const puppeteer = require('puppeteer');
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
const PRINTER_CONFIG_PATH = path.join(__dirname, 'stampante-selezionata.json');
const isWindows = os.platform() === 'win32';

// Costanti ESC/POS per i comandi - INIZIO AGGIUNTA/VERIFICA
const ESC = '\x1B'; // Escape character (ASCII 27 in esadecimale)
const GS = '\x1D';  // Group Separator character (ASCII 29 in esadecimale)
const FS = '\x1C';  // Field Separator character (ASCII 28 in esadecimale)
// FINE AGGIUNTA/VERIFICA
const ESC_POS_COMMANDS = {
    TAGLIA_CARTA:      `${GS}V\x00`,     // Taglio completo della carta. \x00 indica taglio completo.
    TESTO_GRANDE:      `${ESC}!\x30`,    // Doppia altezza e larghezza (Font A).
    TESTO_NORMALE:     `${ESC}!\x00`,    // Testo normale (Font A).
    TESTO_MEDIO:       `${ESC}!\x10`,    // Altezza doppia, larghezza normale (Font A).
    TESTO_LARGO:       `${ESC}!\x20`,    // Larghezza doppia, altezza normale (Font A).
    FONT_B:            `${ESC}M\x01`,    // Font B (più piccolo).
    FONT_A:            `${ESC}M\x00`,    // Font A (standard).
    SOTTOLINEATO:      `${ESC}-\x01`,    // Sottolineato ON.
    SOTTOLINEATO_OFF:  `${ESC}-\x00`,    // Sottolineato OFF.
    INVERTI:           `${ESC}B\x01`,    // Inverti bianco/nero ON.
    INVERTI_OFF:       `${ESC}B\x00`,    // Inverti bianco/nero OFF.
    CENTRA:            `${ESC}a\x01`,    // Allineamento al centro.
    ALLINEA_SINISTRA:  `${ESC}a\x00`,    // Allineamento a sinistra.
    ALLINEA_DESTRA:    `${ESC}a\x02`,    // Allineamento a destra.
    GRASSETTO:         `${ESC}E\x01`,    // Grassetto ON.
    GRASSETTO_OFF:     `${ESC}E\x00`,    // Grassetto OFF.
    // Puoi aggiungere altri comandi qui se necessario in futuro
};

// Inizializzazione config stampante
function initPrinterConfig() {
    if (!fs.existsSync(PRINTER_CONFIG_PATH)) {
        fs.writeFileSync(PRINTER_CONFIG_PATH, JSON.stringify({ printer: null }), 'utf-8');
    }
}
initPrinterConfig();

// Ottieni stampante selezionata
function getSelectedPrinter() {
    try {
        const data = fs.readFileSync(PRINTER_CONFIG_PATH, 'utf-8');
        return JSON.parse(data).printer;
    } catch {
        return null;
    }
}

// Salva stampante selezionata
function setSelectedPrinter(printerName) {
    fs.writeFileSync(PRINTER_CONFIG_PATH, JSON.stringify({
        printer: printerName,
        lastUpdated: new Date().toISOString()
    }), 'utf-8');
}

// Ottieni la stampante predefinita
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

// Funzione per ottenere la lista delle stampanti
async function getPrinterList() {
    try {
        if (isWindows) {
            const stdout = execSync('wmic printer get name').toString();
            return stdout.split('\r\r\n')
                .slice(1)
                .map(p => p.trim())
                .filter(p => p);
        } else {
            const stdout = execSync('lpstat -e').toString();
            return stdout.split('\n')
                .map(line => line.trim())
                .filter(line => line);
        }
    } catch (error) {
        console.error('Errore lista stampanti:', error);
        return [];
    }
}

// Funzione per stampare con una specifica stampante
async function printWithPrinter(printerName, content) {
    const printData = Buffer.isBuffer(content) ? content : Buffer.from(content);

    if (isWindows) {
        // Usa PowerShell per stampare su Windows
        const base64 = printData.toString('base64');
        const psScript = `
            $printerName = "${printerName}"
            $bytes = [Convert]::FromBase64String("${base64}")
            $filePath = [System.IO.Path]::GetTempFileName()
            [System.IO.File]::WriteAllBytes($filePath, $bytes)
            Start-Process -FilePath $filePath -Verb PrintTo -ArgumentList $printerName -Wait
            Start-Sleep -Seconds 2
            Remove-Item $filePath
        `;

        return new Promise((resolve, reject) => {
            exec(`powershell -Command "${psScript}"`, (error) => {
                if (error) reject(error);
                else resolve();
            });
        });
    } else {
        // Usa lpr per macOS/Linux
        return new Promise((resolve, reject) => {
            const os = require('os');
            const tempDir = os.tmpdir();
            const tempFile = path.join(tempDir, `print_${Date.now()}.bin`);
            try {
                fs.writeFileSync(tempFile, printData);
                console.log(`[STAMPA] File temporaneo creato: ${tempFile}`);
            } catch (err) {
                console.error(`[STAMPA] Errore creazione file temporaneo:`, err);
                return reject(err);
            }
            exec(`lpr -o raw ${tempFile} -P "${printerName}"`, (error, stdout, stderr) => {
                try {
                    fs.unlinkSync(tempFile);
                    console.log(`[STAMPA] File temporaneo eliminato: ${tempFile}`);
                } catch (unlinkErr) {
                    console.error(`[STAMPA] Errore eliminazione file temporaneo:`, unlinkErr);
                }
                if (error) {
                    console.error(`[STAMPA] Errore comando lpr:`, error, stderr);
                    return reject(error);
                }
                console.log(`[STAMPA] Comando lpr eseguito con successo. Output:`, stdout);
                resolve();
            });
        });
    }
}

// Funzione per generare comandi ESC/POS
function generateEscPosContent(receiptContent) { // ho rinominato 'test' in 'receiptContent' per chiarezza
    let escPosBytes = [];

    // 1. Inizializza la stampante (resettando le impostazioni) - Buona pratica per iniziare puliti.
    escPosBytes.push(ESC.charCodeAt(0)); // ESC
    escPosBytes.push('@'.charCodeAt(0)); // @

    // 2. Imposta la Code Page per il simbolo Euro
    console.log("Configurazione per simbolo Euro.");
    // Comando per abilitare il simbolo Euro: 1f 1b 10 12 12 01 (HEX)
    // Questo è il comando specifico Munbyn ITPP068USE per attivare il simbolo dell'euro.
    escPosBytes.push(0x1F, 0x1B, 0x10, 0x12, 0x12, 0x01);
    // Comando per selezionare la Code Page 2 (CP858) - Munbyn spesso la associa all'euro.
    // Prova con 0x02. Se non funziona, prova con 0x00 (CP437, spesso \xDD) o 0x10 (CP1252, spesso \x80).
    escPosBytes.push(ESC.charCodeAt(0)); // ESC
    escPosBytes.push('t'.charCodeAt(0)); // t
    escPosBytes.push(0x10); // Code Page 2 (HEX: \x02, corrisponde a CP858)

    const lines = receiptContent.split('\n');

    lines.forEach(line => {
        let processedLine = line;

        // Sostituisci i comandi testuali come [COMANDO:CENTRA] con le sequenze ESC/POS corrette
        for (const [commandName, escPosSequence] of Object.entries(ESC_POS_COMMANDS)) {
            const commandPlaceholder = `[COMANDO:${commandName}]`;
            processedLine = processedLine.split(commandPlaceholder).join(escPosSequence);
        }

        // Gestione del simbolo Euro (€): Sostituisci il simbolo testuale con il byte corretto
        // '\xD5' è il byte per l'Euro in Code Page 858.
        // Se non funziona con 0x02 e \xD5, prova a cambiare 0x02 a 0x00 e \xD5 a \xDD,
        // o 0x02 a 0x10 e \xD5 a \x80 (ma \xD5 con 0x02 è il più probabile per Munbyn).
        processedLine = processedLine.replace(/€/g, '\x80');

        // Converti la riga processata in un array di byte ASCII (o della Code Page selezionata)
        // Questo ciclo itera su ogni carattere della stringa e lo aggiunge come singolo byte.
        for (let i = 0; i < processedLine.length; i++) {
            escPosBytes.push(processedLine.charCodeAt(i));
        }

        // Aggiungi un Line Feed (ritorno a capo) alla fine di ogni riga
        escPosBytes.push('\x0A'.charCodeAt(0)); // Line Feed (LF)
    });

    // Ritorna un Buffer di byte. Questo è CRUCIALE per inviare dati raw alla stampante.
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
app.get('/stampanti', async (req, res) => {
    try {
        const printers = await getPrinterList();
        res.json(printers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/seleziona-stampante', (req, res) => {
    const { printerName } = req.body;
    if (!printerName) {
        return res.status(400).json({ error: 'Nome stampante mancante' });
    }
    setSelectedPrinter(printerName);
    res.json({ success: true });
});

app.post('/stampa', async (req, res) => {
    try {
        const { testo } = req.body;
        if (!testo) {
            return res.status(400).json({ error: 'Testo mancante' });
        }

        // Usa stampante selezionata o predefinita
        let printerName = getSelectedPrinter();
        if (!printerName) {
            printerName = getDefaultPrinter();
            if (printerName) setSelectedPrinter(printerName);
        }

        if (!printerName) {
            return res.status(400).json({ error: 'Nessuna stampante disponibile' });
        }

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
        const printers = await getPrinterList();
        const printersAvailable = printers.length > 0;
        res.json({
            selected: !!getSelectedPrinter(),
            printersAvailable
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/stampante-selezionata', (req, res) => {
    const selected = getSelectedPrinter();
    if (!selected) {
        return res.status(404).json({ error: 'Nessuna stampante selezionata' });
    }
    res.json({ printer: selected });
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

db = openDb(currentDbName);



let orders = []
let products = []
let masterId = null;

const users = [
    { username: 'admin', password: 'admin' },
    { username: 'user', password: 'user' }
];


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

    // Riceve nuovi ordini dal client e li broadcasta agli altri
    // --- FUNZIONI PER LA GENERAZIONE DELLO SCONTRINO GRAFICO ---
// Queste funzioni sono state messe qui per ordine. Non modificano la logica esistente.

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
        // Rimuovi questa riga se presente: const simboloEuro = '\x80';

        const dataOraOrdine = new Date(datiOrdine.dataOra);
        const addLeadingZero = (num) => num < 10 ? '0' + num : num;
        const giorno = addLeadingZero(dataOraOrdine.getDate());
        const mese = addLeadingZero(dataOraOrdine.getMonth() + 1);
        const anno = dataOraOrdine.getFullYear();
        const ore = addLeadingZero(dataOraOrdine.getHours());
        const minuti = addLeadingZero(dataOraOrdine.getMinutes());

        const dataFormattata = `${giorno}/${mese}/${anno} ${ore}:${minuti}`;

        // Qui usi i comandi testuali che verranno interpretati da generateEscPosContent
        // Ho rimesso i comandi di centratura e dimensione che avevamo definito
        // Ho commentato il logo per ora, poiché richiede gestione separata e complessa
        // scontrino.push('[COMANDO:STAMPA_LOGO]'); // Commentato, da gestire a parte se hai un logo binario
        scontrino.push('');
        scontrino.push(`[COMANDO:CENTRA][COMANDO:TESTO_GRANDE]${datiOrdine.titoloAzienda}[COMANDO:TESTO_NORMALE]`);
        scontrino.push('[COMANDO:TESTO_NORMALE]'); // Assicurati che il testo successivo sia normale
        scontrino.push(`[COMANDO:CENTRA][COMANDO:TESTO_GRANDE][COMANDO:FONT_A][COMANDO:SOTTOLINEATO]${datiOrdine.sottotitoloAzienda}[COMANDO:SOTTOLINEATO_OFF][COMANDO:TESTO_NORMALE]`);
        scontrino.push('');
        // Imposta definitivamente l'allineamento a sinistra per il resto dello scontrino (data, intestazioni e prodotti)
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

        scontrino.push(...helpers.creaRigaColonne('Prodotto', 'N°', 'TOT', larghezzeColonne));
        scontrino.push(helpers.creaSeparatore(larghezzaCaratteri));
        datiOrdine.prodotti.forEach(p => {
            // Nome prodotto base senza comandi (evita di inquinare i calcoli di larghezza)
            let nomeProdotto = `${p.nome}`;
            let extra = '';
            if (p.note && p.note.trim() !== "") {
                extra += ` - ${p.note}`;
            }
            if (p.quantita > 1) {
                const prezzoUnitarioFormat = Number(p.prezzoUnitario || p.prezzo).toFixed(2);
                extra += ` (€${prezzoUnitarioFormat} cad.)`;
            }
            nomeProdotto = nomeProdotto.toUpperCase() + extra;
            const qta = p.quantita.toString();
            const totaleRiga = `€` + Number(p.totale).toFixed(2);
            const righeProd = helpers.creaRigaColonne(nomeProdotto, qta, totaleRiga, larghezzeColonne);
            // Prefissa solo il comando di dimensione (allineamento già impostato prima dell'intestazione)
            if (righeProd.length > 0) {
                righeProd[0] = `[COMANDO:TESTO_MEDIO]` + righeProd[0];
            }
            scontrino.push(...righeProd);
        });
        scontrino.push(helpers.creaSeparatore(larghezzaCaratteri));
        // Inseriamo il simbolo € qui come carattere normale
        const testoTotale = `Totale: €` + Number(datiOrdine.totaleOrdine).toFixed(2);
        // Aggiunto [COMANDO:TESTO_NORMALE] per riportare il testo alla dimensione standard dopo il totale grande.
        scontrino.push(`[COMANDO:ALLINEA_DESTRA][COMANDO:TESTO_GRANDE]${testoTotale}[COMANDO:TESTO_NORMALE]`);
        scontrino.push('');
        // Stampa la nota se presente
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
        // Riattivato il comando [COMANDO:TAGLIA_CARTA] che ora verrà interpretato correttamente
        scontrino.push('[COMANDO:TAGLIA_CARTA]');
        return scontrino.join('\n');
    }

// --- TUA FUNZIONE SOCKET.IO CON LA LOGICA DI STAMPA INTEGRATA ---

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
            let printerName = getSelectedPrinter();
            if (!printerName) {
                printerName = getDefaultPrinter();
                if (printerName) setSelectedPrinter(printerName);
            }

            if (printerName) {
                // --- INIZIO BLOCCO STAMPA AVANZATA ---

                // Impostazioni (modifica qui i tuoi dati)
                const NOME_AZIENDA = currentDbName;
                const CONFIG_STAMPANTE = { larghezzaCaratteri: 42 };

                // Raggruppa prodotti per categoria e prepara array con note
                const prodotti = Array.isArray(order.prodotti) ? order.prodotti : [];
                const prodottiPerCategoria = {};
                prodotti.forEach(p => {
                    // Recupera la categoria dal DB
                    const prodDb = db.prepare('SELECT tipologia FROM prodotti WHERE id = ?').get(p.id);
                    const tipologia = prodDb ? prodDb.tipologia : 'Senza categoria';
                    if (!prodottiPerCategoria[tipologia]) prodottiPerCategoria[tipologia] = [];
                    prodottiPerCategoria[tipologia].push({
                        nome: p.nome,
                        quantita: p.quantita,
                        prezzo: p.prezzo,
                        totale: Number(p.prezzo) * Number(p.quantita),
                        note: p.note || ""
                    });
                });

                // Recupera i nomi delle categorie
                const categorieNomi = {};
                Object.keys(prodottiPerCategoria).forEach(catId => {
                    const cat = db.prepare('SELECT name FROM categories WHERE id = ?').get(catId);
                    categorieNomi[catId] = cat ? cat.name : `Categoria #${catId}`;
                });

                // Stampa scontrini per categoria
                let bufferUnico = Buffer.alloc(0);
                // Scegli l'immagine da stampare: priorità a last_uploaded.png/jpg, altrimenti logo.png
                let logoPath = null;
                const imgDir = path.join(__dirname, 'img');
                // Cerca l'ultima immagine caricata (uploaded_*.png/jpg)
                const files = fs.readdirSync(imgDir)
                    .filter(f => f.startsWith('uploaded_') && (f.endsWith('.png') || f.endsWith('.jpg')))
                    .sort((a, b) => {
                        // Ordina per timestamp decrescente
                        const getTs = name => {
                            const match = name.match(/uploaded_(\d+)/);
                            return match ? parseInt(match[1]) : 0;
                        };
                        return getTs(b) - getTs(a);
                    });
                if (files.length > 0) {
                    logoPath = path.join(imgDir, files[0]);
                } else if (fs.existsSync(path.join(imgDir, 'logo.png'))) {
                    logoPath = path.join(imgDir, 'logo.png');
                }
                let logoBuffer = Buffer.alloc(0);
                try {
                    if (logoPath) {
                        logoBuffer = await getLogoEscPosBuffer(logoPath);
                        logoBuffer = Buffer.concat([logoBuffer, Buffer.from([])]);
                    }
                } catch (e) {
                    console.error('Errore caricamento logo:', e);
                }
                for (const [catId, prodottiCat] of Object.entries(prodottiPerCategoria)) {
                    const datiScontrinoCat = {
                        numeroScontrino: info.lastInsertRowid,
                        dataOra: order.timestamp,
                        titoloAzienda: NOME_AZIENDA,
                        sottotitoloAzienda: categorieNomi[catId],
                        prodotti: prodottiCat,
                        totaleOrdine: prodottiCat.reduce((acc, p) => acc + Number(p.totale), 0),
                        note: ''
                    };
                    const receiptContentCat = generaScontrinoTermicoAvanzato(datiScontrinoCat, CONFIG_STAMPANTE);
                    const contentCat = generateEscPosContent(receiptContentCat);
                    bufferUnico = Buffer.concat([bufferUnico, logoBuffer, contentCat]);
                }
                // Stampa anche lo scontrino riepilogativo dell'ordine
                if (getPrintSummarySetting()) {
                    const datiScontrinoRiepilogo = {
                        numeroScontrino: info.lastInsertRowid,
                        dataOra: order.timestamp,
                        titoloAzienda: NOME_AZIENDA,
                        sottotitoloAzienda: 'Riepilogo Ordine',
                        prodotti: prodotti.map(p => ({
                            nome: p.nome,
                            quantita: p.quantita,
                            prezzo: p.prezzo,
                            totale: Number(p.prezzo) * Number(p.quantita),
                            note: p.note || ''
                        })),
                        totaleOrdine: order.totale,
                        note: order.note || ''
                    };
                    const receiptContentRiepilogo = generaScontrinoTermicoAvanzato(datiScontrinoRiepilogo, CONFIG_STAMPANTE);
                    const contentRiepilogo = generateEscPosContent(receiptContentRiepilogo);
                    bufferUnico = Buffer.concat([bufferUnico, logoBuffer, Buffer.from([0x0A]), contentRiepilogo]);
                }
                // --- FINE BLOCCO STAMPA AVANZATA ---
                printWithPrinter(printerName, bufferUnico)
                    .then(() => console.log('Stampa termica completata con layout avanzato (job per categoria).'))
                    .catch(err => console.error('Errore stampa termica:', err));
            }
        } catch (e) {
            console.error('Errore generazione scontrino termico:', e);
        }

        // 6. Genera PDF (opzionale)
        // ... [il tuo codice esistente per generare PDF] ...
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

    // Nuovo evento per stampare scontrino di ordine modificato
    socket.on('print-modified-order', async (orderId, cb) => {
        try {
            const order = getOrderById(orderId);
            if (!order) {
                if (cb) cb({ success: false, error: 'Ordine non trovato' });
                return;
            }

            let printerName = getSelectedPrinter();
            if (!printerName) {
                printerName = getDefaultPrinter();
                if (printerName) setSelectedPrinter(printerName);
            }

            if (!printerName) {
                if (cb) cb({ success: false, error: 'Nessuna stampante disponibile' });
                return;
            }

            // Parse prodotti dall'ordine
            let prodotti = [];
            try {
                prodotti = JSON.parse(order.recapOrdine);
            } catch {
                // Fallback per vecchi ordini
                const entries = order.recapOrdine.split(',').map(p => p.trim()).filter(p => p);
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
                                note: ""
                            };
                        } else {
                            prodottiMap[productId].quantita += 1;
                        }
                    }
                });
                prodotti = Object.values(prodottiMap);
            }

            // Impostazioni stampa
            const NOME_AZIENDA = currentDbName;
            const CONFIG_STAMPANTE = { larghezzaCaratteri: 42 };

            // Raggruppa prodotti per categoria
            const prodottiPerCategoria = {};
            prodotti.forEach(p => {
                const prodDb = db.prepare('SELECT tipologia FROM prodotti WHERE id = ?').get(p.id);
                const tipologia = prodDb ? prodDb.tipologia : 'Senza categoria';
                if (!prodottiPerCategoria[tipologia]) prodottiPerCategoria[tipologia] = [];
                prodottiPerCategoria[tipologia].push({
                    nome: p.nome,
                    quantita: p.quantita,
                    prezzo: p.prezzo,
                    totale: Number(p.prezzo) * Number(p.quantita),
                    note: p.note || ""
                });
            });

            // Recupera i nomi delle categorie
            const categorieNomi = {};
            Object.keys(prodottiPerCategoria).forEach(catId => {
                const cat = db.prepare('SELECT name FROM categories WHERE id = ?').get(catId);
                categorieNomi[catId] = cat ? cat.name : `Categoria #${catId}`;
            });

            // Prepara buffer per stampa
            let bufferUnico = Buffer.alloc(0);

            // Gestione logo
            let logoPath = null;
            const imgDir = path.join(__dirname, 'img');
            const files = fs.readdirSync(imgDir)
                .filter(f => f.startsWith('uploaded_') && (f.endsWith('.png') || f.endsWith('.jpg')))
                .sort((a, b) => {
                    const getTs = name => {
                        const match = name.match(/uploaded_(\d+)/);
                        return match ? parseInt(match[1]) : 0;
                    };
                    return getTs(b) - getTs(a);
                });
            if (files.length > 0) {
                logoPath = path.join(imgDir, files[0]);
            } else if (fs.existsSync(path.join(imgDir, 'logo.png'))) {
                logoPath = path.join(imgDir, 'logo.png');
            }

            let logoBuffer = Buffer.alloc(0);
            try {
                if (logoPath) {
                    logoBuffer = await getLogoEscPosBuffer(logoPath);
                    logoBuffer = Buffer.concat([logoBuffer, Buffer.from([])]);
                }
            } catch (e) {
                console.error('Errore caricamento logo:', e);
            }

            // Stampa scontrini per categoria
            for (const [catId, prodottiCat] of Object.entries(prodottiPerCategoria)) {
                const datiScontrinoCat = {
                    numeroScontrino: order.id,
                    dataOra: order.timestamp,
                    titoloAzienda: NOME_AZIENDA,
                    sottotitoloAzienda: `${categorieNomi[catId]} (MODIFICATO)`,
                    prodotti: prodottiCat,
                    totaleOrdine: prodottiCat.reduce((acc, p) => acc + Number(p.totale), 0),
                    note: ''
                };
                const receiptContentCat = generaScontrinoTermicoAvanzato(datiScontrinoCat, CONFIG_STAMPANTE);
                const contentCat = generateEscPosContent(receiptContentCat);
                bufferUnico = Buffer.concat([bufferUnico, logoBuffer, contentCat]);
            }

            // Stampa scontrino riepilogativo
            if (getPrintSummarySetting()) {
                const datiScontrinoRiepilogo = {
                    numeroScontrino: order.id,
                    dataOra: order.timestamp,
                    titoloAzienda: NOME_AZIENDA,
                    sottotitoloAzienda: 'Riepilogo Ordine (MODIFICATO)',
                    prodotti: prodotti.map(p => ({
                        nome: p.nome,
                        quantita: p.quantita,
                        prezzo: p.prezzo,
                        totale: Number(p.prezzo) * Number(p.quantita),
                        note: p.note || ''
                    })),
                    totaleOrdine: order.totale,
                    note: order.note || ''
                };
                const receiptContentRiepilogo = generaScontrinoTermicoAvanzato(datiScontrinoRiepilogo, CONFIG_STAMPANTE);
                const contentRiepilogo = generateEscPosContent(receiptContentRiepilogo);
                bufferUnico = Buffer.concat([bufferUnico, logoBuffer, Buffer.from([0x0A]), contentRiepilogo]);
            }

            // Esegui stampa
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
    async function stampaOrdineById(orderId) {
        try {
            const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
            if (!order) {
                throw new Error(`Ordine con ID ${orderId} non trovato.`);
            }

            let printerName = getSelectedPrinter();
            if (!printerName) {
                printerName = getDefaultPrinter();
                if (printerName) setSelectedPrinter(printerName);
            }

            if (!printerName) {
                throw new Error('Nessuna stampante disponibile o configurata.');
            }

            const NOME_AZIENDA = currentDbName;
            const CONFIG_STAMPANTE = { larghezzaCaratteri: 42 };

            let prodotti = [];
            try {
                prodotti = JSON.parse(order.recapOrdine);
            } catch (e) {
                console.error("Formato recapOrdine non JSON, tentativo di fallback non implementato per la ristampa.", e);
                // Per semplicità, questa funzione di ristampa supporterà solo il nuovo formato JSON.
                // Se necessario, si può aggiungere qui la logica di parsing del vecchio formato stringa.
                throw new Error("Impossibile leggere i prodotti dell'ordine. Formato obsoleto non supportato per la ristampa.");
            }

            const prodottiPerCategoria = {};
            prodotti.forEach(p => {
                const prodDb = db.prepare('SELECT tipologia FROM prodotti WHERE id = ?').get(p.id);
                const tipologia = prodDb ? prodDb.tipologia : 'Senza categoria';
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

            let bufferUnico = Buffer.alloc(0);
            let logoPath = null;
            const imgDir = path.join(__dirname, 'img');
            const files = fs.readdirSync(imgDir)
                .filter(f => f.startsWith('uploaded_') && (f.endsWith('.png') || f.endsWith('.jpg')))
                .sort((a, b) => {
                    const getTs = name => {
                        const match = name.match(/uploaded_(\d+)/);
                        return match ? parseInt(match[1]) : 0;
                    };
                    return getTs(b) - getTs(a);
                });
            if (files.length > 0) {
                logoPath = path.join(imgDir, files[0]);
            } else if (fs.existsSync(path.join(imgDir, 'logo.png'))) {
                logoPath = path.join(imgDir, 'logo.png');
            }

            let logoBuffer = Buffer.alloc(0);
            if ( logoPath) {
                try {
                    logoBuffer = await getLogoEscPosBuffer(logoPath);
                } catch (e) {
                    console.error('Errore caricamento logo per ristampa:', e);
                }
            }

            for (const [catId, prodottiCat] of Object.entries(prodottiPerCategoria)) {
                const datiScontrinoCat = {
                    numeroScontrino: order.id,
                    dataOra: order.timestamp,
                    titoloAzienda: NOME_AZIENDA,
                    sottotitoloAzienda: categorieNomi[catId],
                    prodotti: prodottiCat,
                    totaleOrdine: prodottiCat.reduce((acc, p) => acc + Number(p.totale), 0),
                    note: ''
                };
                const receiptContentCat = generaScontrinoTermicoAvanzato(datiScontrinoCat, CONFIG_STAMPANTE);
                const contentCat = generateEscPosContent(receiptContentCat);
                bufferUnico = Buffer.concat([bufferUnico, logoBuffer, contentCat]);
            }

            if (getPrintSummarySetting()) {
                const datiScontrinoRiepilogo = {
                    numeroScontrino: order.id,
                    dataOra: order.timestamp,
                    titoloAzienda: NOME_AZIENDA,
                    sottotitoloAzienda: 'Riepilogo Ordine',
                    prodotti: prodotti.map(p => ({
                        nome: p.nome,
                        quantita: p.quantita,
                        prezzo: p.prezzo,
                        totale: Number(p.prezzo) * Number(p.quantita),
                        note: p.note || ''
                    })),
                    totaleOrdine: order.totale,
                    note: order.note || ''
                };
                const receiptContentRiepilogo = generaScontrinoTermicoAvanzato(datiScontrinoRiepilogo, CONFIG_STAMPANTE);
                const contentRiepilogo = generateEscPosContent(receiptContentRiepilogo);
                bufferUnico = Buffer.concat([bufferUnico, logoBuffer, Buffer.from([0x0A]), contentRiepilogo]);
            }

            await printWithPrinter(printerName, bufferUnico);
            console.log(`Ristampa termica dell'ordine #${orderId} completata.`);

        } catch (error) {
            console.error(`Errore in stampaOrdineById per l'ordine #${orderId}:`, error);
            throw error; // Rilancia l'errore per essere gestito dal chiamante (l'evento socket)
        }
    }

})
    server.listen(3000,'0.0.0.0', () => {
        console.log('Server Socket.IO in ascolto su http://localhost:3000')
    })

const PORT = 3000;
server.listen(PORT, () => {
  console.log('Backend pronto:', Date.now());
  console.log(`Backend: Server listening on port ${PORT}`);
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

