import { isValidPovDuration } from '../../domain/orders/povSchedule.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as vue from 'vue'
import * as marketRules from './orderMarketRules.js'
import { defaultAlgorithmForMarket } from './orderAlgorithmDefaults.js'

// 直接执行真实 SFC setup，替代展示层依赖，覆盖初始化、市场切换及提交门禁。
function setup(file, props, events = [], environment = {}) {
  const { descriptor } = parse(readFileSync(new URL(file, import.meta.url), 'utf8'))
  const script = compileScript(descriptor, { id: 'market-rules-test' }).content
  const imports = { tradingTimeErrorKey: 'faucon-demo-trading-time-error', isValidPovDuration, PovDeadline: {}, ...vue, ...marketRules, defaultAlgorithmForMarket, ArrowDown: {}, ArrowUp: {}, CircleClose: {}, InfoFilled: {},
    ElMessage: { error: message => events.push(['error', message]), success() {} },
    money: String, number: String, formatPrice: String, globalTradingConfig: {}, useDialogShortcuts() {},
    BaseDialog: {}, PositionOrderDialog: {}, OrderContextOverview: {}, inject: (_key, fallback) => fallback, ...environment }
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


test('普通下单和平仓共用票据、改单均限制6小时30分，确认配置及提交均校验', async () => {
  const scope = vue.effectScope()
  const ticket = scope.run(() => setup('./components/OrderTicket.vue', propsFor()))
  ticket.draftAlgorithm.value = 'POV'
  ticket.draftPovHours.value = 5; ticket.draftPovMinutes.value = 59
  ticket.confirmAlgorithmConfig()
  assert.equal(ticket.povHours.value, 5)
  ticket.draftPovHours.value = 6; await vue.nextTick()
  assert.equal(ticket.draftPovMinutes.value, 30)
  assert.deepEqual(ticket.povMinuteOptions.value, Array.from({length:31},(_,minute)=>minute))
  assert.equal(ticket.draftPovParameterError.value, false)
  ticket.draftPovMinutes.value = 31
  assert.equal(ticket.draftPovParameterError.value, true)
  ticket.confirmAlgorithmConfig()
  assert.equal(ticket.povHours.value, 5)
  const amend = scope.run(() => setup('./components/AmendOrderDialog.vue', vue.reactive({ symbol: a, account, brokerAccounts: [], order: { ...a, id: 'one', type: 'limit', side: 'buy', quantity: 100, price: 12, filledQuantity: 0, algorithm: 'POV', algorithmParams: {hours:7, minutes:0, participation:10} } })))
  assert.equal(amend.povInvalid.value, true)
  assert.equal(amend.canSubmit.value, false)
  scope.stop()
})


test('部成改单按原订单总量回填，输入和滑块不累加已成数量', async () => {
  const scope = vue.effectScope(), events = []
  const order = { ...a, id: 'part-filled-total', type: 'limit', side: 'sell', quantity: 2000000, price: 12, filledQuantity: 1000000, algorithm: 'DMA' }
  const props = vue.reactive({ symbol: a, account, brokerAccounts: [], order })
  const form = scope.run(() => setup('./components/AmendOrderDialog.vue', props, events))
  assert.equal(form.displayedQuantity.value, 2000000)
  assert.equal(form.maximumQuantity.value, 2000000)
  assert.equal(form.sliderFraction.value, 100)
  assert.equal(form.changed.value, false)
  form.price.value = 12.01; await vue.nextTick()
  assert.equal(form.displayedQuantity.value, 2000000)
  form.displayedQuantity.value = 1500000
  assert.equal(form.nextQuantity.value, 1500000)
  form.unit.value = 'wan'
  assert.equal(form.displayedQuantity.value, 150)
  form.displayedQuantity.value = 160
  assert.equal(form.nextQuantity.value, 1600000)
  form.sliderFraction.value = 75
  assert.equal(form.nextQuantity.value, 1500000)
  assert.equal(form.validationError.value, '')
  form.submit()
  assert.equal(events.find(([event]) => event === 'submit')[1].quantity, 1500000)
  assert.equal(order.filledQuantity, 1000000)
  form.displayedQuantity.value = 50
  assert.match(form.validationError.value, /不得低于已成数量/)
  props.order = { ...order, inputAmount: 24000000 }; await vue.nextTick()
  assert.equal(form.displayedAmount.value, 24000000)
  form.amountUnit.value = 'wan'
  assert.equal(form.displayedAmount.value, 2400)
  form.displayedAmount.value = 1800
  assert.equal(form.amount.value, 18000000)
  scope.stop()
})


test('非交易时间只拦截最终提交，普通下单快照与改单参数保持可编辑', () => {
  const scope = vue.effectScope(), ticketEvents = [], amendEvents = []
  const gate = { inject: () => () => '当前非交易时间，不可进行操作。' }
  const ticket = scope.run(() => setup('./components/OrderTicket.vue', propsFor(), ticketEvents, gate))
  ticket.snapshot.value = { ...a, type: 'limit', side: 'buy', quantity: 100, price: 12 }
  ticket.confirming.value = true
  ticket.submit()
  assert.equal(ticket.confirming.value, true)
  assert.equal(ticketEvents.some(([event]) => event === 'order'), false)
  assert.equal(ticketEvents.filter(([event]) => event === 'error').at(-1)[1], '当前非交易时间，不可进行操作。')
  const props = vue.reactive({ symbol: a, account, brokerAccounts: [], order: { ...a, id: 'blocked', type: 'limit', side: 'buy', quantity: 1000, price: 12, filledQuantity: 400, algorithm: 'DMA' } })
  const amend = scope.run(() => setup('./components/AmendOrderDialog.vue', props, amendEvents, gate))
  amend.price.value = 12.01
  assert.equal(amend.canSubmit.value, true)
  amend.submit()
  assert.equal(amendEvents.some(([event]) => event === 'submit'), false)
  assert.equal(amend.displayedQuantity.value, 1000)
  assert.equal(amendEvents.filter(([event]) => event === 'error').at(-1)[1], '当前非交易时间，不可进行操作。')
  scope.stop()
})
