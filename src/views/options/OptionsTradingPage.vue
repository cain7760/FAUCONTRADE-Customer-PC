<script setup>
import { computed, defineAsyncComponent, inject, nextTick, reactive, ref, watch } from 'vue'
import BaseDialog from '../../components/BaseDialog.vue'
import DialogActions from '../../components/DialogActions.vue'
import { ElMessage } from 'element-plus'
import TradingTable from '../../components/trading/TradingTable.vue'
import SortHeader from '../../components/trading/SortHeader.vue'
import ColumnConfigPopover from '../../components/trading/ColumnConfigPopover.vue'
import OutlineActionButton from '../../components/OutlineActionButton.vue'
import TradingStatusBar from '../../components/trading/TradingStatusBar.vue'
import { useDialogShortcuts } from '../../composables/useDialogShortcuts'
import { tradingTimeErrorKey } from '../../composables/useTradingTime.js'
import OptionInquiryForm from './OptionInquiryForm.vue'
import OptionInquiryRecords from './OptionInquiryRecords.vue'
import ReinquiryAnnotation from './ReinquiryAnnotation.vue'
import OptionOrderTicket from './OptionOrderTicket.vue'
import OptionDirectionBadge from './OptionDirectionBadge.vue'
import OptionOrderConfirmation from './OptionOrderConfirmation.vue'
import { entryModeLabels, validateOptionOrder } from './optionOrderModel.js'
import OptionsRecordFilters from './OptionsRecordFilters.vue'
import { calculateOptionFee, inquiryStatusLabel, matchesInquiryFilter } from './inquiryModel.js'
import { useOptionsInquiry } from './useOptionsInquiry.js'
const BatchInquiryDialog = defineAsyncComponent(() => import('./BatchInquiryDialog.vue'))
const props = defineProps({ context: {type:Object,required:true}, paused: Boolean, downloadCsv: { type: Function, required: true } })
const { systemRunning, toggleSystemStatus, tradingTimeMode, setTradingTimeMode } = props.context
const tradingTimeError = inject(tradingTimeErrorKey, () => '')
// 标注模式只增加开发说明，交易操作与演示模式共用原有流程。
const displayMode = ref('demo')
const reinquiryAnnotationTarget = ref(null)
function ensureTradingTime() {
  const error = tradingTimeError()
  if (error) throw new Error(error)
}

const { items, openingOrders, optionAccount, submitInquiries, reinquire, placeOrder } = useOptionsInquiry()
const batchVisible = ref(false)
const reinquiryIds = ref([]), reinquiryVisible = ref(false), reinquirySubmitting = ref(false)
const activeTab = ref('inquiries'), selectedQuote = ref(null), selectedOrderId = ref(''), submitting = ref(false)
const orderSnapshot = ref(null)
const insufficientFundsSnapshot = ref(null)
const insufficientFundsVisible = computed(() => !!insufficientFundsSnapshot.value)
function hasInsufficientFunds(payload) {
  const feeInCny = calculateOptionFee(payload.principal, payload.quote.rate) * props.context.cnyExchangeRate(payload.item.currency)
  return Number(optionAccount.value.availableBalance) < feeInCny
}
function cancelInsufficientFunds() { insufficientFundsSnapshot.value = null }
async function continueWithTrader() {
  if (!insufficientFundsSnapshot.value || props.paused) return
  try {
    ensureTradingTime()
    const snapshot = insufficientFundsSnapshot.value
    cancelInsufficientFunds()
    // 下一轮再展示确认，避免同一次 Enter 同时触发最终提交。
    await nextTick()
    orderSnapshot.value = { ...snapshot, requiresTraderHandling: true }
  } catch (error) { ElMessage.warning(error.message) }
}
useDialogShortcuts(insufficientFundsVisible, {
  confirm: continueWithTrader, cancel: cancelInsufficientFunds,
  ignoreEnterFrom: 'button, a, [role="button"]',
})
const onlyBest = ref(false), latestFirst = ref(true), inquiryTable = ref(null)
const today = () => new Date().toLocaleDateString('sv-SE')
const emptyFilters = () => ({ symbol: '', dates: [today(), today()], direction: '', tenor: [], knockout: [], exercise: [], dividend: [], structure: [], status: '' })
const filters = reactive(emptyFilters()), applied = ref(emptyFilters())
const accountItems = items
const accountOrders = openingOrders
const tabs = computed(() => [{key:'inquiries',label:'全部询价',count:accountItems.value.length},{key:'opening',label:'开仓委托',count:accountOrders.value.length},{key:'positions',label:'期权持仓',count:0},{key:'closing',label:'平仓委托',count:0}])
const orderColumns = [['name','证券名称'],['code','证券代码'],['status','订单状态'],['direction','期权方向'],['structure','结构 / 期限'],['principal','名义本金(万)'],['rate','报价(%)'],['optionFee','期权费'],['currency','币种'],['entryMode','入场方式'],['knockout','敲出规则'],['exercise','最快行权日'],['dividend','分红规则'],['orderNo','订单编号'],['submittedAt','订单时间'],['remark','备注']]
const visibleOrderColumns = ref(orderColumns.map(([key]) => key)), orderSort = ref({key:'',direction:null})
const modeLabels = entryModeLabels
const number = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })
const money = value => Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dateTime = value => new Date(value).toLocaleString('zh-CN', {hour12:false})
function matches(item, isOrder = false) {
  const f = applied.value, text = f.symbol.trim().toLowerCase()
  if (text && !`${item.name}${item.code}`.toLowerCase().includes(text)) return false
  if (f.direction && f.direction !== item.direction) return false
  const date = new Date(isOrder ? item.submittedAt : item.createdAt).toLocaleDateString('sv-SE')
  if (f.dates?.length === 2 && (date < f.dates[0] || date > f.dates[1])) return false
  if (isOrder) return !f.status || f.status === item.status
  if (!matchesInquiryFilter(`${item.strike}${item.direction === 'call' ? 'C' : 'P'}`, f.structure)) return false
  if (!matchesInquiryFilter(item.tenor, f.tenor)) return false
  const matchingTerms = entry => ['knockout','exercise','dividend'].every(key => matchesInquiryFilter(entry[key], f[key]))
  return item.status === 'quoted' ? item.quotes.some(matchingTerms) : matchingTerms(item)
}
const filteredItems = computed(() => accountItems.value.filter(item => matches(item))
  .map(item => ({ ...item, quotes: item.quotes.filter(quote => (!onlyBest.value || quote.isBest) && ['knockout','exercise','dividend'].every(key => matchesInquiryFilter(quote[key], applied.value[key]))) }))
  .filter(item => item.status !== 'quoted' || item.quotes.length > 0))
