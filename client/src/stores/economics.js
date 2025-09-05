import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSocketSync, createSocket } from '@/socket.js'
import { allOrder, ultimoScontrino, recapSellProduct } from '@/economicsSettingvue.js'

export const useEconomicsStore = defineStore('economics', () => {
  // Stato reattivo globale
  const ultimoScontrinoVar = ref({})
  const totUltimoScontrino = ref(0)
  const allOrders = ref([])
  const recapProdottiOrdine = ref([])
  const totaleDef = ref(0)
  let socketInitialized = false

  // Inizializza dati e listener socket (chiamare una sola volta)
  async function initEconomics() {
    if (socketInitialized) return
    socketInitialized = true
    // Carica dati iniziali
    const dataUltimoScontrino = await ultimoScontrino()
    ultimoScontrinoVar.value = dataUltimoScontrino.riepilogo
    totUltimoScontrino.value = dataUltimoScontrino.totale

    const tuttiOrdini = await allOrder()
    allOrders.value = tuttiOrdini.orders

    const prodottiRecap = await recapSellProduct()
    recapProdottiOrdine.value = prodottiRecap.vendite
    totaleDef.value = prodottiRecap.TotaleDef

    // Listener socket
    const socket = getSocketSync() || await createSocket()
    socket.on('ultimoScontrino', (data) => {
      if (data) {
        ultimoScontrinoVar.value = data.riepilogo || {}
        totUltimoScontrino.value = data.totale || 0
      }
    })
    socket.on('recapScontrini', (data) => {
      if (data && data.orders) {
        allOrders.value = data.orders
      }
    })
    socket.on('analisi-prodotti', (data) => {
      if (data) {
        recapProdottiOrdine.value = data.vendite || []
        totaleDef.value = data.TotaleDef || 0
      }
    })
  }

  // Funzione per filtrare prodotti venduti
  async function filterRecapProdotti(start, end) {
    const prodottiRecap = await recapSellProduct(start, end)
    if (prodottiRecap) {
      recapProdottiOrdine.value = prodottiRecap.vendite
      totaleDef.value = prodottiRecap.TotaleDef
    }
  }

  // Funzione per aggiornare ordini dopo rimozione
  function setAllOrders(nuoviOrdini) {
    allOrders.value = nuoviOrdini
  }

  return {
    ultimoScontrinoVar,
    totUltimoScontrino,
    allOrders,
    recapProdottiOrdine,
    totaleDef,
    initEconomics,
    filterRecapProdotti,
    setAllOrders
  }
})

