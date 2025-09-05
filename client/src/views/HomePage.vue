<script setup>
import { ref, onMounted } from 'vue';
import { createSocket, getSocketSync } from '@/socket';
import { useRouter } from 'vue-router';
import { useDeviceStore } from '@/deviceStore';
import { useProdottoStore } from '@/stores/prodottoStore';

const username = ref('');
const password = ref('');
const authError = ref('');
const isLoading = ref(false);
const router = useRouter();
const deviceStore = useDeviceStore();
const prodottoStore = useProdottoStore();

onMounted(() => {
    console.log('HomePage.vue montato!')
});

async function handleLogin() {
    console.log('handleLogin chiamato');
    authError.value = '';
    isLoading.value = true;
    try {
        // Crea la socket solo dopo login
        const socket = await createSocket();
        socket.emit('login', { username: username.value, password: password.value }, (response) => {
            isLoading.value = false;
            if (response.success) {
                // Dopo login, registra il device e ricevi il ruolo
                socket.emit('registerDevice', {}, (ruolo) => {
                    // Salva il ruolo nel deviceStore
                    deviceStore.setIsServer(ruolo === 'master');
                    // Inizializza i listener dopo login
                    prodottoStore.initSocketListeners();
                    // Redirect
                    router.push({ name: 'SelectDb' });
                });
            } else {
                authError.value = response.message || 'Credenziali non valide';
            }
        });
    } catch (e) {
        isLoading.value = false;
        authError.value = 'Errore di connessione al server';
    }
}
</script>

<template>
    <div class="use-destination">
        <div class="log-in">
            <h2>Login</h2>
            <form @submit.prevent="handleLogin">
                <div>
                    <input v-model="username" type="text" placeholder="Username" required />
                </div>
                <div>
                    <input v-model="password" type="password" placeholder="Password" required />
                </div>
                <div>
                    <button type="submit" :disabled="isLoading">Accedi</button>
                </div>
            </form>
            <div v-if="authError" class="error-message-logIn">{{ authError }}</div>
        </div>
    </div>
</template>

<style scoped>
.use-destination{
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
    .error-message-logIn{
        color: red;
        font-weight: 500;
        margin-top: 20px;
        font-size: 25px;
    }
    .log-in{
        display: flex;
        flex-direction: column;
        align-items: center;
    }
}
</style>
