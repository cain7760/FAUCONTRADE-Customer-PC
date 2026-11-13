import { isValidPovDuration, povOrderTimeError, povParametersError } from '../../domain/orders/povSchedule.js'
import { executionShortcut, executionDurationMinutes } from '../../domain/orders/executionSchedule.js'
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
  const imports = { tradingTimeErrorKey: 'faucon-demo-trading-time-error', isValidPovDuration,
    povOrderTimeError: order => povOrderTimeError(order, new Date('2026-11-12T10:00:00+08:00')),
    povParametersError: (symbol, params, _now, required) => povParametersError(symbol, params, new Date('2026-11-12T10:00:00+08:00'), required),
    executionShortcut, executionDurationMinutes, ExecutionTimeRange: {}, ExecutionAlgorithmTabs: {}, ...vue, ...marketRules, defaultAlgorithmForMarket, ArrowDown: {}, ArrowUp: {}, CircleClose: {}, InfoFilled: {},
    ElMessage: { error: message => events.push(['error', message]), success() {} },
    money: String, number: String, formatPrice: String, globalTradingConfig: {}, useDialogShortcuts() {},
    BaseDialog: {}, DialogActions: {}, InstrumentSearchHistory: {}, PositionOrderDialog: {}, OrderContextOverview: {}, inject: (_key, fallback) => fallback, ...environment }
  const component = new Function(...Object.keys(imports), script.replace(/^import .*$/gm, '').replace('export default', 'return'))(...Object.values(imports))
  return component.setup(props, { expose() {}, emit: (...args) => events.push(args) })
}
const a = { code: '000001', market: 'SZ', name: '平安银行', price: 12, available: 1000, lotSize: 100 }
const hk = { code: '00700', market: 'HK', name: '腾讯控股', price: 320, available: 1000, lotSize: 100 }
const account = { id: 'TZS_T0', cash: 1000000 }
function propsFor(symbol = a) {
  return vue.reactive({ symbol, account, instruments: [a, hk], accounts: [account], counterparties: [], brokerAccounts: [], initialOrder: null })
}

for (const [symbol, before, cutoff] of [
  [a, '14:56:59', '14:57:00'],
  [hk, '15:59:59', '16:00:00'],
]) {
  for (const context of ['普通下单', '平仓', '追单']) {
    test(`${symbol.market} ${context}：POV截止前可确认，跨截止时间后拒绝提交及再次下单`, async () => {
      const scope = vue.effectScope(), events = []
      const props = propsFor(symbol)
      props.closeMode = context === '平仓'
      const side = props.closeMode ? 'sell' : 'buy'
      props.initialOrder = {
        algorithm: 'POV', executionType: 'lowTouch', type: 'limit', price: symbol.price, quantity: 100,
        sourceOrderSide: context === '普通下单' ? undefined : side,
      }
      let now = new Date(`2026-11-12T${before}+08:00`)
      const form = scope.run(() => setup('./components/OrderTicket.vue', props, events, {
        povOrderTimeError: order => povOrderTimeError(order, now),
      }))
      await vue.nextTick()
      form.preview(side)
      assert.equal(form.confirming.value, true)
      assert.equal(form.snapshot.value.algorithm, 'POV')
      now = new Date(`2026-11-12T${cutoff}+08:00`)
      form.algorithm.value = 'DMA'
      form.submit()
      assert.equal(events.some(([event]) => event === 'order'), false)
      assert.equal(events.at(-1)[1], '当前时段不支持POV下单。')
      assert.equal(form.confirming.value, true)
      assert.equal(form.quantity.value, 100)
      form.confirming.value = false
      form.algorithm.value = 'POV'
      form.preview(side)
      assert.equal(form.confirming.value, false)
      assert.equal(events.at(-1)[1], '当前时段不支持POV下单。')
      scope.stop()
    })
  }
}

test('POV截止后其他算法与手工单仍可正常确认和提交', async () => {
  for (const [algorithm, executionType] of [['DMA', 'lowTouch'], ['none', 'lowTouch'], ['POV', 'highTouch']]) {
    const scope = vue.effectScope(), events = []
    const props = propsFor()
    props.initialOrder = { algorithm, executionType, type: 'limit', price: 12, quantity: 100 }
    const form = scope.run(() => setup('./components/OrderTicket.vue', props, events, {
      povOrderTimeError: order => povOrderTimeError(order, new Date('2026-11-12T16:05:00+08:00')),
    }))
    await vue.nextTick()
    form.preview('buy')
    assert.equal(form.confirming.value, true)
    form.submit()
    assert.equal(events.filter(([event]) => event === 'order').length, 1)
    assert.equal(form.algorithm.value, algorithm === 'none' ? 'DMA' : algorithm)
    scope.stop()
  }
})

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


