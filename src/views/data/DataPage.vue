<script setup>
import { computed, nextTick, onActivated, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import OrderRecords from '../../components/trading/OrderRecords.vue'
import TradeRecords from '../../components/trading/TradeRecords.vue'
import TradingAccountFilter from '../../components/trading/TradingAccountFilter.vue'
import SortHeader from '../../components/trading/SortHeader.vue'
import HistoryDateFilter from './HistoryDateFilter.vue'
import ConfirmationRecords from './ConfirmationRecords.vue'
import { historyCell, historyTabs as recordTabs } from './historyModel.js'
import { useHistoryRecords } from './useHistoryRecords.js'

const props = defineProps({ accounts: { type: Array, required: true }, context: { type: Object, required: true } })
const { kind: historyKind, state, draft, rows, pageRows, maxDate, query, reset, sortBy, exportRecords, accountIds } = useHistoryRecords({ readSource: () => props.context.readHistorySource(), accounts: props.accounts })
const historyTabs = [...recordTabs, { key: 'confirmations', label: '交易确认书' }]
const kind = ref('orders')
watch(kind, value => { if (value !== 'confirmations') historyKind.value = value })
const tabButtons = ref([]), tableRefreshKey = ref(0)
const historyPane = ref(null)
onActivated(() => {
  // 缓存页面恢复时重新绑定测量节点，避免沿用日内订单窄栏的可见数量。
  props.context.orderFilterBar.value = historyPane.value?.querySelector('.order-filters')
})
const orderVisibleColumnKeys = ref([...props.context.orderColumnDefaults])
const tradeVisibleColumnKeys = ref([...props.context.tradeColumnDefaults])
function apply() { if (query()) tableRefreshKey.value++ }
function clear() { reset(); tableRefreshKey.value++ }
function toggleSort(prop) {
  const current = state.value.sort
  sortBy(prop, current.key !== prop || !current.direction ? 'ascending' : current.direction === 'ascending' ? 'descending' : null)
}
function toggleStatus(status) { draft.value.status = draft.value.status.includes(status) ? draft.value.status.filter(value => value !== status) : [...draft.value.status, status] }
function exportResults() {
  if (!rows.value.length) { ElMessage.info('没有可导出的历史记录'); return }
  try { ElMessage.success(`已导出 ${exportRecords()} 条历史记录`) } catch { ElMessage.error('导出未完成，请重试') }
}
function moveTab(step) {
  const index = (historyTabs.findIndex(tab => tab.key === kind.value) + step + historyTabs.length) % historyTabs.length
  kind.value = historyTabs[index].key
  nextTick(() => tabButtons.value[index]?.focus())
}
const sortState = computed(() => ({ prop: state.value.sort.key || null, direction: state.value.sort.direction || null }))
// 与权益交易使用相同组件和布局计算；历史模块只替换数据与只读行为。
const recordContext = {
  ...props.context,
  orderFilters: draft, tradeFilters: draft, sortedOrders: pageRows, sortedTrades: pageRows,
  orderVisibleColumnKeys, tradeVisibleColumnKeys, orderSortState: sortState, tradeSortState: sortState,
  tableRefreshKey, applyOrderFilters: apply, applyTradeFilters: apply, clearOrderFilters: clear, clearTradeFilters: clear,
  toggleOrderSort: toggleSort, toggleTradeSort: toggleSort, toggleOrderStatus: toggleStatus,
  selectAllOrderStatuses: () => { draft.value.status = props.context.orderStatusOptions.map(option => option.value) },
  invertOrderStatuses: () => { draft.value.status = props.context.orderStatusOptions.map(option => option.value).filter(status => !draft.value.status.includes(status)) },
  refreshTable: apply, confirmExport: exportResults, chaseActionsVisible: false,
  canceledOrderValue: row => historyCell(row, 'canceledValue'),
  orderValueLabel: row => historyCell(row, 'orderValue'),
  orderValueWithUnit: row => historyCell(row, 'orderValue'),
}
</script>

<template>
  <section ref="historyPane" class="positions-pane workspace-panel data-history-pane" aria-label="历史交易记录">
    <header class="positions-tabs" role="tablist" aria-label="历史记录类型">
        <button v-for="tab in historyTabs" :id="`history-tab-${tab.key}`" :key="tab.key" ref="tabButtons" type="button" role="tab" :aria-selected="kind === tab.key" :aria-controls="`history-panel-${kind}`" :tabindex="kind === tab.key ? 0 : -1" :class="{ active: kind === tab.key }" @click="kind = tab.key" @keydown.right.prevent="moveTab(1)" @keydown.left.prevent="moveTab(-1)">{{ tab.label }}</button>
    </header>
    <section :id="`history-panel-${kind}`" class="data-history-records" role="tabpanel" :aria-labelledby="`history-tab-${kind}`">
      <ConfirmationRecords v-if="kind === 'confirmations'" :context="context" />
      <OrderRecords v-else-if="kind === 'orders'" :context="recordContext" :additional-filter-count="2" historical :index-offset="(state.page - 1) * state.pageSize">
        <template #after-order-number="{ visible, inPopover, visibleCount }"><HistoryDateFilter v-if="visible" v-model="draft.range" label="委托日期" :max-date="maxDate" :in-popover="inPopover" /><HistoryDateFilter v-else-if="!inPopover" v-show="false" v-model="draft.range" label="委托日期" :max-date="maxDate" /><TradingAccountFilter v-if="inPopover ? visibleCount <= 2 : visibleCount > 2" v-model="accountIds" :accounts="accounts" :label-for="context.accountLabel" :in-popover="inPopover" /><TradingAccountFilter v-else-if="!inPopover" v-show="false" v-model="accountIds" :accounts="accounts" :label-for="context.accountLabel" /></template>
        <template #leading-columns><el-table-column prop="orderDate" width="100"><template #header><SortHeader label="委托日期" :direction="sortState.prop === 'orderDate' ? sortState.direction : null" @sort="toggleSort('orderDate')" /></template></el-table-column></template>
      </OrderRecords>
      <TradeRecords v-else :context="recordContext" :additional-filter-count="2" historical :index-offset="(state.page - 1) * state.pageSize">
        <template #after-symbol="{ visible, inPopover, visibleCount }"><HistoryDateFilter v-if="visible" v-model="draft.range" label="成交日期" :max-date="maxDate" :in-popover="inPopover" /><HistoryDateFilter v-else-if="!inPopover" v-show="false" v-model="draft.range" label="成交日期" :max-date="maxDate" /><TradingAccountFilter v-if="inPopover ? visibleCount <= 1 : visibleCount > 1" v-model="accountIds" :accounts="accounts" :label-for="context.accountLabel" :in-popover="inPopover" /><TradingAccountFilter v-else-if="!inPopover" v-show="false" v-model="accountIds" :accounts="accounts" :label-for="context.accountLabel" /></template>
        <template #leading-columns><el-table-column v-if="!tradeVisibleColumnKeys.includes('tradeDate')" prop="tradeDate" label="交易日期" width="100" /></template>
      </TradeRecords>
    </section>
    <p v-if="kind !== 'confirmations' && state.error" class="data-history-error" role="alert">{{ state.error }}</p>
    <footer v-if="kind !== 'confirmations'" class="positions-footer data-history-footer" role="status"><span>{{ state.applied.range[0] }} 至 {{ state.applied.range[1] }} · 共 {{ rows.length }} 条 · 导出全部查询结果</span><el-pagination v-model:current-page="state.page" v-model:page-size="state.pageSize" :page-sizes="[20, 50, 100]" :total="rows.length" layout="sizes, prev, pager, next" small /></footer>
  </section>
</template>

<style scoped>
/* 历史页只定义页面布局；筛选、表格、状态、进度、排序和列设置均继承权益交易组件。 */
/* 对齐权益工作区的 4px 外边距，底部保留与 22px 状态栏相同的空间。 */
.data-history-pane { flex: 1; min-width: 0; min-height: 0; margin: 4px 4px 22px; }
.data-history-error { color: #ed858b; font-size: 12px; }
.data-history-records { display: flex; flex: 1; flex-direction: column; min-height: 0; min-width: 0; }
.data-history-footer { display: flex; flex: none; height: auto; min-height: 38px; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.data-history-pane button:focus-visible { outline: 2px solid #bb984a; outline-offset: -2px; }
</style>
