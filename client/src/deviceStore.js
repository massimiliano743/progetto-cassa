import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useDeviceStore = defineStore('device', () => {
    function safeParse(item, fallback) {
        try {
            return JSON.parse(item)
        } catch {
            return fallback
        }
    }
    const isServer = ref(safeParse(localStorage.getItem('isServer'), false))
    const dbName = ref(safeParse(localStorage.getItem('dbName'), ''))
    function setIsServer(value) {
        isServer.value = value
        localStorage.setItem('isServer', JSON.stringify(value))
    }
    function databaseName(value){
        dbName.value = value;
        localStorage.setItem('dbName', JSON.stringify(value))

    }

    function $reset() {
        isServer.value = false
        dbName.value = '';
        localStorage.setItem('isServer', 'false')
        localStorage.setItem('dbName', '')
    }

    return {
        isServer,
        setIsServer,
        dbName,
        databaseName,
        $reset
    }
})
