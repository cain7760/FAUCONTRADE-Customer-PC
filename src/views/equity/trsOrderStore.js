import { ref } from 'vue'
import { accounts, positions } from './fixtures'

export const poolOrders = ref([
  { id: 'pool-001', customer: 'Kevin_292933', customerCode: 'CUS-001024', account: 'TRS_T0 - 自营一号', tradeType: '新单', standard: '标准', underlying: '平安银行', direction: '买入', attribute: '开仓', price: '11.78', quantity: '100 万', amount: '10,000,000.00 CNY', submittedAt: '2026-09-22 09:36:12', orderNo: 'HT202609220001', status: 'pending', riskTag: 'approved' },
  { id: 'pool-002', customer: 'Olivia_102484', customerCode: 'CUS-001138', account: 'TRS_T0 - 自营一号', tradeType: '新单', standard: '标准', underlying: '晶澳科技', direction: '卖出', attribute: '平仓', price: '6.92', quantity: '80 万', amount: '8,000,000.00 CNY', submittedAt: '2026-09-22 09:41:06', orderNo: 'HT202609220002', status: 'pending' },
  { id: 'pool-003', customer: 'Ethan_843701', customerCode: 'CUS-001516', account: 'TRS_T1 - 自营二号', tradeType: '改单', standard: '标准', underlying: '天海防务', direction: '买入', attribute: '开仓', price: '6.39', quantity: '50 万', amount: '5,000,000.00 CNY', submittedAt: '2026-09-22 09:48:24', orderNo: 'HT202609220003', status: 'pending', riskTag: 'rejected' },
  { id: 'pool-004', customer: 'Sophia_591620', customerCode: 'CUS-001882', account: 'TRS_T1 - 自营二号', tradeType: '撤单', standard: '非标', underlying: '中证红利低波指数收益互换', direction: '卖出', attribute: '平仓', price: '9,672.40', quantity: '30 万', amount: '3,000,000.00 CNY', submittedAt: '2026-09-22 09:56:40', orderNo: 'HT202609220004', status: 'processing', handler: 'Kevin Zhang', processedAt: '2026-09-22 10:02:14' },
  { id: 'pool-005', customer: 'Liam_308416', customerCode: 'CUS-000946', account: 'TRS_T0 - 自营一号', tradeType: '新单', standard: '标准', underlying: '招商银行', direction: '买入', attribute: '开仓', price: '38.85', quantity: '60 万', amount: '6,000,000.00 CNY', submittedAt: '2026-09-21 15:14:28', orderNo: 'HT202609210028', status: 'processed', handler: 'Kevin Zhang', processedAt: '2026-09-21 15:32:48' },
  { id: 'pool-006', customer: 'Ava_774209', customerCode: 'CUS-002084', account: 'TRS_T2 - 自营三号', tradeType: '新单', standard: '标准', underlying: '贵州茅台', direction: '买入', attribute: '开仓', price: '1456.00', quantity: '100 万', amount: '1,456,000.00 CNY', submittedAt: '2026-09-22 10:06:18', orderNo: 'HT202609220005', status: 'pending' },
  { id: 'pool-007', customer: 'Noah_663845', customerCode: 'CUS-002249', account: 'TRS_T0 - 自营一号', tradeType: '新单', standard: '标准', underlying: '万科 A', direction: '卖出', attribute: '平仓', price: '3.27', quantity: '100 万', amount: '12,000,000.00 CNY', submittedAt: '2026-09-22 10:12:36', orderNo: 'HT202609220006', status: 'pending' },
  { id: 'pool-008', customer: 'Emma_420918', customerCode: 'CUS-002376', account: 'TRS_T1 - 自营二号', tradeType: '改单', standard: '标准', underlying: '中信证券', direction: '买入', attribute: '开仓', price: '26.48', quantity: '70 万', amount: '7,000,000.00 CNY', submittedAt: '2026-09-22 10:18:04', orderNo: 'HT202609220007', status: 'pending' },
  { id: 'pool-009', customer: 'Lucas_857340', customerCode: 'CUS-002451', account: 'TRS_T2 - 自营三号', tradeType: '新单', standard: '标准', underlying: '宁德时代', direction: '买入', attribute: '开仓', price: '186.32', quantity: '20 万', amount: '2,000,000.00 CNY', submittedAt: '2026-09-22 10:25:43', orderNo: 'HT202609220008', status: 'pending' },
  { id: 'pool-010', customer: 'Mia_184276', customerCode: 'CUS-002684', account: 'TRS_T0 - 自营一号', tradeType: '新单', standard: '标准', underlying: '中国平安', direction: '卖出', attribute: '平仓', price: '48.56', quantity: '90 万', amount: '9,000,000.00 CNY', submittedAt: '2026-09-22 10:31:16', orderNo: 'HT202609220009', status: 'pending' },
  { id: 'pool-011', customer: 'Leo_530192', customerCode: 'CUS-002729', account: 'TRS_T1 - 自营二号', tradeType: '撤单', standard: '标准', underlying: '长江电力', direction: '买入', attribute: '开仓', price: '28.34', quantity: '60 万', amount: '6,000,000.00 CNY', submittedAt: '2026-09-22 10:36:50', orderNo: 'HT202609220010', status: 'pending' },
  { id: 'pool-012', customer: 'Ivy_949601', customerCode: 'CUS-002834', account: 'TRS_T2 - 自营三号', tradeType: '新单', standard: '标准', underlying: '比亚迪', direction: '买入', attribute: '开仓', price: '245.80', quantity: '30 万', amount: '3,000,000.00 CNY', submittedAt: '2026-09-22 10:42:08', orderNo: 'HT202609220011', status: 'pending' },
  { id: 'pool-013', customer: 'Owen_271860', customerCode: 'CUS-002905', account: 'TRS_T1 - 自营二号', tradeType: '改单', standard: '标准', underlying: '深华发 A', direction: '卖出', attribute: '平仓', price: '13.70', quantity: '40 万', amount: '4,000,000.00 CNY', submittedAt: '2026-09-22 10:46:22', orderNo: 'HT202609220012', status: 'processing', handler: 'Kevin Zhang', processedAt: '2026-09-22 10:49:08' },
])

