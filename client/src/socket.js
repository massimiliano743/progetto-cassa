import { io } from 'socket.io-client'

// Forzo l'uso di 'localhost' come urlServer quando l'app gira in Electron, per risolvere il problema di connessione Socket.IO.
const isElectron = navigator.userAgent.toLowerCase().includes('electron');
const urlServer = isElectron ? 'localhost' : window.location.hostname;

let socket = null

export async function createSocket() {
    if (socket) return socket
    const res = await fetch(`http://${urlServer}:3000/get-socket-ip`)
    const data = await res.json()
    socket = io(`http://${urlServer}:3000`)
    return socket
}

export function getSocketSync() {
    return socket
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect()
        socket = null
    }
}
