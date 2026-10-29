<script setup>
import { computed, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, InfoFilled } from '@element-plus/icons-vue'
import { money, number, price as formatPrice } from '../variantData'
import { useDialogShortcuts } from '../../../composables/useDialogShortcuts'
import PositionOrderDialog from './PositionOrderDialog.vue'
import { canUseMarketOrder, normalizeOrderType, orderTypeError } from '../orderMarketRules.js'

const props = defineProps({ modelValue: Boolean, order: Object, symbol: Object, account: Object })
const emit = defineEmits(['update:modelValue', 'submit'])
const quote = ref(null), executionType = ref('lowTouch'), side = ref('buy'), orderType = ref('limit')
const price = ref(null), quantityMode = ref('quantity'), quantity = ref(null), amount = ref(null)
const unit = ref('shares'), amountUnit = ref('yuan')
const algorithm = ref('DMA'), povHours = ref(1), povMinutes = ref(0), povParticipation = ref(10)
const algorithmPopoverVisible = ref(false)
const draftAlgorithm = ref('DMA'), draftPovHours = ref(1), draftPovMinutes = ref(0), draftPovParticipation = ref(10)
const povHourOptions = Array.from({ length: 24 }, (_, hour) => hour)
const povMinuteOptions = Array.from({ length: 60 }, (_, minute) => minute)
const algorithmDisplay = value => value === 'none' ? '无需算法' : value
const note = ref(''), formError = ref('')
const isOpen = computed(() => props.modelValue)
const orderInstrument = computed(() => ({ ...props.order, ...props.symbol, market: props.order?.market || props.symbol?.market }))
const marketOrderAllowed = computed(() => canUseMarketOrder(orderInstrument.value))
const isMarket = computed(() => orderType.value === 'market')
const usesAmount = computed(() => !isMarket.value && quantityMode.value === 'amount')
const lotSize = computed(() => props.symbol?.lotSize || 100)
const originalPrice = computed(() => props.order?.price ?? null)
const originalQuantity = computed(() => Number(props.order?.quantity) || 0)
const filledQuantity = computed(() => Number(props.order?.filledQuantity) || 0)
const effectivePrice = computed(() => isMarket.value ? Number(props.symbol?.price) : Number(price.value))
const displayedQuantity = computed({
  get: () => quantity.value == null ? undefined : (quantity.value - filledQuantity.value) / (unit.value === 'wan' ? 10000 : 1),
  set: value => { quantity.value = filledQuantity.value + (Number(value) || 0) * (unit.value === 'wan' ? 10000 : 1) },
})
const displayedAmount = computed({
  get: () => amount.value == null ? undefined : (amount.value - filledQuantity.value * effectivePrice.value) / (amountUnit.value === 'wan' ? 10000 : 1),
  set: value => { amount.value = filledQuantity.value * effectivePrice.value + (Number(value) || 0) * (amountUnit.value === 'wan' ? 10000 : 1) },
})
const nextQuantity = computed(() => usesAmount.value
  ? effectivePrice.value > 0 ? Math.floor((Number(amount.value) || 0) / effectivePrice.value / lotSize.value) * lotSize.value : 0
  : Number(quantity.value) || 0)
const remainingQuantity = computed(() => Math.max(0, nextQuantity.value - filledQuantity.value))
const maximumQuantity = computed(() => {
  const outstanding = Math.max(0, originalQuantity.value - filledQuantity.value)
  if (side.value === 'sell') return outstanding
  const cash = Number(props.account?.cash) || 0
  return Math.max(outstanding, effectivePrice.value > 0 ? Math.floor(cash / effectivePrice.value / lotSize.value) * lotSize.value : 0)
})
const sliderFraction = computed({
  get: () => maximumQuantity.value
    ? Math.min(100, Math.max(0, Math.round(remainingQuantity.value / maximumQuantity.value * 100)))
    : 0,
  set: percent => {
    const remaining = Math.floor(maximumQuantity.value * Number(percent) / 100 / lotSize.value) * lotSize.value
    const total = filledQuantity.value + remaining
    if (usesAmount.value) amount.value = Math.ceil(total * effectivePrice.value * 100 - 1e-7) / 100
    else quantity.value = total
  },
})
const quantitySummaryLabel = computed(() => side.value === 'sell' ? '卖出预估(股)' : '买入预估(股)')
const amountSummaryLabel = computed(() => side.value === 'sell' ? '预估卖出金额(CNY)' : '买入金额(CNY)')
const capacityLabel = computed(() => side.value === 'sell' ? '最大可卖' : '最大可买')
const quantityDelta = computed(() => nextQuantity.value - originalQuantity.value)
const operation = computed(() => quantityDelta.value > 0 ? '追单' : quantityDelta.value < 0 ? '部撤' : '改单')
const hasInvalidPovParameters = (hours, minutes, participation) =>
  !Number.isInteger(Number(hours)) || Number(hours) < 0 || Number(hours) > 23
  || !Number.isInteger(Number(minutes)) || Number(minutes) < 0 || Number(minutes) > 59
  || (Number(hours) === 0 && Number(minutes) === 0)
  || !Number.isInteger(Number(participation)) || Number(participation) < 1 || Number(participation) > 25
