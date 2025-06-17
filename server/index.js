const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const Database = require('better-sqlite3')
const path = require('path')

const app = express()
app.use(cors())

const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: '*',
    }
})

const dbPath = path.join(__dirname, 'cassa.sqlite3')
const db = new Database(dbPath)

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
        // Aggiorna anche tutti i client con la lista arricchita
        io.emit('product-list', prodotti);
    });

    socket.on('add-prodotto', (prodotto, cb) => {
        // Cerca la categoria corrispondente all'id passato come tipologia
        const categoria = db.prepare('SELECT * FROM categories WHERE id = ?').get(prodotto.tipologia);
        if (!categoria) {
            if (cb) cb({ error: 'Categoria non trovata' });
            return;
        }
        // Inserisci il prodotto con il valore di tipologia come id categoria
        const stmt = db.prepare('INSERT INTO prodotti (nome, quantita, tipologia, prezzo) VALUES (?, ?, ?, ?)');
        const info = stmt.run(prodotto.nome, prodotto.quantita, prodotto.tipologia, prodotto.prezzo);
        // Restituisci il prodotto con il nome e colore della categoria
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
    // add categoria
    socket.on('add-category', (category, cb) => {
        const stmt = db.prepare('INSERT INTO categories (name, color, enable) VALUES (?, ?, ?)');
        const info = stmt.run(category.name, category.color, category.enable);
        const nuovaCategory = { id: info.lastInsertRowid, ...category };
        io.emit('category-list', db.prepare('SELECT * FROM prodotti').all());
        if (cb) cb(nuovaCategory);
    });
    socket.on('remove-category', (id, cb) => {
        db.prepare('DELETE FROM categories WHERE id=?').run(id);
        io.emit('category-list', db.prepare('SELECT * FROM categories').all());
        if (cb) cb(true);
    });
    socket.on('update-category', (category, cb) => {
        const stmt = db.prepare('UPDATE categories SET name=?, color=?, enable=? WHERE id=?');
        stmt.run(category.nome, category.color, category.enable, category.id);
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
    socket.on('new-order', order => {
        orders.push(order)
        socket.broadcast.emit('order-added', order)
    })
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
