<script setup>
import GestioneProdotti from './components/GestioneProdotti.vue'
import AggiungiOrdine from "@/components/AggiungiOrdine.vue";
import HomePage from "@/views/HomePage.vue";
import { onMounted } from 'vue'
import { useDeviceStore } from '@/deviceStore'
import { ref } from 'vue'
import { useRouter } from 'vue-router'


const showLogoutModal = ref(false)
const router = useRouter()
const deviceStore = useDeviceStore()

function cancelLogout() {
    showLogoutModal.value = false
}

function confirmLogout() {
    deviceStore.$reset()
    showLogoutModal.value = false

    router.push({ name: 'Home' })
}
</script>

<template>
  <div>
      <div>
          <!-- Bottone logout (div cliccabile) -->
          <div
              @click="showLogoutModal = true"
              style="cursor:pointer;position:fixed;top:0;right:0;z-index:1000;background:#eee;padding:8px 16px;border-radius:0 0 0 8px;min-width:120px;text-align:right;"
          >
              Stato dispositivo: <b>{{ deviceStore.isServer ? 'Master' : 'Client' }}</b>
          </div>

          <!-- Modale logout -->
          <div v-if="showLogoutModal" class="modal-overlay">
              <div class="modal">
                  <p>Vuoi effettuare il logout?</p>
                  <div class="modal-actions">
                      <button @click="cancelLogout">No</button>
                      <button @click="confirmLogout">Sì</button>
                  </div>
              </div>
          </div>
      </div>
    <!--<GestioneProdotti />
    <AggiungiOrdine />-->
      <router-view></router-view>
  </div>
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2000;
}
.modal {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    text-align: center;
    min-width: 300px;
}
.modal-actions button {
    margin: 0 0.5rem;
}
</style>