export const claimedHtOrders = ref([])
const isSystemRequest = order => ['改单', '撤单'].includes(order.tradeType)
const systemCompletedRequests = poolOrders.value.filter(order => order.status === 'pending' && isSystemRequest(order))
export const traderHtOrders = ref([
  ...poolOrders.value.filter(order => order.status !== 'pending').map(order => ({ ...order, id: `trader-${order.id}` })),
  ...systemCompletedRequests.map(order => ({
    ...order,
    id: `trader-${order.id}`,
    status: 'processed',
    handler: '系统',
    processedAt: '2026-09-22 10:08:20',
    remark: `${order.remark || ''}${order.riskTag === 'rejected' ? ' 风控校验失败，改单已自动失败。' : ` ${order.tradeType}已由系统自动完成。`}`,
  })),
])

poolOrders.value = poolOrders.value.filter(order => order.status === 'pending' && !isSystemRequest(order))

const claimedCustomerNames = ['Kevin_292933', 'Olivia_102484', 'Ethan_843701']

function formatAmount(value) {
  return `${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CNY`
}

function formatQuantity(value) {
  return `${Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} 股`
}

// The equity workspace has no separate client selector, so manual orders are attributed
// to the signed-in demo client until a customer identity is supplied by the order API.
export function addManualEquityOrderToPool(order) {
  if (order?.executionType !== 'highTouch') return
  const isAmountOrder = order.inputAmount !== null && order.inputAmount !== undefined
  const quantity = Number(order.quantity || 0)
  const amount = Number(isAmountOrder ? order.inputAmount : order.estimate || 0)
  const position = positions.find(item => item.code === order.code)
  const account = accounts.find(item => item.id === order.account)
  const submittedAt = new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')

  const poolOrder = {
    id: `equity-manual-${order.id}`,
    sourceOrderId: order.id,
    customer: 'Kevin_292933',
    customerCode: 'CUS-001024',
    account: account ? `${account.id} - ${account.name}` : (order.account || '--'),
    tradeType: '新单',
    underlying: order.name,
    code: `${order.code}.${position?.market || 'SZ'}`,
    standard: position ? '标准' : '非标',
    status: 'pending',
    direction: order.side === 'sell' ? '卖出' : '买入',
    attribute: order.openClose === '平' ? '平仓' : '开仓',
    price: order.type === 'market' ? '--' : Number(order.price || 0).toFixed(2),
    quantity: formatQuantity(quantity),
    amount: formatAmount(amount),
    orderNo: order.orderNo,
    submittedAt,
    remark: order.note || `来自权益交易手工单 ${order.orderNo}。`,
  }
  const existingIndex = poolOrders.value.findIndex(item => item.sourceOrderId === order.id)
  if (existingIndex >= 0) poolOrders.value.splice(existingIndex, 1, poolOrder)
  else poolOrders.value.unshift(poolOrder)
}

export function movePoolOrdersToTrader(ids, details = {}) {
  const claimed = poolOrders.value.filter(order => ids.includes(order.id))
  if (!claimed.length) return []
  traderHtOrders.value.push(...claimed.map(order => ({
    ...order,
    id: `trader-${order.id}`,
    status: details.status || 'processing',
    handler: details.handler || 'Kevin Zhang',
    processedAt: details.processedAt || '2026-09-22 10:08:20',
    ...details,
  })))
  poolOrders.value = poolOrders.value.filter(order => !ids.includes(order.id))
  return claimed
}

export function claimPoolOrders(ids) {
  const claimed = movePoolOrdersToTrader(ids)
  if (!claimed.length) return

  claimedHtOrders.value.push(...claimed.map((order, index) => {
    const holding = positions[(claimedHtOrders.value.length + index) % positions.length]
    return {
      ...order,
      id: `claimed-${order.id}`,
      traderOrderId: `trader-${order.id}`,
      customer: claimedCustomerNames[(claimedHtOrders.value.length + index) % claimedCustomerNames.length],
      underlying: holding.name,
      code: `${holding.code}.${holding.market}`,
      price: holding.price.toFixed(2),
      status: 'orderPending',
      remark: '已从订单池认领，等待交易员处理。',
      history: [{ label: '订单认领', at: '2026-09-22 10:08:20', detail: '交易员已从订单池认领。' }],
      assets: '128,560,000.00 CNY',
      available: '46,250,000.00 CNY',
    }
  }))
}
