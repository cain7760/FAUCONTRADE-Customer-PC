const cutoffMinutes = {
  A: 14 * 60 + 55,
  SH: 14 * 60 + 55,
  SZ: 14 * 60 + 55,
  HK: 15 * 60 + 55,
}

function chinaMarketMinutes(now) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return Number(values.hour) * 60 + Number(values.minute)
}

export function defaultAlgorithmForMarket(market, now = new Date()) {
  const cutoff = cutoffMinutes[market]
  return cutoff != null && chinaMarketMinutes(now) >= cutoff ? 'DMA' : 'POV'
}
