const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');
const sharp = require("sharp");
const { exec, execSync } = require('child_process');

/********** START DATABAESE FUNCTIONS **********/
const dbFolder = path.join(__dirname, 'dbs');
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
function getDbPath(dbName) {
    return path.join(dbFolder, dbName + '.sqlite3');
}

/********** END DATABAESE FUNCTIONS **********/

/********** START ORDER FUNCTIONS **********/
function getOrderById(id,db) {
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
}
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
/********** END ORDER FUNCTIONS **********/

/********** START CRYPTO FUNCTIONS **********/
const base62chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function extractDateSafe(key) {
    try {
        return extractDate(key);
    } catch {
        return null; // se c'è un errore restituisce null
    }
}
function extractDate(key) {
    const numBig = fromBase62Big(key);
    const numStr = numBig.toString().padStart(14, "0"); // sempre 14 cifre
    const raw = numStr.slice(0, 12); // YYYYMMDD + salt
    const h = numStr.slice(12, 14);
    if (tinyHash(raw) !== h) throw new Error("Chiave non valida");
    const dateStr = raw.slice(0, 8);
    return dateStr.slice(0, 4) + "-" + dateStr.slice(4, 6) + "-" + dateStr.slice(6, 8);
}
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
function tinyHash(str) {
    let h = 0;
    for (let c of str) h = (h * 31 + c.charCodeAt(0)) % 100;
    return h.toString().padStart(2, "0");
}
/********** END CRYPTO FUNCTIONS **********/

/********** START PRINTER FUNCTIONS **********/

const PRINTER_CONFIG_PATH = path.join(__dirname, 'stampante-selezionata.json');
const isWindows = os.platform() === 'win32';
const ESC = '\x1B'; // Escape character (ASCII 27 in esadecimale)
const GS = '\x1D';  // Group Separator character (ASCII 29 in esadecimale)
const FS = '\x1C';  // Field Separator character (ASCII 28 in esadecimale)
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
// Salva stampante selezionata
function setSelectedPrinter(printerName) {
    fs.writeFileSync(PRINTER_CONFIG_PATH, JSON.stringify({
        printer: printerName,
        lastUpdated: new Date().toISOString()
    }), 'utf-8');
}
// Ottieni stampante selezionata
function getSelectedPrinter() {
    try {
        const data = fs.readFileSync(PRINTER_CONFIG_PATH, 'utf-8');
        return JSON.parse(data).printer;
    } catch {
        return null;
    }
}
// Inizializzazione config stampante
function initPrinterConfig() {
    if (!fs.existsSync(PRINTER_CONFIG_PATH)) {
        fs.writeFileSync(PRINTER_CONFIG_PATH, JSON.stringify({ printer: null }), 'utf-8');
    }
}

/********** END PRINTER FUNCTIONS **********/

module.exports = {
    openDb,
    dbFolder,
    getOrderById,
    parseRecapOrdine,
    extractDateSafe,
    getLogoEscPosBuffer,
    generateEscPosContent,
    printWithPrinter,
    getPrinterList,
    getDefaultPrinter,
    setSelectedPrinter,
    getSelectedPrinter,
    initPrinterConfig
};