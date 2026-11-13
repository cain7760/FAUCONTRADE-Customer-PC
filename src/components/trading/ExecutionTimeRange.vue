<script setup>
import { computed, ref } from 'vue'
import { executionTimeBounds, executionTimeError, executionShortcut } from '../../domain/orders/executionSchedule.js'

const props = defineProps({
  modelValue: Array,
  item: Object,
  disabled: Boolean,
  marketHours: Boolean,
  unrestricted: Boolean,
  showError: Boolean,
  hideTwoHour: Boolean,
  optional: Boolean,
})
const emit = defineEmits(['update:modelValue'])
const timeRange = ref()
const pickerWidth = ref(282)
const povPickerOptions = {
  modifiers: [
    { name: 'flip', enabled: false },
    {
      name: 'offset',
      options: {
        offset: ({ reference }) => {
          const panel = timeRange.value?.closest('.pov-parameters-popper')?.getBoundingClientRect()
          return [panel ? panel.x - reference.x : 0, 8]
        },
      },
    },
  ],
}
const now = ref(new Date())
const touched = ref(false)
const shortcutError = ref('')
const range = computed({
  get: () => props.modelValue,
  set: value => { shortcutError.value = ''; emit('update:modelValue', value) },
})
const bounds = computed(() => executionTimeBounds(props.item, now.value, props.marketHours, props.unrestricted))
const error = computed(() => shortcutError.value || (props.optional && (!range.value?.[0] || !range.value?.[1]) ? '' : executionTimeError(props.item, range.value, now.value, props.marketHours, props.unrestricted)))
function updateEndpoint(index, value) {
  const next = range.value?.slice() || ['', '']
  next[index] = value || ''
  range.value = next
  touched.value = true
}
const shortcutOptions = [
  [10, '10m'],
  [20, '20m'],
  [60, '1h'],
  [120, '2h'],
  ['morning', '到中午收盘'],
  ['close', '到下午收盘'],
]
const shortcuts = computed(() => shortcutOptions.filter(([value]) => !props.hideTwoHour || value !== 120))
function prepareTimePicker() {
  now.value = new Date()
  const panel = timeRange.value?.closest('.pov-parameters-popper')
  if (panel) pickerWidth.value = panel.getBoundingClientRect().width
  if (!range.value) range.value = executionShortcut(props.item, 10, now.value, 5, props.marketHours, props.unrestricted)
}
function timeDisabled(hour, minute, role) {
  const value = hour * 60 + minute
  const { earliest, windows } = bounds.value
  return value < earliest || !windows.some(([from, to]) => role === 'start'
    ? value >= from && value < to : value > from && value <= to)
}
const disabledMinutes = (hour, role) => Array.from({ length: 60 }, (_, minute) => minute).filter(minute => timeDisabled(hour, minute, role))
const disabledHours = role => Array.from({ length: 24 }, (_, hour) => hour).filter(hour => disabledMinutes(hour, role).length === 60)
function selectShortcut(value) {
  now.value = new Date()
  const next = executionShortcut(props.item, value, now.value, 3, props.marketHours, props.unrestricted)
  if (next) range.value = next
  shortcutError.value = next ? '' : value === 'morning'
    ? '当前无可用的上午交易时段，请选择其他时间' : '当前无可用交易时段'
  touched.value = true
}
</script>

<template>
  <section ref="timeRange" class="execution-time-range">
    <div class="field-caption"><label :class="{ required: !optional }">选择时间</label><span class="execution-time-hint">建议执行时长：大于10m</span></div>
    <div v-if="optional" class="optional-time-range">
      <el-time-picker v-for="(placeholder, index) in ['开始时间', '结束时间']" :key="index" :model-value="range?.[index]?.slice(0, 5) || null" format="HH:mm" value-format="HH:mm" :placeholder="placeholder" :aria-label="placeholder" :disabled="disabled" popper-class="variant-popper option-time-popper" placement="bottom-start" @update:model-value="updateEndpoint(index, $event)" />
      <span class="time-range-separator">-</span>
    </div>
    <el-time-picker v-else v-model="range" :disabled-hours="disabledHours" :disabled-minutes="disabledMinutes" @focus="prepareTimePicker" is-range format="HH:mm" value-format="HH:mm" range-separator="-" start-placeholder="开始时间" end-placeholder="结束时间" aria-label="执行时间范围" :popper-class="['variant-popper option-time-popper', { 'pov-time-popper': marketHours }]" :placement="marketHours ? 'bottom-start' : 'bottom'" :popper-options="marketHours ? povPickerOptions : undefined" :popper-style="marketHours ? { width: `${pickerWidth}px` } : undefined" :disabled="disabled" @change="touched = true" />
    <div class="execution-time-shortcuts" :class="{ 'is-five-shortcuts': hideTwoHour }"><button v-for="[value, label] in shortcuts" :key="value" type="button" :disabled="disabled" @click="selectShortcut(value)">{{ label }}</button></div>
    <p v-if="(touched || showError) && error" class="execution-time-error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.execution-time-range{min-width:0}
.optional-time-range{display:grid;grid-template-columns:minmax(0,1fr) 16px minmax(0,1fr);align-items:center;border:1px solid var(--el-border-color);border-radius:4px;background:var(--el-fill-color-blank)}
.optional-time-range :deep(.el-date-editor.el-input){width:100%;min-width:0}
.optional-time-range :deep(.el-input__wrapper){box-shadow:none;background:transparent;padding:0 6px}
.optional-time-range :deep(.el-input__inner){font-family:var(--ft-font-numeric);font-size:13px;font-weight:500;text-align:center}
.optional-time-range :deep(.el-input__inner::placeholder){font-family:var(--el-font-family);font-weight:400}
.optional-time-range :deep(.el-input:nth-child(2)){grid-column:3}
.time-range-separator{grid-column:2;grid-row:1;text-align:center}
.execution-time-range .field-caption{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.execution-time-hint{color:var(--el-text-color-secondary);font-size:11px;white-space:nowrap}
.execution-time-range :deep(.el-date-editor.el-input__wrapper){width:100%;height:32px;box-sizing:border-box;background:var(--el-fill-color-blank);box-shadow:0 0 0 1px var(--el-border-color) inset}
.execution-time-range :deep(.el-range-input){background:transparent;color:var(--el-text-color-regular);font-family:var(--ft-font-numeric);font-size:13px;font-weight:500}
.execution-time-range :deep(.el-range-input::placeholder){font-family:var(--el-font-family);font-weight:400}
.execution-time-shortcuts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) repeat(2,minmax(0,1.8fr));gap:4px;margin-top:8px}
.execution-time-shortcuts.is-five-shortcuts{grid-template-columns:repeat(3,minmax(0,1fr)) repeat(2,minmax(0,1.8fr))}
.execution-time-shortcuts button{min-width:0;white-space:nowrap;height:26px;padding:0 3px;border:1px solid var(--el-border-color);border-radius:3px;background:var(--el-fill-color-light);color:var(--el-text-color-regular);font-size:11px;cursor:pointer}
.execution-time-shortcuts button:hover{border-color:var(--el-color-primary);color:var(--el-color-primary)}
.execution-time-shortcuts button:disabled{cursor:not-allowed;opacity:.5}
.execution-time-error{margin:6px 0 0;color:var(--el-color-danger);font-size:11px;line-height:1.5}
</style>

<style>
.pov-time-popper .el-time-range-picker {
  width: 100%;
}
.pov-time-popper .el-time-range-picker__content {
  padding: 8px 4px;
}
.pov-time-popper .el-time-range-picker__header {
  font-size: 12px;
}
</style>
