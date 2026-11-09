<script setup>
import { computed, ref, watch } from 'vue'
import { ArrowDown, ArrowLeft, ArrowUp, TrendCharts } from '@element-plus/icons-vue'
import TradingAssetSummary from '../../components/trading/TradingAssetSummary.vue'
import TradingTable from '../../components/trading/TradingTable.vue'

const props = defineProps({
  item: { type: Object, required: true },
  quote: { type: Object, required: true },
  context: {type:Object,required:true},
  paused: Boolean,
})
const emit = defineEmits(['submit', 'back'])
const entryMode = ref('limit')
const principal = ref()
const remark = ref('')
const { assetsVisible, assetsCollapsed, realtimeAvailable, portfolioMarketValue, portfolioFloatingPnl, floatingPnlClass, assetAmountParts, toggleAssetsVisible } = props.context
const touched = ref(false)

watch(() => [props.item?.id, props.quote?.id], () => {
  principal.value = Number(props.item?.size) || undefined
  entryMode.value = 'limit'
  remark.value = ''
  touched.value = false
}, { immediate: true })

const number = value => Number.isFinite(Number(value))
  ? Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '--'
const money = value => value != null && Number.isFinite(Number(value))
  ? Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'
const currency = computed(() => props.item?.currency || 'CNY')
const accountCurrency = computed(() => 'CNY')

const isCall = computed(() => props.item?.direction !== 'put')
const displayCode = computed(() => {
  const code = props.item?.code || ''
  const market = props.item?.market || ''
  return ['SH', 'SZ', 'HK', 'US'].includes(market) && !code.endsWith(market) ? `${code}.${market}` : code
})
const tradingRules = computed(() => [
  props.quote?.knockout || props.item?.knockout,
  props.quote?.exercise || props.item?.exercise,
  props.quote?.dividend || props.item?.dividend,
].filter(Boolean).join(' / '))
const quoteRows = computed(() => [
  { id: 'latest', label: '最新', rate: props.quote?.rate, capacity: props.quote?.capacity },
  { id: 'previous', label: '上一次', rate: props.quote?.previousRate, capacity: props.quote?.previousCapacity },
])
const quoteTime = computed(() => {
  const value = props.quote?.quotedAt
  if (!value) return '--'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return String(value)
  return date.toLocaleString('sv-SE', { hour12: false })
})
const principalError = computed(() => {
  if (principal.value == null || !Number.isFinite(Number(principal.value)) || Number(principal.value) <= 0) return '请输入大于 0 的名义本金'
  if (Number(principal.value) > Number(props.quote?.capacity || 0)) return `名义本金不可超过反馈额度 ${number(props.quote?.capacity)} 万`
  return ''
})
const fee = computed(() => Number(principal.value) > 0 && Number.isFinite(Number(props.quote?.rate))
  ? Number(principal.value) * 10000 * Number(props.quote.rate) / 100 : null)
const canSubmit = computed(() => !props.paused && !principalError.value && props.quote?.rate != null)

function submitOrder() {
  touched.value = true
  if (!canSubmit.value) return
  emit('submit', {
    item: props.item,
    quote: props.quote,
    entryMode: entryMode.value,
    principal: Number(principal.value),
    remark: remark.value.trim(),
  })
}
</script>

<template>
  <section class="option-order-ticket" aria-label="期权交易下单">
    <header class="module-heading">
      <el-button text size="small" @click="emit('back')"><el-icon><ArrowLeft /></el-icon>返回询价</el-button>
      <span class="option-heading-divider" aria-hidden="true"></span>
      <h2>期权下单</h2>
    </header>

    <div class="option-ticket-scroll">
      <section class="option-contract">
        <div class="option-section-caption">期权描述</div>
        <div class="option-identity">
          <div><strong>{{ item.name }}</strong><span>{{ displayCode }}</span></div>
          <span class="option-direction" :class="isCall ? 'is-call' : 'is-put'"><el-icon><TrendCharts /></el-icon>{{ isCall ? '看涨' : '看跌' }}</span>
        </div>
        <dl class="option-terms">
          <div><dt>期限</dt><dd>{{ item.tenor }}</dd></div>
          <div><dt>规模</dt><dd class="option-numeric">{{ number(item.size) }} 万</dd></div>
          <div><dt>执行价</dt><dd class="option-numeric">{{ number(item.strike) }}%</dd></div>
          <div><dt>币种</dt><dd>{{ currency }}</dd></div>
          <div class="option-rules"><dt>交易规则</dt><dd>{{ tradingRules || '--' }}</dd></div>
        </dl>
      </section>

      <section class="option-quote-section">
        <div class="option-quote-heading"><span>报价信息</span><time>{{ quoteTime }}</time></div>
        <TradingTable :data="quoteRows" row-key="id" class="option-quote-table">
          <el-table-column prop="label" label="历史" width="66" />
          <el-table-column label="报价(%)" align="right" min-width="84"><template #default="{ row }">{{ money(row.rate) }}</template></el-table-column>
          <el-table-column label="反馈量(万)" align="right" min-width="100"><template #default="{ row }">{{ row.capacity == null ? '--' : number(row.capacity) }}</template></el-table-column>
        </TradingTable>
        <p class="option-trader-remark"><span>交易员备注：</span>{{ quote.traderRemark || '--' }}</p>
      </section>

      <form class="order-form option-order-form" novalidate @submit.prevent="submitOrder">
        <section>
          <div class="field-caption"><span>入场方式</span></div>
          <el-radio-group v-model="entryMode" class="execution-type" aria-label="入场方式" :disabled="paused">
            <el-radio-button value="limit">限价</el-radio-button>
            <el-radio-button value="market">市价</el-radio-button>
            <el-radio-button value="twap">TWAP</el-radio-button>
          </el-radio-group>
        </section>
        <section>
          <div class="field-caption"><label for="option-order-principal">名义本金({{ currency }})</label></div>
          <div class="option-principal-input" :class="{ 'is-error': principalError && (touched || principal > 0) }">
            <el-input-number id="option-order-principal" v-model="principal" :min="0" :precision="2" :step="100" :controls="false" :disabled="paused" placeholder="请输入名义本金" aria-describedby="option-principal-error" @blur="touched = true" />
            <span>万</span>
          </div>
          <p v-if="principalError && (touched || principal > 0)" id="option-principal-error" class="option-input-error" role="alert">{{ principalError }}</p>
        </section>
        <section>
          <div class="field-caption"><label for="option-order-remark">备注</label></div>
          <el-input id="option-order-remark" v-model="remark" type="textarea" :rows="2" maxlength="200" show-word-limit :disabled="paused" placeholder="请输入" />
        </section>
        <section class="option-submit-section submit-block">
          <p v-if="paused" class="option-input-error" role="status">当前系统已中断，暂不可提交订单</p>
          <div class="trade-buttons"><el-button native-type="submit" :class="isCall ? 'buy-action' : 'sell-action'" :disabled="!canSubmit">确认下单</el-button></div>
          <div class="option-order-estimates">
            <div><span>预计期权费({{ currency }})</span><b>{{ money(fee) }}</b></div>
            <div><span>账户可用({{ accountCurrency }})</span><b>{{ money(realtimeAvailable) }}</b></div>
          </div>
        </section>
      </form>
    </div>

    <TradingAssetSummary :assets-visible="assetsVisible" :assets-collapsed="assetsCollapsed" :realtime-available="realtimeAvailable" :portfolio-market-value="portfolioMarketValue" :portfolio-floating-pnl="portfolioFloatingPnl" :floating-pnl-class="floatingPnlClass" :asset-amount-parts="assetAmountParts" @toggle-visibility="toggleAssetsVisible" @update:collapsed="assetsCollapsed=$event" />
  </section>
