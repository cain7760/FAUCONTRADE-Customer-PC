// marginCurrency 可标明接口保证金已是 CNY，避免按标的币种重复换算。
export function positionMarginInCny(row, exchangeRates) {
  const currency = row.marginCurrency || row.currency || (row.market === 'HK' ? 'HKD' : row.market === 'US' ? 'USD' : 'CNY')
  const rate = currency === 'CNY' ? 1 : exchangeRates[currency]
  if (row.marginOccupied == null || rate == null) return null
  const amount = Number(row.marginOccupied)
  const exchangeRate = Number(rate)
  return Number.isFinite(amount) && Number.isFinite(exchangeRate) && exchangeRate > 0 ? amount * exchangeRate : null
}