test('下单和平仓共用票据、改单均保存起止时间并兼容旧运行时长', async () => {
  const scope = vue.effectScope()
  const ticket = scope.run(() => setup('./components/OrderTicket.vue', propsFor()))
  ticket.algorithm.value = 'POV'
  ticket.draftPovExecutionTime.value = ['11:00', '14:00']
  ticket.confirmAlgorithmConfig()
  assert.equal(ticket.povHours.value, 1)
  assert.equal(ticket.povMinutes.value, 30)
  assert.deepEqual(ticket.povExecutionTime.value, ['11:00', '14:00'])
  assert.equal(ticket.draftPovParameterError.value, '')
  ticket.draftPovExecutionTime.value = ['14:00', '13:00']
  assert.match(ticket.draftPovParameterError.value, /晚于/)
  ticket.confirmAlgorithmConfig()
  assert.deepEqual(ticket.povExecutionTime.value, ['11:00', '14:00'])
  ticket.price.value = 12
  ticket.quantity.value = 100
  ticket.preview('buy')
  assert.deepEqual(ticket.snapshot.value.algorithmParams.executionTime, ['11:00', '14:00'])
  ticket.draftPovExecutionTime.value = ['10:10', '10:20']
  ticket.cancelAlgorithmConfig()
  assert.deepEqual(ticket.povExecutionTime.value, ['11:00', '14:00'])
  const amend = scope.run(() => setup('./components/AmendOrderDialog.vue', vue.reactive({ symbol: a, account, brokerAccounts: [], order: { ...a, id: 'one', type: 'limit', side: 'buy', quantity: 100, price: 12, filledQuantity: 0, algorithm: 'POV', algorithmParams: {hours:7, minutes:0, participation:10} } })))
  assert.equal(amend.povInvalid.value, true)
  assert.equal(amend.canSubmit.value, false)
  amend.algorithm.value = 'POV'
  amend.draftPovExecutionTime.value = ['10:03', '11:03']
  amend.confirmAlgorithmConfig()
  assert.equal(amend.povInvalid.value, false)
  assert.equal(amend.canSubmit.value, true)
  assert.deepEqual(amend.povExecutionTime.value, ['10:03', '11:03'])
  scope.stop()
})

