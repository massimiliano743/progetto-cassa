import { defineStore } from 'pinia'
import { db } from '@/db'
import { getSocket } from '@/socket'

const socket = await getSocket()

const prodottiFesta = [
    { nome: 'Panino con la porchetta', quantita: 50, tipologia: 'Cucina', prezzo: 5.00 },
    { nome: 'Arrosticini', quantita: 100, tipologia: 'Cucina', prezzo: 0.80 },
    { nome: 'Patatine fritte', quantita: 80, tipologia: 'Cucina', prezzo: 3.00 },
    { nome: 'Pizza al taglio', quantita: 60, tipologia: 'Cucina', prezzo: 2.50 },
    { nome: 'Salsiccia e fagioli', quantita: 40, tipologia: 'Cucina', prezzo: 6.00 },
    { nome: 'Formaggio e salame', quantita: 45, tipologia: 'Cucina', prezzo: 5.50 },
    { nome: 'Polenta e funghi', quantita: 35, tipologia: 'Cucina', prezzo: 6.50 },
    { nome: 'Cotoletta e patatine', quantita: 50, tipologia: 'Cucina', prezzo: 7.00 },
    { nome: 'Gnocchi al ragù', quantita: 40, tipologia: 'Cucina', prezzo: 6.00 },

    { nome: 'Birra media', quantita: 60, tipologia: 'Bar', prezzo: 4.00 },
    { nome: 'Birra piccola', quantita: 50, tipologia: 'Bar', prezzo: 3.00 },
    { nome: 'Bibita lattina', quantita: 90, tipologia: 'Bar', prezzo: 2.00 },
    { nome: 'Acqua naturale', quantita: 100, tipologia: 'Bar', prezzo: 1.00 },
    { nome: 'Acqua frizzante', quantita: 80, tipologia: 'Bar', prezzo: 1.00 },
    { nome: 'Vino rosso sfuso', quantita: 40, tipologia: 'Bar', prezzo: 3.50 },
    { nome: 'Spritz', quantita: 35, tipologia: 'Bar', prezzo: 4.50 },
    { nome: 'Caffè', quantita: 100, tipologia: 'Bar', prezzo: 1.00 },
    { nome: 'Amaro locale', quantita: 25, tipologia: 'Bar', prezzo: 2.50 },

    { nome: 'Zeppole', quantita: 40, tipologia: 'Pasticceria', prezzo: 2.50 },
    { nome: 'Frittelle', quantita: 50, tipologia: 'Pasticceria', prezzo: 2.00 },
    { nome: 'Torrone artigianale', quantita: 30, tipologia: 'Pasticceria', prezzo: 3.00 },
    { nome: 'Crostata di frutta', quantita: 20, tipologia: 'Pasticceria', prezzo: 2.50 },
    { nome: 'Biscotti della nonna', quantita: 60, tipologia: 'Pasticceria', prezzo: 1.50 },
    { nome: 'Ciambelline al vino', quantita: 45, tipologia: 'Pasticceria', prezzo: 1.50 },
    { nome: 'Cannoli siciliani', quantita: 30, tipologia: 'Pasticceria', prezzo: 3.00 }];


export const useProdottoStore = defineStore('prodottoStore', {
    state: () => ({
        prodotti: []
    }),

    actions: {
        async loadProdotti() {
            this.prodotti = await db.prodotti.toArray()
        },
        async caricaProdottiFesta() {
            for (const p of prodottiFesta) {
                await this.addProdotto(p)
            }
            console.log(' Prodotti della festa caricati')
        },
        async addProdotto({ nome,quantita,tipologia,prezzo }) {
            const prodotto = { nome,quantita,tipologia,prezzo}
            await db.prodotti.add(prodotto)
            this.prodotti.push(prodotto)
            socket.emit('product', prodotto)
        },
        async updateProdotto(prodotto) {
            const { id, nome, quantita, tipologia, prezzo } = prodotto
            const prodottoAggiornato = { nome, quantita, tipologia, prezzo }
            await db.prodotti.update(id, prodottoAggiornato)
            const index = this.prodotti.findIndex(p => p.id === id)
            if (index !== -1) {
                this.prodotti[index] = { id, ...prodottoAggiornato }
            }
            socket.emit('product-updated', { id, ...prodottoAggiornato })
        },
        async removeProdotto(id) {
            await db.prodotti.delete(id)
            this.prodotti = this.prodotti.filter(p => p.id !== id)
        },
        async clearTableProddoti() {
            await db.prodotti.clear();
            this.prodotti = [];
        },

        async initSocketListeners() {
            socket.on('product-modify', prodotto => {
                this.prodotti.push(prodotto)
            })
        }
    }
})
