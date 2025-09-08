import { defineStore } from 'pinia'
import { createSocket, getSocketSync } from '@/socket'

const socket = await getSocketSync()


export const useProdottoStore = defineStore('prodottoStore', {
    state: () => ({
        prodotti: []
    }),
    actions: {
        async loadProdotti() {
            const socket = getSocketSync() || await createSocket();
            socket.emit('get-prodotti', (prodotti) => {
                this.prodotti = prodotti
            })
        },
        async addProdotto({ nome, quantita, tipologia, prezzo }) {
            const socket = getSocketSync() || await createSocket();
            socket.emit('add-prodotto', { nome, quantita, tipologia, prezzo }, (nuovoProdotto) => {
                this.loadProdotti()
            })
        },
        async updateProdotto(prodotto) {
            const socket = getSocketSync() || await createSocket();
            socket.emit('update-prodotto', prodotto, () => {
                this.loadProdotti()
            })
        },
        async removeProdotto(id) {
            const socket = getSocketSync() || await createSocket();
            socket.emit('remove-prodotto', id, () => {
                this.loadProdotti()
            })
        },
        async clearTableProddoti() {
            const socket = getSocketSync() || await createSocket();
            socket.emit('clear-prodotti', () => {
                this.loadProdotti()
            })
        },
        async caricaProdottiFesta() {
            const socket = getSocketSync() || await createSocket();
            for (const prodotto of prodottiFesta) {
                await new Promise((resolve) => {
                    socket.emit('add-prodotto', prodotto, () => resolve());
                });
            }
            this.loadProdotti();
        },
        initSocketListeners() {
            const socket = getSocketSync();
            if (!socket) return;
            socket.off('product-list');
            socket.on('product-list', (prodotti) => {
                this.prodotti = prodotti
            })
        }
    }
})
