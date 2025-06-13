import { createRouter, createWebHistory } from 'vue-router'
import HomePage from "@/views/HomePage.vue";
import MainPage from "@/views/MainPage.vue";
import SettingProduct from "@/views/SettingProduct.vue";
import SettingEconomics from "@/views/SettingEconomics.vue";
import PayDesk from "@/views/PayDesk.vue";

const routes = [
    {path: '/', name: 'Home', component: HomePage},
    {path: '/main/:type', name: 'MainPage', component: MainPage, props: true},
    {path: '/setting-product/', name: 'SettingProduct', component: SettingProduct},
    {path: '/setting-economic/', name: 'SettingEconomics', component: SettingEconomics},
    {path: '/use-pay-desk/', name: 'PayDesk', component: PayDesk}
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router
