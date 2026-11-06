<script setup>
import { computed, reactive, ref } from 'vue'
import { ArrowDown, ArrowLeft, ArrowUp, Search, CircleClose } from '@element-plus/icons-vue'
import { defaultDraft, instruments, validateInquiry } from './inquiryModel.js'
const props = defineProps({ paused: Boolean })
const emit = defineEmits(['submit'])
const draft = reactive(defaultDraft())
const batch = ref(false), codes = ref([]), advanced = ref(false)
const errors = reactive({})
const instrumentInput = ref(null)
const instrumentLabel = item => `${item.name}（${item.code}）`
const instrumentSearch = ref(instrumentLabel(instruments.find(item => item.code === draft.code)))
function clearErrors() { Object.keys(errors).forEach(key => delete errors[key]) }
function searchInstruments(query, callback) {
  const text = query.trim().toLowerCase()
  const selectedText = currentInstrument.value ? instrumentLabel(currentInstrument.value) : ''
  callback(instruments.filter(item => query === selectedText || `${item.name}${item.code}`.toLowerCase().includes(text)).map(item => ({ ...item, value: instrumentLabel(item) })))
}
function clearInstrument() { instrumentSearch.value = ''; draft.code = ''; errors.instrument = ''; instrumentInput.value?.focus() }
function editInstrument(value) { if (value !== (currentInstrument.value ? instrumentLabel(currentInstrument.value) : '')) draft.code = ''; errors.instrument = '' }
const sizeOptions = ref([100, 500, 1000]), customSize = ref('')
const customTenor = ref(''), customStrike = ref(null), currencyChanged = ref(false)
const tenorOptions = ref(['1M', '2M', '3M', '6M'])
const strikeOptions = ref([80, 90, 100, 103, 105])
const currentInstrument = computed(() => instruments.find(item => item.code === draft.code))
function selectInstrument(item) { draft.code = item.code; instrumentSearch.value = item.value; errors.instrument = ''; if (!currencyChanged.value) draft.currency = item.currency || 'CNY' }
function toggle(key, value, max) {
  errors[key] = ''
  if (draft[key].includes(value)) draft[key] = draft[key].filter(item => item !== value)
  else if (draft[key].length < max) draft[key] = [...draft[key], value]
  else errors[key] = `最多选择 ${max} 个${key === 'tenors' ? '期限' : '执行价'}`
}
function addSize() {
  errors.size = ''
  const raw = customSize.value.trim()
  if (!raw) return
  const value = Number(raw)
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value <= 0) { errors.size = '询价规模请输入大于 0 的整数'; return }
  if (!sizeOptions.value.includes(value)) sizeOptions.value.push(value)
  draft.size = value
  customSize.value = ''
}
function addTenor() {
  errors.tenors = ''
  const raw = customTenor.value.trim().toUpperCase()
  if (!raw) return
  const match = raw.match(/^(\d+(?:\.\d+)?)M?$/)
  const months = match ? Number(match[1]) : NaN
  if (!Number.isFinite(months) || months <= 0 || months > 99) { errors.tenors = '期限仅支持 M，且须大于 0、不超过 99M'; return }
  const value = `${months}M`
  if (!tenorOptions.value.includes(value)) tenorOptions.value.push(value)
  if (!draft.tenors.includes(value)) toggle('tenors', value, 4)
  customTenor.value = ''
}
function addStrike() {
  errors.strikes = ''
  if (customStrike.value == null || String(customStrike.value).trim() === '') return
  const value = Number(customStrike.value)
  if (!Number.isFinite(value) || value < 70 || value > 120) { errors.strikes = '执行价需在 70% 至 120% 之间'; return }
  if (!strikeOptions.value.includes(value)) strikeOptions.value.push(value)
  if (!draft.strikes.includes(value)) toggle('strikes', value, 3)
  customStrike.value = null
}
function submit() {
  clearErrors()
  addSize()
  addTenor()
  addStrike()
  if (errors.size || errors.tenors || errors.strikes) return
  const selectedCodes = batch.value ? codes.value : [draft.code].filter(Boolean)
  if (!selectedCodes.length) { errors.instrument = '请选择询价标的'; return }
  const drafts = selectedCodes.map(code => ({ ...draft, code, currency: currencyChanged.value ? draft.currency : (instruments.find(item => item.code === code)?.currency || draft.currency), tenors: [...draft.tenors], strikes: [...draft.strikes] }))
  const message = drafts.map(validateInquiry).find(Boolean) || ''
  if (message) {
    const field = [['标的','instrument'],['规模','size'],['期限','tenors'],['执行价','strikes'],['敲出','knockout'],['行权','exercise'],['分红','dividend'],['币种','currency']].find(([text]) => message.includes(text))?.[1] || 'instrument'
    errors[field] = message
    if (field === 'currency') advanced.value = true
    return
  }
  emit('submit', drafts)
}
function reset() { Object.assign(draft, defaultDraft()); instrumentSearch.value = instrumentLabel(currentInstrument.value); codes.value = []; currencyChanged.value = false; customSize.value = ''; customTenor.value = ''; customStrike.value = null; clearErrors() }
const rules = [
  { key: 'knockout', label: '敲出规则', options: ['连板敲出', '协商敲出', '3连板', '无要求'] },
  { key: 'exercise', label: '最快行权日', options: ['T+1', '无要求'] },
  { key: 'dividend', label: '分红规则', options: ['分红调整', '无要求'] },
]
</script>

