<script setup>
import { computed, ref, watch } from 'vue'
import { money, number } from '../variantData'
import PositionOrderDialog from './PositionOrderDialog.vue'

const props = defineProps({ modelValue: Boolean, position: Object, order: Object, account: Object })
const emit = defineEmits(['update:modelValue', 'submit'])
const quote = ref(null)
const executionType = ref('lowTouch')
const algorithm = ref('DMA')
const orderType = ref('limit')
const side = ref('buy')
const openClose = ref('开')
const price = ref()
const quantity = ref()
const fraction = ref(0)

const sourceAttribute = computed(() => props.order?.attribute || `${orderType.value === 'limit' ? '限价' : '市价'}·数量`)
const estimatedPrice = computed(() => orderType.value === 'limit' ? Number(price.value) || 0 : props.position?.price || 0)
const maxBuy = computed(() => estimatedPrice.value > 0 ? Math.floor((props.account?.cash || 0) / estimatedPrice.value / 100) * 100 : 0)
const maxSell = computed(() => Math.floor((props.position?.available || 0) / 100) * 100)
const maxQuantity = computed(() => side.value === 'buy' ? maxBuy.value : maxSell.value)
const estimatedAmount = computed(() => (Number(quantity.value) || 0) * estimatedPrice.value)
const canSubmit = computed(() => quantity.value > 0 && quantity.value <= maxQuantity.value && quantity.value % 100 === 0 && (orderType.value === 'market' || price.value > 0))

function loadOrder() {
  const order = props.order
  quote.value = null
  executionType.value = order?.executionType === 'highTouch' ? 'highTouch' : 'lowTouch'
  algorithm.value = ['POV', 'DMA'].includes(order?.algorithm) ? order.algorithm : 'DMA'
  orderType.value = order?.type === 'market' ? 'market' : 'limit'
  side.value = order?.side === 'sell' ? 'sell' : 'buy'
  openClose.value = order?.openClose === '平' ? '平' : '开'
  price.value = order?.price ?? props.position?.price
  quantity.value = order?.quantity ?? undefined
  fraction.value = 0
}

watch(() => [props.order, props.position], loadOrder, { immediate: true })
watch(quote, value => { if (value) { orderType.value = 'limit'; price.value = value.price } })
function size(value) { quantity.value = Math.floor(maxQuantity.value * value / 100 / 100) * 100 }
function submit() {
  if (!canSubmit.value || !props.position || !props.account) return
  const id = Date.now()
  emit('submit', {
    id, orderNo: `WT${id}`, account: props.account.id, code: props.position.code, name: props.position.name,
    executionType: executionType.value, orderType: executionType.value === 'highTouch' ? '手工单' : '系统单', algorithm: algorithm.value,
    type: orderType.value, side: side.value, openClose: openClose.value, status: '待报', runStatus: '正常',
    attribute: `${orderType.value === 'limit' ? '限价' : '市价'}·数量`, quantity: quantity.value,
    price: orderType.value === 'limit' ? price.value : null, orderValueNumber: quantity.value,
    orderValue: `${number(quantity.value)} 股`, filledQuantity: 0, filledPrice: null, estimate: estimatedAmount.value,
    parentOrderNo: props.order?.orderNo || '', traderRemark: props.order?.orderNo ? `关联原订单 ${props.order.orderNo} 的追单` : '',
  })
  emit('update:modelValue', false)
}
</script>

<template>
  <PositionOrderDialog :model-value="modelValue" title="追单" :position="position" :account="account" @update:model-value="emit('update:modelValue', $event)" @quote="quote = $event">
    <template #metrics>
      <div class="cp-metrics chase-original-metrics">
        <div><span>原订单编号</span><b>{{ order?.orderNo || '--' }}</b></div>
        <div><span>订单类型</span><b>{{ order?.orderType || (executionType === 'highTouch' ? '手工单' : '系统单') }}</b></div>
        <div><span>执行算法</span><b>{{ order?.algorithm || algorithm }}</b></div>
        <div><span>订单属性</span><b>{{ sourceAttribute }}</b></div>
      </div>
    </template>
    <template #order>
      <form class="order-form chase-order-form" @submit.prevent="submit">
        <section class="execution-type-block">
          <el-radio-group v-model="executionType" class="execution-type" aria-label="订单类型">
            <el-radio-button label="lowTouch">系统单</el-radio-button><el-radio-button label="highTouch">手工单</el-radio-button>
          </el-radio-group>
          <el-popover placement="bottom-end" :width="174" trigger="click" popper-class="variant-popper algorithm-popper">
            <template #reference><button type="button" class="algorithm-trigger" :aria-label="`执行算法：${algorithm}，点击选择`">算法·{{ algorithm }}<svg class="algorithm-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></button></template>
            <div class="execution-algorithm-menu"><span>选择执行算法</span><el-radio-group v-model="algorithm" size="small"><el-radio-button label="POV">POV</el-radio-button><el-radio-button label="DMA">DMA</el-radio-button></el-radio-group></div>
          </el-popover>
        </section>
        <section class="chase-direction-row">
          <el-radio-group v-model="side" class="chase-choice" aria-label="买卖方向"><el-radio-button label="buy">买入</el-radio-button><el-radio-button label="sell">卖出</el-radio-button></el-radio-group>
          <el-radio-group v-model="openClose" class="chase-choice" aria-label="开平类型"><el-radio-button label="开">开仓</el-radio-button><el-radio-button label="平">平仓</el-radio-button></el-radio-group>
        </section>
        <section class="order-type-row"><el-radio-group v-model="orderType" class="order-type"><el-radio-button label="limit">限价</el-radio-button><el-radio-button label="market">市价</el-radio-button></el-radio-group></section>
        <section class="price-block"><template v-if="orderType === 'limit'"><div class="field-caption"><label for="chase-price">订单价格</label></div><el-input-number id="chase-price" v-model="price" :step=".01" :precision="2" :controls="false" /></template><template v-else><div class="field-caption"><span>订单价格</span></div><div class="market-price-note"><b>以市场价格成交</b></div></template></section>
        <section class="quantity-block"><div class="field-caption"><label for="chase-quantity">订单数量</label></div><div class="quantity-input-row"><el-input-number id="chase-quantity" v-model="quantity" placeholder="请输入" :step="100" :precision="0" :controls="false" /><span>股</span></div><el-slider v-model="fraction" :step="1" :marks="{0:'0%',25:'25%',50:'50%',75:'75%',100:'100%'}" @input="size" /></section>
        <section class="submit-block"><div class="trade-buttons"><el-button native-type="submit" :class="side === 'buy' ? 'buy-action' : 'sell-action'" :disabled="!canSubmit">{{ side === 'buy' ? '买入' : '卖出' }}</el-button></div><div class="chase-order-summary"><div><span>追单数量(股)</span><b>{{ quantity ? number(quantity) : '--' }}</b></div><div><span>预估金额(CNY)</span><b>{{ quantity ? money(estimatedAmount) : '--' }}</b></div><div><span>最大可{{ side === 'buy' ? '买' : '卖' }}(股)</span><b>{{ number(maxQuantity) }}</b></div></div></section>
      </form>
    </template>
  </PositionOrderDialog>
</template>
