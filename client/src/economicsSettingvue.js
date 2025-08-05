const urlServer = window.location.hostname;

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
    const lastReceiptResponse = await fetch(`http://${urlServer}:3000/fecthEconomicsData`);
    if (lastReceiptResponse.ok) {
        const lastReceipt = await lastReceiptResponse.json();
        console.log("Ultimo scontrino:", lastReceipt);
        return lastReceipt;
    } else {
        console.error("Errore nel recupero dell'ultimo scontrino");
        return null;
    }
}

