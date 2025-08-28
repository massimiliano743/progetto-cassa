<script setup>
import { onMounted, ref } from 'vue'
import {
    allOrder,
    initMenuToggle,
    ultimoScontrino,
    formatDate,
    toggleRiga,
    rigaAttiva,
    removeOrder,
    recapSellProduct
} from '@/economicsSettingvue.js'

const ultimoScontrinoVar = ref({})
const allOrders = ref([])
const totUltimoScontrino = ref(0)
const recapProdottiOrdine = ref([]);
const totaleDef = ref(0)



onMounted(async () => {
    try {
        await initMenuToggle()
        const dataUltimoScontrino = await ultimoScontrino()
        ultimoScontrinoVar.value = dataUltimoScontrino.riepilogo
        totUltimoScontrino.value = dataUltimoScontrino.totale

        const tuttiOrdini = await allOrder()
        allOrders.value = tuttiOrdini.orders

        const prodottiRecap = await recapSellProduct()
        recapProdottiOrdine.value = prodottiRecap.vendite
        totaleDef.value = prodottiRecap.TotaleDef
    } catch (error) {
        console.error('Errore in onMounted:', error)
    }
})
async function handleRemove(id) {
    try {
        const nuoviOrdini = await removeOrder(id)
        allOrders.value = nuoviOrdini
        alert(`⚠️ Ordine Rimosso con successo: ${id}`);
    } catch (error) {
        console.error('Errore durante la rimozione ordine:', error)
    }
}

</script>

<template>
    <div class="economics">
        <div class="barra-orzzontale">
            <div class="elemento-singolo active" data-target="scontrino">Ultimo scontrino</div>
            <div class="elemento-singolo" data-target="gestione">Gestione Scontrini</div>
            <div class="elemento-singolo" data-target="prodotti">Prodotti Venduti</div>
            <div class="elemento-singolo" data-target="storico">Storico</div>
        </div>
        <div class="sezione-info">
            <div class="contenuto visible" id="scontrino">
                <table class="tabella-scontrino">
                    <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Quantità</th>
                        <th>Prezzo Singolo</th>
                        <th>Totale Prezzo</th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr v-for="(prodotto, id) in ultimoScontrinoVar" :key="id">
                        <td>{{ prodotto.nome }}</td>
                        <td>{{ prodotto.quantità }}</td>
                        <td>€ {{ prodotto.totaleSingoloProdotto.toFixed(2) }}</td>
                        <td>€ {{ prodotto.totalePrezzo.toFixed(2) }}</td>
                    </tr>
                    <tr class="totale"><td class="totale">Totale</td><td></td><td></td><td>{{totUltimoScontrino.toFixed(2)}}</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="contenuto hidden" id="gestione">
                <table class="tabella-ordini">
                    <thead>
                    <tr>
                        <th></th>
                        <th>ID</th>
                        <th>Data</th>
                        <th>Totale Ordine (€)</th>
                    </tr>
                    </thead>
                    <tbody>
                    <template v-for="ordine in allOrders" :key="ordine.id">
                        <!-- Riga principale -->
                        <tr @click="toggleRiga(ordine.id)" class="clickable-row" :class="{ active: rigaAttiva === ordine.id }">
                            <td class="remove-column" @click="handleRemove(ordine.id)"></td>
                            <td>{{ ordine.id }}</td>
                            <td>{{ formatDate(ordine.timestamp) }}</td>
                            <td>€ {{ ordine.totale.toFixed(2) }}</td>
                        </tr>

                        <!-- Riga espansa con dettagli -->
                        <tr v-if="rigaAttiva === ordine.id" class="riga-dettagli">
                            <td colspan="4">
                                <table class="tabella-dettagli">
                                    <thead>
                                    <tr>
                                        <th>Nome</th>
                                        <th>Quantità</th>
                                        <th>Prezzo Singolo (€)</th>
                                        <th>Totale (€)</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    <tr
                                        v-for="(prodotto, key) in ordine.dettagli"
                                        :key="key"
                                    >
                                        <td>{{ prodotto.nome }}</td>
                                        <td>{{ prodotto.quantità }}</td>
                                        <td>€ {{ prodotto.totaleSingoloProdotto.toFixed(2) }}</td>
                                        <td>€ {{ prodotto.totalePrezzo.toFixed(2) }}</td>
                                    </tr>
                                    </tbody>
                                </table>
                            </td>
                        </tr>
                    </template>
                    </tbody>
                </table>
            </div>
            <div class="contenuto hidden" id="prodotti">
                <table class="tabella-prodotti">
                    <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Quantità Vendute</th>
                        <th>Totale Venduto €</th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr v-for="vendite in recapProdottiOrdine" :key="vendite.prodotto">
                        <td>{{ vendite.prodotto }}</td>
                        <td>{{ vendite.pezziVenduti }}</td>
                        <td>€ {{ vendite.totaleProdotto.toFixed(2) }}</td>
                    </tr>
                    <tr class="totale">
                        <td class="totale">Totale</td>
                        <td></td>
                        <td>€ {{ totaleDef.toFixed(2) }}</td>
                    </tr>
                    </tbody>
                </table>
            </div>
            <div class="contenuto hidden" id="storico">Contenuto: Storico</div>
        </div>
    </div>
</template>

<style scoped>
.economics {
    height: 100%;
}
.barra-orzzontale {
    max-width: 1280px;
    min-width: 800px;
    margin: 0 auto;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    width: 100%;
}
.elemento-singolo {
    display: flex;
    min-width: 200px;
    height: 50px;
    background-color: #dddddd;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}
.elemento-singolo.active {
    transition: border-bottom 0.1s linear;
    border-bottom: 3px solid #2196f3;
    scale: 1.03;
}
.sezione-info {
    max-width: 1280px;
    min-width: 800px;
    margin: 0 auto;
    padding: 30px;
    display: flex;
    background: aliceblue;
    justify-content: center;
    #scontrino, #gestione, #prodotti{
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 70%;
        .tabella-scontrino, .tabella-ordini, .tabella-prodotti {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            background: white;
            .totale{
                font-size: 2rem;
                font-weight: 700;
                text-align: center;
            }
            th,td{
                border: 1px solid #ddd;
                padding: 8px;
                text-align: center;
            }
            td.remove-column {
                background-image: url("data:image/svg+xml,%3C%3Fxml version='1.0' encoding='iso-8859-1'%3F%3E%3C!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools --%3E%3Csvg height='20px' width='20' version='1.1' id='Layer_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 496.158 496.158' xml:space='preserve'%3E%3Cpath style='fill:%23E04F5F;' d='M0,248.085C0,111.063,111.069,0.003,248.075,0.003c137.013,0,248.083,111.061,248.083,248.082 c0,137.002-111.07,248.07-248.083,248.07C111.069,496.155,0,385.087,0,248.085z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M383.546,206.286H112.612c-3.976,0-7.199,3.225-7.199,7.2v69.187c0,3.976,3.224,7.199,7.199,7.199 h270.934c3.976,0,7.199-3.224,7.199-7.199v-69.187C390.745,209.511,387.521,206.286,383.546,206.286z'/%3E%3C/svg%3E");
                background-repeat: no-repeat;
                height: 30px;
                width: 30px;
                background-position: center;
                cursor: pointer;
            }
            th{
                background-color: #f2f2f2;
                font-weight: bold;
            }
        }
        .tabella-ordini{
            td{
                cursor: pointer;
            }
            .clickable-row.active{
                background-color: #2196f3;
            }
            .tabella-dettagli{
                width: 100%;
            }
        }
    }
}
</style>