<template>
  <section class="option-inquiry-ticket" aria-label="期权询价面板">
    <header class="option-ticket-heading"><strong>{{ batch ? '批量询价' : '期权询价' }}</strong><el-button link @click="batch = !batch; clearErrors()"><el-icon v-if="batch"><ArrowLeft /></el-icon>{{ batch ? '单笔询价' : '批量询价' }}</el-button></header>
    <form class="option-inquiry-body" novalidate @submit.prevent="submit">
      <div class="inquiry-field"><label>期权方向</label><div class="option-direction trade-buttons"><button type="button" class="buy-action" :class="{ active: draft.direction === 'call' }" @click="draft.direction = 'call'">看涨</button></div></div>
      <div class="inquiry-field"><label for="option-instrument">选择标的</label><el-autocomplete v-if="!batch" id="option-instrument" ref="instrumentInput" v-model="instrumentSearch" :fetch-suggestions="searchInstruments" :debounce="0" :prefix-icon="Search" placeholder="输入标的代码或名称" popper-class="variant-popper option-instrument-suggestions" @select="selectInstrument" @input="editInstrument"><template #suffix><button v-if="instrumentSearch" type="button" class="instrument-clear" aria-label="清空标的" @mousedown.prevent @click.stop="clearInstrument"><el-icon><CircleClose /></el-icon></button></template></el-autocomplete><el-select v-else v-model="codes" multiple filterable collapse-tags :max-collapse-tags="2" placeholder="选择多个标的" aria-label="批量询价标的" popper-class="variant-popper"><el-option v-for="item in instruments" :key="item.code" :value="item.code" :label="`${item.name}（${item.code}）`" /></el-select><p v-if="errors.instrument" class="inquiry-error" role="alert">{{ errors.instrument }}</p></div>
      <div class="inquiry-field"><label>询价规模（万）</label><div class="inquiry-choices wraps"><button v-for="size in sizeOptions" :key="size" type="button" :class="{ selected: draft.size === size }" @click="draft.size = size; errors.size = ''">{{ size.toLocaleString() }}</button><el-input v-model="customSize" inputmode="numeric" placeholder="自定义" aria-label="自定义询价规模" @blur="addSize" @keydown.enter.prevent="addSize" /></div><p v-if="errors.size" class="inquiry-error" role="alert">{{ errors.size }}</p></div>
      <div class="inquiry-field"><label>期限 <span>最多 4 个 · 已选 {{ draft.tenors.length }}/4</span></label><div class="inquiry-choices wraps"><button v-for="tenor in tenorOptions" :key="tenor" type="button" :class="{ selected: draft.tenors.includes(tenor) }" @click="toggle('tenors', tenor, 4)">{{ tenor }}</button><el-input v-model="customTenor" placeholder="自定义" title="输入月数或 M 期限，不超过 99M" aria-label="自定义期限" @blur="addTenor" @keydown.enter.prevent="addTenor" /></div><p v-if="errors.tenors" class="inquiry-error" role="alert">{{ errors.tenors }}</p></div>
      <div class="inquiry-field"><label>执行价<span>70–120 · 已选 {{ draft.strikes.length }}/3</span></label><div class="inquiry-choices wraps"><button v-for="strike in strikeOptions" :key="strike" type="button" :class="{ selected: draft.strikes.includes(strike) }" @click="toggle('strikes', strike, 3)">{{ strike }}</button><el-input v-model="customStrike" inputmode="decimal" placeholder="自定义" title="输入执行价，70–120" aria-label="自定义执行价" @blur="addStrike" @keydown.enter.prevent="addStrike" /></div><p v-if="errors.strikes" class="inquiry-error" role="alert">{{ errors.strikes }}</p></div>
      <div v-for="rule in rules" :key="rule.key" class="inquiry-field"><label>{{ rule.label }}</label><div class="inquiry-choices"><button v-for="value in rule.options" :key="value" type="button" :class="{ selected: draft[rule.key] === value }" @click="draft[rule.key] = value; errors[rule.key] = ''">{{ value }}</button></div><p v-if="errors[rule.key]" class="inquiry-error" role="alert">{{ errors[rule.key] }}</p></div>
      <button class="inquiry-advanced" type="button" :aria-expanded="advanced" @click="advanced = !advanced">高级选项<span>结算币种 {{ draft.currency }} <el-icon><ArrowUp v-if="advanced"/><ArrowDown v-else/></el-icon></span></button>
      <div v-if="advanced" class="inquiry-field"><label>结算币种</label><div class="inquiry-choices" role="group" aria-label="结算币种"><button v-for="currency in ['CNY', 'HKD', 'USD']" :key="currency" type="button" :class="{selected:draft.currency === currency}" :aria-pressed="draft.currency === currency" @click="draft.currency = currency; currencyChanged = true; errors.currency = ''">{{ currency }}</button></div><p v-if="errors.currency" class="inquiry-error" role="alert">{{ errors.currency }}</p></div>
      <el-button class="inquiry-submit" native-type="submit" type="primary" :disabled="props.paused">提交询价</el-button>
      <el-button class="inquiry-reset" link @click="reset">重置</el-button>
    </form>
  </section>
