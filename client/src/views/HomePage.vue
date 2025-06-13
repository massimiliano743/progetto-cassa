<script setup>

</script>

<template>
    <div class="use-destination">
        <div class="title">
            <div class="title-text">Scegli il ruolo del dispositivo</div>
        </div>
        <div class="button-disposition">
            <div class="master">
                <router-link :to="{name: 'MainPage',params: {type: 'master'}}" class="single-button">
                    <button class="master-device">Master</button>
                </router-link>

            </div>
            <div class="mobile-device">

                <router-link :to="{name: 'MainPage',params: {type: 'secondDevice'}}" class="single-button">
                    <button class="button-mobile-device">Second device</button>
                </router-link>
            </div>
        </div>
    </div>
</template>

<style scoped>
.use-destination{
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
