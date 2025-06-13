<script setup>
import { useOrderStore } from '@/stores/orderStore'
import { onMounted } from 'vue'

const orderStore = useOrderStore()

onMounted(() => {
    orderStore.loadOrders();
    orderStore.initSocket()
})

function aggiungiOrdineDemo() {
    const prodotti = ['Prodotto A', 'Prodotto B']
    const totale = 5.99 + 3.49
    orderStore.addOrder(prodotti, totale)
}
</script>

<template>
    <div>
        <h2>Ordini</h2>

        <button @click="aggiungiOrdineDemo">Aggiungi ordine demo</button>

        <ul>
            <li v-for="order in orderStore.orders" :key="order.uuid">
                Prodotti: {{ order.recapOrdine }} - Totale: €{{ order.totale }}
            </li>
        </ul>
    </div>
</template>

