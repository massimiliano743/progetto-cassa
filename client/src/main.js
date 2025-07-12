import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import router from './router/router.js'
import { useAuthStore } from './stores/authStore.js'

const app = createApp(App)
app.use(router)
app.use(createPinia())

// Inizializza lo stato di autenticazione all'avvio
const authStore = useAuthStore();
authStore.checkAuth();

app.mount('#app')
