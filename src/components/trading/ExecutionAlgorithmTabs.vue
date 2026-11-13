<script setup>
import { onMounted, ref } from 'vue'

defineProps({ modelValue: String, visible: Boolean, disabled: Boolean })
const emit = defineEmits(['update:modelValue', 'update:visible', 'show'])
const tabs = ref()
const popoverWidth = 282
let panel
const popperOptions = {
  modifiers: [
    { name: 'flip', enabled: false },
    {
      name: 'offset',
      options: {
        offset: ({ reference }) => {
          const panelBounds = panel?.getBoundingClientRect()
          const horizontalOffset = panelBounds
            ? panelBounds.x + (panelBounds.width + popoverWidth) / 2 - reference.x - reference.width
            : 0
          return [horizontalOffset, 8]
        },
      },
    },
  ],
}

onMounted(() => {
  panel = tabs.value.closest('.ticket-pane') || tabs.value.closest('.order-form')
})

function selectDma() {
  emit('update:visible', false)
  emit('update:modelValue', 'DMA')
}
</script>

<template>
  <div ref="tabs" class="execution-algorithm-tabs" role="group" aria-label="执行算法">
    <el-popover :visible="visible" @update:visible="emit('update:visible', $event)" trigger="click" :disabled="disabled" placement="bottom-end" :width="popoverWidth" :popper-options="popperOptions" popper-class="variant-popper algorithm-popper pov-parameters-popper" @before-enter="emit('show')">
      <template #reference>
        <button type="button" class="execution-algorithm-tab" :class="{ 'is-active': modelValue === 'POV' }" :disabled="disabled" :aria-pressed="modelValue === 'POV'" :aria-expanded="visible" aria-label="POV，配置参数" @click="emit('update:modelValue', 'POV')">
          POV
          <svg class="execution-algorithm-chevron" :class="{ 'is-open': visible }" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg>
        </button>
      </template>
      <slot />
    </el-popover>
    <button type="button" class="execution-algorithm-tab" :class="{ 'is-active': modelValue === 'DMA' }" :disabled="disabled" :aria-pressed="modelValue === 'DMA'" @click="selectDma">DMA</button>
  </div>
</template>

<style scoped>
.execution-algorithm-tabs {
  display: inline-flex;
  justify-self: end;
  min-width: 0;
}
.execution-algorithm-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 64px;
  height: 24px;
  padding: 0 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 2px 0 0 2px;
  background: transparent;
  color: var(--el-text-color-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.execution-algorithm-tab + .execution-algorithm-tab {
  margin-left: -1px;
  border-radius: 0 2px 2px 0;
}
.execution-algorithm-tab.is-active {
  position: relative;
  border-color: var(--el-color-primary);
  background: #353026;
  color: var(--el-color-primary);
}
.execution-algorithm-tab:hover {
  color: var(--el-color-primary);
}
.execution-algorithm-tab:disabled {
  cursor: default;
}
.execution-algorithm-chevron {
  width: 12px;
  height: 12px;
  stroke: currentColor;
  stroke-width: 1.4;
}
.execution-algorithm-chevron.is-open {
  transform: rotate(180deg);
}
</style>

<style>
.el-popper.pov-parameters-popper {
  height: 264px;
}
.pov-parameters-popper .execution-algorithm-menu {
  height: 100%;
  grid-template-rows: auto minmax(0, 1fr) auto;
}
.pov-parameters-popper .algorithm-popper-params {
  align-content: start;
  gap: 16px;
  min-height: 0;
  padding: 0;
  overflow-y: auto;
}
.pov-parameters-popper .execution-time-range .execution-time-shortcuts {
  margin-top: 16px;
}
.pov-parameters-popper .algorithm-param-row {
  margin-top: -6px;
}
.pov-parameters-popper .algorithm-param-row > span,
.pov-parameters-popper .algorithm-param-input i,
.pov-parameters-popper .algorithm-param-input .el-input__inner {
  color: #fff;
  font-size: 12px;
}
.pov-parameters-popper .algorithm-param-input small {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}
.pov-parameters-popper .algorithm-menu-actions {
  justify-content: center;
}
</style>