</template>

<style scoped>
.option-order-ticket { display:flex; flex-direction:column; min-height:0; height:100%; color:var(--el-text-color-regular); }
.option-order-ticket .module-heading { height:39px; justify-content:flex-start; gap:12px; }
.option-heading-divider { width:1px; height:14px; background:var(--el-border-color); flex:none; }
.option-order-ticket .module-heading .el-button { padding:0; gap:4px; color:var(--el-text-color-secondary); font-size:12px; }
.option-ticket-scroll { flex:1; min-height:0; overflow:auto; scrollbar-width:thin; }
.option-contract, .option-quote-section { padding:14px 12px; border-bottom:1px solid var(--el-border-color-light); }
.option-section-caption, .option-terms dt, .option-trader-remark span { color:var(--el-text-color-secondary); }
.option-section-caption { margin-bottom:8px; }
.option-identity { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.option-identity>div { min-width:0; display:flex; align-items:baseline; flex-wrap:wrap; gap:4px 8px; }
.option-identity strong { color:var(--el-text-color-primary); font-size:16px; font-weight:600; }
.option-identity>div>span { color:var(--el-text-color-secondary); font-size:12px; }
.option-direction { display:inline-flex; align-items:center; gap:4px; padding:3px 6px; border-radius:2px; font-size:12px; flex-shrink:0; }
.option-direction.is-call { color:var(--ft-color-up); background:var(--ft-color-up-surface); }
.option-direction.is-put { color:var(--ft-color-down); background:var(--ft-color-down-surface); }
.option-terms { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px 8px; margin:16px 0 0; }
.option-terms dt { margin:0 0 5px; font-size:12px; }
.option-terms dd { margin:0; font-weight:500; line-height:1.6; overflow-wrap:anywhere; }
.option-rules { grid-column:span 2; }
.option-quote-heading { display:flex; flex-wrap:wrap; align-items:baseline; justify-content:space-between; gap:4px 8px; margin-bottom:10px; }
.option-quote-heading>span { color:var(--el-text-color-secondary); }
.option-quote-heading time { font-size:11px; color:var(--el-text-color-secondary); }
.option-quote-table { border:1px solid var(--el-border-color-light); border-radius:3px; }
.option-trader-remark { margin:10px 0 0; font-size:12px; line-height:1.6; overflow-wrap:anywhere; }
.option-order-form { padding:16px 12px; gap:18px; overflow:visible; }
.option-order-form .field-caption { margin-bottom:8px; font-size:12px; }
.option-principal-input { display:flex; align-items:center; border:1px solid var(--el-border-color); border-radius:4px; overflow:hidden; background:var(--el-fill-color-blank); }
.option-principal-input:focus-within { border-color:var(--el-color-primary); }
.option-principal-input.is-error { border-color:var(--el-color-danger); }
.option-principal-input>.el-input-number { flex:1; min-width:0; }
.option-principal-input>span { flex:0 0 36px; text-align:center; font-size:14px; }
.option-principal-input :deep(.el-input__wrapper) { box-shadow:none; background:transparent; }
.option-principal-input :deep(.el-input__inner) { font-size:16px; }
.option-input-error { margin:6px 0 0; font-size:12px; line-height:1.5; color:var(--el-color-danger); }
.option-submit-section>.el-button { width:100%; height:36px; margin-top:0; font-size:14px; }
.option-submit-section>.option-input-error { margin:0 0 8px; }
.option-order-estimates { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:12px; }
.option-order-estimates>div { display:flex; flex-direction:column; gap:5px; min-width:0; }
.option-order-estimates span { color:var(--el-text-color-secondary); font-size:11px; }
.option-order-estimates b { font-size:13px; font-weight:500; overflow-wrap:anywhere; }
</style>
