import { io } from 'socket.io-client'

// URL del server Socket.IO (puoi parametrizzarlo in futuro)
const urlServer = window.location.hostname;

let socket = null

export async function getSocket() {
    if (socket) return socket
    const res = await fetch(`http://${urlServer}:3000/get-socket-ip`)
    const data = await res.json()
    socket = io(`http://${data.ip}:3000`)
    return socket
}
