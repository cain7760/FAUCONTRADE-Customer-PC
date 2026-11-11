import { ref } from 'vue'
import { isScheduledEntry, validateOptionOrder } from './optionOrderModel.js'
import { buildInquiryItems, calculateOptionFee, createInitialInquiries, markBestQuotes, resolveInquiryBatch, validateInquiry } from './inquiryModel.js'

// Module lifetime keeps the prototype's inquiries and opening orders when switching menus.
const items = ref(createInitialInquiries())
const openingOrders = ref([])
// 期权独立演示资金，不以权益持仓市值代替账户余额；正式数据由期权资金接口提供。
const optionAccount = ref({ availableBalance: 0, accountBalance: -1847496.29 })
const pendingRequests = new Set()
let sequence = 0
export const REINQUIRY_DEMO_DELAY_MS = 5000

function finishBatch(batch, delay = 1200) {
  const ids = new Set(batch.map((item) => item.id))
  setTimeout(() => {
    const resolved = new Map(resolveInquiryBatch(batch).map((item) => [item.id, item]))
    items.value = markBestQuotes(items.value.map((item) => item.status === 'pending' ? resolved.get(item.id) || item : item))
    ids.forEach((id) => pendingRequests.delete(id))
  }, delay)
}

function signature(item) {
  return [item.account || 'TZS_T0', item.code, item.direction, item.size, item.tenor, item.strike, item.knockout, item.exercise, item.dividend, item.currency].join('|')
}

function submitInquiries(drafts) {
  if (!Array.isArray(drafts) || !drafts.length) throw new Error('请选择需要询价的标的')
  // Prepare and validate every instrument before writing state or starting any timer.
  const batches = drafts.map((draft) => {
    const error = validateInquiry(draft)
    if (error) throw new Error(error)
    return buildInquiryItems(draft)
  })
  const pendingSignatures = new Set(items.value.filter((item) => item.status === 'pending').map(signature))
  const submittedSignatures = new Set()
  for (const item of batches.flat()) {
    const key = signature(item)
    if (pendingSignatures.has(key)) throw new Error('相同条件正在询价中，请等待报价')
    if (submittedSignatures.has(key)) throw new Error('相同条件请勿重复批量询价')
    submittedSignatures.add(key)
  }
  batches.forEach((batch) => {
    const request = ++sequence
    batch.forEach((item) => {
      item.id += `-${request}`
      item.batchId += `-${request}`
      item.inquiryRound = item.batchId
      pendingRequests.add(item.id)
    })
  })
  const submitted = batches.flat()
  items.value = markBestQuotes([...submitted, ...items.value])
  batches.forEach(batch => finishBatch(batch))
  return submitted
}

function submitInquiry(draft) {
  return submitInquiries([draft])
}

function reinquire(itemIds) {
  const requested = new Set(itemIds)
  const batch = items.value.filter((item) => requested.has(item.id))
  if (!batch.length) throw new Error('请选择可重询的记录')
  const unique = new Map()
  for (const item of [...batch].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))) {
    const key = signature(item)
    if (!unique.has(key)) unique.set(key, item)
  }
  const createdAt = new Date().toISOString(), request = ++sequence
  const inquiryRound = `REQUOTE-${Date.now()}-${request}`
  const refreshed = [...unique.values()].map(item => ({
    ...item, id: `${item.id}-R${request}`, batchId: `${item.batchId}-R${request}`,
    inquiryRound, sourceInquiryId: item.id, status: 'pending', createdAt,
    previousQuotes: item.quotes.map(quote => ({ ...quote })), quotes: [],
  }))
  refreshed.forEach(item => pendingRequests.add(item.id))
  const codes = new Set(batch.map(item => item.code))
  const previous = items.value.map(item => {
    if (!requested.has(item.id) && (!codes.has(item.code) || !['pending', 'empty'].includes(item.status))) return item
    pendingRequests.delete(item.id)
    return { ...item, status: 'expired', expiredAt: createdAt }
  })
  items.value = markBestQuotes([...refreshed, ...previous])
  finishBatch(refreshed, REINQUIRY_DEMO_DELAY_MS)
  return refreshed
}

function placeOrder(payload) {
  const { item, quote, entryMode, principal, limitPrice, executionTime, remark = '' } = payload
  const current = items.value.find((entry) => entry.id === item?.id)
  const currentQuote = current?.quotes.find((entry) => entry.id === quote?.id)
  if (current?.status !== 'quoted' || !currentQuote) throw new Error('当前报价不可下单，请重新询价')
  if (quote.rate !== currentQuote.rate || quote.capacity !== currentQuote.capacity || quote.quotedAt !== currentQuote.quotedAt) throw new Error('报价已更新，请刷新并重新选择报价')
  const error = validateOptionOrder({ ...payload, item: current, quote: currentQuote })
  if (error) throw new Error(error)
  const size = Number(principal)
  const submittedAt = new Date().toISOString()
  const id = `OPT-${Date.now()}-${++sequence}`
  const order = {
    id,
    orderNo: id,
    submittedAt,
    status: '待报',
    inquiryId: current.id,
    quoteId: currentQuote.id,
    code: current.code,
    name: current.name,
    market: current.market,
    account: current.account || 'TZS_T0',
    direction: current.direction,
    tenor: current.tenor,
    strike: current.strike,
    currency: current.currency,
    knockout: currentQuote.knockout,
    exercise: currentQuote.exercise,
    dividend: currentQuote.dividend,
    rate: currentQuote.rate,
    principal: size,
    optionFee: calculateOptionFee(size, currentQuote.rate),
    entryMode,
    limitPrice: entryMode === 'limit' ? Number(limitPrice) : null,
    executionTime: isScheduledEntry(entryMode) ? executionTime.slice() : null,
    participation: current.participation ?? 100,
    inquirySize: current.size,
    quotedAt: currentQuote.quotedAt,
    quoteCapacity: currentQuote.capacity,
    traderRemark: currentQuote.traderRemark || '',
    remark: String(remark).trim(),
  }
  openingOrders.value.unshift(order)
  return order
}

export function useOptionsInquiry() {
  return { items, openingOrders, optionAccount, submitInquiry, submitInquiries, reinquire, placeOrder }
}
