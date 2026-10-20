<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowDownBold, Bell, Briefcase, CaretBottom, ChatDotRound, Clock, Collection, Connection, Document, Expand, Fold, Search, Setting, InfoFilled, View, Hide, CircleCheck, CircleClose, Close, EditPen, List, More, Refresh, Tickets } from '@element-plus/icons-vue'
import ClientLineIcon from '../../ClientLineIcon.vue'
import SettingsMenuIcon from '../../SettingsMenuIcon.vue'
import { accounts } from './fixtures'
import { marketInstruments, variantRows, variants, money, number, price as formatPrice } from './variantData'
import { columnOptionsFor } from './tableFieldDefinitions'
import { orderTypeError } from './orderMarketRules.js'
import { positionMarginInCny } from './positionCurrency'
import { useTicketDock } from './useTicketDock'
import { useDialogShortcuts } from '../../composables/useDialogShortcuts'
import BaseDialog from '../../components/BaseDialog.vue'
import { addManualEquityOrderToPool, recordPlacedTrsOrder } from './trsOrderStore'
import TradingAppShell from '../../layout/TradingAppShell.vue'
import { tradingContextKey } from './tradingContext'
import EquityTradingPage from './pages/EquityTradingPage.vue'
import OptionsTradingPage from './pages/OptionsTradingPage.vue'
import FinancingPage from './pages/FinancingPage.vue'
import StrategyTradingPage from './pages/StrategyTradingPage.vue'
import DataPage from './pages/DataPage.vue'

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
  { label: '交易员中心', hidden: true, icon: [['u100.svg', 0, 0, 12, 12], ['u101.svg', 3, 11, 7, 5]] },
  { label: '数据', icon: [['u114.svg', 0, 0, 12, 13], ['u115.svg', 7, 6, 8, 8]] },
]
const availableNav = computed(() => mainNav.filter(item => !item.hidden))
const overflowNav = computed(() => viewportWidth.value <= 980 ? availableNav.value.slice(3) : viewportWidth.value <= 1200 ? availableNav.value.slice(4) : [])
const visibleNav = computed(() => availableNav.value.slice(0, availableNav.value.length - overflowNav.value.length))
const isUnderDevelopment = computed(() => ['期权交易', '融资申请', '数据'].includes(activeNav.value))
const traderPrimaryMenu = [
  { key: 'swap', label: 'TRS', title: '收益互换', icon: Connection, children: [{ label: '订单管理', icon: Document }, { label: '我的HT订单', icon: Collection }] },
  { key: 'options', label: '期权', title: '期权交易', icon: List, children: [{ label: '期权交易', icon: Tickets }, { label: '持仓管理', icon: Briefcase }, { label: '生命周期', icon: Clock }] },
]
const activeTraderPrimary = ref('swap')
const activeTraderSecondary = ref('订单管理')
const traderSecondaryCollapsed = ref(false)
const activeTraderGroup = computed(() => traderPrimaryMenu.find(item => item.key === activeTraderPrimary.value) || traderPrimaryMenu[0])
function selectTraderPrimary(key) {
  const group = traderPrimaryMenu.find(item => item.key === key)
  if (!group) return
  activeTraderPrimary.value = key
  activeTraderSecondary.value = group.children[0].label
}
function selectProductNav(label) {
  if (!availableNav.value.some(item => item.label === label)) return
  activeNav.value = label
}
const allAccountsValue = '__ALL_ACCOUNTS__'
const workspace = ref(null), accountId = ref('TZS_T0'), selectedAccountIds = ref(['TZS_T0']), previousAccountSelection = ref(['TZS_T0']), query = ref(''), positionType = ref('ALL')
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
const tableRefreshKey = ref(0)
const trsPoolExportRows = ref([])
const trsOrderTicketVisible = ref(false)
const trsOrderRequest = ref(null)
const orderStatusMachine = ['未报', '待报', '已报', '待撤', '待撤［部成］', '部撒', '撤单', '部成', '全成', '被拒绝', '已报待改', '待改［部成］', '待确认', '审核中', '审核拒绝', '待改审核', '待改［部成］', '待改［未报］', '待确认［待审核］']
const orderStatusOptions = orderStatusMachine.map((status, index) => ({ key: index, label: status, value: status }))
const copyableIdentifierFields = new Set(['orderNo', 'tradeNo', 'entrustNo'])
const demoOrderStatuses = ['撤单', '待撤', '全成', '部成', '已报', '部成', '已报待改', '被拒绝', '被拒绝', '未报', '待确认', '审核中', '待改审核', '全成', '待改［未报］', '待确认［待审核］']
const amountOrderIndices = new Set([2, 3, 6, 11])
const orderActivityHint = '原为反馈信息，仅显示系统反馈；10 月 13 日起，订单动态合并展示系统反馈和交易员备注。'
const demoOrders = ref(demoOrderStatuses.map((status, index) => {
  const instrument = variantRows[index % variantRows.length]
  const quantity = index === 5 ? 2_000_000 : (index + 1) * 100
  const filledQuantity = status === '全成' ? quantity : status.includes('部成') ? Math.max(100, Math.floor(quantity / 2 / 100) * 100) : 0
  const price = index % 3 === 1 ? null : instrument.price
  const estimate = (price || instrument.price) * quantity
  const inputAmount = price !== null && amountOrderIndices.has(index) ? Number(estimate.toFixed(2)) : null
  // 保留一条被拒绝的系统单供“转手工单”操作，其余同状态样本为手工单。
  const executionType = (status === '被拒绝' ? index !== demoOrderStatuses.indexOf('被拒绝') : index % 4 === 3) ? 'highTouch' : 'lowTouch'
  return {
    id: `seed-${index + 1}`, orderNo: `WT20260911${String(index + 1).padStart(3, '0')}`,
    account: index < orderStatusMachine.length || index % 3 !== 1 ? 'TZS_T0' : 'TZS_T1', code: instrument.code, name: instrument.name, executionType, type: price === null ? 'market' : 'limit',
    orderType: executionType === 'highTouch' ? '手工单' : '系统单', algorithm: index % 3 === 0 ? 'POV' : 'DMA',
    orderRemark: executionType === 'highTouch' ? ['请按委托价格优先处理', '客户指定分批执行', '请关注盘中流动性'][index % 3] : '',
    traderRemark: status === '被拒绝' ? '拒绝原因：委托价格偏离当前市场价格，暂不具备执行条件。' : status === '全成' && executionType === 'highTouch' ? '成交结果已确认，回报已同步' : executionType === 'highTouch' ? ['已受理，正在处理', '建议分批成交', '已反馈可执行价格'][index % 3] : '',
    side: index % 2 ? 'sell' : 'buy', openClose: index % 3 ? '平' : '开', status,
    attribute: `${price === null ? '市价' : '限价'}·${inputAmount === null ? '数量' : '金额'}`, quantity, price, inputAmount,
    orderValueNumber: inputAmount ?? quantity, orderValue: inputAmount === null ? `${number(quantity)} 股` : `${money(inputAmount)} CNY`, filledQuantity,
    reportQuantity: ['已报', '待撤', '待撤［部成］', '部成', '已报待改', '待改［部成］'].includes(status) ? Math.max(0, quantity - filledQuantity) : 0,
    filledPrice: filledQuantity ? instrument.price : null, estimate,
    canceledQuantity: status === '撤单' ? quantity - filledQuantity : 0,
    frozenMargin: ['撤单', '全成', '被拒绝', '审核拒绝'].includes(status) ? 0 : estimate * .4,
    marginRate: 40, feedback: status === '审核拒绝' ? '审核未通过' : status === '被拒绝' ? '订单已被拒绝' : status.includes('部成') ? '部分成交回报已确认，剩余数量继续挂单' : status === '全成' ? '成交回报已确认' : '',
    market: instrument.market, orderTime: `2026-09-11 09:${String(30 + index).padStart(2, '0')}:00`,
  }
}))
const syncedHtPositions = ref([])
const orderFilters = ref({ orderNo: '', symbol: '', side: 'ALL', openClose: 'ALL', orderType: 'ALL', status: [] })
const orderFilterBar = ref(null)
const visibleOrderFilterCount = ref(5)
let orderFilterObserver
function fitOrderFilters() {
  const bar = orderFilterBar.value
  if (!bar) return
  const style = getComputedStyle(bar)
  const gap = parseFloat(style.columnGap) || 0
  const available = bar.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  const optional = [...bar.querySelectorAll(':scope > .order-filter-optional')]
  const widths = optional.map(el => parseFloat(getComputedStyle(el).width))
  const fixed = [...bar.children].filter(el => el.matches('.order-symbol-filter, .filter-query, .el-button.is-link, .table-toolbar-actions'))
  const fixedWidth = fixed.reduce((sum, el) => sum + el.getBoundingClientRect().width, 0)
  const moreWidth = parseFloat(getComputedStyle(bar.querySelector('.order-filter-more')).width)
  let count = widths.length
  while (count > 0) {
    const hasMore = count < widths.length
    const total = fixedWidth + widths.slice(0, count).reduce((sum, width) => sum + width, 0)
      + (hasMore ? moreWidth : 0) + gap * (fixed.length + count + Number(hasMore) - 1)
    if (total <= available) break
    count--
  }
  visibleOrderFilterCount.value = count
}
watch(orderFilterBar, bar => {
  orderFilterObserver?.disconnect()
  if (bar) {
    orderFilterObserver = new ResizeObserver(fitOrderFilters)
    orderFilterObserver.observe(bar)
    fitOrderFilters()
  }
}, { flush: 'post' })
onBeforeUnmount(() => orderFilterObserver?.disconnect())
const appliedPositionFilters = ref({ query: '', positionType: 'ALL' })
const appliedOrderFilters = ref({ orderNo: '', symbol: '', side: 'ALL', openClose: 'ALL', orderType: 'ALL', status: [] })
const tradeFilters = ref({ symbol: '', side: 'ALL', openClose: 'ALL', orderType: 'ALL' })
const appliedTradeFilters = ref({ symbol: '', side: 'ALL', openClose: 'ALL', orderType: 'ALL' })
const sortState = ref({ prop: null, direction: null })
const orderSortState = ref({ prop: null, direction: null })
const tradeSortState = ref({ prop: null, direction: null })
const columnOptions = columnOptionsFor('positions').filter(([id]) => !['totalProfit', 'dailyRealizedProfit'].includes(id))
const positionColumnDefaults = columnOptions.map(([id]) => id).filter(id => !['orderRemark', 'traderRemark'].includes(id))
const visibleColumnKeys = ref([...positionColumnDefaults])
const orderColumnDefaults = columnOptionsFor('orders').map(([id]) => id)
const orderVisibleColumnKeys = ref([...orderColumnDefaults])
const orderColumnOptions = columnOptionsFor('orders')
const tradeColumnDefaults = columnOptionsFor('trades').map(([id]) => id)
const tradeVisibleColumnKeys = ref([...tradeColumnDefaults])
const tradeColumnOptions = columnOptionsFor('trades')
const { dock, collapsed, dragging, resizing, floating, start, startResize } = useTicketDock(workspace)
const defaultTicketDock = computed(() => variants.find(item => item.id === variant.value)?.dock || 'right')
const isTicketLayoutModified = computed(() => collapsed.value || dock.value !== defaultTicketDock.value)
dock.value = defaultTicketDock.value
const account = computed(() => accounts.find(a => a.id === accountId.value))
const passwordEmail = computed(() => account.value?.email || '')
const closingAccount = computed(() => accounts.find(item => item.id === closingPosition.value?.account) || account.value)
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
function secondAccountPosition(position) {
  return {
    ...position, id: position.id.replace('T0', 'T1'), account: 'TZS_T1',
    opening: position.opening * 2, qty: position.qty * 2, available: position.available * 2,
    pendingSell: (position.pendingSell || 0) * 2,
    todayExecutions: position.todayExecutions?.map(execution => ({ ...execution, quantity: execution.quantity * 2 })),
    value: position.value * 2, valueWan: position.valueWan * 2, marginOccupied: position.marginOccupied * 2,
    floatingProfit: position.floatingProfit * 2, dailyRealizedProfit: position.dailyRealizedProfit * 2, totalProfit: position.totalProfit * 2,
  }
}
const instruments = computed(() => variantRows.map(p => accountId.value === 'TZS_T0' ? p : secondAccountPosition(p)))
const emptySelected = { code: '', market: '', name: '请选择下单标的', price: null, cost: null, change: 0, available: 0 }
const selected = computed(() => instruments.value.find(p => p.code === selectedCode.value) || marketInstruments.find(p => p.code === selectedCode.value) || emptySelected)
const trsTicketSymbol = computed(() => trsOrderRequest.value?.symbol || selected.value)
const trsTicketInstruments = computed(() => {
  const requestSymbol = trsOrderRequest.value?.symbol
  return requestSymbol && !marketInstruments.some(item => item.code === requestSymbol.code) ? [requestSymbol, ...marketInstruments] : marketInstruments
})
const mockCnyExchangeRates = Object.freeze({ CNY: 1, HKD: 0.92, USD: 7.18 })
const allPositionRows = computed(() => {
  const baseRows = [...variantRows, ...variantRows.map(secondAccountPosition)]
  const syncedKeys = new Set(syncedHtPositions.value.map(row => `${row.account}:${row.code}`))
  return [...syncedHtPositions.value, ...baseRows.filter(row => !syncedKeys.has(`${row.account}:${row.code}`))]
    .map(row => ({ ...row, marginOccupied: positionMarginInCny(row, mockCnyExchangeRates), marginCurrency: 'CNY' }))
})
const allRows = computed(() => allPositionRows.value.filter(row => effectiveAccountIds.value.includes(row.account)))
const mockRealtimeAvailableByAccount = Object.freeze({ TZS_T0: 1245527941.41, TZS_T1: 620800 })
const cnyExchangeRate = currency => mockCnyExchangeRates[currency] ?? 1
const portfolioMarketValue = computed(() => allRows.value.reduce((total, row) => total + (Number(row.value) || 0) * cnyExchangeRate(row.currency), 0))
const portfolioFloatingPnl = computed(() => allRows.value.reduce((total, row) => total + (Number(row.floatingProfit) || 0) * cnyExchangeRate(row.currency), 0))
const realtimeAvailable = computed(() => effectiveAccountIds.value.reduce((total, id) => total + (mockRealtimeAvailableByAccount[id] ?? accounts.find(account => account.id === id)?.cash ?? 0), 0))
const floatingPnlClass = computed(() => portfolioFloatingPnl.value > 0 ? 'is-positive' : portfolioFloatingPnl.value < 0 ? 'is-negative' : '')
const filtered = computed(() => allRows.value.filter(p => (!appliedPositionFilters.value.query || `${p.code}${p.name}`.includes(appliedPositionFilters.value.query.trim())) && (appliedPositionFilters.value.positionType === 'ALL' || p.direction === appliedPositionFilters.value.positionType)))
const sortedRows = computed(() => {
  const { prop, direction } = sortState.value
  if (!prop || !direction) return filtered.value
  const multiplier = direction === 'ascending' ? 1 : -1
  return [...filtered.value].sort((a, b) => {
    const left = a[prop], right = b[prop]
    if (prop === 'marginOccupied' && (left == null || right == null)) return Number(left == null) - Number(right == null)
    if (typeof left === 'string') return left.localeCompare(right, 'zh-CN') * multiplier
    return (left - right) * multiplier
  })
})
const orders = computed(() => demoOrders.value.filter(o => effectiveAccountIds.value.includes(o.account) && (!appliedOrderFilters.value.orderNo || o.orderNo.includes(appliedOrderFilters.value.orderNo.trim())) && (!appliedOrderFilters.value.symbol || `${o.code}${o.name}`.includes(appliedOrderFilters.value.symbol.trim())) && (appliedOrderFilters.value.side === 'ALL' || o.side === appliedOrderFilters.value.side) && (appliedOrderFilters.value.openClose === 'ALL' || o.openClose === appliedOrderFilters.value.openClose) && (appliedOrderFilters.value.orderType === 'ALL' || o.orderType === appliedOrderFilters.value.orderType) && (!appliedOrderFilters.value.status.length || appliedOrderFilters.value.status.includes(o.status))))
const sortedOrders = computed(() => {
  const { prop, direction } = orderSortState.value
  const exceptionRank = row => row.status === '被拒绝' ? (row.orderType === '系统单' ? 0 : 1) : 2
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
    tradeNo: order.tradeNo || `CJ${order.orderNo.slice(2)}`,
    entrustNo: `${order.orderNo}-01`,
    tradeDate: order.orderTime.slice(0, 10).replaceAll('-', ''),
  }))
  .filter(trade => effectiveAccountIds.value.includes(trade.account)
    && trade.filledQuantity > 0 && trade.filledPrice !== null
    && (!appliedTradeFilters.value.symbol || `${trade.code}${trade.name}`.includes(appliedTradeFilters.value.symbol.trim()))
    && (appliedTradeFilters.value.side === 'ALL' || trade.side === appliedTradeFilters.value.side)
    && (appliedTradeFilters.value.openClose === 'ALL' || trade.openClose === appliedTradeFilters.value.openClose)
    && (appliedTradeFilters.value.orderType === 'ALL' || trade.orderType === appliedTradeFilters.value.orderType)))
