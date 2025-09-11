<script setup>
import { ref, onMounted } from 'vue';
import { createSocket } from '@/socket';
import { useRouter } from 'vue-router';
import { useDeviceStore } from '@/deviceStore';
import { useProdottoStore } from '@/stores/prodottoStore';

const numero_licenza = ref('');
const authError = ref('');
const isLoading = ref(false);
const router = useRouter();
const deviceStore = useDeviceStore();
const prodottoStore = useProdottoStore();

onMounted(() => {
    console.log('Auth.vue montato!');
    hasValidCookie();

});
function hasValidCookie() {
    // document.cookie restituisce solo i cookie attivi (non scaduti)
    const cookies = document.cookie.split('; ').filter(c => c); // rimuove stringhe vuote
    if(cookies.length > 0){
        console.log('Cookie attivo trovato, reindirizzamento a Home');
        router.push({ name: 'Home' });
    }
}

// Funzione per gestire cookie senza librerie
function setLicenseCookie(nome, valore, scadenza) {
    const expireDate = new Date(scadenza);
    const now = new Date();

    // Se la data di scadenza è già passata → elimina cookie subito
    if (expireDate <= now) {
        document.cookie = `${nome}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
        console.log(`Cookie "${nome}" eliminato perché scaduto`);
        return false;
    }

    const cookieEsistente = document.cookie
        .split('; ')
        .find(row => row.startsWith(nome + '='));

    if (cookieEsistente) {
        console.log('Cookie esistente, reindirizzamento a Home');
    } else {
        document.cookie = `${nome}=${valore}; expires=${expireDate.toUTCString()}; path=/`;
        console.log(`Cookie "${nome}" impostato correttamente`);
    }
    return true;
}

async function handleLicese() {
    console.log('handleLicese chiamato');
    authError.value = '';
    isLoading.value = true;

    try {
        const socket = await createSocket();
        socket.emit('validate-license', { numero_licenza: numero_licenza.value }, (response) => {
            isLoading.value = false;

            if (response.success) {
                console.log('Licenza valida, procedi con la registrazione del dispositivo');

                // Gestione cookie
                let cookieValid = setLicenseCookie(numero_licenza.value, numero_licenza.value, response.data);

                // Esempio di redirect dopo validazione
                console.log('Redirect a Home');
                if(cookieValid){
                    router.push({ name: 'Home' });
                }else{
                    authError.value = 'Licenza scaduta, inserire una licenza valida';
                }
            } else {
                authError.value = response.message || 'Licenza non valida';
            }
        });
    } catch (e) {
        isLoading.value = false;
        authError.value = 'Errore di connessione al server';
        console.error(e);
    }
}
</script>

<template>
    <div class="use-license">
        <div class="license">
            <h2>Inserire numero licenza</h2>
            <form @submit.prevent="handleLicese">
                <div>
                    <input v-model="numero_licenza" type="text" placeholder="Numero Licenza" required />
                </div>
                <div>
                    <button type="submit" :disabled="isLoading">Valida</button>
                </div>
            </form>
            <div v-if="authError" class="error-message-license">{{ authError }}</div>
        </div>
    </div>
</template>

<style scoped>
.use-license{
    max-width: 1200px;
    height: 100vh;
    margin: 0 auto;
    justify-content: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 50px;
    form{
        display: flex;
        flex-direction: column;
        gap: 20px;
        input{
            padding: 10px;
            font-size: 16px;
            width: 250px;
            border-radius: 10px;
            border: 1px solid gray;
        }
        button{
            padding: 10px;
            font-size: 16px;
            cursor: pointer;
            width: 100%;
            height: 40px;
        }
    }
    .error-message-license{
        color: red;
        font-weight: 500;
        margin-top: 20px;
        font-size: 25px;
    }
    .license{
        display: flex;
        flex-direction: column;
        align-items: center;
    }
}
</style>
