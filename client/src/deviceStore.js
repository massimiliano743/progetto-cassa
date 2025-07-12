import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useDeviceStore = defineStore('device', () => {
    const isServer = ref(JSON.parse(localStorage.getItem('isServer')) || false)
    function setIsServer(value) {
        isServer.value = value
        localStorage.setItem('isServer', JSON.stringify(value))
    }

    function $reset() {
        isServer.value = false
        localStorage.setItem('isServer', 'false')
    }

    return {
        isServer,
        setIsServer,
        $reset
    }
})
