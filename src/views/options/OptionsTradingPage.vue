<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import TradingTable from '../../components/trading/TradingTable.vue'
import SortHeader from '../../components/trading/SortHeader.vue'
import ColumnConfigPopover from '../../components/trading/ColumnConfigPopover.vue'
import OptionInquiryForm from './OptionInquiryForm.vue'
import OptionInquiryRecords from './OptionInquiryRecords.vue'
import OptionOrderTicket from './OptionOrderTicket.vue'
import OptionsRecordFilters from './OptionsRecordFilters.vue'
import { useOptionsInquiry } from './useOptionsInquiry.js'
const props = defineProps({ context: {type:Object,required:true}, paused: Boolean, downloadCsv: { type: Function, required: true } })

const { items, openingOrders, submitInquiries, reinquire, placeOrder } = useOptionsInquiry()
const activeTab = ref('inquiries'), selectedQuote = ref(null), selectedOrderId = ref(''), submitting = ref(false)
const onlyBest = ref(false), latestFirst = ref(true), inquiryTable = ref(null)
const today = () => new Date().toLocaleDateString('sv-SE')
const emptyFilters = () => ({ symbol: '', dates: [today(), today()], direction: '', tenor: '', knockout: '', exercise: '', dividend: '', structure: '', status: '' })
const filters = reactive(emptyFilters()), applied = ref(emptyFilters())
const accountItems = items
const accountOrders = openingOrders
const tabs = computed(() => [{key:'inquiries',label:'全部询价',count:accountItems.value.length},{key:'opening',label:'开仓委托',count:accountOrders.value.length},{key:'positions',label:'期权持仓',count:0},{key:'closing',label:'平仓委托',count:0}])
const orderColumns = [['name','证券名称'],['code','证券代码'],['status','订单状态'],['direction','期权方向'],['structure','结构 / 期限'],['principal','名义本金(万)'],['rate','报价(%)'],['optionFee','期权费'],['currency','币种'],['entryMode','入场方式'],['knockout','敲出规则'],['exercise','最快行权日'],['dividend','分红规则'],['orderNo','订单编号'],['submittedAt','订单时间'],['remark','备注']]
const visibleOrderColumns = ref(orderColumns.map(([key]) => key)), orderSort = ref({key:'',direction:null})
const modeLabels = { limit:'限价', market:'市价', twap:'TWAP' }
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
  if (f.structure && f.structure !== `${item.strike}${item.direction === 'call' ? 'C' : 'P'}`) return false
  if (f.tenor && f.tenor !== item.tenor) return false
  const matchingTerms = entry => ['knockout','exercise','dividend'].every(key => !f[key] || entry[key] === f[key])
  return item.status === 'quoted' ? item.quotes.some(matchingTerms) : matchingTerms(item)
}
const filteredItems = computed(() => accountItems.value.filter(item => matches(item))
  .map(item => ({ ...item, quotes: item.quotes.filter(quote => (!onlyBest.value || quote.isBest) && ['knockout','exercise','dividend'].every(key => !applied.value[key] || quote[key] === applied.value[key])) }))
  .filter(item => item.status !== 'quoted' || item.quotes.length > 0))
const filteredOrders = computed(() => {
  const result = accountOrders.value.filter(item => matches(item,true))
  if (orderSort.value.direction) result.sort((a,b) => (Number(a[orderSort.value.key]) - Number(b[orderSort.value.key])) * (orderSort.value.direction === 'ascending' ? 1 : -1))
  return result
})
function applyFilters() { applied.value = { ...filters, dates: [...(filters.dates || [])] } }
function resetFilters() { Object.assign(filters, emptyFilters()); applyFilters() }
function changeTab(tab) { activeTab.value = tab; resetFilters() }

