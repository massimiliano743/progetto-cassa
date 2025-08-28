import { defineStore } from 'pinia'
import { createSocket, getSocketSync } from '@/socket'
import { v4 as uuidv4 } from 'uuid'

const socket = await getSocketSync();

export const useOrderStore = defineStore('orderStore', {
    state: () => ({
        orders: [],
        socket: null
    }),
    actions: {
        async initSocket() {
            this.socket = getSocketSync() || await createSocket();
            this.socket.on('connect', () => {
                console.log('Connesso a Socket.IO')
            })
            this.socket.off('sync-orders');
            this.socket.on('sync-orders', orders => {
                this.orders = orders
            })
            this.socket.off('order-added');
            this.socket.on('order-added', order => {
                this.orders.push(order)
            })
        },
        async loadOrders() {
            const socket = getSocketSync() || await createSocket();
            socket.emit('get-orders', (orders) => {
                this.orders = orders
            })
        },
        async addOrder(prodotti, totale) {
            const newOrder = {
                uuid: uuidv4(),
                prodotti,
                totale,
                timestamp: Date.now()
            }
            this.orders.push(newOrder)
            const socket = getSocketSync() || await createSocket();
            socket.emit('new-order', newOrder)
        },
        async removeOrder(uuid) {
            const socket = getSocketSync() || await createSocket();
            socket.emit('remove-order', uuid, (res) => {
                if (!res || res.success === false) {
                    const errorMsg = res?.error || 'Errore sconosciuto nella rimozione ordine';
                    alert(`⚠️ Errore: ${errorMsg}`);
                    return;
                }
                this.loadOrders();
            });
        },
        async removeSingleProductOrder(id) {
            const socket = getSocketSync() || await createSocket();
            return new Promise((resolve, reject) => {
                socket.emit('remove-single-product-in-order', id, (res) => {
                    if (!res || res.error) {
                        const errorMsg = res?.error || 'Errore sconosciuto nella rimozione prodotto';
                        alert(`⚠️ Errore: ${errorMsg}`);
                        reject(errorMsg);
                        return;
                    }
                    console.log('res', res);
                    this.loadOrders();
                    resolve({
                        prodotti: res.prodotti,
                        orderId: id
                    });
                });
            });
        },
        async updateOrder(newOrder,id) {
            const socket = getSocketSync() || await createSocket();
            return new Promise((resolve, reject) => {
                socket.emit('updateOrder', id, newOrder, (res) => {
                    if (!res || res.success === false) {
                        const errorMsg = res?.error || 'Errore sconosciuto nella rimozione prodotto';
                        alert(`⚠️ Errore: ${errorMsg}`);
                        reject(errorMsg);
                        return;
                    }
                    console.log('res---', res);
                    this.loadOrders();
                    resolve(res);
                });
            });
        },
        async clearOrders() {
            const socket = getSocketSync() || await createSocket();
            socket.emit('clear-orders', () => {
                this.loadOrders()
            })
        },
        async checkQuantity(idProdotti) {
            const socket = getSocketSync() || await createSocket();
            return new Promise((resolve, reject) => {
                socket.emit('check-quantity-prodotto', idProdotti, (response) => {
                    if (response && response.error) {
                        reject(new Error(response.error));
                    } else {
                        resolve(response);
                    }
                });
            });
        }
    }
})
