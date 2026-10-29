import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import { computed } from 'vue'

const { descriptor } = parse(readFileSync(new URL('./EquityVariants.vue', import.meta.url), 'utf8'))
const declarations = compileScript(descriptor, { id: 'order-exception-test' }).scriptSetupAst
function evaluate(name, context = {}) {
  const node = declarations.find(item => item.type === 'FunctionDeclaration' ? item.id.name === name : item.type === 'VariableDeclaration' && item.declarations.some(declaration => declaration.id.name === name))
  assert.ok(node, name)
  const source = descriptor.scriptSetup.content.slice(node.start, node.end)
  return new Function(...Object.keys(context), `${source}\nreturn ${name}`)(...Object.values(context))
}

test('异常为独立筛选状态和样本，拒单样本保持独立', () => {
  const states = evaluate('orderStatusMachine')
  const samples = evaluate('demoOrderStatuses')
  assert.equal(states.filter(status => status === '异常').length, 1)
  assert.equal(samples.filter(status => status === '异常').length, 1)
  assert.equal(samples.filter(status => status === '拒单').length, 2)
  const orderFilters = { value: { status: [] } }
  const context = { orderStatusMachine: states, orderFilters }
  evaluate('selectAllOrderStatuses', context)()
  assert.ok(orderFilters.value.status.includes('异常'))
  orderFilters.value.status = ['拒单']
  evaluate('invertOrderStatuses', context)()
  assert.ok(orderFilters.value.status.includes('异常'))
  assert.ok(!orderFilters.value.status.includes('拒单'))
})

test('只有异常置顶，拒单遵循默认顺序或用户排序', () => {
  const rows = [
    { id: 'reported', status: '已报', price: 30 },
    { id: 'rejected-system', status: '拒单', orderType: '系统单', price: 10 },
    { id: 'exception', status: '异常', price: 20 },
    { id: 'review-rejected', status: '拒单', price: 5 },
    { id: 'rejected-manual', status: '拒单', orderType: '手工单', price: 40 },
  ]
  const sorted = direction => evaluate('sortedOrders', { computed, orders: { value: rows }, orderSortState: { value: { prop: direction ? 'price' : null, direction } }, orderSortValue: (row, prop) => row[prop] }).value.map(row => row.id)
  assert.deepEqual(sorted(null), ['exception', 'reported', 'rejected-system', 'review-rejected', 'rejected-manual'])
  assert.deepEqual(sorted('ascending'), ['exception', 'review-rejected', 'rejected-system', 'reported', 'rejected-manual'])
  assert.deepEqual(sorted('descending'), ['exception', 'rejected-manual', 'reported', 'rejected-system', 'review-rejected'])
  assert.equal(rows[0].id, 'reported')
})

test('异常专用行高亮和图标不再套用拒单状态', () => {
  const rowClass = evaluate('orderRowClassName'), visual = evaluate('orderStatusVisual')
  assert.equal(rowClass({ row: { status: '异常' } }), 'order-row-exception')
  for (const status of ['拒单', '全成', '已报']) assert.equal(rowClass({ row: { status } }), '')
  assert.equal(visual('异常').tone, 'exception')
  assert.equal(visual('拒单').tone, 'rejected')
  assert.notEqual(visual('异常').path, visual('拒单').path)
})

test('仅异常系统单可转手工，拒单不可转，异常不可改撤', () => {
  const context = { systemRunning: { value: true }, cancelableQuantity: evaluate('cancelableQuantity') }
  const canOperate = evaluate('canOperateOrder', context), canConvert = evaluate('canConvertToManual', context)
  const row = { quantity: 1000, filledQuantity: 0, orderType: '系统单' }
  assert.equal(canOperate({ ...row, status: '异常' }), false)
  assert.equal(canConvert({ ...row, status: '异常' }), true)
  assert.equal(canConvert({ ...row, status: '异常', orderType: '手工单' }), false)
  assert.equal(canOperate({ ...row, status: '拒单' }), false)
  assert.equal(canConvert({ ...row, status: '拒单' }), false)
  assert.equal(canOperate({ ...row, status: '已报' }), true)
})