const povInvalid = computed(() => algorithm.value === 'POV' && hasInvalidPovParameters(povHours.value, povMinutes.value, povParticipation.value))
const draftPovParameterError = computed(() => draftAlgorithm.value === 'POV' && hasInvalidPovParameters(draftPovHours.value, draftPovMinutes.value, draftPovParticipation.value))
const changed = computed(() => {
  const order = props.order
  if (!order) return false
  return executionType.value !== (order.executionType === 'highTouch' ? 'highTouch' : 'lowTouch')
    || side.value !== order.side || orderType.value !== (order.type === 'market' ? 'market' : 'limit')
    || (!isMarket.value && Number(price.value) !== Number(order.price))
    || quantityDelta.value !== 0 || (usesAmount.value ? Number(amount.value) !== Number(order.inputAmount) : order.inputAmount != null)
    || algorithm.value !== (order.algorithm || 'DMA')
    || (algorithm.value === 'POV' && JSON.stringify([Number(povHours.value), Number(povMinutes.value), Number(povParticipation.value)])
      !== JSON.stringify([Number(order.algorithmParams?.hours ?? 1), Number(order.algorithmParams?.minutes ?? 0), Number(order.algorithmParams?.participation ?? 10)]))
    || note.value.trim() !== (order.orderRemark || order.note || '').trim()
})
const priceError = computed(() => !isMarket.value && (!Number.isFinite(effectivePrice.value) || effectivePrice.value <= 0) ? '请输入有效的限价。' : '')
const validationError = computed(() => {
  const typeError = orderTypeError(orderType.value, orderInstrument.value)
  if (typeError) return typeError
  if (!Number.isFinite(nextQuantity.value) || nextQuantity.value <= 0) return '请输入有效的订单数量或金额。'
  if (nextQuantity.value < filledQuantity.value) return `修改后的订单数量不得低于已成数量 ${number(filledQuantity.value)} 股。`
  if (side.value === 'sell' && remainingQuantity.value > maximumQuantity.value) return `未成交卖出数量不得超过 ${number(maximumQuantity.value)} 股。`
  if (nextQuantity.value % lotSize.value !== 0) return `订单数量须为 ${number(lotSize.value)} 股的整数倍。`
  if (priceError.value) return priceError.value
  if (povInvalid.value) return 'POV 运行时间须大于 0，市场成交占比须为 1%–25%。'
  return ''
})
const activeError = computed(() => formError.value || validationError.value)
const quantityError = computed(() => activeError.value === priceError.value ? '' : activeError.value)
const canSubmit = computed(() => !!props.order && changed.value && !validationError.value)
const operationHint = computed(() => {
  const filledHint = filledQuantity.value ? `已成 ${number(filledQuantity.value)} 股不变；` : ''
  if (quantityDelta.value > 0) return `${filledHint}将新增追单 ${number(quantityDelta.value)} 股。`
  if (quantityDelta.value < 0) return `${filledHint}将部撤 ${number(Math.abs(quantityDelta.value))} 股。`
  return changed.value ? `${filledHint}将更新原订单的未成交部分。` : filledQuantity.value ? `${filledHint}仅调整未成交部分。` : ''
})

