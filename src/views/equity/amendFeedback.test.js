import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import { orderTypeError } from './orderMarketRules.js'

const { descriptor } = parse(readFileSync(new URL('./EquityVariants.vue', import.meta.url), 'utf8'))
const declaration = compileScript(descriptor, { id: 'amend-feedback-test' }).scriptSetupAst
  .find(node => node.type === 'FunctionDeclaration' && node.id.name === 'acceptAmendOrder')
const source = descriptor.scriptSetup.content.slice(declaration.start, declaration.end)
function scenario(filledQuantity = 0) {
  const row = { id: 'one', orderNo: 'WT1', code: '000001', name: '平安银行', market: 'SZ', account: 'TZS_T0',
    quantity: 1000, filledQuantity, price: 12, side: 'buy', openClose: '开', status: filledQuantity ? '部成' : '已报', inputAmount: null }
  const notifications = [], success = [], errors = []
  const context = { systemRunning: { value: true }, demoOrders: { value: [row] }, canOperateOrder: target => ['待报', '已报', '部成'].includes(target.status),
    orderTypeError, amendingSymbol: { value: { price: 12 } }, enrichOrder: value => ({ ...value }), number: String, money: String,
    tab: { value: 'positions' }, ElMessage: { success: value => success.push(value), error: value => errors.push(value) },
    publishOrderActivityMessage: () => notifications.push('activity'), publishTransactionMessage: () => notifications.push('transaction') }
  const submit = new Function(...Object.keys(context), source + '\nreturn acceptAmendOrder')(...Object.values(context))
  const payload = delta => ({ orderId: row.id, type: 'limit', price: 12.5, quantity: row.quantity + delta, quantityDelta: delta,
    operation: delta > 0 ? '追单' : delta < 0 ? '部撤' : '改单', executionType: 'lowTouch', side: 'buy',
    inputAmount: null, algorithm: 'DMA', note: '', brokerAccountId: 'broker', brokerAccountLabel: '内部上手账户' })
  return { row, context, submit, payload, notifications, success, errors }
}
test('普通、加量、减量、部成及撤回剩余量的改单只提示一次，不新增任何消息', () => {
  for (const [filled, delta] of [[0, 0], [0, 100], [0, -100], [400, 0], [400, -600]]) {
    const state = scenario(filled), quantity = state.row.quantity
    state.submit(state.payload(delta))
    assert.deepEqual(state.success, ['改单提交成功'])
    assert.deepEqual(state.notifications, [])
    assert.equal(state.row.filledQuantity, filled)
    assert.equal(state.row.status, filled ? '部撤' : '待改')
    assert.ok(state.row.feedback)
    assert.equal(state.context.tab.value, 'orders')
    assert.equal(state.context.demoOrders.value.length, (filled ? quantity + delta > filled : delta > 0) ? 2 : 1)
  }
})
test('暂停、订单失效和校验失败不误报改单提交成功', () => {
  const paused = scenario(); paused.context.systemRunning.value = false; paused.submit(paused.payload(0))
  const missing = scenario(); missing.submit({ ...missing.payload(0), orderId: 'missing' })
  const stale = scenario(); stale.row.status = '全成'; stale.submit(stale.payload(0))
  const invalid = scenario(); invalid.row.market = 'HK'; invalid.submit({ ...invalid.payload(0), type: 'market' })
  for (const state of [paused, missing, stale, invalid]) {
    assert.deepEqual(state.success, []); assert.deepEqual(state.notifications, [])
  }
  assert.match(invalid.errors[0], /港股仅支持限价/)
})
