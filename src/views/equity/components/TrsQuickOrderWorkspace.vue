<script setup>
import { computed, ref, watch } from 'vue'
import { ArrowDownBold, Hide, View } from '@element-plus/icons-vue'
import { money, number } from '../variantData'
import OrderBook from './OrderBook.vue'
import OrderTicket from './OrderTicket.vue'

const props = defineProps({
  instruments: { type: Array, required: true },
  accounts: { type: Array, required: true },
  symbol: { type: Object, required: true },
  account: { type: Object, required: true },
  paused: Boolean,
  ticketContext: Object,
  initialOrder: Object,
})

const emit = defineEmits(['account-select', 'select', 'order'])
const quote = ref(null)
const assetsVisible = ref(true)
const assetsCollapsed = ref(false)
const accountBalance = computed(() => props.account.id === 'TZS_T0' ? 1000000 : 700000)
const displayAccountCash = computed(() => props.account.cash * 100)
const displayAccountBalance = computed(() => accountBalance.value * 100)
const defaultCounterparties = [
  { label: '线下单', value: 'offline' },
  { label: '中金公司', value: '中金公司' },
  { label: '中信证券', value: '中信证券' },
  { label: '国泰君安', value: '国泰君安' },
]
const counterparties = computed(() => props.initialOrder?.counterparties || defaultCounterparties)

function assetAmountParts(value) {
  const amount = Number(value) || 0
  const yi = Math.floor(amount / 100000000)
  const afterYi = amount - yi * 100000000
  const wan = Math.floor(afterYi / 10000)
  const rest = (afterYi - wan * 10000).toFixed(2)
  return [
    ...(yi ? [{ value: number(yi), unit: '亿' }] : []),
    ...(wan || yi ? [{ value: number(wan), unit: '万' }] : []),
    { value: rest, unit: '' },
  ]
}

function selectSymbol(code) {
  quote.value = null
  emit('select', code)
}

watch(() => props.symbol?.code, () => { quote.value = null })
</script>

<template>
  <section class="trs-quick-order-workspace" aria-label="快速下单面板">
    <section class="trade-dock" :class="{ 'assets-collapsed': assetsCollapsed }">
      <OrderBook :symbol="symbol" @quote="value => { quote = value }" />
      <section class="ticket-pane workspace-panel">
        <header class="module-heading">
          <h2>交易订单</h2>
        </header>
        <OrderTicket :key="`${symbol.code}-${initialOrder?.price}-${initialOrder?.quantity}`" :instruments="instruments" :accounts="accounts" :symbol="symbol" :account="account" :quote="quote" :paused="paused" :ticket-context="ticketContext" :initial-order="initialOrder" :counterparties="counterparties" @account-select="emit('account-select', $event)" @select="selectSymbol" @order="emit('order', $event)" />
      </section>
      <section class="compact-assets ticket-assets" :class="{ 'is-collapsed': assetsCollapsed }" aria-label="账户资金">
        <div class="asset-summary-heading"><span>资产账户概要</span><button type="button" class="asset-visibility" :aria-label="assetsVisible ? '隐藏资金数值' : '查看资金数值'" @click="assetsVisible = !assetsVisible"><el-icon><View v-if="assetsVisible" /><Hide v-else /></el-icon></button><button type="button" class="asset-collapse" :aria-label="assetsCollapsed ? '展开资产账户概要' : '收起资产账户概要'" @click="assetsCollapsed = !assetsCollapsed"><el-icon><ArrowDownBold /></el-icon></button></div>
        <div v-show="!assetsCollapsed" class="asset-summary-grid">
          <div class="asset-metric asset-available"><span>大账户可用</span><el-tooltip v-if="assetsVisible" placement="top" popper-class="asset-value-popper"><template #content><span class="asset-large-value"><template v-for="part in assetAmountParts(displayAccountCash)" :key="`${part.value}${part.unit}`"><b>{{ part.value }}</b><i v-if="part.unit">{{ part.unit }}</i></template></span></template><b class="asset-number">{{ money(displayAccountCash) }}</b></el-tooltip><b v-else class="asset-number">••••••••</b><small>CNY</small></div>
          <div class="asset-metric"><span>大账户余额</span><el-tooltip v-if="assetsVisible" placement="top" popper-class="asset-value-popper"><template #content><span class="asset-large-value"><template v-for="part in assetAmountParts(displayAccountBalance)" :key="`${part.value}${part.unit}`"><b>{{ part.value }}</b><i v-if="part.unit">{{ part.unit }}</i></template></span></template><b class="asset-number">{{ money(displayAccountBalance) }}</b></el-tooltip><b v-else class="asset-number">••••••••</b><small>CNY</small></div>
        </div>
      </section>
    </section>
  </section>
</template>
