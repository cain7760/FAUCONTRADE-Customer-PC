<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeft, RefreshRight, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import BaseDialog from '../../../components/BaseDialog.vue'
import TrsApprovalDialog from './TrsApprovalDialog.vue'
import OrderHistoryDialog from './OrderHistoryDialog.vue'
import TrsCustomerOrderInfo from './TrsCustomerOrderInfo.vue'
import TrsSplitDraftTable from './TrsSplitDraftTable.vue'
import TrsSystemOrdersTable from './TrsSystemOrdersTable.vue'
import TrsDoneOrdersTable from './TrsDoneOrdersTable.vue'
import { positions } from '../fixtures'
import { normalizeOrderType, orderTypeError } from '../orderMarketRules.js'
import { claimedHtOrders, placedTrsOrders } from '../trsOrderStore'

const emit = defineEmits(['back-to-pool', 'place-order', 'deal-recorded'])
const activeView = ref('todo')
const keyword = ref('')
const keywordFocused = ref(false)
const statusFilter = ref([])
const doneFilters = ref({ customer: '', customerCode: '', orderNo: '', underlying: '', status: '' })
const appliedDoneFilters = ref({ ...doneFilters.value })
const donePage = ref(1)
const donePageSize = 10
const selectedDoneOrders = ref([])
const doneColumnDefaults = ['customerInfo', 'customerOrder', 'traderOrder', 'dealInfo']
const doneColumnOptions = [
  ['customerInfo', '客户信息'],
  ['customerOrder', '客户下单信息'],
  ['traderOrder', '交易员下单信息'],
  ['dealInfo', '成交信息'],
]
const visibleDoneColumnKeys = ref([...doneColumnDefaults])
const selectedOrderId = ref('trs-001')
const splitVisible = ref(false)
const approvalVisible = ref(false)
const rejectVisible = ref(false)
const lineCancelVisible = ref(false)
const lineToCancel = ref(null)
const editingSystemOrderId = ref(null)
const systemOrderEditDraft = ref(null)
const splitLines = ref([])
const splitAlgorithmPopoverLineId = ref(null)
const splitAlgorithmDraft = ref({ strategy: 'DMA', povHours: 1, povMinutes: 0, participation: 10 })
// Keep the split-order counterparties aligned with the quick-order ticket.
const splitCounterparties = [
  { label: '线下单', value: 'offline' },
  { label: '中金公司', value: '中金公司' },
  { label: '中信证券', value: '中信证券' },
  { label: '国泰君安', value: '国泰君安' },
]
const rejectionReason = ref('')
const splitError = ref('')
const rejectError = ref('')
const customerRefreshing = ref(false)
const customerRefreshTime = ref('账户实时概览')
const heldUnderlyings = positions.map(position => ({
  underlying: position.name,
  code: `${position.code}.${position.market}`,
  price: position.price.toFixed(2),
}))
const customerNames = ['Kevin_292933', 'Olivia_102484', 'Ethan_843701', 'Sophia_591620', 'Liam_308416', 'Ava_774209', 'Noah_663845', 'Emma_420918', 'Lucas_857340', 'Mia_184276', 'Leo_530192', 'Ivy_949601', 'Owen_271860', 'Jade_560281', 'Harper_476910', 'Grace_183607']
const povHourOptions = Array.from({ length: 24 }, (_, hour) => hour)
const povMinuteOptions = Array.from({ length: 60 }, (_, minute) => minute)
function dealQuantityValue(value) {
  const text = String(value ?? '')
  return toNumeric(text) * (text.includes('万') ? 10000 : 1)
}
function calculatedPrincipal(price, quantity) { return toNumeric(price) * dealQuantityValue(quantity) }
function formatPrincipal(price, quantity) {
  const value = calculatedPrincipal(price, quantity)
  return value > 0 ? `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CNY` : ''
}
function dealQuantityLabel(order, price) {
  if (order.orderValueMode !== 'amount') return order.quantity
  const priceValue = toNumeric(price)
  if (!priceValue) return ''
  const quantity = toNumeric(order.amountValue ?? order.amount) / priceValue
  return quantity > 0 ? `${quantity.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} 股` : ''
}
const customerFrameworkMarkupRate = 0.05
function completedCustomerDeal(order) {
  const recordedDeals = order?.dealRecords || []
  if (recordedDeals.length) {
    const quantity = recordedDeals.reduce((total, deal) => total + Number(deal.quantity || 0), 0)
    const amount = recordedDeals.reduce((total, deal) => total + Number(deal.price || 0) * Number(deal.quantity || 0), 0)
    if (quantity > 0 && Number.isFinite(amount)) return { price: amount / quantity, quantity }
  }
  const completedOrders = (order?.systemOrders || []).filter(line => line.orderStatus === '已成交')
  if (!completedOrders.length) return null
  const quantity = completedOrders.reduce((total, line) => total + Number(line.quantity || 0), 0)
  const amount = completedOrders.reduce((total, line) => total + Number(line.price || 0) * Number(line.quantity || 0), 0)
  if (!quantity || !Number.isFinite(amount)) return null
  return {
    price: amount / quantity * (1 + customerFrameworkMarkupRate),
    quantity: quantity * (1 + customerFrameworkMarkupRate),
  }
}
function formatCompletedDealQuantity(value) {
  return `${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} 股`
}
function doneOrderInputValue(order) {
  if (order?.orderValueMode === 'amount') return formatSplitValue(order.amountValue ?? toNumeric(order.amount), true)
  return order?.quantity || '--'
}
function doneOrderOutputValue(order) {
  if (order?.orderValueMode === 'amount') return dealQuantityLabel(order, order.price) || '--'
  return order?.amount || '--'
}
function doneSystemOrderValue(order, formatter, separator = '、') {
  const values = (order?.systemOrders || []).map(formatter).filter(value => value !== undefined && value !== null && value !== '')
  return values.length ? values.join(separator) : '--'
}
function doneSystemOrderStatus(order) {
  const statuses = (order?.systemOrders || []).map(line => line.orderStatus).filter(Boolean)
  if (!statuses.length) return '--'
  if (statuses.some(status => ['异常', '撤单失败'].includes(status))) return '异常'
  if (statuses.includes('委托中')) return '委托中'
  if (statuses.every(status => status === '已成交')) return '已成交'
  if (statuses.every(status => status === '已撤单')) return '已撤单'
  return statuses[0]
}
function doneSystemOrderPrice(line) {
  const price = Number(line?.price)
  return Number.isFinite(price) && price > 0 ? price.toFixed(2) : '--'
}
function doneSystemOrderInputValue(line) {
  return line?.orderValueMode === 'amount'
    ? formatSplitValue(line.inputAmount ?? line.amount, true)
    : formatSplitValue(line.quantity, false)
}
function doneSystemOrderDealAmount(line) {
  if (line?.orderStatus !== '已成交') return '--'
  return line.deal?.nominalPrincipal || formatPrincipal(line.price, line.quantity) || '--'
}
function doneSystemOrderDealQuantity(line) {
  if (line?.orderStatus !== '已成交') return '--'
  return line.deal?.counterpartyQuantity || formatCompletedDealQuantity(Number(line.quantity) || 0)
}
function doneDealNo(order) {
  return order?.dealRecords?.map(record => String(record.dealNo || '').trim()).filter(Boolean).join('、') || order?.deal?.dealNo || '--'
}
function doneDealPrice(order) {
  const deal = completedCustomerDeal(order)
  return deal ? deal.price.toFixed(2) : '--'
}
function doneDealQuantity(order) {
  const deal = completedCustomerDeal(order)
  return deal ? formatCompletedDealQuantity(deal.quantity) : '--'
}
function withCalculatedPrincipals(deal) {
  return {
    ...deal,
    nominalPrincipal: formatPrincipal(deal.counterpartyPrice, deal.counterpartyQuantity),
    customerPrincipal: formatPrincipal(deal.customerPrice, deal.customerQuantity),
  }
}

function createDealInfo(order) {
  const isDealAllocationPending = order.status === 'dealAllocationPending'
  const nominalPrincipal = formatPrincipal(order.price, order.quantity)
  return {
    dealNo: '',
    counterpartyPrice: order.status === 'rejected' ? '--' : isDealAllocationPending ? '' : order.price,
    counterpartyQuantity: order.status === 'rejected' ? '--' : isDealAllocationPending ? '' : order.quantity,
    nominalPrincipal: order.status === 'rejected' ? '--' : isDealAllocationPending ? '' : nominalPrincipal,
    pendingAllocatedPrincipal: order.status === 'rejected' ? order.amount : isDealAllocationPending ? '' : '0.00 CNY',
    customerPrice: order.status === 'rejected' ? '--' : isDealAllocationPending ? '' : order.price,
    customerQuantity: order.status === 'rejected' ? '--' : isDealAllocationPending ? '' : order.quantity,
    customerPrincipal: order.status === 'rejected' ? '--' : isDealAllocationPending ? '' : nominalPrincipal,
  }
}