const sortedTrades = computed(() => {
  const { prop, direction } = tradeSortState.value
  if (!prop || !direction) return trades.value
  const multiplier = direction === 'ascending' ? 1 : -1
  return [...trades.value].sort((left, right) => ((Number(left[prop]) || 0) - (Number(right[prop]) || 0)) * multiplier)
})
const floatStyle = computed(() => dock.value === 'floating' ? { left: `${floating.value.x}px`, top: `${floating.value.y}px`, width:`${floating.value.width}px`, height:`${floating.value.height}px` } : {})
function resetTicketLayout() {
  dock.value = defaultTicketDock.value
  collapsed.value = false
  assetsCollapsed.value = false
  floating.value = { x: 40, y: 20, width: 602, height: 620 }
}
function chooseVariant(id) { variant.value = id; resetTicketLayout(); history.replaceState(null,'',`${location.pathname}?layout=${id}`) }
function openMessageCenter() { messageCenterVisible.value = true }
function openHelpCenter() {
  if (helpCenterUrl) {
    window.open(helpCenterUrl, '_blank', 'noopener,noreferrer')
    return
  }
  ElMessage.info('帮助中心地址正在配置中。')
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
function currencyForRow(row) { return row.currency || (row.market === 'HK' ? 'HKD' : row.market === 'US' ? 'USD' : 'CNY') }
function timeLabel(value) { return value ? String(value).slice(-8) : '--' }
function orderActivity(row) {
  const entries = [
    row?.feedback?.trim() && `系统：${row.feedback.trim()}`,
    row?.traderRemark?.trim() && `交易员：${row.traderRemark.trim()}`,
  ].filter(Boolean)
  return entries.length ? entries.join('；') : '--'
}
function publishOrderActivityMessage(row, unread = true) {
  const activity = orderActivity(row)
  if (activity === '--') return
  messages.value.unshift({
    id: `order-activity-${row.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    category: '消息', title: '订单动态', content: `${row.name}（${row.code}）：${activity}`,
    time: row.orderTime ? timeLabel(row.orderTime) : '刚刚', unread,
  })
}
function seedOrderActivityMessages() {
  demoOrders.value.filter(row => orderActivity(row) !== '--').reverse().forEach(row => publishOrderActivityMessage(row, false))
}
function filledAmount(row) {
  const quantity = Number(row.filledQuantity)
  const price = Number(row.filledPrice)
  return Number.isFinite(quantity) && quantity > 0 && Number.isFinite(price) && price > 0 ? money(quantity * price) : '--'
}
function sharesWithUnit(value) { return `${number(value)} 股` }
function orderValueLabel(row) {
  return row.inputAmount !== null && row.inputAmount !== undefined
    ? `${money(row.orderValueNumber ?? row.inputAmount)} 元`
    : sharesWithUnit(row.quantity)
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
  if (prop === 'filledAmount') return Number(row.filledQuantity || 0) * Number(row.filledPrice || 0)
  if (prop === 'canceledValue') return Number(row.canceledAmount || row.canceledQuantity) || 0
  return Number(row[prop]) || 0
}
function canceledOrderValue(row) { return row.canceledAmount ? money(row.canceledAmount) : row.canceledQuantity ? sharesWithUnit(row.canceledQuantity) : '--' }
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
function applyFilters() { appliedPositionFilters.value = { query: query.value, positionType: positionType.value }; table.value?.setScrollTop?.(0) }
function applyOrderFilters() { appliedOrderFilters.value = { ...orderFilters.value, status: [...orderFilters.value.status] }; orderSortState.value = { prop: null, direction: null } }
function clearOrderFilters() { orderFilters.value = { orderNo: '', symbol: '', side: 'ALL', openClose: 'ALL', orderType: 'ALL', status: [] }; applyOrderFilters() }
function applyTradeFilters() { appliedTradeFilters.value = { ...tradeFilters.value }; tradeSortState.value = { prop: null, direction: null } }
function clearTradeFilters() { tradeFilters.value = { symbol: '', side: 'ALL', openClose: 'ALL', orderType: 'ALL' }; applyTradeFilters() }
function clearFilters() { query.value = ''; positionType.value = 'ALL'; sortState.value = { prop: null, direction: null }; table.value?.clearFilter(); applyFilters() }
function downloadCsv(filename, header, records) {
  const csv = [header, ...records].map(record => record.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }))
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}
function exportPositions(rows = sortedRows.value) {
  const header = ['多空方向', '证券代码', '证券名称', '持仓均价', '最新价', '期初数量', '持仓数量', '可用数量', '市值', '保证金占用(CNY)', '保证金率', '浮动盈亏', '下单账户', '市场', '币种', '订单类型', '执行算法', '下单备注', '交易员备注']
  const records = rows.map(row => [row.direction, `${row.code}.${row.market}`, row.name, formatPrice(row.cost, row.market), formatPrice(row.price, row.market), number(row.opening), number(row.qty), number(row.available), money(row.value), row.marginOccupied == null ? '--' : money(row.marginOccupied), `${row.marginRate}%`, money(row.floatingProfit), accountLabel(row.account), marketLabel(row.market), row.currency, row.orderType || '--', row.algorithm || '--', row.orderRemark || '--', row.traderRemark || '--'])
  downloadCsv('持仓列表.csv', header, records)
}
function exportOrders(rows = orders.value) {
  const header = ['证券代码', '证券名称', '订单状态', '方向', '订单属性', '订单限价', '订单数量', '订单金额', '已成数量', '成交均价', '成交金额', '撤单数量', '撤单金额', '冻结保证金', '保证金率', '订单编号', '订单时间', '下单账户', '市场', '币种', '订单类型', '执行算法', '下单备注', '订单动态', '开平方向', '挂单数量']
  const records = rows.map(row => [
    row.code, row.name, row.status, row.side === 'buy' ? '买' : '卖', row.type === 'market' ? '市价单' : '限价单',
    row.price === null ? '--' : formatPrice(row.price, row.market), number(row.quantity), exportedOrderAmount(row), row.filledQuantity ? number(row.filledQuantity) : '--', row.filledPrice === null ? '--' : formatPrice(row.filledPrice, row.market), filledAmount(row), row.canceledQuantity ? number(row.canceledQuantity) : '--', exportedCanceledAmount(row),
    money(row.frozenMargin || 0), `${row.marginRate || 0}%`, row.orderNo, row.orderTime, accountLabel(row.account), marketLabel(row.market), currencyForRow(row), row.orderType || '--', row.algorithm || '--', row.orderRemark || '--', orderActivity(row), row.openClose === '开' ? '开仓' : '平仓', row.reportQuantity ? number(row.reportQuantity) : '--',
  ])
  downloadCsv('订单记录.csv', header, records)
}
function exportTrades(rows = sortedTrades.value) {
  const header = ['方向', '证券代码', '证券名称', '成交均价', '成交数量', '成交金额', '成交时间', '订单时间', '成交编号', '订单编号', '交易日期', '下单账户', '市场', '币种', '订单类型', '执行算法', '下单备注', '订单动态', '开平方向']
  const records = rows.map(row => [
    row.side === 'buy' ? '买' : '卖', row.code, row.name, formatPrice(row.filledPrice, row.market), number(row.filledQuantity), money(row.filledAmount),
    timeLabel(row.filledTime), timeLabel(row.orderTime), row.tradeNo, row.entrustNo, row.tradeDate, accountLabel(row.account), marketLabel(row.market), currencyForRow(row), row.orderType || '--', row.algorithm || '--', row.orderRemark || '--', orderActivity(row), row.openClose === '开' ? '开仓' : '平仓',
  ])
  downloadCsv('成交记录.csv', header, records)
}
function exportTrsPoolOrders(rows = trsPoolExportRows.value) {
  const header = ['客户名', '客户编号', '交易账户', '交易类型', '订单类型', '标的物名称', '方向', '订单属性', '订单价格', '下单数量', '下单金额', '提交时间', '订单编号', '处理人', '处理时间']
  const records = rows.map(row => [
    row.customer, row.customerCode, row.account, row.tradeType, row.standard, row.underlying, row.direction, row.attribute,
    row.price, row.quantity, row.amount, row.submittedAt, row.orderNo, row.handler || '--', row.processedAt || '--',
  ])
  downloadCsv('HT请求订单.csv', header, records)
}
function openTrsPoolExport({ rows, dateRange }) {
  trsPoolExportRows.value = rows
  confirmExport('trsPool', dateRange)
}
function exportRowDate(target, row) {
  if (target === 'positions') return row.positionDate
  if (target === 'orders') return row.orderTime
  if (target === 'trades') return row.filledTime
  return row.submittedAt
}
function exportRowsFor(target, dateRange = []) {
  const rows = target === 'positions' ? sortedRows.value : target === 'orders' ? sortedOrders.value : target === 'trades' ? sortedTrades.value : trsPoolExportRows.value
  const [startDate, endDate] = dateRange
  if (!startDate || !endDate) return rows
  return rows.filter(row => {
    const date = String(exportRowDate(target, row) || '').slice(0, 10)
    return date >= startDate && date <= endDate
  })
}
function confirmExport(target, dateRange = []) {
  const rows = exportRowsFor(target, dateRange)
  if (target === 'positions') exportPositions(rows)
  if (target === 'orders') exportOrders(rows)
  if (target === 'trades') exportTrades(rows)
  if (target === 'trsPool') exportTrsPoolOrders(rows)
}
function refreshTable() { tableRefreshKey.value += 1 }
function isCopyableIdentifier(column) { return copyableIdentifierFields.has(column?.property) }
function identifierText(row, column) {
  return String(row?.[column?.property] ?? '').trim()
}
async function copyIdentifier(row, column) {
  const value = identifierText(row, column)
  if (!value) return
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value)
    else {
      const input = document.createElement('textarea')
      input.value = value
      input.setAttribute('readonly', '')
      input.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
      document.body.append(input)
      input.select()
      const copied = document.execCommand('copy')
      input.remove()
      if (!copied) throw new Error('copy failed')
    }
    ElMessage.success(`已复制：${value}`)
  } catch {
    ElMessage.error('复制失败，请检查浏览器剪贴板权限')
  }
}
function copyableIdentifierCellClass({ column }) { return isCopyableIdentifier(column) ? 'copyable-identifier-cell' : '' }
function handleTableCellDoubleClick(row, column) {
  if (isCopyableIdentifier(column)) copyIdentifier(row, column)
}
function handlePositionRowDoubleClick(row, column) {
  if (!isCopyableIdentifier(column)) loadPositionIntoTicket(row)
}
function chooseDock(value) { dock.value = value; if(value === 'floating' && workspace.value) floating.value = {x:Math.max(0, workspace.value.clientWidth-350),y:12,width:340,height:Math.min(650,workspace.value.clientHeight-12)} }
function toggleSort(prop) { const current = sortState.value; sortState.value = current.prop !== prop || current.direction === null ? { prop, direction: 'ascending' } : current.direction === 'ascending' ? { prop, direction: 'descending' } : { prop: null, direction: null } }
function toggleOrderSort(prop) { const current = orderSortState.value; orderSortState.value = current.prop !== prop || current.direction === null ? { prop, direction: 'ascending' } : current.direction === 'ascending' ? { prop, direction: 'descending' } : { prop: null, direction: null } }
function toggleTradeSort(prop) { const current = tradeSortState.value; tradeSortState.value = current.prop !== prop || current.direction === null ? { prop, direction: 'ascending' } : current.direction === 'ascending' ? { prop, direction: 'descending' } : { prop: null, direction: null } }
function toggleOrderStatus(status) { const selected = orderFilters.value.status; orderFilters.value.status = selected.includes(status) ? selected.filter(value => value !== status) : [...selected, status] }
function selectAllOrderStatuses() { orderFilters.value.status = [...new Set(orderStatusMachine)] }
function invertOrderStatuses() { const selected = new Set(orderFilters.value.status); orderFilters.value.status = [...new Set(orderStatusMachine.filter(status => !selected.has(status)))] }
function orderRowClassName({ row }) { return row.status === '被拒绝' ? 'order-row-exception' : '' }
function orderStatusVisual(status) {
  if (['部撒', '撤单'].includes(status)) return { tone: 'draft', path: 'M4 4l8 8M12 4 4 12' }
  if (status === '全成') return { tone: 'success', path: 'm3.5 8 2.8 2.8L12.5 5' }
  if (status.includes('部成')) return { tone: 'partial', path: 'M8 3a5 5 0 1 0 5 5H8z' }
  if (status === '已报') return { tone: 'reported', path: 'M8 12V4M5 7l3-3 3 3M4 12v1h8v-1' }
  if (['未报', '待报', '待撤', '待确认', '待确认［待审核］'].includes(status)) return { tone: 'pending', path: 'M8 3a5 5 0 1 1 0 10A5 5 0 0 1 8 3m0 2.5V8l2 1.5' }
  if (status === '审核拒绝' || status === '被拒绝') return { tone: 'rejected', path: 'M8 3a5 5 0 1 1 0 10A5 5 0 0 1 8 3Zm-2 3 4 4m0-4-4 4' }
  if (status.includes('待改') || status.includes('审核') || status === '已报待改') return { tone: 'review', path: 'm4 12 1.2-3.3L10.8 3l2.2 2.2-5.7 5.7L4 12Zm5.3-8 2.2 2.2' }
  return { tone: 'draft', path: 'M4 4.5h3v3H4v-3Zm5 0h3v3H9v-3ZM4 9h3v3H4V9Zm5 0h3v3H9V9Z' }
}
function updateGlobalAccountSelection(ids) {
  const hadAllAccounts = previousAccountSelection.value.includes(allAccountsValue)
  const hasAllAccounts = ids.includes(allAccountsValue)
  if (!ids.length || (hasAllAccounts && !hadAllAccounts)) selectedAccountIds.value = [allAccountsValue]
  else if (hasAllAccounts && hadAllAccounts && ids.length > 1) selectedAccountIds.value = ids.filter(id => id !== allAccountsValue)
  previousAccountSelection.value = [...selectedAccountIds.value]
}
function handleGlobalAccountVisible(visible) { if (!visible) globalAccountSearch.value = '' }
function selectTicketAccount(id) { accountId.value = id }
watch(accountId, () => { quote.value = null })
watch(collapsed, async () => { await nextTick(); table.value?.doLayout?.() })
watch(settingsVisible, visible => { if (!visible) { clearPasswordVerificationTimer(); settingsDetail.value = null } })
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
function acceptOrder(order, { skipHtSync = false } = {}) {
  if (!systemRunning.value) return
  const typeError = orderTypeError(order.type, order)
  if (typeError) { ElMessage.error(typeError); return }
  demoOrders.value.unshift(enrichOrder(order))
  if (!skipHtSync) addManualEquityOrderToPool(order)
  tab.value = 'orders'
  publishTransactionMessage({ name: order.name, code: order.code, status: '订单已提交', quantity: order.quantity, quantityLabel: '订单数量', title: '订单提交成功' })
}
function openTrsOrderTicket(request) {
  trsOrderRequest.value = request
  trsOrderTicketVisible.value = true
}
function acceptTrsOrder(order) {
  acceptOrder(order, { skipHtSync: true })
  recordPlacedTrsOrder({ sourceOrderId: trsOrderRequest.value?.sourceOrderId, order })
  trsOrderRequest.value = null
  trsOrderTicketVisible.value = false
}
function numericValue(value) { return Number(String(value ?? '').replace(/[^\d.-]/g, '')) || 0 }
function recordHtDealInEquity({ order, deal, quantity }) {
  const account = accountId.value
  const [code, suffix] = String(order.code || '').split('.')
  const customerPrice = numericValue(deal.customerPrice)
  const filledQuantity = Number(quantity) || numericValue(order.quantity)
  const value = customerPrice * filledQuantity
  const id = `ht-deal-${order.id}`
  const position = {
    id, code, name: order.underlying, market: suffix === 'SH' ? 'SH' : 'SZ', price: customerPrice, cost: customerPrice, change: 0,
    qty: filledQuantity, available: order.direction === '卖出' ? filledQuantity : 0, direction: order.direction === '卖出' ? '空' : '多', currency: 'CNY', executionType: 'highTouch',
    orderType: '手工单', algorithm: 'DMA', orderRemark: `来源 HT 订单：${order.orderNo}`, traderRemark: '已同步成交结果', opening: 0,
    value, valueWan: value / 10000, marginOccupied: value * 0.1, marginRate: 10, floatingProfit: 0, dailyRealizedProfit: 0, totalProfit: 0,
    positionDate: timestampNow().slice(0, 10), account, lotSize: 100,
  }
  syncedHtPositions.value = [position, ...syncedHtPositions.value.filter(item => item.id !== id)]
  demoOrders.value = [enrichOrder({
    id, orderNo: `HT-${order.orderNo}`, tradeNo: deal.dealNo, account, code, name: order.underlying, executionType: 'highTouch', algorithm: 'DMA',
    type: 'limit', side: order.direction === '卖出' ? 'sell' : 'buy', openClose: order.attribute === '平仓' ? '平' : '开', price: customerPrice,
    quantity: filledQuantity, inputAmount: order.orderValueMode === 'amount' ? numericValue(order.amountValue ?? order.amount) : null, estimate: value,
    status: '全成', attribute: `限价·${order.orderValueMode === 'amount' ? '金额' : '数量'}`,
    orderValueNumber: order.orderValueMode === 'amount' ? numericValue(order.amountValue ?? order.amount) : filledQuantity,
    orderValue: order.orderValueMode === 'amount' ? `${money(numericValue(order.amountValue ?? order.amount))} CNY` : `${number(filledQuantity)} 股`,
    filledQuantity, filledPrice: customerPrice, feedback: `HT 订单 ${order.orderNo} 成交已同步。`, orderTime: timestampNow(),
    orderRemark: `来源 HT 订单：${order.orderNo}`, traderRemark: '已同步成交结果',
  }), ...demoOrders.value.filter(item => item.id !== id)]
  publishOrderActivityMessage(demoOrders.value[0])
  tab.value = 'trades'
  publishTransactionMessage({ name: order.underlying, code, status: '订单全部成交', quantity: filledQuantity, price: customerPrice, title: 'HT订单成交已同步' })
}
function loadPositionIntoTicket(row) {
  if (!systemRunning.value) return
  accountId.value = row.account
  selectedCode.value = row.code
  ticketContext.value = {
    executionType: row.executionType === 'highTouch' ? 'highTouch' : 'lowTouch',
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
  const typeError = orderTypeError(order.type, order)
  if (typeError) { ElMessage.error(typeError); return }
  demoOrders.value.unshift(enrichOrder(order))
  tab.value = 'orders'
  publishTransactionMessage({ name: order.name, code: order.code, status: '卖出平仓订单已提交', quantity: order.quantity, quantityLabel: '订单数量', title: '平仓订单提交成功' })
}
function acceptChaseOrder(order) {
  if (!systemRunning.value) return
  const typeError = orderTypeError(order.type, order)
  if (typeError) { ElMessage.error(typeError); return }
  const nextOrder = enrichOrder(order)
  demoOrders.value.unshift(nextOrder)
  publishOrderActivityMessage(nextOrder)
  tab.value = 'orders'
}
function openOrderHistory(row) { historyRecord.value = row; historyVisible.value = true }
function cancelableQuantity(row) { return Math.max(0, row.quantity - (row.filledQuantity || 0)) }
function canOperateOrder(row) { return systemRunning.value && cancelableQuantity(row) > 0 && ['待报', '已报', '部成'].includes(row.status) }
const terminalOrderStatuses = new Set(['部撒', '撤单', '全成', '被拒绝', '审核拒绝'])
function isTerminalOrder(row) { return terminalOrderStatuses.has(row.status) }
function canChaseOrder(row) { return systemRunning.value && (isTerminalOrder(row) || canOperateOrder(row)) }
function canAmendOrder(row) { return !isTerminalOrder(row) && canOperateOrder(row) }
function canConvertToManual(row) { return systemRunning.value && row.status === '被拒绝' && row.orderType === '系统单' }
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
  row.feedback = `${row.feedback || '系统拒绝'}；已转为手工单，待交易员处理`
  publishOrderActivityMessage(row)
  publishTransactionMessage({
    name: row.name, code: row.code, status: '已转为手工单', quantity: row.quantity,
    quantityLabel: '订单数量', price: row.price, priceLabel: '订单价格', title: '订单已转手工单',
    content: `${row.name}（${row.code}）被拒绝系统单已转为手工单，订单编号 ${row.orderNo} 保持不变。`,
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
  const typeError = orderTypeError(amendment.type, { ...amendingSymbol.value, ...row })
  if (typeError) { ElMessage.error(typeError); return }
  const isLimit = amendment.type !== 'market'
  const nextPrice = isLimit ? amendment.price : null
  const delta = amendment.quantityDelta
  const referencePrice = nextPrice ?? amendingSymbol.value?.price ?? 0
  const amendedBaseQuantity = delta > 0 ? row.quantity : amendment.quantity
  if (row.filledQuantity > 0) {
    // The filled portion is immutable; replace only the outstanding shares.
    const outstanding = Math.max(0, row.quantity - row.filledQuantity)
    const replacementQuantity = amendment.quantity - row.filledQuantity
    const id = Date.now()
    const replacementOrderNo = replacementQuantity > 0 ? `WT${id}` : null
    row.canceledQuantity = (row.canceledQuantity || 0) + outstanding
    row.canceledAmount = (row.canceledAmount || 0) + outstanding * (row.price ?? amendingSymbol.value?.price ?? 0)
    row.reportQuantity = 0
    row.frozenMargin = 0
    row.status = '部撒'
    row.feedback = replacementOrderNo
      ? `未成交部分已撤，关联改单订单 ${replacementOrderNo}`
      : '未成交部分已撤，已成交记录保持不变'
    if (replacementOrderNo) {
      const replacementAmount = amendment.inputAmount === null ? null : replacementQuantity * referencePrice
      const replacementOrder = enrichOrder({
        id: `amend-replacement-${id}`, orderNo: replacementOrderNo,
        account: row.account, accountLabel: row.accountLabel, code: row.code, name: row.name, market: row.market,
        executionType: amendment.executionType, orderType: amendment.executionType === 'highTouch' ? '手工单' : '系统单',
        algorithm: amendment.algorithm, algorithmParams: amendment.algorithmParams, orderRemark: amendment.note, note: amendment.note,
        type: amendment.type, side: amendment.side, openClose: row.openClose, status: '待报',
        attribute: `${isLimit ? '限价' : '市价'}·${replacementAmount === null ? '数量' : '金额'}`,
        quantity: replacementQuantity, price: nextPrice, inputAmount: replacementAmount,
        orderValueNumber: replacementAmount ?? replacementQuantity,
        orderValue: replacementAmount === null ? `${number(replacementQuantity)} 股` : `${money(replacementAmount)} CNY`,
        filledQuantity: 0, filledPrice: null, estimate: referencePrice * replacementQuantity,
        feedback: `关联原订单 ${row.orderNo} 的未成交部分`, parentOrderNo: row.orderNo,
      })
      demoOrders.value.unshift(replacementOrder)
    }
    ElMessage.success('改单提交成功')
    tab.value = 'orders'
    return
  }
  row.executionType = amendment.executionType
  row.orderType = amendment.executionType === 'highTouch' ? '手工单' : '系统单'
  row.side = amendment.side
  row.type = amendment.type
  row.price = nextPrice
  row.algorithm = amendment.algorithm
  row.algorithmParams = amendment.algorithmParams
  row.orderRemark = amendment.note
  row.note = amendment.note
  row.attribute = `${isLimit ? '限价' : '市价'}·${amendment.inputAmount === null ? '数量' : '金额'}`
  row.inputAmount = amendment.inputAmount === null ? null : delta > 0 ? amendedBaseQuantity * referencePrice : amendment.inputAmount
  row.orderValueNumber = row.inputAmount ?? amendedBaseQuantity
  row.orderValue = row.inputAmount === null ? `${number(amendedBaseQuantity)} 股` : `${money(row.inputAmount)} CNY`
  row.estimate = referencePrice * amendedBaseQuantity
  row.frozenMargin = row.estimate * .4
  row.status = '已报待改'
  if (delta > 0) {
    const id = Date.now()
    const chaseAmount = amendment.inputAmount === null ? null : delta * referencePrice
    demoOrders.value.unshift(enrichOrder({
      id: `amend-chase-${id}`, orderNo: `WT${id}`, account: row.account, code: row.code, name: row.name,
      executionType: row.executionType, orderType: row.orderType, algorithm: row.algorithm, algorithmParams: row.algorithmParams,
      orderRemark: row.orderRemark, note: row.note, type: row.type, side: row.side, openClose: row.openClose,
      status: '待报', attribute: row.attribute, quantity: delta, price: nextPrice, inputAmount: chaseAmount,
      orderValueNumber: chaseAmount ?? delta, orderValue: chaseAmount === null ? `${number(delta)} 股` : `${money(chaseAmount)} CNY`,
      filledQuantity: 0, filledPrice: null,
      estimate: referencePrice * delta, traderRemark: `关联原订单 ${row.orderNo} 的追单`, parentOrderNo: row.orderNo,
    }))
    row.feedback = `改单已受理：新增追单 ${number(delta)} 股`
  } else if (delta < 0) {
    const canceledQuantity = Math.abs(delta)
    row.quantity = amendment.quantity
    row.canceledQuantity = (row.canceledQuantity || 0) + canceledQuantity
    row.canceledAmount = (row.canceledAmount || 0) + canceledQuantity * (nextPrice ?? 0)
    row.reportQuantity = Math.max(0, amendment.quantity - (row.filledQuantity || 0))
    row.frozenMargin = row.estimate * .4
    row.feedback = `改单已受理：部撤 ${number(canceledQuantity)} 股`
  } else {
    row.feedback = '改单已受理：订单参数已更新'
  }
  ElMessage.success('改单提交成功')
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
    publishOrderActivityMessage(row)
    publishOrderOperationMessage(row, '撤单', false)
    cancelOrderVisible.value = false
    cancelingOrder.value = null
    return
  }
  row.status = row.filledQuantity > 0 ? '部撒' : '撤单'
  row.canceledQuantity = cancelableQuantity(row)
  row.reportQuantity = 0
  row.frozenMargin = 0
  row.feedback = '撤单成功'
  publishOrderActivityMessage(row)
  publishOrderOperationMessage({ ...row, quantity: row.canceledQuantity, filledQuantity: 0 }, '撤单', true)
  cancelOrderVisible.value = false
  cancelingOrder.value = null
}
useDialogShortcuts(cancelOrderVisible, { confirm: confirmCancelOrder, cancel: () => { cancelOrderVisible.value = false } })
useDialogShortcuts(convertManualVisible, { confirm: confirmConvertToManual, cancel: () => { convertManualVisible.value = false; conversionRemark.value = '' } })
useDialogShortcuts(settingsVisible, { confirm: () => settingsDetail.value === 'password' ? confirmPasswordChange() : saveSettings(), cancel: () => settingsDetail.value === 'password' ? closePasswordDialog() : closeSettings() })
function updateViewportWidth() { viewportWidth.value = window.innerWidth }
onMounted(() => {
  showHeaderNotice.value = localStorage.getItem(headerNoticeKey) !== '1'
  window.addEventListener('resize', updateViewportWidth)
  seedOrderActivityMessages()
  showEmergency(messages.value.find(item => item.urgent))
  window.setTimeout(() => showTransactionToast(messages.value.find(item => item.trade)), 350)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewportWidth)
  clearPasswordVerificationTimer()
  transactionToastTimers.forEach(({ countdownTimer, dismissTimer }) => { window.clearInterval(countdownTimer); window.clearTimeout(dismissTimer) })
  transactionToastTimers.clear()
})
provide(tradingContextKey, {
  acceptAmendOrder, acceptChaseOrder, acceptClosePosition, acceptOrder, acceptTrsOrder, account, accountLabel, activeTraderGroup, activeTraderPrimary,
  activeTraderSecondary, allAccountsValue, allRows, amendOrderVisible, amendingAccount, amendingOrder, amendingSymbol, applyFilters, applyOrderFilters,
  applyTradeFilters, assetAmountParts, assetUrl, assetsCollapsed, assetsVisible, canAmendOrder, canChaseOrder, canConvertToManual, canOperateOrder,
  cancelOrderVisible, cancelableQuantity, canceledOrderValue, cancelingOrder, chaseOrderVisible, chasingAccount, chasingOrder, chasingPosition, clearFilters,
  clearOrderFilters, clearTradeFilters, closePositionVisible, closingAccount, closingPosition, collapsed, columnOptions, confirmCancelOrder, confirmConvertToManual,
  confirmExport, conversionRemark, convertManualVisible, convertingManualOrder, copyableIdentifierCellClass, currencyForRow, dismissTransactionToast, dock, dragging,
  fillProgress, filledAmount, filtered, filteredGlobalAccounts, floatStyle, floating, floatingPnlClass, globalAccountSearch, handleGlobalAccountVisible,
  handlePositionRowDoubleClick, handleTableCellDoubleClick, historyRecord, historyVisible, instruments, invertOrderStatuses, isTicketLayoutModified, marketLabel,
  messageIcon, openAmendOrder, openCancelOrder, openChaseOrder, openClosePosition, openConvertToManual, openOrderChase, openOrderHistory, openTrsOrderTicket,
  openTrsPoolExport, orderActionLabel, orderActivity, orderActivityHint, orderColumnDefaults, orderColumnOptions, orderFilterBar, orderFilters, orderRowClassName,
  orderSortState, orderStatusOptions, orderStatusVisual, orderValueLabel, orderVisibleColumnKeys, orders, portfolioFloatingPnl, portfolioMarketValue, positionColumnDefaults,
  positionType, query, quote, realtimeAvailable, recordHtDealInEquity, refreshTable, resetTicketLayout, resizing, selectAllOrderStatuses,
  selectTicketAccount, selectTraderPrimary, selected, selectedAccountIds, selectedCode, sharesWithUnit, sortState, sortedOrders, sortedRows,
  sortedTrades, start, startResize, systemRunning, tab, table, tableRefreshKey, ticketContext, ticketResetKey,
  timeLabel, toggleAssetsVisible, toggleOrderSort, toggleOrderStatus, toggleSort, toggleSystemStatus, toggleTradeSort, tradeColumnDefaults, tradeColumnOptions,
  tradeFilters, tradeSortState, tradeStatusLabel, tradeStatusVisual, tradeVisibleColumnKeys, traderPrimaryMenu, traderSecondaryCollapsed, trades, transactionToasts,
  trsOrderRequest, trsOrderTicketVisible, trsTicketInstruments, trsTicketSymbol, updateGlobalAccountSelection, visibleColumnKeys, visibleOrderFilterCount, workspace,
})
</script>

<template>
  <TradingAppShell :variant="variant" :visible-nav="visibleNav" :overflow-nav="overflowNav" :active-nav="activeNav" :show-header-notice="showHeaderNotice" :system-notice-enabled="systemNoticeEnabled" :system-running="systemRunning" :header-notice="headerNotice" :show-unread-badge="showUnreadBadge" :unread-message-count="unreadMessageCount" :help-center-url="helpCenterUrl" @select-nav="selectProductNav" @open-message-center="openMessageCenter" @dismiss-notice="dismissHeaderNotice" @open-settings="settingsVisible=true" @open-help-center="openHelpCenter" @trigger-demo-toast="triggerDemoTransactionToast">
    <OptionsTradingPage v-if="activeNav === '期权交易'" />
    <FinancingPage v-else-if="activeNav === '融资申请'" />
    <StrategyTradingPage v-else-if="activeNav === '策略交易'" />
    <DataPage v-else-if="activeNav === '数据'" />
    <EquityTradingPage v-else />
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
  </TradingAppShell>
</template>
