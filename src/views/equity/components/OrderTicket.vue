<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, CircleClose, InfoFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { money, number } from '../variantData'
import { globalTradingConfig } from '../../../config/globalTradingConfig'
import { useDialogShortcuts } from '../../../composables/useDialogShortcuts'
import BaseDialog from '../../../components/BaseDialog.vue'
import { defaultAlgorithmForMarket } from '../orderAlgorithmDefaults'
const props = defineProps({ instruments: Array, accounts: Array, symbol: Object, account: Object, quote: Object, paused: Boolean, lockedContext: Boolean, customerOrderReadonly: Boolean, closeMode: Boolean, showFramework: Boolean, ticketContext: Object, initialOrder: Object, counterparties: { type: Array, default: () => [] } })
const emit = defineEmits(['select', 'account-select', 'order'])
const algorithmValues = ['POV', 'DMA', 'none']
const algorithmDisplay = value => value === 'none' ? '无需算法' : value
const initialAlgorithm = algorithmValues.includes(props.initialOrder?.algorithm)
  ? props.initialOrder.algorithm
  : algorithmValues.includes(props.ticketContext?.algorithm)
    ? props.ticketContext.algorithm
    : defaultAlgorithmForMarket(props.symbol?.market)
const initialExecutionType = props.initialOrder?.executionType || props.ticketContext?.executionType
const executionType = ref(initialExecutionType === 'highTouch' ? 'highTouch' : 'lowTouch'), algorithm = ref(initialAlgorithm), algorithmPopoverVisible = ref(false), orderType = ref(props.initialOrder?.type === 'market' ? 'market' : 'limit'), price = ref(props.initialOrder?.price), quantity = ref(props.initialOrder?.quantity), amount = ref(props.initialOrder?.amount), quantityMode = ref(props.initialOrder?.type === 'market' ? 'quantity' : props.initialOrder?.quantityMode || 'quantity'), fraction = ref(0), note = ref(props.initialOrder?.note || '')
const counterparty = ref(props.initialOrder?.counterparty || '')
const povHours = ref(props.initialOrder?.algorithmParams?.hours ?? 1)
const povMinutes = ref(props.initialOrder?.algorithmParams?.minutes ?? 0)
const povParticipation = ref(props.initialOrder?.algorithmParams?.participation ?? 10)
const draftAlgorithm = ref(algorithm.value)
const draftPovHours = ref(povHours.value)
const draftPovMinutes = ref(povMinutes.value)
const draftPovParticipation = ref(povParticipation.value)
const povHourOptions = Array.from({ length: 24 }, (_, hour) => hour)
const povMinuteOptions = Array.from({ length: 60 }, (_, minute) => minute)
const symbolMarket = ref('ALL'), search = ref(''), unit = ref(props.initialOrder?.unit || 'shares'), amountUnit = ref(props.initialOrder?.amountUnit || 'yuan'), confirming = ref(false), insufficientFunds = ref(false), quantityLimitError = ref(''), snapshot = ref(null)
const accountSearch = ref('')
const accountMenuVisible = ref(false)
const activeFrameworkAccountId = ref(props.account.id)
const frameworkId = ref(props.initialOrder?.frameworkId || props.account.frameworks?.[0]?.id || '')
const frameworkByAccount = ref({})
const instrumentSelect = ref(null), instrumentPopperWidth = ref(0)
const quantityInputKey = ref(0)
const displaySymbolCode = ref(props.initialOrder?.symbolCode || props.symbol.code)
const manualInstruments = ref([])
const selectedManualInstrument = ref(null)
const manualInstrumentVisible = ref(false)
const manualInstrumentName = ref('')
const manualInstrumentCode = ref('')
const manualInstrumentMarket = ref('A')
const manualInstrumentError = ref('')
const manualInstrumentMarketOptions = [
  { label: 'A股', value: 'A' },
  { label: '港股', value: 'HK' },
  { label: '美股', value: 'US' },
]
const recentCodesByExecution = ref({ lowTouch: [props.symbol.code, '600036', '300750', '600519'], highTouch: [] })
const isManualOrder = computed(() => executionType.value === 'highTouch')
const sourceOrderSide = computed(() => props.closeMode ? 'sell' : ['buy', 'sell'].includes(props.initialOrder?.sourceOrderSide) ? props.initialOrder.sourceOrderSide : null)
const fieldsLocked = computed(() => props.lockedContext || props.customerOrderReadonly)
const isCustomManualInstrument = computed(() => isManualOrder.value && !!selectedManualInstrument.value?.isManual)
const selectableInstruments = computed(() => [...props.instruments, ...(isManualOrder.value ? manualInstruments.value : [])])
const ticketSymbol = computed(() => selectedManualInstrument.value || props.symbol)
const lotSize = computed(() => {
  if (!displaySymbolCode.value || ticketSymbol.value?.isManual) return null
  const value = Number(ticketSymbol.value?.lotSize)
  return Number.isInteger(value) && value > 0 ? value : 100
})
const lotSizeLabel = computed(() => lotSize.value ? `${number(lotSize.value)}股/手` : '')
const symbols = computed(() => selectableInstruments.value.filter(p => {
  const matchesMarket = symbolMarket.value === 'ALL'
    ? (p.isManual || p.market !== 'HK')
    : p.isManual
      ? p.market === symbolMarket.value
      : symbolMarket.value === 'A' && ['SZ', 'SH'].includes(p.market)
  return matchesMarket && `${p.name}${p.code}`.toLowerCase().includes(search.value.toLowerCase())
}))
const recentSymbols = computed(() => (recentCodesByExecution.value[executionType.value] || []).map(code => selectableInstruments.value.find(item => item.code === code)).filter(item => item && (item.isManual || item.market !== 'HK')))
const filteredAccounts = computed(() => {
  const keyword = accountSearch.value.trim().toLowerCase()
  return keyword ? props.accounts.filter(item => `${item.id}${item.name}`.toLowerCase().includes(keyword)) : props.accounts
})
const accountFrameworks = computed(() => props.account.frameworks || [])
const selectedFramework = computed(() => accountFrameworks.value.find(item => item.id === frameworkId.value) || accountFrameworks.value[0] || null)
const filteredFrameworkAccounts = computed(() => {
  const keyword = accountSearch.value.trim().toLowerCase()
  return props.accounts.filter(account => account.frameworks?.length && (!keyword || `${account.id}${account.name}`.toLowerCase().includes(keyword)))
})
const activeFrameworkAccount = computed(() => filteredFrameworkAccounts.value.find(account => account.id === activeFrameworkAccountId.value) || filteredFrameworkAccounts.value[0] || null)
function accountOptionLabel(item) {
  const framework = props.showFramework && item.id === props.account.id ? selectedFramework.value : null
  return `${item.id}·${item.name}${framework ? `【${framework.name}】` : ''}`
}
const estimatedPrice = computed(() => orderType.value === 'limit' ? price.value : ticketSymbol.value?.price)
const displayedAmount = computed({
  get: () => amount.value == null ? undefined : amountUnit.value === 'wan' ? amount.value / 10000 : amount.value,
  set: value => { amount.value = (Number(value) || 0) * (amountUnit.value === 'wan' ? 10000 : 1) },
})
const priceInvalid = computed(() => orderType.value === 'limit' && price.value === 0)
const selectedCounterparty = computed(() => counterparty.value && counterparty.value !== 'offline' ? counterparty.value : null)
const counterpartyValid = computed(() => !props.customerOrderReadonly || !!counterparty.value)
const sourceAccountValue = computed(() => props.customerOrderReadonly ? props.initialOrder?.accountValue || props.account.id : props.account.id)
const sourceAccountLabel = computed(() => props.customerOrderReadonly ? props.initialOrder?.accountLabel || accountOptionLabel(props.account) : accountOptionLabel(props.account))
const sourceFrameworkName = computed(() => props.customerOrderReadonly ? props.initialOrder?.frameworkName || '' : selectedFramework.value?.name || '')
const hasInvalidPovParameters = (hours, minutes, participation) => !Number.isInteger(Number(hours)) || Number(hours) < 0 || Number(hours) > 23
  || !Number.isInteger(Number(minutes)) || Number(minutes) < 0 || Number(minutes) > 59
  || (Number(hours) === 0 && Number(minutes) === 0)
  || Number(participation) <= 0 || Number(participation) > 25
