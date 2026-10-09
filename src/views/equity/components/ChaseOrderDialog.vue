<script setup>
import { ref, watch } from 'vue'
import OrderTicket from './OrderTicket.vue'
import PositionOrderDialog from './PositionOrderDialog.vue'

const props = defineProps({ modelValue: Boolean, position: Object, order: Object, account: Object, paused: Boolean })
const emit = defineEmits(['update:modelValue', 'submit'])
const quote = ref(null)
const initialOrder = ref(null)
const ticketKey = ref(0)

watch(() => props.modelValue, visible => {
  if (!visible) return
  const order = props.order
  quote.value = null
  initialOrder.value = {
    executionType: order?.executionType === 'highTouch' || order?.orderType === '手工单' ? 'highTouch' : 'lowTouch',
    algorithm: order?.algorithm || 'POV',
    algorithmParams: order?.algorithmParams,
    type: order?.type === 'market' ? 'market' : 'limit',
    price: order?.price ?? props.position?.price,
    quantity: order?.quantity,
    quantityMode: order?.inputAmount != null ? 'amount' : 'quantity',
    amount: order?.inputAmount ?? undefined,
    sourceOrderSide: 'buy',
    note: order?.note || '',
  }
  ticketKey.value++
}, { immediate: true })

function submit(order) {
  if (props.paused || order.side !== 'buy') return
  emit('submit', {
    ...order,
    orderType: order.executionType === 'highTouch' ? '手工单' : '系统单',
    parentOrderNo: props.order?.orderNo || '',
    traderRemark: props.order?.orderNo ? `关联原订单 ${props.order.orderNo} 的追单` : '',
  })
  emit('update:modelValue', false)
}
</script>

<template>
  <PositionOrderDialog :model-value="modelValue" title="追单" class="chase-dialog" hide-metrics :position="position" :account="account" @update:model-value="emit('update:modelValue', $event)" @quote="quote = $event">
    <template #order>
      <OrderTicket v-if="modelValue && position && account" :key="ticketKey" locked-context :instruments="[position]" :accounts="[account]" :symbol="position" :account="account" :quote="quote" :paused="paused" :initial-order="initialOrder" @order="submit" />
    </template>
  </PositionOrderDialog>
</template>

<style>
.variants-app .chase-dialog .cp-layout{max-height:calc(100vh - var(--ft-dialog-top) - 60px);overflow-y:auto}
.variants-app .chase-dialog .cp-layout::before{display:none}
.variants-app .chase-dialog .cp-market .book-quote{height:68px;min-height:68px;padding-top:20px;background:none}
</style>