const filteredOrders = computed(() => {
  const result = accountOrders.value.filter(item => matches(item,true))
  if (orderSort.value.direction) result.sort((a,b) => (Number(a[orderSort.value.key]) - Number(b[orderSort.value.key])) * (orderSort.value.direction === 'ascending' ? 1 : -1))
  return result
})
function applyFilters() { applied.value = Object.fromEntries(Object.entries(filters).map(([key,value]) => [key,Array.isArray(value) ? [...value] : value])) }
function resetFilters() { Object.assign(filters, emptyFilters()); applyFilters() }
function changeTab(tab) { activeTab.value = tab; resetFilters() }

function requestInquiry(drafts) {
  if (props.paused) return
  try {
    ensureTradingTime()
    const added = submitInquiries(drafts)
    const count = added.length
    selectedQuote.value = null; activeTab.value = 'inquiries'; resetFilters()
    inquiryTable.value?.revealInquiries(added.map(item => item.code))
    ElMessage.success(`已提交 ${count} 个询价组合`)
    return added
  } catch (error) { ElMessage.warning(error.message) }
}
async function requestBatchInquiry(drafts) {
  if (props.paused) throw new Error('系统已中断，暂不可提交')
  ensureTradingTime()
  const added = submitInquiries(drafts)
  selectedQuote.value = null; activeTab.value = 'inquiries'; resetFilters()
  inquiryTable.value?.revealInquiries(added.map(item => item.code))
  ElMessage.success(`已提交 ${added.length} 个询价组合`)
}
function requestReinquiry(ids) {
  if (props.paused || reinquirySubmitting.value) return
  reinquiryIds.value = [...ids]; reinquiryVisible.value = true
}
function closeReinquiry() { if (!reinquirySubmitting.value) reinquiryVisible.value = false }
useDialogShortcuts(reinquiryVisible, {
  confirm: confirmReinquiry,
  cancel: closeReinquiry,
  ignoreEnterFrom: 'button, a, [role="button"]',
})
async function confirmReinquiry() {
  if (reinquirySubmitting.value || props.paused) return
  reinquirySubmitting.value = true
  try {
    ensureTradingTime()
    const added = reinquire(reinquiryIds.value)
    selectedQuote.value = null
    latestFirst.value = true
    resetFilters()
    reinquiryVisible.value = false
    await nextTick()
    inquiryTable.value?.revealInquiries(added, true)
    ElMessage.success('已提交重询')
  } catch (error) { ElMessage.warning(error.message) }
  finally { reinquirySubmitting.value = false }
}
function chooseQuote(value) { selectedQuote.value = value }
function submitOrder(payload) {
  if (submitting.value || props.paused) return
  try {
    ensureTradingTime()
    const error = validateOptionOrder(payload)
    if (error) throw new Error(error)
    // 预览使用独立快照，后台报价更新或重询不能悄悄改变客户待确认的信息。
    const snapshot = JSON.parse(JSON.stringify(payload))
    if (hasInsufficientFunds(snapshot)) insufficientFundsSnapshot.value = snapshot
    else orderSnapshot.value = snapshot
  } catch (error) { ElMessage.warning(error.message) }
}
async function confirmOrder() {
  if (!orderSnapshot.value || submitting.value || props.paused) return
  submitting.value = true
  try {
    ensureTradingTime()
    if (!orderSnapshot.value.requiresTraderHandling && hasInsufficientFunds(orderSnapshot.value)) {
      insufficientFundsSnapshot.value = orderSnapshot.value
      orderSnapshot.value = null
      return
    }
    const order = placeOrder(orderSnapshot.value)
    orderSnapshot.value = null
    selectedOrderId.value = order.id
    selectedQuote.value = null
    activeTab.value = 'opening'; resetFilters()
    ElMessage.success('下单提交成功')
  } catch (error) { ElMessage.warning(error.message || '下单未完成') }
  finally { submitting.value = false }
}
function toggleSort(key) { orderSort.value = {key,direction:orderSort.value.key !== key || !orderSort.value.direction ? 'ascending' : orderSort.value.direction === 'ascending' ? 'descending' : null} }
function orderValue(row,key) {
  if (key === 'structure') return `${row.strike}${row.direction === 'call' ? 'C' : 'P'} ${row.tenor}`
  if (key === 'direction') return row.direction === 'call' ? '看涨' : '看跌'
  if (key === 'entryMode') return modeLabels[row.entryMode]
  if (key === 'submittedAt') return dateTime(row.submittedAt)
  if (key === 'optionFee' || key === 'rate') return money(row[key])
  if (key === 'principal') return number(row[key])
  return row[key] || '--'
}
function exportRecords() {
  if (activeTab.value === 'inquiries') {
    const data = filteredItems.value.flatMap(item => (item.status === 'quoted' ? item.quotes : [null]).map(quote => [item.name,item.code,`${item.strike}${item.direction === 'call' ? 'C' : 'P'}`,item.tenor,item.size,quote?.rate ?? '',quote?.capacity ?? '',quote?.knockout ?? item.knockout,quote?.exercise ?? item.exercise,quote?.dividend ?? item.dividend,item.currency,inquiryStatusLabel(item),dateTime(item.createdAt)]))
    props.downloadCsv('期权询价.csv',['证券名称','证券代码','结构','期限','询价规模(万)','报价(%)','参考名义本金(万)','敲出规则','最快行权日','分红规则','结算币种','询价状态','询价时间'],data)
  } else props.downloadCsv('期权开仓委托.csv',orderColumns.map(([,label]) => label),filteredOrders.value.map(row => orderColumns.map(([key]) => orderValue(row,key))))
}
</script>
<template>
  <div class="options-page">
  <div class="options-workspace" aria-label="期权交易工作区">
    <section class="positions-pane workspace-panel options-records">
      <header class="positions-tabs options-tabs"><button v-for="tab in tabs" :key="tab.key" :class="{active:activeTab === tab.key}" @click="changeTab(tab.key)">{{ tab.label }} <em v-if="tab.count">({{ tab.count }})</em></button></header>
      <template v-if="activeTab === 'inquiries' || activeTab === 'opening'">
        <OptionsRecordFilters :filters="filters" :records="activeTab === 'opening' ? accountOrders : accountItems" :orders="activeTab === 'opening'" @query="applyFilters" @reset="resetFilters" @refresh="applyFilters" @export="exportRecords"/>
        <div v-if="activeTab === 'inquiries'" class="options-inquiry-tools"><span ref="reinquiryAnnotationTarget" class="options-batch-reinquiry"><OutlineActionButton :disabled="paused || !inquiryTable?.selected?.length" @click="inquiryTable?.batchReinquire()">批量重询</OutlineActionButton></span><el-checkbox v-model="onlyBest">仅显示最优报价</el-checkbox><el-checkbox v-model="latestFirst">最新价自动置顶</el-checkbox></div>
        <OptionInquiryRecords v-if="activeTab === 'inquiries'" ref="inquiryTable" :items="filteredItems" :only-best="onlyBest" :latest-first="latestFirst" :paused="paused" @order="chooseQuote" @reinquire="requestReinquiry"/>
        <TradingTable v-else class="options-opening-table" :data="filteredOrders" height="100%" row-key="id" :row-class-name="({row}) => row.id === selectedOrderId ? 'current-option-order' : ''" empty-text="暂无开仓委托，请从报价结果中选择下单" @row-click="row => selectedOrderId = row.id">
          <el-table-column type="index" label="序号" width="44" align="center"/>
          <el-table-column v-for="[key,label] in visibleOrderColumns.map(key => orderColumns.find(([id]) => id === key)).filter(Boolean)" :key="key" :prop="key" :label="label" :min-width="({name:90,code:80,status:80,direction:76,structure:110,principal:114,rate:86,optionFee:120,currency:64,entryMode:86,knockout:98,exercise:96,dividend:120,orderNo:190,submittedAt:158,remark:150})[key]" :align="['principal','rate','optionFee'].includes(key) ? 'right' : 'left'" show-overflow-tooltip>
            <template #header><SortHeader v-if="['principal','rate','optionFee'].includes(key)" :label="label" numeric :direction="orderSort.key === key ? orderSort.direction : null" @sort="toggleSort(key)"/><span v-else>{{ label }}</span></template>
            <template #default="{row}"><span v-if="key === 'status'" class="order-status is-pending">{{ row.status }}</span><OptionDirectionBadge v-else-if="key === 'direction'" :direction="row.direction" /><span v-else>{{ orderValue(row,key) }}</span></template>
          </el-table-column>
          <el-table-column width="24" fixed="right" class-name="column-config-column"><template #header><ColumnConfigPopover v-model="visibleOrderColumns" :options="orderColumns" :defaults="orderColumns.map(([key]) => key)"/></template></el-table-column>
        </TradingTable>
      </template>
      <TradingTable v-else :data="[]" height="100%" :empty-text="activeTab === 'positions' ? '暂无期权持仓' : '暂无平仓委托'"><el-table-column label="证券名称"/><el-table-column label="结构 / 期限"/><el-table-column label="名义本金(万)"/><el-table-column label="币种"/></TradingTable>
      <footer class="options-table-footer">{{ activeTab === 'inquiries' ? `共 ${filteredItems.length} 个询价组合` : activeTab === 'opening' ? `共 ${filteredOrders.length} 条开仓委托` : '共 0 条' }}</footer>
    </section>
    <aside class="workspace-panel options-ticket-pane"><OptionOrderTicket v-if="selectedQuote" :key="selectedQuote.quote.id" :item="selectedQuote.item" :quote="selectedQuote.quote" :context="context" :account="optionAccount" :paused="paused" @back="selectedQuote = null" @submit="submitOrder"/><OptionInquiryForm v-else :context="context" :account="optionAccount" :paused="paused" @submit="requestInquiry" @batch="batchVisible=true"/></aside>
    <BatchInquiryDialog v-if="batchVisible" v-model="batchVisible" :paused="paused" :submit-batch="requestBatchInquiry"/>
    <BaseDialog :model-value="insufficientFundsVisible" title="可用资金不足" width="460px" align-center append-to-body class="variant-confirm option-funds-confirm" :close-on-click-modal="false" :close-on-press-escape="false" @update:model-value="value => !value && cancelInsufficientFunds()">
      <p>可用资金不足，是否需要转交易员处理继续下单（此操作下交易员可能会联系您进行其他资金安排）</p>
      <template #footer><DialogActions cancel-text="取消[Esc]" confirm-text="继续提交[Enter]" :confirm-disabled="paused" @cancel="cancelInsufficientFunds" @confirm="continueWithTrader" /></template>
    </BaseDialog>
    <OptionOrderConfirmation :snapshot="orderSnapshot" :loading="submitting" :paused="paused" @cancel="orderSnapshot = null" @confirm="confirmOrder" />
    <BaseDialog v-model="reinquiryVisible" title="确认重询" width="420px" align-center class="variant-confirm option-reinquiry-confirm" :close-on-click-modal="false" :close-on-press-escape="!reinquirySubmitting">
      <p>将按所选组参数发起新一轮询价，原询价将失效且不可下单，记录保留。是否继续？</p>
      <template #footer><DialogActions cancel-text="取消[Esc]" confirm-text="确认重询[Enter]" :loading="reinquirySubmitting" :confirm-disabled="paused" @cancel="closeReinquiry" @confirm="confirmReinquiry"/></template>
    </BaseDialog>
  </div>
  <TradingStatusBar :system-running="systemRunning" :trading-time-mode="tradingTimeMode" @toggle-system="toggleSystemStatus" @update:tradingTimeMode="setTradingTimeMode">
    <span class="options-display-mode" role="tablist" aria-label="期权展示模式">
      <button v-for="mode in [{key:'demo',label:'演示模式'},{key:'annotation',label:'标注模式'}]" :key="mode.key" type="button" role="tab" class="system-status-toggle" :aria-selected="displayMode === mode.key" @click="displayMode=mode.key">{{ mode.label }}</button>
    </span>
  </TradingStatusBar>
  <ReinquiryAnnotation v-if="displayMode === 'annotation' && activeTab === 'inquiries' && reinquiryAnnotationTarget" :target="reinquiryAnnotationTarget" />
  </div>
