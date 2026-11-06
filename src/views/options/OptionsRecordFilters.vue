<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowDownBold, Search, Refresh, Upload } from '@element-plus/icons-vue'
import TradingDateRange from '../../components/trading/TradingDateRange.vue'
const props = defineProps({ filters: { type: Object, required: true }, records: {type:Array,default:()=>[]}, orders: Boolean })
const emit = defineEmits(['query', 'reset', 'refresh', 'export'])
const bar = ref(null), width = ref(0)
let observer
onMounted(() => { observer = new ResizeObserver(entries => { width.value = entries[0].contentRect.width }); observer.observe(bar.value) })
onBeforeUnmount(() => observer?.disconnect())
const recordInstruments = computed(() => [...new Map(props.records.map(item => [item.code, { code:item.code, name:item.name }])).values()])
const today = new Date().toLocaleDateString('sv-SE')
const fields = computed(() => props.orders ? [
  { key: 'direction', label: '期权方向', options: [['call','看涨']] },
  { key: 'status', label: '订单状态', options: [['待报','待报'],['已报','已报'],['部成','部成'],['全成','全成'],['撤单','撤单']] },
] : [
  { key: 'structure', label: '结构', options: [...new Set(props.records.map(item => `${item.strike}${item.direction === 'call' ? 'C' : 'P'}`))].map(value => [value,value]) },
  { key: 'tenor', label: '期限', options: [...new Set(props.records.map(item => item.tenor))].map(x => [x,x]) },
  { key: 'knockout', label: '敲出规则', options: ['主3创2','连板敲出','协商敲出','3连板'].map(x => [x,x]) },
  { key: 'exercise', label: '最快行权日', options: ['T+1','T+5'].map(x => [x,x]) },
  { key: 'dividend', label: '分红规则', options: ['分红调整','分红不调整','分红调整初价'].map(x => [x,x]) },
])
const allValue = '__ALL_OPTION_VALUES__', noValue = '__NO_OPTION_VALUES__'
function filterSelection(field) {
  const value = props.filters[field.key]
  return props.orders ? value : value.includes(noValue) ? [] : value.length ? value : [allValue, ...field.options.map(option => option[0])]
}
function assignFilterOptions(field, values) {
  props.filters[field.key] = values.length === field.options.length ? [] : values.length ? values : [noValue]
}
function setFilterSelection(field, values) {
  if (props.orders) { props.filters[field.key] = values; return }
  if (!values.length) { props.filters[field.key] = []; return }
  const hadAll = !props.filters[field.key].length
  if (!hadAll && values.includes(allValue)) { props.filters[field.key] = []; return }
  if (hadAll) {
    assignFilterOptions(field, values.includes(allValue) ? values.filter(value => value !== allValue) : [])
  } else assignFilterOptions(field, values.filter(value => value !== allValue))
}
function toggleFilterOption(field, value) {
  if (value === allValue) { props.filters[field.key] = props.filters[field.key].length ? [] : [noValue]; return }
  const current = props.filters[field.key]
  const selected = current.length ? current.filter(item => item !== noValue) : field.options.map(option => option[0])
  assignFilterOptions(field, selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value])
}
// 容器宽度决定可见筛选项；搜索和操作按钮始终保留，其余移至“更多”。
const dateVisible = computed(() => width.value >= 648)
const visibleCount = computed(() => Math.max(0, Math.min(fields.value.length, Math.floor((width.value - 648) / 148))))
</script>
<template>
  <div ref="bar" class="order-filters options-record-filters">
    <TradingDateRange v-show="dateVisible" v-model="filters.dates" :label="orders ? '委托日期' : '询价日期'" :max-date="today" />
    <el-select size="small" v-model="filters.symbol" class="order-filter-optional option-symbol-filter" placeholder="标的" aria-label="标的" filterable clearable popper-class="variant-popper"><el-option label="全部标的" value=""/><el-option v-for="item in recordInstruments" :key="item.code" :value="item.code" :label="`${item.name}（${item.code}）`"/></el-select>
    <el-select size="small" v-for="field in fields.slice(0, visibleCount)" :key="field.key" :model-value="filterSelection(field)" @update:model-value="setFilterSelection(field, $event)" :multiple="!orders" :class="{ 'is-all': !orders && !filters[field.key].length }" collapse-tags collapse-tags-tooltip clearable class="order-filter-optional" :aria-label="field.label" :placeholder="field.label" popper-class="variant-popper order-status-popper option-filter-popper"><template v-if="!orders && !filters[field.key].length" #tag><span class="option-filter-all">全部{{ field.label }}</span></template><el-option v-if="!orders" :label="`全部${field.label}`" :value="allValue"><el-checkbox :model-value="!filters[field.key].length" @click.stop @change="toggleFilterOption(field, allValue)">全部{{ field.label }}</el-checkbox></el-option><el-option v-if="orders" :label="field.label" value=""/><el-option v-for="option in field.options" :key="option[0]" :label="option[1]" :value="option[0]"><el-checkbox v-if="!orders" :model-value="!filters[field.key].length || filters[field.key].includes(option[0])" @click.stop @change="toggleFilterOption(field, option[0])">{{ option[1] }}</el-checkbox></el-option></el-select>
    <el-popover v-if="!dateVisible || visibleCount < fields.length" trigger="click" placement="bottom-start" :width="310" popper-class="variant-popper order-filter-more-popper"><template #reference><el-button class="order-filter-more">更多<el-icon><ArrowDownBold/></el-icon></el-button></template><div class="order-filter-more-panel options-filter-more"><label v-if="!dateVisible">{{ orders ? '委托日期' : '询价日期' }}<TradingDateRange v-model="filters.dates" label="日期" :max-date="today" in-popover /></label><label v-for="field in fields.slice(visibleCount)" :key="field.key">{{ field.label }}<el-select :teleported="false" size="small" :model-value="filterSelection(field)" @update:model-value="setFilterSelection(field, $event)" :multiple="!orders" :class="{ 'is-all': !orders && !filters[field.key].length }" collapse-tags collapse-tags-tooltip clearable :placeholder="field.label" :aria-label="field.label" popper-class="variant-popper order-status-popper option-filter-popper"><template v-if="!orders && !filters[field.key].length" #tag><span class="option-filter-all">全部{{ field.label }}</span></template><el-option v-if="!orders" :label="`全部${field.label}`" :value="allValue"><el-checkbox :model-value="!filters[field.key].length" @click.stop @change="toggleFilterOption(field, allValue)">全部{{ field.label }}</el-checkbox></el-option><el-option v-if="orders" label="全部" value=""/><el-option v-for="option in field.options" :key="option[0]" :label="option[1]" :value="option[0]"><el-checkbox v-if="!orders" :model-value="!filters[field.key].length || filters[field.key].includes(option[0])" @click.stop @change="toggleFilterOption(field, option[0])">{{ option[1] }}</el-checkbox></el-option></el-select></label></div></el-popover>
    <el-button class="filter-query" @click="emit('query')">查询</el-button><el-button link @click="emit('reset')">重置</el-button>
    <div class="table-toolbar-actions"><button class="refresh-table" aria-label="刷新期权记录" title="刷新" @click="emit('refresh')"><el-icon><Refresh/></el-icon></button><button class="export-orders" aria-label="导出期权记录" title="导出当前查询结果" @click="emit('export')"><el-icon><Upload/></el-icon></button></div>
  </div>
</template>
<style scoped>
.options-record-filters :deep(.el-select .el-select__wrapper),.options-filter-more :deep(.el-select .el-select__wrapper){padding-left:6px}
.options-record-filters :deep(.el-select .el-select__selection),.options-filter-more :deep(.el-select .el-select__selection){margin-left:0}
.option-filter-all{color:var(--el-text-color-regular);font-size:12px;line-height:20px}
.options-record-filters{min-width:0}.options-record-filters :deep(.el-button){flex:none}.options-record-filters :deep(.order-filter-optional.el-select){width:140px;min-width:140px}.options-filter-more>label{grid-template-columns:72px minmax(0,1fr);font-size:12px}
</style>

<style>
.option-filter-popper .el-select-dropdown__item,.option-filter-popper.order-status-popper .el-select-dropdown__item .el-checkbox__label{font-size:12px}
</style>
