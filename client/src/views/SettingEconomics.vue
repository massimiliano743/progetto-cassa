<script setup>
import { onMounted, ref } from 'vue'
import {initMenuToggle, ultimoScontrino} from '@/economicsSettingvue.js'
import {useProdottoStore} from "@/stores/prodottoStore.js";
import ProdottoPaginaCassa from "@/components/ProdottoPaginaCassa.vue";

const ultimoScontrinoVar = ref({})
onMounted(async () => {
    try {
        await initMenuToggle()
        const dataUltimoScontrino = await ultimoScontrino()
        // 2. Assegna alla ref
        ultimoScontrinoVar.value = dataUltimoScontrino.riepilogo
    } catch (error) {
        console.error('Errore in onMounted:', error)
    }
})
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
                    <tr class="totale"><td class="totale">Totale</td><td></td><td></td><td>120€</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="contenuto hidden" id="gestione">Contenuto: Gestione Scontrini</div>
            <div class="contenuto hidden" id="prodotti">Contenuto: Prodotti Venduti</div>
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
    #scontrino{
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 70%;
        .tabella-scontrino {
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
            th{
                background-color: #f2f2f2;
                font-weight: bold;
            }
        }
    }
}
</style>
