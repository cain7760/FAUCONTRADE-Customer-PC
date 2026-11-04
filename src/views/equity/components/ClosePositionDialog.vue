<script setup>
import { computed, ref, watch } from 'vue'
import { money, number } from '../variantData'
import OrderContextOverview from '../../../components/trading/OrderContextOverview.vue'
import OrderTicket from './OrderTicket.vue'
import PositionOrderDialog from './PositionOrderDialog.vue'

const props = defineProps({ modelValue: Boolean, position: Object, account: Object, paused: Boolean })
const emit = defineEmits(['update:modelValue', 'submit'])
const marketValue = computed(() => money((props.position?.qty || 0) * (props.position?.price || 0)))
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
  <PositionOrderDialog :model-value="modelValue" title="平仓" class="close-dialog" hide-metrics market-overview :position="position" :account="account" @update:model-value="emit('update:modelValue', $event)" @quote="quote = $event">
    <template #overview>
      <OrderContextOverview title="持仓信息" class="close-position-overview">
        <div><dt>持仓股数(股)</dt><dd>{{ number(position.qty) }}</dd></div>
        <div><dt>持仓市值(CNY)</dt><dd>{{ marketValue }}</dd></div>
        <div><dt>可平股数(股)</dt><dd>{{ number(position.available) }}</dd></div>
        <div><dt>持仓均价(CNY)</dt><dd>{{ money(position.cost) }}</dd></div>
      </OrderContextOverview>
    </template>
    <template #order><OrderTicket v-if="modelValue && position && account" :key="ticketKey" close-mode locked-context :instruments="[position]" :accounts="[account]" :symbol="position" :account="account" :quote="quote" :paused="paused" :initial-order="initialOrder" @order="submit" /></template>
  </PositionOrderDialog>
</template>

<style>
.close-position-overview { --order-overview-columns: repeat(4, minmax(max-content, 1fr)); }
.variants-app .close-dialog .order-account-block .el-select__wrapper.is-disabled .el-select__suffix{display:none}
.variants-app .close-dialog .cp-layout{max-height:calc(100vh - var(--ft-dialog-top) - 60px);overflow-y:auto}
</style>
