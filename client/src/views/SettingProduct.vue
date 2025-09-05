<script setup>
import { ref, computed, onMounted } from 'vue'
import { useProdottoStore } from '@/stores/prodottoStore'
import { useRouter } from 'vue-router'
import { useCategoryStore } from "@/stores/categoryStore.js";

const isElectron = navigator.userAgent.toLowerCase().includes('electron');
const urlServer = isElectron ? 'localhost' : window.location.hostname;

const router = useRouter()
const nome = ref('')
const prezzo = ref(0)
const quantita = ref(0)
const selected = ref('')
const nomeProdottoDaEliminare = ref('')
const prodottoStore = useProdottoStore()
const showModal = ref(false)
const CategoryStore = useCategoryStore();

// === Modifica Prodotto ===
const isEditModalOpen = ref(false)
const prodottoInModifica = ref({})

// === ID per eliminazione singola ===
const idDaEliminare = ref(null)
const showDeleteAllModal = ref(false)
const showDeleteSingleModal = ref(false)

// === Stampante ===
const printersList = ref([])
const selectedPrinterId = ref('')
const printerStatus = ref('Caricamento stampanti...')
const printerStatusColor = ref('#2196F3')

// Tipologie disponibili da lista prodotti
const tipologieDisponibili = computed(() => {
    const uniche = [];
    const visti = new Set();
    for (const cat of CategoryStore.category) {
        if (!visti.has(cat.name)) {
            uniche.push({ id: cat.id, name: cat.name });
            visti.add(cat.name);
        }
    }
    return uniche;
});

function apriModaleModifica(prodotto) {
    prodottoInModifica.value = { ...prodotto }
    isEditModalOpen.value = true
}

function chiudiModale() {
    isEditModalOpen.value = false
}

function salvaModifiche() {
    prodottoStore.updateProdotto(prodottoInModifica.value)
    isEditModalOpen.value = false
}

onMounted(() => {
    prodottoStore.loadProdotti();
    prodottoStore.initSocketListeners();
    CategoryStore.loadCategory();
    CategoryStore.initSocketListeners();
    loadPrinters();
})

function aggiungiProdotto() {
    prodottoStore.addProdotto({
        nome: nome.value,
        quantita: quantita.value,
        tipologia: selected.value,
        prezzo: prezzo.value
    })
    nome.value = ''
    prezzo.value = 0
    quantita.value = 0
    selected.value = ''
}

// === Ordinamento ===
const sortColumn = ref(null)
const sortDirection = ref('asc')

const columns = computed(() => {
    const first = prodottoStore.prodotti[0]
    if (!first) return []
    return Object.keys(first)
})

const sortedData = computed(() => {
    const data = [...prodottoStore.prodotti]
    if (!sortColumn.value) return data

    return data.sort((a, b) => {
        const valA = a[sortColumn.value]
        const valB = b[sortColumn.value]

        if (valA == null) return 1
        if (valB == null) return -1

        if (typeof valA === 'number' && typeof valB === 'number') {
            return sortDirection.value === 'asc' ? valA - valB : valB - valA
        }

        return sortDirection.value === 'asc'
            ? String(valA).localeCompare(String(valB))
            : String(valB).localeCompare(String(valA))
    })
})

function sortBy(col) {
    if (sortColumn.value === col) {
        sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    } else {
        sortColumn.value = col
        sortDirection.value = 'asc'
    }
}

function deleteProduct(row) {
    idDaEliminare.value = row.id
    nomeProdottoDaEliminare.value = row.nome
    showDeleteSingleModal.value = true
}

function confermaEliminazioneSingola() {
    if (idDaEliminare.value !== null) {
        prodottoStore.removeProdotto(idDaEliminare.value)
        idDaEliminare.value = null
    }
}

function clearTableProdotti() {
    prodottoStore.clearTableProddoti()
}

function openModal() {
    showDeleteAllModal.value = true
}

function confermaEliminazione() {
    showDeleteAllModal.value = false
    clearTableProdotti()
}

function annullaEliminazione() {
    showDeleteAllModal.value = false
    showDeleteSingleModal.value = false
    idDaEliminare.value = null
}

function tornaIndietro() {
    router.back()
}

// === Funzioni per la stampante ===
async function loadPrinters() {
    try {
        updatePrinterStatus("Caricamento stampanti...", "#2196F3");

        const response = await fetch(`http://${urlServer}:3000/stampanti`);

        if (!response.ok) {
            throw new Error('Errore nel caricamento stampanti');
        }

        const printers = await response.json();
        printersList.value = printers;

        if (printers.length === 0) {
            updatePrinterStatus("Nessuna stampante disponibile", "#d32f2f");
            return;
        }

        const selectedResponse = await fetch(`http://${urlServer}:3000/stampante-selezionata`);
        if (selectedResponse.ok) {
            const selected = await selectedResponse.json();
            if (selected && selected.vendorId) {
                selectedPrinterId.value = `${selected.vendorId}:${selected.productId}`;
            }
        }

        updatePrinterStatus(
            printers.length > 1 ?
                `${printers.length} stampanti disponibili` :
                "1 stampante disponibile",
            "#388e3c"
        );

    } catch (error) {
        console.error('Errore:', error);
        updatePrinterStatus(`Errore: ${error.message}`, "#d32f2f");
    }
}