watch(() => props.order, order => {
  quote.value = null
  algorithmPopoverVisible.value = false
  executionType.value = order?.executionType === 'highTouch' ? 'highTouch' : 'lowTouch'
  side.value = order?.side || 'buy'
  orderType.value = normalizeOrderType(order?.type, orderInstrument.value)
  price.value = order?.price ?? null
  quantityMode.value = order?.type === 'market' || order?.inputAmount == null ? 'quantity' : 'amount'
  quantity.value = order?.quantity ?? null
  amount.value = order?.inputAmount ?? (Number(order?.quantity) || 0) * (Number(order?.price) || 0)
  unit.value = 'shares'
  amountUnit.value = 'yuan'
  algorithm.value = order?.algorithm || 'DMA'
  povHours.value = order?.algorithmParams?.hours ?? 1
  povMinutes.value = order?.algorithmParams?.minutes ?? 0
  povParticipation.value = order?.algorithmParams?.participation ?? 10
  note.value = order?.orderRemark || order?.note || ''
  formError.value = ''
}, { immediate: true })
watch([orderInstrument, orderType], () => {
  orderType.value = normalizeOrderType(orderType.value, orderInstrument.value)
  if (orderType.value === 'market') quantityMode.value = 'quantity'
}, { immediate: true })
watch(quote, value => { if (value) { orderType.value = 'limit'; price.value = value.price } })
watch([executionType, side, orderType, price, quantityMode, quantity, amount, algorithm, povHours, povMinutes, povParticipation, note], () => { formError.value = '' })

function close() { emit('update:modelValue', false) }
function stepPrice(direction) {
  const current = Number(price.value) || 0
  price.value = Number(Math.max(0, current + direction * .01).toFixed(2))
}
function openAlgorithmConfig() {
  draftAlgorithm.value = algorithm.value
  draftPovHours.value = povHours.value
  draftPovMinutes.value = povMinutes.value
  draftPovParticipation.value = povParticipation.value
}
function cancelAlgorithmConfig() { algorithmPopoverVisible.value = false }
function confirmAlgorithmConfig() {
  if (draftPovParameterError.value) return
  algorithm.value = draftAlgorithm.value
  povHours.value = draftPovHours.value
  povMinutes.value = draftPovMinutes.value
  povParticipation.value = draftPovParticipation.value
  algorithmPopoverVisible.value = false
}
function submit() {
  formError.value = validationError.value || (!changed.value ? '请调整订单参数后再提交。' : '')
  if (formError.value) return
  emit('submit', {
    orderId: props.order.id, orderNo: props.order.orderNo,
    executionType: executionType.value, side: side.value, type: orderType.value,
    price: isMarket.value ? null : Number(price.value), quantity: nextQuantity.value,
    inputAmount: usesAmount.value ? Number(amount.value) : null,
    algorithm: algorithm.value,
    algorithmParams: algorithm.value === 'POV' ? { hours: Number(povHours.value), minutes: Number(povMinutes.value), participation: Number(povParticipation.value) } : null,
    note: note.value.trim(), originalPrice: originalPrice.value,
    originalQuantity: originalQuantity.value, quantityDelta: quantityDelta.value, operation: operation.value,
  })
  close()
}
useDialogShortcuts(isOpen, { confirm: submit, cancel: close })
</script>

