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

const LICENSE_KEY = 'app_license';

onMounted(() => {
    console.log('Auth.vue montato!');
    hasValidLicense();

});
function hasValidLicense() {
    try {
        const raw = localStorage.getItem(LICENSE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        const expiresAt = new Date(data.expiresAt);
        if (Number.isNaN(expiresAt.getTime())) {
            localStorage.removeItem(LICENSE_KEY);
            return false;
        }
        if (expiresAt > new Date()) {
            console.log('Licenza valida trovata in localStorage, reindirizzamento a Home');
            router.push({ name: 'Home' });
            return true;
        } else {
            console.log('Licenza scaduta in localStorage, rimozione');
            localStorage.removeItem(LICENSE_KEY);
            return false;
        }
    } catch (e) {
        console.warn('Licenza non valida in localStorage, rimozione');
        localStorage.removeItem(LICENSE_KEY);
        return false;
    }
}

function saveLicenseToStorage(value, expiresAtISO) {
    const expiresAt = new Date(expiresAtISO);
    const now = new Date();
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) {
        console.log('Licenza non salvata perché scaduta o data non valida');
        return false;
    }
    const payload = { value, expiresAt: expiresAt.toISOString() };
    localStorage.setItem(LICENSE_KEY, JSON.stringify(payload));
    console.log('Licenza salvata in localStorage con scadenza', payload.expiresAt);
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

                // Salvataggio licenza persistente
                const saved = saveLicenseToStorage(numero_licenza.value, response.data);

                console.log('Redirect a Home');
                if (saved) {
                    router.push({ name: 'Home' });
                } else {
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
