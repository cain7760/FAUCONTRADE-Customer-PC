<script setup>
import { ref } from 'vue'

defineOptions({ inheritAttrs: false })
const table = ref(null)
defineExpose({
  clearFilter: (...args) => table.value?.clearFilter?.(...args),
  doLayout: () => table.value?.doLayout?.(),
  setScrollTop: value => table.value?.setScrollTop?.(value),
})
</script>

<template>
  <el-table ref="table" class="trading-table" v-bind="$attrs"><slot /></el-table>
</template>

<style>
.trading-table.el-table{--el-table-bg-color:#1e2023;--el-table-tr-bg-color:#1e2023;--el-table-header-bg-color:#25282d;--el-table-row-hover-bg-color:#2c3036;--el-table-border-color:#2d3035;--el-table-text-color:#c9ced6;--el-table-header-text-color:#969eaa;font-size:12px}.trading-table.el-table th{height:35px;padding:4px 0;font-weight:400}.trading-table.el-table td{height:38px;padding:4px 0}.trading-table.el-table .cell{padding:0 8px;line-height:20px;white-space:nowrap}.trading-table.el-table .el-table__empty-text{color:#7f8793;font-size:12px}.trading-table.el-table .el-checkbox__inner{border-color:#66717d;background:#202328}.trading-table.el-table .el-checkbox__input.is-checked .el-checkbox__inner,.trading-table.el-table .el-checkbox__input.is-indeterminate .el-checkbox__inner{border-color:#bb984a;background:#bb984a}
</style>
