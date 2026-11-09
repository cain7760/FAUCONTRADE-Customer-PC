<script setup>
import { version as solutionVersion } from '../../../package.json'
defineProps({ systemRunning: Boolean, tradingTimeMode: String })
defineEmits(['toggle-system', 'update:tradingTimeMode'])
</script>

<template>
  <footer class="variant-status">
    <span class="system-status">
      <i class="status-dot" :class="{ 'is-interrupted': !systemRunning }" />
      {{ systemRunning ? '运行中' : '系统中断' }} · 演示环境
      <button type="button" class="system-status-toggle" @click="$emit('toggle-system')">{{ systemRunning ? '切换为中断' : '恢复运行' }}</button>
      <span class="demo-trading-time" role="group" aria-label="演示交易时间">
        <button type="button" class="system-status-toggle" :aria-pressed="tradingTimeMode === 'trading'" @click="$emit('update:tradingTimeMode', 'trading')">交易时间</button>
        <button type="button" class="system-status-toggle" :aria-pressed="tradingTimeMode === 'non-trading'" @click="$emit('update:tradingTimeMode', 'non-trading')">非交易时间</button>
      </span>
      <slot />
    </span>
    <span>行情：静态快照</span>
    <span class="status-end">方案版本：v{{ solutionVersion }}</span>
  </footer>
</template>

<style scoped>
.demo-trading-time { display: inline-flex; align-items: center; gap: 8px; margin-left: 12px; }
.variants-app .demo-trading-time .system-status-toggle { margin-left: 0; padding: 0 4px; background: transparent; color: #8e949e; }
.variants-app .demo-trading-time button[aria-pressed="true"] { color: #bb984a; }
</style>
