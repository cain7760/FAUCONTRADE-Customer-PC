import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('权益与期权共用底部系统状态及交易时间开关，展示模式仅在期权提供', () => {
  for (const path of ['../equity/pages/EquityTradingPage.vue', '../options/OptionsTradingPage.vue']) {
    const source = read(path)
    assert.ok(source.includes('components/trading/TradingStatusBar.vue'))
    assert.match(source, /<TradingStatusBar[^>]+@toggle-system="toggleSystemStatus"[^>]+@update:tradingTimeMode="setTradingTimeMode"/)
  }
  assert.ok(read('../options/OptionsTradingPage.vue').includes('aria-label="期权展示模式"'))
  assert.ok(!read('../equity/pages/EquityTradingPage.vue').includes('期权展示模式'))
})

test('权益下单确认与批量询价复用同一弹窗操作按钮组件', () => {
  for (const path of ['../equity/components/OrderTicket.vue', '../options/BatchInquiryDialog.vue']) {
    const source = read(path)
    assert.ok(source.includes('components/DialogActions.vue'))
    assert.match(source, /<template #footer><DialogActions[^>]+@cancel="[^"]+"[^>]+@confirm="submit"/)
  }
})

test('批量重询与文件上传复用同一描边操作按钮组件', () => {
  for (const path of ['../options/OptionsTradingPage.vue', '../options/BatchInquiryDialog.vue']) {
    const source = read(path)
    assert.ok(source.includes('components/OutlineActionButton.vue'))
    assert.match(source, /<OutlineActionButton[^>]+:disabled=/)
  }
})

test('当日与历史实际使用同一套筛选及表格组件，历史页不另造样式和排序', () => {
  for (const [adapter, shared] of [['OrdersTable.vue', 'OrderRecords.vue'], ['TradesTable.vue', 'TradeRecords.vue']]) {
    assert.ok(read('../equity/components/' + adapter).includes('../../../components/trading/' + shared))
    assert.ok(read('./DataPage.vue').includes('../../components/trading/' + shared))
    const component = read('../../components/trading/' + shared)
    assert.ok(component.includes('class="order-filters"'))
    assert.ok(component.includes('class="filter-query"'))
    assert.ok(component.includes('ColumnConfigPopover'))
    assert.ok(component.includes('historical'))
    if (shared === 'OrderRecords.vue') assert.ok(component.includes('v-if="!historical" label="历史"'))
    else assert.doesNotMatch(component, /label="历史"|class-name="history-column"/)
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

test('持仓与成交表不再提供历史列，订单表保留历史入口', () => {
  for (const path of ['../equity/components/PositionsTable.vue', '../../components/trading/TradeRecords.vue']) {
    assert.doesNotMatch(read(path), /label="历史"|class-name="history-column"|openOrderHistory/)
  }
  assert.match(read('../../components/trading/OrderRecords.vue'), /label="历史"/)
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


test('平仓与改单共用信息摘要及左栏行情布局，平仓保留四项持仓字段', () => {
  for (const name of ['ClosePositionDialog.vue', 'AmendOrderDialog.vue']) {
    const source = read('../equity/components/' + name)
    assert.ok(source.includes('../../../components/trading/OrderContextOverview.vue'))
    assert.ok(source.includes('hide-metrics market-overview'))
    assert.match(source, /<template #overview>[\s\S]*<OrderContextOverview/)
  }
  const close = read('../equity/components/ClosePositionDialog.vue')
  for (const label of ['持仓股数(股)', '持仓市值(CNY)', '可平股数(股)', '持仓均价(CNY)']) assert.ok(close.includes(label))
  assert.ok(read('../equity/components/PositionOrderDialog.vue').includes("'has-market-overview': marketOverview"))
})


test('期权与权益共用资产概要的展示及隐藏交互', () => {
  for (const path of ['../options/OptionAssetSummary.vue','../equity/pages/EquityTradingPage.vue']) {
    const source = read(path)
    assert.ok(source.includes('<TradingAssetSummary'))
    assert.ok(source.includes('@toggle-visibility="toggleAssetsVisible"'))
    assert.match(source, /@update:collapsed="assetsCollapsed\s*=\s*\$event"/)
  }
  const summary = read('../../components/trading/TradingAssetSummary.vue')
  assert.ok(summary.includes('assetAmountParts'))
  assert.ok(summary.includes('assetsVisible'))
  assert.ok(summary.includes('assetsCollapsed'))
  assert.ok(summary.includes('<slot name="metrics">'))
  assert.ok(summary.includes('大账户实时可用') && summary.includes('持仓市值') && summary.includes('浮动盈亏'))
  const options = read('../options/OptionAssetSummary.vue')
  assert.ok(options.includes('可用余额（实时）') && options.includes('账户余额'))
  assert.ok(read('../options/OptionOrderTicket.vue').includes('<OptionAssetSummary'))
})


test('权益与期权标的选择共用搜索历史组件，保留回选和单条删除', () => {
  for (const path of ['../equity/components/OrderTicket.vue', '../options/OptionInquiryForm.vue']) {
    const source = read(path)
    assert.ok(source.includes('InstrumentSearchHistory.vue'))
    assert.match(source, /<InstrumentSearchHistory :items="recentSymbols" @select="chooseRecentSymbol" @remove="removeRecentSymbol"/)
  }
  const history = read('../../components/trading/InstrumentSearchHistory.vue')
  assert.ok(history.includes('instrument-history-chip'))
  assert.ok(history.includes("$emit('select', item.code)"))
  assert.ok(history.includes("$emit('remove', item.code)"))
})
