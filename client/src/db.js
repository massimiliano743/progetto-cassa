import Dexie from 'dexie'

export const db = new Dexie('CassaDB')

export async function initPersistence() {
    if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist()
        console.log('IndexedDB persistente?', isPersisted)
    }
}

db.version(1).stores({
    prodotti: '++id, nome, quantita, tipologia, prezzo',
    orders: '++id, uuid, recapOrdine, totale, timestamp'
})

