<script setup>
import ProdottoPaginaCassa from "@/components/ProdottoPaginaCassa.vue";
import {useProdottoStore} from "@/stores/prodottoStore.js";
import { reactive, onMounted, computed, watch, ref } from "vue";
import { useOrderStore } from '@/stores/orderStore';

const prodottoStore = useProdottoStore()
const orderStore = useOrderStore()

const showDeleteOrder = ref(false)
const showDeleteOrderSingleProduct = ref(false)

const showProductModal = ref(false);
const prodottiDaSelezionare = ref([]);
const prodottiSelezionati = ref([]);
const prodottiSelezionatiAggiornati = ref([]);
// Nuovo oggetto reattivo per le quantità selezionate nella modale
const quantitàSelezionate = reactive({});
const orderIdModaleRemoveSingleProduct = ref(null);
const optionOrder = ref(false);

const scontoTotale = ref(false);
const scontoParziale = ref(false);
const valoreScontoParziale = ref(0);
const noteOrdine = ref("");

function toggleScontoTotale() {
  scontoTotale.value = !scontoTotale.value;
  if (scontoTotale.value) scontoParziale.value = false;
}
function toggleScontoParziale() {
  scontoParziale.value = !scontoParziale.value;
  if (scontoParziale.value) scontoTotale.value = false;
}

function confermaOpzioniOrdine() {
    let tipoSconto = null;
    let valoreSconto = null;
    if (scontoTotale.value) {
        tipoSconto = 'totale';
        valoreSconto = '100';
    } else if (scontoParziale.value) {
        tipoSconto = 'parziale';
        valoreSconto = valoreScontoParziale.value;
    }
    console.log('Tipo sconto:', tipoSconto);
    console.log('Valore sconto:', valoreSconto);
    console.log('Note ordine:', noteOrdine.value);
    // Chiudi solo la modale, NON resettare le selezioni
    optionOrder.value = false;
}

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

watch(
  () => prodottoStore.prodotti.map(p => ({ nome: p.nome, quantita: p.quantita })),
  (prodottiAggiornati) => {
    prodottiAggiornati.forEach(p => {
      quantitaLocali[p.nome] = p.quantita;
    });
  },
  { immediate: true }
)

onMounted(async () => {
    await prodottoStore.loadProdotti();
    prodottoStore.prodotti.forEach(p => {
        quantitaLocali[p.nome] = p.quantita;
    });
    prodottoStore.initSocketListeners();
});
const scontrino = ref([]);
var conto = ref(0);
const totaleScontato = computed(() => {
    let totale = conto.value;
    if (scontoTotale.value) {
        totale = 0;
    } else if (scontoParziale.value && valoreScontoParziale.value > 0) {
        totale = totale - (totale * valoreScontoParziale.value / 100);
    }
    return totale < 0 ? 0 : totale;
});

