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
    const lastReceiptResponse = await fetch(`http://${urlServer}:3000/ultimoScontrino`);
    if (lastReceiptResponse.ok) {
        const lastReceipt = await lastReceiptResponse.json();
        console.log("Ultimo scontrino:", lastReceipt);
        return lastReceipt;
    } else {
        console.error("Errore nel recupero dell'ultimo scontrino");
        return null;
    }
}
export async function allOrder() {
    const allOrders = await fetch(`http://${urlServer}:3000/recapScontrini`);
    if (allOrders.ok) {
        const order = await allOrders.json();
        console.log("allOrders:", order);
        return order;
    } else {
        console.error("Errore nel recupero ordini");
        return null;
    }
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
export async function recapSellProduct(){
    const recapOrder = await fetch(`http://${urlServer}:3000/analisi-prodotti`);
    if (recapOrder.ok) {
        const order = await recapOrder.json();
        console.log("allOrders:", order);
        return order;
    } else {
        console.error("Errore nel recupero ordini");
        return null;
    }
}
