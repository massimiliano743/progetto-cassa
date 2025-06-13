<script setup>
const { type } = defineProps({
    type: {
        type: String,
        required: true,
    }
});
</script>

<template>
    <div class="mainpage">
        <div class="title">
            <div class="title-text">Scegli cosa fare</div>
        </div>
        <div class="button-disposition">
            <div v-if="type == 'master'" class="prodotto">
                <router-link :to="{name: 'SettingProduct'}" class="single-button">
                    <button class="product">Settings product</button>
                </router-link>

            </div>
            <div v-if="type == 'master'" class="saldo">
                <router-link :to="{name: 'SettingEconomics'}" class="single-button">
                    <button class="button-mobile-device">Economic setting</button>
                </router-link>
            </div>
            <div class="usa-cassa">
                <router-link :to="{name: 'PayDesk'}" class="single-button">
                    <button class="button-mobile-device">Use cassa</button>
                </router-link>
            </div>
        </div>
    </div>
</template>

<style scoped>
.mainpage{
    display: flex;
    flex-direction: column;
    gap: 50px;
    .button-disposition{
        display: flex;
        flex-direction: row;
        gap: 100px;
        button{
            width: 200px;
            height: 200px;
            border-radius: 10px;
            font-size: 20px;
            font-weight: bold;
            color: white;
            background-color: #42b883;
            border: none;
            cursor: pointer;
            transition: background-color 0.3s ease;

            &:hover {
                background-color: #35495e;
            }
        }
    }
}
</style>
