import { ref } from 'vue'
import { buildInquiryItems, calculateOptionFee, createInitialInquiries, markBestQuotes, resolveInquiryBatch, validateInquiry } from './inquiryModel.js'

// Module lifetime keeps the prototype's inquiries and opening orders when switching menus.
const items = ref(createInitialInquiries())
const openingOrders = ref([])
const pendingRequests = new Set()
let sequence = 0

function finishBatch(batch) {
  const ids = new Set(batch.map((item) => item.id))
  setTimeout(() => {
    const resolved = new Map(resolveInquiryBatch(batch).map((item) => [item.id, item]))
    items.value = markBestQuotes(items.value.map((item) => resolved.get(item.id) || item))
    ids.forEach((id) => pendingRequests.delete(id))
  }, 1200)
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
      pendingRequests.add(item.id)
    })
  })
  const submitted = batches.flat()
  items.value = markBestQuotes([...submitted, ...items.value])
  batches.forEach(finishBatch)
  return submitted
}

function submitInquiry(draft) {
  return submitInquiries([draft])
}

function reinquire(itemIds) {
  const requested = new Set(itemIds)
  const batch = items.value.filter((item) => requested.has(item.id) && item.status !== 'pending' && !pendingRequests.has(item.id))
  if (!batch.length) throw new Error('请选择可重询的记录')
  const ids = new Set(batch.map((item) => item.id))
  const createdAt = new Date().toISOString()
  batch.forEach((item) => pendingRequests.add(item.id))
  items.value = markBestQuotes(items.value.map((item) => ids.has(item.id) ? { ...item, status: 'pending', createdAt } : item))
  finishBatch(batch.map((item) => ({ ...item, createdAt })))
  return batch
}

function placeOrder({ item, quote, entryMode, principal, remark = '' }) {
  const current = items.value.find((entry) => entry.id === item?.id)
  const currentQuote = current?.quotes.find((entry) => entry.id === quote?.id)
  if (current?.status !== 'quoted' || !currentQuote) throw new Error('当前报价不可下单，请重新询价')
  if (quote.rate !== currentQuote.rate || quote.capacity !== currentQuote.capacity || quote.quotedAt !== currentQuote.quotedAt) throw new Error('报价已更新，请刷新并重新选择报价')
  if (!['limit', 'market', 'twap'].includes(entryMode)) throw new Error('请选择入场方式')
  const size = Number(principal)
  if (!Number.isFinite(size) || size <= 0) throw new Error('请输入大于 0 的名义本金')
  if (size > currentQuote.capacity) throw new Error('名义本金不可超过当前报价反馈量')
  if (String(remark).length > 200) throw new Error('备注最多 200 字')
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
    remark: String(remark).trim(),
  }
  openingOrders.value.unshift(order)
  return order
}

export function useOptionsInquiry() {
  return { items, openingOrders, submitInquiry, submitInquiries, reinquire, placeOrder }
}