async function saveSelectedPrinter() {
    if (!selectedPrinterId.value) return;

    const [printerName] = selectedPrinterId.value.split(':');

    try {
        const response = await fetch(`http://${urlServer}:3000/seleziona-stampante`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ printerName })
        });

        if (!response.ok) {
            throw new Error('Salvataggio fallito');
        }

        updatePrinterStatus("Stampante configurata", "#388e3c");
    } catch (error) {
        console.error('Errore:', error);
        updatePrinterStatus(`Errore: ${error.message}`, "#d32f2f");
    }
}

async function printTest() {
    try {
        updatePrinterStatus("Stampa in corso...", "#2196F3");

        const testo = "TEST DI STAMPA\n\n" +
            "Data: " + new Date().toLocaleString() + "\n" +
            "Stampante funzionante!\n\n\n";

        const response = await fetch(`http://${urlServer}:3000/stampa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ testo })
        });

        if (!response.ok) {
            throw new Error('Stampa fallita');
        }

        updatePrinterStatus("Stampa completata", "#388e3c");
        alert('Stampa completata con successo!');
    } catch (error) {
        console.error('Errore:', error);
        updatePrinterStatus(`Errore: ${error.message}`, "#d32f2f");
        alert(`Errore durante la stampa: ${error.message}`);
    }
}

function updatePrinterStatus(message, color) {
    printerStatus.value = message;
    printerStatusColor.value = color;
}

</script>

<template>
    <div class="printer-section">
        <div class="printer-controls">
            <select
                v-model="selectedPrinterId"
                @change="saveSelectedPrinter"
                class="printer-select"
            >
                <option value="" disabled>Seleziona una stampante</option>
                <option
                    v-for="printer in printersList"
                    :key="`${printer}`"
                    :value="`${printer}`"
                >
                    {{ `Stampante (${printer})` }}
                </option>
            </select>

            <button
                @click="printTest"
                class="print-btn"
                :disabled="!selectedPrinterId"
            >
                Stampa Test
            </button>

            <button @click="loadPrinters" class="refresh-btn">
                Aggiorna
            </button>
        </div>

        <div class="printer-status" :style="{ color: printerStatusColor }">
            {{ printerStatus }}
        </div>
    </div>
    <div class="back-page" @click="tornaIndietro">
        <div class="icon-back-page"></div>
        <div class="text-back">Torna Indietro</div>
    </div>
    <div class="setting-product-app">
        <div class="setting-product">
            <div class="add-name-product">
                <div class="text-add-product">
                    <h2>Aggiungi Prodotto</h2>
                </div>
                <form @submit.prevent="aggiungiProdotto">
                    <div class="form-flex">
                        <div class="align-text-input">
                            <div class="text-input">Nome Prodotto</div>
                            <input v-model="nome" placeholder="Nome prodotto" required />
                        </div>
                        <div class="align-text-input">
                            <div class="text-input">Quantità Prodotto</div>
                            <input v-model.number="quantita" type="number" step="1" placeholder="Quantità" required />
                        </div>
                        <div class="align-text-input">
                            <div class="text-input">Tipologia</div>
                            <select v-model="selected">
                                <option disabled value="">Tipologia</option>
                                <option v-for="tipo in tipologieDisponibili" :key="tipo.id" :value="tipo.id">
                                    {{ tipo.name }}
                                </option>
                            </select>
                        </div>
                        <div class="align-text-input">
                            <div class="text-input">Prezzo Prodotto</div>
                            <input v-model.number="prezzo" type="number" step="0.01" placeholder="Prezzo" required />
                        </div>
                    </div>
                    <button type="submit">Salva</button>
                </form>
            </div>
        </div>

        <div class="product-list">
            <h2>Lista Prodotti</h2>
            <table>
                <thead>
                <tr>
                    <th class="remove-column" @click="openModal"></th>
                    <th v-for="col in columns" :key="col" @click="sortBy(col)" :class="{ 'hidden': col === 'id'}">
                        {{ col }}
                        <span v-if="sortColumn === col">
                {{ sortDirection === 'asc' ? '▲' : '▼' }}
              </span>
                    </th>
                    <th>Modifica quantità</th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="row in sortedData" :key="row.id">
                    <td class="remove-column" @click="deleteProduct(row)"></td>
                    <td v-for="col in columns" :key="col" :class="{ 'hidden': col === 'id' }">
                        {{ row[col] }}
                    </td>
                    <td class="edit-button">
                        <button @click="apriModaleModifica(row)">✏️</button>
                    </td>
                </tr>
                </tbody>
            </table>
        </div>

        <!-- Modale eliminazione totale -->
        <div v-if="showDeleteAllModal" class="modal-overlay">
            <div class="modal">
                <p>Sei sicuro di voler eliminare tutti i prodotti? <br>L'azione è IRREVERSIBILE</p>
                <div class="modal-actions">
                    <button @click="annullaEliminazione">No</button>
                    <button @click="confermaEliminazione">Sì</button>
                </div>
            </div>
        </div>

        <!-- Modale eliminazione singola -->
        <div v-if="showDeleteSingleModal" class="modal-overlay">
            <div class="modal">
                <p>Sei sicuro di voler eliminare <strong>{{ nomeProdottoDaEliminare }}</strong>? <br>L'azione è IRREVERSIBILE</p>
                <div class="modal-actions">
                    <button @click="annullaEliminazione">No</button>
                    <button @click="confermaEliminazioneSingola">Sì</button>
                </div>
            </div>
        </div>

        <!-- Modale modifica -->
        <div v-if="isEditModalOpen" class="modal-overlay">
            <div class="modal-content modal">
                <h3>Modifica Prodotto</h3>
                <form @submit.prevent="salvaModifiche">
                    <div class="modal-form-content">
                        <div class="align-text-input">
                            <div class="text-input">Nome Prodotto</div>
                            <input v-model="prodottoInModifica.nome" placeholder="Nome" required />
                        </div>
                        <div class="align-text-input">
                            <div class="text-input">Quantità</div>
                            <input v-model.number="prodottoInModifica.quantita" class="quantità" type="number" placeholder="Quantità" required />
                        </div>
                        <div class="align-text-input">
                            <div class="text-input">Prezzo</div>
                            <input v-model.number="prodottoInModifica.prezzo" class="prezzo" type="number" step="0.01" placeholder="Prezzo" required />
                        </div>
                        <div class="align-text-input">
                            <div class="text-input">Tipologia</div>
                            <select v-model="prodottoInModifica.tipologia" required>
                                <option disabled value="">Tipologia</option>
                                <option v-for="tipo in tipologieDisponibili" :key="tipo.id" :value="tipo.id">
                                    {{ tipo.name }}
                                </option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button type="button" @click="chiudiModale">Annulla</button>
                        <button type="submit">Salva</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>

<style scoped>
.printer-section {
    margin: 0 0;
    padding: 1rem;
    background: #f8f8f8;
    border-radius: 8px;
}

.printer-controls {
    display: flex;
    gap: 1rem;
    align-items: center;
    margin-bottom: 0.5rem;
}

.printer-select {
    padding: 0.5rem;
    min-width: 250px;
    border: 1px solid #ccc;
    border-radius: 4px;
}

.print-btn, .refresh-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.print-btn {
    background-color: #4CAF50;
    color: white;
}

.print-btn:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
}

.refresh-btn {
    background-color: #2196F3;
    color: white;
}

.printer-status {
    font-size: 0.9rem;
    font-style: italic;
}

.setting-product-app {
    max-width: 1280px;
    min-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    text-align: center;
}

.hidden {
    display: none;
}

.setting-product .align-text-input {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.setting-product form .form-flex {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    justify-content: center;
}

.setting-product input,
.setting-product select {
    flex: 1;
    padding: 0.5rem;
}

.setting-product button {
    padding: 0.5rem 1rem;
    width: 100%;
}

.product-list {
    max-height: 600px;
    overflow-y: scroll;
}

.product-list table {
    width: 100%;
    border-collapse: collapse;
    text-align: center;
}

.product-list th {
    background: #f0f0f0;
    cursor: pointer;
    padding: 0.5rem;
}

.product-list th.remove-column,
.product-list td.remove-column {
    background-image: url("data:image/svg+xml,%3C%3Fxml version='1.0' encoding='iso-8859-1'%3F%3E%3C!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools --%3E%3Csvg height='20px' width='20' version='1.1' id='Layer_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 496.158 496.158' xml:space='preserve'%3E%3Cpath style='fill:%23E04F5F;' d='M0,248.085C0,111.063,111.069,0.003,248.075,0.003c137.013,0,248.083,111.061,248.083,248.082 c0,137.002-111.07,248.07-248.083,248.07C111.069,496.155,0,385.087,0,248.085z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M383.546,206.286H112.612c-3.976,0-7.199,3.225-7.199,7.2v69.187c0,3.976,3.224,7.199,7.199,7.199 h270.934c3.976,0,7.199-3.224,7.199-7.199v-69.187C390.745,209.511,387.521,206.286,383.546,206.286z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    height: 30px;
    width: 30px;
    background-position: center;
    cursor: pointer;
}

.product-list td {
    border-top: 1px solid #ddd;
    padding: 0.5rem;
}

.product-list td.add-remove-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
}

.product-list tr:hover {
    background-color: #f9f9f9;
}
</style>
