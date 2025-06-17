import { io } from 'socket.io-client'

// URL del server Socket.IO (puoi parametrizzarlo in futuro)
const urlServer = window.location.hostname;

let socket = null

export async function createSocket() {
    if (socket) return socket
    const res = await fetch(`http://${urlServer}:3000/get-socket-ip`)
    const data = await res.json()
    socket = io(`http://${data.ip}:3000`)
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

