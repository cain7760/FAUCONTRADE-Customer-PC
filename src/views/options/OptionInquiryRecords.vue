<script setup>
import { computed, ref, watch } from 'vue'
import { ArrowDown, ArrowRight } from '@element-plus/icons-vue'
import TradingTable from '../../components/trading/TradingTable.vue'
import TradingOperationColumn from '../../components/trading/TradingOperationColumn.vue'
import SortHeader from '../../components/trading/SortHeader.vue'
import { quoteIsBest } from './inquiryModel.js'
const props = defineProps({ items: { type: Array, required: true }, onlyBest: Boolean, latestFirst: Boolean, paused: Boolean })
const emit = defineEmits(['order', 'reinquire'])
const table = ref(null)
function onScroll({scrollTop}) { const wrap = table.value?.$el?.querySelector('.el-scrollbar__wrap'); if (wrap && scrollTop + wrap.clientHeight >= wrap.scrollHeight - 100) loadMore() }
const selected = ref([]), collapsed = ref([]), sort = ref({ key: '', direction: null })
const columnOptions = [['structure','结构 / 期限'],['rate','报价(%)'],['knockout','敲出规则'],['exercise','最快行权日'],['dividend','分红规则'],['capacity','参考名义本金(万)'],['currency','结算币种']]
const defaults = columnOptions.map(([key]) => key), visible = ref([...defaults])
const groups = computed(() => {
  const result = new Map()
  for (const item of props.items) {
    const group = result.get(item.code) || { code: item.code, name: item.name, market: item.market, items: [], updated: 0 }
    group.items.push(item)
    group.updated = Math.max(group.updated, new Date(item.createdAt).getTime(), ...item.quotes.map(q => new Date(q.quotedAt).getTime()))
    result.set(item.code, group)
  }
  return [...result.values()].sort((a,b) => props.latestFirst ? b.updated - a.updated : a.code.localeCompare(b.code))
})
watch(groups, value => { selected.value = selected.value.filter(code => value.some(group => group.code === code)) })
const allSelected = computed(() => groups.value.length > 0 && selected.value.length === groups.value.length)
const loadedRows = ref(50)
function loadMore() { loadedRows.value += 50 }
watch(() => props.items, () => { loadedRows.value = 50 })
watch(visible, keys => { if (!keys.length) visible.value = ['structure'] })
const columns = computed(() => {
  const ordered = visible.value.map(key => columnOptions.find(([id]) => id === key)).filter(Boolean)
  return [...ordered.filter(([key]) => key === 'structure'), ...ordered.filter(([key]) => key !== 'structure')]
})
const rows = computed(() => groups.value.flatMap(group => {
  const header = { id: `group-${group.code}`, group, kind: 'group' }
  if (collapsed.value.includes(group.code)) return [header]
  const children = group.items.flatMap(item => {
    let quotes = item.status === 'quoted' ? item.quotes.filter(quote => !props.onlyBest || quoteIsBest(item, quote)) : []
    if (sort.value.direction) quotes = [...quotes].sort((a,b) => (Number(a[sort.value.key]) - Number(b[sort.value.key])) * (sort.value.direction === 'ascending' ? 1 : -1))
    if (item.status !== 'quoted') return [{ id: item.id, item, kind: 'state' }]
    return quotes.map(quote => ({ id: quote.id, item, quote, kind: 'quote' }))
  })
  return [header, ...children]
}).slice(0, loadedRows.value))
const format = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })
const inquirySizes = group => [...new Set(group.items.map(item => item.size))].map(size => `${format(size)}万`).join(' / ')
const time = value => new Date(value).toLocaleTimeString('zh-CN', { hour12: false })
function toggleGroup(code) { collapsed.value = collapsed.value.includes(code) ? collapsed.value.filter(x => x !== code) : [...collapsed.value, code] }
function selectGroup(code, checked) { selected.value = checked ? [...new Set([...selected.value, code])] : selected.value.filter(x => x !== code) }
function toggleSort(key) { sort.value = { key, direction: sort.value.key !== key || !sort.value.direction ? 'ascending' : sort.value.direction === 'ascending' ? 'descending' : null } }
function spans({ row, rowIndex, columnIndex }) {
  if (row.kind === 'group') return [1, 1]
  if (row.kind === 'quote' && (columnIndex === 0 || columns.value[columnIndex - 1]?.[0] === 'structure')) {
    if (rows.value[rowIndex - 1]?.item?.id === row.item.id) return [0, 0]
    let count = 1
    while (rows.value[rowIndex + count]?.item?.id === row.item.id) count++
    return [count, 1]
  }
  return [1,1]
}
function batchReinquire() { emit('reinquire', props.items.filter(item => selected.value.includes(item.code)).map(item => item.id)) }
defineExpose({ batchReinquire, selected })
</script>
<template>
  <TradingTable ref="table" class="option-inquiry-table" table-layout="fixed" :data="rows" row-key="id" :span-method="spans" :row-class-name="({ row }) => row.kind === 'group' ? 'option-instrument-row' : ''" height="100%" @scroll="onScroll" empty-text="暂无询价记录，请在右侧提交询价">
    <el-table-column width="30" fixed="left" align="left" class-name="inquiry-selection"><template #header><el-checkbox :model-value="allSelected" :indeterminate="selected.length > 0 && !allSelected" aria-label="选择全部询价标的" @change="selected = $event ? groups.map(group => group.code) : []"/></template><template #default="{row}"><el-checkbox v-if="row.kind === 'group'" :model-value="selected.includes(row.group.code)" :aria-label="`选择${row.group.name}`" @change="selectGroup(row.group.code, $event)"/></template></el-table-column>
    <el-table-column v-for="([key,label],index) in columns" :key="key" :prop="key" :label="label" :fixed="key === 'structure' ? 'left' : false" :class-name="({structure:'inquiry-structure-column',rate:'inquiry-rate-column',knockout:'inquiry-knockout-column',capacity:'inquiry-capacity-column',currency:'inquiry-currency-column'})[key] || ''" :min-width="132" :align="['rate','capacity'].includes(key) ? 'right' : 'left'" show-overflow-tooltip>
      <template #header><SortHeader v-if="['rate','capacity'].includes(key)" :label="label" numeric :direction="sort.key === key ? sort.direction : null" @sort="toggleSort(key)"/><span v-else>{{ label }}</span></template>
      <template #default="{row}">
        <div v-if="row.kind === 'group' && index === 0" class="option-instrument-heading"><button type="button" :aria-label="`${collapsed.includes(row.group.code) ? '展开' : '收起'}${row.group.name}`" @click="toggleGroup(row.group.code)"><el-icon><ArrowRight v-if="collapsed.includes(row.group.code)"/><ArrowDown v-else/></el-icon></button><strong>{{ row.group.name }}（{{ row.group.code }}）</strong><small>询价规模：<b class="inquiry-size-value">{{ inquirySizes(row.group) }}</b></small></div>
        <template v-else-if="row.item">
          <span v-if="key === 'structure'" class="option-structure" :title="`询价规模 ${format(row.item.size)} 万`">{{ row.item.strike }}{{ row.item.direction === 'call' ? 'C' : 'P' }} {{ row.item.tenor }}</span>
          <span v-else-if="key === 'rate' && row.kind === 'state'" class="muted">{{ row.item.status === 'pending' ? '询价中…' : '暂无报价' }}</span>
          <span v-else-if="key === 'rate'" class="option-quote-rate" :class="{ best: quoteIsBest(row.item,row.quote) }">{{ row.quote.rate.toFixed(2) }}<span v-if="quoteIsBest(row.item,row.quote)" class="option-best" aria-label="最优报价" title="当前组合最低报价">优</span></span>
          <template v-else-if="key === 'currency'">{{ row.item.currency }}</template>
          <template v-else-if="row.kind === 'state'">--</template>
          <template v-else-if="key === 'capacity'">{{ format(row.quote.capacity) }}</template>
          <template v-else-if="key === 'quotedAt'">{{ time(row.quote.quotedAt) }}</template>
          <template v-else>{{ row.quote[key] }}</template>
        </template>
      </template>
    </el-table-column>
    <TradingOperationColumn v-model="visible" :options="columnOptions" :defaults="defaults" :width="76"><template #default="{row}"><button v-if="row.kind === 'group'" class="option-reinquire" :disabled="paused || row.group.items.every(item => item.status === 'pending')" @click="emit('reinquire', row.group.items.map(item => item.id))">重询</button><el-button v-else-if="row.kind === 'quote'" size="small" class="option-quote-order" :disabled="paused" @click="emit('order', { item: row.item, quote: row.quote })">下单</el-button><span v-else class="muted">--</span></template></TradingOperationColumn>
  </TradingTable>