<template>
  <PositionOrderDialog :model-value="modelValue" title="改单" :position="symbol" :account="account" class="amend-order-dialog" hide-metrics :currency="orderInstrument.currency || (orderInstrument.market === 'HK' ? 'HKD' : 'CNY')" @update:model-value="emit('update:modelValue', $event)" @quote="quote = $event">
    <template #overview>
      <section class="amend-order-overview" aria-label="原订单信息">
        <header class="amend-order-overview-heading"><div class="amend-order-overview-title"><h3>原订单信息</h3><span class="execution-type-tag" :class="order.executionType === 'highTouch' ? 'is-high-touch' : 'is-low-touch'">{{ order.executionType === 'highTouch' ? '手工单' : '系统单' }}</span></div><span>原订单编号：<b :title="order.orderNo">{{ order.orderNo }}</b></span></header>
        <dl>
          <div><dt>开平/方向</dt><dd class="amend-order-tags"><span class="amend-order-tag">{{ order.openClose === '开' ? '开仓' : order.openClose === '平' ? '平仓' : '--' }}</span><span class="amend-order-tag" :class="{ 'is-buy': order.side === 'buy', 'is-sell': order.side === 'sell' }">{{ order.side === 'buy' ? '买' : order.side === 'sell' ? '卖' : '--' }}</span></dd></div>
          <div><dt>订单价格</dt><dd>{{ originalPrice === null ? '市价' : formatPrice(originalPrice, order.market) }}</dd></div>
          <div><dt>订单数量</dt><dd>{{ number(originalQuantity) }}</dd></div>
          <div><dt>已成数量</dt><dd>{{ number(filledQuantity) }}</dd></div>
        </dl>
      </section>
    </template>
    <template #order>
      <form class="order-form amend-order-form" @submit.prevent="submit">
        <section class="order-context-block">
          <div class="order-account-block"><div class="field-caption"><span>下单账户</span></div><div class="amend-readonly" :title="order.accountLabel || (account?.id || order.account) + ' - ' + (account?.name || '')">{{ order.accountLabel || (account?.id || order.account) + ' - ' + (account?.name || '') }}</div></div>
        </section>
        <section class="price-block">
          <div class="field-caption"><label for="amend-price">订单价格</label><el-radio-group v-model="orderType" class="quantity-mode order-price-type" size="small" aria-label="价格类型"><el-radio-button label="limit">限价</el-radio-button><el-radio-button v-if="marketOrderAllowed" label="market">市价</el-radio-button></el-radio-group></div>
          <div v-if="!isMarket" class="price-input-row"><el-input-number id="amend-price" v-model="price" placeholder="请输入" :step=".01" :precision="2" :controls="false" /><span class="price-stepper"><button type="button" aria-label="增加订单价格" @click="stepPrice(1)"><el-icon><ArrowUp /></el-icon></button><button type="button" aria-label="减少订单价格" @click="stepPrice(-1)"><el-icon><ArrowDown /></el-icon></button></span></div>
          <div v-else class="market-price-note"><b>以市场价格成交</b></div>
          <p v-if="priceError" class="amend-order-hint is-error" role="status">{{ priceError }}</p>
        </section>
        <section class="quantity-block">
          <div class="field-caption"><label :for="usesAmount ? 'amend-amount' : 'amend-quantity'">{{ filledQuantity ? '未成交' : '订单' }}{{ usesAmount ? '金额' : '数量' }}</label><div class="quantity-caption-actions"><span v-if="!usesAmount" class="order-lot-tag">{{ number(lotSize) }}股/手</span><el-radio-group v-model="quantityMode" class="quantity-mode" size="small" aria-label="下单方式"><el-radio-button label="quantity">数量</el-radio-button><el-radio-button v-if="!isMarket" label="amount">金额</el-radio-button></el-radio-group></div></div>
          <div class="quantity-input-row"><el-input-number v-if="usesAmount" id="amend-amount" v-model="displayedAmount" placeholder="请输入" :min="0" :step="amountUnit === 'wan' ? 1 : 1000" :precision="2" :controls="false" /><el-input-number v-else id="amend-quantity" v-model="displayedQuantity" placeholder="请输入" :min="0" :step="unit === 'wan' ? .01 : lotSize" :precision="unit === 'wan' ? 2 : 0" :controls="false" /><el-select v-if="usesAmount" v-model="amountUnit" aria-label="金额单位" popper-class="variant-popper quantity-unit-popper" :class="{ 'is-wan-unit': amountUnit === 'wan' }"><el-option label="元" value="yuan" /><el-option label="万元" value="wan" /></el-select><el-select v-else v-model="unit" aria-label="数量单位" popper-class="variant-popper quantity-unit-popper" :class="{ 'is-wan-unit': unit === 'wan' }"><el-option label="股" value="shares" /><el-option label="万股" value="wan" /></el-select></div>
          <p v-if="quantityError || operationHint" class="amend-order-hint" :class="{ 'is-error': quantityError }" role="status">{{ quantityError || operationHint }}</p>
          <section class="order-account-block order-algorithm-block"><div class="field-caption"><span>算法</span></div><el-popover v-model:visible="algorithmPopoverVisible" trigger="click" placement="bottom-end" :width="264" popper-class="variant-popper algorithm-popper" @show="openAlgorithmConfig"><template #reference><button type="button" class="algorithm-trigger" :aria-label="`执行算法：${algorithmDisplay(algorithm)}，点击配置`"><span>{{ algorithmDisplay(algorithm) }}</span><svg class="algorithm-chevron" :class="{ 'is-open': algorithmPopoverVisible }" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg></button></template><div class="execution-algorithm-menu"><span>执行算法</span><el-radio-group v-model="draftAlgorithm" aria-label="执行算法"><el-radio-button label="POV">POV</el-radio-button><el-radio-button label="DMA">DMA</el-radio-button><el-radio-button label="none">无需算法</el-radio-button></el-radio-group><div v-if="draftAlgorithm === 'POV'" class="algorithm-popper-params" aria-label="POV 参数"><div class="algorithm-param-row"><span>运行时间</span><div class="algorithm-param-input"><el-select v-model="draftPovHours" class="algorithm-time-select" aria-label="POV运行小时" popper-class="variant-popper" :teleported="false"><el-option v-for="hour in povHourOptions" :key="hour" :label="String(hour).padStart(2, '0')" :value="hour" /></el-select><i>时</i><el-select v-model="draftPovMinutes" class="algorithm-time-select" aria-label="POV运行分钟" popper-class="variant-popper" :teleported="false"><el-option v-for="minute in povMinuteOptions" :key="minute" :label="String(minute).padStart(2, '0')" :value="minute" /></el-select><i>分</i></div></div><div class="algorithm-param-row"><span>市场成交占比</span><div class="algorithm-param-input is-participation"><el-input-number v-model="draftPovParticipation" :min="1" :max="25" :precision="0" :controls="false" aria-label="POV市场成交占比" /><i>%</i><small>不超过 25%</small></div></div><p v-if="draftPovParameterError" class="algorithm-param-error" role="alert">请填写有效的运行时间，市场成交占比不得超过 25%</p></div><footer class="algorithm-menu-actions"><el-button size="small" @click="cancelAlgorithmConfig">取消</el-button><el-button size="small" type="primary" :disabled="draftPovParameterError" @click="confirmAlgorithmConfig">确认</el-button></footer></div></el-popover></section>
          <el-slider v-model="sliderFraction" :step="1" :marks="{ 0: '0%', 25: '25%', 50: '50%', 75: '75%', 100: '100%' }" aria-label="调整未成交数量百分比" />
          <div class="amend-order-capacity"><span class="total-heading"><span>{{ capacityLabel }}</span><el-tooltip v-if="side === 'sell'" content="最大可卖 = 原订单数量 - 已成数量。已成部分不可撤改，滑块只调整未成交部分。" :trigger="['hover', 'focus']" placement="top" popper-class="order-help-popper"><button type="button" class="total-help" aria-label="最大可卖说明"><el-icon><InfoFilled /></el-icon></button></el-tooltip></span><b>{{ number(maximumQuantity) }} 股</b></div>
        </section>
        <section v-if="executionType === 'highTouch'" class="order-note-block"><div class="field-caption"><label for="amend-note">备注</label></div><el-input id="amend-note" v-model="note" type="textarea" :rows="2" maxlength="200" show-word-limit placeholder="请输入备注" /></section>
        <section class="submit-block"><div class="trade-buttons"><el-button native-type="submit" :class="side === 'sell' ? 'sell-action' : 'buy-action'" :disabled="!canSubmit">确认改单</el-button></div><div v-if="executionType === 'lowTouch'" class="amend-order-summary"><div><span>{{ quantitySummaryLabel }}</span><b>{{ remainingQuantity || filledQuantity ? number(remainingQuantity) : '--' }}</b></div><div><span>{{ amountSummaryLabel }}</span><b>{{ remainingQuantity || filledQuantity ? money(effectivePrice * remainingQuantity) : '--' }}</b></div></div></section>
      </form>
    </template>
  </PositionOrderDialog>
