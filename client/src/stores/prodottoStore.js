import { defineStore } from 'pinia'
import { createSocket, getSocketSync } from '@/socket'

const socket = await getSocketSync()

const prodottiFesta = [
    { id: 1, nome: 'Panino con la porchetta', quantita: 50, tipologia: 'Cucina', prezzo: 5, colore: '#FFB74D' },
    { id: 2, nome: 'Arrosticini', quantita: 100, tipologia: 'Cucina', prezzo: 0.8, colore: '#FFB74D' },
    { id: 3, nome: 'Patatine fritte', quantita: 80, tipologia: 'Cucina', prezzo: 3, colore: '#FFB74D' },
    { id: 4, nome: 'Pizza al taglio', quantita: 60, tipologia: 'Cucina', prezzo: 2.5, colore: '#FFB74D' },
    { id: 5, nome: 'Salsiccia e fagioli', quantita: 40, tipologia: 'Cucina', prezzo: 6, colore: '#FFB74D' },
    { id: 6, nome: 'Formaggio e salame', quantita: 45, tipologia: 'Cucina', prezzo: 5.5, colore: '#FFB74D' },
    { id: 7, nome: 'Polenta e funghi', quantita: 35, tipologia: 'Cucina', prezzo: 6.5, colore: '#FFB74D' },
    { id: 8, nome: 'Cotoletta e patatine', quantita: 50, tipologia: 'Cucina', prezzo: 7, colore: '#FFB74D' },
    { id: 9, nome: 'Gnocchi al ragù', quantita: 40, tipologia: 'Cucina', prezzo: 6, colore: '#FFB74D' },

    { id: 10, nome: 'Birra media', quantita: 60, tipologia: 'Bar', prezzo: 4, colore: '#4FC3F7' },
    { id: 11, nome: 'Birra piccola', quantita: 50, tipologia: 'Bar', prezzo: 3, colore: '#4FC3F7' },
    { id: 12, nome: 'Bibita lattina', quantita: 90, tipologia: 'Bar', prezzo: 2, colore: '#4FC3F7' },
    { id: 13, nome: 'Acqua naturale', quantita: 100, tipologia: 'Bar', prezzo: 1, colore: '#4FC3F7' },
    { id: 14, nome: 'Acqua frizzante', quantita: 80, tipologia: 'Bar', prezzo: 1, colore: '#4FC3F7' },
    { id: 15, nome: 'Vino rosso sfuso', quantita: 40, tipologia: 'Bar', prezzo: 3.5, colore: '#4FC3F7' },
    { id: 16, nome: 'Spritz', quantita: 35, tipologia: 'Bar', prezzo: 4.5, colore: '#4FC3F7' },
    { id: 17, nome: 'Caffè', quantita: 100, tipologia: 'Bar', prezzo: 1, colore: '#4FC3F7' },
    { id: 18, nome: 'Amaro locale', quantita: 25, tipologia: 'Bar', prezzo: 2.5, colore: '#4FC3F7' },

    { id: 19, nome: 'Zeppole', quantita: 40, tipologia: 'Pasticceria', prezzo: 2.5, colore: '#CE93D8' },
    { id: 20, nome: 'Frittelle', quantita: 50, tipologia: 'Pasticceria', prezzo: 2, colore: '#CE93D8' },
    { id: 21, nome: 'Torrone artigianale', quantita: 30, tipologia: 'Pasticceria', prezzo: 3, colore: '#CE93D8' },
    { id: 22, nome: 'Crostata di frutta', quantita: 20, tipologia: 'Pasticceria', prezzo: 2.5, colore: '#CE93D8' },
    { id: 23, nome: 'Biscotti della nonna', quantita: 60, tipologia: 'Pasticceria', prezzo: 1.5, colore: '#CE93D8' },
    { id: 24, nome: 'Ciambelline al vino', quantita: 45, tipologia: 'Pasticceria', prezzo: 1.5, colore: '#CE93D8' },
    { id: 25, nome: 'Cannoli siciliani', quantita: 30, tipologia: 'Pasticceria', prezzo: 3, colore: '#CE93D8' }
];

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
