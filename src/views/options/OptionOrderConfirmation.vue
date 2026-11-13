<script setup>
import { computed, ref, watch } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'
import BaseDialog from '../../components/BaseDialog.vue'
import DialogActions from '../../components/DialogActions.vue'
import OptionDirectionBadge from './OptionDirectionBadge.vue'
import { useDialogShortcuts } from '../../composables/useDialogShortcuts.js'
import { entryModeLabels, isScheduledEntry, quoteHistory } from './optionOrderModel.js'
import { calculateOptionFee } from './inquiryModel.js'

const props = defineProps({ snapshot: Object, loading: Boolean, paused: Boolean })
const emit = defineEmits(['cancel', 'confirm'])
const visible = computed(() => !!props.snapshot)
const detailsExpanded = ref(false)
watch(() => props.snapshot, () => { detailsExpanded.value = false })
const detailCount = computed(() => {
  if (!props.snapshot) return 0
  return 9 + Number(quoteHistory(props.snapshot.quote).length > 1)
})
const number = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })
const money = value => Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const rules = computed(() => ['knockout', 'exercise', 'dividend'].map(key => props.snapshot.quote[key] || props.snapshot.item[key]).join(' / '))
function cancel() { if (!props.loading) emit('cancel') }
function confirm() { if (!props.loading && !props.paused) emit('confirm') }
useDialogShortcuts(visible, { cancel, confirm, ignoreEnterFrom: '.confirm-details-toggle' })
</script>

<template>
  <BaseDialog :model-value="visible" title="确认期权下单" width="500px" align-center append-to-body class="variant-confirm option-order-confirm" :close-on-click-modal="false" :close-on-press-escape="false" @update:model-value="value => !value && cancel()">
    <template v-if="snapshot">
      <div class="confirm-identity"><OptionDirectionBadge :direction="snapshot.item.direction" /><strong>{{ snapshot.item.name }}</strong><small>{{ snapshot.item.code }}.{{ snapshot.item.market }}</small></div>
      <div class="confirm-order-overview">
        <div class="confirm-principal">
          <span class="confirm-value-label">名义本金({{ snapshot.item.currency }})</span>
          <strong>{{ number(snapshot.principal) }}<small>万</small></strong>
          <span class="confirm-value-note">预计期权费 {{ money(calculateOptionFee(snapshot.principal, snapshot.quote.rate)) }} {{ snapshot.item.currency }}</span>
        </div>
        <div class="confirm-entry">
          <div class="confirm-entry-heading">
            <span class="confirm-value-label">{{ snapshot.entryMode === 'limit' ? '下单价格' : '入场方式' }}</span>
            <span class="order-confirm-tag">{{ entryModeLabels[snapshot.entryMode] }}</span>
          </div>
          <strong v-if="snapshot.entryMode === 'limit'">{{ money(snapshot.limitPrice) }}</strong>
          <span v-else-if="isScheduledEntry(snapshot.entryMode)" class="confirm-execution-time">{{ snapshot.executionTime.join(' - ') }}</span>
          <span v-else class="confirm-market-price">按市价成交</span>
          <span class="confirm-value-note">报价 {{ money(snapshot.quote.rate) }}%</span>
        </div>
      </div>
      <dl class="confirm-remark">
        <dt>备注</dt><dd>{{ snapshot.remark || '--' }}</dd>
      </dl>
      <button class="confirm-details-toggle" type="button" :aria-expanded="detailsExpanded" aria-controls="option-confirm-details" @click="detailsExpanded = !detailsExpanded">
        <span>{{ detailsExpanded ? '收起全部条款' : '查看全部条款' }} · {{ detailCount }} 项</span>
        <el-icon :class="{ 'is-expanded': detailsExpanded }"><ArrowDown /></el-icon>
      </button>
      <div v-if="detailsExpanded" id="option-confirm-details">
      <section class="confirm-section" aria-labelledby="option-confirm-contract-heading">
        <h3 id="option-confirm-contract-heading">期权描述</h3>
        <dl class="confirm-details">
        <dt>期权结构 / 期限</dt><dd>{{ snapshot.item.strike }}{{ snapshot.item.direction === 'put' ? 'P' : 'C' }} / {{ snapshot.item.tenor }}</dd>
        <dt>询价规模(万)</dt><dd>{{ number(snapshot.item.size) }}</dd>
        <dt>执行价(%)</dt><dd>{{ snapshot.item.strike }}</dd>
        <dt>结算币种</dt><dd>{{ snapshot.item.currency }}</dd>
        <dt>参与率(%)</dt><dd>{{ snapshot.item.participation ?? 100 }}</dd>
        <dt>交易规则</dt><dd>{{ rules }}</dd>
        <dt>报价时间</dt><dd>{{ new Date(snapshot.quote.quotedAt).toLocaleString('sv-SE', { hour12: false }) }}</dd>
        <dt>反馈量(万)</dt><dd>{{ number(snapshot.quote.capacity) }}</dd>
        <template v-if="quoteHistory(snapshot.quote).length > 1"><dt>上一次报价 / 反馈量</dt><dd>{{ money(snapshot.quote.previousRate) }}% / {{ snapshot.quote.previousCapacity == null ? '--' : number(snapshot.quote.previousCapacity) }}万</dd></template>
        <dt>交易员备注</dt><dd>{{ snapshot.quote.traderRemark || '--' }}</dd>
        </dl>
      </section>
      </div>
    </template>
    <template #footer><DialogActions cancel-text="返回[Esc]" confirm-text="提交下单[Enter]" :loading="loading" :confirm-disabled="paused" @cancel="cancel" @confirm="confirm" /></template>
  </BaseDialog>
