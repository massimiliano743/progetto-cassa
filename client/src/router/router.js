import { createRouter, createWebHashHistory } from 'vue-router'
import HomePage from "@/views/HomePage.vue";
import MainPage from "@/views/MainPage.vue";
import SettingProduct from "@/views/SettingProduct.vue";
import SettingCategorie from "@/views/SettingCategorie.vue";
import SettingEconomics from "@/views/SettingEconomics.vue";
import PayDesk from "@/views/PayDesk.vue";
import SelectDb from "@/views/SelectDb.vue";
import SettingReceipt from "@/views/SettingReceipt.vue";

const routes = [
    {path: '/', name: 'Home', component: HomePage},
    {path: '/db', name: 'SelectDb', component: SelectDb},
    {path: '/main/', name: 'MainPage', component: MainPage},
    {path: '/setting-receipt/', name: 'SettingReceipt', component: SettingReceipt},
    {path: '/setting-product/', name: 'SettingProduct', component: SettingProduct},
    {path: '/setting-categorie/', name: 'SettingCategorie', component: SettingCategorie},
    {path: '/setting-economic/', name: 'SettingEconomics', component: SettingEconomics},
    {path: '/use-pay-desk/', name: 'PayDesk', component: PayDesk}
]

const router = createRouter({
    history: createWebHashHistory(),
    routes
})

export default router
