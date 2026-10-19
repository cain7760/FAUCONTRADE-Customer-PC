import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '../../theme-tokens.css'
import './theme.css'
import './variants.css'
import './trader-center.css'
import './trs-order-management.css'
import './trs-order-management-overrides.css'
import '../../semantic-colors.css'
import ExceptionEntry from '../../components/ExceptionEntry.vue'

createApp(ExceptionEntry).use(ElementPlus).mount('#app')
