<script setup>
import { ref } from 'vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

defineProps({ label: { type: String, default: '数据' } })
const emit = defineEmits(['export'])
const visible = ref(false)
const dateRange = ref([])
const numericMonths = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`month${index + 1}`, String(index + 1).padStart(2, '0')]))
const numericDateLocale = {
  ...zhCn,
  el: {
    ...zhCn.el,
    datepicker: { ...zhCn.el.datepicker, year: '', ...numericMonths },
  },
}

function reset() { dateRange.value = [] }
function confirm() {
  emit('export', dateRange.value || [])
  visible.value = false
}
</script>

<template>
  <el-popover v-model:visible="visible" trigger="click" placement="bottom-end" :width="360" :offset="6" popper-class="variant-popper export-data-popover" @show="reset">
    <template #reference><slot /></template>
    <section class="export-time-form">
      <p>导出{{ label }}数据，可选择时间范围。</p>
      <label>时间范围</label>
      <el-config-provider :locale="numericDateLocale">
        <el-date-picker v-model="dateRange" type="daterange" value-format="YYYY-MM-DD" format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" clearable :teleported="false" popper-class="export-date-popper" />
      </el-config-provider>
      <small>不选择则导出全部时间。</small>
      <footer><el-button size="small" @click="visible=false">取消</el-button><el-button size="small" type="primary" @click="confirm">导出</el-button></footer>
    </section>
  </el-popover>
</template>
