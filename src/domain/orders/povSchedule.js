import { executionTimeError, executionDurationMinutes } from './executionSchedule.js'
import { marketClock, orderMarket, orderTradingSession } from './marketSession.js'

const povOrderCutoffs = { A: '14:57:00', HK: '16:00:00' }

export function povOrderTimeError(order, now = new Date()) {
  if (order.algorithm !== 'POV' || order.executionType === 'highTouch') return ''
  const market = orderMarket(order)
  const cutoff = povOrderCutoffs[market]
  const clock = marketClock(now, market)
  return cutoff && clock?.time >= cutoff ? '当前时段不支持POV下单。' : ''
}

export const MAX_POV_HOURS = 6.5
export function isValidPovDuration(hours, minutes) {
  if (hours == null || minutes == null || hours === '' || minutes === '') return false
  const h = Number(hours), m = Number(minutes)
  return Number.isInteger(h) && Number.isInteger(m) && h >= 0 && m >= 0 && m <= 59
    && h * 60 + m > 0 && h * 60 + m <= MAX_POV_HOURS * 60
}
const seconds = time => time.split(':').reduce((value, part) => value * 60 + Number(part), 0)
const timeText = value => [Math.floor(value / 3600), Math.floor(value / 60) % 60, value % 60].map(part => String(part).padStart(2, '0')).join(':')

export function povDeadline(symbol, hours, minutes, now = new Date()) {
  if (!isValidPovDuration(hours, minutes)) return null
  const session = orderTradingSession(symbol, now)
  if (!session) return null
  if (!session.windows.length) return { ...session, state: 'closed-day', end: null }
  let remaining = (Number(hours) * 60 + Number(minutes)) * 60
  let cursor = seconds(session.time)
  const close = seconds(session.close)
  if (cursor >= close) return { ...session, state: 'closed', end: session.close }
  for (const [start, end] of session.windows) {
    const from = Math.max(cursor, seconds(start)), to = seconds(end)
    if (from >= to) continue
    if (remaining <= to - from) return { ...session, state: 'scheduled', end: timeText(from + remaining) }
    remaining -= to - from
    cursor = to
  }
  return { ...session, state: 'scheduled', end: session.close }
}

export function povDeadlineText(deadline) {
  if (!deadline) return '--'
  if (deadline.state === 'closed-day') return '当日休市'
  return deadline.end + (deadline.state === 'closed' ? '（已收盘）' : '')
}

// 旧订单继续接受运行时长，新配置同时保存起止时间及有效交易时长。
export function povParametersError(symbol, params, now = new Date(), requireTime = false) {
  const participation = Number(params.participation)
  if (!Number.isInteger(participation) || participation < 1 || participation > 25) return '市场成交占比须为 1%–25%'
  if (params.executionTime || requireTime) {
    const error = executionTimeError(symbol, params.executionTime, now, true)
    if (error) return error
    const duration = executionDurationMinutes(symbol, params.executionTime, now, true)
    if (!(duration > 0 && duration <= MAX_POV_HOURS * 60)) return '有效运行时间须大于 0 且不超过 6 小时 30 分钟'
    return ''
  }
  return isValidPovDuration(params.hours, params.minutes) ? '' : '运行时间须大于 0 且不超过 6 小时 30 分钟'
}
