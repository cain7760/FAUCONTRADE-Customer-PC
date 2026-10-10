<script setup>
import { ref, watch } from 'vue'
import OrderTicket from './OrderTicket.vue'
import PositionOrderDialog from './PositionOrderDialog.vue'

const props = defineProps({ modelValue: Boolean, position: Object, account: Object, paused: Boolean })
const emit = defineEmits(['update:modelValue', 'submit'])
const quote = ref(null)
const initialOrder = ref(null)
const ticketKey = ref(0)
watch(() => props.modelValue, visible => {
  if (!visible) return
  quote.value = null
  initialOrder.value = {
    executionType: props.position?.orderType === '手工单' ? 'highTouch' : 'lowTouch',
    type: 'limit',
    price: props.position?.price,
    quantity: Math.max(0, Number(props.position?.available) || 0),
    quantityMode: 'quantity',
    unit: 'shares',
    sourceOrderSide: 'sell',
  }
  ticketKey.value++
}, { immediate: true })
function submit(order) {
  if (props.paused || order.side !== 'sell' || order.openClose !== '平') return
  emit('submit', order)
  emit('update:modelValue', false)
}
</script>

<template>
  <PositionOrderDialog :model-value="modelValue" title="平仓" class="close-dialog" :position="position" :account="account" @update:model-value="emit('update:modelValue', $event)" @quote="quote = $event">
    <template #order><OrderTicket v-if="modelValue && position && account" :key="ticketKey" close-mode locked-context :instruments="[position]" :accounts="[account]" :symbol="position" :account="account" :quote="quote" :paused="paused" :initial-order="initialOrder" @order="submit" /></template>
  </PositionOrderDialog>
</template>

<style>
.variants-app .close-dialog .cp-layout{max-height:calc(100vh - var(--ft-dialog-top) - 60px);overflow-y:auto}
</style>