function createManualSplitDealInfo() {
  return {
    dealNo: '',
    counterpartyPrice: '',
    counterpartyQuantity: '',
    nominalPrincipal: '',
    pendingAllocatedPrincipal: '',
    customerPrice: '',
    customerQuantity: '',
    customerPrincipal: '',
  }
}

function createInitialSystemOrders(order) {
  const hasPlacedTraderOrder = ['orderProcessed', 'dealAllocationPending', 'feedbackCompleted'].includes(order.status)
    || (order.status === 'amendCompleted' && order.traderOrderPlaced)
  if (!hasPlacedTraderOrder) return []
  const isAmount = order.orderValueMode === 'amount'
  const sourceValue = isAmount ? order.amountValue ?? order.amount : order.quantityValue ?? order.quantity
  const total = Number(String(sourceValue || 0).replace(/[^\d.-]/g, '')) || 0
  const price = Number(String(order.price || 0).replace(/[^\d.-]/g, '')) || 0
  const isNonstandard = order.standard === '非标'
  const isFilled = ['dealAllocationPending', 'feedbackCompleted'].includes(order.status)
  return [{
    id: `${order.id}-system-1`,
    counterparty: isNonstandard ? null : '中金公司',
    executionChannel: isNonstandard ? 'offline' : 'counterparty',
    account: order.account,
    orderType: 'limit',
    price,
    quantity: isAmount && price > 0 ? Number((total / price).toFixed(2)) : total,
    inputAmount: isAmount ? total : null,
    orderValueMode: isAmount ? 'amount' : 'quantity',
    side: order.direction === '卖出' ? 'sell' : 'buy',
    strategy: 'DMA',
    orderStatus: isFilled ? '已成交' : '委托中',
    deal: isFilled ? { nominalPrincipal: order.amount || formatPrincipal(price, total), counterpartyQuantity: order.quantity || formatCompletedDealQuantity(total) } : undefined,
  }]
}
function createInitialCustomerDealRecords(order) {
  if (order.status !== 'feedbackCompleted') return []
  return [{ id: `${order.id}-customer-deal-1`, dealNo: `CJ${String(order.orderNo).replace(/\D/g, '').slice(-8)}`, price: toNumeric(order.price), quantity: toNumeric(order.quantity) }]
}

const orders = ref([
  { id: 'trs-001', underlying: '中证500指数收益互换', code: '000905.SH', customer: '华信资产管理', orderNo: 'HT202609220001', standard: '标准', status: 'orderPending', account: 'TRS_T0 - 自营一号', direction: '买入', attribute: '开仓', price: '6,850.00', quantity: '100 万', amount: '10,000,000.00 CNY', submittedAt: '2026-09-22 09:36:12', remark: '请在流动性允许范围内完成建仓。', customerCode: 'CUS-001024', assets: '128,560,000.00 CNY', available: '46,250,000.00 CNY' },
  { id: 'trs-014', underlying: '中国平安', code: '601318.SH', customer: '吴桐资产', orderNo: 'HT202609220013', standard: '标准', status: 'orderPending', account: 'TRS_T1 - 自营二号', direction: '买入', attribute: '开仓', price: '48.60', quantity: '493,827 股', quantityValue: 493827, amount: '24,000,000.00 CNY', amountValue: 24000000, orderValueMode: 'amount', submittedAt: '2026-09-22 10:52:16', remark: '客户按订单金额提交，拆单时按金额分配。', customerCode: 'CUS-003106', assets: '156,900,000.00 CNY', available: '51,680,000.00 CNY' },
  { id: 'trs-002', underlying: '沪深300指数收益互换', code: '000300.SH', customer: '景行私募基金', orderNo: 'HT202609220002', standard: '非标', status: 'orderProcessed', account: 'TRS_T0 - 自营一号', direction: '卖出', attribute: '平仓', price: '3,962.18', quantity: '80 万', amount: '8,000,000.00 CNY', submittedAt: '2026-09-22 09:41:06', remark: '与原合约同日结算。', customerCode: 'CUS-001138', assets: '92,800,000.00 CNY', available: '18,420,000.00 CNY' },
  { id: 'trs-003', underlying: '中证新能源指数收益互换', code: '930997.CSI', customer: '明德投资', orderNo: 'HT202609220003', standard: '标准', status: 'amendCompleted', amendedPrice: 2210, account: 'TRS_T1 - 自营二号', direction: '买入', attribute: '开仓', price: '2,185.30', quantity: '50 万', amount: '5,000,000.00 CNY', submittedAt: '2026-09-22 09:48:24', processedAt: '2026-09-22 09:48:25', remark: '系统已自动完成客户改单。', customerCode: 'CUS-001516', assets: '76,230,000.00 CNY', available: '21,630,000.00 CNY', request: '客户申请将委托价格调整为 2,210.00，系统已自动完成。' },
  { id: 'trs-004', underlying: '中证红利低波指数收益互换', code: 'H30269.CSI', customer: '安和基金', orderNo: 'HT202609220004', standard: '非标', status: 'cancelled', account: 'TRS_T1 - 自营二号', direction: '卖出', attribute: '平仓', price: '9,672.40', quantity: '30 万', amount: '3,000,000.00 CNY', submittedAt: '2026-09-22 09:56:40', processedAt: '2026-09-22 09:56:41', remark: '系统已自动完成客户撤单。', customerCode: 'CUS-001882', assets: '55,800,000.00 CNY', available: '12,410,000.00 CNY', request: '客户申请撤销当前委托，系统已自动完成。' },
  { id: 'trs-006', underlying: '中证银行指数收益互换', code: '399986.SZ', customer: '嘉禾资产', orderNo: 'HT202609220005', standard: '标准', status: 'orderPending', account: 'TRS_T0 - 自营一号', direction: '买入', attribute: '开仓', price: '6,104.72', quantity: '100 万', amount: '12,000,000.00 CNY', submittedAt: '2026-09-22 10:06:18', remark: '优先使用现券对冲风险敞口。', customerCode: 'CUS-002084', assets: '142,680,000.00 CNY', available: '38,990,000.00 CNY' },
  { id: 'trs-007', underlying: '国证2000指数收益互换', code: '399303.SZ', customer: '恒睿资本', orderNo: 'HT202609220006', standard: '非标', status: 'orderProcessed', account: 'TRS_T2 - 自营三号', direction: '卖出', attribute: '平仓', price: '7,326.15', quantity: '45 万', amount: '4,500,000.00 CNY', submittedAt: '2026-09-22 10:12:36', remark: '与客户确认净额结算日期。', customerCode: 'CUS-002249', assets: '63,440,000.00 CNY', available: '15,720,000.00 CNY' },
  { id: 'trs-008', underlying: '中证消费50指数收益互换', code: '931139.CSI', customer: '博远基金', orderNo: 'HT202609220007', standard: '标准', status: 'dealAllocationPending', account: 'TRS_T1 - 自营二号', direction: '买入', attribute: '开仓', price: '4,851.63', quantity: '70 万', amount: '7,000,000.00 CNY', submittedAt: '2026-09-22 10:18:04', remark: '上手方已成交，等待成交分配。', customerCode: 'CUS-002376', assets: '108,920,000.00 CNY', available: '27,480,000.00 CNY' },
  { id: 'trs-009', underlying: '中债国开债收益率曲线', code: 'CGBY.CNI', customer: '合瑞投资', orderNo: 'HT202609220008', standard: '非标', status: 'amendCompleted', traderOrderPlaced: true, amendedQuantityValue: 90, account: 'TRS_T2 - 自营三号', direction: '卖出', attribute: '平仓', price: '2.38', quantity: '100 万', amount: '20,000,000.00 CNY', submittedAt: '2026-09-22 10:25:43', processedAt: '2026-09-22 10:25:44', remark: '交易员已下单，系统已自动完成客户改单。', customerCode: 'CUS-002451', assets: '225,600,000.00 CNY', available: '86,210,000.00 CNY', request: '客户申请将订单数量调整为 90 万，系统已自动完成。' },
  { id: 'trs-016', underlying: '国证2000指数收益互换', code: '399303.SZ', customer: '启明资产', orderNo: 'HT202609220015', standard: '标准', status: 'amendFailed', riskTag: 'rejected', amendedQuantityValue: 90, account: 'TRS_T1 - 自营二号', direction: '买入', attribute: '开仓', price: '6,326.15', quantity: '60 万', amount: '6,000,000.00 CNY', submittedAt: '2026-09-22 10:50:42', processedAt: '2026-09-22 10:50:43', remark: '客户申请扩大订单数量，风控校验未通过，改单失败。', customerCode: 'CUS-003461', assets: '102,360,000.00 CNY', available: '29,640,000.00 CNY', request: '风控校验未通过，客户申请将订单数量增加至 90 万，改单自动失败并转入已办。' },
  { id: 'trs-015', underlying: '中证全指证券公司指数', code: '399975.SZ', customer: '远成资产', orderNo: 'HT202609220014', standard: '标准', status: 'approvalPending', approvalResumeStatus: 'orderPending', account: 'TRS_T0 - 自营一号', direction: '买入', attribute: '开仓', price: '1,126.48', quantity: '40 万', amount: '4,000,000.00 CNY', submittedAt: '2026-09-22 10:44:36', remark: '交易员提交大额委托审批。', customerCode: 'CUS-003284', assets: '96,500,000.00 CNY', available: '31,200,000.00 CNY', approval: { chain: '交易员 → 风控负责人 → 交易主管', remark: '单笔委托金额超过审批阈值，等待风控复核。', attachments: ['风险评估说明.pdf'], submittedAt: '2026-09-22 10:45:10' } },
  { id: 'trs-005', underlying: '中证1000指数收益互换', code: '000852.SH', customer: '远航资产', orderNo: 'HT202609210028', standard: '标准', status: 'feedbackCompleted', account: 'TRS_T0 - 自营一号', direction: '买入', attribute: '开仓', price: '6,312.70', quantity: '60 万', amount: '6,000,000.00 CNY', submittedAt: '2026-09-21 15:14:28', remark: '已完成客户成交反馈。', customerCode: 'CUS-000946', assets: '188,400,000.00 CNY', available: '62,150,000.00 CNY' },
  { id: 'trs-010', underlying: '沪深300指数收益互换', code: '000300.SH', customer: '瑞川资产', orderNo: 'HT202609210027', standard: '标准', status: 'cancelled', account: 'TRS_T1 - 自营二号', direction: '卖出', attribute: '平仓', price: '3,948.26', quantity: '90 万', amount: '9,000,000.00 CNY', submittedAt: '2026-09-21 14:48:35', remark: '委托已撤销。', customerCode: 'CUS-001697', assets: '116,200,000.00 CNY', available: '34,580,000.00 CNY' },
  { id: 'trs-011', underlying: '中证红利低波指数收益互换', code: 'H30269.CSI', customer: '铭泰基金', orderNo: 'HT202609210026', standard: '非标', status: 'rejected', account: 'TRS_T0 - 自营一号', direction: '买入', attribute: '开仓', price: '9,588.40', quantity: '35 万', amount: '3,500,000.00 CNY', submittedAt: '2026-09-21 14:22:17', remark: '上手方拒绝该笔委托。', customerCode: 'CUS-001845', assets: '89,670,000.00 CNY', available: '24,960,000.00 CNY' },
  { id: 'trs-012', underlying: '中证新能源指数收益互换', code: '930997.CSI', customer: '鸿远私募', orderNo: 'HT202609210025', standard: '标准', status: 'partialCancelled', account: 'TRS_T2 - 自营三号', direction: '卖出', attribute: '平仓', price: '2,201.08', quantity: '65 万', amount: '6,500,000.00 CNY', submittedAt: '2026-09-21 13:56:40', remark: '部分成交后撤销剩余数量。', customerCode: 'CUS-002011', assets: '134,780,000.00 CNY', available: '40,130,000.00 CNY' },
  { id: 'trs-013', underlying: '中证全指医药指数收益互换', code: '932154.CSI', customer: '同益资产', orderNo: 'HT202609210024', standard: '非标', status: 'feedbackCompleted', account: 'TRS_T1 - 自营二号', direction: '买入', attribute: '开仓', price: '7,842.19', quantity: '28 万', amount: '2,800,000.00 CNY', submittedAt: '2026-09-21 13:18:55', remark: '已同步客户最终成交价格。', customerCode: 'CUS-002196', assets: '72,360,000.00 CNY', available: '19,840,000.00 CNY' },
].map((order, index) => {
  const normalizedOrder = {
    ...order,
    customer: customerNames[index],
    ...(order.id === 'trs-004' ? {} : heldUnderlyings[index % heldUnderlyings.length]),
  }
  const dealRecords = createInitialCustomerDealRecords(normalizedOrder)
  const deal = createDealInfo(normalizedOrder)
  const customerQuantity = dealRecords.reduce((total, record) => total + record.quantity, 0)
  const customerAmount = dealRecords.reduce((total, record) => total + record.price * record.quantity, 0)
  return {
    ...normalizedOrder,
    traderOrder: {
      standard: normalizedOrder.standard,
      underlying: normalizedOrder.underlying,
      direction: normalizedOrder.direction,
      attribute: normalizedOrder.attribute,
      price: normalizedOrder.price,
      quantity: normalizedOrder.quantity,
      amount: normalizedOrder.amount,
      submittedAt: normalizedOrder.processedAt || '2026-09-22 10:20:08',
    },
    systemOrders: createInitialSystemOrders(normalizedOrder),
    dealRecords,
    deal: dealRecords.length ? withCalculatedPrincipals({ ...deal, dealNo: dealRecords[0].dealNo, customerPrice: Number((customerAmount / customerQuantity).toFixed(4)), customerQuantity: `${customerQuantity.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} 股`, pendingAllocatedPrincipal: '0.00 CNY' }) : deal,
    history: normalizedOrder.history || [{ label: '客户下单', at: normalizedOrder.submittedAt, detail: '客户订单已提交。' }],
  }
}))

