import { hongKongDemoInstruments } from './hongKongInstruments.js'
import { positions } from './fixtures'
const truncate = (value, digits) => {
  const factor = 10 ** digits
  const result = Math.trunc(Number(value) * factor) / factor
  return Object.is(result, -0) ? 0 : result
}
export const money = n => truncate(n, 2).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const number = n => truncate(n, 3).toLocaleString('en-US', { maximumFractionDigits: 3 })
export const price = (n, market) => {
  const digits = market === 'HK' ? 3 : 2
  return truncate(n, digits).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
const cents = value => Math.round(Number(value) * 100)
// 演示持仓按日初批次和当日成交计算；真实接口接入时仍以服务端持仓快照为准。
export function calculatePositionMetrics(position, isAStock = false) {
  const openingLots = position.openingLots || [{ quantity: position.opening, price: position.cost }]
  const opening = openingLots.reduce((total, lot) => total + lot.quantity, 0)
  const lots = openingLots.map(lot => ({ ...lot }))
  let qty = opening
  let todayBuys = 0
  let realizedCents = 0
  for (const execution of position.todayExecutions || []) {
    if (execution.side === 'buy') {
      lots.push({ quantity: execution.quantity, price: execution.price })
      qty += execution.quantity
      todayBuys += execution.quantity
      continue
    }
    let remaining = execution.quantity
    for (const lot of lots) {
      const matched = Math.min(lot.quantity, remaining)
      realizedCents += (cents(execution.price) - cents(lot.price)) * matched
      lot.quantity -= matched
      remaining -= matched
      if (!remaining) break
    }
    if (remaining) throw new RangeError(`演示持仓 ${position.code || ''} 的卖出数量超过 FIFO 持仓`)
    qty -= execution.quantity
  }
  return {
    opening,
    qty,
    available: qty - (position.pendingSell || 0) - (isAStock ? todayBuys : 0),
    dailyRealizedProfit: realizedCents / 100,
  }
}
export const variantRows = positions.map((p, i) => {
  const metrics = calculatePositionMetrics(p, true) // 当前演示持仓均为 A 股多头。
  const value = cents(p.price) * metrics.qty / 100
  const floatingProfit = (cents(p.price) - cents(p.cost)) * metrics.qty / 100
  const marginRate = 10
  const executionType = i % 4 === 3 ? 'highTouch' : 'lowTouch'
  return {
    ...p,
    ...metrics,
    direction: '多',
    currency: 'CNY',
    executionType,
    orderType: executionType === 'highTouch' ? '手工单' : '系统单',
    algorithm: i % 3 === 0 ? 'POV' : 'DMA',
    orderRemark: executionType === 'highTouch' ? ['请按委托价格优先处理', '客户指定分批执行', '请关注盘中流动性'][i % 3] : '',
    traderRemark: executionType === 'highTouch' ? ['已受理，正在处理', '建议分批成交', '已反馈可执行价格'][i % 3] : '',
    value,
    valueWan: value / 10000,
    marginOccupied: metrics.qty * cents(p.cost) * marginRate / 10000,
    marginRate,
    floatingProfit,
    totalProfit: floatingProfit + metrics.dailyRealizedProfit,
    // 演示持仓属于该交易日快照；该日期也是导出时间筛选依据。
    positionDate: '2026-09-18',
    account: 'TZS_T0',
    lotSize: p.lotSize || 100,
    id: `T0-${i}`,
  }
})

// 下单检索使用独立的全市场演示标的池，不能从当前持仓列表推导。
const marketLabels = ['华远科技', '新城制造', '中原能源', '海岳医药', '智联电子', '云帆软件', '国泰材料', '远景通信', '华夏消费', '深港物流']
export const marketInstruments = [
  ...variantRows,
  ...hongKongDemoInstruments,
  ...Array.from({ length: 220 }, (_, index) => {
    const serial = index + 1
    const market = serial % 10 === 0 ? 'HK' : serial % 2 ? 'SZ' : 'SH'
    const code = market === 'HK' ? String(1000 + serial).padStart(5, '0') : String(100000 + serial).padStart(6, '0')
    const price = Number((6.5 + (serial * 1.73) % 183).toFixed(2))
    return { id: `M-${serial}`, code, name: `${marketLabels[index % marketLabels.length]} ${String(serial).padStart(3, '0')}`, market, currency: market === 'HK' ? 'HKD' : 'CNY', price, cost: Number((price * .97).toFixed(2)), change: 0, qty: 0, available: 0, lotSize: 100 }
  }),
]
export const variants = [
  { id: 'classic', title: 'A · 经典三栏', description: '熟悉的操作动线，订单簿与下单并排', dock: 'right' },
  { id: 'table', title: 'B · 持仓优先', description: '完整表宽，下方集中行情与交易操作', dock: 'bottom' },
  { id: 'quick', title: 'C · 左侧快单', description: '左手交易、中央持仓、右侧行情', dock: 'left' },
]
