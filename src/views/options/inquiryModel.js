// Synthetic inquiry fixtures for the customer prototype; no quote is sourced from a trading API.
export const instruments = [
  { code: '000001', name: '平安银行', market: 'SZ', currency: 'CNY' },
  { code: '00700', name: '腾讯控股', market: 'HK', currency: 'HKD' },
  { code: 'HSCEI', name: 'HSCEI 指数', market: 'HK', currency: 'HKD' },
  { code: '000002', name: '万科 A', market: 'SZ', currency: 'CNY' },
  { code: '600036', name: '招商银行', market: 'SH', currency: 'CNY' },
  { code: '600519', name: '贵州茅台', market: 'SH', currency: 'CNY' },
  { code: '002594', name: '比亚迪', market: 'SZ', currency: 'CNY' },
  { code: '600570', name: '恒生电子', market: 'SH', currency: 'CNY' },
  { code: '002459', name: '晶澳科技', market: 'SZ', currency: 'CNY' },
  { code: '300008', name: '天海防务', market: 'SZ', currency: 'CNY' },
  { code: '000020', name: '深华发 A', market: 'SZ', currency: 'CNY' },
  { code: '600030', name: '中信证券', market: 'SH', currency: 'CNY' },
  { code: '300750', name: '宁德时代', market: 'SZ', currency: 'CNY' },
  { code: '601318', name: '中国平安', market: 'SH', currency: 'CNY' },
  { code: '600900', name: '长江电力', market: 'SH', currency: 'CNY' },
  { code: '09988', name: '阿里巴巴-W', market: 'HK', currency: 'HKD' },
  { code: '03690', name: '美团-W', market: 'HK', currency: 'HKD' },
  { code: '01810', name: '小米集团-W', market: 'HK', currency: 'HKD' },
  { code: '00388', name: '香港交易所', market: 'HK', currency: 'HKD' },
  { code: '00005', name: '汇丰控股', market: 'HK', currency: 'HKD' },
  { code: 'HSI', name: '恒生指数', market: 'HK', currency: 'HKD' },
  { code: 'HSTECH', name: '恒生科技指数', market: 'HK', currency: 'HKD' },
  { code: '000300', name: '沪深300指数', market: 'SH', currency: 'CNY' },
  { code: '000905', name: '中证500指数', market: 'SH', currency: 'CNY' },
]

export const inquiryStatusLabels = { pending: '询价中…', empty: '暂无报价', expired: '报价已失效', quoted: '报价成功' }
export function inquiryStatusLabel(item) {
  return item.status === 'pending' && item.sourceInquiryId ? '重询中…' : inquiryStatusLabels[item.status]
}

export function defaultDraft() {
  return { code: '000001', direction: 'call', size: 500, tenors: ['1M'], strikes: [100], knockout: '无要求', exercise: '无要求', dividend: '无要求', currency: 'CNY' }
}

export function createInquiryFormDraft() {
  return { ...defaultDraft(), code: '', size: null, tenors: [], strikes: [] }
}

function dateOf(value = new Date()) {
  return value instanceof Date ? value : new Date(value)
}

export function validateInquiry(draft) {
  if (!draft || !instruments.some((instrument) => instrument.code === draft.code)) return '请选择标的'
  if (draft.direction !== 'call') return '目前仅支持看涨期权'
  if (!Number.isSafeInteger(Number(draft.size)) || Number(draft.size) <= 0) return '请输入大于 0 的整数询价规模'
  if (!Array.isArray(draft.tenors) || !draft.tenors.length || draft.tenors.length > 4) return '期限请选择 1 至 4 个'
  if (new Set(draft.tenors).size !== draft.tenors.length || draft.tenors.some((tenor) => !/^\d+(?:\.\d+)?M$/.test(tenor) || Number.parseFloat(tenor) <= 0 || Number.parseFloat(tenor) > 99)) return '期限仅支持大于 0、不超过 99M 且不重复的月数'
  if (!Array.isArray(draft.strikes) || !draft.strikes.length || draft.strikes.length > 3) return '执行价请选择 1 至 3 个'
  const strikes = draft.strikes.map(Number)
  if (strikes.some((strike) => !Number.isFinite(strike) || strike < 70 || strike > 120)) return '执行价应在 70% 至 120% 之间'
  if (new Set(strikes).size !== strikes.length) return '执行价不可重复'
  for (const [key, label] of [['knockout', '敲出规则'], ['exercise', '最快行权日'], ['dividend', '分红规则'], ['currency', '结算币种']]) {
    if (typeof draft[key] !== 'string' || !draft[key].trim()) return `请选择${label}`
  }
  if (!['CNY', 'HKD', 'USD'].includes(draft.currency)) return '请选择有效的结算币种'
  return ''
}