const statusLabel = { orderPending: '下单待处理', orderProcessed: '上手方待反馈', cancelAllocationPending: '撤单待分配', dealAllocationPending: '成交待分配', exceptionPending: '异常待处理' }
const doneStatusLabel = { approvalPending: '审批中', amendCompleted: '改单完成', amendFailed: '改单失败', feedbackCompleted: '已成交', exceptionClosed: '异常已办', cancelled: '已撤单', rejected: '已拒绝', partialCancelled: '部成撤单' }
const todoStatusValues = Object.keys(statusLabel)
const doneStatusValues = Object.keys(doneStatusLabel)
const isDoneAlternative = computed(() => activeView.value === 'doneAlternative')
const worklistStatusLabel = computed(() => isDoneAlternative.value ? doneStatusLabel : statusLabel)
const worklistStatusValues = computed(() => Object.keys(worklistStatusLabel.value))
const allStatusesSelected = computed(() => statusFilter.value.length === worklistStatusValues.value.length)
const statusSelectionIndeterminate = computed(() => statusFilter.value.length > 0 && !allStatusesSelected.value)
function toggleAllStatuses() {
  statusFilter.value = allStatusesSelected.value ? [] : [...worklistStatusValues.value]
}
const allOrders = computed(() => [...orders.value, ...claimedHtOrders.value])
const todoOrders = computed(() => allOrders.value.filter(order => todoStatusValues.includes(order.status)))
const doneOrders = computed(() => allOrders.value.filter(order => doneStatusValues.includes(order.status)))
function hasCompletedCounterpartyOrder(order) { return (order?.systemOrders || []).some(line => line.orderStatus === '已成交') }
function promoteCloseExceptions() {
  const now = new Date()
  const tradingDate = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })
  const tradingHour = Number(now.toLocaleTimeString('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Shanghai' }))
  if (tradingHour < 16) return
  allOrders.value.forEach(order => {
    if (!['orderPending', 'dealAllocationPending'].includes(order.status) || !String(order.submittedAt || '').startsWith(tradingDate)) return
    order.exceptionOriginStatus = order.status
    order.status = 'exceptionPending'
    order.exceptionHasCounterpartyFill = hasCompletedCounterpartyOrder(order)
    order.remark = `${order.remark} 收盘后仍未完成处理，已转为异常待处理。`
    appendHistory(order, '收盘异常', order.exceptionHasCounterpartyFill ? '收盘前成交尚未分配，等待交易员处理。' : '收盘前未完成下单，等待交易员确认未成交。')
  })
}
let closeExceptionTimer
onMounted(() => {
  promoteCloseExceptions()
  closeExceptionTimer = window.setInterval(promoteCloseExceptions, 60_000)
})
onBeforeUnmount(() => window.clearInterval(closeExceptionTimer))
const filteredDoneOrders = computed(() => doneOrders.value.filter(order => {
  const matches = (value, query) => !query || value.toLowerCase().includes(query.trim().toLowerCase())
  return matches(order.customer, appliedDoneFilters.value.customer)
    && matches(order.customerCode, appliedDoneFilters.value.customerCode)
    && matches(order.orderNo, appliedDoneFilters.value.orderNo)
    && matches(order.underlying, appliedDoneFilters.value.underlying)
    && (!appliedDoneFilters.value.status || order.status === appliedDoneFilters.value.status)
}))
const pagedDoneOrders = computed(() => filteredDoneOrders.value.slice((donePage.value - 1) * donePageSize, donePage.value * donePageSize))
watch(filteredDoneOrders, orders => {
  if ((donePage.value - 1) * donePageSize >= orders.length && donePage.value > 1) donePage.value = 1
})
const filteredOrders = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return (activeView.value === 'todo' ? todoOrders.value : doneOrders.value).filter(order => {
    const matchesKeyword = !query || [order.underlying, order.code, order.customer, order.orderNo].some(value => String(value || '').toLowerCase().includes(query))
    return matchesKeyword && (!statusFilter.value.length || statusFilter.value.includes(order.status))
  })
})
const activeOrder = computed(() => filteredOrders.value.find(order => order.id === selectedOrderId.value)
  || filteredOrders.value[0]
  || allOrders.value.find(order => order.id === selectedOrderId.value)
  || allOrders.value[0])
