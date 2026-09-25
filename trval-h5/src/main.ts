import { createApp } from 'vue'
import { Lazyload } from 'vant'
import 'vant/lib/index.css'
import 'vant/lib/lazyload/style'
import './styles/tokens.css'
import App from './App.vue'
import router from './router'
import pinia from './stores'

const app = createApp(App)
app.use(pinia)
app.use(router)
app.use(Lazyload)
app.mount('#app')
