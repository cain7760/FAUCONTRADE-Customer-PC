<script setup>
import { onMounted, ref } from 'vue'

defineProps({ modelValue: String, draftValue: String, visible: Boolean, disabled: Boolean })
const emit = defineEmits(['update:draftValue', 'update:visible', 'show'])
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

const algorithms = ['POV', 'DMA', 'TWAP', 'VWAP']
</script>

<template>
  <div ref="tabs" class="execution-algorithm-tabs">
    <el-popover :visible="visible" @update:visible="emit('update:visible', $event)" trigger="click" :disabled="disabled" placement="bottom-end" :width="popoverWidth" :popper-options="popperOptions" :popper-class="['variant-popper algorithm-popper pov-parameters-popper', { 'is-dma': draftValue === 'DMA' }]" @before-enter="emit('show')">
      <template #reference>
        <button type="button" class="algorithm-trigger" :disabled="disabled" :aria-expanded="visible" :aria-label="`执行算法：${modelValue}，点击配置`"><span>{{ modelValue }}</span><svg class="execution-algorithm-chevron" :class="{ 'is-open': visible }" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg></button>
      </template>
      <div class="algorithm-selection-menu">
        <span class="algorithm-selection-heading">执行算法</span>
        <div class="algorithm-selection-tabs" role="group" aria-label="执行算法">
          <button v-for="value in algorithms" :key="value" type="button" class="execution-algorithm-tab" :class="{ 'is-active': draftValue === value }" :disabled="disabled" :aria-pressed="draftValue === value" @click="emit('update:draftValue', value)">{{ value }}</button>
        </div>
        <slot />
      </div>
    </el-popover>
  </div>
</template>

<style scoped>
.algorithm-trigger { display:inline-flex;align-items:center;justify-content:flex-end;gap:5px;height:20px;padding:0 4px;border:0;background:transparent;color:var(--el-text-color-primary);font:inherit;font-size:12px;cursor:pointer; }
.algorithm-selection-menu { display:grid;gap:16px;color:var(--el-text-color-primary); }
.algorithm-selection-heading { color:var(--el-text-color-secondary);font-size:12px; }
.algorithm-selection-tabs { display:flex;width:100%; }
.algorithm-selection-tabs .execution-algorithm-tab { flex:1;min-width:0;width:auto; }

.execution-algorithm-tabs {
  display: inline-flex;
  justify-self: end;
  min-width: 0;
}
.execution-algorithm-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  box-sizing: border-box;
  width: 54px;
  min-width: 54px;
  height: 28px;
  min-height: 28px;
  padding: 0 6px;
  border: 1px solid var(--el-border-color);
  border-radius: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.execution-algorithm-tab + .execution-algorithm-tab {
  margin-left: -1px;
}
.execution-algorithm-tab:first-child { border-radius: 2px 0 0 2px; }
.execution-algorithm-tab:nth-child(4) { border-radius: 0 2px 2px 0; }
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
  min-height: 264px;
  padding-bottom: 0;
  height: auto;
}
.el-popper.pov-parameters-popper.is-dma { min-height: 0; }
.pov-parameters-popper .execution-algorithm-menu {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  font-size: 12px;
}
.pov-parameters-popper .algorithm-menu-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  margin: 0;
  padding: 12px 0;
}
</style>
