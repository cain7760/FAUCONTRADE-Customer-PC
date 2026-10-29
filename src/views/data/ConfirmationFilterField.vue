<script setup>
import HistoryDateFilter from './HistoryDateFilter.vue'
defineProps({ field: { type: Object, required: true }, maxDate: String, inPopover: Boolean })
const value = defineModel()
</script>
<template>
  <component :is="inPopover ? 'label' : 'div'" class="confirmation-filter-field" :class="inPopover ? 'is-in-popover' : 'order-filter-optional'" :style="{ width: inPopover ? '100%' : `${field.width}px` }">
    <span v-if="inPopover">{{ field.label }}</span>
    <HistoryDateFilter v-if="field.type === 'date'" v-model="value" :label="field.label" :max-date="maxDate" placeholder="请选择日期" />
    <el-select v-else-if="field.options" v-model="value" :aria-label="`${field.label}筛选`" :placeholder="field.label" popper-class="variant-popper" clearable><el-option label="全部" value="" /><el-option v-for="option in field.options" :key="option" :label="option" :value="option" /></el-select>
    <el-input v-else v-model="value" :aria-label="`${field.label}筛选`" :placeholder="field.label" clearable />
  </component>
</template>
<style scoped>
.confirmation-filter-field { flex: none; min-width: 0; }
.confirmation-filter-field.is-in-popover { font-size: 12px; display: grid; align-items: center; gap: 8px; grid-template-columns: 96px minmax(0, 1fr); }
.confirmation-filter-field.is-in-popover:has(> .history-date-filter) { grid-template-columns: minmax(0, 1fr); }
.confirmation-filter-field > .el-select, .confirmation-filter-field > .el-input { width: 100%; }
.confirmation-filter-field > .history-date-filter { width: 100%; }
.confirmation-filter-field :deep(.el-input__wrapper), .confirmation-filter-field :deep(.el-select__wrapper) { box-sizing: border-box; height: 28px; min-height: 28px; }
</style>
