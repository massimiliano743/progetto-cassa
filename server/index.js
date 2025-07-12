const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs');
const fsp = require('fs/promises');
const handlebars = require('handlebars');
const PDFDocument = require('pdfkit');
const puppeteer = require('puppeteer');
const { exec } = require('child_process');

const app = express()
app.use(cors())
app.use(express.json());

const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: '*',
    }
})

// ================== NUOVO SISTEMA DI STAMPA TERMICA ==================
const PRINTER_CONFIG_PATH = path.join(__dirname, 'stampante-selezionata.json');

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

// Funzione per ottenere la lista delle stampanti
function getPrinterList() {
    return new Promise((resolve, reject) => {
        exec('lpstat -e', (error, stdout, stderr) => {
            if (error) return reject(error);

            const printers = stdout.split('\n')
                .map(line => line.trim())
                .filter(line => line !== '');
            console.log(printers)
            resolve(printers);
        });
    });
}

// Funzione per stampare con una specifica stampante
function printWithPrinter(printerName, content) {
    return new Promise((resolve, reject) => {
        const printData = Buffer.isBuffer(content) ? content : Buffer.from(content);

        const tempFile = `print_${Date.now()}.bin`;
        fs.writeFileSync(tempFile, printData);

        exec(`lpr -o raw ${tempFile} -P "${printerName}"`, (error) => {
            fs.unlinkSync(tempFile);
            if (error) reject(error);
            else resolve();
        });
    });
}

// Funzione per generare comandi ESC/POS
function generateEscPosContent(text) {
    return Buffer.concat([
        Buffer.from('\x1B\x40'), // Inizializza stampante
        Buffer.from('\x1B\x61\x01'), // Centra testo
        Buffer.from(text + '\n'),
        Buffer.from('\n\n\n\n\n'), // Spazio per il taglio
        Buffer.from('\x1D\x56\x41\x03') // Taglia carta
    ]);
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

        const printerName = getSelectedPrinter();
        if (!printerName) {
            return res.status(400).json({ error: 'Stampante non selezionata' });
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
// ================== FINE NUOVO SISTEMA DI STAMPA ==================

const dbPath = path.join(__dirname, 'cassa.sqlite3')
const db = new Database(dbPath)
db.pragma('journal_mode = WAL');

db.prepare(`CREATE TABLE IF NOT EXISTS prodotti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    quantita INTEGER NOT NULL,
    tipologia TEXT NOT NULL,
    prezzo REAL NOT NULL
)`).run()

db.prepare(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT,
    recapOrdine TEXT,
    totale REAL,
    timestamp TEXT
)`).run()

db.prepare(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    color TEXT,
    enable Boolean DEFAULT 1
)`).run()

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
    socket.on('new-order', (order, cb) => {
        console.log('Nuovo ordine ricevuto:', order);

        // 1. Conta le occorrenze di ogni id prodotto
        const counts = {};
        const items = String(order.prodotti).split(',');
        items.forEach(item => {
            const [id] = item.split(':');
            counts[id] = (counts[id] || 0) + 1;
        });

        // 2. Aggiorna la quantità nel database
        Object.entries(counts).forEach(([id, count]) => {
            db.prepare('UPDATE prodotti SET quantita = quantita - ? WHERE id = ?').run(count, id);
        });

        // 3. Invia al FE la lista aggiornata dei prodotti
        const prodottiAggiornati = db.prepare('SELECT * FROM prodotti').all().map(p => {
            const cat = db.prepare('SELECT name, color FROM categories WHERE id = ?').get(p.tipologia);
            return { ...p, tipologia: cat ? cat.name : p.tipologia, colore: cat ? cat.color : null };
        });
        io.emit('product-list', prodottiAggiornati);

        // 4. Salva l'ordine
        const stmt = db.prepare('INSERT INTO orders (uuid, recapOrdine, totale, timestamp ) VALUES (?, ?, ?, ?)');
        const info = stmt.run(
            String(order.uuid),
            String(order.prodotti),
            order.totale,
            order.timestamp
        );
        const nuovoOrder = { id: info.lastInsertRowid, ...order };

        orders.push(order);
        socket.broadcast.emit('order-added', order);
        if (cb) cb(nuovoOrder);

        // 5. Stampa termica automatica
        const printerName = getSelectedPrinter();
        if (printerName) {
            try {
                let receiptContent = `ORDINE #${order.uuid}\n`;
                receiptContent += `Data: ${order.timestamp}\n\n`;

                Object.entries(counts).forEach(([id, count]) => {
                    const p = db.prepare('SELECT nome, prezzo FROM prodotti WHERE id = ?').get(id);
                    if (p) {
                        receiptContent += `${count}x ${p.nome} @${p.prezzo.toFixed(2)}€\n`;
                    }
                });

                receiptContent += `\nTOTALE: ${order.totale}€\n`;
                receiptContent += 'Grazie e arrivederci!';

                const content = generateEscPosContent(receiptContent);
                printWithPrinter(printerName, content)
                    .then(() => console.log('Stampa termica completata'))
                    .catch(err => console.error('Errore stampa termica:', err));
            } catch (e) {
                console.error('Errore generazione scontrino termico:', e);
            }
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
            const entries = recap.split(',').map(p => p.trim()).filter(p => p);
            entries.forEach(entry => {
                const [productIdStr] = entry.split(':');
                const productId = parseInt(productIdStr);
                if (!isNaN(productId)) {
                    productMap[productId] = (productMap[productId] || 0) + 1;
                }
            });

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
        } catch (error) {
            console.error('Errore durante remove-order:', error);
            if (cb) cb({ success: false, error: error.message });
        }
    });

    socket.on('product', product => {
        products.push(product)
        console.log('Nuovo prodotto ricevuto:', product)
        socket.broadcast.emit('product-modify', product);
    })

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
})

server.listen(3000, () => {
    console.log('Server Socket.IO in ascolto su http://localhost:3000')
})

app.get('/get-socket-ip', (req, res) => {
    const os = require('os');
    let ip = null;
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ip = iface.address;
            }
        }
    }
    res.json({ ip });
});