export function buildInquiryItems(draft, catalog = instruments, now = new Date()) {
  const error = validateInquiry(draft)
  if (error) throw new Error(error)
  const instrument = catalog.find((entry) => entry.code === draft.code)
  if (!instrument) throw new Error('请选择标的')
  const createdAt = dateOf(now).toISOString()
  const batchId = `RFQ-${dateOf(now).getTime()}-${draft.code}`
  return draft.tenors.flatMap((tenor) => draft.strikes.map((strike) => ({
    id: `${batchId}-${draft.direction}-${tenor}-${strike}`,
    batchId,
    code: instrument.code,
    name: instrument.name,
    market: instrument.market,
    account: draft.account || 'TZS_T0',
    direction: draft.direction,
    size: Number(draft.size),
    currency: draft.currency,
    createdAt,
    tenor,
    strike: Number(strike),
    knockout: draft.knockout,
    exercise: draft.exercise,
    dividend: draft.dividend,
    status: 'pending',
    quotes: [],
  })))
}

// The mock inventory is intentionally finite. A missing combination routes the whole batch
// through the same delayed customer response, with no processing-source label in its data.
function inventoryFor(item) {
  const standard = ['1M', '2M', '3M', '6M'].includes(item.tenor)
    && [80, 90, 95, 100, 103, 105].includes(item.strike)
    && ['T+1', '无要求'].includes(item.exercise)
    && ['无要求', '连板敲出', '主3创2', '3连板', '协商敲出'].includes(item.knockout)
    && ['无要求', '分红调整', '分红不调整', '分红调整初价'].includes(item.dividend)
    && ['CNY', instruments.find((instrument) => instrument.code === item.code)?.currency].includes(item.currency)
  if (!standard || (item.code === '000002' && item.strike === 100)) return []
  return [
    { capacity: 1000, knockout: '主3创2', dividend: '分红不调整', spread: 0 },
    { capacity: 2000, knockout: '协商敲出', dividend: '分红调整初价', spread: 0.3 },
    { capacity: 1500, knockout: '3连板', dividend: '分红调整', spread: 0.65 },
  ].filter((quote) => (item.knockout === '无要求' || quote.knockout === item.knockout || (item.knockout === '连板敲出' && ['主3创2', '3连板'].includes(quote.knockout)))
    && (item.dividend === '无要求' || quote.dividend === item.dividend))
}

export function canAutoQuoteBatch(items) {
  return items.length > 0 && items.every((item) => inventoryFor(item).some((quote) => quote.capacity >= item.size))
}

function rateFor(item) {
  const base = { '000001': 5.62, '00700': 8.15, HSCEI: 6.5, '000002': 7.2, '600036': 5.15, '600519': 6.12, '002594': 8.4 }[item.code] ?? 6.5
  const period = Number.parseFloat(item.tenor) * (item.tenor.endsWith('Y') ? 12 : item.tenor.endsWith('D') ? 1 / 30 : 1)
  const strikeEffect = (100 - item.strike) * (item.direction === 'call' ? 0.12 : -0.12)
  return Math.max(0.1, base + (period - 1) * 0.75 + strikeEffect)
}

export function inquiryRoundKey(item) {
  return `${item.code}:${item.inquiryRound || item.batchId}`
}

