import test from 'node:test'
import assert from 'node:assert/strict'
import { executionTimeBounds, executionShortcut, executionTimeError, quoteHistory, validateOptionOrder } from './optionOrderModel.js'

const item = { market: 'SZ' }, now = new Date('2026-11-09T10:00:00+08:00')
const payload = { item, quote: { rate: 6.63, capacity: 900 }, entryMode: 'limit', principal: 500, limitPrice: 11.78 }

test('limit requires a separate underlying price; market ignores hidden price and execution time', () => {
  assert.equal(validateOptionOrder(payload, now), '')
  assert.match(validateOptionOrder({ ...payload, limitPrice: null }, now), /下单价格/)
  assert.match(validateOptionOrder({ ...payload, principal: 99 }, now), /100 万起/)
  assert.match(validateOptionOrder({ ...payload, principal: 901 }, now), /反馈量/)
  assert.match(validateOptionOrder({ ...payload, remark: '字'.repeat(201) }, now), /200/)
  assert.equal(validateOptionOrder({ ...payload, entryMode: 'market', limitPrice: null, executionTime: null, remark: '字'.repeat(200) }, now), '')
})

test('TWAP and VWAP require ordered times inside market sessions, allow spanning lunch', () => {
  for (const entryMode of ['twap', 'vwap']) {
    assert.match(validateOptionOrder({ ...payload, entryMode, executionTime: null }, now), /开始和结束/)
    assert.equal(validateOptionOrder({ ...payload, entryMode, executionTime: ['11:00', '14:00'] }, now), '')
  }
  assert.match(executionTimeError(item, ['11:00', '10:00'], now), /晚于/)
  assert.match(executionTimeError(item, ['12:00', '14:00'], now), /交易时段/)
  assert.match(executionTimeError(item, ['14:00', '15:01'], now), /交易时段/)
  assert.match(executionTimeError(item, ['99:00', '15:00'], now), /开始和结束/)
})

test('shortcuts skip A-share and Hong Kong lunch breaks and cap at market close', () => {
  assert.deepEqual(executionShortcut(item, 60, new Date('2026-11-09T11:20:00+08:00')), ['11:23', '13:53'])
  assert.deepEqual(executionShortcut({ market: 'HK' }, 60, new Date('2026-11-09T11:40:00+08:00')), ['11:43', '13:43'])
  assert.deepEqual(executionShortcut(item, 60, new Date('2026-11-09T14:40:00+08:00')), ['14:43', '15:00'])
  assert.deepEqual(executionShortcut(item, 10, new Date('2026-11-09T12:00:00+08:00')), ['13:00', '13:10'])
  assert.deepEqual(executionShortcut(item, 'morning', now), ['10:03', '11:30'])
  assert.deepEqual(executionShortcut(item, 'close', now), ['10:03', '15:00'])
  assert.equal(executionShortcut(item, 'morning', new Date('2026-11-09T13:00:00+08:00')), null)
  assert.equal(executionShortcut(item, 10, new Date('2026-11-09T15:00:00+08:00')), null)
})

test('execution time uses delayed defaults, rejects past starts and caps all option markets at 15:00', () => {
  assert.deepEqual(executionShortcut(item, 10, now), ['10:03', '10:13'])
  assert.deepEqual(executionShortcut(item, 10, now, 5), ['10:05', '10:15'])
  assert.deepEqual(executionShortcut(item, 10, new Date('2026-11-09T08:00:00+08:00')), ['09:15', '09:25'])
  assert.deepEqual(executionShortcut({ market: 'HK' }, 'close', now), ['10:03', '15:00'])
  assert.equal(executionShortcut(item, 10, new Date('2026-11-09T14:57:00+08:00')), null)
  assert.equal(executionTimeError(item, ['09:15', '09:30'], new Date('2026-11-09T09:00:00+08:00')), '')
  assert.match(executionTimeError(item, ['09:14', '09:30'], new Date('2026-11-09T09:00:00+08:00')), /09:15/)
  assert.match(executionTimeError(item, ['09:59', '11:00'], now), /当前时间/)
  assert.match(executionTimeError({ market: 'HK' }, ['14:00', '15:01'], now), /15:00/)
  assert.equal(executionTimeBounds(item, new Date('2026-11-09T10:00:01+08:00')).earliest, 601)
})

test('initial quotation has one row; subsequent quote preserves previous rate including zero', () => {
  assert.equal(quoteHistory({ rate: 6.63, capacity: 900, previousRate: null }).length, 1)
  const rows = quoteHistory({ rate: 6.63, capacity: 900, previousRate: 0, previousCapacity: 500 })
  assert.equal(rows.length, 2)
  assert.equal(rows[1].rate, 0)
  assert.equal(rows[1].capacity, 500)
})

test('final store validation rejects invalid entries without writes and saves VWAP execution parameters', async t => {
  t.mock.timers.enable({ apis: ['Date'], now })
  const { useOptionsInquiry } = await import('./useOptionsInquiry.js')
  const store = useOptionsInquiry(), item = store.items.value.find(item => item.status === 'quoted'), quote = item.quotes[0]
  const count = store.openingOrders.value.length
  assert.throws(() => store.placeOrder({ item, quote, entryMode: 'limit', principal: 500 }), /下单价格/)
  assert.throws(() => store.placeOrder({ item, quote, entryMode: 'vwap', principal: 500, executionTime: ['11:00', '10:00'] }), /晚于/)
  assert.equal(store.openingOrders.value.length, count)
  const order = store.placeOrder({ item, quote, entryMode: 'vwap', principal: 500, executionTime: ['10:00', '11:00'], remark: '分时执行' })
  assert.equal(order.entryMode, 'vwap')
  assert.deepEqual(order.executionTime, ['10:00', '11:00'])
  assert.equal(order.limitPrice, null)
  assert.equal(order.quoteCapacity, quote.capacity)
  assert.equal(order.remark, '分时执行')
  assert.equal(store.openingOrders.value.length, count + 1)
})
