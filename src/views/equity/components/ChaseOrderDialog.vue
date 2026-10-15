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
    algorithm: order?.algorithm,
    algorithmParams: order?.algorithmParams,
    type: order?.type === 'market' ? 'market' : 'limit',
    price: order?.price ?? props.position?.price,
    quantity: undefined,
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
.variants-app .chase-dialog .cp-layout{box-sizing:border-box;height:min(630px,calc(100vh - var(--ft-dialog-top) - 72px));min-height:0;overflow:hidden}
.variants-app .chase-dialog .cp-layout::before{display:none}
.variants-app .chase-dialog .cp-market{min-height:0;overflow:hidden}
.variants-app .chase-dialog .cp-market .book-pane{height:100%!important;min-height:0;overflow:hidden!important}
.variants-app .chase-dialog .cp-market .book-scroll{height:100%!important;min-height:0;overflow-y:auto!important}
.variants-app .chase-dialog .cp-market .book-quote{width:min(370px,calc(100% + 21px));height:78px;min-height:78px;padding-top:20px;border-bottom:1px solid #343840;background:none}
.variants-app .chase-dialog .cp-market .double-depth button{height:30px}
.variants-app .chase-dialog .cp-market .double-depth button i{height:27px}
.variants-app .chase-dialog .cp-order{min-height:0;overflow:hidden}
.variants-app .chase-dialog .cp-order>.order-form{box-sizing:border-box;height:100%;min-height:0;padding-bottom:4px!important;overflow-y:auto;gap:16px}
.variants-app .chase-dialog .capacity-pair.is-single{transform:translateY(4px)}
.variants-app .chase-dialog .cp-order>.order-form .submit-block{position:static;box-sizing:border-box;height:103px;min-height:103px;margin:0 -14px;padding:12px 14px 0;border-top:0;background:#1e2023}
</style>
