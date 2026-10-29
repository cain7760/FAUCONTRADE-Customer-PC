import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'

const { descriptor } = parse(readFileSync(new URL('./EquityVariants.vue', import.meta.url), 'utf8'))
const ast = compileScript(descriptor, { id: 'order-status-test' }).scriptSetupAst
function evaluate(name, context = {}) {
  const node = ast.find(item => item.type === 'FunctionDeclaration' ? item.id.name === name
    : item.type === 'VariableDeclaration' && item.declarations.some(declaration => declaration.id.name === name))
  assert.ok(node, name)
  const source = descriptor.scriptSetup.content.slice(node.start, node.end)
  return new Function(...Object.keys(context), source + '\nreturn ' + name)(...Object.values(context))
}
const expected = ['未报', '待报', '已报', '待改', '待撤', '部撤', '撤单', '部成', '全成', '拒单', '异常']
const orderStatusMachine = evaluate('orderStatusMachine')

test('所有订单状态和筛选严格使用新十项业务状态及异常', () => {
  assert.deepEqual(orderStatusMachine, expected)
  const options = evaluate('orderStatusOptions', { orderStatusMachine })
  assert.deepEqual(options.map(option => option.value), expected)
  const orderFilters = { value: { status: [] } }, context = { orderStatusMachine, orderFilters }
  evaluate('selectAllOrderStatuses', context)()
  assert.deepEqual(orderFilters.value.status, expected)
  orderFilters.value.status = ['拒单', '异常']
  evaluate('invertOrderStatuses', context)()
  assert.deepEqual(orderFilters.value.status, expected.filter(status => !['拒单', '异常'].includes(status)))
})

test('所有演示订单使用有效状态，拒单与异常保留独立样本和样式', () => {
  const samples = evaluate('demoOrderStatuses'), visual = evaluate('orderStatusVisual')
  assert.ok(samples.every(status => expected.includes(status)))
  for (const status of ['拒单', '异常']) assert.ok(samples.includes(status))
  assert.equal(visual('拒单').tone, 'rejected')
  assert.equal(visual('异常').tone, 'exception')
  assert.equal(visual('待改').tone, 'review')
  assert.equal(visual('部撤').tone, 'draft')
})

test('仅异常系统单允许转手工，拒单和手工单不可转，改撤门禁不变', () => {
  const context = { systemRunning: { value: true }, cancelableQuantity: evaluate('cancelableQuantity') }
  const canOperate = evaluate('canOperateOrder', context), canConvert = evaluate('canConvertToManual', context)
  const row = { quantity: 1000, filledQuantity: 0, orderType: '系统单' }
  for (const status of expected) assert.equal(canOperate({ ...row, status }), ['待报', '已报', '部成'].includes(status))
  assert.equal(canConvert({ ...row, status: '拒单' }), false)
  assert.equal(canConvert({ ...row, status: '拒单', orderType: '手工单' }), false)
  assert.equal(canConvert({ ...row, status: '异常' }), true)
  assert.equal(canConvert({ ...row, status: '异常', orderType: '手工单' }), false)
  assert.deepEqual([...evaluate('terminalOrderStatuses')], ['部撤', '撤单', '全成', '拒单'])
})

test('实际撤单逻辑写入撤单或部撤，已成交数量保持不变', () => {
  for (const filledQuantity of [0, 400]) {
    const row = { status: filledQuantity ? '部成' : '已报', quantity: 1000, filledQuantity, reportQuantity: 1000 - filledQuantity }
    const context = { systemRunning: { value: true }, cancelingOrder: { value: row }, cancelOrderVisible: { value: true },
      canOperateOrder: () => true, cancelableQuantity: evaluate('cancelableQuantity'),
      publishOrderActivityMessage() {}, publishOrderOperationMessage() {} }
    evaluate('confirmCancelOrder', context)()
    assert.equal(row.status, filledQuantity ? '部撤' : '撤单')
    assert.equal(row.filledQuantity, filledQuantity)
    assert.equal(row.reportQuantity, 0)
  }
})
