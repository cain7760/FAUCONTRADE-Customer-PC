<script setup>
import { ref } from 'vue'
import { historyToday, shiftHistoryDate } from './historyModel.js'
defineProps({ label: String, maxDate: String, inPopover: Boolean, placeholder: String })
const range = defineModel({ type: Array, required: true, set: value => value || [] })
const filter = ref(null), singlePanel = ref(false), panelWidth = ref(580)
function fitCalendar(visible) {
  if (!visible || !filter.value) return
  const available = window.innerWidth - filter.value.getBoundingClientRect().left - 12
  singlePanel.value = available < 580
  panelWidth.value = Math.min(singlePanel.value ? 360 : 580, available)
}
const pickerDay = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const shortcuts = [7, 30, 90].map(days => ({ text: `近 ${days} 天`, value: () => [new Date(`${shiftHistoryDate(historyToday(), 1 - days)}T00:00:00`), new Date(`${historyToday()}T00:00:00`)] }))
</script>
<template>
  <div ref="filter" class="history-date-filter" role="group" :aria-label="`${label}范围`" :class="inPopover ? 'is-in-popover' : 'order-filter-optional'">
    <el-date-picker v-model="range" size="small" type="daterange" value-format="YYYY-MM-DD" format="YYYY-MM-DD" :start-placeholder="placeholder || '开始日期'" :end-placeholder="placeholder ? '' : '结束日期'" :range-separator="placeholder && !range.some(Boolean) ? '' : '-'" :disabled-date="date => pickerDay(date) > maxDate" :shortcuts="shortcuts" :editable="false" clearable placement="bottom-start" :fallback-placements="['top-start']" :single-panel="singlePanel" :popper-style="{ '--history-date-width': panelWidth + 'px' }" popper-class="variant-popper history-date-popper" @visible-change="fitCalendar" :aria-label="`${label}范围`" />
  </div>
</template>
<style scoped>
.history-date-filter { display: flex; flex: none; align-items: center; width: 210px; font-size: 12px; white-space: nowrap; }
.history-date-filter :deep(.el-date-editor) { flex: 1; min-width: 0; width: auto; }
.history-date-filter :deep(.el-range__icon) { order: 1; flex: none; margin: 0 0 0 4px; }
.history-date-filter :deep(.el-range-input) { flex: 1; min-width: 0; width: 0; }
.history-date-filter :deep(.el-range-separator) { flex: none; width: 12px; padding: 0; }
.history-date-filter :deep(.el-range__close-icon) { order: 1; flex: none; margin: 0 0 0 4px; cursor: pointer; }
.history-date-filter :deep(.el-range__close-icon--hidden) { display: none; }
.history-date-filter :deep(.el-date-editor:has(.el-range__close-icon:not(.el-range__close-icon--hidden)) .el-range__icon) { display: none; }
.history-date-filter.is-in-popover { flex-direction: column; align-items: stretch; width: 210px; max-width: 100%; }
:global(.history-date-popper.el-picker__popper .el-date-range-picker.has-sidebar) { width: var(--history-date-width, 580px); max-width: calc(100vw - 24px); }
:global(.history-date-popper.el-picker__popper .el-date-range-picker .el-picker-panel__body) { min-width: 0; }
:global(.history-date-popper .el-picker-panel__sidebar) { width: 88px; }
:global(.history-date-popper .el-picker-panel__sidebar + .el-picker-panel__body) { margin-left: 88px; }
:global(.history-date-popper .el-date-range-picker__content) { padding: 12px; }
:global(.history-date-popper .single-panel .el-picker-panel__content) { width: calc(100% - 24px); margin: 12px; padding: 0; }
</style>
