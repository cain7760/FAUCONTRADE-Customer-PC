<script setup>
import { computed, ref, watch } from 'vue'
import { Close } from '@element-plus/icons-vue'
import { money, number, price as formatPrice } from '../variantData'
import BaseDialog from '../../../components/BaseDialog.vue'
import TradingTable from './TradingTable.vue'

const props = defineProps({ modelValue: Boolean, record: Object })
const emit = defineEmits(['update:modelValue'])
const page = ref(1)
const pageSize = ref(10)

watch(() => props.record?.id, () => { page.value = 1; pageSize.value = 10 })

const recordTime = computed(() => props.record?.orderTime || `${props.record?.positionDate || '2026-09-18'} 09:30:00`)
const directionLabel = computed(() => props.record?.side === 'sell' ? '卖出' : '买入')
const openCloseLabel = computed(() => props.record?.openClose === '平' ? '平仓' : '开仓')
const orderPrice = computed(() => props.record?.price === null || props.record?.price === undefined ? '市价' : formatPrice(props.record.price, props.record.market))
const orderQuantity = computed(() => props.record?.inputAmount !== null && props.record?.inputAmount !== undefined ? `${money(props.record.inputAmount)} CNY` : `${number(props.record?.quantity || 0)} 股`)

function offsetTime(time, seconds) {
  const date = new Date(String(time).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return time
  date.setSeconds(date.getSeconds() + seconds)
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
function statusRecord(row, time) {
  const rules = {
    '已撤': ['当前账户', '撤单', '撤单申请已提交。'],
    '暂停': ['交易员', '暂停', '订单已暂停，等待恢复处理。'],
    '完成': ['交易所', '完成', `订单已全部成交，成交数量 ${number(row.filledQuantity || row.quantity)} 股。`],
    '部成': ['交易所', '部分成交', `订单已部分成交，成交数量 ${number(row.filledQuantity || 0)} 股。`],
    '已报': ['交易员', '已报', '订单已报送至交易所。'],
    '待报': ['交易员', '待报', '订单等待报送。'],
    '改单中': ['当前账户', '改单', '订单修改已受理，等待处理完成。'],
    '异常': ['交易员', '异常', row.feedback || '订单处理异常，请关注后续处理结果。'],
    '拒绝': ['交易员', '拒绝', row.traderRemark || '交易员已拒绝该手工单。'],
    '其他': ['交易员', '状态更新', '订单状态已更新。'],
  }
  const [operator, type, content] = rules[row.status] || rules.其他
  return { operator, time, type, content }
}
const records = computed(() => {
  const row = props.record
  if (!row) return []
  const entries = [{ operator: '当前账户', time: recordTime.value, type: '下单', content: `提交${directionLabel.value}${openCloseLabel.value}${row.type === 'market' ? '市价' : '限价'}订单：${orderQuantity.value}。` }]
  let offset = 45
  if (row.orderType === '手工单') {
    entries.push({ operator: '交易员', time: offsetTime(recordTime.value, offset), type: '受理', content: '已接收手工单，等待交易员处理。' })
    offset += 45
  }
  entries.push(statusRecord(row, offsetTime(recordTime.value, offset)))
  if (row.convertedToManualAt) entries.push({ operator: '当前账户', time: row.convertedToManualAt, type: '转手工单', content: row.orderRemark ? `已转为手工单；下单备注：${row.orderRemark}` : '异常系统单已转为手工单，等待交易员处理。' })
  return entries.sort((a, b) => b.time.localeCompare(a.time))
})
const pagedRecords = computed(() => records.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
function close() { emit('update:modelValue', false) }
function updatePageSize(value) { pageSize.value = value; page.value = 1 }
function exportHistory() {
  const header = ['操作人', '操作时间', '操作类型', '操作内容']
  const rows = records.value.map(item => [item.operator, item.time, item.type, item.content])
  const csv = [header, ...rows].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }))
  link.download = `${props.record?.orderNo || props.record?.code || '订单'}-历史记录.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}
</script>

<template>
  <BaseDialog :model-value="modelValue" top="var(--ft-dialog-top)" width="min(1080px, calc(100vw - 32px))" :teleported="false" :show-close="false" class="cp-dialog history-dialog" :close-on-press-escape="true" @update:model-value="emit('update:modelValue', $event)">
    <template #header><header class="cp-header"><h2>历史记录</h2><button type="button" aria-label="关闭历史记录" @click="close"><el-icon><Close /></el-icon></button></header></template>
    <template v-if="record">
      <section class="history-layout">
      <section class="history-order-summary">
        <div class="history-instrument"><strong>{{ record.name }}</strong><span>（{{ record.code }}.{{ record.market }}）</span><b :class="record.side === 'sell' ? 'is-sell' : 'is-buy'">{{ directionLabel }} · {{ openCloseLabel }}</b></div>
        <dl class="history-order-metrics"><div><dt>下单账户</dt><dd>{{ record.account }}</dd></div><div><dt>订单类型</dt><dd>{{ record.orderType || '--' }}</dd></div><div><dt>执行算法</dt><dd>{{ record.algorithm || '--' }}</dd></div><div><dt>订单价格</dt><dd>{{ orderPrice }}</dd></div><div><dt>订单数量</dt><dd>{{ orderQuantity }}</dd></div><div><dt>币种</dt><dd>CNY</dd></div></dl>
        <button type="button" class="history-export" @click="exportHistory">导出历史</button>
      </section>
      <section class="history-records">
        <TradingTable :data="pagedRecords" border class="history-records-table" height="100%"><el-table-column prop="operator" label="操作人" width="160" /><el-table-column prop="time" label="操作时间" width="220" /><el-table-column prop="type" label="操作类型" width="164" /><el-table-column prop="content" label="操作内容" min-width="360" /></TradingTable>
        <footer class="history-records-footer"><span>共{{ records.length }}条</span><el-pagination v-model:current-page="page" :page-size="pageSize" :page-sizes="[10, 20, 50]" :total="records.length" layout="sizes, prev, pager, next" background @size-change="updatePageSize" /></footer>
      </section>
      </section>
    </template>
  </BaseDialog>
</template>

<style>
.variants-app .history-dialog.el-dialog{width:min(1080px,calc(100vw - 32px))!important;min-width:0!important;height:min(560px,calc(100vh - 40px));max-height:calc(100vh - 40px)}.variants-app .history-dialog .el-dialog__body{display:flex;flex:1;min-height:0;padding:0!important;overflow:hidden}.variants-app .history-layout{position:relative;display:flex;flex:1;flex-direction:column;min-height:0;padding:0 10px 10px;background:#202226}.variants-app .history-layout:before{position:absolute;top:0;right:-10px;left:-10px;height:56px;background:#25282d;content:''}.variants-app .history-order-summary{position:relative;z-index:1;display:flex;align-items:center;gap:16px;flex:0 0 56px;min-height:56px;padding:0 12px;border:0;background:transparent}.history-instrument{display:flex;align-items:center;gap:7px;min-width:210px;white-space:nowrap}.history-instrument strong{color:#e6ebf3;font-size:14px;font-weight:600}.history-instrument span{color:#9ba5b3;font-size:12px}.history-instrument b{display:inline-flex;align-items:center;height:22px;padding:0 7px;border:1px solid transparent;border-radius:3px;font-size:11px;font-weight:400;line-height:20px}.history-instrument b.is-buy{border-color:#75444e;background:#3d282e;color:#ec9aa2}.history-instrument b.is-sell{border-color:#3e715f;background:#253c34;color:#8ed0b4}.history-order-metrics{display:flex;align-items:stretch;gap:0;flex:1;min-width:0;margin:0}.history-order-metrics div{position:relative;min-width:0;padding:8px 10px}.history-order-metrics div+div:before{position:absolute;top:19px;bottom:19px;left:0;width:1px;background:#343941;content:''}.history-order-metrics dt{margin:0 0 3px;color:#949daa;font-size:10px;line-height:14px}.history-order-metrics dd{overflow:hidden;margin:0;color:#edf0f4;font-family:'D-DIN Exp','DIN Alternate','Arial Narrow',sans-serif;font-size:14px;font-weight:500;line-height:17px;text-overflow:ellipsis;white-space:nowrap}.history-export{position:relative;z-index:1;flex:0 0 auto;height:28px;padding:0 11px;border:1px solid #4a5059;border-radius:3px;background:#2a2d32;color:#c8ced7;font-size:12px;font-weight:400;cursor:pointer}.history-export:hover{border-color:#bb984a;background:#353026;color:#e1c36f}.history-records{position:relative;z-index:1;display:flex;flex:1;flex-direction:column;min-height:0;margin:10px 0 0;border:1px solid #343840;border-radius:3px;overflow:hidden;background:#1e2023}.history-records-table{flex:1;min-height:0;--el-table-border-color:#343840;--el-table-header-bg-color:#25282d;--el-table-tr-bg-color:#1e2023;--el-table-row-hover-bg-color:#25282d;--el-table-text-color:#c8ced7;--el-table-header-text-color:#aeb6c1}.history-records-table .el-table__cell{height:36px;padding:0 12px!important;font-size:12px}.history-records-table th.el-table__cell{height:32px;font-size:12px;font-weight:400}.history-records-table .cell{line-height:18px}.history-records-footer{display:flex;align-items:center;justify-content:space-between;min-height:42px;padding:0 12px;border-top:1px solid #343840;background:#1e2023;color:#9ba5b1;font-size:11px}.history-records-footer .el-pagination{--el-pagination-bg-color:#30343a;--el-pagination-button-color:#b9c2cc;--el-pagination-hover-color:#dfc170}.history-records-footer .el-pagination.is-background .el-pager li.is-active{background:#bb984a;color:#fff}.history-records-footer .el-select__wrapper{background:#30343a;box-shadow:none}.history-records-footer .el-input__inner{color:#c5ceda}@media(max-width:1000px){.variants-app .history-dialog.el-dialog{height:auto}.variants-app .history-dialog .el-dialog__body{overflow:auto}.variants-app .history-layout{min-height:0}.variants-app .history-order-summary{align-items:flex-start;flex:0 0 auto;flex-wrap:wrap;gap:12px;min-height:56px;padding:10px 12px}.history-order-metrics{display:grid;grid-template-columns:repeat(3,minmax(96px,1fr));order:3;flex-basis:100%}.history-order-metrics div+div:before{display:none}.history-export{margin-left:auto}.history-records{min-height:300px;overflow:auto}.history-records-table{min-width:760px}}@media(max-width:600px){.history-order-metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.history-records-footer{gap:8px;align-items:flex-start;flex-direction:column;padding:10px 12px}.history-records-footer .el-pagination{align-self:flex-end}}
</style>
