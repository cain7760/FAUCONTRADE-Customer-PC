import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as vue from 'vue'
import { nonTradingTimeMessage } from '../../composables/useTradingTime.js'

function setupPage() {
  const props = vue.reactive({ context: {
    systemRunning: vue.ref(true), tradingTimeMode: vue.ref('non-trading'),
    toggleSystemStatus() {}, setTradingTimeMode() {},
  }, paused: false, downloadCsv() {} })
  const calls = [], messages = []
  let afterConfirmation = () => {}
  const imports = {
    ...vue, inject: () => () => props.context.tradingTimeMode === 'non-trading' ? nonTradingTimeMessage : '',
    tradingTimeErrorKey: 'test', BaseDialog: {}, DialogActions: {}, TradingTable: {}, SortHeader: {},
    ColumnConfigPopover: {}, OutlineActionButton: {}, TradingStatusBar: {}, OptionInquiryForm: {},
    OptionInquiryRecords: {}, ReinquiryAnnotation: {}, OptionOrderTicket: {}, OptionsRecordFilters: {}, useDialogShortcuts() {},
    inquiryStatusLabel() {}, matchesInquiryFilter() {},
    ElMessage: { warning: message => messages.push(message), success() {} },
    ElMessageBox: { confirm: async () => { calls.push('confirmation'); afterConfirmation() } },
    useOptionsInquiry: () => ({ items: vue.ref([]), openingOrders: vue.ref([]),
      submitInquiries: () => { calls.push('inquiry'); return [{ code: '000001' }] },
      reinquire: () => { calls.push('reinquiry'); return [] },
      placeOrder: () => { calls.push('order'); return { id: 'order-1' } },
    }),
  }
  const { descriptor } = parse(readFileSync(new URL('./OptionsTradingPage.vue', import.meta.url), 'utf8'))
  const script = compileScript(descriptor, { id: 'options-trading-time' }).content
  const component = new Function(...Object.keys(imports), script.replace(/^import .*$/gm, '').replace('export default', 'return'))(...Object.values(imports))
  return { page: component.setup(props, { expose() {} }), props, calls, messages,
    onConfirm: callback => { afterConfirmation = callback } }
}
const payload = { quote: { rate: 8 }, principal: 500, item: { currency: 'CNY', name: '平安银行' } }

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
  const { page, props, calls, messages, onConfirm } = setupPage()
  props.context.tradingTimeMode = 'trading'
  page.requestInquiry([])
  await page.requestBatchInquiry([])
  page.requestReinquiry(['old']); await page.confirmReinquiry()
  await page.submitOrder(payload)
  assert.deepEqual(calls, ['inquiry', 'inquiry', 'reinquiry', 'confirmation', 'order'])
  onConfirm(() => { props.context.tradingTimeMode = 'non-trading' })
  await page.submitOrder(payload)
  assert.equal(calls.filter(call => call === 'order').length, 1)
  assert.equal(messages.at(-1), nonTradingTimeMessage)
  assert.equal(page.submitting.value, false)
})