function requestInquiry(drafts) {
  if (props.paused) return
  try {
    const count = submitInquiries(drafts).length
    selectedQuote.value = null; activeTab.value = 'inquiries'; resetFilters()
    ElMessage.success(`已提交 ${count} 个询价组合`)
  } catch (error) { ElMessage.warning(error.message) }
}
function requestReinquiry(ids) {
  if (props.paused) return
  try { reinquire(ids); if (ids.includes(selectedQuote.value?.item.id)) selectedQuote.value = null; ElMessage.success('已提交重询') } catch (error) { ElMessage.warning(error.message) }
}
function chooseQuote(value) { selectedQuote.value = value }
async function submitOrder(payload) {
  if (submitting.value || props.paused) return
  submitting.value = true
  try {
    await ElMessageBox.confirm(`确认按 ${payload.quote.rate.toFixed(2)}% 的报价，提交 ${number(payload.principal)} 万 ${payload.item.currency} 名义本金的${payload.item.name}期权委托？`, '确认下单', { confirmButtonText:'确认下单',cancelButtonText:'返回',customClass:'variant-popper' })
    if (props.paused) throw new Error('系统已中断，暂不可提交')
    const order = placeOrder(payload)
    selectedOrderId.value = order.id
    selectedQuote.value = null
    activeTab.value = 'opening'; resetFilters()
    ElMessage.success('下单提交成功')
  } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.warning(error.message || '下单未完成') }
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
    const data = filteredItems.value.flatMap(item => (item.status === 'quoted' ? item.quotes : [null]).map(quote => [item.name,item.code,`${item.strike}${item.direction === 'call' ? 'C' : 'P'}`,item.tenor,item.size,quote?.rate ?? '',quote?.capacity ?? '',quote?.knockout ?? item.knockout,quote?.exercise ?? item.exercise,quote?.dividend ?? item.dividend,item.currency,item.status === 'pending' ? '询价中' : item.status === 'empty' ? '暂无报价' : '报价成功',dateTime(item.createdAt)]))
    props.downloadCsv('期权询价.csv',['证券名称','证券代码','结构','期限','询价规模(万)','报价(%)','参考名义本金(万)','敲出规则','最快行权日','分红规则','结算币种','询价状态','询价时间'],data)
  } else props.downloadCsv('期权开仓委托.csv',orderColumns.map(([,label]) => label),filteredOrders.value.map(row => orderColumns.map(([key]) => orderValue(row,key))))
}
</script>
<template>
  <div class="options-workspace" aria-label="期权交易工作区">
    <section class="positions-pane workspace-panel options-records">
      <header class="positions-tabs options-tabs"><button v-for="tab in tabs" :key="tab.key" :class="{active:activeTab === tab.key}" @click="changeTab(tab.key)">{{ tab.label }} <em v-if="tab.count">({{ tab.count }})</em></button></header>
      <template v-if="activeTab === 'inquiries' || activeTab === 'opening'">
        <OptionsRecordFilters :filters="filters" :records="accountItems" :orders="activeTab === 'opening'" @query="applyFilters" @reset="resetFilters" @refresh="applyFilters" @export="exportRecords"/>
        <div v-if="activeTab === 'inquiries'" class="options-inquiry-tools"><el-button class="option-reinquire" size="small" :disabled="paused || !inquiryTable?.selected?.length" @click="inquiryTable?.batchReinquire()">批量重询</el-button><el-checkbox v-model="onlyBest">仅显示最优报价</el-checkbox><el-checkbox v-model="latestFirst">最新价自动置顶</el-checkbox></div>
        <OptionInquiryRecords v-if="activeTab === 'inquiries'" ref="inquiryTable" :items="filteredItems" :only-best="onlyBest" :latest-first="latestFirst" :paused="paused" @order="chooseQuote" @reinquire="requestReinquiry"/>
        <TradingTable v-else class="options-opening-table" :data="filteredOrders" height="100%" row-key="id" :row-class-name="({row}) => row.id === selectedOrderId ? 'current-option-order' : ''" empty-text="暂无开仓委托，请从报价结果中选择下单" @row-click="row => selectedOrderId = row.id">
          <el-table-column type="index" label="序号" width="44" align="center"/>
          <el-table-column v-for="[key,label] in visibleOrderColumns.map(key => orderColumns.find(([id]) => id === key)).filter(Boolean)" :key="key" :prop="key" :label="label" :min-width="({name:90,code:80,status:80,direction:76,structure:110,principal:114,rate:86,optionFee:120,currency:64,entryMode:86,knockout:98,exercise:96,dividend:120,orderNo:190,submittedAt:158,remark:150})[key]" :align="['principal','rate','optionFee'].includes(key) ? 'right' : 'left'" show-overflow-tooltip>
            <template #header><SortHeader v-if="['principal','rate','optionFee'].includes(key)" :label="label" numeric :direction="orderSort.key === key ? orderSort.direction : null" @sort="toggleSort(key)"/><span v-else>{{ label }}</span></template>
            <template #default="{row}"><span v-if="key === 'status'" class="order-status is-pending">{{ row.status }}</span><span v-else :class="key === 'direction' ? row.direction === 'call' ? 'up' : 'down' : ''">{{ orderValue(row,key) }}</span></template>
          </el-table-column>
          <el-table-column width="24" fixed="right" class-name="column-config-column"><template #header><ColumnConfigPopover v-model="visibleOrderColumns" :options="orderColumns" :defaults="orderColumns.map(([key]) => key)"/></template></el-table-column>
        </TradingTable>
      </template>
      <TradingTable v-else :data="[]" height="100%" :empty-text="activeTab === 'positions' ? '暂无期权持仓' : '暂无平仓委托'"><el-table-column label="证券名称"/><el-table-column label="结构 / 期限"/><el-table-column label="名义本金(万)"/><el-table-column label="币种"/></TradingTable>
      <footer class="options-table-footer">{{ activeTab === 'inquiries' ? `共 ${filteredItems.length} 个询价组合` : activeTab === 'opening' ? `共 ${filteredOrders.length} 条开仓委托` : '共 0 条' }}</footer>
    </section>
    <aside class="workspace-panel options-ticket-pane"><OptionOrderTicket v-if="selectedQuote" :key="selectedQuote.quote.id" :item="selectedQuote.item" :quote="selectedQuote.quote" :context="context" :paused="paused" @back="selectedQuote = null" @submit="submitOrder"/><OptionInquiryForm v-else :paused="paused" @submit="requestInquiry"/></aside>
  </div>
