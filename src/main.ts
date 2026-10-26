import { createApp } from 'vue'
import './style.css'
import './styles/controlSizing.css'
import App from './App.vue'
import vuetify from './plugins/vuetify'
import router from './router'

createApp(App).use(vuetify).use(router).mount('#app')
