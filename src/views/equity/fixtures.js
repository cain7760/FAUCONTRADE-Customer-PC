// 全部为方案演示数据；各数量字段使用同一单账户口径。
export const accounts = [
  { id: 'TZS_T0', name: '自营一号', email: 'kevin.zhang@faucontrade.com', cash: 945527.41, frameworks: [{ id: 'price-preference', name: '价格偏好' }, { id: 'liquidity-priority', name: '流动性优先' }] },
  { id: 'TZS_T1', name: '自营二号', email: 'trader.two@faucontrade.com', cash: 620800, frameworks: [{ id: 'risk-hedge', name: '风险对冲' }, { id: 'return-enhancement', name: '收益增强' }] },
]
export const positions = [
  { code: '000001', name: '平安银行', market: 'SZ', price: 11.78, cost: 11.70, change: .68, opening: 9300, qty: 9300, available: 9300 },
  { code: '002459', name: '晶澳科技', market: 'SZ', price: 6.92, cost: 7.14, change: -1.56, opening: 11000, qty: 12500, available: 10000, todayExecutions: [{ side: 'sell', quantity: 1000, price: 6.78 }, { side: 'buy', quantity: 2500, price: 7.14 }] },
  { code: '300008', name: '天海防务', market: 'SZ', price: 6.39, cost: 6.30, change: 1.27, opening: 25000, qty: 24000, available: 24000, todayExecutions: [{ side: 'sell', quantity: 1000, price: 6.48 }] },
  { code: '000020', name: '深华发 A', market: 'SZ', price: 13.70, cost: 12.86, change: 2.09, opening: 6000, qty: 6000, available: 6000 },
  { code: '600036', name: '招商银行', market: 'SH', price: 38.85, cost: 39.10, change: -.46, opening: 7200, qty: 8200, available: 6200, todayExecutions: [{ side: 'sell', quantity: 1000, price: 39.62 }, { side: 'buy', quantity: 2000, price: 39.10 }] },
  { code: '600519', name: '贵州茅台', market: 'SH', price: 1456.00, cost: 1432.60, change: .82, opening: 500, qty: 500, available: 500 },
  { code: '000002', name: '万科 A', market: 'SZ', price: 3.27, cost: 3.15, change: .31, opening: 46100, qty: 44100, available: 44100, todayExecutions: [{ side: 'sell', quantity: 2000, price: 3.03 }] },
  { code: '600030', name: '中信证券', market: 'SH', price: 26.48, cost: 27.12, change: -.75, opening: 14000, qty: 15000, available: 12000, pendingSell: 1000, todayExecutions: [{ side: 'sell', quantity: 1000, price: 27.28 }, { side: 'buy', quantity: 2000, price: 27.12 }] },
  { code: '300750', name: '宁德时代', market: 'SZ', price: 186.32, cost: 182.90, change: 1.16, opening: 1800, qty: 1800, available: 1800 },
  { code: '601318', name: '中国平安', market: 'SH', price: 48.56, cost: 49.20, change: -.23, opening: 9000, qty: 8000, available: 8000, todayExecutions: [{ side: 'sell', quantity: 1000, price: 49.08 }] },
  { code: '600900', name: '长江电力', market: 'SH', price: 28.34, cost: 27.85, change: .53, opening: 17000, qty: 16000, available: 16000, todayExecutions: [{ side: 'sell', quantity: 1000, price: 27.93 }] },
  { code: '002594', name: '比亚迪', market: 'SZ', price: 245.80, cost: 242.50, change: 1.42, opening: 1400, qty: 2000, available: 1200, pendingSell: 200, todayExecutions: [{ side: 'buy', quantity: 600, price: 242.50 }] },
]