</template>
<style scoped>
.options-workspace :deep(.option-reinquire){height:24px;padding:0 10px;border:1px solid var(--el-color-primary);border-radius:3px;color:var(--el-color-primary);background:transparent;font-size:12px;font-weight:400;cursor:pointer}
.options-workspace :deep(.option-reinquire:disabled){opacity:.45;cursor:not-allowed}
.options-workspace :deep(.option-reinquire:hover:not(:disabled)){background:#bb984a18}

.options-workspace{display:flex;flex:1;gap:4px;padding:4px 4px 22px;min-width:0;min-height:0;overflow:hidden}.options-records{display:flex;flex:1;min-width:0;min-height:0;flex-direction:column}.options-tabs{padding-left:12px!important;overflow:auto;scrollbar-width:none;flex:none}.options-tabs>button{flex:none}.options-tabs .global-account-filter{flex:0 0 178px;min-width:148px;margin-left:auto}.options-ticket-pane{flex:0 0 340px;min-width:0;min-height:0;overflow:hidden}.options-inquiry-tools{display:flex;align-items:center;gap:16px;min-height:42px;padding:6px 12px;border-bottom:1px solid var(--el-border-color-light);flex:none}.options-inquiry-tools .el-checkbox{height:24px;margin:0}.options-inquiry-tools :deep(.el-checkbox__label){font-size:12px}.options-inquiry-tools .el-checkbox:first-of-type{margin-left:auto}.options-inquiry-tools .el-button{height:28px;font-size:12px}.options-table-footer{height:32px;display:flex;align-items:center;padding:0 12px;border-top:1px solid var(--el-border-color-light);font-size:11px;color:var(--el-text-color-secondary);flex:none}.options-opening-table{flex:1;min-height:0}.options-opening-table :deep(.current-option-order td.el-table__cell){background:#353126}.options-opening-table :deep(.current-option-order td:first-child){box-shadow:inset 2px 0 var(--el-color-primary)}
@media(min-width:1600px){.options-ticket-pane{flex-basis:360px}}
@media(max-width:1000px){.options-ticket-pane{flex-basis:320px}.options-tabs .global-account-filter{flex-basis:148px}.options-inquiry-tools{gap:8px;padding:6px 12px}.options-inquiry-tools :deep(.el-checkbox__label){font-size:11px}.options-tabs>button{font-size:12px}}
</style>
