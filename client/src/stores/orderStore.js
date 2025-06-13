import { defineStore } from 'pinia'
import { getSocket } from '@/socket'
import { v4 as uuidv4 } from 'uuid'
import {db} from "@/db.js";

const socket = await getSocket();

export const useOrderStore = defineStore('orderStore', {
    state: () => ({
        orders: [],
        socket: null
    }),
    actions: {
        async initSocket() {
            this.socket = socket

            socket.on('connect', () => {
                console.log('Connesso a Socket.IO')
            })

            socket.on('sync-orders', orders => {
                this.orders = orders
            })

            socket.on('order-added', order => {
                this.orders.push(order)
            })
        },
        async loadOrders() {
            this.orders = await db.prodotti.toArray()
        },
        async addOrder(prodotti, totale) {
            const recapOrdine = prodotti.join(',');
            const newOrder = {
                uuid: uuidv4(),
                recapOrdine,
                totale,
                timestamp: Date.now()
            }
            await db.orders.add(newOrder)
            this.orders.push(newOrder)
            this.socket.emit('new-order', newOrder)
        }
    }
})