</template>

<style scoped>
.amend-order-overview { flex: none; margin-top: 16px; padding: 10px 12px 12px; background: #25282d; }
.amend-order-overview-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; margin-bottom: 10px; }
.amend-order-overview-title { display: flex; align-items: center; gap: 6px; flex: none; }
.amend-order-overview h3 { flex: none; margin: 0; color: #e8eaed; font-size: 12px; font-weight: 600; }
.amend-order-overview-heading > span { min-width: 0; overflow: hidden; color: #949daa; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.amend-order-overview-heading b { color: #edf0f4; font-weight: 500; }
.amend-order-overview dl { display: grid; grid-template-columns: 88px repeat(3, minmax(max-content, 1fr)); gap: 8px; margin: 0; overflow-x: auto; }
.amend-order-overview dl > div { min-width: 0; }
.amend-order-overview dt { color: #949daa; font-size: 10px; white-space: nowrap; }
.amend-order-overview dd { margin: 4px 0 0; color: #edf0f4; font-size: 12px; line-height: 17px; white-space: nowrap; }
.amend-order-overview .amend-order-tags { display: flex; gap: 4px; overflow: visible; }
.amend-order-tag { display: inline-flex; align-items: center; height: 17px; padding: 0 4px; border-radius: 2px; background: #393d43; color: #edf0f4; font-size: 10px; line-height: 17px; }
.amend-order-tag.is-buy { background: var(--ft-color-buy); color: #fff; }
.amend-order-tag.is-sell { background: var(--ft-color-sell); color: #fff; }
.amend-order-form { scrollbar-width: thin; }
.amend-order-form .order-context-block .order-account-block { transform: none; }
.amend-readonly { min-width: 0; overflow: hidden; color: #e8eaed; font-size: 12px; line-height: 32px; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
</style>
<style>
.variants-app .amend-order-dialog .cp-layout::before { display: none; }
.variants-app .amend-order-dialog .cp-layout { height: min(580px, calc(100vh - var(--ft-dialog-top) - 72px)); min-height: 0; grid-template-columns: minmax(0, 1fr) 304px; }
.variants-app .amend-order-dialog .cp-market { display: flex; flex-direction: column; overflow: hidden; }
/* The shared position dialog forces book overflow visible; amendment needs a scrollable book below its summary. */
.variants-app .amend-order-dialog .cp-market .book-pane { display: flex; flex: 1; flex-direction: column; min-height: 0; overflow: hidden!important; }
.variants-app .amend-order-dialog .cp-market .book-scroll { flex: 1; min-height: 0; height: auto!important; overflow-y: auto!important; }
.variants-app .amend-order-dialog .cp-market .book-quote { width: 100%; height: auto; min-height: 0; margin: 0; padding: 12px; }
.variants-app .amend-order-dialog .cp-market .book-quote > strong { font-size: 15px; }
.variants-app .amend-order-dialog .cp-market .book-currency { display: inline-block; margin-left: 6px; padding: 2px 5px; border-radius: 2px; background: #3b3322; color: #e1c36f; font-size: 10px; font-style: normal; font-weight: 500; vertical-align: 2px; }
.variants-app .amend-order-dialog .cp-market .book-quote > div { margin-top: 8px; transform: none; }
.variants-app .amend-order-dialog .cp-market .book-quote b { font-size: 20px; }
.variants-app .amend-order-dialog .cp-market .drag-heading { cursor: default; touch-action: auto; user-select: auto; }
.variants-app .amend-order-dialog .cp-market .book-subtitle { border-top: 1px solid #303338; }
.variants-app .amend-order-dialog .cp-market .book-depths { transform: none; }
.variants-app .amend-order-dialog .amend-order-capacity { margin-top: 12px; }
.variants-app .amend-order-dialog .amend-order-capacity b,
.variants-app .amend-order-dialog .amend-order-summary b { font-family: var(--ft-font-numeric); font-variant-numeric: tabular-nums; }
.variants-app .amend-order-dialog .amend-order-summary b { font-weight: 400; }
.variants-app .amend-order-dialog .cp-order { display: flex; flex-direction: column; overflow: hidden; }
/* Keep 12px side/bottom padding and add 8px above the amend form. */
.variants-app .amend-order-dialog .cp-order > .order-form.amend-order-form { flex: 1; min-height: 0; max-height: none; padding: 20px 12px 12px!important; overflow-y: auto; }
@media (max-width: 740px) {
  .variants-app .amend-order-dialog.el-dialog { width: calc(100vw - 24px)!important; min-width: 0; }
  .variants-app .amend-order-dialog .cp-layout { height: calc(100vh - var(--ft-dialog-top) - 72px); grid-template-columns: minmax(0, 1fr); overflow-y: auto; }
  .variants-app .amend-order-dialog .cp-market { min-height: 420px; border-right: 0; border-bottom: 1px solid #343840; }
  .variants-app .amend-order-dialog .cp-order { min-height: 560px; }
}
</style>
