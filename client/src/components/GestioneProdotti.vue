<script setup>
import { ref, onMounted } from 'vue'
import { useProdottoStore } from '@/stores/prodottoStore'

const nome = ref('')
const prezzo = ref(0)
const prodottoStore = useProdottoStore()

onMounted(() => {
    prodottoStore.loadProdotti()
    prodottoStore.initSocketListeners()
})

function aggiungiProdotto() {
    prodottoStore.addProdotto({ nome: nome.value, prezzo: prezzo.value })
    nome.value = ''
    prezzo.value = 0
}
</script>

<template>
    <div class="gestione-prodotti">
        <h2>Gestione Prodotti</h2>

        <form @submit.prevent="aggiungiProdotto">
            <input v-model="nome" placeholder="Nome prodotto" required />
            <input v-model.number="prezzo" type="number" step="0.01" placeholder="Prezzo" required />
            <button type="submit">Salva</button>
        </form>

        <ul>
            <li v-for="p in prodottoStore.prodotti" :key="p.id">
                {{ p.nome }} - €{{ p.prezzo.toFixed(2) }}
            </li>
        </ul>
    </div>
</template>



<style scoped>
.gestione-prodotti {
    max-width: 500px;
    margin: 2rem auto;
    font-family: sans-serif;
}
form {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
}
input {
    flex: 1;
}
button {
    padding: 0.5rem 1rem;
}
</style>
