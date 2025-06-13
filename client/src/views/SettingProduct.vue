<script setup>
import { ref, computed, onMounted } from 'vue'
import { useProdottoStore } from '@/stores/prodottoStore'
import { useRouter } from 'vue-router'

const router = useRouter()
const nome = ref('')
const prezzo = ref(0)
const quantita = ref(0)
const selected = ref('')
const nomeProdottoDaEliminare = ref('')
const prodottoStore = useProdottoStore()
const showModal = ref(false)

// === Modifica Prodotto ===
const isEditModalOpen = ref(false)
const prodottoInModifica = ref({})

// === ID per eliminazione singola ===
const idDaEliminare = ref(null)
const showDeleteAllModal = ref(false)
const showDeleteSingleModal = ref(false)

// Tipologie disponibili da lista prodotti
const tipologieDisponibili = computed(() => {
    const all = prodottoStore.prodotti.map(p => p.tipologia)
    return [...new Set(all)]
})

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
    prodottoStore.loadProdotti()
    prodottoStore.initSocketListeners()
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
    showDeleteSingleModal.value = false
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
</script>



<template>
    <div class="setting-product">
        <div class="add-name-product">
            <div class="text-add-product">
                <div class="back-page" @click="tornaIndietro">
                    <div class="icon-back-page"></div>
                    <div class="text-back">Torna Indietro</div>
                </div>
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
                            <option>Bar</option>
                            <option>Cucina</option>
                            <option>Pasticcieria</option>
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
                <th class="remove-column" @click="openModal">
                </th>
                <th v-for="col in columns" :key="col" @click="sortBy(col)" :class="{ 'hidden': col === 'id'}">
                    {{ col }}
                    <span v-if="sortColumn === col">
              {{ sortDirection === 'asc' ? '▲' : '▼' }}
            </span>
                </th>
                <th>
                    Modifica quantità
                </th>
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
                                <option v-for="tipo in tipologieDisponibili" :key="tipo" :value="tipo">{{ tipo }}</option>
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
</template>

<style scoped>
.hidden {
    display: none;
}
.setting-product {
    .align-text-input{
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    form .form-flex{
        display: flex;
        gap: 1rem;
        margin-bottom: 1rem;
        justify-content: center;
    }
    input,
    select {
        flex: 1;
        padding: 0.5rem;
    }
    button {
        padding: 0.5rem 1rem;
        width: 100%;
    }
    .back-page{
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 1rem;
        cursor: pointer;
        .icon-back-page{
            background-image: url("data:image/svg+xml,%3C%3Fxml version='1.0' encoding='UTF-8'%3F%3E%3C!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools --%3E%3Csvg width='40px' height='40px' viewBox='0 -6.5 38 38' version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'%3E%3Ctitle%3Eleft-arrow%3C/title%3E%3Cdesc%3ECreated with Sketch.%3C/desc%3E%3Cg id='icons' stroke='none' stroke-width='1' fill='none' fill-rule='evenodd'%3E%3Cg id='ui-gambling-website-lined-icnos-casinoshunter' transform='translate(-1641.000000, -158.000000)' fill='%231C1C1F' fill-rule='nonzero'%3E%3Cg id='1' transform='translate(1350.000000, 120.000000)'%3E%3Cpath d='M317.812138,38.5802109 L328.325224,49.0042713 L328.41312,49.0858421 C328.764883,49.4346574 328.96954,49.8946897 329,50.4382227 L328.998248,50.6209428 C328.97273,51.0514917 328.80819,51.4628128 328.48394,51.8313977 L328.36126,51.9580208 L317.812138,62.4197891 C317.031988,63.1934036 315.770571,63.1934036 314.990421,62.4197891 C314.205605,61.6415481 314.205605,60.3762573 314.990358,59.5980789 L322.274264,52.3739093 L292.99947,52.3746291 C291.897068,52.3746291 291,51.4850764 291,50.3835318 C291,49.2819872 291.897068,48.3924345 292.999445,48.3924345 L322.039203,48.3917152 L314.990421,41.4019837 C314.205605,40.6237427 314.205605,39.3584519 314.990421,38.5802109 C315.770571,37.8065964 317.031988,37.8065964 317.812138,38.5802109 Z' id='left-arrow' transform='translate(310.000000, 50.500000) scale(-1, 1) translate(-310.000000, -50.500000) '%3E%3C/path%3E%3C/g%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
            background-repeat: no-repeat;
            width: 40px;
            height: 40px;
        }
        .text-back{
            font-size: 24px;
            font-weight: 700;
            color: #213547;
        }
    }
}

.product-list {
    max-height: 600px;
    overflow-y: scroll;
    table {
        width: 100%;
        border-collapse: collapse;
        text-align: center;
    }

    th {
        background: #f0f0f0;
        cursor: pointer;
        padding: 0.5rem;
    }
    th.remove-column, td.remove-column{
        background-image: url("data:image/svg+xml,%3C%3Fxml version='1.0' encoding='iso-8859-1'%3F%3E%3C!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools --%3E%3Csvg height='20px' width='20' version='1.1' id='Layer_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 496.158 496.158' xml:space='preserve'%3E%3Cpath style='fill:%23E04F5F;' d='M0,248.085C0,111.063,111.069,0.003,248.075,0.003c137.013,0,248.083,111.061,248.083,248.082 c0,137.002-111.07,248.07-248.083,248.07C111.069,496.155,0,385.087,0,248.085z'/%3E%3Cpath style='fill:%23FFFFFF;' d='M383.546,206.286H112.612c-3.976,0-7.199,3.225-7.199,7.2v69.187c0,3.976,3.224,7.199,7.199,7.199 h270.934c3.976,0,7.199-3.224,7.199-7.199v-69.187C390.745,209.511,387.521,206.286,383.546,206.286z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        height: 30px;
        width: 30px;
        background-position: center;
        cursor: pointer;
    }

    td {
        border-top: 1px solid #ddd;
        padding: 0.5rem;

    }
    td.add-remove-buttons{
        display: flex;
        gap: 1rem;
        justify-content: center;
    }

    tr:hover {
        background-color: #f9f9f9;
    }
}
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.modal {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    max-width: 1200px;
    margin: 0 auto;
    text-align: center;

    .modal-form-content{
        display: flex;
        gap: 1rem;
        .align-text-input{
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }
        input {
            flex: 1;
            padding: 0.5rem;
            font-size: 20px;
        }
        input.quantità, input.prezzo{
            max-width: 70px;
            font-size: 25px;
        }
        select{
            font-size: 20px;
            height: 100%;
        }
    }
}

.modal-actions {
    margin-top: 1rem;
    display: flex;
    justify-content: space-around;
}
</style>
