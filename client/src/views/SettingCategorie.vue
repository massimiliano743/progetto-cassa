<script setup>
import {ref, onMounted, computed} from 'vue'
import { useCategoryStore } from '@/stores/categoryStore'
import { useRouter } from 'vue-router'


const CategoryStore = useCategoryStore();
const router = useRouter()

const nome = ref('')
const enable = ref(true)
const showDeleteAllModal = ref(false)
const showDeleteSingleModal = ref(false)
const isEditModalOpen = ref(false)
const idDaEliminare = ref(null)
const nomeProdottoDaEliminare = ref('')
const categoryInModifica = ref({})


const coloreSelezionato = ref('#000000')
const coloreSelezionatoModale = ref('#000000')
const coloriSalvati = ref([])
const coloriDefault = [
    '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff',
    '#00ffff', '#000000', '#ffffff', '#c0c0c0', '#808080',
    '#800000', '#808000', '#008000', '#800080', '#008080'
]

function apriModaleModifica(category) {
    categoryInModifica.value = {
        ...category,
        enableModal: category.enable === 'true' || category.enable === true
    }
    isEditModalOpen.value = true
}
function chiudiModale() {
    isEditModalOpen.value = false
}
function salvaModifiche() {
    CategoryStore.updateCategory({
        ...categoryInModifica.value,
        color: coloreSelezionatoModale.value,
        enable: categoryInModifica.value.enableModal ? 'true' : 'false'
    })
    isEditModalOpen.value = false
}
function deleteProduct(row) {
    idDaEliminare.value = row.id
    nomeProdottoDaEliminare.value = row.name
    showDeleteSingleModal.value = true
}

function confermaEliminazioneSingola() {
    if (idDaEliminare.value !== null) {
        CategoryStore.removeCategory(idDaEliminare.value)
        idDaEliminare.value = null
    }
    showDeleteSingleModal.value = false
}
function confermaEliminazione() {
    showDeleteAllModal.value = false
    clearTableCategories();
}

function annullaEliminazione() {
    showDeleteAllModal.value = false
    showDeleteSingleModal.value = false
    idDaEliminare.value = null
}
function clearTableCategories() {
    CategoryStore.clearTableCategories()
}
function openModal() {
    showDeleteAllModal.value = true
}

onMounted(() => {
    const salvati = JSON.parse(localStorage.getItem('coloriUtente')) || []
    coloriSalvati.value = [...coloriDefault, ...salvati]
    CategoryStore.loadCategory()
})

function confermaColore() {
    if (!coloriSalvati.value.includes(coloreSelezionato.value)) {
        const salvati = JSON.parse(localStorage.getItem('coloriUtente')) || []
        salvati.push(coloreSelezionato.value)
        localStorage.setItem('coloriUtente', JSON.stringify(salvati))
        coloriSalvati.value = [...coloriDefault, ...salvati]
    }
}

function svuotaColoriPersonalizzati() {
    if (confirm('Sei sicuro di voler cancellare tutti i colori personalizzati?')) {
        localStorage.removeItem('coloriUtente')
        coloriSalvati.value = [...coloriDefault]
        coloreSelezionato.value = '#000000'
    }
}
function salvaCategoria() {
    CategoryStore.addCategory({
        name: nome.value,
        color: coloreSelezionato.value,
        enable: enable.value ? 'true' : 'false',
    })}

const sortedData = computed(() => {
    const data = [...CategoryStore.category]
    return data
})
const columns = computed(() => {
    const first = CategoryStore.category[0]
    if (!first) return []
    return Object.keys(first)
})
function tornaIndietro() {
    router.back()
}
</script>

