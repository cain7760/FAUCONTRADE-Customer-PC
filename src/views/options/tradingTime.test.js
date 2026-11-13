import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as vue from 'vue'
import { entryModeLabels, validateOptionOrder } from './optionOrderModel.js'
import { calculateOptionFee } from './inquiryModel.js'
import { nonTradingTimeMessage } from '../../composables/useTradingTime.js'

function setupPage(availableBalance = 1000000) {
  const props = vue.reactive({ context: {
    systemRunning: vue.ref(true), tradingTimeMode: vue.ref('non-trading'),
    cnyExchangeRate: currency => ({ CNY: 1, HKD: 0.92, USD: 7.18 })[currency],
    toggleSystemStatus() {}, setTradingTimeMode() {},
  }, paused: false, downloadCsv() {} })
  const calls = [], messages = [], orders = []
  const imports = {
    ...vue, inject: () => () => props.context.tradingTimeMode === 'non-trading' ? nonTradingTimeMessage : '',
    tradingTimeErrorKey: 'test', BaseDialog: {}, DialogActions: {}, TradingTable: {}, SortHeader: {},
    ColumnConfigPopover: {}, OutlineActionButton: {}, TradingStatusBar: {}, OptionInquiryForm: {},
    OptionInquiryRecords: {}, ReinquiryAnnotation: {}, OptionOrderTicket: {}, OptionDirectionBadge: {}, OptionsRecordFilters: {}, useDialogShortcuts() {},
    inquiryStatusLabel() {}, matchesInquiryFilter() {}, OptionOrderConfirmation: {}, entryModeLabels, validateOptionOrder, calculateOptionFee,
    ElMessage: { warning: message => messages.push(message), success() {} },
    useOptionsInquiry: () => ({ items: vue.ref([]), openingOrders: vue.ref([]), optionAccount: vue.ref({availableBalance}),
      submitInquiries: () => { calls.push('inquiry'); return [{ code: '000001' }] },
      reinquire: () => { calls.push('reinquiry'); return [] },
      placeOrder: payload => { calls.push('order'); orders.push(payload); return { id: 'order-1' } },
    }),
  }
  const { descriptor } = parse(readFileSync(new URL('./OptionsTradingPage.vue', import.meta.url), 'utf8'))
  const script = compileScript(descriptor, { id: 'options-trading-time' }).content
  const component = new Function(...Object.keys(imports), script.replace(/^import .*$/gm, '').replace('export default', 'return'))(...Object.values(imports))
  return { page: component.setup(props, { expose() {} }), props, calls, messages, orders }
}
const payload = { entryMode: 'limit', limitPrice: 11.78, quote: { rate: 8, capacity: 1000 }, principal: 500, item: { currency: 'CNY', name: '平安银行' } }

test('非交易时间阻止普通、批量、重询及下单，保留重询确认窗口和原数据', async () => {
  const { page, calls, messages } = setupPage()
  page.requestInquiry([])
  await assert.rejects(page.requestBatchInquiry([]), { message: nonTradingTimeMessage })
  page.requestReinquiry(['old'])
  assert.equal(page.reinquiryVisible.value, true)
  await page.confirmReinquiry()
  assert.equal(page.reinquiryVisible.value, true)
  await page.submitOrder(payload)
  assert.deepEqual(calls, [])
  assert.deepEqual(messages, Array(3).fill(nonTradingTimeMessage))
})

test('交易时间恢复全部提交，下单确认期间切换非交易时间也不可写入委托', async () => {
  const { page, props, calls, messages, orders } = setupPage()
  props.context.tradingTimeMode = 'trading'
  page.requestInquiry([])
  await page.requestBatchInquiry([])
  page.requestReinquiry(['old']); await page.confirmReinquiry()
  await page.submitOrder(payload)
  assert.deepEqual(calls, ['inquiry', 'inquiry', 'reinquiry'])
  assert.ok(page.orderSnapshot.value)
  await page.confirmOrder()
  assert.deepEqual(calls, ['inquiry', 'inquiry', 'reinquiry', 'order'])
  await page.submitOrder(payload)
  props.context.tradingTimeMode = 'non-trading'
  await page.confirmOrder()
  assert.equal(calls.filter(call => call === 'order').length, 1)
  assert.equal(messages.at(-1), nonTradingTimeMessage)
  assert.equal(page.submitting.value, false)
})


test('下单预览快照与表单独立，返回不创建订单，重复确认不创建第二单', async () => {
  const { page, props, calls } = setupPage()
  props.context.tradingTimeMode = 'trading'
  const draft = structuredClone(payload)
  page.submitOrder(draft)
  draft.principal = 900
  assert.equal(page.orderSnapshot.value.principal, 500)
  assert.deepEqual(calls, [])
  page.orderSnapshot.value = null
  await page.confirmOrder()
  assert.deepEqual(calls, [])
  page.submitOrder(payload)
  await page.confirmOrder()
  await page.confirmOrder()
  assert.deepEqual(calls, ['order'])
  assert.equal(page.activeTab.value, 'opening')
  assert.equal(page.selectedOrderId.value, 'order-1')
})


test('资金不足先确认转交易员，取消不下单，继续只打开预览，最终提交保留处理标记', async () => {
  const { page, props, calls, orders } = setupPage(0)
  props.context.tradingTimeMode = 'trading'
  const draft = structuredClone(payload)
  page.submitOrder(draft)
  draft.principal = 900
  assert.equal(page.insufficientFundsSnapshot.value.principal, 500)
  assert.equal(page.orderSnapshot.value, null)
  page.cancelInsufficientFunds()
  await page.continueWithTrader()
  assert.deepEqual(calls, [])
  assert.equal(page.orderSnapshot.value, null)
  page.submitOrder(payload)
  const continuing = page.continueWithTrader()
  assert.equal(page.orderSnapshot.value, null)
  await continuing
  assert.equal(page.insufficientFundsVisible.value, false)
  assert.equal(page.orderSnapshot.value.requiresTraderHandling, true)
  assert.deepEqual(calls, [])
  await page.confirmOrder()
  assert.deepEqual(calls, ['order'])
  assert.equal(orders[0].requiresTraderHandling, true)
})

test('资金刚好覆盖期权费直接预览，外币期权费换算 CNY 比较', () => {
  const { page, props } = setupPage(400000)
  props.context.tradingTimeMode = 'trading'
  page.submitOrder(payload)
  assert.ok(page.orderSnapshot.value)
  assert.equal(page.insufficientFundsVisible.value, false)
  page.orderSnapshot.value = null
  page.submitOrder({...payload, item: {...payload.item, currency: 'USD'}})
  assert.equal(page.orderSnapshot.value, null)
  assert.equal(page.insufficientFundsVisible.value, true)
})

test('资金不足继续时仍检查交易时间，非交易时间不打开下单确认', async () => {
  const { page, props, calls, messages } = setupPage(0)
  props.context.tradingTimeMode = 'trading'
  page.submitOrder(payload)
  props.context.tradingTimeMode = 'non-trading'
  await page.continueWithTrader()
  assert.equal(page.orderSnapshot.value, null)
  assert.equal(page.insufficientFundsVisible.value, true)
  assert.equal(messages.at(-1), nonTradingTimeMessage)
  assert.deepEqual(calls, [])
})
