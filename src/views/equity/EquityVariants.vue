<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowDownBold, ArrowLeft, ArrowRight, Bell, Briefcase, CaretBottom, ChatDotRound, Clock, Collection, Connection, Document, Search, Setting, InfoFilled, View, Hide, CircleCheck, CircleClose, Close, EditPen, List, More, Tickets } from '@element-plus/icons-vue'
import ClientLineIcon from '../../ClientLineIcon.vue'
import SettingsMenuIcon from '../../SettingsMenuIcon.vue'
import { accounts } from './fixtures'
import { marketInstruments, variantRows, variants, money, number, price as formatPrice } from './variantData'
import { columnOptionsFor } from './tableFieldDefinitions'
import { useTicketDock } from './useTicketDock'
import { useDialogShortcuts } from '../../composables/useDialogShortcuts'
import BaseDialog from '../../components/BaseDialog.vue'
import OrderTicket from './components/OrderTicket.vue'
import OrderBook from './components/OrderBook.vue'
import ClosePositionDialog from './components/ClosePositionDialog.vue'
import ChaseOrderDialog from './components/ChaseOrderDialog.vue'
import AmendOrderDialog from './components/AmendOrderDialog.vue'
import OrderHistoryDialog from './components/OrderHistoryDialog.vue'
import SortHeader from './components/SortHeader.vue'
import ColumnConfigPopover from './components/ColumnConfigPopover.vue'
import TradingTable from './components/TradingTable.vue'

const initialVariant = new URLSearchParams(location.search).get('layout')
const assetUrl = name => `${import.meta.env.BASE_URL}original-icons/${name}`
const variant = ref(variants.some(v => v.id === initialVariant) ? initialVariant : 'classic')
const activeNav = ref('权益交易')
const viewportWidth = ref(window.innerWidth)
const messageCenterVisible = ref(false)
const messageCategory = ref('全部')
const expandedMessageIds = ref([])
const headerNoticeKey = 'faucon-header-notice-dismissed-v2'
// 待第三方帮助中心地址确定后，在环境变量中配置 VITE_HELP_CENTER_URL。
const helpCenterUrl = import.meta.env.VITE_HELP_CENTER_URL?.trim() || ''
const showHeaderNotice = ref(true)
const systemNoticeEnabled = ref(true)
const showUnreadBadge = ref(true)
const settingsVisible = ref(false)
const settingsDetail = ref(null)
const passwordForm = ref({ verificationCode: '', password: '', passwordConfirmation: '' })
const passwordFormError = ref('')
const passwordFieldErrors = ref({ password: '', passwordConfirmation: '' })
const passwordVerificationSent = ref(false)
const passwordVerificationCountdown = ref(0)
const passwordVerificationEmail = ref('')
let passwordVerificationTimer = null
const activeSetting = ref('account')
const language = ref('简体中文')
const orderPrice = ref('最新价')
const colorRule = ref('red-up')
const theme = ref('dark')
const autoLaunch = ref(false)
const emergencyMessage = ref(null)
const systemRunning = ref(true)
const transactionToasts = ref([])
const transactionToastTimers = new Map()
const headerNotice = computed(() => systemRunning.value ? null : {
  id: 'system-interrupted', text: '交易系统当前中断，下单服务暂不可用；已提交订单请以订单状态为准。',
})
const messages = ref([
  { id: 1, category: '通知', title: '系统例行维护通知', content: '交易系统将于 9 月 14 日 02:00—04:00 进行例行维护。维护期间，订单查询、资金查询及部分行情服务可能出现短暂延迟，请提前安排交易并关注后续系统通知。若您有未完成的订单，请在维护窗口开始前确认其状态；维护结束后系统会自动恢复服务，无需重复提交。', time: '今天 10:20', unread: true },
  { id: 2, category: '待办', title: '请完成适当性评估更新', content: '您的专业投资者适当性资料将在 30 天后到期，请在到期前完成更新，以免影响相关交易权限的正常使用。', time: '今天 09:15', unread: true },
  { id: 3, category: '消息', title: '订单已全部成交', content: '平安银行（000001）买入订单已全部成交，成交均价 11.78 CNY。', time: '昨天 14:38', unread: true, trade: { name: '平安银行', code: '000001', status: '全部成交', quantity: 900, quantityLabel: '成交数量', price: 11.78, occurredAt: '2026-09-13 14:38:26' } },
  { id: 4, category: '通知', title: '账户资金划转完成', content: '资金划转申请已处理完成，到账金额 100,000.00 CNY。', time: '昨天 11:06', unread: false },
  { id: 5, category: '待办', title: '风险测评即将到期', content: '您的风险承受能力测评将在 2026 年 10 月 8 日到期。', time: '09-09 16:30', unread: false },
  { id: 6, category: '消息', title: '撤单申请已受理', content: '招商银行（600036）撤单申请已提交，当前状态：待撤。', time: '09-08 13:46', unread: false },
])
const messageCategories = ['全部', '通知', '消息', '待办']
const settingMenu = [
  { key: 'account', label: '账号信息' }, { key: 'language', label: '语言设置' },
  { key: 'trading', label: '交易与行情设置' }, { key: 'appearance', label: '系统外观' },
]
const filteredMessages = computed(() => messageCategory.value === '全部' ? messages.value : messages.value.filter(item => item.category === messageCategory.value))
const unreadMessageCount = computed(() => messages.value.filter(item => item.unread).length)
const pricePreviewClass = computed(() => colorRule.value === 'green-up' ? 'reverse' : '')
function categoryUnreadCount(category) { return messages.value.filter(item => item.unread && (category === '全部' || item.category === category)).length }
function messageIcon(category) { return assetUrl({ '全部': 'message-all.svg', '通知': 'message-notice.svg', '消息': 'message-system.svg', '待办': 'message-todo.svg' }[category]) }
function needsExpansion(message) { return message.content.length > 100 }
function messageIsExpanded(message) { return expandedMessageIds.value.includes(message.id) }
// 直接复用 Axure 导出的原始 SVG 图层；一个菜单图标由一个或两个图层组成。
const mainNav = [
  { label: '权益交易', icon: [['u76.svg', 0, 0, 14, 9], ['u77.svg', 0, 4, 14, 10]] },
  { label: '期权交易', icon: [['u83.svg', 0, 0, 13, 14], ['u84.svg', 7, 8, 6, 6]] },
  { label: '融资申请', icon: [['u90.svg', 2, 0, 10, 8], ['u91.svg', 0, 9, 14, 5]] },
  { label: '策略交易', hidden: true, icon: [['u100.svg', 0, 0, 12, 12], ['u101.svg', 3, 11, 7, 5]] },
  { label: '交易员中心', icon: [['u100.svg', 0, 0, 12, 12], ['u101.svg', 3, 11, 7, 5]] },
  { label: '数据', icon: [['u114.svg', 0, 0, 12, 13], ['u115.svg', 7, 6, 8, 8]] },
]
const availableNav = computed(() => mainNav.filter(item => !item.hidden))
const overflowNav = computed(() => viewportWidth.value <= 980 ? availableNav.value.slice(3) : viewportWidth.value <= 1200 ? availableNav.value.slice(4) : [])
const visibleNav = computed(() => availableNav.value.slice(0, availableNav.value.length - overflowNav.value.length))
const traderPrimaryMenu = [
  { key: 'options', label: '期权', title: '期权交易', icon: List, children: [{ label: '期权交易', icon: Tickets }, { label: '期权簿记', icon: Collection }, { label: '持仓管理', icon: Briefcase }, { label: '生命周期', icon: Clock }] },
  { key: 'swap', label: 'TRS', title: '收益互换', icon: Connection, children: [{ label: '订单管理', icon: Document }, { label: '我的HT订单', icon: Collection }] },
]
const activeTraderPrimary = ref('options')
const activeTraderSecondary = ref('期权交易')
const traderSecondaryCollapsed = ref(false)
const activeTraderGroup = computed(() => traderPrimaryMenu.find(item => item.key === activeTraderPrimary.value) || traderPrimaryMenu[0])
function selectTraderPrimary(key) {
  const group = traderPrimaryMenu.find(item => item.key === key)
  if (!group) return
  activeTraderPrimary.value = key
  activeTraderSecondary.value = group.children[0].label
}
const allAccountsValue = '__ALL_ACCOUNTS__'
const workspace = ref(null), accountId = ref('TZS_T0'), selectedAccountIds = ref(['TZS_T0']), previousAccountSelection = ref(['TZS_T0']), query = ref(''), market = ref('ALL'), positionType = ref('ALL')
const globalAccountSearch = ref('')
const assetsVisible = ref(true), assetsCollapsed = ref(false)
const tab = ref('positions'), selectedCode = ref('000001'), table = ref(null), quote = ref(null), ticketResetKey = ref(0)
const ticketContext = ref(null)
const closePositionVisible = ref(false), closingPosition = ref(null)
const chaseOrderVisible = ref(false), chasingPosition = ref(null), chasingOrder = ref(null), chasingAccountId = ref(null)
const amendOrderVisible = ref(false), amendingOrder = ref(null)
const cancelOrderVisible = ref(false), cancelingOrder = ref(null)
const convertManualVisible = ref(false), convertingManualOrder = ref(null)
const conversionRemark = ref('')
const historyVisible = ref(false), historyRecord = ref(null)
const exportDialogVisible = ref(false)
const exportTarget = ref('positions')
const exportDateRange = ref([])
const orderStatusMachine = ['已撤', '暂停', '完成', '部成', '已报', '待报', '改单中', '异常', '拒绝', '其他']
const orderStatusOptions = orderStatusMachine.map(status => ({ label: status, value: status }))
const demoOrderStatuses = [...orderStatusMachine, '暂停', '已报', '待报', '完成', '异常', '其他']
const demoOrders = ref(demoOrderStatuses.map((status, index) => {
  const instrument = variantRows[index % variantRows.length]
  const quantity = (index + 1) * 100
  const filledQuantity = status === '完成' ? quantity : status === '部成' ? Math.max(100, Math.floor(quantity / 2 / 100) * 100) : 0
  const price = index % 3 === 1 ? null : instrument.price
  const estimate = (price || instrument.price) * quantity
  // 保留一条异常系统单供“转手工单”操作，后续异常样本仍为手工单以覆盖无转换入口的场景。
  const executionType = status === '拒绝' || (status === '异常' && index !== orderStatusMachine.indexOf('异常')) || (status !== '异常' && index % 4 === 3) ? 'highTouch' : 'lowTouch'
  return {
    id: `seed-${index + 1}`, orderNo: `WT20260911${String(index + 1).padStart(3, '0')}`,
    account: index < orderStatusMachine.length || index % 3 !== 1 ? 'TZS_T0' : 'TZS_T1', code: instrument.code, name: instrument.name, executionType, type: price === null ? 'market' : 'limit',
    orderType: executionType === 'highTouch' ? '手工单' : '系统单', algorithm: index % 3 === 0 ? 'POV' : 'DMA',
    orderRemark: executionType === 'highTouch' ? ['请按委托价格优先处理', '客户指定分批执行', '请关注盘中流动性'][index % 3] : '',
    traderRemark: status === '拒绝' ? '拒绝原因：委托价格偏离当前市场价格，暂不具备执行条件。' : executionType === 'highTouch' ? ['已受理，正在处理', '建议分批成交', '已反馈可执行价格'][index % 3] : '',
    side: index % 2 ? 'sell' : 'buy', openClose: index % 3 ? '平' : '开', status,
    attribute: `${price === null ? '市价' : '限价'}·数量`, quantity, price,
    orderValueNumber: quantity, orderValue: `${number(quantity)} 股`, filledQuantity,
    reportQuantity: status === '完成' ? 0 : Math.max(0, quantity - filledQuantity),
    filledPrice: filledQuantity ? instrument.price : null, estimate,
    canceledQuantity: status === '已撤' ? quantity - filledQuantity : 0,
    frozenMargin: ['已撤', '暂停', '完成', '异常', '拒绝', '其他'].includes(status) ? 0 : estimate * .4,
    marginRate: 40, feedback: status === '异常' ? '风控校验未通过' : status === '拒绝' ? '交易员已拒绝该手工单' : '',
    market: instrument.market, orderTime: `2026-09-11 09:${String(30 + index).padStart(2, '0')}:00`,
  }
}))
const positionOrderType = ref('ALL')
const orderFilters = ref({ orderNo: '', symbol: '', side: 'ALL', openClose: 'ALL', orderType: 'ALL', status: [] })
const appliedPositionFilters = ref({ query: '', market: 'ALL', positionType: 'ALL', orderType: 'ALL' })
const appliedOrderFilters = ref({ orderNo: '', symbol: '', side: 'ALL', openClose: 'ALL', orderType: 'ALL', status: [] })
const tradeFilters = ref({ symbol: '', side: 'ALL', openClose: 'ALL', orderType: 'ALL' })
const appliedTradeFilters = ref({ symbol: '', side: 'ALL', openClose: 'ALL', orderType: 'ALL' })
const sortState = ref({ prop: null, direction: null })
const orderSortState = ref({ prop: null, direction: null })
const positionColumnDefaults = columnOptionsFor('positions').map(([id]) => id)
const visibleColumnKeys = ref([...positionColumnDefaults])
const columnOptions = columnOptionsFor('positions')
const orderColumnDefaults = columnOptionsFor('orders').map(([id]) => id)
const orderVisibleColumnKeys = ref([...orderColumnDefaults])
const orderColumnOptions = columnOptionsFor('orders')
const tradeColumnDefaults = columnOptionsFor('trades').map(([id]) => id)
const tradeVisibleColumnKeys = ref([...tradeColumnDefaults])
const tradeColumnOptions = columnOptionsFor('trades')
const { dock, collapsed, dragging, resizing, floating, start, startResize } = useTicketDock(workspace)
dock.value = variants.find(v => v.id === variant.value).dock
const account = computed(() => accounts.find(a => a.id === accountId.value))
const passwordEmail = computed(() => account.value?.email || '')
const chasingAccount = computed(() => accounts.find(item => item.id === chasingAccountId.value) || account.value)
const amendingAccount = computed(() => accounts.find(item => item.id === amendingOrder.value?.account) || account.value)
const amendingSymbol = computed(() => {
  const order = amendingOrder.value
  if (!order) return null
  const instrument = marketInstruments.find(item => item.code === order.code)
  return { ...instrument, ...order, price: order.price ?? instrument?.price ?? 0, cost: instrument?.cost ?? order.price ?? 0, change: instrument?.change ?? 0, qty: order.quantity, available: Math.max(0, order.quantity - (order.filledQuantity || 0)) }
})
const effectiveAccountIds = computed(() => selectedAccountIds.value.includes(allAccountsValue) ? accounts.map(item => item.id) : selectedAccountIds.value)
const filteredGlobalAccounts = computed(() => {
  const keyword = globalAccountSearch.value.trim().toLowerCase()
  return keyword ? accounts.filter(item => accountLabel(item.id).toLowerCase().includes(keyword)) : accounts
})
const instruments = computed(() => variantRows.map(p => accountId.value === 'TZS_T0' ? p : { ...p, id: p.id.replace('T0','T1'), qty: p.qty*2, available: p.available*2, value: p.value*2, account:'TZS_T1' }))
const emptySelected = { code: '', market: '', name: '请选择下单标的', price: null, cost: null, change: 0, available: 0 }
const selected = computed(() => instruments.value.find(p => p.code === selectedCode.value) || marketInstruments.find(p => p.code === selectedCode.value) || emptySelected)
const allPositionRows = computed(() => [...variantRows, ...variantRows.map(p => ({ ...p, id: p.id.replace('T0', 'T1'), qty: p.qty * 2, available: p.available * 2, value: p.value * 2, account: 'TZS_T1' }))])
const allRows = computed(() => allPositionRows.value.filter(row => effectiveAccountIds.value.includes(row.account)))
const filtered = computed(() => allRows.value.filter(p => (!appliedPositionFilters.value.query || `${p.code}${p.name}`.includes(appliedPositionFilters.value.query.trim())) && (appliedPositionFilters.value.market === 'ALL' || p.market === appliedPositionFilters.value.market) && (appliedPositionFilters.value.positionType === 'ALL' || p.direction === appliedPositionFilters.value.positionType) && (appliedPositionFilters.value.orderType === 'ALL' || p.orderType === appliedPositionFilters.value.orderType)))
const sortedRows = computed(() => {
  const { prop, direction } = sortState.value
  if (!prop || !direction) return filtered.value
  const multiplier = direction === 'ascending' ? 1 : -1
  return [...filtered.value].sort((a, b) => {
    const left = a[prop], right = b[prop]
    if (typeof left === 'string') return left.localeCompare(right, 'zh-CN') * multiplier
    return (left - right) * multiplier
  })
})
const orders = computed(() => demoOrders.value.filter(o => effectiveAccountIds.value.includes(o.account) && (!appliedOrderFilters.value.orderNo || o.orderNo.includes(appliedOrderFilters.value.orderNo.trim())) && (!appliedOrderFilters.value.symbol || `${o.code}${o.name}`.includes(appliedOrderFilters.value.symbol.trim())) && (appliedOrderFilters.value.side === 'ALL' || o.side === appliedOrderFilters.value.side) && (appliedOrderFilters.value.openClose === 'ALL' || o.openClose === appliedOrderFilters.value.openClose) && (appliedOrderFilters.value.orderType === 'ALL' || o.orderType === appliedOrderFilters.value.orderType) && (!appliedOrderFilters.value.status.length || appliedOrderFilters.value.status.includes(o.status))))
const sortedOrders = computed(() => {
  const { prop, direction } = orderSortState.value
  const exceptionRank = row => row.status === '异常' ? (row.orderType === '系统单' ? 0 : 1) : 2
  const exceptionFirst = (a, b) => exceptionRank(a) - exceptionRank(b)
  if (!prop || !direction) return [...orders.value].sort(exceptionFirst)
  const multiplier = direction === 'ascending' ? 1 : -1
  return [...orders.value].sort((a, b) => exceptionFirst(a, b) || (orderSortValue(a, prop) - orderSortValue(b, prop)) * multiplier)
})
const trades = computed(() => demoOrders.value
  .map((order, index) => ({
    ...order,
    id: `${order.id}-trade`,
    filledAmount: order.filledQuantity * order.filledPrice,
    filledTime: `${order.orderTime.slice(0, 10)} 10:${String(12 + index).padStart(2, '0')}:${String(18 + index).padStart(2, '0')}`,
    tradeNo: `CJ${order.orderNo.slice(2)}`,
    entrustNo: `${order.orderNo}-01`,
    tradeDate: order.orderTime.slice(0, 10).replaceAll('-', ''),
  }))
  .filter(trade => effectiveAccountIds.value.includes(trade.account)
    && trade.filledQuantity > 0 && trade.filledPrice !== null
    && (!appliedTradeFilters.value.symbol || `${trade.code}${trade.name}`.includes(appliedTradeFilters.value.symbol.trim()))
    && (appliedTradeFilters.value.side === 'ALL' || trade.side === appliedTradeFilters.value.side)
    && (appliedTradeFilters.value.openClose === 'ALL' || trade.openClose === appliedTradeFilters.value.openClose)
    && (appliedTradeFilters.value.orderType === 'ALL' || trade.orderType === appliedTradeFilters.value.orderType)))
