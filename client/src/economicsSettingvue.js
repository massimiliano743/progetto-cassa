import {ref} from "vue";
import {createSocket, getSocketSync} from "@/socket.js";

const urlServer = window.location.hostname;
export const rigaAttiva = ref(null)

export function toggleRiga(id) {
    rigaAttiva.value = rigaAttiva.value === id ? null : id
}

export function formatDate(timestamp) {
    const date = new Date(Number(timestamp))
    return date.toLocaleString()
}

export function initMenuToggle() {
    const elementi = document.querySelectorAll(".barra-orzzontale .elemento-singolo");
    const contenuti = document.querySelectorAll(".contenuto");

    elementi.forEach((elemento) => {
        elemento.addEventListener("click", function () {
            // Cambia classe 'active' nella barra
            elementi.forEach(el => el.classList.remove("active"));
            this.classList.add("active");

            // Nasconde tutti i contenuti
            contenuti.forEach(c => {
                c.classList.remove("visible");
                c.classList.add("hidden");
            });

            // Mostra il contenuto collegato
            const targetId = this.getAttribute("data-target");
            const target = document.getElementById(targetId);
            if (target) {
                target.classList.remove("hidden");
                target.classList.add("visible");
            }
        });
    });
}

export async function ultimoScontrino() {
    const socket = getSocketSync() || await createSocket();
    return new Promise((resolve, reject) => {
        socket.emit('ultimoScontrino', (res) => {
            if (!res || res.error) {
                console.error("Errore nel recupero dell'ultimo scontrino", res?.error);
                return reject(res?.error || 'Errore sconosciuto');
            }
            resolve(res);
        });
    });
}

export async function allOrder() {
    const socket = getSocketSync() || await createSocket();
    return new Promise((resolve, reject) => {
        socket.emit('recapScontrini', (res) => {
            if (!res || res.error) {
                return reject(res?.error || 'Errore sconosciuto');
            }
            resolve(res);
        });
    });
}

export async function removeOrder(uuid) {
    const socket = getSocketSync() || await createSocket();

    return new Promise((resolve, reject) => {
        socket.emit('remove-order', uuid, async (res) => {
            if (!res || res.success === false) {
                const errorMsg = res?.error || 'Errore sconosciuto nella rimozione ordine';
                alert(`⚠️ Errore: ${errorMsg}`);
                return reject(errorMsg);
            }
            const updatedOrders = await allOrder();
            resolve(updatedOrders.orders);
        });
    });
}

export async function recapSellProduct(start, end){
    const socket = getSocketSync() || await createSocket();
    return new Promise((resolve, reject) => {
        socket.emit('analisi-prodotti', { start, end }, (res) => {
            if (!res || res.error) {
                console.error("Errore nel recupero ordini", res?.error);
                return reject(res?.error || 'Errore sconosciuto');
            }
            resolve(res);
        });
    });
}
