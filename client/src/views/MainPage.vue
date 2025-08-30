<script setup>
import { useDeviceStore } from '@/deviceStore'

const deviceStore = useDeviceStore()
</script>

<template>
    <div class="mainpage">
        <div class="title">
            <div class="title-text">Scegli cosa fare</div>
        </div>
        <div class="button-disposition">
            <div v-if="deviceStore.isServer" class="prodotto">
                <router-link :to="{name: 'SettingProduct'}" class="single-button">
                    <button class="product">Impostazione Prodotti</button>
                </router-link>
            </div>
            <div v-if="deviceStore.isServer" class="prodotto">
                <router-link :to="{name: 'SettingCategorie'}" class="single-button">
                    <button class="product">Impostazione Categorie</button>
                </router-link>
            </div>
            <div v-if="deviceStore.isServer" class="saldo">
                <router-link :to="{name: 'SettingEconomics'}" class="single-button">
                    <button class="button-mobile-device">Sezione Economica</button>
                </router-link>
            </div>
            <div class="usa-cassa">
                <router-link :to="{name: 'PayDesk'}" class="single-button">
                    <button class="button-mobile-device">Utilizzo Cassa</button>
                </router-link>
            </div>
        </div>
    </div>
</template>

<style scoped>
.mainpage{
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 50px;
    max-width: 1280px;
    margin: 100px auto;
    .title-text{
        font-size: 20px;
        font-weight: bold;
    }
    .button-disposition{
        display: flex;
        flex-direction: row;
        justify-content: center;
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

