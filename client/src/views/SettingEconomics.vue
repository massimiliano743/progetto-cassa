<script setup>
import { onMounted, ref } from 'vue'
import { useEconomicsStore } from '@/stores/economics.js'
import {
    initMenuToggle,
    formatDate,
    toggleRiga,
    rigaAttiva,
    removeOrder
} from '@/economicsSettingvue.js'
import { useRouter } from "vue-router";

const economics = useEconomicsStore()
const router = useRouter()

const startDate = ref("");
const endDate = ref("");

onMounted(async () => {
    try {
        await initMenuToggle()
        await economics.initEconomics()
    } catch (error) {
        console.error('Errore in onMounted:', error)
    }
})

async function handleRemove(id) {
    try {
        const nuoviOrdini = await removeOrder(id)
        economics.setAllOrders(nuoviOrdini)
        alert(`⚠️ Ordine Rimosso con successo: ${id}`);
    } catch (error) {
        console.error('Errore durante la rimozione ordine:', error)
    }
}
async function handleFilter() {
    try {
        const start = startDate.value;
        const end = endDate.value;
        await economics.filterRecapProdotti(start, end)
    } catch (error) {
        console.error('Errore nel filtro ordini:', error)
    }
}
function tornaIndietro() {
    router.back()
}

</script>

<template>
    <div class="back-page" @click="tornaIndietro">
        <div class="icon-back-page"></div>
        <div class="text-back">Torna Indietro</div>
    </div>
    <div class="economics">
        <div class="text-add-product">
            <h2>Riepilogo vendita prodotti</h2>
        </div>
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
                    <tr v-for="(prodotto, id) in economics.ultimoScontrinoVar" :key="id">
                        <td>{{ prodotto.nome }}</td>
                        <td>{{ prodotto.quantità }}</td>
                        <td>€ {{ (prodotto.totaleSingoloProdotto ?? 0).toFixed(2) }}</td>
                        <td>€ {{ (prodotto.totalePrezzo ?? 0).toFixed(2) }}</td>
                    </tr>
                    <tr class="totale"><td class="totale">Totale</td><td></td><td></td><td>{{economics.totUltimoScontrino.toFixed(2)}}</td></tr>
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
                    <template v-for="ordine in economics.allOrders" :key="ordine.id">
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
                                        <td>€ {{ (prodotto.totaleSingoloProdotto ?? 0).toFixed(2) }}</td>
                                        <td>€ {{ (prodotto.totalePrezzo ?? 0).toFixed(2) }}</td>
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
                <div class="date-selection">
                    <label for="start-date">Data Inizio:</label>
                    <input type="datetime-local" id="start-date" name="start-date" v-model="startDate">
                    <label for="end-date">Data Fine:</label>
                    <input type="datetime-local" id="end-date" name="end-date" v-model="endDate">
                    <button @click="handleFilter">Filtra</button>
                </div>
                <table class="tabella-prodotti">
                    <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Quantità Vendute</th>
                        <th>Totale Venduto €</th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr v-for="vendite in economics.recapProdottiOrdine" :key="vendite.prodotto">
                        <td>{{ vendite.prodotto }}</td>
                        <td>{{ vendite.pezziVenduti }}</td>
                        <td>€ {{ vendite.totaleProdotto.toFixed(2) }}</td>
                    </tr>
                    <tr class="totale">
                        <td class="totale">Totale</td>
                        <td></td>
                        <td>€ {{ economics.totaleDef.toFixed(2) }}</td>
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
    max-width: 1280px;
    min-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    .text-add-product{
        h2{
            text-align: center;
        }
        /*.back-page {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 1rem;
            cursor: pointer;


            .icon-back-page {
                background-image: url("data:image/svg+xml,%3C%3Fxml version='1.0' encoding='UTF-8'%3F%3E%3C!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools --%3E%3Csvg width='40px' height='40px' viewBox='0 -6.5 38 38' version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'%3E%3Ctitle%3Eleft-arrow%3C/title%3E%3Cdesc%3ECreated with Sketch.%3C/desc%3E%3Cg id='icons' stroke='none' stroke-width='1' fill='none' fill-rule='evenodd'%3E%3Cg id='ui-gambling-website-lined-icnos-casinoshunter' transform='translate(-1641.000000, -158.000000)' fill='%231C1C1F' fill-rule='nonzero'%3E%3Cg id='1' transform='translate(1350.000000, 120.000000)'%3E%3Cpath d='M317.812138,38.5802109 L328.325224,49.0042713 L328.41312,49.0858421 C328.764883,49.4346574 328.96954,49.8946897 329,50.4382227 L328.998248,50.6209428 C328.97273,51.0514917 328.80819,51.4628128 328.48394,51.8313977 L328.36126,51.9580208 L317.812138,62.4197891 C317.031988,63.1934036 315.770571,63.1934036 314.990421,62.4197891 C314.205605,61.6415481 314.205605,60.3762573 314.990358,59.5980789 L322.274264,52.3739093 L292.99947,52.3746291 C291.897068,52.3746291 291,51.4850764 291,50.3835318 C291,49.2819872 291.897068,48.3924345 292.999445,48.3924345 L322.039203,48.3917152 L314.990421,41.4019837 C314.205605,40.6237427 314.205605,39.3584519 314.990421,38.5802109 C315.770571,37.8065964 317.031988,37.8065964 317.812138,38.5802109 Z' id='left-arrow' transform='translate(310.000000, 50.500000) scale(-1, 1) translate(-310.000000, -50.500000) '%3E%3C/path%3E%3C/g%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
                background-repeat: no-repeat;
                width: 40px;
                height: 40px;
            }

            .text-back {
                font-size: 24px;
                font-weight: 700;
                color: #213547;
            }
        }*/
    }

}
.barra-orzzontale {
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
    min-width: 1280px;
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
        .date-selection{
            display: flex;
            gap: 20px;
            justify-content: center;
            align-items: center;
        }
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