</template>

<style scoped>
.confirm-identity{align-items:center;margin-bottom:24px}
.confirm-order-overview{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:20px}
.confirm-principal,.confirm-entry{display:flex;flex-direction:column;align-items:flex-start;gap:8px;min-width:0}
.confirm-value-label,.confirm-value-note{color:var(--el-text-color-secondary);font-size:12px;line-height:1.5}
.confirm-order-overview strong{color:var(--el-text-color-primary);font-family:var(--ft-font-numeric);font-size:28px;font-weight:600;line-height:1.3;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.confirm-principal strong small{margin-left:6px;font-size:14px;font-weight:400}
.confirm-entry-heading{display:flex;align-items:center;gap:8px;min-height:20px}
.order-confirm-tag{display:inline-flex;align-items:center;height:20px;padding:0 7px;border:1px solid var(--el-border-color);border-radius:3px;background:var(--el-fill-color-light);color:var(--el-text-color-regular);font-size:12px;line-height:1;white-space:nowrap}
.confirm-execution-time,.confirm-market-price{min-height:36.4px;display:flex;align-items:center;color:var(--el-text-color-primary);font-size:14px;line-height:1.5}
.confirm-execution-time{font-family:var(--ft-font-numeric);font-variant-numeric:tabular-nums}
.confirm-remark{display:flex;align-items:baseline;gap:12px;margin:20px 0;font-size:12px;line-height:1.6}
.confirm-remark dt{flex:none;color:var(--el-text-color-secondary)}
.confirm-remark dd{margin:0;min-width:0;white-space:pre-wrap;overflow-wrap:anywhere}
.confirm-details-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:16px 0 0;border:0;border-top:1px solid var(--el-border-color-light);background:transparent;color:var(--el-text-color-secondary);font:inherit;font-size:12px;cursor:pointer;text-align:left}
.confirm-details-toggle:hover{color:var(--el-color-primary)}
.confirm-details-toggle:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:4px}
.confirm-details-toggle .el-icon{transition:transform .15s}
.confirm-details-toggle .el-icon.is-expanded{transform:rotate(180deg)}
@media(prefers-reduced-motion:reduce){.confirm-details-toggle .el-icon{transition:none}}
.confirm-section{margin-top:20px}
.confirm-section h3{margin:0 0 12px;color:var(--el-text-color-primary);font-size:14px;font-weight:500}
.confirm-details{display:grid;grid-template-columns:140px minmax(0,1fr);gap:12px 16px;margin:0;font-size:12px;line-height:1.5}
.confirm-details dt{color:var(--el-text-color-secondary)}
.confirm-details dd{font-size:13px;margin:0;text-align:right;overflow-wrap:anywhere;white-space:pre-wrap;font-weight:500;}
.confirm-details dd{font-family:var(--ft-font-numeric);font-variant-numeric:tabular-nums}
</style>
<style>
.option-order-confirm{max-width:calc(100vw - 32px)}
.option-order-confirm .el-dialog__body{max-height:calc(100dvh - 190px);overflow-y:auto}
/* 覆盖公共弹窗的非对称内边距，使该确认弹窗的按钮上下居中。 */
.ft-dialog-frame.option-order-confirm .el-dialog__footer{padding:14px 16px!important}
</style>