const emptyOrderListText = computed(() => activeView.value === 'todo' ? '未找到匹配的待办订单' : '未找到匹配的已办订单')
function appendPlacedSystemOrder(payload) {
  if (!payload?.sourceOrderId || !payload.order) return
  const order = allOrders.value.find(item => item.id === payload.sourceOrderId)
  if (!order || !todoStatusValues.includes(order.status) || order.systemOrders?.length) return
  const placedOrder = payload.order
  order.systemOrders = [{
    id: placedOrder.id,
    counterparty: placedOrder.counterparty || null,
    executionChannel: placedOrder.executionChannel || 'offline',
    account: placedOrder.account,
    orderType: placedOrder.type,
    price: placedOrder.price,
    quantity: placedOrder.quantity,
    inputAmount: placedOrder.inputAmount,
    orderValueMode: placedOrder.inputAmount === null ? 'quantity' : 'amount',
    side: placedOrder.side,
    strategy: placedOrder.algorithm,
    orderStatus: '委托中',
  }]
  order.traderOrderPlaced = true
  order.status = 'orderProcessed'
  order.deal = createDealInfo(order)
  order.remark = `${order.remark} 已新增 1 笔上手方订单。`
  appendHistory(order, '交易员下单', '已通过快速下单新增上手方订单，等待上手方反馈。')
}
watch(placedTrsOrders, orders => orders.forEach(appendPlacedSystemOrder), { deep: true, immediate: true, flush: 'sync' })
const isApprovalPending = computed(() => activeOrder.value?.status === 'approvalPending')
const isCancelAllocationPending = computed(() => activeOrder.value?.status === 'cancelAllocationPending')
const isDealAllocationPending = computed(() => activeOrder.value?.status === 'dealAllocationPending')
const isExceptionPending = computed(() => activeOrder.value?.status === 'exceptionPending')
const isOrderPlaced = computed(() => activeOrder.value?.status === 'orderProcessed')
const canUpdateCustomerDeal = computed(() => hasCompletedCounterpartyOrder(activeOrder.value))
const displayedDeal = computed(() => completedCustomerDeal(activeOrder.value))
const displayedDealNo = computed(() => activeOrder.value?.dealRecords?.map(record => String(record.dealNo || '').trim()).filter(Boolean).join('、') || activeOrder.value?.deal?.dealNo || '--')
const displayedDealPrice = computed(() => displayedDeal.value ? displayedDeal.value.price.toFixed(2) : '--')
const displayedDealQuantity = computed(() => displayedDeal.value ? formatCompletedDealQuantity(displayedDeal.value.quantity) : '--')
const rejectionDialogTitle = computed(() => '拒绝订单')
const rejectionDialogHint = computed(() => '拒单后该订单将转入已办记录，请确认拒绝原因。')
const rejectionConfirmLabel = computed(() => '确认拒单')
const progressSteps = computed(() => {
  const order = activeOrder.value
  if (!order) return []
  const hasCustomerAmendment = ['amendCompleted', 'amendFailed'].includes(order.status) || order.hasCustomerAmendment
  const amendmentAfterTraderOrder = hasCustomerAmendment && Boolean(order.traderOrderPlaced || order.amendmentAfterTraderOrder || order.systemOrders?.length)
  const steps = [
    { id: 'customer-order', label: '客户已下单', stage: 1 },
    ...(hasCustomerAmendment && !amendmentAfterTraderOrder ? [{ id: 'customer-amend', label: '客户改单', stage: 2 }] : []),
    ...(hasCustomerAmendment && amendmentAfterTraderOrder ? [{ id: 'customer-amend', label: '客户改单', stage: 2 }] : []),
    { id: 'counterparty-pending', label: '上手方待反馈', stage: 4 },
    { id: 'deal-allocation', label: '成交待分配', stage: 5 },
    ...(['exceptionPending', 'exceptionClosed'].includes(order.status) ? [{ id: 'exception', label: order.status === 'exceptionClosed' ? '异常已办' : '异常待处理', stage: 6 }] : []),
    { id: 'completed', label: '客户成交', stage: 7 },
  ]
  const currentStepId = ['exceptionPending', 'exceptionClosed'].includes(order.status) ? 'exception'
    : order.status === 'feedbackCompleted' ? 'completed'
    : order.status === 'dealAllocationPending' ? 'deal-allocation'
      : order.status === 'orderProcessed' ? 'counterparty-pending'
        : ['cancelAllocationPending', 'cancelled', 'partialCancelled'].includes(order.status) ? 'counterparty-pending'
          : ['amendCompleted', 'amendFailed'].includes(order.status) ? 'customer-amend'
            : 'customer-order'
  const currentIndex = steps.findIndex(step => step.id === currentStepId)
  return steps.map((step, index) => ({ ...step, complete: index <= currentIndex }))
})
function selectOrder(id) { selectedOrderId.value = id }
function switchWorklistView(view) {
  activeView.value = view
  keyword.value = ''
  statusFilter.value = []
  splitVisible.value = false
  closeCustomerDealEditor()
}
function searchOrders() {
  const firstMatch = filteredOrders.value[0]
  if (firstMatch) selectedOrderId.value = firstMatch.id
}
function currencyValue(value) { return String(value ?? '').replace(/\s*CNY$/, '') }
const isAmountOrder = computed(() => activeOrder.value?.orderValueMode === 'amount')
const isNonstandardOrder = computed(() => activeOrder.value?.standard === '非标')
const selectableSplitCounterparties = computed(() => isNonstandardOrder.value ? splitCounterparties.slice(0, 1) : splitCounterparties)
const customerFrameworkLabel = computed(() => activeOrder.value?.customerFramework || '价格偏好')
const splitValueLabel = computed(() => isAmountOrder.value ? '金额' : '数量')
const splitInputLabel = computed(() => isAmountOrder.value ? '订单金额' : '订单数量')
function toNumeric(value) { return Number(String(value ?? '').replace(/[^\d.-]/g, '')) || 0 }
function originalOrderValue(order = activeOrder.value) {
  return order?.orderValueMode === 'amount' ? Number(order?.amountValue ?? toNumeric(order?.amount)) : Number(order?.quantityValue ?? toNumeric(order?.quantity))
}
function formatSplitValue(value, mode = isAmountOrder.value) {
  const formatted = Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: mode ? 2 : 0, maximumFractionDigits: 2 })
  return mode ? `${formatted} CNY` : formatted
}
const splitAllocatedDisplay = computed(() => formatSplitValue(splitAllocatedQuantity.value))
const originalSplitValueDisplay = computed(() => isAmountOrder.value ? formatSplitValue(originalOrderValue()) : activeOrder.value?.quantity || '--')
const placedOrderValue = computed(() => Number((activeOrder.value?.systemOrders || []).filter(line => line.orderStatus !== '已撤单').reduce((total, line) => {
  const value = isAmountOrder.value ? line.inputAmount ?? line.amount : line.quantity
  return total + (Number(value) || 0)
}, 0).toFixed(2)))
const remainingOrderValue = computed(() => Math.max(0, Number((originalOrderValue() - placedOrderValue.value).toFixed(2))))
const isOrderFullyPlaced = computed(() => Boolean(activeOrder.value?.systemOrders?.length) || (originalOrderValue() > 0 && remainingOrderValue.value <= 0))
function applyDoneFilters() { appliedDoneFilters.value = { ...doneFilters.value }; donePage.value = 1 }
function resetDoneFilters() {
  doneFilters.value = { customer: '', customerCode: '', orderNo: '', underlying: '', status: '' }
  applyDoneFilters()
}
const doneHistoryVisible = ref(false)
const customerDealEditing = ref(false)
const customerDealEditingOrder = ref(null)
const doneCustomerDealEditVisible = ref(false)
const customerDealSaveConfirmVisible = ref(false)
const exceptionTransferPromptVisible = ref(false)
const doneHistoryOrder = ref(null)
const customerDealRecords = ref([])
const customerDealError = ref('')
const historyDialogRecord = computed(() => {
  const order = doneHistoryOrder.value
  if (!order) return null
  const [code, market] = String(order.code || '').split('.')
  const firstSystemOrder = order.systemOrders?.[0]
  return {
    id: order.id,
    orderNo: order.orderNo,
    name: order.underlying,
    code: code || '--',
    market: market || '--',
    side: order.direction === '卖出' ? 'sell' : 'buy',
    openClose: order.attribute === '平仓' ? '平' : '开',
    account: order.account,
    orderType: '系统单',
    algorithm: firstSystemOrder?.strategy || 'DMA',
    type: firstSystemOrder?.orderType || 'limit',
    price: toNumeric(order.price),
    quantity: order.quantityValue ?? toNumeric(order.quantity),
    inputAmount: order.orderValueMode === 'amount' ? order.amountValue ?? toNumeric(order.amount) : null,
    orderTime: order.submittedAt,
    history: order.history,
  }
})
function openOrderHistory(order) {
  if (!order.history?.length) order.history = [{ label: '客户下单', at: order.submittedAt, detail: '客户订单已提交。' }]
  doneHistoryOrder.value = order
  doneHistoryVisible.value = true
}
function appendHistory(order, label, detail, at = '2026-09-22 10:30:00') {
  order.history = [...(order.history || []), { label, detail, at }]
}
const selectedCompletedDoneOrders = computed(() => selectedDoneOrders.value.filter(order => order.status === 'feedbackCompleted'))
function updateDoneSelection(selection) { selectedDoneOrders.value = selection }
function sendDoneEmail(order) {
  if (order.status !== 'feedbackCompleted') return
  ElMessage.success(`已发送成交结果邮件至 ${order.customer}`)
}
function sendSelectedDoneEmails() {
  const recipients = selectedCompletedDoneOrders.value
  if (!recipients.length) return
  ElMessage.success(`已向 ${recipients.length} 位客户发送成交结果邮件`)
}
function createCustomerDealRecord(values = {}) {
  return { id: values.id || `customer-deal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, dealNo: values.dealNo || '', price: values.price ?? '', quantity: values.quantity ?? '' }
}
function closeCustomerDealEditor() {
  customerDealEditing.value = false
  doneCustomerDealEditVisible.value = false
  customerDealEditingOrder.value = null
  customerDealError.value = ''
}
function openCustomerDealUpdate(appendRecord = false, targetOrder = activeOrder.value) {
  const order = targetOrder
  if (!order) return
  if (!hasCompletedCounterpartyOrder(order)) {
    ElMessage.warning('请先下单且有成交数据才可更新成交信息。')
    return
  }
  customerDealEditingOrder.value = order
  customerDealError.value = ''
  const existingRecords = order.dealRecords?.map(createCustomerDealRecord) || []
  if (existingRecords.length) customerDealRecords.value = existingRecords
  else if (appendRecord) customerDealRecords.value = [createCustomerDealRecord()]
  else {
    const deal = order.deal || createDealInfo(order)
    const calculatedDeal = completedCustomerDeal(order)
    customerDealRecords.value = [createCustomerDealRecord({
      dealNo: deal.dealNo,
      price: deal.customerPrice && deal.customerPrice !== '--' ? deal.customerPrice : calculatedDeal?.price.toFixed(2),
      quantity: dealQuantityValue(deal.customerQuantity) || calculatedDeal?.quantity || '',
    })]
  }
  customerDealEditing.value = true
}
function openDoneCustomerDealUpdate(order) {
  openCustomerDealUpdate(false, order)
  if (customerDealEditingOrder.value === order) doneCustomerDealEditVisible.value = true
}
function addCustomerDealRecord() {
  if (!customerDealEditing.value) { openCustomerDealUpdate(true); return }
  customerDealRecords.value.push(createCustomerDealRecord())
}
function removeCustomerDealRecord(id) {
  if (customerDealRecords.value.length <= 1) return
  customerDealRecords.value = customerDealRecords.value.filter(record => record.id !== id)
}
function requestCustomerDealSave() {
  const invalidRecord = customerDealRecords.value.some(record => !String(record.dealNo).trim() || Number(record.price) <= 0 || Number(record.quantity) <= 0)
  if (invalidRecord) {
    customerDealError.value = '请完整填写每条成交记录的成交编号、成交价格和成交数量。'
    return
  }
  customerDealError.value = ''
  customerDealSaveConfirmVisible.value = true
}
function saveCustomerDealUpdate() {
  const order = customerDealEditingOrder.value || activeOrder.value
  if (!order) return
  const records = customerDealRecords.value.map(record => ({ ...record, dealNo: String(record.dealNo).trim(), price: Number(record.price), quantity: Number(record.quantity) }))
  const quantity = records.reduce((total, record) => total + record.quantity, 0)
  const amount = records.reduce((total, record) => total + record.price * record.quantity, 0)
  const customerPrice = Number((amount / quantity).toFixed(4))
  order.dealRecords = records
  order.deal = withCalculatedPrincipals({
    ...(order.deal || createDealInfo(order)),
    dealNo: records[0].dealNo,
    customerPrice,
    customerQuantity: `${quantity.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} 股`,
    pendingAllocatedPrincipal: '0.00 CNY',
  })
  if (order.status === 'dealAllocationPending') {
    order.status = 'feedbackCompleted'
    order.processedAt = '2026-09-22 10:28:00'
    order.remark = `${order.remark} 已录入 ${records.length} 条客户成交记录。`
    appendHistory(order, '客户成交确认', `已录入 ${records.length} 条客户成交记录并完成订单。`, order.processedAt)
    emit('deal-recorded', { order: { ...order }, deal: { ...order.deal }, quantity })
  } else if (order.status === 'exceptionPending' && order.exceptionOriginStatus === 'dealAllocationPending') {
    order.exceptionDealRecorded = true
    order.remark = `${order.remark} 已录入 ${records.length} 条客户成交记录，等待转已办。`
    appendHistory(order, '成交信息已录入', `已录入 ${records.length} 条客户成交记录，可转已办。`)
  } else if (order.status === 'feedbackCompleted') {
    appendHistory(order, '客户成交信息更新', `已更新 ${records.length} 条客户成交记录。`)
    emit('deal-recorded', { order: { ...order }, deal: { ...order.deal }, quantity })
  }
  customerDealSaveConfirmVisible.value = false
  closeCustomerDealEditor()
  ElMessage.success('客户成交信息已更新')
}
function openExceptionDealUpdate() {
  exceptionTransferPromptVisible.value = false
  openCustomerDealUpdate()
}
function transferExceptionToDone() {
  const order = activeOrder.value
  if (!order || order.status !== 'exceptionPending') return
  const hasCounterpartyFill = hasCompletedCounterpartyOrder(order)
  if (hasCounterpartyFill && !order.exceptionDealRecorded) {
    exceptionTransferPromptVisible.value = true
    return
  }
  order.status = 'exceptionClosed'
  order.processedAt = '2026-09-22 16:00:00'
  if (hasCounterpartyFill) {
    const quantity = (order.dealRecords || []).reduce((total, record) => total + Number(record.quantity || 0), 0)
    order.remark = `${order.remark} 异常订单已录入成交信息并转已办。`
    appendHistory(order, '异常转已办', '已录入成交信息，异常订单转入已办。', order.processedAt)
    emit('deal-recorded', { order: { ...order }, deal: { ...order.deal }, quantity })
  } else {
    order.exceptionOutcome = '未成交'
    order.remark = `${order.remark} 异常订单转已办，确认未成交。`
    appendHistory(order, '异常转已办', '收盘前未完成下单，已确认未成交并转入已办。', order.processedAt)
  }
  ElMessage.success(hasCounterpartyFill ? '已更新成交信息并转入已办' : '已确认未成交并转入已办')
}
function placeEquityOrder() {
  const order = activeOrder.value
  if (!order || isApprovalPending.value || isOrderFullyPlaced.value) return
  const amountMode = order.orderValueMode === 'amount'
  const orderAmount = Number(order.amountValue ?? toNumeric(order.amount))
  const [symbolCode, marketSuffix] = String(order.code || '').split('.')
  const market = ['SH', 'SZ', 'HK'].includes(marketSuffix) ? marketSuffix : 'A'
  const executionType = order.executionType || (order.standard === '非标' ? 'highTouch' : 'lowTouch')
  const algorithm = order.algorithm || 'POV'
  emit('place-order', {
    sourceOrderId: order.id,
    symbol: {
      code: symbolCode,
      name: order.underlying,
      market,
      price: toNumeric(order.price),
      cost: toNumeric(order.price),
      change: 0,
      available: Number.MAX_SAFE_INTEGER,
      lotSize: 100,
    },
    initialOrder: {
      executionType,
      sourceOrderSide: order.direction === '卖出' ? 'sell' : 'buy',
      openClose: order.attribute === '平仓' ? '平' : '开',
      symbolCode,
      accountValue: order.account,
      accountLabel: order.account,
      frameworkName: order.customerFramework || '价格偏好',
      type: order.orderType === 'market' ? 'market' : 'limit',
      price: toNumeric(order.price),
      quantity: amountMode ? undefined : toNumeric(order.quantity),
      amount: amountMode ? orderAmount : undefined,
      quantityMode: amountMode ? 'amount' : 'quantity',
      unit: String(order.quantity || '').includes('万') ? 'wan' : 'shares',
      amountUnit: 'yuan',
      algorithm,
      algorithmParams: algorithm === 'POV' ? order.algorithmParams || { hours: 1, minutes: 0, participation: 10 } : undefined,
      skipQuantityLimit: true,
      counterparty: order.standard === '非标' ? 'offline' : '',
      counterparties: order.standard === '非标' ? [{ label: '线下单', value: 'offline' }] : undefined,
      note: order.remark || '',
    },
  })
}

function createSplitLine(value = null) {
  const order = activeOrder.value
  return {
    id: Date.now() + Math.random(),
    executionType: 'highTouch',
    orderStatus: '委托中',
    counterparty: 'offline',
    account: order?.account || 'TRS_T0 - 自营一号',
    orderType: 'limit',
    price: Number(order?.price?.replace(/,/g, '')) || 0,
    quantity: isAmountOrder.value ? null : value,
    amount: isAmountOrder.value ? value : null,
    side: order?.direction === '卖出' ? 'sell' : 'buy',
    strategy: 'DMA',
    povHours: 1,
    povMinutes: 0,
    participation: 10,
  }
}
function openSplit() {
  if (isApprovalPending.value || isOrderFullyPlaced.value) return
  const orderValue = remainingOrderValue.value
  const firstValue = Number((orderValue / 2).toFixed(2))
  splitLines.value = [createSplitLine(firstValue), createSplitLine(Number((orderValue - firstValue).toFixed(2)))]
  splitError.value = ''
  splitVisible.value = true
}
function addSplitLine() { splitLines.value.push(createSplitLine()) }
function removeSplitLine(index) {
  if (splitLines.value.length === 1) { splitError.value = '至少保留一笔上手方订单。'; return }
  splitLines.value.splice(index, 1)
}
const splitLineValue = line => Number(isAmountOrder.value ? line.amount : line.quantity) || 0
const splitAllocatedQuantity = computed(() => Number(splitLines.value.reduce((sum, line) => sum + splitLineValue(line), 0).toFixed(2)))
const hasInvalidPovSplitLine = line => line.strategy === 'POV' && (!Number.isInteger(Number(line.povHours)) || Number(line.povHours) < 0 || Number(line.povHours) > 23 || !Number.isInteger(Number(line.povMinutes)) || Number(line.povMinutes) < 0 || Number(line.povMinutes) > 59 || (Number(line.povHours) === 0 && Number(line.povMinutes) === 0) || Number(line.participation) <= 0 || Number(line.participation) > 25)
const splitAlgorithmParameterError = computed(() => hasInvalidPovSplitLine(splitAlgorithmDraft.value))
function updateSplitAlgorithmPopover(line, visible) {
  if (!visible) {
    if (splitAlgorithmPopoverLineId.value === line.id) splitAlgorithmPopoverLineId.value = null
    return
  }
  splitAlgorithmDraft.value = { strategy: line.strategy, povHours: line.povHours, povMinutes: line.povMinutes, participation: line.participation }
  splitAlgorithmPopoverLineId.value = line.id
}
function cancelSplitAlgorithmConfig() { splitAlgorithmPopoverLineId.value = null }
function confirmSplitAlgorithmConfig() {
  if (splitAlgorithmParameterError.value) return
  const line = splitLines.value.find(item => item.id === splitAlgorithmPopoverLineId.value)
  if (line) Object.assign(line, splitAlgorithmDraft.value)
  splitAlgorithmPopoverLineId.value = null
}
function confirmSplit() {
  const typeError = splitLines.value.map(line => orderTypeError(line.orderType, activeOrder.value)).find(Boolean)
  if (typeError) { splitError.value = typeError; return }
  if (isApprovalPending.value) return
  if (!splitLines.value.length || splitLines.value.some(line => !line.account || splitLineValue(line) <= 0 || (line.orderType === 'limit' && Number(line.price) <= 0))) { splitError.value = `请补全每笔子单的下单账户、价格和${splitValueLabel.value}。`; return }
  if (placedOrderValue.value + splitAllocatedQuantity.value > originalOrderValue()) { splitError.value = `拆分总${splitValueLabel.value}不能超过客户订单${splitValueLabel.value}。`; return }
  if (splitLines.value.some(hasInvalidPovSplitLine)) { splitError.value = 'POV策略需选择有效运行时间，市场成交占比必须为 1–25%。'; return }
  const submittedOrders = splitLines.value.map(line => {
    const counterparty = line.counterparty && line.counterparty !== 'offline' ? line.counterparty : null
    const amount = isAmountOrder.value ? Number(line.amount) : null
    const quantity = isAmountOrder.value && Number(line.price) > 0 ? Number((amount / Number(line.price)).toFixed(2)) : line.quantity
    return { ...line, quantity, inputAmount: amount, orderValueMode: isAmountOrder.value ? 'amount' : 'quantity', counterparty, executionChannel: counterparty ? 'counterparty' : 'offline' }
  })
  activeOrder.value.systemOrders = [...(activeOrder.value.systemOrders || []), ...submittedOrders]
  if (isAmountOrder.value) activeOrder.value.remainingAmount = remainingOrderValue.value
  else activeOrder.value.remainingQuantity = remainingOrderValue.value
  activeOrder.value.splitCount = activeOrder.value.systemOrders.length
  activeOrder.value.deal = createDealInfo(activeOrder.value)
  activeOrder.value.status = 'orderProcessed'
  activeOrder.value.remark = `${activeOrder.value.remark} 已拆分为 ${splitLines.value.length} 笔子单。`
  appendHistory(activeOrder.value, '交易员下单', `已提交 ${splitLines.value.length} 笔上手方订单。`)
  splitVisible.value = false
}
function openApproval() { approvalVisible.value = true }
function submitApproval(approval) {
  const order = activeOrder.value
  order.approvalResumeStatus = order.status
  order.status = 'approvalPending'
  order.approval = { ...approval, submittedAt: '2026-09-22 10:30:00' }
  const approvalDetail = [
    order.approval.chain && `审批流：${order.approval.chain}`,
    order.approval.remark && `审批说明：${order.approval.remark}`,
  ].filter(Boolean).join('；')
  appendHistory(order, '发起转审批', approvalDetail || '已提交审批流，等待审批结果。', order.approval.submittedAt)
  splitVisible.value = false
  approvalVisible.value = false
  activeView.value = 'done'
  selectedOrderId.value = order.id
}
function openLineCancel(line) {
  if (line?.orderStatus !== '委托中') return
  lineToCancel.value = line
  lineCancelVisible.value = true
}
const isEditingSystemOrder = line => editingSystemOrderId.value === line.id
function editSystemOrderLine(line) {
  if (line?.orderStatus !== '委托中') return
  editingSystemOrderId.value = line.id
  systemOrderEditDraft.value = { ...line, orderType: normalizeOrderType(line.orderType, activeOrder.value), counterparty: line.counterparty || (activeOrder.value?.standard === '非标' ? 'offline' : '') }
}
function cancelSystemOrderEdit() {
  editingSystemOrderId.value = null
  systemOrderEditDraft.value = null
}
function saveSystemOrderEdit(line) {
  const target = activeOrder.value?.systemOrders?.find(item => item.id === line.id)
  const draft = systemOrderEditDraft.value
  if (!target || !draft) return
  const typeError = orderTypeError(draft.orderType, activeOrder.value)
  if (typeError) { ElMessage.error(typeError); return }
  Object.assign(target, {
    counterparty: draft.counterparty && draft.counterparty !== 'offline' ? draft.counterparty : null,
    strategy: draft.strategy,
    account: draft.account,
    orderType: draft.orderType,
    price: Number(draft.price) || 0,
    quantity: Number(draft.quantity) || 0,
    inputAmount: draft.orderValueMode === 'amount' ? Number(draft.inputAmount) || 0 : null,
    side: draft.side,
  })
  appendHistory(activeOrder.value, '修改下单明细', `已更新下单明细：${target.counterparty || '线下单'}。`)
  cancelSystemOrderEdit()
  ElMessage.success('下单明细已保存')
}
function confirmLineCancel() {
  const order = activeOrder.value
  const line = order?.systemOrders?.find(item => item.id === lineToCancel.value?.id)
  if (!line || line.orderStatus !== '委托中') { lineCancelVisible.value = false; return }
  line.orderStatus = '已撤单'
  order.remark = `${order.remark} 已撤销 1 笔上手方订单。`
  appendHistory(order, '撤单', '已撤销上手方订单。')
  lineCancelVisible.value = false
  lineToCancel.value = null
  ElMessage.success('上手方订单已撤单')
}
function openReject() { if (isApprovalPending.value) return; rejectionReason.value = ''; rejectError.value = ''; rejectVisible.value = true }
function confirmReject() {
  if (!rejectionReason.value.trim()) { rejectError.value = '请填写拒单原因。'; return }
  const order = activeOrder.value
  order.status = 'rejected'
  order.rejectionReason = rejectionReason.value.trim()
  order.processedAt = '2026-09-22 10:32:00'
  order.remark = `${order.remark} 已拒单：${order.rejectionReason}。`
  appendHistory(order, '拒绝订单', `拒单原因：${order.rejectionReason}`, order.processedAt)
  ElMessage.success('订单已拒绝')
  rejectVisible.value = false
}
async function refreshCustomerAccount() {
  if (customerRefreshing.value) return
  customerRefreshing.value = true
  await new Promise(resolve => window.setTimeout(resolve, 450))
  customerRefreshTime.value = `更新于 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
  customerRefreshing.value = false
}
</script>

<template>
  <section class="trs-my-orders" aria-label="我的HT订单">
    <header class="trs-my-orders-tabbar">
      <nav aria-label="订单视图">
        <button type="button" :class="{ active: activeView === 'todo' }" @click="switchWorklistView('todo')">待办<span>({{ todoOrders.length }})</span></button>
        <button type="button" :class="{ active: activeView === 'done' }" @click="switchWorklistView('done')">已办<span>({{ doneOrders.length }})</span></button>
        <button type="button" :class="{ active: activeView === 'doneAlternative' }" @click="switchWorklistView('doneAlternative')">已办（备选）<span>({{ doneOrders.length }})</span></button>
      </nav>
      <button type="button" class="trs-return-pool" @click="emit('back-to-pool')"><el-icon><ArrowLeft /></el-icon>返回订单池</button>
    </header>

    <template v-if="activeView !== 'done'">
      <template v-if="activeOrder">
      <div class="trs-my-orders-workspace">
        <aside class="trs-order-index" aria-label="HT订单索引">
          <header>
            <h2>订单列表</h2>
            <el-select v-model="statusFilter" multiple clearable placeholder="全部" aria-label="订单状态筛选" popper-class="variant-popper trs-status-filter-popper">
              <template #tag="{ data }"><span v-if="data.length" class="trs-status-filter-summary">{{ data.length === worklistStatusValues.length ? '全部' : `已选 ${data.length}` }}</span></template>
              <template #header><el-checkbox :model-value="allStatusesSelected" :indeterminate="statusSelectionIndeterminate" @change="toggleAllStatuses">全部状态</el-checkbox></template>
              <el-option v-for="(label, value) in worklistStatusLabel" :key="value" :label="label" :value="value"><el-checkbox :model-value="statusFilter.includes(value)">{{ label }}</el-checkbox></el-option>
            </el-select>
          </header>
          <div class="trs-order-index-filters">
            <el-input v-model="keyword" class="trs-order-keyword" :prefix-icon="keywordFocused ? undefined : Search" placeholder="标的/客户名/订单编号" clearable @focus="keywordFocused = true" @blur="keywordFocused = false" @keyup.enter="searchOrders"><template v-if="keywordFocused" #suffix><button type="button" class="trs-order-search-action" aria-label="搜索订单" @mousedown.prevent @click="searchOrders"><el-icon><Search /></el-icon></button></template></el-input>
          </div>
          <nav class="trs-order-index-list" aria-label="选择订单">
            <button v-for="order in filteredOrders" :key="order.id" type="button" :class="{ active: order.id === activeOrder.id }" :aria-current="order.id === activeOrder.id ? 'true' : undefined" @click="selectOrder(order.id)">
              <span class="trs-index-underlying"><b :title="order.underlying">{{ order.underlying }}</b><span class="trs-type-tag" :class="order.standard === '非标' ? 'is-nonstandard' : ''">{{ order.standard }}</span></span>
              <span class="trs-status-tag" :class="`is-${order.status}`">{{ worklistStatusLabel[order.status] }}</span>
              <span class="trs-index-meta"><span><b :title="order.code">{{ order.code }}</b></span><span><i>客户</i><b :title="order.customer">{{ order.customer }}</b></span></span>
              <small class="trs-index-order-no" :title="order.orderNo"><i>订单编号</i><b>{{ order.orderNo }}</b></small>
            </button>
            <p v-if="!filteredOrders.length" class="trs-order-index-empty" aria-live="polite">{{ emptyOrderListText }}</p>
          </nav>
          <footer><span>共 {{ filteredOrders.length }} 条</span><el-pagination small background layout="prev, pager, next" :total="filteredOrders.length" :page-size="10" /></footer>
        </aside>

        <main class="trs-order-workbench">
          <header class="trs-workbench-heading">
            <div><div class="trs-workbench-title"><h1>{{ activeOrder.underlying }}</h1><span class="trs-type-tag" :class="activeOrder.standard === '非标' ? 'is-nonstandard' : ''">{{ activeOrder.standard }}</span><span class="trs-status-tag" :class="`is-${activeOrder.status}`">{{ worklistStatusLabel[activeOrder.status] }}</span></div><p>{{ activeOrder.orderNo }} · {{ activeOrder.account }}</p></div>
            <ol class="trs-order-progress" aria-label="订单处理进度"><li v-for="step in progressSteps" :key="step.id" :class="{ complete: step.complete }">{{ step.label }}</li></ol>
          </header>

          <section class="trs-customer-summary"><header><h3>客户信息</h3><div class="trs-customer-refresh"><span>{{ customerRefreshTime }}</span><button type="button" :disabled="customerRefreshing" aria-label="刷新客户账户信息" @click="refreshCustomerAccount"><el-icon :class="{ 'is-refreshing': customerRefreshing }"><RefreshRight /></el-icon>刷新</button></div></header><div><dl><dt>客户名</dt><dd>{{ activeOrder.customer }}</dd></dl><dl><dt>客户编号</dt><dd>{{ activeOrder.customerCode }}</dd></dl><dl><dt>客户框架</dt><dd>{{ customerFrameworkLabel }}</dd></dl><dl><dt>交易账户</dt><dd>{{ activeOrder.account }}</dd></dl><dl><dt>当前总资产(CNY)</dt><dd class="trs-numeric">{{ currencyValue(activeOrder.assets) }}</dd></dl><dl><dt>账户可用(CNY)</dt><dd class="trs-numeric">{{ currencyValue(activeOrder.available) }}</dd></dl></div></section>

          <div class="trs-summary-panels">
            <section class="trs-summary-panel"><header><h3>客户下单信息</h3><button type="button" class="trs-order-history-trigger" @click="openOrderHistory(activeOrder)">历史记录</button></header><div class="trs-description-scroll"><TrsCustomerOrderInfo :active-order="activeOrder" :split-input-label="splitInputLabel" :is-amount-order="isAmountOrder" /></div><footer class="trs-summary-actions" :class="{ 'is-split-open': splitVisible }"><template v-if="isDoneAlternative"><span class="trs-summary-action-placeholder" aria-hidden="true"></span></template><template v-else-if="splitVisible"><span class="trs-summary-action-placeholder" aria-hidden="true"></span><button type="button" class="trs-collapse-split" @click="splitVisible = false">收起拆单</button></template><template v-else-if="isExceptionPending"><button type="button" @click="transferExceptionToDone">转已办</button></template><template v-else-if="isApprovalPending"><button type="button" @click="openApproval">查看审批详情</button></template><template v-else-if="isCancelAllocationPending"><span class="trs-summary-action-placeholder">等待上手方撤单结果</span></template><template v-else-if="isDealAllocationPending"><span class="trs-summary-action-placeholder">上手方已成交，待分配客户成交</span></template><template v-else><button type="button" class="is-place-order" :disabled="isOrderFullyPlaced" :title="isOrderFullyPlaced ? '客户订单已全部下单' : undefined" @click="placeEquityOrder">下单</button><button v-if="activeOrder.status === 'orderPending'" type="button" @click="openApproval">转审批</button><button v-if="!isOrderPlaced" type="button" class="is-danger" @click="openReject">拒单</button></template></footer></section>
            <section class="trs-summary-panel"><header><h3>成交信息</h3><button type="button" class="trs-deal-add-record" :class="{ 'is-unavailable': !canUpdateCustomerDeal }" :aria-disabled="!canUpdateCustomerDeal" :title="canUpdateCustomerDeal ? undefined : '请先下单且有成交数据才可更新成交信息。'" @click="addCustomerDealRecord">新增成交记录</button></header><template v-if="customerDealEditing"><div class="trs-customer-deal-editor"><div class="trs-customer-deal-editor-head"><span>成交编号<i>*</i></span><span>成交价格<i>*</i></span><span>成交数量<i>*</i></span><span aria-hidden="true"></span></div><div v-for="record in customerDealRecords" :key="record.id" class="trs-customer-deal-editor-row"><el-input v-model="record.dealNo" placeholder="请输入" aria-label="成交编号" /><el-input v-model="record.price" inputmode="decimal" placeholder="请输入" aria-label="成交价格" /><el-input v-model="record.quantity" inputmode="decimal" placeholder="请输入" aria-label="成交数量" /><button type="button" class="trs-deal-record-remove" :disabled="customerDealRecords.length === 1" :aria-label="`删除成交记录 ${record.dealNo || ''}`" @click="removeCustomerDealRecord(record.id)">删除</button></div><p v-if="customerDealError" class="trs-action-validation is-error">{{ customerDealError }}</p></div><footer class="trs-deal-actions is-editing"><button type="button" @click="closeCustomerDealEditor">取消</button><button type="button" class="is-primary" @click="requestCustomerDealSave">保存</button></footer></template><template v-else><div class="trs-deal-grid trs-deal-grid--compact"><dl><dt>成交编号</dt><dd>{{ displayedDealNo }}</dd></dl><dl><dt>成交价格</dt><dd>{{ displayedDealPrice }}</dd></dl><dl><dt>成交数量</dt><dd>{{ displayedDealQuantity }}</dd></dl></div><footer class="trs-deal-actions"><button type="button" :class="{ 'is-unavailable': !canUpdateCustomerDeal }" :aria-disabled="!canUpdateCustomerDeal" :title="canUpdateCustomerDeal ? undefined : '请先下单且有成交数据才可更新成交信息。'" @click="openCustomerDealUpdate">更新客户成交信息</button></footer></template></section>
          </div>
          <section v-if="splitVisible" class="trs-inline-split" aria-label="拆分客户订单">
            <div class="trs-split-tools">
              <div><b>拆单</b></div>
              <span class="trs-split-actions"><strong>已拆{{ splitValueLabel }}：{{ splitAllocatedDisplay }} / 客户订单{{ splitValueLabel }}：{{ originalSplitValueDisplay }}</strong><button type="button" @click="addSplitLine">新增上手方订单</button><button type="button" class="is-primary" @click="confirmSplit">提交拆单</button></span>
            </div>
            <div class="trs-split-table-wrap">
              <TrsSplitDraftTable :instrument="activeOrder" v-model:split-lines="splitLines" v-model:split-algorithm-draft="splitAlgorithmDraft" :split-input-label="splitInputLabel" :is-nonstandard-order="isNonstandardOrder" :selectable-split-counterparties="selectableSplitCounterparties" :split-algorithm-popover-line-id="splitAlgorithmPopoverLineId" :pov-hour-options="povHourOptions" :pov-minute-options="povMinuteOptions" :split-algorithm-parameter-error="splitAlgorithmParameterError" :is-amount-order="isAmountOrder" @algorithm-popover="updateSplitAlgorithmPopover" @cancel-algorithm="cancelSplitAlgorithmConfig" @confirm-algorithm="confirmSplitAlgorithmConfig" @remove-line="removeSplitLine" />
            </div>
            <p v-if="splitError" class="trs-split-validation is-error">{{ splitError }}</p>
          </section>
          <section v-else class="trs-split-details" aria-label="下单明细">
            <header>
              <div><h2>下单明细</h2><span v-if="activeOrder.systemOrders?.length">已提交上手方订单</span></div>
              <strong v-if="activeOrder.systemOrders?.length">客户订单{{ splitValueLabel }}：{{ originalSplitValueDisplay }}</strong>
            </header>
            <TrsSystemOrdersTable :active-order="activeOrder" :split-input-label="splitInputLabel" :split-counterparties="splitCounterparties" :is-editing-system-order="isEditingSystemOrder" :format-split-value="formatSplitValue" v-model:system-order-edit-draft="systemOrderEditDraft" @save="saveSystemOrderEdit" @cancel-edit="cancelSystemOrderEdit" @edit="editSystemOrderLine" @cancel-line="openLineCancel" />
          </section>
        </main>
      </div>
      </template>
      <section v-else class="trs-my-orders-empty" aria-live="polite">未找到匹配的待办订单</section>
    </template>
    <section v-else class="trs-done-orders">
      <section class="trs-done-filters" aria-label="已办订单查询条件">
        <label>客户名<el-input v-model="doneFilters.customer" placeholder="请输入" clearable /></label>
        <label>客户编号<el-input v-model="doneFilters.customerCode" placeholder="请输入" clearable /></label>
        <label>订单编号<el-input v-model="doneFilters.orderNo" placeholder="请输入" clearable /></label>
        <label>标的物<el-input v-model="doneFilters.underlying" placeholder="请输入" clearable /></label>
        <label>订单状态<el-select v-model="doneFilters.status" placeholder="全部" clearable><el-option v-for="(label, value) in doneStatusLabel" :key="value" :label="label" :value="value" /></el-select></label>
        <button type="button" class="is-primary" @click="applyDoneFilters">查询</button>
        <button type="button" @click="resetDoneFilters">重置</button>
      </section>
      <div class="trs-done-batch-actions"><button type="button" class="trs-done-batch-email" :disabled="!selectedCompletedDoneOrders.length" @click="sendSelectedDoneEmails">批量发送邮件<span v-if="selectedCompletedDoneOrders.length">（{{ selectedCompletedDoneOrders.length }}）</span></button></div>
      <div class="trs-done-table-wrap">
      <TrsDoneOrdersTable :paged-done-orders="pagedDoneOrders" v-model:visible-done-column-keys="visibleDoneColumnKeys" :done-column-options="doneColumnOptions" :done-column-defaults="doneColumnDefaults" :done-status-label="doneStatusLabel" :done-order-input-value="doneOrderInputValue" :done-order-output-value="doneOrderOutputValue" :done-system-order-value="doneSystemOrderValue" :done-system-order-price="doneSystemOrderPrice" :done-system-order-input-value="doneSystemOrderInputValue" :done-system-order-deal-amount="doneSystemOrderDealAmount" :done-system-order-deal-quantity="doneSystemOrderDealQuantity" :done-system-order-status="doneSystemOrderStatus" :done-deal-no="doneDealNo" :done-deal-price="doneDealPrice" :done-deal-quantity="doneDealQuantity" @selection-change="updateDoneSelection" @history="openOrderHistory" @send-email="sendDoneEmail" @deal-update="openDoneCustomerDealUpdate" />
      </div>
      <footer class="trs-done-pagination"><span>共 {{ filteredDoneOrders.length }} 条</span><el-pagination v-model:current-page="donePage" small background layout="prev, pager, next" :total="filteredDoneOrders.length" :page-size="donePageSize" /></footer>
    </section>

    <TrsApprovalDialog v-model="approvalVisible" :approval="isApprovalPending ? activeOrder.approval : null" @submit="submitApproval" />
    <BaseDialog v-model="lineCancelVisible" title="确认撤单" width="420px" align-center append-to-body class="trs-action-dialog"><div class="trs-action-dialog-body"><p>确认撤销该笔上手方订单？撤单后不可恢复。</p></div><template #footer><el-button @click="lineCancelVisible = false">取消[Esc]</el-button><el-button type="danger" @click="confirmLineCancel">确认撤单[Enter]</el-button></template></BaseDialog>
    <BaseDialog v-model="rejectVisible" :title="rejectionDialogTitle" width="480px" align-center append-to-body class="trs-action-dialog"><div class="trs-action-dialog-body"><p>{{ rejectionDialogHint }}</p><label class="trs-action-field is-required">拒绝原因<el-input v-model="rejectionReason" type="textarea" :rows="4" maxlength="300" show-word-limit placeholder="请填写拒绝原因" /></label><p v-if="rejectError" class="trs-action-validation is-error">{{ rejectError }}</p></div><template #footer><el-button @click="rejectVisible = false">取消[Esc]</el-button><el-button type="danger" @click="confirmReject">{{ rejectionConfirmLabel }}[Enter]</el-button></template></BaseDialog>
    <OrderHistoryDialog v-model="doneHistoryVisible" :record="historyDialogRecord" />
    <BaseDialog :model-value="doneCustomerDealEditVisible" title="更新客户成交信息" width="680px" align-center append-to-body class="trs-action-dialog" @update:model-value="visible => visible ? doneCustomerDealEditVisible = true : closeCustomerDealEditor()"><div class="trs-action-dialog-body"><button type="button" class="trs-deal-add-record" @click="addCustomerDealRecord">新增成交记录</button><div class="trs-customer-deal-editor"><div class="trs-customer-deal-editor-head"><span>成交编号<i>*</i></span><span>成交价格<i>*</i></span><span>成交数量<i>*</i></span><span aria-hidden="true"></span></div><div v-for="record in customerDealRecords" :key="record.id" class="trs-customer-deal-editor-row"><el-input v-model="record.dealNo" placeholder="请输入" aria-label="成交编号" /><el-input v-model="record.price" inputmode="decimal" placeholder="请输入" aria-label="成交价格" /><el-input v-model="record.quantity" inputmode="decimal" placeholder="请输入" aria-label="成交数量" /><button type="button" class="trs-deal-record-remove" :disabled="customerDealRecords.length === 1" :aria-label="`删除成交记录 ${record.dealNo || ''}`" @click="removeCustomerDealRecord(record.id)">删除</button></div><p v-if="customerDealError" class="trs-action-validation is-error">{{ customerDealError }}</p></div></div><template #footer><el-button @click="closeCustomerDealEditor">取消[Esc]</el-button><el-button type="primary" @click="requestCustomerDealSave">保存[Enter]</el-button></template></BaseDialog>
    <BaseDialog v-model="customerDealSaveConfirmVisible" title="确认保存成交信息" width="420px" align-center append-to-body class="trs-action-dialog"><div class="trs-action-dialog-body"><p>确认保存 {{ customerDealRecords.length }} 条成交记录？保存后将更新客户成交结果。</p></div><template #footer><el-button @click="customerDealSaveConfirmVisible = false">返回修改[Esc]</el-button><el-button type="primary" @click="saveCustomerDealUpdate">确认保存[Enter]</el-button></template></BaseDialog>
    <BaseDialog v-model="exceptionTransferPromptVisible" title="请先更新成交信息" width="420px" align-center append-to-body class="trs-action-dialog"><div class="trs-action-dialog-body"><p>该异常订单存在已成交的上手方订单。请先录入客户成交信息，完成后再转已办。</p></div><template #footer><el-button @click="exceptionTransferPromptVisible = false">取消[Esc]</el-button><el-button type="primary" @click="openExceptionDealUpdate">更新成交信息[Enter]</el-button></template></BaseDialog>
  </section>
</template>
