<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useDeviceStore } from '@/deviceStore'

const deviceStore = useDeviceStore()
const isElectron = navigator.userAgent.toLowerCase().includes('electron');
const urlServer = isElectron ? 'localhost' : window.location.hostname;
const authError = ref('');
const isLoading = ref(false);
const router = useRouter();
const allDb = ref([]);  // lista dei db disponibili
const selected = ref(''); // db selezionato
const newDbName = ref('');

async function getDb() {
    console.log('Chiamo /get-db-from-folder su', urlServer);
    const res = await fetch(`http://${urlServer}:3000/get-db-from-folder`);
    if (res.ok) {
        const data = await res.json();
        console.log("Databases trovati:", data.databases);
        return data.databases;
    } else {
        console.error("Errore nel recupero database");
        return [];
    }
}

async function selectDb() {
    console.log('Database selezionato:', selected.value);
    deviceStore.databaseName(selected.value);
    fetch(`http://${urlServer}:3000/set-db?dbName=${selected.value}`, {
        headers: {
            'x-db-name': selected.value
        }
    });
    router.push({ name: 'MainPage' });
}

function createDb() {
    console.log('nome evento '+ newDbName.value);
    fetch(`http://${urlServer}:3000/create-db?dbName=${newDbName.value}`, {
        headers: {
            'x-db-name': newDbName.value
        }
    }).then(response => {
        if (response.ok) {
            alert(`✅ Evento creato con successo: ${newDbName.value}`);
            allDb.value.push(newDbName.value);
            deviceStore.databaseName(newDbName.value);
            fetch(`http://${urlServer}:3000/set-db?dbName=${newDbName.value}`, {
                headers: {
                    'x-db-name': selected.value
                }
            });
            router.push({ name: 'MainPage' });
        } else {
            alert('❌ Errore nella creazione dell\'evento');
        }
    }).catch(error => {
        console.error('Errore nella richiesta di creazione del database:', error);
        alert('❌ Errore nella creazione dell\'evento');
    });

}
onMounted(async () => {
    console.log('SelectDb.vue montato!');
    try {
        allDb.value = await getDb();
        console.log("allDb caricati:", allDb.value);
    } catch (error) {
        console.error('Errore in onMounted:', error);
    }
});
</script>


<template>
    <div class="select-db">
        <div v-if="deviceStore.isServer" class="create-new-db">
            <form @submit.prevent="createDb">
                <div for="db-select" class="title">Crea un nuovo Evento: </div>
                <div>
                    <input v-model="newDbName" type="text" placeholder="Nome Evento" required />
                </div>
                <div>
                    <button type="submit" :disabled="isLoading">Crea</button>
                </div>
                <div v-if="authError" style="color: red;">{{ authError }}</div>
            </form>
        </div>
        <div class="use-existing-db">
            <form @submit.prevent="selectDb">
                <div for="db-select" class="title">Seleziona Evento: </div>
                <select id="db-select" v-model="selected">
                    <option disabled value="">-- Scegli un database --</option>
                    <option v-for="db in allDb" :key="db" :value="db">{{ db }}</option>
                </select>
                <div>
                    <button type="submit" :disabled="isLoading">Seleziona</button>
                </div>
                <div v-if="authError" style="color: red;">{{ authError }}</div>
            </form>
            <div>
            </div>
        </div>
    </div>


</template>

<style scoped>
.select-db{
    max-width: 1200px;
    height: 100vh;
    margin: 0 auto;
    justify-content: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 50px;
    display: flex;
    flex-direction: row;
    justify-content: center;
    gap: 100px;
    .create-new-db, .use-existing-db{
        min-width: 500px;
        min-height: 300px;
        background-color: #b3e1fd;
        border-radius: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        form{
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 30px;
            .title{
                font-size: 30px;
                font-weight: bold;
            }
        }
    }
    button{
            width: 200px;
            max-height: 100px;
            border-radius: 10px;
            font-size: 20px;
            font-weight: bold;
            color: white;
            background-color: #427cb8;
            border: none;
            cursor: pointer;
            transition: background-color 0.3s ease;
            &:hover {
                background-color: #35495e;
            }
        }
}
</style>