</template>
<style scoped>
.options-batch-reinquiry{display:inline-flex;align-items:center;flex:none}
.options-page{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0;overflow:hidden}
.options-display-mode{display:inline-flex;align-items:center;gap:8px;margin-left:12px}
.variants-app .options-display-mode .system-status-toggle{margin-left:0;padding:0 4px;background:transparent;color:#8e949e}
.variants-app .options-display-mode [aria-selected="true"]{color:#bb984a}
/* 期权金额、数量及报价沿用权益交易数值字体，字号与对齐保留各组件现状。 */
.options-workspace :deep(.inquiry-size-value),
.options-workspace :deep(.inquiry-capacity-column>.cell),
.options-workspace :deep(.option-quote-rate),
.options-workspace :deep(.inquiry-numeric-choices button),
.options-workspace :deep(.inquiry-numeric-choices .el-input__inner),
.options-workspace :deep(.option-numeric),
.options-workspace :deep(.option-quote-table td.is-right>.cell),
.options-workspace :deep(.option-principal-input .el-input__inner),
.options-workspace :deep(.option-order-estimates b),
.options-workspace :deep(.options-opening-table td.is-right>.cell){font-family:var(--ft-font-numeric);font-variant-numeric:tabular-nums}

/* 与权益交易 13px 数值保持一致，表头继续使用原文本字号。 */
.options-workspace :deep(.inquiry-size-value),
.options-workspace :deep(td.inquiry-capacity-column>.cell),
.options-workspace :deep(.options-opening-table td.is-right>.cell){font-size:13px;font-weight:500;}

.options-workspace :deep(.option-reinquire){height:22px;padding:0 10px;border:1px solid var(--el-color-primary);border-radius:3px;color:var(--el-color-primary);background:transparent;font-size:12px;font-weight:400;cursor:pointer}
.options-workspace :deep(.option-reinquire:disabled){opacity:.45;cursor:not-allowed}
.options-workspace :deep(.option-reinquire:hover:not(:disabled)){background:#bb984a18}

.options-workspace{display:flex;flex:1;gap:4px;padding:4px 4px 0;min-width:0;min-height:0;overflow:hidden}.options-records{display:flex;flex:1;min-width:0;min-height:0;flex-direction:column}.options-tabs{padding-left:12px!important;overflow:auto;scrollbar-width:none;flex:none}.options-tabs>button{flex:none}.options-tabs .global-account-filter{flex:0 0 178px;min-width:148px;margin-left:auto}.options-ticket-pane{flex:0 0 340px;min-width:0;min-height:0;overflow:hidden}.options-inquiry-tools{display:flex;align-items:center;gap:16px;min-height:42px;padding:6px 12px;border-bottom:1px solid var(--el-border-color-light);flex:none}.options-inquiry-tools .el-checkbox{height:24px;margin:0}.options-inquiry-tools :deep(.el-checkbox__label){font-size:12px}.options-inquiry-tools .el-checkbox:first-of-type{margin-left:auto}.options-inquiry-tools .el-button{height:28px;font-size:12px}.options-table-footer{height:32px;display:flex;align-items:center;padding:0 12px;border-top:1px solid var(--el-border-color-light);font-size:11px;color:var(--el-text-color-secondary);flex:none}.options-opening-table{flex:1;min-height:0}.options-opening-table :deep(.current-option-order td.el-table__cell){background:#353126}.options-opening-table :deep(.current-option-order td:first-child){box-shadow:inset 2px 0 var(--el-color-primary)}
@media(min-width:1600px){.options-ticket-pane{flex-basis:360px}}
@media(max-width:1000px){.options-ticket-pane{flex-basis:320px}.options-tabs .global-account-filter{flex-basis:148px}.options-inquiry-tools{gap:8px;padding:6px 12px}.options-inquiry-tools :deep(.el-checkbox__label){font-size:11px}.options-tabs>button{font-size:12px}}
</style>
