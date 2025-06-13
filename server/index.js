const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')

const app = express()
app.use(cors())

const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: '*',
    }
})

let orders = []
let products = []



io.on('connection', socket => {
    console.log('Nuovo client connesso')

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
