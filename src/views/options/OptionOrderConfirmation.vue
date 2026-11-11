<script setup>
import { computed } from 'vue'
import BaseDialog from '../../components/BaseDialog.vue'
import DialogActions from '../../components/DialogActions.vue'
import { useDialogShortcuts } from '../../composables/useDialogShortcuts.js'
import { entryModeLabels, isScheduledEntry, quoteHistory } from './optionOrderModel.js'
import { calculateOptionFee } from './inquiryModel.js'

const props = defineProps({ snapshot: Object, loading: Boolean, paused: Boolean })
const emit = defineEmits(['cancel', 'confirm'])
const visible = computed(() => !!props.snapshot)
const number = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })
const money = value => Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const rules = computed(() => ['knockout', 'exercise', 'dividend'].map(key => props.snapshot.quote[key] || props.snapshot.item[key]).join(' / '))
function cancel() { if (!props.loading) emit('cancel') }
function confirm() { if (!props.loading && !props.paused) emit('confirm') }
useDialogShortcuts(visible, { cancel, confirm })
</script>

<template>
  <BaseDialog :model-value="visible" title="确认期权下单" width="560px" align-center append-to-body class="variant-confirm option-order-confirm" :close-on-click-modal="false" :close-on-press-escape="false" @update:model-value="value => !value && cancel()">
    <template v-if="snapshot">
      <div class="confirm-identity buy"><span>看涨</span><strong>{{ snapshot.item.name }}</strong><small>{{ snapshot.item.code }}.{{ snapshot.item.market }}</small></div>
      <div class="confirm-key-metrics">
        <div><span>报价(%)</span><b>{{ money(snapshot.quote.rate) }}</b></div>
        <div><span>名义本金(万 {{ snapshot.item.currency }})</span><b>{{ number(snapshot.principal) }}</b></div>
        <div><span>预计期权费({{ snapshot.item.currency }})</span><b>{{ money(calculateOptionFee(snapshot.principal, snapshot.quote.rate)) }}</b></div>
      </div>
      <dl class="confirm-details">
        <dt>期权结构 / 期限</dt><dd>{{ snapshot.item.strike }}C / {{ snapshot.item.tenor }}</dd>
        <dt>询价规模(万)</dt><dd>{{ number(snapshot.item.size) }}</dd>
        <dt>执行价(%)</dt><dd>{{ snapshot.item.strike }}</dd>
        <dt>结算币种</dt><dd>{{ snapshot.item.currency }}</dd>
        <dt>参与率(%)</dt><dd>{{ snapshot.item.participation ?? 100 }}</dd>
        <dt>交易规则</dt><dd>{{ rules }}</dd>
        <dt>报价时间</dt><dd>{{ new Date(snapshot.quote.quotedAt).toLocaleString('sv-SE', { hour12: false }) }}</dd>
        <dt>反馈量(万)</dt><dd>{{ number(snapshot.quote.capacity) }}</dd>
        <template v-if="quoteHistory(snapshot.quote).length > 1"><dt>上一次报价 / 反馈量</dt><dd>{{ money(snapshot.quote.previousRate) }}% / {{ snapshot.quote.previousCapacity == null ? '--' : number(snapshot.quote.previousCapacity) }}万</dd></template>
        <dt>交易员备注</dt><dd>{{ snapshot.quote.traderRemark || '--' }}</dd>
        <dt>入场方式</dt><dd><span class="order-confirm-tag">{{ entryModeLabels[snapshot.entryMode] }}</span></dd>
        <template v-if="snapshot.entryMode === 'limit'"><dt>下单价格</dt><dd>{{ money(snapshot.limitPrice) }}</dd></template>
        <template v-if="isScheduledEntry(snapshot.entryMode)"><dt>执行时间</dt><dd>{{ snapshot.executionTime.join(' - ') }}（标的市场时间）</dd></template>
        <dt>备注</dt><dd>{{ snapshot.remark || '--' }}</dd>
      </dl>
    </template>
    <template #footer><DialogActions cancel-text="返回[Esc]" confirm-text="提交下单[Enter]" :loading="loading" :confirm-disabled="paused" @cancel="cancel" @confirm="confirm" /></template>
  </BaseDialog>
</template>

<style scoped>
.confirm-details{display:grid;grid-template-columns:140px minmax(0,1fr);gap:12px 16px;margin:16px 0 0;font-size:12px;line-height:1.5}
.confirm-details dt{color:var(--el-text-color-secondary)}
.confirm-details dd{margin:0;text-align:right;overflow-wrap:anywhere;white-space:pre-wrap}
.confirm-key-metrics b,.confirm-details dd{font-family:var(--ft-font-numeric, 'D-DIN Exp', 'DIN Alternate', 'Arial Narrow', sans-serif);font-variant-numeric:tabular-nums}
.confirm-key-metrics b{font-size:14px}
</style>
<style>
.option-order-confirm{max-width:calc(100vw - 32px)}
.option-order-confirm .el-dialog__body{max-height:calc(100dvh - 190px);overflow-y:auto}
</style>