<template>
    <div class="back-page" @click="tornaIndietro">
        <div class="icon-back-page"></div>
        <div class="text-back">Torna Indietro</div>
    </div>
    <div class="setting-categories">
        <div class="color-picker-container">

            <form @submit.prevent="salvaCategoria">
                <div class="add-categoria">
                    <div class="categoria-title">
                        <h2>Inserisci il nome della categoria</h2>
                        <input v-model="nome" class="input-categoria" type="text"/>
                    </div>
                </div>
                <label class="color-picker-label">
                    Scegli colore:
                    <input type="color" v-model="coloreSelezionato" list="presetColors" class="color-input" />

                    <button type="button" @click="confermaColore" class="btn-add">
                        Aggiungi
                    </button>
                    <button
                        type="button"
                        @click="svuotaColoriPersonalizzati"
                        v-if="coloriSalvati.length > coloriDefault.length"
                        class="btn-clear"
                    >
                        Cancella Colori Personalizzati
                    </button>
                </label>

                <datalist id="presetColors">
                    <option v-for="color in coloriSalvati" :key="color" :value="color" />
                </datalist>

                <div class="selected-color-info">
                    <p>Colore selezionato: <span :style="{ color: coloreSelezionato }">{{ coloreSelezionato }}</span></p>
                </div>
                <div class="elemento-attivo">
                    <label>
                        <input type="checkbox" v-model="enable" />
                        Abilita Categoria
                    </label>
                </div>
                <div class="button-save">
                    <button type="submit" class="button-salva">Salva Categoria</button>
                </div>
            </form>
        </div>
        <div class="category-list">
            <h2>Lista Categorie</h2>
            <table>
                <thead>
                <tr>
                    <th class="remove-column" @click="openModal">
                    </th>
                    <th v-for="col in columns" :key="col" @click="sortBy(col)" :class="{ 'hidden': col === 'id'}">
                        {{ col }}
                    </th>
                    <th>
                        Modifica
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
                            <input v-model="categoryInModifica.nome" placeholder="Nome" required />
                        </div>
                        <label class="color-picker-label">
                            Scegli colore:
                            <input type="color" v-model="coloreSelezionatoModale" list="presetColors" class="color-input" />
                            <div class="button-align">
                                <button type="button" @click="confermaColore" class="btn-add">
                                    Aggiungi
                                </button>
                                <button
                                    type="button"
                                    @click="svuotaColoriPersonalizzati"
                                    v-if="coloriSalvati.length > coloriDefault.length"
                                    class="btn-clear"
                                >
                                    Cancella Colori Personalizzati
                                </button>
                            </div>

                        </label>
                        <datalist id="presetColors">
                            <option v-for="color in coloriSalvati" :key="color" :value="color" />
                        </datalist>

                        <div class="selected-color-info">
                            <p>Colore selezionato: <span :style="{ color: coloreSelezionatoModale }">{{ coloreSelezionatoModale }}</span></p>
                        </div>
                        <div class="elemento-attivo">
                            <label>
                                <input type="checkbox" v-model="categoryInModifica.enableModal" />
                                Abilita Categoria
                            </label>
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
.setting-categories{
    max-width: 1280px;
    min-width: 800px;
    margin: 0 auto;
    padding: 0 2rem;
    text-align: center;
    display: flex;
    .color-picker-container {
        font-family: Arial, sans-serif;
        max-width: 500px;
        margin: 0 auto;
        padding: 0 2rem;
        border-radius: 8px;


        .add-categoria{
            .categoria-title{
                display: flex;
                flex-direction: column;
                align-items: center;
                margin-bottom: 20px;
                .input-categoria{
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    font-size: 16px;
                    box-sizing: border-box;
                }
            }
        }
        .color-picker-label {
            position: relative;
            display: flex;
            margin-bottom: 15px;
            font-weight: bold;
            gap: 1rem;
        }

        .color-input {
            margin-left: 10px;
            vertical-align: middle;
            cursor: pointer;
        }

        .btn-add {
            padding: 4px 12px;
            font-size: 12px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.3s;
        }

        .btn-add:hover {
            background-color: #45a049;
        }

        .btn-clear {
            padding: 4px 12px;
            font-size: 12px;
            background-color: #f44336;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.3s;
        }

        .btn-clear:hover {
            background-color: #d32f2f;
        }

        .selected-color-info {
            margin-top: 15px;
            padding: 10px;
            background-color: #f1f1f1;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .selected-color-info p {
            margin: 0;
            color: #333;
        }
        .elemento-attivo{
            margin-top: 1rem;
            font-size: 1.2rem;
            label{
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            input[type="checkbox"] {
                width: 20px;
                height: 20px;
            }
        }
        .button-salva{
            padding: 10px 20px;
            font-size: 16px;
            background-color: #2196F3;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.3s;
            width: 100%;
            margin-top: 1rem;
        }
    }
    .category-list{
        max-width: 500px;
        margin: 0 auto;
        padding: 0 20px;
        max-height: 600px;
        overflow-y: auto;
        table{
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
            align-items: center;
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
        .color-picker-label{
            gap: 5px;
            display: flex;
            flex-direction: column;
            align-items: center;
            .button-align{
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            .btn-add {
                padding: 4px 12px;
                font-size: 12px;
                background-color: #4CAF50;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.3s;
            }

            .btn-add:hover {
                background-color: #45a049;
            }

            .btn-clear {
                padding: 4px 12px;
                font-size: 12px;
                background-color: #f44336;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.3s;
            }

            .btn-clear:hover {
                background-color: #d32f2f;
            }
        }
    }
    .modal-actions {
        margin-top: 1rem;
        display: flex;
        justify-content: space-around;
    }
    .color-input{
        margin-left: 10px;
        vertical-align: middle;
        cursor: pointer;
    }
}


</style>
