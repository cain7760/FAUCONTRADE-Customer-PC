import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('当日与历史实际使用同一套筛选及表格组件，历史页不另造样式和排序', () => {
  for (const [adapter, shared] of [['OrdersTable.vue', 'OrderRecords.vue'], ['TradesTable.vue', 'TradeRecords.vue']]) {
    assert.ok(read('../equity/components/' + adapter).includes('../../../components/trading/' + shared))
    assert.ok(read('./DataPage.vue').includes('../../components/trading/' + shared))
    const component = read('../../components/trading/' + shared)
    assert.ok(component.includes('class="order-filters"'))
    assert.ok(component.includes('class="filter-query"'))
    assert.ok(component.includes('ColumnConfigPopover'))
    assert.ok(component.includes('historical'))
    assert.ok(component.includes('v-if="!historical" label="历史"'))
  }
  const page = read('./DataPage.vue')
  assert.doesNotMatch(page, /<el-table\s|<table\s|<thead|history-status--|order-fill-progress-track/)
  assert.doesNotMatch(page.split('<style scoped>')[1], /\.order-filters\s*\{|\.order-status|\.sort-heading|\.trading-table/)
  assert.ok(page.includes('#after-order-number="{ visible, inPopover, visibleCount }"'))
  assert.doesNotMatch(page, /data-history-dates/)
  assert.ok(page.includes('TradingAccountFilter'))
  assert.doesNotMatch(page.slice(page.indexOf('<header class="positions-tabs"'), page.indexOf('</header>')), /el-select|TradingAccountFilter/)
  const order = read('../../components/trading/OrderRecords.vue')
  assert.match(order, /v-if="!historical" label="操作" width="96"/)
  assert.ok(order.includes('role="progressbar"'))
  assert.ok(order.includes('orderStatusVisual(row.status)'))
})

test('转手工仅允许运行中系统的异常系统单，所有其他状态及手工单拒绝', () => {
  const source = read('../equity/EquityVariants.vue')
  const declaration = source.match(/function canConvertToManual\(row\) \{[^\n]+\}/)[0]
  const running = { value: true }
  const allowed = new Function('systemRunning', declaration + '; return canConvertToManual')(running)
  for (const status of ['未报','待报','已报','待改','待撤','部撤','撤单','部成','全成','拒单','异常']) {
    assert.equal(allowed({ status, orderType: '系统单' }), status === '异常')
    assert.equal(allowed({ status, orderType: '手工单' }), false)
  }
  running.value = false
  assert.equal(allowed({ status: '异常', orderType: '系统单' }), false)
})

test('确认书与持仓使用同一操作列，列设置不再拆为独立列', () => {
  for (const path of ['../equity/components/PositionsTable.vue', './ConfirmationRecords.vue']) {
    const source = read(path)
    assert.ok(source.includes('<TradingOperationColumn'))
    assert.doesNotMatch(source, /<el-table-column label="操作"/)
  }
  const shared = read('../../components/trading/TradingOperationColumn.vue')
  assert.match(shared, /default: 72/); assert.match(shared, /:width="width" fixed="right"/)
  assert.ok(shared.includes('operation-column-header'))
  assert.ok(shared.includes('ColumnConfigPopover'))
  assert.doesNotMatch(read('./ConfirmationRecords.vue'), /class-name="column-config-column"/)
})
