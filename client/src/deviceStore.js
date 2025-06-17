import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useDeviceStore = defineStore('device', () => {
    const isServer = ref(false)

    function setIsServer(value) {
        isServer.value = value
    }

    function $reset() {
        isServer.value = false
    }

    return {
        isServer,
        setIsServer,
        $reset
    }
})