function aggiungiAScontrino(prodotto) {
    console.log('Aggiunto prodotto allo scontrino:', prodotto);
    conto.value = conto.value + prodotto.prezzo;
    scontrino.value.push(prodotto);
    decrementaQuantita(prodotto.nome);
    console.log('Scontrino attuale:', scontrino.value);
}
function rimuoviProdottoScontrino(index) {
    const prodottoRimosso = scontrino.value[index];
    conto.value -= prodottoRimosso.prezzo;
    scontrino.value.splice(index, 1);
    incrementaQuantita(prodottoRimosso.nome);
    console.log('Prodotto rimosso dallo scontrino:', prodottoRimosso);
    console.log('Scontrino attuale:', scontrino.value);
}
function decrementaQuantita(nomeProdotto) {
    if (quantitaLocali[nomeProdotto] > 0) {
        quantitaLocali[nomeProdotto]--;
        console.log(`Quantità di ${nomeProdotto} decrementata a ${quantitaLocali[nomeProdotto]}`);
    }
}
function incrementaQuantita(nomeProdotto) {
    if (quantitaLocali[nomeProdotto] !== undefined) {
        quantitaLocali[nomeProdotto]++;
        console.log(`Quantità di ${nomeProdotto} incrementata a ${quantitaLocali[nomeProdotto]}`);
    }
}
async function inviaOrdine() {
    if (scontrino.value.length === 0) {
        console.log('Non ci sono prodotti nello scontrino');
        return;
    }
    const ids = scontrino.value.map(prodotto => prodotto.idProdotto);
    try {
        const prodottiNonDisponibili = await orderStore.checkQuantity(ids);
        if (prodottiNonDisponibili && prodottiNonDisponibili.length > 0) {
            const idsNonDisponibili = prodottiNonDisponibili.map(p => p.id);
            const nomiRimossi = scontrino.value.filter(prod => idsNonDisponibili.includes(prod.idProdotto)).map(prod => prod.nome);
            scontrino.value = scontrino.value.filter(prod => !idsNonDisponibili.includes(prod.idProdotto));
            conto.value = scontrino.value.reduce((tot, prod) => tot + prod.prezzo, 0);
            if (nomiRimossi.length > 0) {
                alert('I seguenti prodotti non sono disponibili e sono stati rimossi dallo scontrino: ' + nomiRimossi.join(', '));
            } else {
                alert('Alcuni prodotti non sono disponibili e sono stati rimossi dallo scontrino.');
            }
            return;
        }
        let arrayProdotto;
        if (scontoTotale.value) {
            arrayProdotto = scontrino.value.map(prodotto => `${prodotto.idProdotto}:0`).join(',');
        } else if (scontoParziale.value && valoreScontoParziale.value > 0) {
            arrayProdotto = scontrino.value.map(prodotto => {
                const prezzoScontato = (prodotto.prezzo - (prodotto.prezzo * valoreScontoParziale.value / 100)).toFixed(2);
                return `${prodotto.idProdotto}:${prezzoScontato}`;
            }).join(',');
        } else {
            arrayProdotto = scontrino.value.map(prodotto => `${prodotto.idProdotto}:${prodotto.prezzo}`).join(',');
        }
        orderStore.addOrder(arrayProdotto, totaleScontato.value.toFixed(2), noteOrdine.value ? noteOrdine.value : "");
        scontrino.value = [];
        conto.value = 0;
        // Reset delle checkbox sconti e campo note
        scontoTotale.value = false;
        scontoParziale.value = false;
        noteOrdine.value = "";
        // valoreScontoParziale.value rimane invariato
        alert('Ordine inviato con successo!');
    } catch (err) {
        alert('Errore durante il controllo quantità: ' + err.message);
    }
}

function annullaOrdine() {
    showDeleteOrder.value = true;
    orderStore.removeOrderTotally();
    console.log('Ordine annullato');
}

function confermaEliminazioneSingola() {
    let orderNumber = document.querySelector('#ordineDaEliminare').value;
    if (!orderNumber) {
        alert('Inserisci un numero ordine valido');
        return;
    }else{
        orderStore.removeOrder(orderNumber);
    }
    alert('Eliminazione ordine confermata'+orderNumber);
    showDeleteOrder.value= false;
}
function stornaElementoDaOrdine(){
    showDeleteOrderSingleProduct.value= true;
    console.log('prodotto stornato');
}
async function confermaEliminazioneSingleProduct() {
    let orderNumber = document.querySelector('#ordineDaEliminareSingoloProdotto').value;
    if (!orderNumber) {
        alert('Inserisci un numero ordine valido');
        return;
    }
    try {
        const { prodotti, orderId } = await orderStore.removeSingleProductOrder(orderNumber);
        orderIdModaleRemoveSingleProduct.value = orderId;
        if (Array.isArray(prodotti) && prodotti.length > 0) {
            prodottiDaSelezionare.value = prodotti;
            apriModaleProdotti(prodotti);
        } else {
            alert('Nessun prodotto trovato per questo ordine.');
        }
    } catch (error) {
        alert(`⚠️ Errore: ${error}`);
    }
    showDeleteOrderSingleProduct.value = false;
}
function apriModaleProdotti(prodotti) {
    prodottiDaSelezionare.value = prodotti; // [{id, nome, quantita}, ...]
    prodottiSelezionati.value = [];
    // Inizializza le quantità selezionate con la quantità massima disponibile
    prodotti.forEach(p => {
        quantitàSelezionate[p.id] = p.quantita || 1;
    });
    showProductModal.value = true;
}
// Calcola quante volte ogni prodotto compare in prodottiDaSelezionare
const occorrenzeProdotti = computed(() => {
    const occ = {};
    prodottiDaSelezionare.value.forEach(p => {
        occ[p.id] = (occ[p.id] || 0) + (p.quantita || 1);
    });
    return occ;
});
// Calcola prodotti unici per la modale prodotti (per id)
const prodottiUnici = computed(() => {
  const mappa = {};
  prodottiDaSelezionare.value.forEach(p => {
    if (!mappa[p.id]) mappa[p.id] = p;
  });
  return Object.values(mappa);
});
// Funzione per decrementare la quantità selezionata (solo rimozione)
let inter = {}; // Tracciamento quantità per ogni prodotto

