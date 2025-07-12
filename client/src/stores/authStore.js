import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || null);
  const isAuthenticated = ref(!!token.value);

  function login(newToken) {
    token.value = newToken;
    isAuthenticated.value = true;
    localStorage.setItem('token', newToken);
  }

  function logout() {
    token.value = null;
    isAuthenticated.value = false;
    localStorage.removeItem('token');
  }

  // All'avvio, controlla se c'è già un token
  function checkAuth() {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      token.value = savedToken;
      isAuthenticated.value = true;
    } else {
      token.value = null;
      isAuthenticated.value = false;
    }
  }

  return { token, isAuthenticated, login, logout, checkAuth };
});