test('POV确认后跨过开始时间，最终提交重新校验快照', () => {
  const scope = vue.effectScope(), events = []
  const props = propsFor()
  props.initialOrder = { algorithm: 'POV', type: 'limit', price: 12, quantity: 100,
    algorithmParams: { hours: 1, minutes: 0, participation: 10, executionTime: ['10:03', '11:03'] } }
  let now = new Date('2026-11-12T10:00:00+08:00')
  const form = scope.run(() => setup('./components/OrderTicket.vue', props, events, {
    povParametersError: (symbol, params, _now, required) => povParametersError(symbol, params, now, required),
  }))
  form.preview('buy')
  assert.equal(form.confirming.value, true)
  now = new Date('2026-11-12T10:04:00+08:00')
  form.submit()
  assert.equal(events.some(([event]) => event === 'order'), false)
  assert.equal(events.at(-1)[1], '开始时间不可早于当前时间')
  assert.deepEqual(form.snapshot.value.algorithmParams.executionTime, ['10:03', '11:03'])
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

test('金额改单接受非千元整数，保留小数金额并继续执行业务校验', async () => {
  const scope = vue.effectScope(), events = []
  const symbol = { ...a, code: '002594', name: '比亚迪', price: 245.8 }
  const props = vue.reactive({ symbol, account, brokerAccounts: [], order: { ...symbol, id: 'amount', type: 'limit', side: 'sell', quantity: 1200, inputAmount: 294960, price: 245.8, filledQuantity: 0 } })
  const form = scope.run(() => setup('./components/AmendOrderDialog.vue', props, events))
  form.displayedAmount.value = 294969.23; await vue.nextTick()
  assert.equal(form.canSubmit.value, true)
  assert.equal(form.nextQuantity.value, 1200)
  form.submit()
  const payload = events.find(([name]) => name === 'submit')[1]
  assert.equal(payload.inputAmount, 294969.23)
  assert.equal(payload.quantity, 1200)
  form.displayedAmount.value = 0; await vue.nextTick()
  assert.equal(form.canSubmit.value, false)
  scope.stop()
})

for (const mode of ['quantity', 'amount']) {
  test(`超额买入${mode === 'amount' ? '金额' : '数量'}可确认，最终提交失败且保留输入`, async () => {
    const scope = vue.effectScope(), events = []
    const props = propsFor()
    props.account = { ...account, cash: 1200 }
    props.initialOrder = { type: 'limit', price: 12, quantityMode: mode, quantity: 200, amount: 2400 }
    const form = scope.run(() => setup('./components/OrderTicket.vue', props, events, {
      ElMessage: { error: message => events.push(['error', message]), success: message => events.push(['success', message]) },
    }))
    await vue.nextTick()
    assert.equal(form.maxBuy.value, 100)
    assert.equal(form.canBuy.value, true)
    form.preview('buy')
    assert.equal(form.confirming.value, true)
    assert.equal(form.exceedsMaxBuy.value, true)
    assert.equal(form.quantityLimitError.value, '')
    assert.equal(form.snapshot.value.quantity, 200)
    form.submit()
    assert.deepEqual(events, [['error', '下单失败，最大可用不足']])
    assert.equal(form.confirming.value, true)
    assert.equal(form.quantity.value, 200)
    assert.equal(form.amount.value, 2400)
    scope.stop()
  })
}

test('最终买入使用确认后最新可用资金，恢复资金后可正常提交', async () => {
  const scope = vue.effectScope(), events = []
  const props = propsFor()
  props.account = { ...account, cash: 1200 }
  props.initialOrder = { type: 'limit', price: 12, quantity: 100 }
  const form = scope.run(() => setup('./components/OrderTicket.vue', props, events))
  await vue.nextTick()
  form.preview('buy')
  assert.equal(form.exceedsMaxBuy.value, false)
  props.account.cash = 0
  form.submit()
  assert.equal(events.some(([event]) => event === 'order'), false)
  assert.equal(events.at(-1)[1], '下单失败，最大可用不足')
  props.account.cash = 1200
  form.submit()
  assert.equal(events.filter(([event]) => event === 'order').length, 1)
  assert.equal(form.confirming.value, false)
  assert.equal(form.quantity.value, undefined)
  scope.stop()
})

test('市价超额买入可确认，最终按预估金额及最新可用资金反馈不足', async () => {
  const scope = vue.effectScope(), events = []
  const props = propsFor()
  props.account = { ...account, cash: 1200 }
  props.initialOrder = { type: 'market', quantity: 200 }
  const form = scope.run(() => setup('./components/OrderTicket.vue', props, events))
  await vue.nextTick()
  form.preview('buy')
  assert.equal(form.confirming.value, true)
  assert.equal(form.exceedsMaxBuy.value, true)
  form.submit()
  assert.deepEqual(events, [['error', '下单失败，最大可用不足']])
  scope.stop()
})

test('最大可卖限制保持有效，正常卖出不受可用资金影响', async () => {
  const scope = vue.effectScope(), events = []
  const props = propsFor()
  props.account = { ...account, cash: 0 }
  props.initialOrder = { type: 'limit', price: 12, quantity: 1100 }
  const form = scope.run(() => setup('./components/OrderTicket.vue', props, events))
  await vue.nextTick()
  form.preview('sell')
  assert.equal(form.confirming.value, false)
  assert.match(form.quantityLimitError.value, /超出最大可卖/)
  form.quantity.value = 1000
  await vue.nextTick()
  form.preview('sell')
  assert.equal(form.confirming.value, true)
  assert.equal(form.exceedsMaxBuy.value, false)
  form.submit()
  assert.equal(events.find(([event]) => event === 'order')[1].side, 'sell')
  scope.stop()
})

test('自定义手工标的保留原可用资金豁免', async () => {
  const scope = vue.effectScope(), events = []
  const props = propsFor()
  props.account = { ...account, cash: 0 }
  props.initialOrder = { executionType: 'highTouch', type: 'limit', price: 12, quantity: 1 }
  const form = scope.run(() => setup('./components/OrderTicket.vue', props, events))
  form.selectedManualInstrument.value = { ...a, code: 'CUSTOM', isManual: true }
  await vue.nextTick()
  form.preview('buy')
  assert.equal(form.confirming.value, true)
  assert.equal(form.exceedsMaxBuy.value, false)
  form.submit()
  assert.equal(events.find(([event]) => event === 'order')[1].isManual, true)
  scope.stop()
})