</template>
<style scoped>
.inquiry-field>.el-autocomplete{width:100%}
.instrument-clear{display:grid;place-items:center;padding:0;border:0;background:none;color:var(--el-text-color-secondary);cursor:pointer}
.instrument-clear:hover{color:var(--el-text-color-primary)}

.option-inquiry-ticket{display:flex;flex-direction:column;height:100%;min-height:0;font-size:12px}.option-ticket-heading{height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid var(--el-border-color-light);flex:none}.option-ticket-heading strong{font-size:14px}.option-ticket-heading .el-button{color:var(--el-color-primary);font-size:12px}.option-inquiry-body{overflow:auto;padding:14px;display:flex;flex-direction:column;gap:16px;min-height:0}.inquiry-field{display:flex;flex-direction:column;gap:8px}.inquiry-field>label{display:flex;align-items:center;justify-content:space-between;color:var(--el-text-color-regular);line-height:18px}.inquiry-field>label span{font-size:11px;color:var(--el-text-color-secondary)}.inquiry-field .el-input-number{width:100%}.option-direction,.inquiry-choices{display:flex;gap:6px}.option-direction button,.inquiry-choices button{flex:1;min-width:0;border:1px solid var(--el-border-color);background:var(--el-fill-color-light);color:var(--el-text-color-regular);height:32px;border-radius:3px;white-space:nowrap;font-size:12px}.inquiry-choices button.selected{border-color:var(--el-color-primary);color:#e3c269;background:#363125}.inquiry-choices.wraps{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}.inquiry-choices.wraps>.el-input{min-width:0;width:100%;height:32px}.inquiry-choices.wraps :deep(.el-input__wrapper){padding:0 6px}.inquiry-choices.wraps :deep(.el-input__inner){font-size:12px}.inquiry-custom{display:flex;gap:6px}.inquiry-custom>.el-input,.inquiry-custom>.el-input-number{min-width:0;flex:1}.inquiry-custom .el-button{font-size:12px}.inquiry-advanced{display:flex;justify-content:space-between;align-items:center;background:none;border:0;border-top:1px solid var(--el-border-color-light);padding:12px 0 0;color:var(--el-text-color-secondary);font-size:12px}.inquiry-advanced span{display:flex;gap:6px;align-items:center}.inquiry-error{margin:0;color:var(--el-color-danger);font-size:12px}.inquiry-submit{--el-button-text-color:#fff;--el-button-hover-text-color:#fff;--el-button-active-text-color:#fff;color:#fff;height:36px;width:100%;margin:0;font-weight:600}.inquiry-reset{align-self:center;margin:0!important;font-size:12px}.inquiry-field :deep(.el-input__wrapper),.inquiry-field :deep(.el-select__wrapper){min-height:32px;background:var(--el-fill-color-blank)}
</style>

<style>
.option-instrument-suggestions .el-autocomplete-suggestion{background:#25282d;color:#c9ced6}
.option-instrument-suggestions .el-autocomplete-suggestion li:hover,.option-instrument-suggestions .el-autocomplete-suggestion li.highlighted{background:#353026;color:#e3c269}
</style>