function incrementaQuantitaSelezionata(id) {
    id = Number(id); // sicurezza
    const prodotto = prodottiDaSelezionare.value.find(p => p.id === id);
    const quantitaAttuale = prodottoStore.prodotti.find(p => p.id === id)?.quantita || 0;

    if (!prodotto) return;

    if (inter[id] == null) inter[id] = 0;

    const quantitaCorrente = Number(prodotto.quantita) || 0;
    const quantitàTotale = quantitaCorrente + quantitaAttuale;
        //da rivedere questo, non torna con il controllo
    if (quantitaCorrente + inter[id] < quantitàTotale) {
        prodotto.quantita = quantitaCorrente + 1;
        inter[id]++;
    }

    console.log(`inter[${id}] = ${inter[id]}`);
}

function decrementaQuantitaSelezionata(id) {
    id = Number(id); // sicurezza
    const prodotto = prodottiDaSelezionare.value.find(p => p.id === id);

    if (!prodotto) return;

    const quantitaCorrente = Number(prodotto.quantita) || 0;

    if (quantitaCorrente > 1) {
        prodotto.quantita = quantitaCorrente - 1;

        if (inter[id] == null) inter[id] = 0;
        inter[id]--;

        if (inter[id] < 0) inter[id] = 0; // opzionale: non andare sotto zero
    }

    console.log(`inter[${id}] = ${inter[id]}`);
}
function closeProductModal() {
    showProductModal.value = false;
    prodottiSelezionati.value = [];
    prodottiSelezionatiAggiornati.value = [];
}
async function confermaSelezioneProdotti(){
    let modal = document.querySelector('#remove-single-product-modal');
    try{
        modal.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            const idProdotto = checkbox.value;
            if (checkbox.checked) {
                const quantita = 0;
                prodottiSelezionatiAggiornati.value.push({ id: idProdotto, quantita });
            }
            else {
                const quantita = occorrenzeProdotti.value[idProdotto];
                prodottiSelezionatiAggiornati.value.push({ id: idProdotto, quantita });
            }
        });
        console.log('Prodotti selezionati:', prodottiSelezionatiAggiornati.value);
        orderStore.updateOrder(prodottiSelezionatiAggiornati.value, orderIdModaleRemoveSingleProduct.value);
        alert('Prodotti aggiornati con successo nel ordine ' + orderIdModaleRemoveSingleProduct.value);
    }
    catch (error) {
        alert(`⚠️ Errore: ${error}`);
    }
    closeProductModal();
}
function openOption()
{
    optionOrder.value = true;
    console.log("modale opzioni ordine aperto");
}
function closeOption()
{
    optionOrder.value = false;
    scontoTotale.value = false;
    scontoParziale.value = false;
    noteOrdine.value = "";
    console.log("modale opzioni ordine chiuso");
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
                            :idProdotto="prodotto.id"
                            :prodottoNome="prodotto.nome"
                            :prezzo="prodotto.prezzo"
                            :quantita="quantitaLocali[prodotto.nome] !== undefined ? quantitaLocali[prodotto.nome] : prodotto.quantita"
                            :tipologia="prodotto.tipologia"
                            :colore="prodotto.colore"
                            @addToScontrino="aggiungiAScontrino"
                        />
                    </div>
                </div>
            </div>
        </div>
        <div class="right-part">
            <div class="prodotti">
                <h2>Scontrino</h2>
                <div v-if="scontrino.length > 0">
                    <div v-for="(prodotto, index) in scontrino" :key="index">
                        <div class="prodotto-remove-scontrino">
                            <div class="prodotto">{{ prodotto.nome }}</div><div class="prodotto">{{ prodotto.prezzo }}€</div>
                            <div class="remove-single-product" @click="rimuoviProdottoScontrino(index)">
                                <!-- Icona per rimuovere il prodotto -->
                            </div>
                        </div>
                    </div>
                </div>
                <div v-if="scontrino.length === 0">Nessun prodotto aggiunto</div>
            </div>
            <div class="conto-economico">
                <h3>Totale: {{ totaleScontato.toFixed(2) }}€</h3>
            </div>
            <div class="pagamento">
                <div class="button-paga-options">
                    <button @click="inviaOrdine" :disabled="scontrino.length === 0" class="paga-button">Paga</button>
                    <button @click="openOption" :disabled="scontrino.length === 0" class="option-button"></button>
                </div>
                <div class="hidde-function-button">
                    <button @click="annullaOrdine" class="button-mobile-device">Annulla ordine</button>
                    <button @click="stornaElementoDaOrdine" class="button-mobile-device">Storna Singolo Prodotto</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modale eliminazione Singolo ordine -->
    <div v-if="showDeleteOrder" class="modal-overlay">
        <div class="modal">
            <p>Inserisci numero ordine da Eliminare <br>L'azione è IRREVERSIBILE</p>
            <input type="text" id="ordineDaEliminare" placeholder="Numero Ordine" />
            <div class="modal-actions">
                <button @click="showDeleteOrder= false;">No</button>
                <button @click="confermaEliminazioneSingola">Sì</button>
            </div>
        </div>
    </div>
    <!-- Modale eliminazione Singolo ordine -->
    <div v-if="showDeleteOrderSingleProduct" class="modal-overlay">
        <div class="modal">
            <p>Inserisci numero ordine da Eliminare <br>L'azione è IRREVERSIBILE</p>
            <input type="text" id="ordineDaEliminareSingoloProdotto" placeholder="Numero Ordine" />
            <div class="modal-actions">
                <button @click="showDeleteOrderSingleProduct = false">No</button>
                <button @click="confermaEliminazioneSingleProduct">Sì</button>
            </div>
        </div>
    </div>
    <!-- Modale eliminazione Singolo ordine -->
    <div v-if="showProductModal" class="modal-overlay" >
        <div class="modal" id="remove-single-product-modal" :idOrder="orderIdModaleRemoveSingleProduct">
            <h3>Seleziona i prodotti da rimuovere</h3>
            <div v-for="prodotto in prodottiUnici" :key="prodotto.id" class="checkbox-row">
                <input
                    type="checkbox"
                    :value="prodotto.id"
                    v-model="prodottiSelezionati"
                    :id="prodotto.id"
                    :class="['button-remove-quantity',{ 'hide-quantity-controls': occorrenzeProdotti[prodotto.id] > 1 }]"
                />
                <label :for="'prodotto-' + prodotto.id" class="button-quantity-controls">{{ prodotto.nome }}</label>
                <div :class="['quantity-controls', { 'hide-quantity-controls': occorrenzeProdotti[prodotto.id] < 1 }]">
                    <div @click="decrementaQuantitaSelezionata(prodotto.id)" :class="['button-remove-quantity',{ 'hide-quantity-controls': occorrenzeProdotti[prodotto.id] <= 1 }]"></div>
                    <span>{{ occorrenzeProdotti[prodotto.id] }}</span>
                    <div @click="incrementaQuantitaSelezionata(prodotto.id)" :class="['button-add-quantity']"></div>

                </div>

            </div>
            <div class="modal-actions">
                <button @click="closeProductModal">Annulla</button>
                <button @click="confermaSelezioneProdotti">Conferma</button>
            </div>
        </div>
    </div>
    <!-- Modale selezione sconti/note/omaggi -->
    <div v-if="optionOrder" class="modal-overlay" >
        <div class="modal" id="remove-single-product-modal" :idOrder="orderIdModaleRemoveSingleProduct">
            <h3>Modificatore Ordine</h3>
            <div class="checkbox-row">
                <input type="checkbox" id="sconto-totale" :checked="scontoTotale" @change="toggleScontoTotale" />
                <label for="sconto-totale">Sconto totale ordine</label>
            </div>
            <div class="checkbox-row">
                <input type="checkbox" id="sconto-parziale" :checked="scontoParziale" @change="toggleScontoParziale" />
                <label for="sconto-parziale">Sconto parziale</label>
                <input type="number" min="0" max="100" v-model="valoreScontoParziale" :disabled="!scontoParziale" style="margin-left:10px;width:70px;" placeholder="%" />
            </div>
            <div class="checkbox-row">
                <label for="note-ordine">Note ordine</label>
                <input type="text" id="note-ordine" v-model="noteOrdine" style="flex:1;margin-left:10px;" placeholder="Scrivi una nota..." />
            </div>
            <div class="modal-actions">
                <button @click="closeOption">Annulla</button>
                <button @click="confermaOpzioniOrdine">Conferma</button>
            </div>
        </div>
    </div>
</template>

<style scoped>

.main-container {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100vh;
    overflow: hidden;
    .left-part{
        width: 80%;
        height: 100%;
        background-color: #f0f0f0;
        display: flex;
        flex-direction: column;
        padding: 0 30px 30px 30px;
        overflow-y: auto;
        box-sizing: border-box;
    }
    .right-part{
        width: 20%;
        height: 100%;
        background-color: #e0e0e0;
        padding: 10px;
        display: flex;
        flex-direction: column;
        .prodotti{
                flex: 1 1 auto;
                overflow-y: auto;
                max-height: calc(100vh - 80px);
            .prodotto-remove-scontrino{
                display: flex;
                justify-content: space-between;
                .prodotto{
                    width: 100px;
                    max-width: 100px;
                    display: flex;
                    align-items: center;
                }
                .remove-single-product{
                    background-image: url("data:image/svg+xml,%3C%3Fxml version='1.0' encoding='iso-8859-1'%3F%3E%3C!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools --%3E%3Csvg height='20px' width='20' version='1.1' id='Layer_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 496.158 496.158' xml:space='preserve'%3E%3Cpath style='fill:%23E04F5F;' d='M0,248.085C0,111.063,111.069,0.003,248.075,0.003c137.013,0,248.083,111.061,248.083,248.082 c0,137.002-111.07,248.07-248.083,248.07C111.069,496.155,0,385.087,0,248.085z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M383.546,206.286H112.612c-3.976,0-7.199,3.225-7.199,7.2v69.187c0,3.976,3.224,7.199,7.199,7.199 h270.934c3.976,0,7.199-3.224,7.199-7.199v-69.187C390.745,209.511,387.521,206.286,383.546,206.286z'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    height: 30px;
                    width: 30px;
                    background-position: center;
                    cursor: pointer;
                }
            }
        }
        .conto-economico{
            width: auto;
            background-color: #d0d0d0;
            padding: 10px;
            text-align: center;
            position: sticky;
            bottom: 0;
            h3{
                margin-top: 0;
                margin-bottom: 0;
            }
        }
        .pagamento{
            width: auto;
            background-color: #d0d0d0;
            padding: 10px;
            text-align: center;
            position: sticky;
            bottom: 0;
            .button-paga-options{
                display: flex;
                flex-direction: row;
                gap: 10px;
                .paga-button{
                    width: 80%;
                    height: 60px;
                }
                .option-button{
                    width: 20%;
                    background-image: url("data:image/svg+xml,%3C%3Fxml version='1.0' encoding='utf-8'%3F%3E%3C!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools --%3E%3Csvg width='60px' height='60px' viewBox='0 0 1080 1080' class='icon' version='1.1' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M249.6 460.8l108.8 211.2 202.666667-83.2 93.866666-270.933333-315.733333 17.066666z' fill='%23E69329' /%3E%3Cpath d='M320 768m-166.4 0a166.4 166.4 0 1 0 332.8 0 166.4 166.4 0 1 0-332.8 0Z' fill='%23546E7A' /%3E%3Cpath d='M320 576c-106.666667 0-192 85.333333-192 192s85.333333 192 192 192 192-85.333333 192-192-85.333333-192-192-192z m0 341.333333c-83.2 0-149.333333-66.133333-149.333333-149.333333s66.133333-149.333333 149.333333-149.333333 149.333333 66.133333 149.333333 149.333333-66.133333 149.333333-149.333333 149.333333z' fill='%2390A4AE' /%3E%3Cpath d='M298.666667 704h42.666666v170.666667h-42.666666z' fill='%2390A4AE' /%3E%3Cpath d='M275.2 768c21.333333 40.533333 68.266667 57.6 108.8 36.266667l352-181.333334c21.333333-10.666667 36.266667-25.6 46.933333-40.533333 36.266667-68.266667 119.466667-228.266667 174.933334-366.933333l-388.266667 185.6-102.4 153.6-145.066667 76.8c-55.466667 27.733333-72.533333 89.6-46.933333 136.533333z' fill='%23FFB74D' /%3E%3Cpath d='M644.266667 64L292.266667 198.4c-14.933333 4.266667-32 21.333333-46.933334 36.266667l-119.466666 160c-21.333333 32-25.6 72.533333-10.666667 108.8 8.533333 21.333333 36.266667 72.533333 66.133333 130.133333C215.466667 597.333333 264.533333 576 320 576c8.533333 0 19.2 0 27.733333 2.133333l-44.8-89.6 98.133334-87.466666h170.666666s330.666667-46.933333 388.266667-185.6L644.266667 64z' fill='%23FFB74D' /%3E%3Cpath d='M388.266667 768c-27.733333 12.8-59.733333 0-70.4-27.733333-12.8-27.733333 0-59.733333 27.733333-70.4 25.6-12.8 68.266667 85.333333 42.666667 98.133333z' fill='%23FFCDD2' /%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    width: 60px;
                    height: 60px;
                }
            }
            .hidde-function-button{
                padding-top: 10px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                align-items: center;
            }
            button{
                width: 100%;
                height: 50px;
                font-size: 1.2rem;
                font-weight: bold;
                color: white;
                background-color: #42b883;
                border: none;
                cursor: pointer;
                transition: background-color 0.3s ease;

                &:hover {
                    background-color: #35495e;
                }
            }
            button:disabled {
                background-color: #cccccc;
                color: #888888;
                border: 2px solid #888888;
                cursor: not-allowed;
                opacity: 0.7;
            }
        }
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
.modal-overlay{
    .checkbox-row{
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 0.5rem;
        padding: 0.5rem 0;
        width: 100%;
        label {
            flex: 1 1 auto;
            text-align: left;
            font-size: 1.1rem;
            font-weight: 500;
            margin-right: auto;
        }
        .quantity-controls {
            display: flex;
            align-items: center;
            gap: 0.3rem;
            margin-left: 1rem;
            .button-remove-quantity {
                background-image: url("data:image/svg+xml,%3C%3Fxml version='1.0' encoding='iso-8859-1'%3F%3E%3C!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools --%3E%3Csvg height='20px' width='20' version='1.1' id='Layer_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 496.158 496.158' xml:space='preserve'%3E%3Cpath style='fill:%23E04F5F;' d='M0,248.085C0,111.063,111.069,0.003,248.075,0.003c137.013,0,248.083,111.061,248.083,248.082 c0,137.002-111.07,248.07-248.083,248.07C111.069,496.155,0,385.087,0,248.085z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M383.546,206.286H112.612c-3.976,0-7.199,3.225-7.199,7.2v69.187c0,3.976,3.224,7.199,7.199,7.199 h270.934c3.976,0,7.199-3.224,7.199-7.199v-69.187C390.745,209.511,387.521,206.286,383.546,206.286z'/%3E%3C/svg%3E");
                background-repeat: no-repeat;
                height: 30px;
                width: 30px;
                background-position: center;
                cursor: pointer;
            }
            .button-add-quantity{
                background-image: url("data:image/svg+xml,%3C%3Fxml version='1.0' encoding='utf-8'%3F%3E%3C!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools --%3E%3Csvg width='20px' height='20px' viewBox='0 0 1024 1024' class='icon' version='1.1' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M512 512m-448 0a448 448 0 1 0 896 0 448 448 0 1 0-896 0Z' fill='%234CAF50' /%3E%3Cpath d='M448 298.666667h128v426.666666h-128z' fill='%23FFFFFF' /%3E%3Cpath d='M298.666667 448h426.666666v128H298.666667z' fill='%23FFFFFF' /%3E%3C/svg%3E");
                background-repeat: no-repeat;
                height: 30px;
                width: 30px;
                background-position: center;
                cursor: pointer;
            }
            button:hover {
                background: #b8323a;
            }
            span {
                min-width: 24px;
                text-align: center;
                font-size: 1.1rem;
                font-weight: 600;
            }
        }
        .hide-quantity-controls {
            visibility: hidden;
            pointer-events: none;
        }
    }
    .checkbox-row input[type="checkbox"] {
        margin-right: 1rem;
        max-width: 1rem;
        align-self: flex-start;
    }
    .button-quantity-controls{
        display: flex;
    }
}
</style>
