<script setup>
import TradingAssetSummary from '../../components/trading/TradingAssetSummary.vue'

const props = defineProps({ context: { type: Object, required: true }, account: { type: Object, required: true } })
const { assetsVisible, assetsCollapsed, assetAmountParts, toggleAssetsVisible } = props.context
const money = value => Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
</script>

<template>
  <TradingAssetSummary class="option-account-summary" :assets-visible="assetsVisible" :assets-collapsed="assetsCollapsed" :asset-amount-parts="assetAmountParts" @toggle-visibility="toggleAssetsVisible" @update:collapsed="assetsCollapsed = $event">
    <template #metrics>
      <div v-for="[key, label] in [['availableBalance', '可用余额（实时）'], ['accountBalance', '账户余额']]" :key="key" class="asset-metric">
        <span>{{ label }}</span>
        <el-tooltip v-if="assetsVisible" placement="top" popper-class="asset-value-popper">
          <template #content><span class="asset-large-value"><template v-for="part in assetAmountParts(account[key])" :key="`${part.value}${part.unit}`"><b>{{ part.value }}</b><i v-if="part.unit">{{ part.unit }}</i></template></span></template>
          <b class="asset-number" tabindex="0">{{ money(account[key]) }}</b>
        </el-tooltip>
        <b v-else class="asset-number">••••••••</b><small>CNY</small>
      </div>
    </template>
  </TradingAssetSummary>
</template>

<style scoped>
section.option-account-summary.ticket-assets :deep(.asset-summary-grid .asset-metric) {
  grid-template-columns: minmax(0, 1fr) max-content max-content !important;
  column-gap: 4px !important;
}
section.option-account-summary.ticket-assets :deep(.asset-summary-grid .asset-metric > small) {
  width: auto;
}
.option-account-summary .asset-number {
  cursor: help;
}
.option-account-summary .asset-number:hover,
.option-account-summary .asset-number:focus-visible {
  color: var(--el-color-primary) !important;
}
</style>