function groupKey(item) {
  return [item.account || 'TZS_T0', inquiryRoundKey(item), item.direction, item.strike, item.tenor, item.currency, item.size].join(':')
}

export function markBestQuotes(items) {
  const groups = new Map()
  for (const item of items) {
    const key = groupKey(item)
    const group = groups.get(key) || { pending: false, rates: [] }
    group.pending ||= item.status === 'pending'
    if (item.status === 'quoted') group.rates.push(...item.quotes.map((quote) => quote.rate))
    groups.set(key, group)
  }
  return items.map((item) => {
    const group = groups.get(groupKey(item))
    const lowest = Math.min(...group.rates)
    return { ...item, quotes: item.quotes.map((quote) => ({ ...quote, isBest: !group.pending && item.status === 'quoted' && quote.rate === lowest })) }
  })
}

export function resolveInquiryBatch(items, now = new Date()) {
  const auto = canAutoQuoteBatch(items)
  const quotedAt = dateOf(now).toISOString()
  return markBestQuotes(items.map((item) => {
    // A deliberately unavailable fixture also exercises the manual-response empty state.
    const unavailable = item.code === '000002' && item.strike === 100
    const matching = inventoryFor(item).filter((quote) => quote.capacity >= item.size)
    const manual = [{ capacity: item.size, knockout: item.knockout === '无要求' ? '协商敲出' : item.knockout, dividend: item.dividend === '无要求' ? '分红调整' : item.dividend, spread: 0.45 }]
    const candidates = unavailable ? [] : auto ? matching : manual
    const quotes = candidates.map((quote, index) => {
      const previous = (item.previousQuotes || item.quotes)[index]
      const rate = Math.round((rateFor(item) + quote.spread) * 100) / 100
      return {
        id: `${item.id}-Q${index + 1}`,
        rate,
        capacity: quote.capacity,
        knockout: quote.knockout,
        exercise: item.exercise === '无要求' ? 'T+1' : item.exercise,
        dividend: quote.dividend,
        quotedAt,
        previousRate: previous?.rate ?? null,
        previousCapacity: previous?.capacity ?? null,
        traderRemark: '',
      }
    })
    return { ...item, status: quotes.length ? 'quoted' : 'empty', quotes }
  }))
}

export function quoteIsBest(item, quote) {
  if (item.status !== 'quoted') return false
  if (typeof quote.isBest === 'boolean') return quote.isBest
  return item.quotes.length > 0 && quote.rate === Math.min(...item.quotes.map((entry) => entry.rate))
}

export function createInitialInquiries(now = new Date()) {
  const stamp = dateOf(now).getTime()
  const make = (draft, minutesAgo) => buildInquiryItems({ ...defaultDraft(), ...draft }, instruments, new Date(stamp - minutesAgo * 60000))
  // 演示时间穿插有报价与无报价状态，仍由真实的更新时间排序规则展示。
  const seed = [
    ...resolveInquiryBatch(make({ code: '00700', size: 1000, tenors: ['1M'], strikes: [100] }, 2), new Date(stamp - 1 * 60000)),
    ...make({ code: '600030', tenors: ['1M', '2M'] }, 3),
    ...resolveInquiryBatch(make({ code: 'HSCEI', size: 500, tenors: ['1M', '2M'] }, 6), new Date(stamp - 5 * 60000)),
    ...make({ code: '600036', tenors: ['1M', '2M'] }, 7).map(item => ({ ...item, status: 'empty' })),
    ...resolveInquiryBatch(make({ code: '000002', size: 500, strikes: [100, 103] }, 10), new Date(stamp - 9 * 60000)),
    ...make({ code: '600570', tenors: ['1M', '2M'] }, 11).map(item => ({ ...item, status: 'expired' })),
  ]
  return markBestQuotes(seed)
}

export function calculateOptionFee(principal, rate) {
  return Math.round(Number(principal) * 10000 * Number(rate)) / 100
}

// 同一个筛选项多选取并集，各参数仍由调用方组合为交集。
export function matchesInquiryFilter(value, selected) {
  return !selected?.length || selected.includes(value)
}
