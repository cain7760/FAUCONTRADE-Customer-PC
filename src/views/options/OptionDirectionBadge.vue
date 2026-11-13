<script setup>
import OptionCallIcon from './OptionCallIcon.vue'

defineProps({ direction: { type: String, default: 'call' } })
</script>

<template>
  <span class="option-direction-badge" :class="direction === 'call' ? 'is-call' : 'is-put'">
    <OptionCallIcon v-if="direction === 'call'" />
    {{ direction === 'call' ? '看涨' : '看跌' }}
  </span>
</template>

<style scoped>
.option-direction-badge {
  display: inline-flex;
  align-items: center;
  justify-content: space-around;
  gap: 4px;
  box-sizing: border-box;
  width: 56px;
  height: 20px;
  padding: 0 8px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 400;
  line-height: 1;
  white-space: nowrap;
  flex-shrink: 0;
}
.option-direction-badge .option-call-icon { width: 10px; height: 10px; }
.option-direction-badge.is-call { color: var(--ft-color-buy); border: 1px solid var(--ft-color-buy); background: var(--ft-color-up-surface); }
.option-direction-badge.is-put { color: var(--ft-color-down); background: var(--ft-color-down-surface); }
</style>
