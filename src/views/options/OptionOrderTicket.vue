<script setup>
import { computed, ref, watch } from 'vue'
import { ArrowDown, ArrowLeft, TrendCharts } from '@element-plus/icons-vue'
import OptionAssetSummary from './OptionAssetSummary.vue'
import TradingTable from '../../components/trading/TradingTable.vue'
import { executionTimeBounds, executionTimeError, executionShortcut, isScheduledEntry, quoteHistory, validateOptionOrder } from './optionOrderModel.js'

const props = defineProps({
  item: { type: Object, required: true },
  quote: { type: Object, required: true },
  context: {type:Object,required:true},
  paused: Boolean,
  account: { type: Object, required: true },
})
const emit = defineEmits(['submit', 'back'])
const entryMode = ref('limit')
const principal = ref()
const limitPrice = ref()
const executionTime = ref(null)
const algorithmMode = ref('twap')
const shortcutError = ref('')
const remark = ref('')
const touched = ref(false)

watch(() => [props.item?.id, props.quote?.id], () => {
  principal.value = Number(props.item?.size) || undefined
  entryMode.value = 'limit'
  limitPrice.value = undefined
  executionTime.value = null
  algorithmMode.value = 'twap'
  shortcutError.value = ''
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
const quoteRows = computed(() => quoteHistory(props.quote))
const scheduled = computed(() => isScheduledEntry(entryMode.value))
const pickerNow = ref(new Date())
const pickerBounds = computed(() => executionTimeBounds(props.item, pickerNow.value))
function prepareTimePicker() {
  pickerNow.value = new Date()
  if (!executionTime.value) executionTime.value = executionShortcut(props.item, 10, pickerNow.value, 5)
}
function timeDisabled(hour, minute, role) {
  const value = hour * 60 + minute
  const { earliest, windows } = pickerBounds.value
  return value < earliest || !windows.some(([from, to]) => role === 'start'
    ? value >= from && value < to : value > from && value <= to)
}
const disabledMinutes = (hour, role) => Array.from({ length: 60 }, (_, minute) => minute).filter(minute => timeDisabled(hour, minute, role))
const disabledHours = role => Array.from({ length: 24 }, (_, hour) => hour).filter(hour => disabledMinutes(hour, role).length === 60)
const quoteTime = computed(() => {
  const value = props.quote?.quotedAt
  if (!value) return '--'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return String(value)
  return date.toLocaleString('sv-SE', { hour12: false })
})
const principalError = computed(() => {
  if (principal.value == null || !Number.isFinite(Number(principal.value)) || Number(principal.value) < 100) return '名义本金须为 100 万起'
  if (Number(principal.value) > Number(props.quote?.capacity || 0)) return `名义本金不可超过反馈额度 ${number(props.quote?.capacity)} 万`
  return ''
})
const fee = computed(() => Number(principal.value) > 0 && Number.isFinite(Number(props.quote?.rate))
  ? Number(principal.value) * 10000 * Number(props.quote.rate) / 100 : null)
const priceError = computed(() => entryMode.value === 'limit' && (!Number.isFinite(Number(limitPrice.value)) || Number(limitPrice.value) <= 0) ? '请输入大于 0 的下单价格' : '')
const timeError = computed(() => scheduled.value ? shortcutError.value || executionTimeError(props.item, executionTime.value, pickerNow.value) : '')
function orderPayload() {
  return { item: props.item, quote: props.quote, entryMode: entryMode.value,
    principal: Number(principal.value), limitPrice: entryMode.value === 'limit' ? Number(limitPrice.value) : null,
    executionTime: scheduled.value ? executionTime.value?.slice() : null, remark: remark.value.trim() }
}
const canSubmit = computed(() => !props.paused && props.quote?.rate != null)
function selectAlgorithm(mode) { algorithmMode.value = mode; entryMode.value = mode }
function selectShortcut(value) {
  pickerNow.value = new Date()
  const range = executionShortcut(props.item, value, pickerNow.value)
  shortcutError.value = range ? '' : value === 'morning' ? '当前无可用的上午交易时段，请选择其他时间' : '当前无可用交易时段，请选择执行时间'
  if (range) executionTime.value = range
  touched.value = true
}
function submitOrder() {
  pickerNow.value = new Date()
  touched.value = true
  if (!canSubmit.value || validateOptionOrder(orderPayload())) return
  emit('submit', orderPayload())
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
        <div class="option-identity">
          <div><strong>{{ item.name }}</strong><span>{{ displayCode }}</span></div>
          <span class="option-direction" :class="isCall ? 'is-call' : 'is-put'"><el-icon><TrendCharts /></el-icon>{{ isCall ? '看涨' : '看跌' }}</span>
        </div>
        <dl class="option-terms">
          <div><dt>期权结构</dt><dd>{{ item.strike }}{{ isCall ? 'C' : 'P' }}</dd></div>
          <div><dt>期限</dt><dd>{{ item.tenor }}</dd></div>
          <div><dt>规模(万)</dt><dd class="option-numeric">{{ number(item.size) }}</dd></div>
          <div><dt>执行价(%)</dt><dd class="option-numeric">{{ number(item.strike) }}</dd></div>
          <div><dt>结算币种</dt><dd>{{ currency }}</dd></div>
          <div><dt>参与率(%)</dt><dd class="option-numeric">{{ item.participation ?? 100 }}</dd></div>
          <div class="option-rules"><dt>交易规则</dt><dd>{{ tradingRules || '--' }}</dd></div>
        </dl>
      </section>

      <section class="option-quote-section">
        <div class="option-quote-heading"><span>报价信息</span><time>{{ quoteTime }}</time></div>
        <TradingTable :data="quoteRows" row-key="id" class="option-quote-table">
          <el-table-column v-if="quoteRows.length > 1" prop="label" label="历史" width="66" />
          <el-table-column label="报价(%)" align="left" min-width="84"><template #default="{ row }">{{ money(row.rate) }}</template></el-table-column>
          <el-table-column label="反馈量(万)" align="left" min-width="100"><template #default="{ row }">{{ row.capacity == null ? '--' : number(row.capacity) }}</template></el-table-column>
        </TradingTable>
        <p class="option-trader-remark"><span>交易员备注：</span>{{ quote.traderRemark || '--' }}</p>
      </section>

      <form class="order-form option-order-form" novalidate @submit.prevent="submitOrder">
        <section>
          <div class="field-caption"><span class="required">入场方式</span></div>
          <div class="option-entry-modes" role="group" aria-label="入场方式">
            <button v-for="mode in ['limit','market']" :key="mode" type="button" :class="{ active: entryMode === mode }" :disabled="paused" @click="entryMode = mode">{{ mode === 'limit' ? '限价' : '市价' }}</button>
            <el-dropdown trigger="click" popper-class="variant-popper option-algorithm-popper" :disabled="paused" @command="selectAlgorithm">
              <button type="button" :class="{ active: scheduled }" :disabled="paused" aria-label="选择 TWAP 或 VWAP">{{ algorithmMode.toUpperCase() }}<el-icon><ArrowDown /></el-icon></button>
              <template #dropdown><el-dropdown-menu><el-dropdown-item command="twap">TWAP</el-dropdown-item><el-dropdown-item command="vwap">VWAP</el-dropdown-item></el-dropdown-menu></template>
            </el-dropdown>
          </div>
        </section>
        <section class="option-order-amounts" :class="{ 'has-price': entryMode === 'limit' }">
          <div v-if="entryMode === 'limit'">
            <div class="field-caption"><label for="option-order-price" class="required">下单价格</label></div>
            <el-input-number id="option-order-price" v-model="limitPrice" :min="0" :controls="false" :disabled="paused" placeholder="请输入下单价格" :class="{ 'is-invalid': touched && priceError }" aria-describedby="option-price-error" />
            <p v-if="touched && priceError" id="option-price-error" class="option-input-error" role="alert">{{ priceError }}</p>
          </div>
          <div>
            <div class="field-caption"><label for="option-order-principal" class="required">名义本金({{ currency }})</label></div>
            <div class="option-principal-input" :class="{ 'is-error': principalError && touched }">
              <el-input-number id="option-order-principal" v-model="principal" :min="0" :precision="2" :step="100" :controls="false" :disabled="paused" placeholder="100万起" aria-describedby="option-principal-error" />
              <span>万</span>
            </div>
            <p v-if="principalError && touched" id="option-principal-error" class="option-input-error" role="alert">{{ principalError }}</p>
          </div>
        </section>
        <section v-if="scheduled">
          <div class="field-caption"><label class="required">选择时间</label><span class="option-time-hint">建议执行时长：大于10m</span></div>
          <el-time-picker v-model="executionTime" :disabled-hours="disabledHours" :disabled-minutes="disabledMinutes" @focus="prepareTimePicker" is-range format="HH:mm" value-format="HH:mm" range-separator="-" start-placeholder="开始时间" end-placeholder="结束时间" aria-label="执行时间范围" popper-class="variant-popper option-time-popper" :disabled="paused" @change="shortcutError = ''; touched = true" />
          <div class="option-time-shortcuts"><button v-for="[value,label] in [[10,'10m'],[20,'20m'],[60,'1h'],[120,'2h'],['morning','到中午收盘'],['close','到下午收盘']]" :key="value" type="button" :disabled="paused" @click="selectShortcut(value)">{{ label }}</button></div>
          <p v-if="touched && timeError" class="option-input-error" role="alert">{{ timeError }}</p>
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
            <div><span>账户可用({{ accountCurrency }})</span><b>{{ money(account.availableBalance) }}</b></div>
          </div>
        </section>
      </form>
    </div>

    <OptionAssetSummary :context="context" :account="account" />
  </section>
</template>

<style scoped>
.option-order-ticket { display:flex; flex-direction:column; min-height:0; height:100%; color:var(--el-text-color-regular); }
.option-order-ticket .module-heading { height:39px; justify-content:flex-start; gap:12px; }
.option-heading-divider { width:1px; height:14px; background:var(--el-border-color); flex:none; }
.option-order-ticket .module-heading .el-button { padding:0; gap:4px; color:var(--el-text-color-secondary); font-size:12px; }
.option-ticket-scroll { flex:1; min-height:0; overflow:auto; scrollbar-width:thin; }
.option-contract, .option-quote-section { padding:14px 12px; border-bottom:1px solid var(--el-border-color-light); }
.option-terms dt, .option-trader-remark span { color:var(--el-text-color-secondary); }
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
.option-rules { grid-column:1 / -1; }
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

.required::before{content:'*';color:var(--el-color-danger);margin-right:4px}
.option-entry-modes{display:flex;width:100%;border:1px solid var(--el-border-color);border-radius:4px;overflow:hidden;height:32px;background:var(--el-fill-color-light)}
.option-entry-modes>button,.option-entry-modes>.el-dropdown{flex:1;min-width:0}
.option-entry-modes button{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;height:100%;padding:0;border:0;background:transparent;color:var(--el-text-color-regular);font-size:12px;cursor:pointer}
.option-entry-modes>button+button,.option-entry-modes>.el-dropdown{border-left:1px solid var(--el-border-color)}
.option-entry-modes button.active{color:var(--el-color-primary);background:var(--ft-color-primary-surface,rgba(187,152,74,.12));box-shadow:inset 0 0 0 1px var(--el-color-primary)}
.option-entry-modes button:focus-visible{outline:1px solid var(--el-color-primary);outline-offset:-2px}
.option-order-amounts{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}
.option-order-amounts.has-price{grid-template-columns:repeat(2,minmax(0,1fr))}
.option-order-amounts .el-input-number{width:100%;min-width:0}
.option-order-amounts :deep(.el-input__inner){text-align:left;font-family:var(--ft-font-numeric, 'D-DIN Exp', 'DIN Alternate', 'Arial Narrow', sans-serif);font-size:14px}
.option-order-amounts :deep(.el-input__wrapper){padding:0 10px;min-height:32px;box-sizing:border-box}
.option-order-amounts :deep(.is-invalid .el-input__wrapper){box-shadow:0 0 0 1px var(--el-color-danger) inset}
.option-time-hint{color:var(--el-text-color-secondary);font-size:11px}
.option-order-form :deep(.el-date-editor.el-input__wrapper){width:100%;height:32px;box-sizing:border-box;background:var(--el-fill-color-blank);box-shadow:0 0 0 1px var(--el-border-color) inset}
.option-order-form :deep(.el-range-input){background:transparent;color:var(--el-text-color-regular);font-family:var(--ft-font-numeric, 'D-DIN Exp', 'DIN Alternate', 'Arial Narrow', sans-serif);font-size:12px}
.option-time-shortcuts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) repeat(2,minmax(0,1.8fr));gap:4px;margin-top:8px}
.option-time-shortcuts button{min-width:0;white-space:nowrap;height:26px;padding:0 3px;border:1px solid var(--el-border-color);border-radius:3px;background:var(--el-fill-color-light);color:var(--el-text-color-regular);font-size:11px;cursor:pointer}
.option-time-shortcuts button:hover{border-color:var(--el-color-primary);color:var(--el-color-primary)}
.option-numeric,.option-order-estimates b{font-family:var(--ft-font-numeric, 'D-DIN Exp', 'DIN Alternate', 'Arial Narrow', sans-serif);font-variant-numeric:tabular-nums}
:global(.option-algorithm-popper){--el-dropdown-menuItem-hover-fill:var(--el-fill-color-light);--el-dropdown-menuItem-hover-color:var(--el-color-primary)}
</style>
