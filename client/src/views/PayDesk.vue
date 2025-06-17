<script setup>
import ProdottoPaginaCassa from "@/components/ProdottoPaginaCassa.vue";
import {useProdottoStore} from "@/stores/prodottoStore.js";
import { reactive, onMounted, computed, watch, ref } from "vue";

const prodottoStore = useProdottoStore()

const quantitaLocali = reactive({});

console.log('prodotti caricati:', prodottoStore.prodotti)
const sortedData = computed(() => {
    const data = [...prodottoStore.prodotti]
        return data.sort((a, b) => {
            if (a.tipologia < b.tipologia) return -1;
            if (a.tipologia > b.tipologia) return 1;
            return 0;
        });
    return data;
})
const categorie = computed(() => {
    // Prendi tutte le categorie uniche presenti nei prodotti
    return [...new Set(sortedData.value.map(p => p.tipologia))];
});
watch(sortedData, (val) => {
    console.log('sortedData cambiato:', val)
})

onMounted(async () => {
    await prodottoStore.loadProdotti();
    prodottoStore.prodotti.forEach(p => {
        quantitaLocali[p.nome] = p.quantita;
    });
    prodottoStore.initSocketListeners();
});
const scontrino = ref([]);
function aggiungiAScontrino(prodotto) {
    console.log('Aggiunto prodotto allo scontrino:', prodotto);
    scontrino.value.push(prodotto);
    decrementaQuantita(prodotto.nome);
    console.log('Scontrino attuale:', scontrino.value);
}
function decrementaQuantita(nomeProdotto) {
    if (quantitaLocali[nomeProdotto] > 0) {
        quantitaLocali[nomeProdotto]--;
        console.log(`Quantità di ${nomeProdotto} decrementata a ${quantitaLocali[nomeProdotto]}`);
    }
}

</script>

<template>
    <div class="main-container">
        <div class="left-part">
            <div
                v-for="categoria in categorie"
                :key="categoria"
                class="categoria-section"
            >
                <h2 class="categoria-title">{{ categoria }}</h2>
                <div class="prodotti-categoria">
                    <div
                        v-for="prodotto in sortedData.filter(p => p.tipologia === categoria)"
                        :key="prodotto.nome"
                        class="prodotto-row"
                    >
                        <ProdottoPaginaCassa
                            :prodottoNome="prodotto.nome"
                            :prezzo="prodotto.prezzo"
                            :quantita="quantitaLocali[prodotto.nome]"
                            :tipologia="prodotto.tipologia"
                            :colore="prodotto.colore"
                            @addToScontrino="aggiungiAScontrino"
                        />
                    </div>
                </div>
            </div>
        </div>
        <div class="right-part">
            <h2>Scontrino</h2>
            <ul>
                <li v-for="(prodotto, index) in scontrino" :key="index">
                    {{ prodotto.nome }} - {{ prodotto.prezzo }}€
                </li>
            </ul>
            <div v-if="scontrino.length === 0">Nessun prodotto aggiunto</div>
        </div>
    </div>
</template>

<style scoped>

.main-container {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100%;
    .left-part{
        width: 80%;
        height: 100%;
        background-color: #f0f0f0;
        display: flex;
        flex-direction: column;
        padding: 30px;
    }
    .right-part{
        width: 20%;
        height: 100%;
        background-color: #e0e0e0;
    }
}
.categoria-section {
}
.categoria-title {
    font-size: 1.5rem;
    font-weight: bold;
    margin-bottom: 1rem;
    color: #333;
}
.prodotti-categoria {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 1rem;
}
.prodotto-row {
    width: auto;
    border: none;
    padding-bottom: 0;
    margin-bottom: 0;
}
.categoria-divider {
    border: none;
    border-top: 2px solid #888;
    margin: 1.5rem 0 0 0;
}
</style>



