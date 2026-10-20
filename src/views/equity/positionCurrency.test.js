import test from 'node:test'
import assert from 'node:assert/strict'
import { positionMarginInCny } from './positionCurrency.js'

const rates = { CNY: 1, HKD: 0.92, USD: 7.18 }

test('持仓保证金按金额币种换算为 CNY，缺失币种时按市场推断', () => {
  assert.equal(positionMarginInCny({ marginOccupied: 1000, currency: 'CNY' }, rates), 1000)
  assert.equal(positionMarginInCny({ marginOccupied: 1000, currency: 'HKD' }, rates), 920)
  assert.equal(positionMarginInCny({ marginOccupied: 1000, currency: 'USD' }, rates), 7180)
  assert.equal(positionMarginInCny({ marginOccupied: 1000, market: 'HK' }, rates), 920)
})

test('已换算的接口保证金不按标的币种重复换算，零金额保持为零', () => {
  assert.equal(positionMarginInCny({ marginOccupied: 920, currency: 'HKD', marginCurrency: 'CNY' }, rates), 920)
  assert.equal(positionMarginInCny({ marginOccupied: 0, currency: 'USD' }, rates), 0)
})

test('金额或汇率不可用时不冒充 CNY 金额', () => {
  assert.equal(positionMarginInCny({ marginOccupied: 1000, currency: 'EUR' }, rates), null)
  assert.equal(positionMarginInCny({ marginOccupied: null, currency: 'CNY' }, rates), null)
  assert.equal(positionMarginInCny({ marginOccupied: NaN, currency: 'CNY' }, rates), null)
  assert.equal(positionMarginInCny({ marginOccupied: 1000, currency: 'HKD' }, { HKD: 0 }), null)
})
