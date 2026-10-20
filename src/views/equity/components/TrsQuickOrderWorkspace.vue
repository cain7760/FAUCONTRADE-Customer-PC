<script setup>
import { computed, inject, ref, watch } from 'vue'
import { ArrowDownBold, Hide, View } from '@element-plus/icons-vue'
import { money } from '../variantData'
import { tradingContextKey } from '../tradingContext'
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
const { assetAmountParts, realtimeAvailable, portfolioMarketValue, portfolioFloatingPnl, floatingPnlClass } = inject(tradingContextKey)
const assetSummaryMetrics = computed(() => [
  { key: 'available', label: '大账户实时可用', value: realtimeAvailable.value },
  { key: 'marketValue', label: '持仓市值', value: portfolioMarketValue.value },
  { key: 'floatingProfit', label: '浮动盈亏', value: portfolioFloatingPnl.value, tone: floatingPnlClass.value },
])
const assetsVisible = ref(true)
const assetsCollapsed = ref(false)
const displayAccountCash = computed(() => props.account.cash * 10000)
const tradingAccount = computed(() => ({ ...props.account, cash: displayAccountCash.value }))
const defaultCounterparties = [
  { label: '线下单', value: 'offline' },
  { label: '中金公司', value: '中金公司' },
  { label: '中信证券', value: '中信证券' },
  { label: '国泰君安', value: '国泰君安' },
]
const counterparties = computed(() => props.initialOrder?.counterparties || defaultCounterparties)

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
        <OrderTicket :key="`${symbol.code}-${initialOrder?.price}-${initialOrder?.quantity}`" :instruments="instruments" :accounts="accounts" :symbol="symbol" :account="tradingAccount" :quote="quote" :paused="paused" show-framework customer-order-readonly :ticket-context="ticketContext" :initial-order="initialOrder" :counterparties="counterparties" @account-select="emit('account-select', $event)" @select="selectSymbol" @order="emit('order', $event)" />
      </section>
      <section class="compact-assets ticket-assets is-portfolio-summary" :class="{ 'is-collapsed': assetsCollapsed }" aria-label="资产账户概要">
        <div class="asset-summary-heading"><span>资产账户概要</span><button type="button" class="asset-visibility" :aria-label="assetsVisible ? '隐藏资金数值' : '查看资金数值'" @click="assetsVisible = !assetsVisible"><el-icon><View v-if="assetsVisible" /><Hide v-else /></el-icon></button><button type="button" class="asset-collapse" :aria-label="assetsCollapsed ? '展开资产账户概要' : '收起资产账户概要'" @click="assetsCollapsed = !assetsCollapsed"><el-icon><ArrowDownBold /></el-icon></button></div>
        <div v-show="!assetsCollapsed" class="asset-summary-grid">
          <div v-for="metric in assetSummaryMetrics" :key="metric.key" class="asset-metric" :class="[metric.tone, { 'asset-available': metric.key === 'available' }]">
            <span>{{ metric.label }}</span>
            <el-tooltip v-if="assetsVisible && metric.value != null" placement="top" popper-class="asset-value-popper"><template #content><span class="asset-large-value" :class="metric.tone"><template v-for="part in assetAmountParts(metric.value)" :key="`${part.value}${part.unit}`"><b>{{ part.value }}</b><i v-if="part.unit">{{ part.unit }}</i></template></span></template><b class="asset-number" :class="metric.tone">{{ money(metric.value) }}</b></el-tooltip>
            <b v-else class="asset-number">{{ assetsVisible ? '--' : '••••••••' }}</b><small>CNY</small>
          </div>
        </div>
      </section>
    </section>
  </section>
</template>
