<script setup>
import { watch } from 'vue'
import { canUseMarketOrder, normalizeOrderType } from '../orderMarketRules.js'
const { instrument, splitInputLabel, isNonstandardOrder, selectableSplitCounterparties, splitAlgorithmPopoverLineId, povHourOptions, povMinuteOptions, splitAlgorithmParameterError, isAmountOrder } = defineProps({
  splitInputLabel: String,
  instrument: Object,
  isNonstandardOrder: Boolean,
  selectableSplitCounterparties: Array,
  splitAlgorithmPopoverLineId: [String, Number],
  povHourOptions: Array,
  povMinuteOptions: Array,
  splitAlgorithmParameterError: Boolean,
  isAmountOrder: Boolean,
})
const splitLines = defineModel('splitLines', { type: Array })
watch(() => [canUseMarketOrder(instrument), ...(splitLines.value || []).map(line => line.orderType)], () => {
  for (const line of splitLines.value || []) line.orderType = normalizeOrderType(line.orderType, instrument)
}, { immediate: true })
const splitAlgorithmDraft = defineModel('splitAlgorithmDraft', { type: Object })
const emit = defineEmits(['algorithm-popover', 'cancel-algorithm', 'confirm-algorithm', 'remove-line'])
</script>

<template>
              <table class="trs-split-table">
                <colgroup><col class="is-counterparty"><col class="is-algorithm"><col class="is-account"><col class="is-order-type"><col class="is-price"><col class="is-quantity"><col class="is-direction"><col class="is-actions"></colgroup>
                <thead><tr><th>上手方</th><th>算法</th><th>下单账户</th><th>订单属性</th><th>订单价格</th><th>{{ splitInputLabel }}</th><th>方向</th><th class="trs-split-action-cell">操作</th></tr></thead>
                <tbody>
                  <tr v-for="(line, index) in splitLines" :key="line.id">
                    <td><el-select v-model="line.counterparty" clearable placeholder="请选择" :disabled="isNonstandardOrder" :aria-label="`子单 ${index + 1} 上手方`" popper-class="variant-popper"><el-option v-for="counterparty in selectableSplitCounterparties" :key="counterparty.value" :label="counterparty.label" :value="counterparty.value" /></el-select></td>
                    <td><el-popover :visible="splitAlgorithmPopoverLineId === line.id" trigger="click" placement="bottom-start" :width="264" popper-class="variant-popper algorithm-popper" @update:visible="visible => emit('algorithm-popover', line, visible)"><template #reference><button type="button" class="algorithm-trigger trs-split-algorithm-trigger" :aria-label="`执行算法：${line.strategy}，点击配置`"><span>{{ line.strategy }}</span><svg class="algorithm-chevron" :class="{ 'is-open': splitAlgorithmPopoverLineId === line.id }" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg></button></template><div class="execution-algorithm-menu"><span>执行算法</span><el-radio-group v-model="splitAlgorithmDraft.strategy" :aria-label="`子单 ${index + 1} 执行算法`"><el-radio-button label="POV">POV</el-radio-button><el-radio-button label="DMA">DMA</el-radio-button></el-radio-group><div v-if="splitAlgorithmDraft.strategy === 'POV'" class="algorithm-popper-params" aria-label="POV 参数"><div class="algorithm-param-row"><span>运行时间</span><div class="algorithm-param-input"><el-select v-model="splitAlgorithmDraft.povHours" class="algorithm-time-select" aria-label="POV运行小时" popper-class="variant-popper"><el-option v-for="hour in povHourOptions" :key="hour" :label="String(hour).padStart(2, '0')" :value="hour" /></el-select><i>时</i><el-select v-model="splitAlgorithmDraft.povMinutes" class="algorithm-time-select" aria-label="POV运行分钟" popper-class="variant-popper"><el-option v-for="minute in povMinuteOptions" :key="minute" :label="String(minute).padStart(2, '0')" :value="minute" /></el-select><i>分</i></div></div><div class="algorithm-param-row"><span>市场成交占比</span><div class="algorithm-param-input is-participation"><el-input-number v-model="splitAlgorithmDraft.participation" :min="1" :max="25" :precision="0" :controls="false" aria-label="POV市场成交占比" /><i>%</i><small>不超过 25%</small></div></div><p v-if="splitAlgorithmParameterError" class="algorithm-param-error" role="alert">请填写有效的运行时间，市场成交占比不得超过 25%</p></div><footer class="algorithm-menu-actions"><el-button size="small" @click="emit('cancel-algorithm')">取消</el-button><el-button size="small" type="primary" :disabled="splitAlgorithmParameterError" @click="emit('confirm-algorithm')">确认</el-button></footer></div></el-popover></td>
                    <td><el-select v-model="line.account" :aria-label="`子单 ${index + 1} 下单账户`"><el-option label="TRS_T0 - 自营一号" value="TRS_T0 - 自营一号" /><el-option label="TRS_T1 - 自营二号" value="TRS_T1 - 自营二号" /><el-option label="TRS_T2 - 自营三号" value="TRS_T2 - 自营三号" /></el-select></td>
                    <td><el-radio-group v-model="line.orderType" :aria-label="`子单 ${index + 1} 订单属性`"><el-radio-button label="limit">限价单</el-radio-button><el-radio-button v-if="canUseMarketOrder(instrument)" label="market">市价单</el-radio-button></el-radio-group></td>
                    <td><el-input-number v-if="line.orderType === 'limit'" v-model="line.price" :aria-label="`子单 ${index + 1} 订单价格`" :min="0" :precision="2" :controls="false" /><span v-else class="trs-split-market-price">以市场价格成交</span></td>
                    <td><el-input-number v-if="isAmountOrder" v-model="line.amount" placeholder="请输入" :aria-label="`子单 ${index + 1} 订单金额`" :min="0.01" :precision="2" :controls="false" /><el-input-number v-else v-model="line.quantity" placeholder="请输入" :aria-label="`子单 ${index + 1} 订单数量`" :min="0.01" :precision="2" :controls="false" /></td>
                    <td class="trs-split-direction-cell"><span class="trs-split-direction-value" :aria-label="`子单 ${index + 1} 方向`">{{ line.side === 'sell' ? '卖出' : '买入' }}</span></td>
                    <td class="trs-split-action-cell"><button type="button" class="is-danger" @click="emit('remove-line', index)">移除</button></td>
                  </tr>
                </tbody>
              </table>
</template>
