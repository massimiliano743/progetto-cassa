<script setup>
import { computed } from "vue";

defineProps({
  prodottoNome: String,
  prezzo: Number,
  quantita: Number,
  tipologia: String,
    colore: String
});
const emit = defineEmits(['addToScontrino'])

function addToScontrino(prodotto) {
    emit('addToScontrino', prodotto);
    emit('decrementaQuantita', prodotto.nome);
}
</script>

<template>
    <div class="prodotto-pagina-cassa"
         :class="tipologia"
         :style="{ backgroundColor: colore }"
         @click="addToScontrino({ nome: prodottoNome, prezzo, quantita })">
        <div class="nome-prodotto">
            {{ prodottoNome }}
        </div>
        <div class="disposizione-prezzo-quantita">
            <div class="prezzo-prodotto">{{ prezzo }}€</div>
            <div class="quantita-prodotto">{{ quantita }}</div>
        </div>
    </div>
</template>

<style scoped>
.prodotto-pagina-cassa{
    width: auto;
    min-width: 150px;
    min-height: 110px;
    display: flex;
    flex-direction: column;
    border-radius: 20px;
    padding: 10px;
    align-items: center;
    justify-content: space-between;
    .nome-prodotto{
        text-transform: uppercase;
        font-size: 1.3rem;
        font-weight: bold;
    }
    .disposizione-prezzo-quantita{
        display: flex;
        width: 100%;
        justify-content: space-between;
        padding: 0 10px;
        align-items: flex-end;
        .prezzo-prodotto{
            font-size: 2rem;
            font-weight: bold;
        }
        .quantita-prodotto{

        }
    }

}

</style>