const povParameterError = computed(() => algorithm.value === 'POV' && hasInvalidPovParameters(povHours.value, povMinutes.value, povParticipation.value))
const draftPovParameterError = computed(() => draftAlgorithm.value === 'POV' && hasInvalidPovParameters(draftPovHours.value, draftPovMinutes.value, draftPovParticipation.value))
const algorithmValid = computed(() => !povParameterError.value)
const usesAmount = computed(() => orderType.value === 'limit' && quantityMode.value === 'amount')
const shares = computed(() => {
  if (!usesAmount.value) return (quantity.value || 0) * (unit.value === 'wan' ? 10000 : 1)
  const priceValue = Number(estimatedPrice.value)
  return priceValue > 0 && lotSize.value ? Math.floor((amount.value || 0) / priceValue / lotSize.value) * lotSize.value : 0
})
const lotInvalid = computed(() => !usesAmount.value && unit.value === 'shares' && lotSize.value && quantity.value > 0 && quantity.value % lotSize.value !== 0)
const isLargeAmount = computed(() => usesAmount.value && (amount.value || 0) > globalTradingConfig.largeOrderAmountCny)
const maxBuy = computed(() => selectedManualInstrument.value ? Number.MAX_SAFE_INTEGER : (estimatedPrice.value > 0 && lotSize.value ? Math.floor(props.account.cash / estimatedPrice.value / lotSize.value) * lotSize.value : 0))
const maxSell = computed(() => selectedManualInstrument.value ? Number.MAX_SAFE_INTEGER : Math.max(0, props.symbol.available))
const commonValid = computed(() => {
  const validQuantity = isCustomManualInstrument.value ? Number.isInteger(shares.value) : shares.value % (lotSize.value || 100) === 0
  return !!displaySymbolCode.value && shares.value > 0 && validQuantity && algorithmValid.value && counterpartyValid.value && (orderType.value === 'market' || price.value > 0)
})
const canBuy = computed(() => !props.paused && commonValid.value)
const canSell = computed(() => !props.paused && commonValid.value)
const confirmationTitle = computed(() => {
  if (!snapshot.value) return '确认订单'
  const action = snapshot.value.side === 'buy' ? '买入' : '卖出'
  const value = `${number(snapshot.value.quantity)} 股`
  return `确认${action} ${value}吗？`
})
function reset() { quantity.value = undefined; amount.value = undefined; fraction.value = 0; quantityLimitError.value = ''; confirming.value = false }
function resetOrder() { reset(); note.value = '' }
function rememberRecent(code) {
  const scope = executionType.value
  const scopedCodes = recentCodesByExecution.value[scope] || []
  recentCodesByExecution.value = { ...recentCodesByExecution.value, [scope]: [code, ...scopedCodes.filter(item => item !== code)].slice(0, 4) }
}
function chooseSymbol(code) {
  if (props.customerOrderReadonly) return
  const instrument = selectableInstruments.value.find(item => item.code === code)
  if (!code || (instrument?.market === 'HK' && !instrument.isManual)) return
  displaySymbolCode.value = code
  rememberRecent(code)
  resetOrder()
  algorithm.value = defaultAlgorithmForMarket(instrument.market)
  if (instrument.isManual) { selectedManualInstrument.value = instrument; quantityMode.value = 'quantity'; unit.value = 'shares'; price.value = undefined; return }
  selectedManualInstrument.value = null
  price.value = instrument.price
  emit('select', code)
}
function chooseRecentSymbol(code) { chooseSymbol(code); nextTick(() => instrumentSelect.value?.blur?.()) }
function removeRecentSymbol(code) {
  const scope = executionType.value
  recentCodesByExecution.value = { ...recentCodesByExecution.value, [scope]: (recentCodesByExecution.value[scope] || []).filter(item => item !== code) }
}
function clearInstrument() { displaySymbolCode.value = null; selectedManualInstrument.value = null; emit('select', null); search.value = ''; price.value = null; note.value = ''; fraction.value = 0; confirming.value = false; nextTick(() => { quantity.value = undefined; amount.value = undefined; quantityInputKey.value += 1 }) }
function handleInstrumentVisible(visible) { if (visible) { search.value = ''; nextTick(() => { instrumentPopperWidth.value = Math.round(instrumentSelect.value?.$el?.getBoundingClientRect().width || 0) }) } }
function openManualInstrument() { if (!isManualOrder.value) return; manualInstrumentName.value = search.value.trim(); manualInstrumentCode.value = ''; manualInstrumentMarket.value = 'A'; manualInstrumentError.value = ''; manualInstrumentVisible.value = true }
function saveManualInstrument() {
  const name = manualInstrumentName.value.trim()
  const code = manualInstrumentCode.value.trim()
  if (!name || !code) { manualInstrumentError.value = '请填写标的名称和代码'; return }
  const instrument = { name, code, market: manualInstrumentMarket.value, price: null, available: 0, isManual: true }
  manualInstruments.value = [instrument, ...manualInstruments.value.filter(item => item.code !== code)]
  selectedManualInstrument.value = instrument
  displaySymbolCode.value = code
  algorithm.value = defaultAlgorithmForMarket(instrument.market)
  search.value = ''
  price.value = undefined
  rememberRecent(code)
  resetOrder()
  manualInstrumentVisible.value = false
}
function handleAccountVisible(visible) { accountMenuVisible.value = visible; if (!visible) accountSearch.value = '' }
function openAccountFrameworkMenu() {
  if (props.customerOrderReadonly) return
  activeFrameworkAccountId.value = props.account.id
  handleAccountVisible(true)
}
function selectFrameworkForAccount(account, preferredId) {
  const frameworks = account?.frameworks || []
  return frameworks.find(item => item.id === preferredId)
    || frameworks.find(item => item.id === frameworkByAccount.value[account?.id])
    || frameworks[0]
    || null
}
function applyAccountFramework(account, preferredId) {
  frameworkId.value = selectFrameworkForAccount(account, preferredId)?.id || ''
}
function handleAccountFrameworkChange(accountId, nextFrameworkId) {
  if (props.customerOrderReadonly) return
  const nextAccount = props.accounts.find(item => item.id === accountId)
  const nextFramework = nextAccount?.frameworks?.find(item => item.id === nextFrameworkId)
  if (!nextAccount || !nextFramework) return
  frameworkByAccount.value = { ...frameworkByAccount.value, [accountId]: nextFramework.id }
  frameworkId.value = nextFramework.id
  if (accountId !== props.account.id) emit('account-select', accountId)
}
function openAlgorithmConfig() {
  if (props.customerOrderReadonly) return
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
let applyingInitialOrder = false
watch(() => props.symbol.code, code => { if (selectedManualInstrument.value || props.customerOrderReadonly) return; displaySymbolCode.value = code; price.value = props.symbol.price; algorithm.value = defaultAlgorithmForMarket(props.symbol.market); resetOrder() })
watch(() => props.initialOrder, value => {
  if (!value) return
  applyingInitialOrder = true
  displaySymbolCode.value = value.symbolCode || props.symbol.code
  selectedManualInstrument.value = null
  executionType.value = value.executionType === 'highTouch' ? 'highTouch' : 'lowTouch'
  algorithm.value = algorithmValues.includes(value.algorithm) ? value.algorithm : defaultAlgorithmForMarket(props.symbol.market)
  orderType.value = value.type === 'market' ? 'market' : 'limit'
  price.value = value.price
  quantity.value = value.quantity
  amount.value = value.amount
  quantityMode.value = value.type === 'market' ? 'quantity' : value.quantityMode || 'quantity'
  unit.value = value.unit || 'shares'
  amountUnit.value = value.amountUnit || 'yuan'
  note.value = value.note || ''
  counterparty.value = value.counterparty || ''
  applyAccountFramework(props.account, value.frameworkId)
  povHours.value = value.algorithmParams?.hours ?? 1
  povMinutes.value = value.algorithmParams?.minutes ?? 0
  povParticipation.value = value.algorithmParams?.participation ?? 10
  nextTick(() => { applyingInitialOrder = false })
}, { deep: true })
watch(() => props.account.id, () => { if (props.customerOrderReadonly) return; applyAccountFramework(props.account); resetOrder() })
watch(orderType, type => { if (type === 'market') quantityMode.value = 'quantity' }, { immediate: true })
watch([orderType, unit, quantityMode], () => { if (!props.customerOrderReadonly && !applyingInitialOrder) reset() })
watch(executionType, () => { if (props.customerOrderReadonly) return; selectedManualInstrument.value = null; displaySymbolCode.value = props.symbol.code; search.value = ''; price.value = props.symbol.price; resetOrder() })
watch(() => props.quote, value => { if (!props.customerOrderReadonly && value && !selectedManualInstrument.value) { orderType.value = 'limit'; price.value = value.price } })
watch(price, () => { if (!props.closeMode) fraction.value = 0; confirming.value = false })
watch([quantity, amount, quantityMode, unit, amountUnit], () => { quantityLimitError.value = '' })
watch([shares, maxSell], ([value, maximum]) => {
  if (props.closeMode) fraction.value = maximum > 0 ? Math.min(100, Math.max(0, value / maximum * 100)) : 0
}, { immediate: true })
function size(value) { if (props.customerOrderReadonly) return; const q = Math.floor((props.closeMode ? maxSell.value : maxBuy.value) * value / 100 / (lotSize.value || 100)) * (lotSize.value || 100); if (usesAmount.value) amount.value = Number((q * estimatedPrice.value).toFixed(2)); else quantity.value = unit.value === 'wan' ? Math.floor(q / 10000) : q }
function stepPrice(direction) { if (props.customerOrderReadonly) return; const current = Number(price.value) || 0; price.value = Number((Math.max(0, current + direction * .01)).toFixed(2)) }
function preview(side) {
  if (props.paused) return
  if (sourceOrderSide.value && side !== sourceOrderSide.value) return
  if (!(side === 'buy' ? canBuy.value : canSell.value)) return
  const maximum = side === 'buy' ? maxBuy.value : maxSell.value
  if (!props.initialOrder?.skipQuantityLimit && !isCustomManualInstrument.value && shares.value > maximum) {
    quantityLimitError.value = `当前订单数量超出最大可${side === 'buy' ? '买' : '卖'}，请重新输入。`
    return
  }
  if (!isCustomManualInstrument.value && side === 'buy' && estimatedPrice.value * shares.value > props.account.cash) { insufficientFunds.value = true; return }
  const id = Date.now()
  snapshot.value = { id, orderNo: `WT${id}`, account: sourceAccountValue.value, accountLabel: sourceAccountLabel.value, ...(props.showFramework && sourceFrameworkName.value ? { frameworkId: frameworkId.value, framework: sourceFrameworkName.value } : {}), ...(props.counterparties.length ? { counterparty: selectedCounterparty.value, executionChannel: selectedCounterparty.value ? 'counterparty' : 'offline' } : {}), ...(algorithm.value === 'POV' ? { algorithmParams: { hours: Number(povHours.value), minutes: Number(povMinutes.value), participation: Number(povParticipation.value) } } : {}), code: ticketSymbol.value.code, name: ticketSymbol.value.name, executionType: executionType.value, algorithm: algorithm.value, note: note.value.trim(), type: orderType.value, side, quantity: shares.value, inputAmount: usesAmount.value ? amount.value : null, price: orderType.value === 'limit' ? price.value : null, estimate: estimatedPrice.value * shares.value, status: '待报', runStatus: '正常', openClose: props.initialOrder?.openClose || (props.closeMode ? '平' : '开'), attribute: `${orderType.value === 'limit' ? '限价' : '市价'}·${usesAmount.value ? '金额' : '数量'}`, orderValueNumber: usesAmount.value ? amount.value : shares.value, orderValue: usesAmount.value ? `${money(amount.value || 0)} CNY` : `${number(shares.value)} 股`, filledQuantity: 0, filledPrice: null }
  confirming.value = true
}
function submit() { if (props.paused) { confirming.value = false; return }; emit('order', { ...snapshot.value }); ElMessage.success('操作成功。'); resetOrder() }
useDialogShortcuts(confirming, { confirm: submit, cancel: () => { confirming.value = false } })
useDialogShortcuts(manualInstrumentVisible, { confirm: saveManualInstrument, cancel: () => { manualInstrumentVisible.value = false }, confirmOnInput: true })
</script>

<template>
  <div class="order-form" :class="{ 'is-paused': paused, 'is-manual': executionType === 'highTouch', 'is-customer-order-readonly': customerOrderReadonly }" :inert="paused ? '' : undefined" :aria-disabled="paused">
    <p v-if="paused" class="order-paused-notice">当前时间系统暂停交易，暂不支持下单</p>
    <section class="order-context-block">
      <div class="execution-type-block">
        <el-radio-group v-model="executionType" class="execution-type" :disabled="customerOrderReadonly" :aria-readonly="customerOrderReadonly"><el-radio-button label="lowTouch">系统单</el-radio-button><el-radio-button label="highTouch">手工单</el-radio-button></el-radio-group>
      </div>
      <div v-if="showFramework" class="order-account-block order-account-framework-block" :class="{ 'is-account-menu-open': accountMenuVisible }">
        <div class="field-caption"><span>下单账户</span></div>
        <el-popover v-model:visible="accountMenuVisible" trigger="click" :disabled="customerOrderReadonly" :teleported="false" placement="bottom-end" :width="296" :offset="4" popper-class="variant-popper trs-order-account-popper trs-account-framework-popper" @show="openAccountFrameworkMenu" @hide="handleAccountVisible(false)"><template #reference><button type="button" class="order-account-framework-trigger" :disabled="customerOrderReadonly" :aria-expanded="accountMenuVisible" :aria-label="customerOrderReadonly ? `下单账户 ${sourceAccountLabel}` : '选择下单账户和客户框架'"><span>{{ sourceAccountLabel }}<template v-if="sourceFrameworkName">【{{ sourceFrameworkName }}】</template></span><svg v-if="!customerOrderReadonly" class="algorithm-chevron" :class="{ 'is-open': accountMenuVisible }" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg></button></template><div class="account-framework-menu"><div class="account-dropdown-search" @click.stop><el-input v-model="accountSearch" placeholder="搜索下单账户" clearable /></div><div class="account-framework-columns"><div class="account-framework-column"><button v-for="item in filteredFrameworkAccounts" :key="item.id" type="button" :class="{ active: item.id === activeFrameworkAccount?.id }" @click="activeFrameworkAccountId = item.id"><span>{{ item.id }}·{{ item.name }}</span><b>›</b></button><p v-if="!filteredFrameworkAccounts.length">未找到下单账户</p></div><div class="account-framework-column is-framework"><div class="account-framework-column-title">客户框架</div><template v-if="activeFrameworkAccount"><button v-for="framework in activeFrameworkAccount.frameworks" :key="framework.id" type="button" :class="{ active: activeFrameworkAccount.id === account.id && framework.id === frameworkId }" @click="handleAccountFrameworkChange(activeFrameworkAccount.id, framework.id); accountMenuVisible = false"><span>{{ framework.name }}</span><b v-if="activeFrameworkAccount.id === account.id && framework.id === frameworkId">✓</b></button></template><p v-else>请选择下单账户</p></div></div></div></el-popover>
      </div>
      <div v-else class="order-account-block" :class="{ 'is-account-menu-open': accountMenuVisible }">
        <div class="field-caption"><span>下单账户</span></div>
        <el-select :disabled="fieldsLocked" :model-value="account.id" @visible-change="handleAccountVisible" @update:model-value="id => emit('account-select', id)" :aria-label="`下单账户 ${accountOptionLabel(account)}`" :teleported="!showFramework" :placement="showFramework ? 'bottom-end' : 'bottom-start'" :fallback-placements="showFramework ? ['bottom-end'] : ['bottom-start', 'top-start', 'right', 'left']" :fit-input-width="showFramework" :offset="showFramework ? 4 : 12" :popper-class="showFramework ? 'variant-popper order-account-popper trs-order-account-popper' : 'variant-popper order-account-popper'"><template #header><div class="account-dropdown-search" @click.stop><el-input v-model="accountSearch" placeholder="搜索下单账户" clearable /></div></template><el-option v-for="item in filteredAccounts" :key="item.id" :label="accountOptionLabel(item)" :value="item.id" /></el-select>
      </div>
      <div v-if="counterparties.length" class="order-account-block order-counterparty-block">
        <div class="field-caption"><span>上手方</span></div>
        <el-select v-model="counterparty" clearable placeholder="请选择" aria-label="上手方" popper-class="variant-popper"><el-option v-for="item in counterparties" :key="typeof item === 'string' ? item : item.value" :label="typeof item === 'string' ? item : item.label" :value="typeof item === 'string' ? item : item.value" /></el-select>
      </div>
    </section>
    <section class="order-symbol-block">
      <div class="field-caption"><span>下单标的</span><div class="symbol-tags"><span>CNY</span><el-tooltip content="40% IA"><span>40% IA</span></el-tooltip></div></div>
      <div class="instrument-select-wrap"><el-select :disabled="fieldsLocked" ref="instrumentSelect" v-model="displaySymbolCode" filterable :filter-method="v => search = v" @visible-change="handleInstrumentVisible" @change="chooseSymbol" :popper-style="instrumentPopperWidth ? { width: `${instrumentPopperWidth}px`, minWidth: `${instrumentPopperWidth}px` } : undefined" placeholder="搜索标的名称 / 代码" aria-label="下单标的" class="instrument-select" popper-class="variant-popper instrument-popper" placement="bottom-start" :offset="4">
        <template #header><div class="instrument-select-header"><div v-if="recentSymbols.length" class="instrument-history"><span>搜索历史</span><div><div v-for="item in recentSymbols" :key="item.code" class="instrument-history-chip"><button type="button" class="instrument-history-select" @mousedown.prevent @click.stop="chooseRecentSymbol(item.code)">{{ item.name }}（{{ item.code }}）</button><button type="button" class="instrument-history-remove" :aria-label="`删除历史标的 ${item.name}`" title="删除" @mousedown.prevent @click.stop="removeRecentSymbol(item.code)">×</button></div></div></div><div class="instrument-market-tabs"><button v-for="item in [['ALL','全部'],['A','A股'],['HK','港股'],['US','美股']]" :key="item[0]" type="button" :class="{ active: symbolMarket === item[0] }" @mousedown.prevent @click="symbolMarket = item[0]">{{ item[1] }}</button></div></div></template>
        <template #empty><div class="instrument-empty"><template v-if="isManualOrder && search.trim()"><b>未找到匹配标的</b><span>该标的不在系统标的库中，可手动新增后用于本次手工单。</span><el-button type="primary" @mousedown.prevent @click.stop="openManualInstrument">手动新增标的</el-button></template><span v-else>暂无匹配标的</span></div></template>
        <el-option v-for="s in symbols" :key="s.code" :label="`${s.name}（${s.code}）`" :value="s.code"><span class="instrument-option-label">{{ s.name }}（{{ s.code }}）</span></el-option>
      </el-select><button v-if="displaySymbolCode && !fieldsLocked" type="button" class="symbol-clear-button" aria-label="清空下单标的" title="清空下单标的" @click.stop="clearInstrument"><el-icon><CircleClose /></el-icon></button></div>
    </section>
    <section class="price-block">
      <template v-if="orderType === 'limit'"><div class="field-caption"><label for="variant-price">订单价格</label><el-radio-group v-model="orderType" class="quantity-mode order-price-type" size="small" :disabled="customerOrderReadonly" :aria-readonly="customerOrderReadonly"><el-radio-button label="limit">限价</el-radio-button><el-radio-button label="market">市价</el-radio-button></el-radio-group></div><div class="price-input-row" :class="{ 'is-error': priceInvalid }"><el-input-number id="variant-price" v-model="price" placeholder="请输入" :disabled="customerOrderReadonly" :step=".01" :precision="2" :controls="false" /><span class="price-stepper"><button type="button" :disabled="customerOrderReadonly" aria-label="增加订单价格" @click="stepPrice(1)"><el-icon><ArrowUp /></el-icon></button><button type="button" :disabled="customerOrderReadonly" aria-label="减少订单价格" @click="stepPrice(-1)"><el-icon><ArrowDown /></el-icon></button></span></div><span v-if="priceInvalid" class="price-error">订单价格不可为0，请重试</span></template>
      <template v-else><div class="field-caption"><span>订单价格</span><el-radio-group v-model="orderType" class="quantity-mode order-price-type" size="small" :disabled="customerOrderReadonly" :aria-readonly="customerOrderReadonly"><el-radio-button label="limit">限价</el-radio-button><el-radio-button label="market">市价</el-radio-button></el-radio-group></div><div class="market-price-note"><b>以市场价格成交</b></div></template>
    </section>
    <section class="quantity-block">
      <div class="field-caption"><label :for="usesAmount ? 'variant-amount' : 'variant-quantity'">{{ usesAmount ? '订单金额' : '订单数量' }}</label><div class="quantity-caption-actions"><span v-if="!usesAmount && lotSizeLabel" class="order-lot-tag">{{ lotSizeLabel }}</span><el-radio-group v-model="quantityMode" class="quantity-mode" size="small" :disabled="customerOrderReadonly" :aria-readonly="customerOrderReadonly"><el-radio-button label="quantity">数量</el-radio-button><el-radio-button v-if="orderType === 'limit'" label="amount">金额</el-radio-button></el-radio-group></div></div>
      <template v-if="!usesAmount"><div class="quantity-input-row" :class="{ 'is-error': lotInvalid || quantityLimitError }"><el-input-number :key="quantityInputKey" id="variant-quantity" v-model="quantity" placeholder="请输入" :disabled="customerOrderReadonly" :min="isCustomManualInstrument ? 1 : undefined" :step="unit === 'wan' ? 1 : (isCustomManualInstrument ? 1 : (lotSize || 100))" :precision="0" :controls="false" /><el-select v-model="unit" :disabled="customerOrderReadonly" aria-label="数量单位" popper-class="variant-popper quantity-unit-popper" placement="bottom-end" :offset="4" :class="{ 'is-wan-unit': unit === 'wan' }"><el-option label="股" value="shares" /><el-option label="万股" value="wan" /></el-select></div><span v-if="lotInvalid || quantityLimitError" class="lot-error" role="alert">{{ lotInvalid ? '订单数量须为整手，请重新输入' : quantityLimitError }}</span></template>
      <div v-else class="quantity-input-row amount-input-row" :class="{ 'is-error': quantityLimitError, 'is-large-amount': isLargeAmount }"><el-input-number :key="quantityInputKey" id="variant-amount" v-model="displayedAmount" placeholder="请输入" :disabled="customerOrderReadonly" :step="amountUnit === 'wan' ? 1 : 1000" :precision="2" :controls="false" /><el-select v-model="amountUnit" :disabled="customerOrderReadonly" aria-label="金额单位" popper-class="variant-popper quantity-unit-popper" placement="bottom-end" :offset="4" :class="{ 'is-wan-unit': amountUnit === 'wan' }"><el-option label="元" value="yuan" /><el-option label="万元" value="wan" /></el-select></div><span v-if="usesAmount && quantityLimitError" class="lot-error" role="alert">{{ quantityLimitError }}</span>
      <section class="order-account-block order-algorithm-block"><div class="field-caption"><span>算法</span></div><el-popover v-model:visible="algorithmPopoverVisible" trigger="click" :disabled="customerOrderReadonly" placement="bottom-end" :width="264" popper-class="variant-popper algorithm-popper" @show="openAlgorithmConfig"><template #reference><button type="button" class="algorithm-trigger" :disabled="customerOrderReadonly" :aria-label="customerOrderReadonly ? `执行算法：${algorithmDisplay(algorithm)}` : `执行算法：${algorithmDisplay(algorithm)}，点击配置`"><span>{{ algorithmDisplay(algorithm) }}</span><svg v-if="!customerOrderReadonly" class="algorithm-chevron" :class="{ 'is-open': algorithmPopoverVisible }" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg></button></template><div class="execution-algorithm-menu"><span>执行算法</span><el-radio-group v-model="draftAlgorithm" aria-label="执行算法"><el-radio-button label="POV">POV</el-radio-button><el-radio-button label="DMA">DMA</el-radio-button><el-radio-button label="none">无需算法</el-radio-button></el-radio-group><div v-if="draftAlgorithm === 'POV'" class="algorithm-popper-params" aria-label="POV 参数"><div class="algorithm-param-row"><span>运行时间</span><div class="algorithm-param-input"><el-select v-model="draftPovHours" class="algorithm-time-select" aria-label="POV运行小时" popper-class="variant-popper" :teleported="false"><el-option v-for="hour in povHourOptions" :key="hour" :label="String(hour).padStart(2, '0')" :value="hour" /></el-select><i>时</i><el-select v-model="draftPovMinutes" class="algorithm-time-select" aria-label="POV运行分钟" popper-class="variant-popper" :teleported="false"><el-option v-for="minute in povMinuteOptions" :key="minute" :label="String(minute).padStart(2, '0')" :value="minute" /></el-select><i>分</i></div></div><div class="algorithm-param-row"><span>市场成交占比</span><div class="algorithm-param-input is-participation"><el-input-number v-model="draftPovParticipation" :min="1" :max="25" :precision="0" :controls="false" aria-label="POV市场成交占比" /><i>%</i><small>不超过 25%</small></div></div><p v-if="draftPovParameterError" class="algorithm-param-error" role="alert">请填写有效的运行时间，市场成交占比不得超过 25%</p></div><footer class="algorithm-menu-actions"><el-button size="small" @click="cancelAlgorithmConfig">取消</el-button><el-button size="small" type="primary" :disabled="draftPovParameterError" @click="confirmAlgorithmConfig">确认</el-button></footer></div></el-popover></section>
      <el-slider v-if="executionType === 'lowTouch'" v-model="fraction" :disabled="customerOrderReadonly" :step="1" :marks="{0:'0%',25:'25%',50:'50%',75:'75%',100:'100%'}" @input="size" />
      <div v-if="executionType === 'lowTouch'" class="capacity-pair" :class="{ 'is-single': lockedContext && sourceOrderSide }"><div v-if="!lockedContext || sourceOrderSide !== 'sell'">最大可买<b>{{ number(maxBuy) }} 股</b></div><div v-if="!lockedContext || sourceOrderSide === 'sell'"><div class="total-heading"><span>最大可卖</span><el-tooltip content="最大可卖(名本) = 持仓均价*卖出股数（卖出股数暂不支持碎股，不满足1手按照1手处理，向下取整）" placement="top" popper-class="order-help-popper"><button type="button" class="total-help" aria-label="最大可卖说明"><el-icon><InfoFilled /></el-icon></button></el-tooltip></div><b>{{ number(maxSell) }} 股</b></div></div>
    </section>
    <section v-if="executionType === 'highTouch' || customerOrderReadonly" class="order-note-block"><div class="field-caption"><label for="manual-order-note">备注</label></div><el-input id="manual-order-note" v-model="note" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="请输入备注" /></section>
    <section class="submit-block"><div class="trade-buttons"><el-button v-if="!sourceOrderSide || sourceOrderSide === 'buy'" class="buy-action" :disabled="!canBuy" @click="preview('buy')">买入</el-button><el-button v-if="!sourceOrderSide || sourceOrderSide === 'sell'" class="sell-action" :disabled="!canSell" @click="preview('sell')">卖出</el-button></div><template v-if="executionType === 'lowTouch'"><div class="order-totals"><div v-if="!lockedContext || sourceOrderSide !== 'sell'" class="total-item"><span>买入预估(股)</span><b>{{ shares ? number(shares) : '--' }}</b></div><div v-if="!lockedContext || sourceOrderSide === 'sell'" class="total-item"><div class="total-heading"><span>卖出预估(股)</span></div><b>{{ shares ? number(shares) : '--' }}</b></div><div v-if="!lockedContext || sourceOrderSide !== 'sell'" class="total-item"><span>买入金额(CNY)</span><b>{{ shares ? money(shares * (estimatedPrice || 0)) : '--' }}</b></div><div v-if="!lockedContext || sourceOrderSide === 'sell'" class="total-item"><div class="total-heading"><span>预估卖出金额(CNY)</span></div><b>{{ shares ? money(shares * (estimatedPrice || 0)) : '--' }}</b></div></div></template></section>
  </div>
  <BaseDialog v-model="confirming" :title="confirmationTitle" width="460px" align-center append-to-body class="variant-confirm order-confirm" :close-on-press-escape="false"><template v-if="snapshot"><div class="confirm-identity" :class="snapshot.side"><span>{{ snapshot.side === 'buy' ? '买入' : '卖出' }}</span><strong>{{ snapshot.name }}</strong><small>{{ snapshot.code }}</small></div><div class="confirm-key-metrics"><div><span>订单价格(CNY)</span><b>{{ snapshot.type === 'limit' ? money(snapshot.price) : '市价' }}</b></div><div><span>订单数量(股)</span><b>{{ number(snapshot.quantity) }}</b></div><div><span>预估金额(CNY)</span><b>{{ money(snapshot.estimate) }}</b></div></div><dl class="confirm-details"><dt>下单账户</dt><dd>{{ snapshot.accountLabel || snapshot.account }}</dd><template v-if="snapshot.framework"><dt>客户框架</dt><dd>{{ snapshot.framework }}</dd></template><template v-if="snapshot.executionChannel"><dt>上手方</dt><dd>{{ snapshot.counterparty || '线下单' }}</dd></template><template v-if="snapshot.algorithmParams"><dt>运行时间</dt><dd>{{ snapshot.algorithmParams.hours }} 时 {{ snapshot.algorithmParams.minutes }} 分</dd><dt>市场成交占比</dt><dd>{{ snapshot.algorithmParams.participation }}%</dd></template><template v-if="snapshot.inputAmount !== null"><dt>订单金额</dt><dd>{{ money(snapshot.inputAmount) }} CNY</dd></template><dt>订单类型</dt><dd><span class="order-confirm-tag">{{ snapshot.executionType === 'highTouch' ? '手工单' : '系统单' }}</span></dd><dt>执行算法</dt><dd><span class="order-confirm-tag">{{ algorithmDisplay(snapshot.algorithm) }}</span></dd><dt>订单方式</dt><dd><span class="order-confirm-tag">{{ snapshot.type === 'limit' ? '限价单' : '市价单' }}</span></dd><template v-if="snapshot.note"><dt>备注</dt><dd>{{ snapshot.note }}</dd></template></dl></template><template #footer><el-button @click="confirming = false">返回</el-button><el-button type="primary" @click="submit">确认{{ snapshot?.side === 'buy' ? '买入' : '卖出' }}</el-button></template></BaseDialog>
  <BaseDialog v-model="manualInstrumentVisible" title="手动新增标的" width="400px" align-center append-to-body class="variant-confirm manual-instrument-dialog" :close-on-press-escape="false"><p class="manual-instrument-notice">您正在添加非标准标的，请确认标的名称、代码和市场。</p><div class="manual-instrument-form"><label>标的名称<el-input v-model="manualInstrumentName" placeholder="请输入标的名称" /></label><label>标的代码<el-input v-model="manualInstrumentCode" placeholder="请输入标的代码" /></label><label>所属市场<el-select v-model="manualInstrumentMarket" aria-label="所属市场" popper-class="variant-popper"><el-option v-for="item in manualInstrumentMarketOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></label><p v-if="manualInstrumentError" class="manual-instrument-error" role="alert">{{ manualInstrumentError }}</p></div><template #footer><el-button @click="manualInstrumentVisible = false">取消[Esc]</el-button><el-button type="primary" @click="saveManualInstrument">新增标的[Enter]</el-button></template></BaseDialog>
  <BaseDialog v-model="insufficientFunds" title="可用余额不足" width="380px" align-center append-to-body class="variant-confirm insufficient-funds"><div class="balance-compare"><div><span>本次买入预计需</span><b>{{ money(shares * (estimatedPrice || 0)) }}</b><small>CNY</small></div><div><span>账户可用余额</span><b>{{ money(account.cash) }}</b><small>CNY</small></div></div><p class="dim">请降低订单数量或订单价格后重试。</p><template #footer><el-button type="primary" @click="insufficientFunds = false">我知道了</el-button></template></BaseDialog>
</template>
