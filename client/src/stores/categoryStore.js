import { defineStore } from 'pinia'
import { createSocket, getSocketSync } from '@/socket'

const socket = await getSocketSync()


export const useCategoryStore = defineStore('categoryStore', {
    state: () => ({
        category: []
    }),
    actions: {
        async loadCategory() {
            const socket = getSocketSync() || await createSocket();
            socket.emit('get-category', (category) => {
                this.category = category
            })
        },
        async addCategory({ name, color, enable }) {
            const socket = getSocketSync() || await createSocket();
            socket.emit('add-category', { name, color, enable}, (nuovoCategory) => {
                this.loadCategory();
            })
        },
        async updateCategory(category) {
            const socket = getSocketSync() || await createSocket();
            socket.emit('update-category', category, () => {
                this.loadCategory()
            })
        },
        async removeCategory(id) {
            const socket = getSocketSync() || await createSocket();
            socket.emit('remove-category', id, () => {
                this.loadCategory()
            })
        },
        async clearTableCategories() {
            const socket = getSocketSync() || await createSocket();
            socket.emit('clear-categories', () => {
                this.loadCategory();
            })
        },
        initSocketListeners() {
            const socket = getSocketSync();
            if (!socket) return;
            socket.off('category-list');
            socket.on('category-list', (category) => {
                this.category = category
            })
        }
    }
})
