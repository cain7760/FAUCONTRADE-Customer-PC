import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import '../../theme-tokens.css'
import '../equity/theme.css'
import LoginPage from './LoginPage.vue'

createApp(LoginPage).use(ElementPlus, { locale: zhCn }).mount('#app')