</template>
<style scoped>
.option-inquiry-table :deep(.option-reinquire){width:40px;padding:0}
/* 两个相邻列默认各 12px 内边距，放大四倍后各为 48px。 */
:global(.variants-app .options-workspace .option-inquiry-table.el-table .inquiry-capacity-column>.cell){padding-right:48px!important}
:global(.variants-app .options-workspace .option-inquiry-table.el-table .inquiry-currency-column>.cell){padding-left:48px!important}
:global(.variants-app .options-workspace .options-records .option-inquiry-table.el-table .el-table__body tr.hover-row:not(.option-instrument-row)>td.el-table__cell:not(.inquiry-structure-column):not(.inquiry-selection)){background:#2c3036!important}

.option-inquiry-table :deep(td.inquiry-structure-column),.option-inquiry-table :deep(td.inquiry-selection){z-index:8}
.option-inquiry-table :deep(th.inquiry-structure-column),.option-inquiry-table :deep(th.inquiry-selection){z-index:9}
.option-inquiry-table :deep(.option-instrument-row td.inquiry-structure-column>.cell){overflow:visible}
.option-inquiry-table :deep(.option-instrument-row td.inquiry-structure-column){z-index:10}
.option-inquiry-table .option-instrument-heading{width:max-content;max-width:calc(100cqw - 112px)}
.option-inquiry-table{container-type:inline-size}
.option-inquiry-table .option-instrument-heading>strong,.option-inquiry-table .option-instrument-heading>span{flex:none}
.option-inquiry-table .option-instrument-heading>small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

:global(.variants-app .options-workspace .option-inquiry-table.el-table .inquiry-rate-column>.cell){padding-right:32px!important}
:global(.variants-app .options-workspace .option-inquiry-table.el-table .inquiry-knockout-column>.cell){padding-left:32px!important}

.option-inquiry-table :deep(.inquiry-rate-column>.cell){padding-right:16px}
.option-inquiry-table :deep(.inquiry-knockout-column>.cell){padding-left:16px}
.option-instrument-heading .inquiry-size-value{color:var(--el-text-color-primary);font-weight:500}

/* 合并结构区域只在组末分隔，报价明细从竖向边界开始逐行分隔。 */
:global(.variants-app .options-workspace .option-inquiry-table .el-table__body tr:not(.option-instrument-row)>td.inquiry-structure-column){border-right:1px solid var(--el-table-border-color)!important}

/* 固定列布局按相同最小宽度均分数据列；跨列分组标题不参与列宽计算。 */
.option-inquiry-table :deep(.el-scrollbar__view){min-width:0!important}
.option-inquiry-table :deep(td.is-right>.cell){min-width:0;overflow:hidden}

:global(.variants-app .options-workspace .options-records .option-inquiry-table.el-table .el-table__body tr>td.el-table__cell){background:#1e2023!important}
:global(.variants-app .options-workspace .options-records .option-inquiry-table.el-table .el-table__body tr.option-instrument-row>td.el-table__cell){background:#272a2e!important}

.option-inquiry-table :deep(tbody tr>td.el-table__cell),.option-inquiry-table :deep(tbody tr.hover-row>td.el-table__cell){background:#1e2023!important}
.option-inquiry-table :deep(tbody tr.option-instrument-row>td.el-table__cell){background:#272a2e!important}
.option-inquiry-table :deep(.inquiry-selection .cell){padding:0 12px!important;display:flex;justify-content:flex-start;align-items:center}
.option-inquiry-table :deep(.el-checkbox__label){display:none}
.option-inquiry-table .option-quote-rate{font-size:12px;font-weight:600}
.option-inquiry-table .option-best{display:inline-grid;place-items:center;width:16px;height:16px;padding:0;border:0;border-radius:3px;background:#b15b6a;color:#fff;font-size:11px;font-weight:400}

.option-inquiry-table{flex:1;min-height:0}.option-inquiry-table :deep(.option-instrument-row td.el-table__cell){background:#272a2e}.option-instrument-heading{display:flex;align-items:center;gap:8px;text-align:left;line-height:20px}.option-instrument-heading button{padding:0;background:none;border:0;color:var(--el-text-color-secondary);width:16px;display:flex}.option-instrument-heading strong{color:var(--el-text-color-primary);font-size:12px;font-weight:600}.option-instrument-heading>span,.option-instrument-heading small{color:var(--el-text-color-secondary);font-size:11px}.option-instrument-heading small{margin-left:8px;font-size:12px}.option-structure{display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:600}.option-structure small{font-size:10px;color:var(--el-text-color-secondary);font-weight:400}.option-quote-rate{display:inline-flex;align-items:center;gap:5px}.option-quote-rate.best{color:var(--el-color-primary)}.option-best{font-size:10px;line-height:14px;border:1px solid #78612f;border-radius:2px;padding:0 2px}.option-quote-order.el-button{height:24px;padding:0 10px;border-color:var(--el-color-primary);background:var(--el-color-primary);color:#fff;font-size:12px;width:40px;padding:0}.option-inquiry-table :deep(.el-checkbox){height:20px}.history-view:disabled{opacity:.45;cursor:not-allowed}
</style>
