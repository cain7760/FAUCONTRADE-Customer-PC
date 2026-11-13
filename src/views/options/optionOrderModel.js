import { executionTimeError } from '../../domain/orders/executionSchedule.js'
export { executionTimeBounds, executionTimeError, executionShortcut } from '../../domain/orders/executionSchedule.js'

export const entryModeLabels = { limit: '限价', market: '市价', twap: 'TWAP', vwap: 'VWAP' }
export const isScheduledEntry = mode => ['twap', 'vwap'].includes(mode)
export function quoteHistory(quote) {
  const rows = [{ id: 'latest', label: '最新', rate: quote?.rate, capacity: quote?.capacity }]
  if (quote?.previousRate != null) rows.push({ id: 'previous', label: '上一次', rate: quote.previousRate, capacity: quote.previousCapacity })
  return rows
}

export function validateOptionOrder(payload, now = new Date()) {
  if (!Object.hasOwn(entryModeLabels, payload.entryMode)) return '请选择入场方式'
  const principal = Number(payload.principal)
  if (!Number.isFinite(principal) || principal < 100) return '名义本金须为 100 万起'
  if (principal > Number(payload.quote?.capacity || 0)) return '名义本金不可超过当前报价反馈量'
  if (payload.entryMode === 'limit' && (!Number.isFinite(Number(payload.limitPrice)) || Number(payload.limitPrice) <= 0)) return '请输入大于 0 的下单价格'
  if (isScheduledEntry(payload.entryMode)) {
    const error = executionTimeError(payload.item, payload.executionTime, now)
    if (error) return error
  }
  if (String(payload.remark || '').length > 200) return '备注最多 200 字'
  return ''
}
