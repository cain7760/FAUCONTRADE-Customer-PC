<script setup>
import { computed, ref, watch } from 'vue'
import { money, number, price as formatPrice } from '../variantData'
import { useDialogShortcuts } from '../../../composables/useDialogShortcuts'
import PositionOrderDialog from './PositionOrderDialog.vue'

const props = defineProps({ modelValue: Boolean, order: Object, symbol: Object, account: Object })
const emit = defineEmits(['update:modelValue', 'submit'])
const quote = ref(null)
const price = ref(null)
const quantity = ref(null)
const formError = ref('')
const isOpen = computed(() => props.modelValue)
const isMarket = computed(() => props.order?.type === 'market')
const lotSize = computed(() => props.symbol?.lotSize || 100)
const originalPrice = computed(() => props.order?.price ?? null)
const originalQuantity = computed(() => Number(props.order?.quantity) || 0)
const filledQuantity = computed(() => Number(props.order?.filledQuantity) || 0)
const quantityDelta = computed(() => (Number(quantity.value) || 0) - originalQuantity.value)
const priceChanged = computed(() => !isMarket.value && Number(price.value) !== Number(originalPrice.value))
const operation = computed(() => quantityDelta.value > 0 ? '追单' : quantityDelta.value < 0 ? '部撤' : '改价')
const operationHint = computed(() => {
  if (quantityDelta.value > 0) return `将新增追单 ${number(quantityDelta.value)} 股。`
  if (quantityDelta.value < 0) return `将部撤 ${number(Math.abs(quantityDelta.value))} 股。`
  return priceChanged.value ? '仅更新原委托价格。' : '请调整订单价格或数量。'
})
const canSubmit = computed(() => {
  const nextQuantity = Number(quantity.value)
  if (!Number.isFinite(nextQuantity) || nextQuantity < filledQuantity.value || nextQuantity <= 0 || nextQuantity % lotSize.value !== 0) return false
  if (!isMarket.value && (!Number.isFinite(Number(price.value)) || Number(price.value) <= 0)) return false
  return priceChanged.value || quantityDelta.value !== 0
})

watch(() => props.order, order => {
  quote.value = null
  price.value = order?.price ?? null
  quantity.value = order?.quantity ?? null
  formError.value = ''
}, { immediate: true })
watch(quote, value => { if (value && !isMarket.value) price.value = value.price })

function close() { emit('update:modelValue', false) }
function submit() {
  const nextQuantity = Number(quantity.value)
  if (!Number.isFinite(nextQuantity) || nextQuantity < filledQuantity.value) {
    formError.value = `修改后的订单数量不得低于已成数量 ${number(filledQuantity.value)} 股。`
    return
  }
  if (nextQuantity % lotSize.value !== 0) {
    formError.value = `订单数量须为 ${number(lotSize.value)} 股的整数倍。`
    return
  }
  if (!canSubmit.value) {
    formError.value = '请调整订单价格或数量后再提交。'
    return
  }
  emit('submit', {
    orderId: props.order.id,
    orderNo: props.order.orderNo,
    price: isMarket.value ? null : Number(price.value),
    quantity: nextQuantity,
    originalPrice: originalPrice.value,
    originalQuantity: originalQuantity.value,
    quantityDelta: quantityDelta.value,
    operation: operation.value,
  })
  close()
}

useDialogShortcuts(isOpen, { confirm: submit, cancel: close })
</script>

<template>
  <PositionOrderDialog :model-value="modelValue" title="改单" :position="symbol" :account="account" @update:model-value="emit('update:modelValue', $event)" @quote="quote = $event">
    <template #metrics>
      <div class="cp-metrics amend-original-metrics">
        <div><span>原订单编号</span><b :title="order.orderNo">{{ order.orderNo }}</b></div>
        <div><span>原委托价格</span><b>{{ originalPrice === null ? '市价' : formatPrice(originalPrice, order.market) }}</b></div>
        <div><span>原委托数量</span><b>{{ number(originalQuantity) }}</b></div>
        <div><span>已成数量</span><b>{{ number(filledQuantity) }}</b></div>
      </div>
    </template>
    <template #order>
      <form class="order-form chase-order-form amend-order-form" @submit.prevent="submit">
        <section class="order-type-row"><span class="amend-order-type">{{ isMarket ? '市价单' : '限价单' }}</span><span>{{ order.side === 'buy' ? '买入' : '卖出' }} · {{ order.openClose === '开' ? '开仓' : '平仓' }}</span></section>
        <section class="price-block">
          <template v-if="!isMarket"><div class="field-caption"><label for="amend-price">修改后价格</label><span class="dim">原价 {{ formatPrice(originalPrice, order.market) }}</span></div><el-input-number id="amend-price" v-model="price" :step=".01" :precision="2" :controls="false" /></template>
          <template v-else><div class="field-caption"><span>订单价格</span></div><div class="market-price-note"><b>市价单不支持改价</b></div></template>
        </section>
        <section class="quantity-block"><div class="field-caption"><label for="amend-quantity">修改后数量</label><span class="dim">原数量 {{ number(originalQuantity) }} 股</span></div><div class="quantity-input-row"><el-input-number id="amend-quantity" v-model="quantity" :min="filledQuantity" :step="lotSize" :precision="0" :controls="false" /><span>股</span></div><p class="amend-order-hint" :class="{ 'is-error': formError }">{{ formError || operationHint }}</p></section>
        <section class="submit-block"><div class="trade-buttons"><el-button native-type="submit" class="buy-action" :disabled="!canSubmit">确认改单</el-button></div><div class="amend-order-summary"><div><span>操作类型</span><b>{{ operation }}</b></div><div><span>修改后金额(CNY)</span><b>{{ quantity ? money((isMarket ? symbol.price : price || 0) * quantity) : '--' }}</b></div><div><span>可撤数量(股)</span><b>{{ number(Math.max(0, originalQuantity - filledQuantity)) }}</b></div></div></section>
      </form>
    </template>
  </PositionOrderDialog>
</template>
