import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import 'vant/lib/index.css'
import './styles/variables.css'
import { initializeAuth } from './router/guards'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

// 在挂载之前从 localStorage 初始化认证状态
// 这确保用户数据立即可用
initializeAuth()

app.use(router)
app.mount('#app')
