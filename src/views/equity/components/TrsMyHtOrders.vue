<script setup>
import { computed, ref, watch } from 'vue'
import { ArrowLeft, RefreshRight, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import BaseDialog from '../../../components/BaseDialog.vue'
import TrsApprovalDialog from './TrsApprovalDialog.vue'
import ColumnConfigPopover from './ColumnConfigPopover.vue'
import OrderHistoryDialog from './OrderHistoryDialog.vue'
import TradingTable from './TradingTable.vue'
import { positions } from '../fixtures'
import { claimedHtOrders, equityManualHtOrders } from '../trsOrderStore'

const emit = defineEmits(['back-to-pool', 'place-order', 'deal-recorded'])
const props = defineProps({ placedTrsOrder: Object })
const activeView = ref('todo')
const keyword = ref('')
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
const approvalConfirmVisible = ref(false)
const approvalConfirmType = ref('')
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
function withCalculatedPrincipals(deal) {
  return {
    ...deal,
    nominalPrincipal: formatPrincipal(deal.counterpartyPrice, deal.counterpartyQuantity),
    customerPrincipal: formatPrincipal(deal.customerPrice, deal.customerQuantity),
  }
}

function createDealInfo(order) {
  const isFeedbackPending = order.status === 'feedbackPending'
  const nominalPrincipal = formatPrincipal(order.price, order.quantity)
  return {
    dealNo: '',
    counterpartyPrice: order.status === 'rejected' ? '--' : isFeedbackPending ? '' : order.price,
    counterpartyQuantity: order.status === 'rejected' ? '--' : isFeedbackPending ? '' : order.quantity,
    nominalPrincipal: order.status === 'rejected' ? '--' : isFeedbackPending ? '' : nominalPrincipal,
    pendingAllocatedPrincipal: order.status === 'rejected' ? order.amount : isFeedbackPending ? '' : '0.00 CNY',
    customerPrice: order.status === 'rejected' ? '--' : isFeedbackPending ? '' : order.price,
    customerQuantity: order.status === 'rejected' ? '--' : isFeedbackPending ? '' : order.quantity,
    customerPrincipal: order.status === 'rejected' ? '--' : isFeedbackPending ? '' : nominalPrincipal,
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
  const hasPlacedTraderOrder = ['orderProcessed', 'cancelPending', 'feedbackPending'].includes(order.status)
    || (order.status === 'amendPending' && order.traderOrderPlaced)
  if (!hasPlacedTraderOrder) return []
  const isAmount = order.orderValueMode === 'amount'
  const sourceValue = isAmount ? order.amountValue ?? order.amount : order.quantityValue ?? order.quantity
  const total = Number(String(sourceValue || 0).replace(/[^\d.-]/g, '')) || 0
  const firstValue = Number((total / 2).toFixed(2))
  const price = Number(String(order.price || 0).replace(/[^\d.-]/g, '')) || 0
  const isNonstandard = order.standard === '非标'
  return [firstValue, Number((total - firstValue).toFixed(2))].map((value, index) => ({
    id: `${order.id}-system-${index + 1}`,
    counterparty: isNonstandard ? null : index === 0 ? '中金公司' : '中信证券',
    executionChannel: isNonstandard ? 'offline' : 'counterparty',
    account: order.account,
    orderType: 'limit',
    price,
    quantity: isAmount && price > 0 ? Number((value / price).toFixed(2)) : value,
    inputAmount: isAmount ? value : null,
    orderValueMode: isAmount ? 'amount' : 'quantity',
    side: order.direction === '卖出' ? 'sell' : 'buy',
    strategy: 'DMA',
    orderStatus: ((order.id === 'trs-004' || order.id === 'trs-009') && index === 1) ? '异常' : order.status === 'feedbackPending' ? '已成交' : '委托中',
  }))
}

const orders = ref([
  { id: 'trs-001', underlying: '中证500指数收益互换', code: '000905.SH', customer: '华信资产管理', orderNo: 'HT202609220001', standard: '标准', status: 'orderPending', account: 'TRS_T0 - 自营一号', direction: '买入', attribute: '开仓', price: '6,850.00', quantity: '1,000 万', amount: '10,000,000.00 CNY', submittedAt: '2026-09-22 09:36:12', remark: '请在流动性允许范围内完成建仓。', customerCode: 'CUS-001024', assets: '128,560,000.00 CNY', available: '46,250,000.00 CNY' },
  { id: 'trs-014', underlying: '中国平安', code: '601318.SH', customer: '吴桐资产', orderNo: 'HT202609220013', standard: '标准', status: 'orderPending', account: 'TRS_T1 - 自营二号', direction: '买入', attribute: '开仓', price: '48.60', quantity: '493,827 股', quantityValue: 493827, amount: '24,000,000.00 CNY', amountValue: 24000000, orderValueMode: 'amount', submittedAt: '2026-09-22 10:52:16', remark: '客户按订单金额提交，拆单时按金额分配。', customerCode: 'CUS-003106', assets: '156,900,000.00 CNY', available: '51,680,000.00 CNY' },
  { id: 'trs-002', underlying: '沪深300指数收益互换', code: '000300.SH', customer: '景行私募基金', orderNo: 'HT202609220002', standard: '非标', status: 'orderProcessed', account: 'TRS_T0 - 自营一号', direction: '卖出', attribute: '平仓', price: '3,962.18', quantity: '800 万', amount: '8,000,000.00 CNY', submittedAt: '2026-09-22 09:41:06', remark: '与原合约同日结算。', customerCode: 'CUS-001138', assets: '92,800,000.00 CNY', available: '18,420,000.00 CNY' },
  { id: 'trs-003', underlying: '中证新能源指数收益互换', code: '930997.CSI', customer: '明德投资', orderNo: 'HT202609220003', standard: '标准', status: 'amendPending', account: 'TRS_T1 - 自营二号', direction: '买入', attribute: '开仓', price: '2,185.30', quantity: '500 万', amount: '5,000,000.00 CNY', submittedAt: '2026-09-22 09:48:24', remark: '客户申请调整委托价格。', customerCode: 'CUS-001516', assets: '76,230,000.00 CNY', available: '21,630,000.00 CNY', request: '客户申请将委托价格调整为 2,210.00。' },
  { id: 'trs-004', underlying: '中证红利低波指数收益互换', code: 'H30269.CSI', customer: '安和基金', orderNo: 'HT202609220004', standard: '非标', status: 'cancelPending', account: 'TRS_T1 - 自营二号', direction: '卖出', attribute: '平仓', price: '9,672.40', quantity: '300 万', amount: '3,000,000.00 CNY', submittedAt: '2026-09-22 09:56:40', remark: '客户申请撤销未成交部分。', customerCode: 'CUS-001882', assets: '55,800,000.00 CNY', available: '12,410,000.00 CNY', request: '客户申请撤销当前委托。' },
  { id: 'trs-006', underlying: '中证银行指数收益互换', code: '399986.SZ', customer: '嘉禾资产', orderNo: 'HT202609220005', standard: '标准', status: 'orderPending', account: 'TRS_T0 - 自营一号', direction: '买入', attribute: '开仓', price: '6,104.72', quantity: '1,200 万', amount: '12,000,000.00 CNY', submittedAt: '2026-09-22 10:06:18', remark: '优先使用现券对冲风险敞口。', customerCode: 'CUS-002084', assets: '142,680,000.00 CNY', available: '38,990,000.00 CNY' },
  { id: 'trs-007', underlying: '国证2000指数收益互换', code: '399303.SZ', customer: '恒睿资本', orderNo: 'HT202609220006', standard: '非标', status: 'orderProcessed', account: 'TRS_T2 - 自营三号', direction: '卖出', attribute: '平仓', price: '7,326.15', quantity: '450 万', amount: '4,500,000.00 CNY', submittedAt: '2026-09-22 10:12:36', remark: '与客户确认净额结算日期。', customerCode: 'CUS-002249', assets: '63,440,000.00 CNY', available: '15,720,000.00 CNY' },
  { id: 'trs-008', underlying: '中证消费50指数收益互换', code: '931139.CSI', customer: '博远基金', orderNo: 'HT202609220007', standard: '标准', status: 'feedbackPending', account: 'TRS_T1 - 自营二号', direction: '买入', attribute: '开仓', price: '4,851.63', quantity: '700 万', amount: '7,000,000.00 CNY', submittedAt: '2026-09-22 10:18:04', remark: '等待上手成交回报后向客户反馈。', customerCode: 'CUS-002376', assets: '108,920,000.00 CNY', available: '27,480,000.00 CNY' },
  { id: 'trs-009', underlying: '中债国开债收益率曲线', code: 'CGBY.CNI', customer: '合瑞投资', orderNo: 'HT202609220008', standard: '非标', status: 'amendPending', traderOrderPlaced: true, amendedQuantityValue: 1800, account: 'TRS_T2 - 自营三号', direction: '卖出', attribute: '平仓', price: '2.38', quantity: '2,000 万', amount: '20,000,000.00 CNY', submittedAt: '2026-09-22 10:25:43', remark: '交易员已下单，客户申请调减订单数量。', customerCode: 'CUS-002451', assets: '225,600,000.00 CNY', available: '86,210,000.00 CNY', request: '客户申请将订单数量调整为 1,800 万。' },
  { id: 'trs-016', underlying: '国证2000指数收益互换', code: '399303.SZ', customer: '启明资产', orderNo: 'HT202609220015', standard: '标准', status: 'riskCheckFailed', amendedQuantityValue: 900, account: 'TRS_T1 - 自营二号', direction: '买入', attribute: '开仓', price: '6,326.15', quantity: '600 万', amount: '6,000,000.00 CNY', submittedAt: '2026-09-22 10:50:42', remark: '客户申请扩大订单数量，风控校验未通过。', customerCode: 'CUS-003461', assets: '102,360,000.00 CNY', available: '29,640,000.00 CNY', request: '客户申请将订单数量增加至 900 万。' },
  { id: 'trs-015', underlying: '中证全指证券公司指数', code: '399975.SZ', customer: '远成资产', orderNo: 'HT202609220014', standard: '标准', status: 'approvalPending', approvalResumeStatus: 'orderPending', account: 'TRS_T0 - 自营一号', direction: '买入', attribute: '开仓', price: '1,126.48', quantity: '400 万', amount: '4,000,000.00 CNY', submittedAt: '2026-09-22 10:44:36', remark: '交易员提交大额委托审批。', customerCode: 'CUS-003284', assets: '96,500,000.00 CNY', available: '31,200,000.00 CNY', approval: { chain: '交易员 → 风控负责人 → 交易主管', remark: '单笔委托金额超过审批阈值，等待风控复核。', attachments: ['风险评估说明.pdf'], submittedAt: '2026-09-22 10:45:10' } },
  { id: 'trs-005', underlying: '中证1000指数收益互换', code: '000852.SH', customer: '远航资产', orderNo: 'HT202609210028', standard: '标准', status: 'feedbackCompleted', account: 'TRS_T0 - 自营一号', direction: '买入', attribute: '开仓', price: '6,312.70', quantity: '600 万', amount: '6,000,000.00 CNY', submittedAt: '2026-09-21 15:14:28', remark: '已完成客户成交反馈。', customerCode: 'CUS-000946', assets: '188,400,000.00 CNY', available: '62,150,000.00 CNY' },
  { id: 'trs-010', underlying: '沪深300指数收益互换', code: '000300.SH', customer: '瑞川资产', orderNo: 'HT202609210027', standard: '标准', status: 'cancelled', account: 'TRS_T1 - 自营二号', direction: '卖出', attribute: '平仓', price: '3,948.26', quantity: '900 万', amount: '9,000,000.00 CNY', submittedAt: '2026-09-21 14:48:35', remark: '委托已撤销。', customerCode: 'CUS-001697', assets: '116,200,000.00 CNY', available: '34,580,000.00 CNY' },
  { id: 'trs-011', underlying: '中证红利低波指数收益互换', code: 'H30269.CSI', customer: '铭泰基金', orderNo: 'HT202609210026', standard: '非标', status: 'rejected', account: 'TRS_T0 - 自营一号', direction: '买入', attribute: '开仓', price: '9,588.40', quantity: '350 万', amount: '3,500,000.00 CNY', submittedAt: '2026-09-21 14:22:17', remark: '上手方拒绝该笔委托。', customerCode: 'CUS-001845', assets: '89,670,000.00 CNY', available: '24,960,000.00 CNY' },
  { id: 'trs-012', underlying: '中证新能源指数收益互换', code: '930997.CSI', customer: '鸿远私募', orderNo: 'HT202609210025', standard: '标准', status: 'partialCancelled', account: 'TRS_T2 - 自营三号', direction: '卖出', attribute: '平仓', price: '2,201.08', quantity: '650 万', amount: '6,500,000.00 CNY', submittedAt: '2026-09-21 13:56:40', remark: '部分成交后撤销剩余数量。', customerCode: 'CUS-002011', assets: '134,780,000.00 CNY', available: '40,130,000.00 CNY' },
  { id: 'trs-013', underlying: '中证全指医药指数收益互换', code: '932154.CSI', customer: '同益资产', orderNo: 'HT202609210024', standard: '非标', status: 'feedbackCompleted', account: 'TRS_T1 - 自营二号', direction: '买入', attribute: '开仓', price: '7,842.19', quantity: '280 万', amount: '2,800,000.00 CNY', submittedAt: '2026-09-21 13:18:55', remark: '已同步客户最终成交价格。', customerCode: 'CUS-002196', assets: '72,360,000.00 CNY', available: '19,840,000.00 CNY' },
].map((order, index) => {
  const normalizedOrder = {
    ...order,
    customer: customerNames[index],
    ...(order.id === 'trs-004' ? {} : heldUnderlyings[index % heldUnderlyings.length]),
  }
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
    deal: createDealInfo(normalizedOrder),
    history: normalizedOrder.history || [{ label: '客户下单', at: normalizedOrder.submittedAt, detail: '客户订单已提交。' }],
  }
}))

const statusLabel = { orderPending: '下单待处理', orderProcessed: '上手方待反馈', amendPending: '改单待反馈', riskCheckFailed: '风控校验失败', cancelPending: '撤单待反馈', cancelAllocationPending: '撤单待分配', feedbackPending: '上手方已反馈', approvalPending: '审批中', feedbackCompleted: '成交已反馈', cancelled: '已撤单', rejected: '已拒单', partialCancelled: '部成撤单' }
const doneStatusLabel = { approvalPending: '审批中', orderProcessed: '上手方待反馈', feedbackCompleted: '已成交', cancelled: '已撤单', rejected: '已拒绝', partialCancelled: '部成撤单' }
const doneStatusValues = Object.keys(doneStatusLabel)
const statusValues = Object.keys(statusLabel)
const allStatusesSelected = computed(() => statusFilter.value.length === statusValues.length)
const statusSelectionIndeterminate = computed(() => statusFilter.value.length > 0 && !allStatusesSelected.value)
function toggleAllStatuses() {
  statusFilter.value = allStatusesSelected.value ? [] : [...statusValues]
}
const allOrders = computed(() => [...equityManualHtOrders.value, ...orders.value, ...claimedHtOrders.value])
const todoOrders = computed(() => allOrders.value.filter(order => !doneStatusValues.includes(order.status)))
const doneOrders = computed(() => allOrders.value.filter(order => doneStatusValues.includes(order.status)))
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
watch(() => props.placedTrsOrder, payload => {
  if (!payload?.sourceOrderId || !payload.order) return
  const order = allOrders.value.find(item => item.id === payload.sourceOrderId)
  if (!order || order.systemOrders?.some(item => item.id === payload.order.id)) return
  const placedOrder = payload.order
  order.systemOrders = [...(order.systemOrders || []), {
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
  appendHistory(order, '交易员下单', '已通过快速下单新增上手方订单。')
})
const isApprovalPending = computed(() => activeOrder.value?.status === 'approvalPending')
const isAmendPending = computed(() => activeOrder.value?.status === 'amendPending')
const isCancelPending = computed(() => activeOrder.value?.status === 'cancelPending')
const isCancelAllocationPending = computed(() => activeOrder.value?.status === 'cancelAllocationPending')
const isRiskCheckFailed = computed(() => activeOrder.value?.status === 'riskCheckFailed')
const isRiskRejected = computed(() => activeOrder.value?.riskTag === 'rejected')
const isOrderPlaced = computed(() => activeOrder.value?.status === 'orderProcessed')
const rejectionDialogTitle = computed(() => isAmendPending.value ? '拒绝改单' : isCancelPending.value ? '拒绝撤单' : '拒绝订单')
const rejectionDialogHint = computed(() => isAmendPending.value ? '拒绝后将保留原下单委托，请确认拒绝原因。' : isCancelPending.value ? '拒绝后将保留原下单委托，请确认拒绝原因。' : '拒单后该订单将转入已办记录，请确认拒绝原因。')
const rejectionConfirmLabel = computed(() => isAmendPending.value || isCancelPending.value ? '确认拒绝' : '确认拒单')
const approvalConfirmTitle = computed(() => approvalConfirmType.value === 'cancel' ? '确认同意撤单' : '确认同意改单')
const approvalConfirmHint = computed(() => approvalConfirmType.value === 'cancel'
  ? '确认后将撤销该客户订单，并转入已办记录。'
  : '确认后将按客户最新请求继续处理该订单。')
const approvalConfirmLabel = computed(() => approvalConfirmType.value === 'cancel' ? '确认同意撤单' : '确认同意')
const progressSteps = computed(() => {
  const order = activeOrder.value
  if (!order) return []
  const hasCustomerAmendment = ['amendPending', 'riskCheckFailed'].includes(order.status) || order.hasCustomerAmendment
  const amendmentAfterTraderOrder = hasCustomerAmendment && Boolean(order.traderOrderPlaced || order.amendmentAfterTraderOrder || order.systemOrders?.length)
  const steps = [
    { id: 'customer-order', label: '客户已下单', stage: 1 },
    ...(hasCustomerAmendment && !amendmentAfterTraderOrder ? [{ id: 'customer-amend', label: '客户改单', stage: 2 }] : []),
    ...(hasCustomerAmendment && amendmentAfterTraderOrder ? [{ id: 'customer-amend', label: '客户改单', stage: 2 }] : []),
    { id: 'counterparty-pending', label: '上手方待反馈', stage: 4 },
    { id: 'counterparty-feedback', label: '上手方已反馈', stage: 5 },
    { id: 'completed', label: '已成交', stage: 6 },
  ]
  const currentStepId = order.status === 'feedbackCompleted' ? 'completed'
    : order.status === 'feedbackPending' ? 'counterparty-feedback'
      : order.status === 'orderProcessed' ? 'counterparty-pending'
        : ['cancelPending', 'cancelAllocationPending', 'cancelled', 'partialCancelled'].includes(order.status) ? 'counterparty-pending'
          : ['amendPending', 'riskCheckFailed'].includes(order.status) ? 'customer-amend'
            : 'customer-order'
  const currentIndex = steps.findIndex(step => step.id === currentStepId)
  return steps.map((step, index) => ({ ...step, complete: index <= currentIndex }))
})
function selectOrder(id) { selectedOrderId.value = id }
const isAmountOrder = computed(() => activeOrder.value?.orderValueMode === 'amount')
const isNonstandardOrder = computed(() => activeOrder.value?.standard === '非标')
const selectableSplitCounterparties = computed(() => isNonstandardOrder.value ? splitCounterparties.slice(0, 1) : splitCounterparties)
const customerFrameworkLabel = computed(() => activeOrder.value?.customerFramework || '价格偏好')
const splitValueLabel = computed(() => isAmountOrder.value ? '金额' : '数量')
const splitInputLabel = computed(() => isAmountOrder.value ? '订单金额' : '订单数量')
function toNumeric(value) { return Number(String(value ?? '').replace(/[^\d.-]/g, '')) || 0 }
function originalOrderValue() {
  const order = activeOrder.value
  return isAmountOrder.value ? Number(order?.amountValue ?? toNumeric(order?.amount)) : Number(order?.quantityValue ?? toNumeric(order?.quantity))
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
const isOrderFullyPlaced = computed(() => originalOrderValue() > 0 && remainingOrderValue.value <= 0)
function applyDoneFilters() { appliedDoneFilters.value = { ...doneFilters.value }; donePage.value = 1 }
function resetDoneFilters() {
  doneFilters.value = { customer: '', customerCode: '', orderNo: '', underlying: '', status: '' }
  applyDoneFilters()
}
const doneHistoryVisible = ref(false)
const dealUpdateVisible = ref(false)
const customerDealUpdateVisible = ref(false)
const doneHistoryOrder = ref(null)
const dealUpdateOrder = ref(null)
const dealForm = ref({})
const customerDealForm = ref({})
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
const dealFormCounterpartyPrincipalPreview = computed(() => formatPrincipal(dealForm.value.counterpartyPrice, dealForm.value.counterpartyQuantity))
const dealFormCustomerPrincipalPreview = computed(() => formatPrincipal(dealForm.value.customerPrice, dealForm.value.customerQuantity))
const customerCounterpartyPrincipalPreview = computed(() => formatPrincipal(customerDealForm.value.counterpartyPrice, customerDealForm.value.counterpartyQuantity))
const customerPrincipalPreview = computed(() => formatPrincipal(customerDealForm.value.customerPrice, customerDealForm.value.customerQuantity))
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
function openDealUpdate(order) {
  dealUpdateOrder.value = order
  dealForm.value = { ...(order.deal || (order.executionChannel === 'offline' ? createManualSplitDealInfo() : createDealInfo(order))) }
  dealUpdateVisible.value = true
}
function saveDealUpdate() {
  if (!dealUpdateOrder.value) return
  dealUpdateOrder.value.deal = withCalculatedPrincipals(dealForm.value)
  if (dealUpdateOrder.value.executionChannel === 'offline') {
    dealUpdateOrder.value.orderStatus = '已成交'
  }
  dealUpdateVisible.value = false
  ElMessage.success('成交信息已更新')
}
function openCustomerDealUpdate() {
  const order = activeOrder.value
  if (!order) return
  customerDealError.value = ''
  order.deal = { ...(order.deal || createDealInfo(order)) }
  customerDealForm.value = {
    dealNo: order.deal.dealNo || '',
    counterpartyPrice: order.deal.counterpartyPrice || '',
    counterpartyQuantity: order.deal.counterpartyQuantity || dealQuantityLabel(order, order.deal.counterpartyPrice || order.price),
    nominalPrincipal: order.deal.nominalPrincipal || '',
    pendingAllocatedPrincipal: order.deal.pendingAllocatedPrincipal || '',
    customerPrice: order.deal.customerPrice || '',
    customerQuantity: order.deal.customerQuantity || dealQuantityLabel(order, order.deal.customerPrice || order.price),
    customerPrincipal: order.deal.customerPrincipal || '',
  }
  customerDealUpdateVisible.value = true
}
function saveCustomerDealUpdate() {
  const order = activeOrder.value
  if (!order) return
  const requiredFields = ['dealNo', 'counterpartyPrice', 'customerPrice']
  if (requiredFields.some(field => !String(customerDealForm.value[field] || '').trim() || customerDealForm.value[field] === '--')) {
    customerDealError.value = '请填写成交编号、上手方成交价和客户成交价。'
    return
  }
  const quantity = order.orderValueMode === 'amount'
    ? Number((toNumeric(order.amountValue ?? order.amount) / toNumeric(customerDealForm.value.customerPrice)).toFixed(2))
    : Number(order.quantityValue ?? toNumeric(order.quantity))
  if (!quantity || !Number.isFinite(quantity)) {
    customerDealError.value = '客户成交价必须大于 0，才能计算成交数量。'
    return
  }
  const counterpartyQuantity = dealQuantityLabel(order, customerDealForm.value.counterpartyPrice)
  const customerQuantity = dealQuantityLabel(order, customerDealForm.value.customerPrice)
  order.deal = withCalculatedPrincipals({
    ...(order.deal || createDealInfo(order)),
    ...customerDealForm.value,
    counterpartyQuantity,
    customerQuantity,
    pendingAllocatedPrincipal: '0.00 CNY',
  })
  if (order.status === 'feedbackPending') {
    order.status = 'feedbackCompleted'
    order.processedAt = '2026-09-22 10:28:00'
    order.remark = `${order.remark} 客户成交信息已录入。`
    appendHistory(order, '客户成交确认', '已录入客户成交信息并完成订单。', order.processedAt)
    emit('deal-recorded', { order: { ...order }, deal: { ...order.deal }, quantity })
  }
  customerDealUpdateVisible.value = false
  ElMessage.success('客户成交信息已更新')
}
function placeEquityOrder() {
  const order = activeOrder.value
  if (!order || isApprovalPending.value || isOrderFullyPlaced.value) return
  emit('place-order', {
    sourceOrderId: order.id,
    symbol: {
      code: order.code,
      name: order.underlying,
      market: order.code.endsWith('.SH') ? 'SH' : 'SZ',
      price: Number(order.price.replace(/,/g, '')),
      cost: Number(order.price.replace(/,/g, '')),
      change: 0,
      available: Number.MAX_SAFE_INTEGER,
      lotSize: 100,
    },
    initialOrder: {
      executionType: 'highTouch',
      algorithm: 'DMA',
      type: 'limit',
      price: Number(order.price.replace(/,/g, '')),
      quantity: Number(order.quantity.replace(/[^\d.]/g, '')),
      quantityMode: 'quantity',
      unit: order.quantity.includes('万') ? 'wan' : 'shares',
      skipQuantityLimit: true,
      counterparty: order.standard === '非标' ? 'offline' : '',
      counterparties: order.standard === '非标' ? [{ label: '线下单', value: 'offline' }] : undefined,
      note: `来源HT订单：${order.orderNo}`,
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
  const resumeStatus = activeOrder.value.status === 'riskCheckFailed' || activeOrder.value.riskTag === 'rejected' ? 'orderPending' : activeOrder.value.status
  activeOrder.value.approvalResumeStatus = resumeStatus
  activeOrder.value.status = 'approvalPending'
  activeOrder.value.approval = { ...approval, submittedAt: '2026-09-22 10:30:00' }
  appendHistory(activeOrder.value, '发起转审批', '已提交审批流，等待审批结果。')
  splitVisible.value = false
  approvalVisible.value = false
}
function approvePendingOrder(order) {
  if (order.status !== 'approvalPending') return
  order.status = order.approvalResumeStatus || 'orderPending'
  if (order.riskTag === 'rejected') order.riskTag = 'approved'
  order.approval = { ...order.approval, status: 'approved', approvedAt: '2026-09-22 10:36:00' }
  appendHistory(order, '审批通过', '审批已通过，订单已返回待办继续处理。', order.approval.approvedAt)
  ElMessage.success('审批已通过，订单已返回待办')
}
function openApprovalConfirm(type) {
  if ((type === 'amend' && !isAmendPending.value) || (type === 'cancel' && !isCancelPending.value)) return
  approvalConfirmType.value = type
  approvalConfirmVisible.value = true
}
function confirmApproval() {
  const type = approvalConfirmType.value
  approvalConfirmVisible.value = false
  if (type === 'amend') approveAmend()
  if (type === 'cancel') approveCancel()
}
function openLineCancel(line) {
  if (line.orderStatus !== '委托中') return
  lineToCancel.value = line
  lineCancelVisible.value = true
}
const isEditingSystemOrder = line => editingSystemOrderId.value === line.id
function editSystemOrderLine(line) {
  editingSystemOrderId.value = line.id
  systemOrderEditDraft.value = { ...line, counterparty: line.counterparty || (activeOrder.value?.standard === '非标' ? 'offline' : ''), deal: { nominalPrincipal: line.deal?.nominalPrincipal || '', counterpartyQuantity: line.deal?.counterpartyQuantity || '' } }
}
function cancelSystemOrderEdit() {
  editingSystemOrderId.value = null
  systemOrderEditDraft.value = null
}
function saveSystemOrderEdit(line) {
  const target = activeOrder.value?.systemOrders?.find(item => item.id === line.id)
  const draft = systemOrderEditDraft.value
  if (!target || !draft) return
  Object.assign(target, {
    counterparty: draft.counterparty && draft.counterparty !== 'offline' ? draft.counterparty : null,
    strategy: draft.strategy,
    account: draft.account,
    orderType: draft.orderType,
    price: Number(draft.price) || 0,
    quantity: Number(draft.quantity) || 0,
    inputAmount: draft.orderValueMode === 'amount' ? Number(draft.inputAmount) || 0 : null,
    side: draft.side,
    deal: { ...draft.deal },
  })
  appendHistory(activeOrder.value, '修改异常下单明细', `已更新异常下单明细：${target.counterparty || '线下单'}。`)
  cancelSystemOrderEdit()
  ElMessage.success('异常下单明细已保存')
}
function confirmLineCancel() {
  const order = activeOrder.value
  const line = order?.systemOrders?.find(item => item.id === lineToCancel.value?.id)
  if (!line || line.orderStatus !== '委托中') { lineCancelVisible.value = false; return }
  line.orderStatus = '已撤单'
  order.remark = `${order.remark} 已撤销 1 笔上手方订单。`
  lineCancelVisible.value = false
  lineToCancel.value = null
  ElMessage.success('上手方订单已撤单')
}
function amendedOrderValue(order) {
  const value = order.orderValueMode === 'amount' ? order.amendedAmountValue : order.amendedQuantityValue
  return Number(value ?? originalOrderValue()) || originalOrderValue()
}
function approveAmend() {
  const order = activeOrder.value
  if (!order || !isAmendPending.value) return
  if (placedOrderValue.value > amendedOrderValue(order)) {
    ElMessage.error('同意改单失败，请先进行撤单后执行同意操作。')
    return
  }
  order.status = 'orderProcessed'
  order.hasCustomerAmendment = true
  order.amendmentAfterTraderOrder = Boolean(order.traderOrderPlaced || order.systemOrders?.length)
  if (!order.systemOrders?.length) order.systemOrders = createInitialSystemOrders(order)
  order.remark = `${order.remark} 已同意客户改单请求。`
  appendHistory(order, '同意客户改单', '已校验交易员下单数量后同意客户改单。')
  ElMessage.success('已同意客户改单请求')
}
function approveCancel() {
  const order = activeOrder.value
  if (!order || !isCancelPending.value) return
  const systemOrders = order.systemOrders || []
  systemOrders.forEach(line => {
    if (line.orderStatus === '委托中') line.orderStatus = '已撤单'
    if (line.orderStatus === '异常') line.orderStatus = '撤单失败'
  })
  const hasUnresolvedCounterpartyOrder = systemOrders.some(line => ['委托中', '异常', '已成交', '撤单失败'].includes(line.orderStatus))
  order.status = hasUnresolvedCounterpartyOrder ? 'cancelAllocationPending' : 'cancelled'
  order.processedAt = '2026-09-22 10:32:00'
  order.remark = `${order.remark} 已同意客户撤单请求，并已发起全部委托中的上手方撤单。`
  appendHistory(order, '同意客户撤单', hasUnresolvedCounterpartyOrder ? '上手方撤单未全部完成，等待撤单分配。' : '委托中的上手方订单均已撤单。', order.processedAt)
  ElMessage.success(hasUnresolvedCounterpartyOrder ? '已发起撤单，订单转为撤单待分配' : '已同意客户撤单请求')
}
function openReject() { if (isApprovalPending.value) return; rejectionReason.value = ''; rejectError.value = ''; rejectVisible.value = true }
function confirmReject() {
  if (!rejectionReason.value.trim()) { rejectError.value = '请填写拒单原因。'; return }
  const order = activeOrder.value
  if (isAmendPending.value || isCancelPending.value) {
    const requestType = isAmendPending.value ? '改单' : '撤单'
    order.status = 'orderProcessed'
    order.requestRejectionReason = rejectionReason.value.trim()
    order.remark = `${order.remark} 已拒绝客户${requestType}请求。`
    appendHistory(order, `拒绝客户${requestType}`, rejectionReason.value.trim())
    ElMessage.success(`已拒绝客户${requestType}请求`)
  } else {
    order.status = 'rejected'
    order.rejectionReason = rejectionReason.value.trim()
    order.processedAt = '2026-09-22 10:32:00'
    ElMessage.success('订单已拒绝')
  }
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
        <button type="button" :class="{ active: activeView === 'todo' }" @click="activeView = 'todo'">待办<span>({{ todoOrders.length }})</span></button>
        <button type="button" :class="{ active: activeView === 'done' }" @click="activeView = 'done'">已办<span>({{ doneOrders.length }})</span></button>
      </nav>
      <button type="button" class="trs-return-pool" @click="emit('back-to-pool')"><el-icon><ArrowLeft /></el-icon>返回订单池</button>
    </header>

    <template v-if="activeView === 'todo'">
      <template v-if="activeOrder">
      <div class="trs-my-orders-workspace">
        <aside class="trs-order-index" aria-label="HT订单索引">
          <header><h2>订单列表</h2><span class="trs-pending-count" :aria-label="`待处理订单 ${filteredOrders.length} 笔`"><i>待处理</i><b>{{ filteredOrders.length }}</b></span></header>
          <div class="trs-order-index-filters">
            <el-input v-model="keyword" :prefix-icon="Search" placeholder="搜索标的/客户名/订单编号" clearable />
            <el-select v-model="statusFilter" multiple collapse-tags collapse-tags-tooltip clearable placeholder="全部状态" aria-label="订单状态筛选" popper-class="variant-popper trs-status-filter-popper">
              <template #header><el-checkbox :model-value="allStatusesSelected" :indeterminate="statusSelectionIndeterminate" @change="toggleAllStatuses">全部状态</el-checkbox></template>
              <el-option v-for="(label, value) in statusLabel" :key="value" :label="label" :value="value"><el-checkbox :model-value="statusFilter.includes(value)">{{ label }}</el-checkbox></el-option>
            </el-select>
          </div>
          <nav class="trs-order-index-list" aria-label="选择订单">
            <button v-for="order in filteredOrders" :key="order.id" type="button" :class="{ active: order.id === activeOrder.id }" :aria-current="order.id === activeOrder.id ? 'true' : undefined" @click="selectOrder(order.id)">
              <span class="trs-index-underlying"><b :title="order.underlying">{{ order.underlying }}</b><span class="trs-type-tag" :class="order.standard === '非标' ? 'is-nonstandard' : ''">{{ order.standard }}</span></span>
              <span class="trs-status-tag" :class="`is-${order.status}`">{{ statusLabel[order.status] }}</span>
              <span class="trs-index-meta"><span><b :title="order.code">{{ order.code }}</b></span><span><i>客户</i><b :title="order.customer">{{ order.customer }}</b></span></span>
              <small class="trs-index-order-no" :title="order.orderNo"><i>订单编号</i><b>{{ order.orderNo }}</b></small>
            </button>
            <p v-if="!filteredOrders.length" class="trs-order-index-empty" aria-live="polite">{{ emptyOrderListText }}</p>
          </nav>
          <footer><span>共 {{ filteredOrders.length }} 条</span><el-pagination small background layout="prev, pager, next" :total="filteredOrders.length" :page-size="10" /></footer>
        </aside>

        <main class="trs-order-workbench">
          <header class="trs-workbench-heading">
            <div><div class="trs-workbench-title"><h1>{{ activeOrder.underlying }}</h1><span class="trs-type-tag" :class="activeOrder.standard === '非标' ? 'is-nonstandard' : ''">{{ activeOrder.standard }}</span><span class="trs-status-tag" :class="`is-${activeOrder.status}`">{{ statusLabel[activeOrder.status] }}</span></div><p>{{ activeOrder.orderNo }} · {{ activeOrder.account }}</p></div>
            <ol class="trs-order-progress" aria-label="订单处理进度"><li v-for="step in progressSteps" :key="step.id" :class="{ complete: step.complete }">{{ step.label }}</li></ol>
          </header>

          <section class="trs-customer-summary"><header><h3>客户信息</h3><div class="trs-customer-refresh"><span>{{ customerRefreshTime }}</span><button type="button" :disabled="customerRefreshing" aria-label="刷新客户账户信息" @click="refreshCustomerAccount"><el-icon :class="{ 'is-refreshing': customerRefreshing }"><RefreshRight /></el-icon>刷新</button></div></header><div><dl><dt>客户名</dt><dd>{{ activeOrder.customer }}</dd></dl><dl><dt>客户编号</dt><dd>{{ activeOrder.customerCode }}</dd></dl><dl><dt>客户框架</dt><dd>{{ customerFrameworkLabel }}</dd></dl><dl><dt>交易账户</dt><dd>{{ activeOrder.account }}</dd></dl><dl><dt>当前总资产</dt><dd class="trs-numeric">{{ activeOrder.assets }}</dd></dl><dl><dt>账户可用</dt><dd class="trs-numeric">{{ activeOrder.available }}</dd></dl></div></section>

          <div class="trs-summary-panels">
            <section class="trs-summary-panel"><header><h3>客户下单信息</h3><button type="button" class="trs-order-history-trigger" @click="openOrderHistory(activeOrder)">历史记录</button></header><div class="trs-description-scroll"><table><tbody><tr><th>交易类型</th><td>新单</td><th>标的物</th><td>{{ `${activeOrder.underlying}（${activeOrder.code?.split('.')[0] || '--'}）` }}</td></tr><tr><th>方向</th><td>{{ activeOrder.direction }}</td><th>订单属性</th><td>{{ activeOrder.attribute }}</td></tr><tr><th>订单价格</th><td class="trs-numeric">{{ activeOrder.price }}</td><th>{{ splitInputLabel }}</th><td class="trs-numeric">{{ isAmountOrder ? activeOrder.amount : activeOrder.quantity }}</td></tr><tr><th>{{ isAmountOrder ? '预估数量' : '下单金额' }}</th><td class="trs-numeric">{{ isAmountOrder ? activeOrder.quantity : activeOrder.amount }}</td><th>提交时间</th><td>{{ activeOrder.submittedAt }}</td></tr><tr><th>备注</th><td colspan="3">{{ activeOrder.remark }}</td></tr><tr v-if="activeOrder.request"><th>客户请求</th><td colspan="3">{{ activeOrder.request }}</td></tr><tr v-if="activeOrder.approval"><th>审批状态</th><td colspan="3">{{ activeOrder.approval.chain }} · 审批中</td></tr><tr v-if="activeOrder.approval?.attachments?.length"><th>审批材料</th><td colspan="3">{{ activeOrder.approval.attachments.join('、') }}</td></tr></tbody></table></div><footer class="trs-summary-actions" :class="{ 'is-split-open': splitVisible }"><template v-if="splitVisible"><span class="trs-summary-action-placeholder" aria-hidden="true"></span><button type="button" class="trs-collapse-split" @click="splitVisible = false">收起拆单</button></template><template v-else-if="isApprovalPending"><button type="button" @click="openApproval">查看审批详情</button></template><template v-else-if="isAmendPending"><button type="button" @click="openApprovalConfirm('amend')">同意</button><button type="button" class="is-danger" @click="openReject">拒绝</button></template><template v-else-if="isCancelPending"><button type="button" @click="openApprovalConfirm('cancel')">同意撤单</button><button type="button" class="is-danger" @click="openReject">拒绝</button></template><template v-else-if="isRiskRejected || isRiskCheckFailed"><button type="button" @click="openApproval">转审批</button></template><template v-else-if="isCancelAllocationPending"><span class="trs-summary-action-placeholder">等待上手方撤单结果</span></template><template v-else><button type="button" :disabled="isOrderFullyPlaced" :title="isOrderFullyPlaced ? '客户订单已全部下单' : undefined" @click="placeEquityOrder">下单</button><button type="button" :disabled="isOrderFullyPlaced" :title="isOrderFullyPlaced ? '客户订单已全部下单' : undefined" @click="openSplit">拆单</button><button v-if="!isOrderPlaced" type="button" class="is-danger" @click="openReject">拒单</button></template></footer></section>
            <section class="trs-summary-panel"><header><h3>成交信息</h3><span>成交编号：{{ activeOrder.deal?.dealNo || '--' }}</span></header><div class="trs-deal-grid"><dl><dt>上手方成交价</dt><dd>{{ activeOrder.deal?.counterpartyPrice || '--' }}</dd></dl><dl><dt>上手方成交数量</dt><dd>{{ activeOrder.deal?.counterpartyQuantity || '--' }}</dd></dl><dl><dt>名义本金</dt><dd>{{ activeOrder.deal?.nominalPrincipal || '--' }}</dd></dl><dl><dt>待分配名义本金</dt><dd>{{ activeOrder.deal?.pendingAllocatedPrincipal || '--' }}</dd></dl><dl><dt>客户成交价</dt><dd>{{ activeOrder.deal?.customerPrice || '--' }}</dd></dl><dl><dt>客户成交数量</dt><dd>{{ activeOrder.deal?.customerQuantity || '--' }}</dd></dl><dl><dt>名义本金（客户）</dt><dd>{{ activeOrder.deal?.customerPrincipal || '--' }}</dd></dl></div><footer class="trs-deal-actions"><button type="button" @click="openCustomerDealUpdate">更新客户成交信息</button></footer></section>
          </div>
          <section v-if="splitVisible" class="trs-inline-split" aria-label="拆分客户订单">
            <div class="trs-split-tools">
              <div><b>拆单</b></div>
              <span class="trs-split-actions"><strong>已拆{{ splitValueLabel }}：{{ splitAllocatedDisplay }} / 客户订单{{ splitValueLabel }}：{{ originalSplitValueDisplay }}</strong><button type="button" @click="addSplitLine">新增上手方订单</button><button type="button" class="is-primary" @click="confirmSplit">提交拆单</button></span>
            </div>
            <div class="trs-split-table-wrap">
              <table class="trs-split-table">
                <colgroup><col class="is-counterparty"><col class="is-algorithm"><col class="is-account"><col class="is-order-type"><col class="is-price"><col class="is-quantity"><col class="is-direction"><col class="is-actions"></colgroup>
                <thead><tr><th>上手方</th><th>算法</th><th>下单账户</th><th>订单属性</th><th>订单价格</th><th>{{ splitInputLabel }}</th><th>方向</th><th class="trs-split-action-cell">操作</th></tr></thead>
                <tbody>
                  <tr v-for="(line, index) in splitLines" :key="line.id">
                    <td><el-select v-model="line.counterparty" clearable placeholder="请选择" :disabled="isNonstandardOrder" :aria-label="`子单 ${index + 1} 上手方`" popper-class="variant-popper"><el-option v-for="counterparty in selectableSplitCounterparties" :key="counterparty.value" :label="counterparty.label" :value="counterparty.value" /></el-select></td>
                    <td><el-popover :visible="splitAlgorithmPopoverLineId === line.id" trigger="click" placement="bottom-start" :width="264" popper-class="variant-popper algorithm-popper" @update:visible="visible => updateSplitAlgorithmPopover(line, visible)"><template #reference><button type="button" class="algorithm-trigger trs-split-algorithm-trigger" :aria-label="`执行算法：${line.strategy}，点击配置`"><span>{{ line.strategy }}</span><svg class="algorithm-chevron" :class="{ 'is-open': splitAlgorithmPopoverLineId === line.id }" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg></button></template><div class="execution-algorithm-menu"><span>执行算法</span><el-radio-group v-model="splitAlgorithmDraft.strategy" :aria-label="`子单 ${index + 1} 执行算法`"><el-radio-button label="POV">POV</el-radio-button><el-radio-button label="DMA">DMA</el-radio-button></el-radio-group><div v-if="splitAlgorithmDraft.strategy === 'POV'" class="algorithm-popper-params" aria-label="POV 参数"><div class="algorithm-param-row"><span>运行时间</span><div class="algorithm-param-input"><el-select v-model="splitAlgorithmDraft.povHours" class="algorithm-time-select" aria-label="POV运行小时" popper-class="variant-popper"><el-option v-for="hour in povHourOptions" :key="hour" :label="String(hour).padStart(2, '0')" :value="hour" /></el-select><i>时</i><el-select v-model="splitAlgorithmDraft.povMinutes" class="algorithm-time-select" aria-label="POV运行分钟" popper-class="variant-popper"><el-option v-for="minute in povMinuteOptions" :key="minute" :label="String(minute).padStart(2, '0')" :value="minute" /></el-select><i>分</i></div></div><div class="algorithm-param-row"><span>市场成交占比</span><div class="algorithm-param-input is-participation"><el-input-number v-model="splitAlgorithmDraft.participation" :min="1" :max="25" :precision="0" :controls="false" aria-label="POV市场成交占比" /><i>%</i><small>不超过 25%</small></div></div><p v-if="splitAlgorithmParameterError" class="algorithm-param-error" role="alert">请填写有效的运行时间，市场成交占比不得超过 25%</p></div><footer class="algorithm-menu-actions"><el-button size="small" @click="cancelSplitAlgorithmConfig">取消</el-button><el-button size="small" type="primary" :disabled="splitAlgorithmParameterError" @click="confirmSplitAlgorithmConfig">确认</el-button></footer></div></el-popover></td>
                    <td><el-select v-model="line.account" :aria-label="`子单 ${index + 1} 下单账户`"><el-option label="TRS_T0 - 自营一号" value="TRS_T0 - 自营一号" /><el-option label="TRS_T1 - 自营二号" value="TRS_T1 - 自营二号" /><el-option label="TRS_T2 - 自营三号" value="TRS_T2 - 自营三号" /></el-select></td>
                    <td><el-radio-group v-model="line.orderType" :aria-label="`子单 ${index + 1} 订单属性`"><el-radio-button label="limit">限价单</el-radio-button><el-radio-button label="market">市价单</el-radio-button></el-radio-group></td>
                    <td><el-input-number v-if="line.orderType === 'limit'" v-model="line.price" :aria-label="`子单 ${index + 1} 订单价格`" :min="0" :precision="2" :controls="false" /><span v-else class="trs-split-market-price">以市场价格成交</span></td>
                    <td><el-input-number v-if="isAmountOrder" v-model="line.amount" placeholder="请输入" :aria-label="`子单 ${index + 1} 订单金额`" :min="0.01" :precision="2" :controls="false" /><el-input-number v-else v-model="line.quantity" placeholder="请输入" :aria-label="`子单 ${index + 1} 订单数量`" :min="0.01" :precision="2" :controls="false" /></td>
                    <td class="trs-split-direction-cell"><span class="trs-split-direction-value" :aria-label="`子单 ${index + 1} 方向`">{{ line.side === 'sell' ? '卖出' : '买入' }}</span></td>
                    <td class="trs-split-action-cell"><button type="button" class="is-danger" @click="removeSplitLine(index)">移除</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-if="splitError" class="trs-split-validation is-error">{{ splitError }}</p>
          </section>
          <section v-else class="trs-split-details" aria-label="下单明细">
            <header>
              <div><h2>下单明细</h2><span v-if="activeOrder.systemOrders?.length">已提交 {{ activeOrder.systemOrders.length }} 笔上手方订单</span></div>
              <strong v-if="activeOrder.systemOrders?.length">已拆{{ splitValueLabel }}：{{ formatSplitValue(placedOrderValue) }} / 客户订单{{ splitValueLabel }}：{{ originalSplitValueDisplay }}</strong>
            </header>
            <TradingTable class="trs-split-details-table" :data="activeOrder.systemOrders || []" empty-text="暂无下单数据">
              <el-table-column label="上手方" width="76" show-overflow-tooltip><template #default="{ row }"><el-select v-if="isEditingSystemOrder(row)" v-model="systemOrderEditDraft.counterparty" class="trs-line-edit-control" :disabled="activeOrder.standard === '非标'"><el-option v-for="option in splitCounterparties" :key="option.value" :label="option.label" :value="option.value" /></el-select><template v-else>{{ row.counterparty || '线下单' }}</template></template></el-table-column>
              <el-table-column label="算法" width="54" align="center"><template #default="{ row }"><el-select v-if="isEditingSystemOrder(row)" v-model="systemOrderEditDraft.strategy" class="trs-line-edit-control"><el-option label="DMA" value="DMA" /><el-option label="TWAP" value="TWAP" /><el-option label="POV" value="POV" /></el-select><template v-else>{{ row.strategy }}</template></template></el-table-column>
              <el-table-column label="下单账户" width="112" show-overflow-tooltip><template #default="{ row }"><el-input v-if="isEditingSystemOrder(row)" v-model="systemOrderEditDraft.account" class="trs-line-edit-control" /><template v-else>{{ row.account }}</template></template></el-table-column>
              <el-table-column label="订单属性" width="64" align="center"><template #default="{ row }"><el-select v-if="isEditingSystemOrder(row)" v-model="systemOrderEditDraft.orderType" class="trs-line-edit-control"><el-option label="限价单" value="limit" /><el-option label="市价单" value="market" /></el-select><template v-else>{{ row.orderType === 'market' ? '市价单' : '限价单' }}</template></template></el-table-column>
              <el-table-column label="订单价格" width="70" align="right"><template #default="{ row }"><el-input-number v-if="isEditingSystemOrder(row)" v-model="systemOrderEditDraft.price" class="trs-line-edit-control" :min="0" :precision="2" :controls="false" /><template v-else>{{ row.orderType === 'market' ? '--' : Number(row.price || 0).toFixed(2) }}</template></template></el-table-column>
              <el-table-column :label="splitInputLabel" width="92" align="right"><template #default="{ row }"><el-input-number v-if="isEditingSystemOrder(row)" :model-value="row.orderValueMode === 'amount' ? systemOrderEditDraft.inputAmount : systemOrderEditDraft.quantity" class="trs-line-edit-control" :min="0" :precision="2" :controls="false" @update:model-value="value => row.orderValueMode === 'amount' ? systemOrderEditDraft.inputAmount = value : systemOrderEditDraft.quantity = value" /><template v-else>{{ row.orderValueMode === 'amount' ? formatSplitValue(row.inputAmount, true) : Number(row.quantity || 0).toFixed(2) }}</template></template></el-table-column>
              <el-table-column label="成交金额" width="98" align="right" show-overflow-tooltip><template #default="{ row }"><el-input v-if="isEditingSystemOrder(row)" v-model="systemOrderEditDraft.deal.nominalPrincipal" class="trs-line-edit-control" /><template v-else>{{ row.deal?.nominalPrincipal || '--' }}</template></template></el-table-column>
              <el-table-column label="成交数量" width="70" align="right"><template #default="{ row }"><el-input v-if="isEditingSystemOrder(row)" v-model="systemOrderEditDraft.deal.counterpartyQuantity" class="trs-line-edit-control" /><template v-else>{{ row.deal?.counterpartyQuantity || '--' }}</template></template></el-table-column>
              <el-table-column label="方向" width="48" align="center"><template #default="{ row }"><el-select v-if="isEditingSystemOrder(row)" v-model="systemOrderEditDraft.side" class="trs-line-edit-control"><el-option label="买入" value="buy" /><el-option label="卖出" value="sell" /></el-select><template v-else>{{ row.side === 'sell' ? '卖出' : '买入' }}</template></template></el-table-column>
              <el-table-column label="订单状态" width="64" align="center"><template #default="{ row }"><span class="trs-split-order-status" :class="{ 'is-filled': row.orderStatus === '已成交', 'is-rejected': row.orderStatus === '拒绝', 'is-exception': row.orderStatus === '异常' }">{{ row.orderStatus || '委托中' }}</span></template></el-table-column>
              <el-table-column label="操作" width="112" align="center"><template #default="{ row }"><span class="trs-detail-row-actions"><template v-if="isEditingSystemOrder(row)"><el-button link type="primary" @click="saveSystemOrderEdit(row)">保存</el-button><el-button link @click="cancelSystemOrderEdit">取消</el-button></template><template v-else><el-button v-if="row.orderStatus === '异常'" link type="warning" @click="editSystemOrderLine(row)">修改数据</el-button><el-button v-if="row.orderStatus === '委托中'" link type="danger" @click="openLineCancel(row)">撤单</el-button><span v-if="!['委托中', '异常'].includes(row.orderStatus)">--</span></template></span></template></el-table-column>
            </TradingTable>
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
      <TradingTable class="trs-done-trading-table" :data="pagedDoneOrders" row-key="id" height="100%" :fit="false" empty-text="暂无已办订单" @selection-change="updateDoneSelection">
        <el-table-column type="selection" width="42" align="center" />
        <template v-for="columnKey in visibleDoneColumnKeys" :key="columnKey">
          <el-table-column v-if="columnKey === 'customerInfo'" label="客户信息">
            <el-table-column prop="customer" label="客户名" width="118" />
            <el-table-column prop="customerCode" label="客户编号" width="106" />
            <el-table-column label="订单状态" width="88" align="center" class-name="trs-done-status-cell" label-class-name="trs-done-status-cell"><template #default="{ row }"><span class="trs-done-status-tag" :class="`is-${row.status}`">{{ doneStatusLabel[row.status] }}</span></template></el-table-column>
            <el-table-column prop="account" label="交易账户" width="130" show-overflow-tooltip />
            <el-table-column label="交易类型" width="76" align="center"><template #default>新单</template></el-table-column>
          </el-table-column>
          <el-table-column v-else-if="columnKey === 'customerOrder'" label="客户下单信息">
            <el-table-column prop="standard" label="订单类型" width="76" align="center" />
            <el-table-column prop="underlying" label="标的物名称" width="126" show-overflow-tooltip />
            <el-table-column prop="direction" label="方向" width="60" align="center" />
            <el-table-column prop="attribute" label="订单属性" width="76" align="center" />
            <el-table-column prop="price" label="订单价格" width="88" align="right" />
            <el-table-column prop="quantity" label="下单数量" width="88" align="right" />
            <el-table-column prop="amount" label="下单金额" width="132" align="right" />
            <el-table-column prop="submittedAt" label="提交时间" width="154" />
          </el-table-column>
          <el-table-column v-else-if="columnKey === 'traderOrder'" label="交易员下单信息">
            <el-table-column label="订单类型" width="76" align="center"><template #default="{ row }">{{ row.traderOrder?.standard || row.standard }}</template></el-table-column>
            <el-table-column label="标的物名称" width="126" show-overflow-tooltip><template #default="{ row }">{{ row.traderOrder?.underlying || row.underlying }}</template></el-table-column>
            <el-table-column label="方向" width="60" align="center"><template #default="{ row }">{{ row.traderOrder?.direction || row.direction }}</template></el-table-column>
            <el-table-column label="订单属性" width="76" align="center"><template #default="{ row }">{{ row.traderOrder?.attribute || row.attribute }}</template></el-table-column>
            <el-table-column label="订单价格" width="88" align="right"><template #default="{ row }">{{ row.traderOrder?.price || row.price }}</template></el-table-column>
            <el-table-column label="下单数量" width="88" align="right"><template #default="{ row }">{{ row.traderOrder?.quantity || row.quantity }}</template></el-table-column>
            <el-table-column label="下单金额" width="132" align="right"><template #default="{ row }">{{ row.traderOrder?.amount || row.amount }}</template></el-table-column>
            <el-table-column label="下单时间" width="154"><template #default="{ row }">{{ row.traderOrder?.submittedAt || row.processedAt || '--' }}</template></el-table-column>
          </el-table-column>
          <el-table-column v-else-if="columnKey === 'dealInfo'" label="成交信息">
            <el-table-column label="上手方成交价" width="112" align="right"><template #default="{ row }">{{ row.deal?.counterpartyPrice || '--' }}</template></el-table-column>
            <el-table-column label="上手方成交数量" width="128" align="right"><template #default="{ row }">{{ row.deal?.counterpartyQuantity || '--' }}</template></el-table-column>
            <el-table-column label="名义本金" width="128" align="right"><template #default="{ row }">{{ row.deal?.nominalPrincipal || '--' }}</template></el-table-column>
            <el-table-column label="待分配名义本金" width="138" align="right"><template #default="{ row }">{{ row.deal?.pendingAllocatedPrincipal || '--' }}</template></el-table-column>
            <el-table-column label="客户成交价" width="102" align="right"><template #default="{ row }">{{ row.deal?.customerPrice || '--' }}</template></el-table-column>
            <el-table-column label="客户成交数量" width="116" align="right"><template #default="{ row }">{{ row.deal?.customerQuantity || '--' }}</template></el-table-column>
            <el-table-column label="名义本金（客户）" width="138" align="right"><template #default="{ row }">{{ row.deal?.customerPrincipal || '--' }}</template></el-table-column>
          </el-table-column>
        </template>
        <el-table-column prop="orderNo" label="订单编号" width="154" />
        <el-table-column label="历史" width="52" align="center" header-align="center" class-name="history-column" label-class-name="history-column"><template #default="{ row }"><button type="button" class="history-view" @click.stop="openOrderHistory(row)">查看</button></template></el-table-column>
        <el-table-column label="操作" width="154" fixed="right" align="center" header-align="center" class-name="operation-column trs-done-actions-cell" label-class-name="operation-column trs-done-actions-cell"><template #header><span class="trs-done-operation-header"><span>操作</span><ColumnConfigPopover v-model="visibleDoneColumnKeys" :options="doneColumnOptions" :defaults="doneColumnDefaults" /></span></template><template #default="{ row }"><span class="trs-done-row-actions"><el-button v-if="row.status === 'approvalPending'" link type="primary" @click="approvePendingOrder(row)">审批通过</el-button><el-button link :disabled="row.status !== 'feedbackCompleted'" @click="sendDoneEmail(row)">发送邮件</el-button><el-button v-if="row.status === 'feedbackCompleted'" link type="primary" @click="openDealUpdate(row)">更新成交信息</el-button></span></template></el-table-column>
      </TradingTable>
      </div>
      <footer class="trs-done-pagination"><span>共 {{ filteredDoneOrders.length }} 条</span><el-pagination v-model:current-page="donePage" small background layout="prev, pager, next" :total="filteredDoneOrders.length" :page-size="donePageSize" /></footer>
    </section>

    <TrsApprovalDialog v-model="approvalVisible" :approval="isApprovalPending ? activeOrder.approval : null" @submit="submitApproval" />
    <BaseDialog v-model="lineCancelVisible" title="确认撤单" width="420px" align-center append-to-body class="trs-action-dialog"><div class="trs-action-dialog-body"><p>确认撤销该笔上手方订单？撤单后不可恢复。</p></div><template #footer><el-button @click="lineCancelVisible = false">取消[Esc]</el-button><el-button type="danger" @click="confirmLineCancel">确认撤单[Enter]</el-button></template></BaseDialog>
    <BaseDialog v-model="approvalConfirmVisible" :title="approvalConfirmTitle" width="420px" align-center append-to-body class="trs-action-dialog"><div class="trs-action-dialog-body"><p>{{ approvalConfirmHint }}</p></div><template #footer><el-button @click="approvalConfirmVisible = false">取消[Esc]</el-button><el-button type="primary" @click="confirmApproval">{{ approvalConfirmLabel }}[Enter]</el-button></template></BaseDialog>
    <BaseDialog v-model="rejectVisible" :title="rejectionDialogTitle" width="480px" align-center append-to-body class="trs-action-dialog"><div class="trs-action-dialog-body"><p>{{ rejectionDialogHint }}</p><label class="trs-action-field is-required">拒绝原因<el-input v-model="rejectionReason" type="textarea" :rows="4" maxlength="300" show-word-limit placeholder="请填写拒绝原因" /></label><p v-if="rejectError" class="trs-action-validation is-error">{{ rejectError }}</p></div><template #footer><el-button @click="rejectVisible = false">取消[Esc]</el-button><el-button type="danger" @click="confirmReject">{{ rejectionConfirmLabel }}[Enter]</el-button></template></BaseDialog>
    <OrderHistoryDialog v-model="doneHistoryVisible" :record="historyDialogRecord" />
    <BaseDialog v-model="customerDealUpdateVisible" title="更新客户成交信息" width="680px" align-center append-to-body class="trs-action-dialog"><div class="trs-action-dialog-body"><div class="trs-deal-update-form"><label>成交编号<el-input v-model="customerDealForm.dealNo" /></label><label>上手方成交价<el-input v-model="customerDealForm.counterpartyPrice" /></label><label class="is-readonly">上手方成交数量<el-input v-model="customerDealForm.counterpartyQuantity" readonly /></label><label class="is-readonly">名义本金<el-input :model-value="customerCounterpartyPrincipalPreview" readonly /></label><label class="is-readonly">待分配名义本金<el-input v-model="customerDealForm.pendingAllocatedPrincipal" readonly /></label><label>客户成交价<el-input v-model="customerDealForm.customerPrice" /></label><label class="is-readonly">客户成交数量<el-input v-model="customerDealForm.customerQuantity" readonly /></label><label class="is-readonly">名义本金（客户）<el-input :model-value="customerPrincipalPreview" readonly /></label></div><p v-if="customerDealError" class="trs-action-validation is-error">{{ customerDealError }}</p></div><template #footer><el-button @click="customerDealUpdateVisible = false">取消[Esc]</el-button><el-button type="primary" @click="saveCustomerDealUpdate">保存[Enter]</el-button></template></BaseDialog>
    <BaseDialog v-model="dealUpdateVisible" title="更新客户成交信息" width="680px" align-center append-to-body class="trs-action-dialog"><div class="trs-action-dialog-body trs-deal-update-form"><label>成交编号<el-input v-model="dealForm.dealNo" /></label><label>上手方成交价<el-input v-model="dealForm.counterpartyPrice" /></label><label class="is-readonly">上手方成交数量<el-input v-model="dealForm.counterpartyQuantity" readonly /></label><label class="is-readonly">名义本金<el-input :model-value="dealFormCounterpartyPrincipalPreview" readonly /></label><label class="is-readonly">待分配名义本金<el-input v-model="dealForm.pendingAllocatedPrincipal" readonly /></label><label>客户成交价<el-input v-model="dealForm.customerPrice" /></label><label class="is-readonly">客户成交数量<el-input v-model="dealForm.customerQuantity" readonly /></label><label class="is-readonly">名义本金（客户）<el-input :model-value="dealFormCustomerPrincipalPreview" readonly /></label></div><template #footer><el-button @click="dealUpdateVisible = false">取消[Esc]</el-button><el-button type="primary" @click="saveDealUpdate">保存[Enter]</el-button></template></BaseDialog>
  </section>
</template>
