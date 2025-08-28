<script setup>
import { ref } from 'vue';
import { createSocket, getSocketSync } from '@/socket';
import { useRouter } from 'vue-router';

const username = ref('');
const password = ref('');
const authError = ref('');
const isLoading = ref(false);
const router = useRouter();

async function handleLogin() {
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
                    import('@/deviceStore').then(mod => {
                        if (mod.useDeviceStore) {
                            mod.useDeviceStore().setIsServer(ruolo === 'master');
                        }
                    });
                    // Inizializza i listener dopo login
                    import('@/stores/prodottoStore').then(mod => {
                        if (mod.useProdottoStore) {
                            mod.useProdottoStore().initSocketListeners();
                        }
                    });
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
            <div v-if="authError" style="color: red;">{{ authError }}</div>
        </form>
        <div>
        </div>
    </div>
</template>

<style scoped>
.use-destination{
    max-width: 1200px;
    margin: 0 auto;
    justify-content: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 50px;
    .button-disposition{
        display: flex;
        flex-direction: row;
        justify-content: center;
        gap: 100px;
        button{
            width: 200px;
            height: 200px;
            border-radius: 10px;
            font-size: 20px;
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
    }
}
</style>
