import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as vue from 'vue'
import * as marketRules from './orderMarketRules.js'
import { defaultAlgorithmForMarket } from './orderAlgorithmDefaults.js'

// 直接执行真实 SFC setup，替代展示层依赖，覆盖初始化、市场切换及提交门禁。
function setup(file, props, events = []) {
  const { descriptor } = parse(readFileSync(new URL(file, import.meta.url), 'utf8'))
  const script = compileScript(descriptor, { id: 'market-rules-test' }).content
  const imports = { ...vue, ...marketRules, defaultAlgorithmForMarket, ArrowDown: {}, ArrowUp: {}, CircleClose: {}, InfoFilled: {},
    ElMessage: { error: message => events.push(['error', message]), success() {} },
    money: String, number: String, formatPrice: String, globalTradingConfig: {}, useDialogShortcuts() {},
    BaseDialog: {}, PositionOrderDialog: {} }
  const component = new Function(...Object.keys(imports), script.replace(/^import .*$/gm, '').replace('export default', 'return'))(...Object.values(imports))
  return component.setup(props, { expose() {}, emit: (...args) => events.push(args) })
}
const a = { code: '000001', market: 'SZ', name: '平安银行', price: 12, available: 1000, lotSize: 100 }
const hk = { code: '00700', market: 'HK', name: '腾讯控股', price: 320, available: 1000, lotSize: 100 }
const account = { id: 'TZS_T0', cash: 1000000 }
function propsFor(symbol = a) {
  return vue.reactive({ symbol, account, instruments: [a, hk], accounts: [account], counterparties: [], brokerAccounts: [], initialOrder: null })
}
test('真实下单组件：A股市价切到港股自动限价，回切保留限价且恢复市价能力', async () => {
  const scope = vue.effectScope()
  const props = propsFor()
  const form = scope.run(() => setup('./components/OrderTicket.vue', props))
  form.orderType.value = 'market'; await vue.nextTick()
  assert.equal(form.marketOrderAllowed.value, true)
  props.symbol = hk; await vue.nextTick()
  assert.equal(form.orderType.value, 'limit'); assert.equal(form.price.value, 320)
  assert.equal(form.marketOrderAllowed.value, false)
  assert.equal(form.ticketCurrency.value, 'HKD')
  form.quantity.value = 100; await vue.nextTick(); form.preview('buy')
  assert.equal(form.snapshot.value.market, 'HK'); assert.equal(form.snapshot.value.currency, 'HKD')
  assert.equal(form.snapshot.value.isManual, false)
  assert.equal(form.symbols.value.some(row => row.code === hk.code), true)
  form.symbolMarket.value = 'HK'
  assert.deepEqual(form.symbols.value.map(row => row.code), [hk.code])
  props.symbol = a; await vue.nextTick()
  assert.equal(form.orderType.value, 'limit'); assert.equal(form.marketOrderAllowed.value, true)
  form.selectedManualInstrument.value = { ...hk, isManual: true }
  form.orderType.value = 'market'; await vue.nextTick()
  assert.equal(form.orderType.value, 'limit'); assert.equal(form.marketOrderAllowed.value, false)
  scope.stop()
})
test('真实下单组件：港股历史市价不残留，确认时也拒绝非法市价快照', () => {
  const scope = vue.effectScope(), events = []
  const props = propsFor(hk)
  props.initialOrder = { type: 'market', price: null, quantity: 100 }
  const form = scope.run(() => setup('./components/OrderTicket.vue', props, events))
  assert.equal(form.orderType.value, 'limit'); assert.equal(form.canBuy.value, false)
  form.snapshot.value = { ...hk, type: 'market' }; form.submit()
  assert.equal(events.some(([name]) => name === 'order'), false)
  assert.match(events[0][1], /港股仅支持限价/)
  scope.stop()
})
test('真实改单组件：港股只限价且缺失限价时不可提交，其他市场不受影响', async () => {
  const scope = vue.effectScope()
  const props = vue.reactive({ symbol: hk, account, brokerAccounts: [], order: { ...hk, id: 'hk', type: 'market', side: 'buy', quantity: 100, price: null, filledQuantity: 0 } })
  const form = scope.run(() => setup('./components/AmendOrderDialog.vue', props))
  assert.equal(form.orderType.value, 'limit'); assert.equal(form.marketOrderAllowed.value, false)
  assert.equal(form.canSubmit.value, false)
  form.price.value = 320; await vue.nextTick()
  assert.equal(form.canSubmit.value, true)
  props.symbol = a; props.order = { ...a, type: 'market', side: 'buy', quantity: 100, price: null }
  await vue.nextTick()
  assert.equal(form.marketOrderAllowed.value, true); assert.equal(form.orderType.value, 'market')
  scope.stop()
})
