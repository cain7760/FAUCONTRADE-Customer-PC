<script setup>
import ColumnConfigPopover from './ColumnConfigPopover.vue'
defineProps({ width: { type: [Number, String], default: 72 }, options: { type: Array, required: true }, defaults: { type: Array, required: true } })
const visibleColumns = defineModel({ type: Array, required: true })
</script>

<template>
  <el-table-column label="操作" :width="width" fixed="right" align="center" header-align="center" class-name="operation-column" label-class-name="operation-column">
    <template #header><span class="operation-column-header"><span>操作</span><ColumnConfigPopover v-model="visibleColumns" :options="options" :defaults="defaults" /></span></template>
    <template #default="{ row }"><slot :row="row" /></template>
  </el-table-column>
</template>
