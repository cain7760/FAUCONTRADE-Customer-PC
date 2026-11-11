import { orderTradingSession } from '../../domain/orders/marketSession.js'

export const entryModeLabels = { limit: '限价', market: '市价', twap: 'TWAP', vwap: 'VWAP' }
export const isScheduledEntry = mode => ['twap', 'vwap'].includes(mode)
const minutes = value => /^\d{2}:\d{2}$/.test(value || '') && Number(value.slice(0, 2)) < 24 && Number(value.slice(3)) < 60
  ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : NaN
const timeText = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
// 期权执行时间统一为 09:15–15:00，午休及提前收市沿用标的市场窗口。
export function executionTimeBounds(item, now = new Date()) {
  const session = orderTradingSession(item, now)
  const clock = minutes(session?.time.slice(0, 5)) + (Number(session?.time.slice(6)) > 0 ? 1 : 0)
  const windows = (session?.windows || []).map(([from, to], index) => [
    index === 0 ? 9 * 60 + 15 : minutes(from.slice(0, 5)),
    Math.min(15 * 60, minutes(to.slice(0, 5))),
  ]).filter(([from, to]) => from < to)
  return { clock, earliest: Math.max(9 * 60 + 15, clock), windows }
}

export function quoteHistory(quote) {
  const rows = [{ id: 'latest', label: '最新', rate: quote?.rate, capacity: quote?.capacity }]
  if (quote?.previousRate != null) rows.push({ id: 'previous', label: '上一次', rate: quote.previousRate, capacity: quote.previousCapacity })
  return rows
}

export function executionTimeError(item, range, now = new Date()) {
  if (!Array.isArray(range) || range.length !== 2 || range.some(value => !Number.isFinite(minutes(value)))) return '请选择开始和结束时间'
  const [start, end] = range.map(minutes)
  if (start >= end) return '结束时间须晚于开始时间'
  const { earliest, windows } = executionTimeBounds(item, now)
  if (!windows.some(([from, to]) => start >= from && start < to)
    || !windows.some(([from, to]) => end > from && end <= to)) return '请选择 09:15 至 15:00 范围内的有效交易时段'
  if (start < earliest) return '开始时间不可早于当前时间'
  return ''
}

// 快捷时长按有效交易分钟计算，跳过午休，最晚到当日收盘。
export function executionShortcut(item, shortcut, now = new Date(), delayMinutes = 3) {
  const { clock, windows } = executionTimeBounds(item, now)
  const delayedStart = clock + delayMinutes
  const next = windows.find(([, end]) => delayedStart < end)
  if (!next) return null
  const start = Math.max(delayedStart, next[0])
  if (shortcut === 'morning') return windows.length > 1 && start < windows[0][1] ? [timeText(start), timeText(windows[0][1])] : null
  if (shortcut === 'close') return [timeText(start), timeText(windows.at(-1)[1])]
  let remaining = Number(shortcut)
  if (!Number.isFinite(remaining) || remaining <= 0) return null
  for (const [from, to] of windows) {
    const cursor = Math.max(start, from)
    if (cursor >= to) continue
    if (remaining <= to - cursor) return [timeText(start), timeText(cursor + remaining)]
    remaining -= to - cursor
  }
  return [timeText(start), timeText(windows.at(-1)[1])]
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