const floatStyle = computed(() => dock.value === 'floating' ? { left: `${floating.value.x}px`, top: `${floating.value.y}px`, width:`${floating.value.width}px`, height:`${floating.value.height}px` } : {})
const exportTargetLabel = computed(() => ({ positions: '持仓', orders: '订单', trades: '成交' }[exportTarget.value] || '数据'))
function chooseVariant(id) { variant.value = id; dock.value = variants.find(v => v.id === id).dock; collapsed.value = false; history.replaceState(null,'',`${location.pathname}?layout=${id}`) }
function openMessageCenter() { messageCenterVisible.value = true }
function openHelpCenter() {
  if (helpCenterUrl) window.open(helpCenterUrl, '_blank', 'noopener,noreferrer')
}
function markMessageRead(message) { message.unread = false }
function markAllMessagesRead() { messages.value.forEach(message => { message.unread = false }) }
function toggleMessageExpansion(message) {
  expandedMessageIds.value = messageIsExpanded(message)
    ? expandedMessageIds.value.filter(id => id !== message.id)
    : [...expandedMessageIds.value, message.id]
}
function dismissHeaderNotice() {
  showHeaderNotice.value = false
  localStorage.setItem(headerNoticeKey, '1')
}
function toggleSystemStatus() {
  systemRunning.value = !systemRunning.value
  if (!systemRunning.value) { showHeaderNotice.value = true; selectedCode.value = null; quote.value = null }
}
function scrollToSetting(key) {
  activeSetting.value = key
  document.getElementById(`equity-${key}-setting`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function saveSettings() { settingsDetail.value = null; settingsVisible.value = false }
function closeSettings() { clearPasswordVerificationTimer(); settingsDetail.value = null; settingsVisible.value = false }
function clearPasswordVerificationTimer() {
  if (passwordVerificationTimer) window.clearInterval(passwordVerificationTimer)
  passwordVerificationTimer = null
}
function openPasswordDialog() {
  clearPasswordVerificationTimer()
  passwordForm.value = { verificationCode: '', password: '', passwordConfirmation: '' }
  passwordFormError.value = ''
  passwordFieldErrors.value = { password: '', passwordConfirmation: '' }
  passwordVerificationSent.value = false
  passwordVerificationCountdown.value = 0
  passwordVerificationEmail.value = ''
  settingsDetail.value = 'password'
}
function closePasswordDialog() {
  clearPasswordVerificationTimer()
  settingsDetail.value = null
}
const passwordRule = /^(?=.*[A-Za-z])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~])[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]{8,}$/
function validateNewPassword(force = false) {
  const password = passwordForm.value.password
  passwordFieldErrors.value.password = (!password && !force) || passwordRule.test(password)
    ? ''
    : '密码须包含英文字母与特殊符号，且长度不少于 8 位。'
  if (passwordForm.value.passwordConfirmation) validatePasswordConfirmation()
  return !passwordFieldErrors.value.password
}
function validatePasswordConfirmation(force = false) {
  const { password, passwordConfirmation } = passwordForm.value
  passwordFieldErrors.value.passwordConfirmation = (!passwordConfirmation && !force) || password === passwordConfirmation
    ? ''
    : '两次输入的密码不一致，请重新确认。'
  return !passwordFieldErrors.value.passwordConfirmation
}
function sendPasswordVerificationCode() {
  const email = passwordEmail.value
  if (!email) {
    passwordFormError.value = '开户邮箱不可用，请联系客服。'
    return
  }
  passwordFormError.value = ''
  passwordVerificationSent.value = true
  passwordVerificationEmail.value = email
  passwordVerificationCountdown.value = 60
  clearPasswordVerificationTimer()
  passwordVerificationTimer = window.setInterval(() => {
    passwordVerificationCountdown.value -= 1
    if (passwordVerificationCountdown.value <= 0) {
      passwordVerificationCountdown.value = 0
      passwordVerificationSent.value = false
      clearPasswordVerificationTimer()
    }
  }, 1000)
}
function confirmPasswordChange() {
  const { verificationCode } = passwordForm.value
  const passwordValid = validateNewPassword(true)
  const passwordConfirmationValid = validatePasswordConfirmation(true)
  if (!passwordEmail.value) passwordFormError.value = '开户邮箱不可用，请联系客服。'
  else if (!passwordVerificationSent.value) passwordFormError.value = '请先获取邮箱验证码。'
  else if (passwordVerificationEmail.value !== passwordEmail.value) passwordFormError.value = '开户邮箱已变更，请重新获取验证码。'
  else if (!/^\d{6}$/.test(verificationCode) || verificationCode !== '123456') passwordFormError.value = '邮箱验证码不正确。'
  else if (!passwordValid || !passwordConfirmationValid) passwordFormError.value = ''
  else {
    passwordFormError.value = ''
    closePasswordDialog()
    ElMessage.success('密码已修改。')
  }
}
function showEmergency(message) {
  if (message?.urgent) emergencyMessage.value = message
}
function showTransactionToast(message) {
  if (!message?.trade || transactionToastTimers.has(message.id)) return
  transactionToasts.value = [...transactionToasts.value, { message, remaining: 8 }]
  const countdownTimer = window.setInterval(() => {
    transactionToasts.value = transactionToasts.value.map(toast => toast.message.id === message.id
      ? { ...toast, remaining: Math.max(0, toast.remaining - 1) }
      : toast)
  }, 1000)
  const dismissTimer = window.setTimeout(() => dismissTransactionToast(message.id), 8000)
  transactionToastTimers.set(message.id, { countdownTimer, dismissTimer })
}
function dismissTransactionToast(id) {
  const timers = transactionToastTimers.get(id)
  if (timers) { window.clearInterval(timers.countdownTimer); window.clearTimeout(timers.dismissTimer) }
  transactionToastTimers.delete(id)
  transactionToasts.value = transactionToasts.value.filter(toast => toast.message.id !== id)
}
function timestampNow() {
  const date = new Date(), pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
function enrichOrder(order) {
  const instrument = marketInstruments.find(item => item.code === order.code)
  return {
    ...order,
    status: order.status || '待报', market: order.market || instrument?.market || 'SZ', orderTime: order.orderTime || timestampNow(),
    marginRate: order.marginRate ?? 40, frozenMargin: order.frozenMargin ?? (order.estimate || 0) * .4,
    canceledQuantity: order.canceledQuantity || 0, canceledAmount: order.canceledAmount || 0,
    reportQuantity: order.reportQuantity ?? Math.max(0, (order.quantity || 0) - (order.filledQuantity || 0)), feedback: order.feedback || '',
    orderType: order.orderType || (order.executionType === 'highTouch' ? '手工单' : '系统单'), algorithm: order.algorithm || 'DMA', orderRemark: order.orderRemark || order.note || '', traderRemark: order.traderRemark || '',
  }
}
function accountLabel(id) { const item = accounts.find(value => value.id === id); return item ? `${item.id} - ${item.name}` : id || '--' }
function marketLabel(marketValue) { return marketValue === 'HK' ? '港股' : 'A股' }
function timeLabel(value) { return value ? String(value).slice(-8) : '--' }
function filledAmount(row) {
  const quantity = Number(row.filledQuantity)
  const price = Number(row.filledPrice)
  return Number.isFinite(quantity) && quantity > 0 && Number.isFinite(price) && price > 0 ? money(quantity * price) : '--'
}
function fillProgress(row) {
  const progress = fillProgressValue(row)
  return progress === null ? '--' : `${Math.round(progress * 100)}%`
}
function fillProgressValue(row) {
  const quantity = Number(row.quantity)
  const filledQuantity = Number(row.filledQuantity)
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(filledQuantity)) return null
  return Math.min(1, Math.max(0, filledQuantity / quantity))
}
function orderSortValue(row, prop) {
  if (prop === 'fillProgress') return fillProgressValue(row) ?? -1
  return Number(row[prop]) || 0
}
function canceledOrderValue(row) { return row.canceledAmount ? `${money(row.canceledAmount)} CNY` : row.canceledQuantity ? `${number(row.canceledQuantity)} 股` : '--' }
function exportedOrderAmount(row) {
  if (row.inputAmount !== null && row.inputAmount !== undefined) return money(row.inputAmount)
  if (row.price !== null && row.price !== undefined) return money(row.quantity * row.price)
  return row.estimate ? money(row.estimate) : '--'
}
function exportedCanceledAmount(row) {
  if (row.canceledAmount) return money(row.canceledAmount)
  if (row.canceledQuantity && row.price !== null && row.price !== undefined) return money(row.canceledQuantity * row.price)
  return '--'
}
function tradeStatusLabel(status) {
  if (status.includes('成功') || status.includes('失败')) return status
  if (status.includes('全部成交')) return '全部成交'
  if (status.includes('部分成交') || status.includes('部成')) return '部分成交'
  if (status.includes('撤单')) return '撤单'
  if (status.includes('改单')) return '改单'
  if (status.includes('已报')) return '已报'
  return status.replace(/^(买入|卖出)订单/, '').replace(/^订单已/, '')
}
function tradeStatusVisual(status) {
  const label = tradeStatusLabel(status)
  if (label.includes('成功')) return { tone: 'success', icon: CircleCheck }
  if (label.includes('失败')) return { tone: 'rejected', icon: CircleClose }
  if (label === '全部成交') return { tone: 'success', icon: CircleCheck }
  if (label === '部分成交') return { tone: 'partial', icon: More }
  if (label === '撤单') return { tone: 'rejected', icon: CircleClose }
  if (label === '已报') return { tone: 'reported', icon: CircleCheck }
  return { tone: 'review', icon: EditPen }
}
function publishTransactionMessage({ name, code, status, quantity = null, quantityLabel = '成交数量', price = null, priceLabel = '成交均价', title = '订单状态更新', content = null }) {
  const message = {
    id: `trade-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    category: '消息', title,
    content: content || `${name}（${code}）${status}${price === null ? '。' : `，${priceLabel} ${money(price)} CNY。`}`,
    time: '刚刚', unread: true,
    trade: { name, code, status, quantity, quantityLabel, price, priceLabel, occurredAt: timestampNow() },
  }
  messages.value.unshift(message)
  showTransactionToast(message)
}
function triggerDemoTransactionToast() {
  publishTransactionMessage({ name: '平安银行', code: '000001', status: '买入订单全部成交', quantity: 900, price: 11.78, title: '订单已全部成交' })
}
function toggleAssetsVisible() { assetsVisible.value = !assetsVisible.value; if (assetsCollapsed.value) assetsCollapsed.value = false }
function applyFilters() { appliedPositionFilters.value = { query: query.value, market: market.value, positionType: positionType.value, orderType: positionOrderType.value }; table.value?.setScrollTop?.(0) }
function applyOrderFilters() { appliedOrderFilters.value = { ...orderFilters.value, status: [...orderFilters.value.status] }; orderSortState.value = { prop: null, direction: null } }
function clearOrderFilters() { orderFilters.value = { orderNo: '', symbol: '', side: 'ALL', openClose: 'ALL', orderType: 'ALL', status: [] }; applyOrderFilters() }
function applyTradeFilters() { appliedTradeFilters.value = { ...tradeFilters.value } }
function clearTradeFilters() { tradeFilters.value = { symbol: '', side: 'ALL', openClose: 'ALL', orderType: 'ALL' }; applyTradeFilters() }
function clearFilters() { query.value = ''; market.value = 'ALL'; positionType.value = 'ALL'; positionOrderType.value = 'ALL'; sortState.value = { prop: null, direction: null }; table.value?.clearFilter(); applyFilters() }
function downloadCsv(filename, header, records) {
  const csv = [header, ...records].map(record => record.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }))
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}
function exportPositions(rows = sortedRows.value) {
  const header = ['多空方向', '证券代码', '证券名称', '成本价', '最新价', '期初数量', '持仓数量', '可用数量', '市值', '占用保证金', '保证金率', '总盈亏', '实现盈亏', '浮动盈亏', '下单账户', '市场', '币种', '订单类型', '执行算法', '下单备注', '交易员备注']
  const records = rows.map(row => [row.direction, `${row.code}.${row.market}`, row.name, formatPrice(row.cost, row.market), formatPrice(row.price, row.market), number(row.opening), number(row.qty), number(row.available), money(row.valueWan), money(row.marginOccupied), `${row.marginRate}%`, money(row.totalProfit), money(row.dailyRealizedProfit), money(row.floatingProfit), accountLabel(row.account), marketLabel(row.market), row.currency, row.orderType || '--', row.algorithm || '--', row.orderRemark || '--', row.traderRemark || '--'])
  downloadCsv('持仓列表.csv', header, records)
}
function exportOrders(rows = orders.value) {
  const header = ['证券代码', '证券名称', '订单状态', '方向', '订单属性', '订单价格', '订单数量', '订单金额', '挂单数量', '已成数量', '成交均价', '成交金额', '撤单数量', '撤单金额', '冻结保证金', '保证金率', '备注', '订单编号', '订单时间', '下单账户', '市场', '开平方向', '订单类型', '执行算法', '下单备注', '交易员备注']
  const records = rows.map(row => [
    row.code, row.name, row.status, row.side === 'buy' ? '买入' : '卖出', row.type === 'market' ? '市价单' : '限价单',
    row.price === null ? '--' : formatPrice(row.price, row.market), number(row.quantity), exportedOrderAmount(row), row.reportQuantity ? number(row.reportQuantity) : '--', row.filledQuantity ? number(row.filledQuantity) : '--', row.filledPrice === null ? '--' : formatPrice(row.filledPrice, row.market), filledAmount(row), row.canceledQuantity ? number(row.canceledQuantity) : '--', exportedCanceledAmount(row),
    money(row.frozenMargin || 0), `${row.marginRate || 0}%`, row.feedback || '--', row.orderNo, row.orderTime, accountLabel(row.account), marketLabel(row.market), row.openClose === '开' ? '开仓' : '平仓', row.orderType || '--', row.algorithm || '--', row.orderRemark || '--', row.traderRemark || '--',
  ])
  downloadCsv('订单记录.csv', header, records)
}
function exportTrades(rows = trades.value) {
  const header = ['方向', '证券代码', '证券名称', '成交价格', '成交数量', '成交金额', '成交时间', '订单时间', '成交编号', '订单编号', '交易日期', '下单账户', '市场', '备注', '开平方向', '订单类型', '执行算法', '下单备注', '交易员备注']
  const records = rows.map(row => [
    row.side === 'buy' ? '买入' : '卖出', row.code, row.name, formatPrice(row.filledPrice, row.market), number(row.filledQuantity), money(row.filledAmount),
    timeLabel(row.filledTime), timeLabel(row.orderTime), row.tradeNo, row.entrustNo, row.tradeDate, accountLabel(row.account), marketLabel(row.market), row.feedback || '--', row.openClose === '开' ? '开仓' : '平仓', row.orderType || '--', row.algorithm || '--', row.orderRemark || '--', row.traderRemark || '--',
  ])
  downloadCsv('成交记录.csv', header, records)
}
function openExport(target) {
  exportTarget.value = target
  exportDateRange.value = []
  exportDialogVisible.value = true
}
function exportRowDate(target, row) {
  if (target === 'positions') return row.positionDate
  return target === 'orders' ? row.orderTime : row.filledTime
}
function exportRowsFor(target) {
  const rows = target === 'positions' ? sortedRows.value : target === 'orders' ? orders.value : trades.value
  const [startDate, endDate] = exportDateRange.value || []
  if (!startDate || !endDate) return rows
  return rows.filter(row => {
    const date = String(exportRowDate(target, row) || '').slice(0, 10)
    return date >= startDate && date <= endDate
  })
}
function confirmExport() {
  const rows = exportRowsFor(exportTarget.value)
  if (exportTarget.value === 'positions') exportPositions(rows)
  if (exportTarget.value === 'orders') exportOrders(rows)
  if (exportTarget.value === 'trades') exportTrades(rows)
  exportDialogVisible.value = false
}
function chooseDock(value) { dock.value = value; if(value === 'floating' && workspace.value) floating.value = {x:Math.max(0, workspace.value.clientWidth-350),y:12,width:340,height:Math.min(650,workspace.value.clientHeight-12)} }
function toggleSort(prop) { const current = sortState.value; sortState.value = current.prop !== prop || current.direction === null ? { prop, direction: 'ascending' } : current.direction === 'ascending' ? { prop, direction: 'descending' } : { prop: null, direction: null } }
function toggleOrderSort(prop) { const current = orderSortState.value; orderSortState.value = current.prop !== prop || current.direction === null ? { prop, direction: 'ascending' } : current.direction === 'ascending' ? { prop, direction: 'descending' } : { prop: null, direction: null } }
function toggleOrderStatus(status) { const selected = orderFilters.value.status; orderFilters.value.status = selected.includes(status) ? selected.filter(value => value !== status) : [...selected, status] }
function selectAllOrderStatuses() { orderFilters.value.status = [...orderStatusMachine] }
function invertOrderStatuses() { const selected = new Set(orderFilters.value.status); orderFilters.value.status = orderStatusMachine.filter(status => !selected.has(status)) }
function orderRowClassName({ row }) { return row.status === '异常' ? 'order-row-exception' : '' }
function orderStatusVisual(status) {
  if (status === '已撤') return { tone: 'draft', path: 'M4 4l8 8M12 4 4 12' }
  if (status === '暂停') return { tone: 'pending', path: 'M5.5 4v8M10.5 4v8' }
  if (status === '完成') return { tone: 'success', path: 'm3.5 8 2.8 2.8L12.5 5' }
  if (status === '部成') return { tone: 'partial', path: 'M8 3a5 5 0 1 0 5 5H8z' }
  if (status === '已报') return { tone: 'reported', path: 'M8 12V4M5 7l3-3 3 3M4 12v1h8v-1' }
  if (status === '待报') return { tone: 'pending', path: 'M8 3a5 5 0 1 1 0 10A5 5 0 0 1 8 3m0 2.5V8l2 1.5' }
  if (status === '改单中') return { tone: 'review', path: 'm4 12 1.2-3.3L10.8 3l2.2 2.2-5.7 5.7L4 12Zm5.3-8 2.2 2.2' }
  if (status === '异常') return { tone: 'rejected', path: 'M8 3l5 9H3L8 3Zm0 3.1v2.7m0 1.8v.1' }
  if (status === '拒绝') return { tone: 'rejected', path: 'M8 3a5 5 0 1 1 0 10A5 5 0 0 1 8 3Zm-2 3 4 4m0-4-4 4' }
  return { tone: 'draft', path: 'M4 4.5h3v3H4v-3Zm5 0h3v3H9v-3ZM4 9h3v3H4V9Zm5 0h3v3H9V9Z' }
}
function keepAccountSelection(ids) {
  if (!ids.length) { selectedAccountIds.value = [accountId.value]; return }
  if (ids.includes(allAccountsValue)) return
  if (!ids.includes(accountId.value)) accountId.value = ids[0]
}
function updateGlobalAccountSelection(ids) {
  const hadAllAccounts = previousAccountSelection.value.includes(allAccountsValue)
  const hasAllAccounts = ids.includes(allAccountsValue)
  if (hasAllAccounts && !hadAllAccounts) selectedAccountIds.value = [allAccountsValue]
  else if (hasAllAccounts && hadAllAccounts && ids.length > 1) selectedAccountIds.value = ids.filter(id => id !== allAccountsValue)
  previousAccountSelection.value = [...selectedAccountIds.value]
}
function handleGlobalAccountVisible(visible) { if (!visible) globalAccountSearch.value = '' }
function selectTicketAccount(id) { accountId.value = id; selectedAccountIds.value = [id] }
watch(accountId, () => { quote.value = null })
watch(selectedAccountIds, keepAccountSelection, { deep: true })
watch(collapsed, async () => { await nextTick(); table.value?.doLayout?.() })
watch(settingsVisible, visible => { if (!visible) { clearPasswordVerificationTimer(); settingsDetail.value = null } })
const accountBalance = computed(() => account.value.id === 'TZS_T0' ? 1000000 : 700000)
function assetAmountParts(value) {
  const amount = Number(value) || 0
  const yi = Math.floor(amount / 100000000)
  const afterYi = amount - yi * 100000000
  const wan = Math.floor(afterYi / 10000)
  const rest = (afterYi - wan * 10000).toFixed(2)
  return [
    ...(yi ? [{ value: number(yi), unit: '亿' }] : []),
    ...(wan || yi ? [{ value: number(wan), unit: '万' }] : []),
    { value: rest, unit: '' },
  ]
}
function acceptOrder(order) {
  if (!systemRunning.value) return
  demoOrders.value.unshift(enrichOrder(order))
  tab.value = 'orders'
  publishTransactionMessage({ name: order.name, code: order.code, status: '订单已提交', quantity: order.quantity, quantityLabel: '订单数量', title: '订单提交成功' })
}
function loadPositionIntoTicket(row) {
  if (!systemRunning.value) return
  accountId.value = row.account
  selectedAccountIds.value = [row.account]
  selectedCode.value = row.code
  ticketContext.value = {
    executionType: row.executionType === 'highTouch' ? 'highTouch' : 'lowTouch',
    algorithm: ['POV', 'DMA'].includes(row.algorithm) ? row.algorithm : 'DMA',
  }
  quote.value = null
  collapsed.value = false
  ticketResetKey.value += 1
}
function openClosePosition(row) { if (!systemRunning.value) return; closingPosition.value = row; closePositionVisible.value = true }
function openChaseOrder(row) {
  if (!systemRunning.value) return
  const position = allPositionRows.value.find(item => item.code === row.code && item.account === row.account) || variantRows.find(item => item.code === row.code)
  chasingPosition.value = position ? { ...position, account: row.account } : row
  chasingOrder.value = row.orderNo ? { ...row } : null
  chasingAccountId.value = row.account
  chaseOrderVisible.value = true
}
function acceptClosePosition(order) {
  if (!systemRunning.value) return
  demoOrders.value.unshift(enrichOrder(order))
  tab.value = 'orders'
  publishTransactionMessage({ name: order.name, code: order.code, status: '卖出平仓订单已提交', quantity: order.quantity, quantityLabel: '订单数量', title: '平仓订单提交成功' })
}
function acceptChaseOrder(order) {
  if (!systemRunning.value) return
  demoOrders.value.unshift(enrichOrder(order))
  tab.value = 'orders'
}
function openOrderHistory(row) { historyRecord.value = row; historyVisible.value = true }
function cancelableQuantity(row) { return Math.max(0, row.quantity - (row.filledQuantity || 0)) }
function canOperateOrder(row) { return systemRunning.value && cancelableQuantity(row) > 0 && ['待报', '已报', '部成'].includes(row.status) }
const terminalOrderStatuses = new Set(['已撤', '完成', '异常', '拒绝', '其他'])
function isTerminalOrder(row) { return terminalOrderStatuses.has(row.status) }
function canChaseOrder(row) { return systemRunning.value && (isTerminalOrder(row) || canOperateOrder(row)) }
function canAmendOrder(row) { return !isTerminalOrder(row) && canOperateOrder(row) }
function canConvertToManual(row) { return systemRunning.value && row.status === '异常' && row.orderType === '系统单' }
function orderActionLabel(row, action) {
  if (!systemRunning.value) return '系统已暂停交易'
  if (action === '追加订单' && isTerminalOrder(row)) return '基于原订单信息再次下单'
  if (isTerminalOrder(row)) return `订单当前为${row.status}，终态订单不可${action}`
  if (!['待报', '已报', '部成'].includes(row.status)) return `订单当前为${row.status}，不可${action}`
  return cancelableQuantity(row) > 0 ? action : '订单无可操作数量'
}
function openOrderChase(row) { if (canChaseOrder(row)) openChaseOrder(row) }
function openCancelOrder(row) { if (canOperateOrder(row)) { cancelingOrder.value = row; cancelOrderVisible.value = true } }
function openConvertToManual(row) {
  if (!canConvertToManual(row)) return
  convertingManualOrder.value = row
  conversionRemark.value = row.orderRemark || ''
  convertManualVisible.value = true
}
function confirmConvertToManual() {
  const row = convertingManualOrder.value
  if (!row || !canConvertToManual(row)) { convertManualVisible.value = false; return }
  row.executionType = 'highTouch'
  row.orderType = '手工单'
  row.orderRemark = conversionRemark.value.trim()
  row.convertedToManualAt = timestampNow()
  row.feedback = `${row.feedback || '系统处理异常'}；已转为手工单，待交易员处理`
  publishTransactionMessage({
    name: row.name, code: row.code, status: '已转为手工单', quantity: row.quantity,
    quantityLabel: '订单数量', price: row.price, priceLabel: '订单价格', title: '订单已转手工单',
    content: `${row.name}（${row.code}）异常系统单已转为手工单，订单编号 ${row.orderNo} 保持不变。`,
  })
  ElMessage.success('订单已转为手工单。')
  convertManualVisible.value = false
  convertingManualOrder.value = null
}
function openAmendOrder(row) {
  if (!canAmendOrder(row)) return
  amendingOrder.value = row
  amendOrderVisible.value = true
}
function acceptAmendOrder(amendment) {
  if (!systemRunning.value) return
  const row = demoOrders.value.find(item => item.id === amendment.orderId)
  if (!row || !canOperateOrder(row)) return
  const isLimit = row.type !== 'market'
  const nextPrice = isLimit ? amendment.price : null
  const delta = amendment.quantityDelta
  const referencePrice = nextPrice ?? amendingSymbol.value?.price ?? 0
  const amendedBaseQuantity = delta > 0 ? row.quantity : amendment.quantity
  if (isLimit) row.price = nextPrice
  row.estimate = referencePrice * amendedBaseQuantity
  row.frozenMargin = row.estimate * .4
  row.status = '改单中'
  if (delta > 0) {
    const id = Date.now()
    demoOrders.value.unshift(enrichOrder({
      id: `amend-chase-${id}`, orderNo: `WT${id}`, account: row.account, code: row.code, name: row.name,
      executionType: row.executionType, orderType: row.orderType, algorithm: row.algorithm, orderRemark: row.orderRemark, type: row.type, side: row.side, openClose: row.openClose,
      status: '待报', attribute: `${row.type === 'market' ? '市价' : '限价'}·数量`, quantity: delta, price: nextPrice,
      orderValueNumber: delta, orderValue: `${number(delta)} 股`, filledQuantity: 0, filledPrice: null,
      estimate: referencePrice * delta, traderRemark: `关联原订单 ${row.orderNo} 的追单`, parentOrderNo: row.orderNo,
    }))
    row.feedback = `改单已受理：新增追单 ${number(delta)} 股`
  } else if (delta < 0) {
    const canceledQuantity = Math.abs(delta)
    row.quantity = amendment.quantity
    row.orderValueNumber = amendment.quantity
    row.orderValue = `${number(amendment.quantity)} 股`
    row.canceledQuantity = (row.canceledQuantity || 0) + canceledQuantity
    row.canceledAmount = (row.canceledAmount || 0) + canceledQuantity * (nextPrice ?? 0)
    row.reportQuantity = Math.max(0, amendment.quantity - (row.filledQuantity || 0))
    row.frozenMargin = row.estimate * .4
    row.feedback = `改单已受理：部撤 ${number(canceledQuantity)} 股`
  } else {
    row.feedback = '改单已受理：已调整委托价格'
  }
  publishTransactionMessage({
    name: row.name, code: row.code, status: `${amendment.operation}申请已提交`, quantity: Math.abs(delta) || amendment.quantity,
    quantityLabel: amendment.operation === '追单' ? '追单数量' : amendment.operation === '部撤' ? '部撤数量' : '订单数量',
    price: nextPrice, priceLabel: '订单价格', title: '改单申请已提交',
    content: `${row.name}（${row.code}）改单申请已提交：${amendment.operation}${delta ? ` ${number(Math.abs(delta))} 股` : '价格调整'}。`,
  })
  tab.value = 'orders'
}
function publishOrderOperationMessage(row, operation, success) {
  const result = `${operation}${success ? '成功' : '失败'}`
  const remaining = cancelableQuantity(row)
  const reason = operation === '撤单' ? '该订单已完成或无可撤数量。' : '该订单已完成、已撤或无可改单数量。'
  publishTransactionMessage({
    name: row.name, code: row.code, status: result, quantity: remaining,
    quantityLabel: operation === '撤单' ? '撤单数量' : '订单数量', price: row.price,
    priceLabel: '订单价格', title: result,
    content: success
      ? `${row.name}（${row.code}）${result}，${operation === '撤单' ? `撤单数量 ${number(remaining)} 股。` : '订单已更新。'}`
      : `${row.name}（${row.code}）${result}，${reason}`,
  })
}
function confirmCancelOrder() {
  if (!systemRunning.value) { cancelOrderVisible.value = false; return }
  const row = cancelingOrder.value
  if (!row) return
  const canCancel = canOperateOrder(row)
  if (!canCancel) {
    row.feedback = '撤单失败'
    publishOrderOperationMessage(row, '撤单', false)
    cancelOrderVisible.value = false
    cancelingOrder.value = null
    return
  }
  row.status = '已撤'
  row.canceledQuantity = cancelableQuantity(row)
  row.reportQuantity = 0
  row.frozenMargin = 0
  row.feedback = '撤单成功'
  publishOrderOperationMessage({ ...row, quantity: row.canceledQuantity, filledQuantity: 0 }, '撤单', true)
  cancelOrderVisible.value = false
  cancelingOrder.value = null
}
useDialogShortcuts(cancelOrderVisible, { confirm: confirmCancelOrder, cancel: () => { cancelOrderVisible.value = false } })
useDialogShortcuts(convertManualVisible, { confirm: confirmConvertToManual, cancel: () => { convertManualVisible.value = false; conversionRemark.value = '' } })
useDialogShortcuts(exportDialogVisible, { confirm: confirmExport, cancel: () => { exportDialogVisible.value = false } })
useDialogShortcuts(settingsVisible, { confirm: () => settingsDetail.value === 'password' ? confirmPasswordChange() : saveSettings(), cancel: () => settingsDetail.value === 'password' ? closePasswordDialog() : closeSettings() })
function updateViewportWidth() { viewportWidth.value = window.innerWidth }
onMounted(() => {
  showHeaderNotice.value = localStorage.getItem(headerNoticeKey) !== '1'
  window.addEventListener('resize', updateViewportWidth)
  showEmergency(messages.value.find(item => item.urgent))
  window.setTimeout(() => showTransactionToast(messages.value.find(item => item.trade)), 350)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewportWidth)
  clearPasswordVerificationTimer()
  transactionToastTimers.forEach(({ countdownTimer, dismissTimer }) => { window.clearInterval(countdownTimer); window.clearTimeout(dismissTimer) })
  transactionToastTimers.clear()
})
</script>

<template>
  <main class="variants-app" :class="`version-${variant}`">
    <header class="variant-header">
      <img :src="assetUrl('logo-faucon-trade.png')" alt="FAUCON TRADE"><i class="header-brand-divider" aria-hidden="true"></i>
      <nav aria-label="产品菜单">
        <button v-for="item in visibleNav" :key="item.label" :class="{ active: activeNav === item.label }" @click="activeNav = item.label"><span class="nav-menu-content"><span class="source-composite variant-nav-icon" aria-hidden="true"><img v-for="part in item.icon" :key="part[0]" :src="assetUrl(part[0])" :style="{ left: `${part[1]}px`, top: `${part[2]}px`, width: `${part[3]}px`, height: `${part[4]}px` }" alt=""></span><span class="nav-menu-label">{{ item.label }}</span></span></button>
        <el-dropdown v-if="overflowNav.length" trigger="click" popper-class="variant-nav-popper" @command="label => activeNav = label"><button class="more-nav" :class="{ active: overflowNav.some(item => item.label === activeNav) }">更多<el-icon><CaretBottom /></el-icon></button><template #dropdown><el-dropdown-menu><el-dropdown-item v-for="item in overflowNav" :key="item.label" :command="item.label"><span class="source-composite variant-nav-icon" aria-hidden="true"><img v-for="part in item.icon" :key="part[0]" :src="assetUrl(part[0])" :style="{ left: `${part[1]}px`, top: `${part[2]}px`, width: `${part[3]}px`, height: `${part[4]}px` }" alt=""></span>{{ item.label }}</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
      </nav>
      <section v-if="showHeaderNotice && systemNoticeEnabled && !systemRunning" class="header-marquee" aria-label="系统通知" role="button" tabindex="0" @click="openMessageCenter" @keydown.enter="openMessageCenter"><el-icon><InfoFilled /></el-icon><b>系统通知</b><span class="notice-scroll"><i>{{ headerNotice.text }}　{{ headerNotice.text }}</i></span><button type="button" aria-label="关闭系统通知" @click.stop="dismissHeaderNotice"><el-icon><Close /></el-icon></button></section>
      <div class="variant-header-end"><button class="notification-action" aria-label="打开消息中心" @click="openMessageCenter"><ClientLineIcon type="notification" /><em v-if="showUnreadBadge && unreadMessageCount">{{ unreadMessageCount }}</em></button><button class="header-settings-action" aria-label="系统设置" @click="settingsVisible=true"><el-icon><Setting /></el-icon></button><el-tooltip :content="helpCenterUrl ? '打开帮助中心' : '帮助中心地址待配置'" placement="bottom"><button class="header-help-action" :aria-label="helpCenterUrl ? '打开帮助中心' : '帮助中心地址待配置'" @click="openHelpCenter"><ClientLineIcon type="help" /></button></el-tooltip><button type="button" class="small-avatar avatar-toast-trigger" aria-label="触发交易消息提示" @click="triggerDemoTransactionToast">K</button><span>Kevin Zhang</span></div>
    </header>
    <section v-if="activeNav === '交易员中心'" class="trader-center-layout" :class="{ 'is-secondary-collapsed': traderSecondaryCollapsed }" aria-label="交易员中心">
      <nav class="trader-primary-nav" aria-label="交易员中心一级菜单">
        <button v-for="group in traderPrimaryMenu" :key="group.key" type="button" :class="{ active: activeTraderPrimary === group.key }" @click="selectTraderPrimary(group.key)">
          <el-icon><component :is="group.icon" /></el-icon><span>{{ group.label }}</span>
        </button>
      </nav>
      <aside class="trader-secondary-nav" aria-label="交易员中心二级菜单">
        <header><span>{{ activeTraderGroup.title }}</span><button type="button" class="trader-secondary-collapse" :aria-label="traderSecondaryCollapsed ? '展开二级菜单' : '收起二级菜单'" @click="traderSecondaryCollapsed = !traderSecondaryCollapsed"><el-icon><component :is="traderSecondaryCollapsed ? ArrowRight : ArrowLeft" /></el-icon></button></header>
        <nav>
          <button v-for="item in activeTraderGroup.children" :key="item.label" type="button" :class="{ active: activeTraderSecondary === item.label }" @click="activeTraderSecondary = item.label"><el-icon><component :is="item.icon" /></el-icon><span>{{ item.label }}</span></button>
        </nav>
      </aside>
      <section class="trader-center-canvas" :aria-label="activeTraderSecondary"></section>
    </section>
    <template v-else>
    <aside class="transaction-toast-stack" aria-live="polite" aria-label="订单结果提示">
      <transition-group name="transaction-toast">
        <article v-for="toast in transactionToasts" :key="toast.message.id" class="transaction-toast-card">
          <header><span class="transaction-toast-type"><img :src="messageIcon('消息')" alt="">权益交易 · 订单回报</span><span class="transaction-toast-countdown">{{ toast.remaining }}s 后自动关闭</span><button type="button" :aria-label="`关闭${toast.message.title}`" @click="dismissTransactionToast(toast.message.id)"><el-icon><Close /></el-icon></button></header>
          <p class="transaction-toast-instrument"><span>{{ toast.message.trade.name }}</span><small>（{{ toast.message.trade.code }}）</small><em :class="`is-${tradeStatusVisual(toast.message.trade.status).tone}`"><el-icon><component :is="tradeStatusVisual(toast.message.trade.status).icon" /></el-icon>{{ tradeStatusLabel(toast.message.trade.status) }}</em></p>
          <dl class="transaction-toast-metrics"><div><dt>{{ toast.message.trade.quantityLabel || '成交数量' }}</dt><dd>{{ toast.message.trade.quantity ? `${number(toast.message.trade.quantity)} 股` : '--' }}</dd></div><div><dt>{{ toast.message.trade.priceLabel || '成交均价' }}</dt><dd>{{ toast.message.trade.price !== null ? `${money(toast.message.trade.price)} CNY` : '--' }}</dd></div></dl>
        </article>
      </transition-group>
    </aside>
    <div ref="workspace" class="variants-workspace" :class="[`dock-${dock}`,{'ticket-collapsed':collapsed,'is-dragging':dragging}]">
      <section class="positions-pane workspace-panel">
        <header class="positions-tabs"><button :class="{active:tab==='positions'}" @click="tab='positions'">所有持仓<span>({{ allRows.length }})</span></button><button :class="{active:tab==='orders'}" @click="tab='orders'">所有订单<span>({{ orders.length }})</span></button><button :class="{active:tab==='trades'}" @click="tab='trades'">所有成交<span>({{ trades.length }})</span></button><el-select v-model="selectedAccountIds" class="global-account-filter" multiple collapse-tags :max-collapse-tags="1" placeholder="下单账户" aria-label="全局下单账户筛选" popper-class="variant-popper global-account-popper" :offset="2" @visible-change="handleGlobalAccountVisible" @change="updateGlobalAccountSelection"><template #header><div class="account-dropdown-search" @click.stop><el-input v-model="globalAccountSearch" :prefix-icon="Search" placeholder="搜索下单账户" clearable /></div></template><el-option label="全部账户" :value="allAccountsValue" /><el-option v-for="option in filteredGlobalAccounts" :key="option.id" :label="accountLabel(option.id)" :value="option.id" /></el-select><button v-if="collapsed" class="workspace-restore-ticket" @click="collapsed=false"><img class="restore-panel-icon" :src="assetUrl('panel-expand.svg')" alt=""><span class="restore-panel-label" style="color:#9ba3af!important;font-size:12px!important">展开下单面板</span></button></header>
        <template v-if="tab==='positions'">
          <div class="position-filters"><el-input v-model="query" :prefix-icon="Search" placeholder="代码 / 名称" aria-label="搜索持仓" clearable /><el-select v-model="market" aria-label="持仓市场" popper-class="variant-popper" :offset="2"><el-option label="全部市场" value="ALL"/><el-option label="深市" value="SZ"/><el-option label="沪市" value="SH"/></el-select><el-select v-model="positionType" placeholder="多空方向" aria-label="多空方向筛选" popper-class="variant-popper" :offset="2"><el-option label="全部" value="ALL"/><el-option label="多头" value="多"/><el-option label="空头" value="空"/></el-select><el-select v-model="positionOrderType" aria-label="订单类型筛选" popper-class="variant-popper" :offset="2"><el-option label="订单类型" value="ALL"/><el-option label="系统单" value="系统单"/><el-option label="手工单" value="手工单"/></el-select><el-button class="filter-query" @click="applyFilters">查询</el-button><el-button link @click="clearFilters">重置</el-button><el-tooltip content="选择时间范围后导出当前持仓" placement="top"><button class="export-positions" aria-label="导出持仓" @click="openExport('positions')"><el-icon><svg class="export-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M4 11v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/></svg></el-icon></button></el-tooltip></div>
          <TradingTable ref="table" class="original-fields" :data="sortedRows" height="100%" :fit="false" row-key="id" empty-text="无匹配持仓，请调整或重置筛选" @row-dblclick="loadPositionIntoTicket">
            <el-table-column type="index" label="序号" width="44" align="center" header-align="center" class-name="order-index-column" label-class-name="order-index-column" />
            <template v-for="columnKey in visibleColumnKeys" :key="columnKey">
              <el-table-column v-if="columnKey === 'direction'" prop="direction" label="多空方向" width="66" align="center" header-align="center" class-name="direction-column" label-class-name="direction-column"><template #default="{row}"><span class="direction-chip" :class="row.direction === '多' ? 'long' : 'short'"><img :src="assetUrl(row.direction === '多' ? 'direction-long.svg' : 'direction-short.svg')" alt="">{{ row.direction === '多' ? '做多' : '做空' }}</span></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'code'" prop="code" width="80"><template #header><SortHeader label="证券代码" :direction="sortState.prop === 'code' ? sortState.direction : null" @sort="toggleSort('code')" /></template><template #default="{row}">{{ row.code }}.{{ row.market }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'name'" prop="name" width="76"><template #header><SortHeader label="证券名称" :direction="sortState.prop === 'name' ? sortState.direction : null" @sort="toggleSort('name')" /></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'price'" prop="price" width="126" align="right" header-align="right"><template #header><SortHeader label="成本价/最新价" numeric :direction="sortState.prop === 'price' ? sortState.direction : null" @sort="toggleSort('price')" /></template><template #default="{row}"><span class="dim">{{ formatPrice(row.cost, row.market) }}</span> / <span :class="row.change>=0?'up':'down'">{{ formatPrice(row.price, row.market) }}</span></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'opening'" prop="opening" width="76" align="right" header-align="right"><template #header><SortHeader label="期初数量" numeric :direction="sortState.prop === 'opening' ? sortState.direction : null" @sort="toggleSort('opening')" /></template><template #default="{row}">{{ number(row.opening) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'holdingQty'" prop="qty" width="100" align="right" header-align="right"><template #header><SortHeader label="持仓数量" numeric :direction="sortState.prop === 'qty' ? sortState.direction : null" @sort="toggleSort('qty')" /></template><template #default="{row}">{{ number(row.qty) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'available'" prop="available" width="76" align="right" header-align="right"><template #header><SortHeader label="可用数量" numeric :direction="sortState.prop === 'available' ? sortState.direction : null" @sort="toggleSort('available')" /></template><template #default="{row}">{{ number(row.available) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'valueWan'" prop="valueWan" width="72" align="right" header-align="right"><template #header><SortHeader label="市值" numeric :direction="sortState.prop === 'valueWan' ? sortState.direction : null" @sort="toggleSort('valueWan')" /></template><template #default="{row}">{{ money(row.valueWan) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'marginOccupied'" prop="marginOccupied" width="88" align="right" header-align="right"><template #header><SortHeader label="占用保证金" numeric :direction="sortState.prop === 'marginOccupied' ? sortState.direction : null" @sort="toggleSort('marginOccupied')" /></template><template #default="{row}">{{ money(row.marginOccupied) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'marginRate'" prop="marginRate" width="76" align="right" header-align="right"><template #header><SortHeader label="保证金率" numeric :direction="sortState.prop === 'marginRate' ? sortState.direction : null" @sort="toggleSort('marginRate')" /></template><template #default="{row}">{{ row.marginRate.toFixed(2) }}%</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'totalProfit'" prop="totalProfit" width="96" align="right" header-align="right"><template #header><span class="profit-heading"><SortHeader label="总盈亏" numeric :direction="sortState.prop === 'totalProfit' ? sortState.direction : null" @sort="toggleSort('totalProfit')" /><el-tooltip content="总盈亏 = 实现盈亏 + 浮动盈亏" placement="top" popper-class="order-help-popper"><button type="button" class="total-help" aria-label="总盈亏说明"><el-icon><InfoFilled /></el-icon></button></el-tooltip></span></template><template #default="{row}"><span :class="row.totalProfit >= 0 ? 'up' : 'down'">{{ money(row.totalProfit) }}</span></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'dailyRealizedProfit'" prop="dailyRealizedProfit" width="96" align="right" header-align="right"><template #header><SortHeader label="实现盈亏" numeric :direction="sortState.prop === 'dailyRealizedProfit' ? sortState.direction : null" @sort="toggleSort('dailyRealizedProfit')" /></template><template #default="{row}"><span :class="row.dailyRealizedProfit >= 0 ? 'up' : 'down'">{{ money(row.dailyRealizedProfit) }}</span></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'floatingProfit'" prop="floatingProfit" width="88" align="right" header-align="right"><template #header><SortHeader label="浮动盈亏" numeric :direction="sortState.prop === 'floatingProfit' ? sortState.direction : null" @sort="toggleSort('floatingProfit')" /></template><template #default="{row}"><span :class="row.floatingProfit >= 0 ? 'up' : 'down'">{{ money(row.floatingProfit) }}</span></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'currency'" prop="currency" label="币种" width="56" />
              <el-table-column v-else-if="columnKey === 'account'" prop="account" label="下单账户" width="92" />
              <el-table-column v-else-if="columnKey === 'market'" prop="market" label="市场" width="48"><template #default="{row}">{{ row.market === 'SZ' ? '深市' : '沪市' }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'orderType'" prop="orderType" label="订单类型" width="64"><template #default="{row}"><span class="order-type-tag" :class="row.orderType === '手工单' ? 'is-manual' : 'is-system'">{{ row.orderType || '--' }}</span></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'algorithm'" prop="algorithm" label="执行算法" width="64" align="center" header-align="center"><template #default="{row}">{{ row.algorithm || '--' }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'orderRemark'" prop="orderRemark" label="下单备注" width="128" show-overflow-tooltip><template #default="{row}">{{ row.orderRemark || '--' }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'traderRemark'" prop="traderRemark" label="交易员备注" width="128" show-overflow-tooltip><template #default="{row}">{{ row.traderRemark || '--' }}</template></el-table-column>
            </template>
            <el-table-column label="历史" width="52" align="center" header-align="center" class-name="history-column" label-class-name="history-column"><template #default="{ row }"><button type="button" class="history-view" @click.stop="openOrderHistory(row)">查看</button></template></el-table-column>
            <el-table-column label="操作" width="72" fixed="right" align="center" header-align="center" class-name="operation-column" label-class-name="operation-column"><template #default="{ row }"><div v-if="row.direction === '多'" class="row-actions"><el-tooltip content="追加订单" placement="top" :show-after="300" popper-class="variant-popper order-action-popper"><span class="operation-tooltip"><button type="button" class="position-chase-action" aria-label="追加订单" :disabled="!systemRunning" @click.stop="openChaseOrder(row)">追</button></span></el-tooltip><el-tooltip content="平仓" placement="top" :show-after="300" popper-class="variant-popper order-action-popper"><span class="operation-tooltip"><button type="button" class="position-close-action" aria-label="平仓" :disabled="!systemRunning" @click.stop="openClosePosition(row)">平</button></span></el-tooltip></div></template></el-table-column>
            <el-table-column width="22" fixed="right" align="center" header-align="center" class-name="column-config-column" label-class-name="column-config-column"><template #header><ColumnConfigPopover v-model="visibleColumnKeys" :options="columnOptions" :defaults="positionColumnDefaults" /></template></el-table-column>
          </TradingTable><footer class="positions-footer"><span>显示 {{ filtered.length }} / {{ allRows.length }} 条</span></footer>
        </template>
        <template v-else-if="tab==='orders'">
          <div class="order-filters">
            <el-input v-model="orderFilters.symbol" class="order-symbol-filter" :prefix-icon="Search" placeholder="标的名称 / 代码" aria-label="搜索订单标的" clearable />
            <el-input v-model="orderFilters.orderNo" class="order-number-filter" placeholder="订单编号" aria-label="搜索订单编号" clearable />
            <el-select v-model="orderFilters.side" aria-label="买卖方向筛选" popper-class="variant-popper" :offset="2"><el-option label="买卖方向" value="ALL"/><el-option label="买入" value="buy"/><el-option label="卖出" value="sell"/></el-select>
            <el-select v-model="orderFilters.openClose" aria-label="开平类型筛选" popper-class="variant-popper" :offset="2"><el-option label="开平类型" value="ALL"/><el-option label="开仓" value="开"/><el-option label="平仓" value="平"/></el-select>
            <el-select v-model="orderFilters.orderType" aria-label="订单类型筛选" popper-class="variant-popper" :offset="2"><el-option label="订单类型" value="ALL"/><el-option label="系统单" value="系统单"/><el-option label="手工单" value="手工单"/></el-select>
            <el-select v-model="orderFilters.status" class="order-status-filter" multiple collapse-tags :max-collapse-tags="1" placeholder="状态" aria-label="状态筛选" popper-class="variant-popper order-status-popper" :offset="2"><template #header><div class="order-status-filter-actions"><button type="button" @click.stop="selectAllOrderStatuses">全选</button><i></i><button type="button" @click.stop="invertOrderStatuses">反选</button></div></template><el-option v-for="option in orderStatusOptions" :key="option.value" :label="option.label" :value="option.value"><el-checkbox :model-value="orderFilters.status.includes(option.value)" @click.stop @change="toggleOrderStatus(option.value)">{{ option.label }}</el-checkbox></el-option></el-select>
            <el-button class="filter-query" @click="applyOrderFilters">查询</el-button><el-button link @click="clearOrderFilters">重置</el-button>
            <el-tooltip content="选择时间范围后导出当前筛选结果" placement="top"><button class="export-orders" aria-label="导出订单记录" @click="openExport('orders')"><el-icon><svg class="export-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M4 11v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/></svg></el-icon></button></el-tooltip>
          </div>
          <TradingTable class="original-fields orders-table" :data="sortedOrders" :row-class-name="orderRowClassName" height="100%" :fit="false" empty-text="暂无订单记录">
            <el-table-column type="index" label="序号" width="44" align="center" header-align="center" class-name="order-index-column" label-class-name="order-index-column" />
            <template v-for="columnKey in orderVisibleColumnKeys" :key="columnKey">
              <el-table-column v-if="columnKey === 'code'" prop="code" label="证券代码" width="68"/>
              <el-table-column v-else-if="columnKey === 'name'" prop="name" label="证券名称" width="68"/>
              <el-table-column v-else-if="columnKey === 'status'" prop="status" label="订单状态" width="80" align="center" header-align="center" class-name="order-status-column" label-class-name="order-status-column"><template #default="{row}"><span class="order-status" :class="`is-${orderStatusVisual(row.status).tone}`"><svg class="order-status-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path :d="orderStatusVisual(row.status).path" /></svg>{{ row.status }}</span></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'openClose'" prop="openClose" label="开平方向" width="64"><template #default="{row}">{{ row.openClose === '开' ? '开仓' : '平仓' }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'side'" label="方向" width="64" align="left" header-align="left"><template #default="{row}"><span :class="row.side==='buy'?'up':'down'">{{ row.side==='buy'?'买入':'卖出' }}</span></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'attribute'" prop="attribute" label="订单属性" width="64"><template #default="{row}">{{ row.type === 'market' ? '市价单' : '限价单' }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'price'" prop="price" width="88" align="right" header-align="right" class-name="order-price-gap-column" label-class-name="order-price-gap-column"><template #header><SortHeader label="订单价格" numeric :direction="orderSortState.prop === 'price' ? orderSortState.direction : null" @sort="toggleOrderSort('price')" /></template><template #default="{row}">{{ row.price === null ? '--' : formatPrice(row.price, row.market) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'orderValueNumber'" prop="quantity" width="88" align="right" header-align="right"><template #header><SortHeader label="订单数量/金额" numeric :direction="orderSortState.prop === 'quantity' ? orderSortState.direction : null" @sort="toggleOrderSort('quantity')" /></template><template #default="{row}">{{ number(row.quantity) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'reportQuantity'" prop="reportQuantity" label="挂单数量" width="76" align="right" header-align="right"><template #default="{row}">{{ row.reportQuantity ? number(row.reportQuantity) : '--' }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'fillProgress'" label="成交进度" width="68" align="right" header-align="right"><template #header><SortHeader label="成交进度" numeric :direction="orderSortState.prop === 'fillProgress' ? orderSortState.direction : null" @sort="toggleOrderSort('fillProgress')" /></template><template #default="{row}">{{ fillProgress(row) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'filledQuantity'" prop="filledQuantity" width="76" align="right" header-align="right"><template #header><SortHeader label="已成数量" numeric :direction="orderSortState.prop === 'filledQuantity' ? orderSortState.direction : null" @sort="toggleOrderSort('filledQuantity')" /></template><template #default="{row}">{{ row.filledQuantity ? number(row.filledQuantity) : '--' }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'filledPrice'" prop="filledPrice" width="76" align="right" header-align="right"><template #header><SortHeader label="成交均价" numeric :direction="orderSortState.prop === 'filledPrice' ? orderSortState.direction : null" @sort="toggleOrderSort('filledPrice')" /></template><template #default="{row}">{{ row.filledPrice === null ? '--' : formatPrice(row.filledPrice, row.market) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'filledAmount'" label="成交金额" width="72" align="right" header-align="right"><template #default="{row}">{{ filledAmount(row) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'canceledValue'" label="撤单数量/金额" width="96" align="right" header-align="right"><template #default="{row}">{{ canceledOrderValue(row) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'account'" prop="account" label="下单账户" width="132"><template #default="{row}">{{ accountLabel(row.account) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'frozenMargin'" prop="frozenMargin" label="冻结保证金" width="84" align="right" header-align="right"><template #default="{row}">{{ money(row.frozenMargin || 0) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'marginRate'" prop="marginRate" label="保证金率" width="64" align="right" header-align="right"><template #default="{row}">{{ row.marginRate || 0 }}%</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'feedback'" prop="feedback" label="备注" width="104" show-overflow-tooltip><template #default="{row}">{{ row.feedback || '--' }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'orderNo'" prop="orderNo" label="订单编号" width="112"/>
              <el-table-column v-else-if="columnKey === 'orderTime'" prop="orderTime" label="订单时间" width="80"><template #default="{row}">{{ timeLabel(row.orderTime) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'market'" prop="market" label="市场" width="48"><template #default="{row}">{{ marketLabel(row.market) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'orderType'" prop="orderType" label="订单类型" width="64"><template #default="{row}"><span class="order-type-tag" :class="row.orderType === '手工单' ? 'is-manual' : 'is-system'">{{ row.orderType || '--' }}</span></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'algorithm'" prop="algorithm" label="执行算法" width="64" align="center" header-align="center"><template #default="{row}">{{ row.algorithm || '--' }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'orderRemark'" prop="orderRemark" label="下单备注" width="128" show-overflow-tooltip><template #default="{row}">{{ row.orderRemark || '--' }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'traderRemark'" prop="traderRemark" label="交易员备注" width="128" show-overflow-tooltip><template #default="{row}">{{ row.traderRemark || '--' }}</template></el-table-column>
            </template>
            <el-table-column label="历史" width="52" align="center" header-align="center" class-name="history-column" label-class-name="history-column"><template #default="{row}"><button type="button" class="history-view" @click.stop="openOrderHistory(row)">查看</button></template></el-table-column>
            <el-table-column label="操作" width="96" fixed="right" align="center" class-name="operation-column" label-class-name="operation-column"><template #default="{row}"><div class="order-row-actions"><el-tooltip v-if="canConvertToManual(row)" content="转手工单" placement="top" :show-after="300" popper-class="variant-popper order-action-popper"><span class="operation-tooltip"><button type="button" class="order-convert-manual" aria-label="转手工单" @click="openConvertToManual(row)">转</button></span></el-tooltip><el-tooltip :content="orderActionLabel(row, '追加订单')" placement="top" :show-after="300" popper-class="variant-popper order-action-popper"><span class="operation-tooltip"><button type="button" class="order-chase-action" :aria-label="orderActionLabel(row, '追加订单')" :disabled="!canChaseOrder(row)" @click="openOrderChase(row)">追</button></span></el-tooltip><template v-if="!canConvertToManual(row)"><el-tooltip :content="orderActionLabel(row, '修改订单')" placement="top" :show-after="300" popper-class="variant-popper order-action-popper"><span class="operation-tooltip"><button type="button" class="order-amend-action" :aria-label="orderActionLabel(row, '修改订单')" :disabled="!canAmendOrder(row)" @click="openAmendOrder(row)">改</button></span></el-tooltip><el-tooltip :content="orderActionLabel(row, '撤单')" placement="top" :show-after="300" popper-class="variant-popper order-action-popper"><span class="operation-tooltip"><button type="button" class="order-cancel-action" :aria-label="orderActionLabel(row, '撤单')" :disabled="!canOperateOrder(row)" @click="openCancelOrder(row)">撤</button></span></el-tooltip></template></div></template></el-table-column>
            <el-table-column width="22" fixed="right" align="center" header-align="center" class-name="column-config-column" label-class-name="column-config-column"><template #header><ColumnConfigPopover v-model="orderVisibleColumnKeys" :options="orderColumnOptions" :defaults="orderColumnDefaults" /></template></el-table-column>
          </TradingTable>
        </template>
        <template v-else>
          <div class="order-filters">
            <el-input v-model="tradeFilters.symbol" :prefix-icon="Search" placeholder="标的名称 / 代码" aria-label="搜索成交标的" clearable />
            <el-select v-model="tradeFilters.side" aria-label="买卖方向筛选" popper-class="variant-popper" :offset="2"><el-option label="买卖方向" value="ALL"/><el-option label="买入" value="buy"/><el-option label="卖出" value="sell"/></el-select>
            <el-select v-model="tradeFilters.openClose" aria-label="开平类型筛选" popper-class="variant-popper" :offset="2"><el-option label="开平类型" value="ALL"/><el-option label="开仓" value="开"/><el-option label="平仓" value="平"/></el-select>
            <el-select v-model="tradeFilters.orderType" aria-label="订单类型筛选" popper-class="variant-popper" :offset="2"><el-option label="订单类型" value="ALL"/><el-option label="系统单" value="系统单"/><el-option label="手工单" value="手工单"/></el-select>
            <el-button class="filter-query" @click="applyTradeFilters">查询</el-button><el-button link @click="clearTradeFilters">重置</el-button>
            <el-tooltip content="选择时间范围后导出当前筛选结果" placement="top"><button class="export-orders" aria-label="导出成交记录" @click="openExport('trades')"><el-icon><svg class="export-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M4 11v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/></svg></el-icon></button></el-tooltip>
          </div>
          <TradingTable class="original-fields orders-table trades-table" :data="trades" height="100%" :fit="false" empty-text="暂无成交记录">
            <el-table-column type="index" label="序号" width="44" align="center" header-align="center" class-name="order-index-column" label-class-name="order-index-column" />
            <template v-for="columnKey in tradeVisibleColumnKeys" :key="columnKey">
              <el-table-column v-if="columnKey === 'side'" prop="side" label="方向" width="64" align="left" header-align="left"><template #default="{row}"><span :class="row.side === 'buy' ? 'up' : 'down'">{{ row.side === 'buy' ? '买入' : '卖出' }}</span></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'openClose'" prop="openClose" label="开平方向" width="64" align="right" header-align="right" class-name="plain-right-column"><template #default="{row}">{{ row.openClose === '开' ? '开仓' : '平仓' }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'code'" prop="code" label="证券代码" width="68" />
              <el-table-column v-else-if="columnKey === 'name'" prop="name" label="证券名称" width="68" />
              <el-table-column v-else-if="columnKey === 'filledPrice'" prop="filledPrice" label="成交价格" width="76" align="right" header-align="right"><template #default="{row}">{{ formatPrice(row.filledPrice, row.market) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'filledQuantity'" prop="filledQuantity" label="成交数量" width="76" align="right" header-align="right"><template #default="{row}">{{ number(row.filledQuantity) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'filledAmount'" prop="filledAmount" label="成交金额" width="76" align="right" header-align="right"><template #default="{row}">{{ money(row.filledAmount) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'filledTime'" prop="filledTime" label="成交时间" width="80"><template #default="{row}">{{ timeLabel(row.filledTime) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'orderTime'" prop="orderTime" label="订单时间" width="80"><template #default="{row}">{{ timeLabel(row.orderTime) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'tradeNo'" prop="tradeNo" label="成交编号" width="112" />
              <el-table-column v-else-if="columnKey === 'entrustNo'" prop="entrustNo" label="订单编号" width="128" />
              <el-table-column v-else-if="columnKey === 'tradeDate'" prop="tradeDate" label="交易日期" width="90" />
              <el-table-column v-else-if="columnKey === 'account'" prop="account" label="下单账户" width="132"><template #default="{row}">{{ accountLabel(row.account) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'market'" prop="market" label="市场" width="48"><template #default="{row}">{{ marketLabel(row.market) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'feedback'" prop="feedback" label="备注" width="104" show-overflow-tooltip><template #default="{row}">{{ row.feedback || '--' }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'orderType'" prop="orderType" label="订单类型" width="64"><template #default="{row}"><span class="order-type-tag" :class="row.orderType === '手工单' ? 'is-manual' : 'is-system'">{{ row.orderType || '--' }}</span></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'algorithm'" prop="algorithm" label="执行算法" width="64" align="center" header-align="center"><template #default="{row}">{{ row.algorithm || '--' }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'orderRemark'" prop="orderRemark" label="下单备注" width="128" show-overflow-tooltip><template #default="{row}">{{ row.orderRemark || '--' }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'traderRemark'" prop="traderRemark" label="交易员备注" width="128" show-overflow-tooltip><template #default="{row}">{{ row.traderRemark || '--' }}</template></el-table-column>
            </template>
            <el-table-column label="历史" width="52" align="center" header-align="center" class-name="history-column" label-class-name="history-column"><template #default="{row}"><button type="button" class="history-view" @click.stop="openOrderHistory(row)">查看</button></template></el-table-column>
            <el-table-column width="22" fixed="right" align="center" header-align="center" class-name="column-config-column" label-class-name="column-config-column"><template #header><ColumnConfigPopover v-model="tradeVisibleColumnKeys" :options="tradeColumnOptions" :defaults="tradeColumnDefaults" /></template></el-table-column>
          </TradingTable>
        </template>
      </section>
      <section class="trade-dock" :class="{floating:dock==='floating', resizing, 'assets-collapsed':assetsCollapsed}" :style="floatStyle">
        <OrderBook v-show="!collapsed" :symbol="selected" :compact="dock === 'bottom'" @drag="start" @quote="value=>{quote=value;collapsed=false}" />
        <section v-show="!collapsed" class="ticket-pane workspace-panel">
          <header class="module-heading drag-heading" @pointerdown="start"><span class="drag-title"><span class="drag-grip" aria-hidden="true"><i v-for="n in 8" :key="n" /></span><h2>交易订单</h2></span><button aria-label="收起交易区域" class="collapse-ticket" @pointerdown.stop @click="collapsed=true"><img :src="assetUrl('panel-collapse.svg')" alt=""></button></header>
          <OrderTicket :key="ticketResetKey" :instruments="marketInstruments" :accounts="accounts" :symbol="selected" :account="account" :quote="quote" :paused="!systemRunning" :ticket-context="ticketContext" @account-select="selectTicketAccount" @select="code=>{ selectedCode=code; if (!code) quote=null }" @order="acceptOrder" />
        </section>
        <section v-show="!collapsed" class="compact-assets ticket-assets" :class="{ 'is-collapsed': assetsCollapsed }" aria-label="账户资金"><div class="asset-summary-heading"><span>资产账户概要</span><button class="asset-visibility" type="button" :aria-label="assetsVisible ? '隐藏资金数值' : '查看资金数值'" @click="toggleAssetsVisible"><el-icon><View v-if="assetsVisible" /><Hide v-else /></el-icon></button><button class="asset-collapse" type="button" :aria-label="assetsCollapsed ? '展开资产账户概要' : '收起资产账户概要'" @click="assetsCollapsed=!assetsCollapsed"><el-icon><ArrowDownBold /></el-icon></button></div><div v-show="!assetsCollapsed" class="asset-summary-grid"><div class="asset-metric asset-available"><span>大账户可用</span><el-tooltip v-if="assetsVisible" placement="top" popper-class="asset-value-popper"><template #content><span class="asset-large-value"><template v-for="part in assetAmountParts(account.cash)" :key="`${part.value}${part.unit}`"><b>{{ part.value }}</b><i v-if="part.unit">{{ part.unit }}</i></template></span></template><b class="asset-number">{{ money(account.cash) }}</b></el-tooltip><b v-else class="asset-number">••••••••</b><small>CNY</small></div><div class="asset-metric"><span>大账户余额</span><el-tooltip v-if="assetsVisible" placement="top" popper-class="asset-value-popper"><template #content><span class="asset-large-value"><template v-for="part in assetAmountParts(accountBalance)" :key="`${part.value}${part.unit}`"><b>{{ part.value }}</b><i v-if="part.unit">{{ part.unit }}</i></template></span></template><b class="asset-number">{{ money(accountBalance) }}</b></el-tooltip><b v-else class="asset-number">••••••••</b><small>CNY</small></div></div></section>
        <button v-if="dock === 'floating'" type="button" class="floating-resize-handle" aria-label="调整下单面板高度" @pointerdown="startResize"><span></span></button>
      </section>
      <div v-if="dragging" class="dock-targets"><div class="dock-target target-left">停靠左侧</div><div class="dock-target target-right">停靠右侧</div><div class="dock-target target-bottom">停靠底部</div><span class="float-instruction">拖至边缘停靠 · 放在中间悬浮</span></div>
    </div>
    <footer class="variant-status"><span class="system-status"><i class="status-dot" :class="{ 'is-interrupted': !systemRunning }"/>{{ systemRunning ? '运行中' : '系统中断' }} · 演示环境<button type="button" class="system-status-toggle" @click="toggleSystemStatus">{{ systemRunning ? '切换为中断' : '恢复运行' }}</button></span><span>行情：静态快照</span><span class="status-end">系统版本：方案 V0.2</span></footer>
    <ClosePositionDialog v-model="closePositionVisible" :position="closingPosition" :account="account" @submit="acceptClosePosition" />
    <ChaseOrderDialog v-model="chaseOrderVisible" :position="chasingPosition" :order="chasingOrder" :account="chasingAccount" @submit="acceptChaseOrder" />
    <AmendOrderDialog v-model="amendOrderVisible" :order="amendingOrder" :symbol="amendingSymbol" :account="amendingAccount" @submit="acceptAmendOrder" />
    <OrderHistoryDialog v-model="historyVisible" :record="historyRecord" />
    <BaseDialog v-model="exportDialogVisible" width="400px" class="variant-confirm export-time-dialog" title="导出数据" :close-on-press-escape="false">
      <section class="export-time-form">
        <p>导出{{ exportTargetLabel }}数据，可选择时间范围。</p>
        <label for="export-date-range">时间范围</label>
        <el-date-picker id="export-date-range" v-model="exportDateRange" type="daterange" value-format="YYYY-MM-DD" format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" clearable />
        <small>不选择则导出全部时间。</small>
      </section>
      <template #footer><el-button @click="exportDialogVisible=false">取消[Esc]</el-button><el-button type="primary" @click="confirmExport">导出[Enter]</el-button></template>
    </BaseDialog>
    <BaseDialog v-model="convertManualVisible" width="680px" align-center append-to-body class="variant-confirm convert-manual-dialog" title="转为手工单" :close-on-press-escape="false">
      <template v-if="convertingManualOrder">
        <p class="convert-manual-intro">转为手工单后，将由交易员直接接入审核；订单编号、价格、数量及异常状态保持不变。</p>
        <el-descriptions class="convert-manual-details" :column="2" border size="small" aria-label="待转换订单信息">
          <el-descriptions-item label="订单编号">{{ convertingManualOrder.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="下单账户">{{ accountLabel(convertingManualOrder.account) }}</el-descriptions-item>
          <el-descriptions-item label="标的">{{ convertingManualOrder.name }}（{{ convertingManualOrder.code }}.{{ convertingManualOrder.market }}）</el-descriptions-item>
          <el-descriptions-item label="市场">{{ marketLabel(convertingManualOrder.market) }}</el-descriptions-item>
          <el-descriptions-item label="交易方向"><span :class="convertingManualOrder.side === 'buy' ? 'is-buy' : 'is-sell'">{{ convertingManualOrder.side === 'buy' ? '买入' : '卖出' }}</span> · {{ convertingManualOrder.openClose === '开' ? '开仓' : '平仓' }}</el-descriptions-item>
          <el-descriptions-item label="原订单类型">{{ convertingManualOrder.orderType }} · {{ convertingManualOrder.attribute || '--' }}</el-descriptions-item>
          <el-descriptions-item label="执行算法">{{ convertingManualOrder.algorithm || '--' }}</el-descriptions-item>
          <el-descriptions-item label="订单价格">{{ convertingManualOrder.price === null ? '市价' : formatPrice(convertingManualOrder.price, convertingManualOrder.market) }}</el-descriptions-item>
          <el-descriptions-item label="订单数量">{{ number(convertingManualOrder.quantity) }} 股</el-descriptions-item>
          <el-descriptions-item label="订单金额">{{ money(convertingManualOrder.estimate) }} CNY</el-descriptions-item>
          <el-descriptions-item label="订单状态">{{ convertingManualOrder.status }}</el-descriptions-item>
          <el-descriptions-item label="下单时间">{{ convertingManualOrder.orderTime }}</el-descriptions-item>
          <el-descriptions-item label="异常原因" :span="2">{{ convertingManualOrder.feedback || '系统处理异常' }}</el-descriptions-item>
          <el-descriptions-item label="原下单备注" :span="2">{{ convertingManualOrder.orderRemark || '--' }}</el-descriptions-item>
        </el-descriptions>
        <label class="convert-manual-remark" for="convert-manual-remark">手工单备注<el-input id="convert-manual-remark" v-model="conversionRemark" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="请输入备注，供交易员处理时参考" /></label>
      </template>
      <template #footer><el-button @click="convertManualVisible=false; conversionRemark=''">取消[Esc]</el-button><el-button type="primary" @click="confirmConvertToManual">确认转换[Enter]</el-button></template>
    </BaseDialog>
    <BaseDialog v-model="cancelOrderVisible" width="320px" class="variant-confirm order-cancel-dialog" title="撤单确认" :teleported="false" :close-on-press-escape="false">
      <template v-if="cancelingOrder">
        <section class="order-cancel-summary" aria-label="待撤订单摘要">
          <header class="order-cancel-summary-head">
            <div><strong>{{ cancelingOrder.name }}({{ cancelingOrder.code }})</strong></div>
          </header>
          <div class="order-cancel-summary-metrics">
            <div><span>订单价格</span><b :class="{ 'is-market': cancelingOrder.price === null }">{{ cancelingOrder.price === null ? '市价' : money(cancelingOrder.price) }}</b><small v-if="cancelingOrder.price === null">以市场价格成交</small></div>
            <div><span>订单数量</span><b>{{ number(cancelableQuantity(cancelingOrder)) }}</b></div>
          </div>
        </section>
        <dl class="order-cancel-details" aria-label="订单信息">
          <div><dt>订单编号</dt><dd>{{ cancelingOrder.orderNo }}</dd></div>
          <div><dt>下单账户</dt><dd>{{ accountLabel(cancelingOrder.account) }}</dd></div>
          <div><dt>开平方向</dt><dd>{{ cancelingOrder.openClose === '开' ? '开仓' : '平仓' }}</dd></div>
          <div><dt>买卖方向</dt><dd :class="cancelingOrder.side === 'buy' ? 'up' : 'down'">{{ cancelingOrder.side === 'buy' ? '买入' : '卖出' }}</dd></div>
          <div><dt>订单方式</dt><dd>{{ cancelingOrder.type === 'market' ? '市价单' : '限价单' }}</dd></div>
        </dl>
      </template>
      <template #footer><el-button @click="cancelOrderVisible=false">取消[Esc]</el-button><el-button type="primary" @click="confirmCancelOrder">确认撤单[Enter]</el-button></template>
    </BaseDialog>
    <BaseDialog v-model="messageCenterVisible" width="760px" align-center class="message-center-dialog" :show-close="false">
      <template #header><header class="message-center-header"><h2>消息中心</h2><div class="message-header-actions"><button type="button" class="message-close-action" aria-label="关闭消息中心" @click="messageCenterVisible=false"><el-icon><Close /></el-icon></button></div></header></template>
      <div class="message-center-layout"><nav class="message-category-tabs" aria-label="消息分类"><button v-for="category in messageCategories" :key="category" :class="{ active: messageCategory === category }" @click="messageCategory=category"><img class="message-category-icon" :src="messageIcon(category)" alt=""><span>{{ category }}</span><i v-if="categoryUnreadCount(category)">{{ categoryUnreadCount(category) }}</i></button></nav>
        <section class="message-list" aria-label="消息列表"><header><div class="message-list-heading"><b>{{ messageCategory }}</b><span v-if="categoryUnreadCount(messageCategory)" class="message-list-actions"><strong>{{ categoryUnreadCount(messageCategory) }}</strong> 条未读</span></div><button v-if="unreadMessageCount" type="button" class="mark-all-read" @click="markAllMessagesRead">全部标为已读</button></header><article v-for="message in filteredMessages" :key="message.id" class="message-item" :class="[`is-${message.category}`, { unread: message.unread, expanded: messageIsExpanded(message) }]" @click="markMessageRead(message)"><span class="message-type-icon"><img :src="messageIcon(message.category)" alt=""></span><div class="message-copy"><span class="message-title-row"><b>{{ message.title }}</b><em>{{ message.category }}</em></span><p>{{ message.content }}</p><button v-if="needsExpansion(message)" type="button" @click.stop="toggleMessageExpansion(message)">{{ messageIsExpanded(message) ? '收起' : '展开全部' }}</button></div><time>{{ message.time }}</time><i v-if="message.unread" aria-label="未读"></i></article><p v-if="!filteredMessages.length" class="message-empty">当前分类暂无消息</p></section>
      </div>
    </BaseDialog>
    <BaseDialog v-model="emergencyMessage" width="420px" align-center class="emergency-message-dialog" title="紧急通知"><section v-if="emergencyMessage"><h3>{{ emergencyMessage.title }}</h3><p>{{ emergencyMessage.content }}</p></section><template #footer><el-button type="primary" @click="emergencyMessage=null">我知道了</el-button></template></BaseDialog>
    <BaseDialog v-model="settingsVisible" class="settings-dialog equity-settings-dialog" width="700px" :show-close="false" :close-on-click-modal="true" :close-on-press-escape="false" destroy-on-close>
      <template #header><div class="settings-title"><div v-if="settingsDetail === 'password'" class="settings-breadcrumb" aria-label="当前位置"><button type="button" @click="closePasswordDialog">系统设置</button><span>/</span><h2>修改密码</h2></div><h2 v-else>系统设置</h2><button class="settings-close" type="button" aria-label="关闭系统设置" @click="closeSettings"><el-icon><Close /></el-icon></button></div></template>
      <section v-if="settingsDetail === 'password'" class="settings-password-view">
        <form class="password-change-form" @submit.prevent="confirmPasswordChange">
          <label class="password-email-row"><span>验证邮箱</span><span class="password-email">{{ passwordEmail }}</span></label>
          <label>邮箱验证码<div class="password-code-row"><el-input v-model.trim="passwordForm.verificationCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="请输入 6 位验证码" /><el-button class="password-code-action" :disabled="passwordVerificationCountdown > 0" native-type="button" @click="sendPasswordVerificationCode">{{ passwordVerificationCountdown ? `${passwordVerificationCountdown}s 后重发` : '获取验证码' }}</el-button></div></label>
          <label>新密码<el-input v-model="passwordForm.password" :class="{ 'is-error': passwordFieldErrors.password }" type="password" show-password autocomplete="new-password" placeholder="请输入新密码" @blur="validateNewPassword()" @input="passwordForm.passwordConfirmation && validatePasswordConfirmation()" /><small v-if="!passwordFieldErrors.password">密码须包含英文字母与特殊符号，且长度不少于 8 位。</small><p v-if="passwordFieldErrors.password" class="password-field-error" role="alert">{{ passwordFieldErrors.password }}</p></label>
          <label>重复密码<el-input v-model="passwordForm.passwordConfirmation" :class="{ 'is-error': passwordFieldErrors.passwordConfirmation }" type="password" show-password autocomplete="new-password" placeholder="请再次输入新密码" @blur="validatePasswordConfirmation()" /><p v-if="passwordFieldErrors.passwordConfirmation" class="password-field-error" role="alert">{{ passwordFieldErrors.passwordConfirmation }}</p></label>
          <p v-if="passwordFormError" class="password-form-error" role="alert">{{ passwordFormError }}</p>
        </form>
      </section>
      <div v-else class="settings-layout"><nav class="settings-nav"><button v-for="item in settingMenu" :key="item.key" :class="{ active: activeSetting === item.key }" @click="scrollToSetting(item.key)"><SettingsMenuIcon :name="item.key" />{{ item.label }}</button></nav><el-scrollbar class="settings-content"><section id="equity-account-setting" class="settings-section"><h3>账号信息</h3><div class="setting-row"><span>登录密码</span><el-button plain @click="openPasswordDialog">修改密码</el-button></div><div class="setting-row"><span>开机启动</span><el-switch v-model="autoLaunch" /></div></section><section id="equity-language-setting" class="settings-section"><h3>语言设置</h3><div class="setting-row"><span>显示语言</span><el-radio-group v-model="language" class="settings-radio-group"><el-radio class="settings-radio" value="简体中文">简体中文</el-radio><el-radio class="settings-radio" value="繁體中文">繁體中文</el-radio><el-radio class="settings-radio" value="English">English</el-radio></el-radio-group></div></section><section id="equity-trading-setting" class="settings-section"><h3>交易与行情设置</h3><div class="setting-row"><span>订单价格设置</span><el-radio-group v-model="orderPrice" class="settings-radio-group"><el-radio class="settings-radio" value="买一">买一</el-radio><el-radio class="settings-radio" value="卖一">卖一</el-radio><el-radio class="settings-radio" value="最新价">最新价</el-radio></el-radio-group></div><div class="setting-row"><span>涨跌幅颜色</span><el-radio-group v-model="colorRule" class="settings-radio-group"><el-radio class="settings-radio" value="red-up">红涨绿跌</el-radio><el-radio class="settings-radio" value="green-up">绿涨红跌</el-radio></el-radio-group></div><div class="price-preview" :class="pricePreviewClass"><span class="up">↑ 2.48%</span><span class="down">↓ 1.36%</span></div></section><section id="equity-appearance-setting" class="settings-section"><h3>系统外观</h3><div class="setting-row"><span>主题模式</span><el-radio-group v-model="theme" class="settings-radio-group"><el-radio class="settings-radio" value="dark">深色模式</el-radio><el-radio class="settings-radio" value="light">浅色模式</el-radio></el-radio-group></div><div class="theme-cards"><button :class="{ selected: theme === 'dark' }" @click="theme='dark'"><span class="mini-screen dark"><i /><b /><em /><em /><em /></span>深色模式</button><button :class="{ selected: theme === 'light' }" @click="theme='light'"><span class="mini-screen light"><i /><b /><em /><em /><em /></span>浅色模式</button></div></section></el-scrollbar></div>
      <template #footer><div v-if="settingsDetail === 'password'" class="settings-footer"><el-button @click="closePasswordDialog">取消[Esc]</el-button><el-button type="primary" @click="confirmPasswordChange">确认修改[Enter]</el-button></div><div v-else class="settings-footer"><el-button @click="closeSettings">取消[Esc]</el-button><el-button type="primary" @click="saveSettings">保存设置[Enter]</el-button></div></template>
    </BaseDialog>
    </template>
  </main>
</template>
