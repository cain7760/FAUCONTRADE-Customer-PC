<script setup>
import { computed, ref } from 'vue'
import { RefreshLeft, Search } from '@element-plus/icons-vue'
import BaseDialog from '../../../components/BaseDialog.vue'
import TrsApprovalDialog from './TrsApprovalDialog.vue'
import TradingFilterField from './TradingFilterField.vue'
import TradingTable from './TradingTable.vue'
import { positions } from '../fixtures'
import { claimPoolOrders, movePoolOrdersToTrader, poolOrders, traderHtOrders } from '../trsOrderStore'

const emit = defineEmits(['open-my-orders', 'export'])
const poolStatus = ref('pending')
const filtersExpanded = ref(false)
const selectedIds = ref([])
const filters = ref({ customer: '', orderNo: '', underlying: '', tradeType: '', customerCode: '', standard: '', direction: '' })
const approvalVisible = ref(false)
const rejectionVisible = ref(false)
const detailVisible = ref(false)
const approvalIds = ref([])
const rejectionIds = ref([])
const detailOrder = ref(null)
const rejectionReason = ref('')
const rejectionError = ref('')

const orders = poolOrders
const traderOrders = traderHtOrders

const statusMeta = { pending: '待处理', processing: '处理中', processed: '已处理' }
const riskTagMeta = { approved: '风控审批通过', rejected: '风控审批驳回' }
const statusOrders = status => status === 'pending' ? orders.value : traderOrders.value.filter(order => order.status === status)
const countByStatus = status => statusOrders(status).length
const selectedPendingOrders = computed(() => visibleOrders.value.filter(order => selectedIds.value.includes(order.id)))
const canBatchReject = computed(() => selectedPendingOrders.value.length > 0 && !selectedPendingOrders.value.some(order => order.riskTag === 'rejected'))
const underlyingCode = order => order.code || positions.find(position => position.name === order.underlying)?.code || '--'
const visibleOrders = computed(() => statusOrders(poolStatus.value).filter(order => {
  const matches = (value, query) => !query || value.toLowerCase().includes(query.trim().toLowerCase())
  return order.status === poolStatus.value
    && matches(order.customer, filters.value.customer)
    && matches(order.orderNo, filters.value.orderNo)
    && matches(order.underlying, filters.value.underlying)
    && matches(order.customerCode, filters.value.customerCode)
    && (!filters.value.tradeType || order.tradeType === filters.value.tradeType)
    && (!filters.value.standard || order.standard === filters.value.standard)
    && (!filters.value.direction || order.direction === filters.value.direction)
}))

function resetFilters() {
  filters.value = { customer: '', orderNo: '', underlying: '', tradeType: '', customerCode: '', standard: '', direction: '' }
}
function claim(ids = selectedIds.value) {
  if (!ids.length) return
  claimPoolOrders(ids)
  selectedIds.value = []
  emit('open-my-orders')
}
function openApproval(ids = selectedIds.value) {
  if (!ids.length) return
  approvalIds.value = [...ids]
  approvalVisible.value = true
}
function submitApproval(approval) {
  movePoolOrdersToTrader(approvalIds.value, { status: 'processing', handler: '审批中', processedAt: '2026-09-22 10:08:20', approval })
  selectedIds.value = []
  approvalVisible.value = false
  poolStatus.value = 'processing'
}
function openReject(ids = selectedIds.value) {
  if (!ids.length) return
  rejectionIds.value = [...ids]
  rejectionReason.value = ''
  rejectionError.value = ''
  rejectionVisible.value = true
}
function confirmReject() {
  if (!rejectionReason.value.trim()) { rejectionError.value = '请填写拒单原因'; return }
  if (!rejectionIds.value.length) return
  movePoolOrdersToTrader(rejectionIds.value, { status: 'processed', handler: 'Kevin Zhang', processedAt: '2026-09-22 10:08:20', rejectionReason: rejectionReason.value.trim() })
  selectedIds.value = []
  rejectionVisible.value = false
  poolStatus.value = 'processed'
}
function openDetail(order) {
  detailOrder.value = order
  detailVisible.value = true
}
</script>

<template>
  <section class="trs-order-pool" aria-label="HT请求订单池">
    <header class="trs-pool-tabbar">
      <nav aria-label="订单池状态">
        <button v-for="status in ['pending', 'processing', 'processed']" :key="status" type="button" :class="{ active: poolStatus === status }" @click="poolStatus = status; selectedIds = []">{{ statusMeta[status] }}<span>({{ countByStatus(status) }})</span></button>
      </nav>
      <el-button type="primary" class="trs-my-orders-entry" @click="emit('open-my-orders')">我的HT订单<span>({{ countByStatus('processing') }})</span></el-button>
    </header>

    <section class="trs-pool-filter" :class="{ expanded: filtersExpanded }" aria-label="订单池筛选条件">
      <TradingFilterField label="客户名"><el-input v-model="filters.customer" placeholder="请输入" clearable /></TradingFilterField>
      <TradingFilterField label="订单编号"><el-input v-model="filters.orderNo" placeholder="请输入" clearable /></TradingFilterField>
      <TradingFilterField label="标的搜索"><el-input v-model="filters.underlying" placeholder="请输入" clearable /></TradingFilterField>
      <TradingFilterField label="交易类型"><el-select v-model="filters.tradeType" placeholder="请选择" clearable popper-class="variant-popper trading-filter-popper"><el-option label="新单" value="新单" /><el-option label="改单" value="改单" /><el-option label="撤单" value="撤单" /></el-select></TradingFilterField>
      <template v-if="filtersExpanded">
        <TradingFilterField label="客户编号"><el-input v-model="filters.customerCode" placeholder="请输入" clearable /></TradingFilterField>
        <TradingFilterField label="订单类型"><el-select v-model="filters.standard" placeholder="请选择" clearable popper-class="variant-popper trading-filter-popper"><el-option label="标准" value="标准" /><el-option label="非标" value="非标" /></el-select></TradingFilterField>
        <TradingFilterField label="方向"><el-select v-model="filters.direction" placeholder="请选择" clearable popper-class="variant-popper trading-filter-popper"><el-option label="买入" value="买入" /><el-option label="卖出" value="卖出" /></el-select></TradingFilterField>
      </template>
      <div class="trs-pool-filter-actions"><button type="button" class="is-primary"><el-icon><Search /></el-icon>查询</button><button type="button" @click="resetFilters"><el-icon><RefreshLeft /></el-icon>重置</button><button type="button" class="is-link" @click="filtersExpanded = !filtersExpanded">{{ filtersExpanded ? '收起' : '展示更多' }}</button></div>
    </section>

    <div class="trs-pool-toolbar">
      <div v-if="poolStatus === 'pending'" class="trs-pool-actions"><el-button type="primary" :disabled="!selectedIds.length" @click="claim()">批量认领</el-button><button type="button" :disabled="!canBatchReject" class="is-danger" @click="openReject()">批量拒单</button></div>
      <p v-else>{{ poolStatus === 'processing' ? '处理中订单已由交易员认领。' : '已处理订单仅供查询。' }}</p>
      <el-tooltip content="导出当前筛选结果" placement="top"><button type="button" class="trs-pool-export" aria-label="导出订单池" @click="emit('export', visibleOrders)"><el-icon><svg class="export-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M4 11v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/></svg></el-icon></button></el-tooltip>
    </div>

    <div class="trs-pool-table-wrap">
      <TradingTable :key="poolStatus" :data="visibleOrders" row-key="id" height="100%" class="trs-pool-trading-table" empty-text="暂无符合条件的HT请求" @selection-change="rows => selectedIds = rows.map(row => row.id)">
        <el-table-column v-if="poolStatus === 'pending'" type="selection" width="42" fixed="left" />
        <el-table-column prop="customer" label="客户名" width="88" />
        <el-table-column prop="customerCode" label="客户编号" width="90" />
        <el-table-column prop="account" label="交易账户" min-width="108" show-overflow-tooltip />
        <el-table-column prop="tradeType" label="交易类型" width="66" />
        <el-table-column label="订单标签" width="112" align="center"><template #default="{ row }"><span v-if="row.riskTag" class="trs-risk-tag" :class="`is-${row.riskTag}`">{{ riskTagMeta[row.riskTag] }}</span><span v-else>--</span></template></el-table-column>
        <el-table-column label="订单类型" width="64" align="center"><template #default="{ row }"><span class="trs-type-tag" :class="row.standard === '非标' ? 'is-nonstandard' : ''">{{ row.standard }}</span></template></el-table-column>
        <el-table-column label="标的物名称" width="176" show-overflow-tooltip><template #default="{ row }">{{ `${row.underlying}（${underlyingCode(row)}）` }}</template></el-table-column>
        <el-table-column label="方向" width="52" align="center"><template #default="{ row }"><span :class="row.direction === '买入' ? 'is-buy' : 'is-sell'">{{ row.direction }}</span></template></el-table-column>
        <el-table-column prop="attribute" label="订单属性" width="64" align="center" />
        <el-table-column prop="price" label="订单价格" width="78" align="right" />
        <el-table-column prop="quantity" label="下单数量" width="70" align="right" />
        <el-table-column prop="amount" label="下单金额" width="126" align="right" />
        <el-table-column prop="submittedAt" label="提交时间" width="176" />
        <el-table-column prop="remark" label="备注" width="152" show-overflow-tooltip />
        <el-table-column prop="orderNo" label="订单编号" width="128" />
        <el-table-column v-if="poolStatus !== 'pending'" prop="handler" label="处理人" width="72" />
        <el-table-column v-if="poolStatus !== 'pending'" prop="processedAt" label="处理时间" width="126" />
        <el-table-column label="操作" width="122" fixed="right" align="center" class-name="trs-pool-operation-column" label-class-name="trs-pool-operation-column"><template #default="{ row }"><div v-if="poolStatus === 'pending'" class="trs-pool-row-actions"><el-button v-if="row.riskTag === 'rejected'" link type="primary" @click="openApproval([row.id])">转审批</el-button><template v-else><el-button link type="primary" @click="claim([row.id])">处理</el-button><el-button link type="danger" @click="openReject([row.id])">拒单</el-button></template></div><el-button v-else link class="trs-pool-view" @click="openDetail(row)">查看</el-button></template></el-table-column>
      </TradingTable>
    </div>
    <footer class="trs-pool-pagination"><span>共 {{ visibleOrders.length }} 条</span><el-pagination small background layout="prev, pager, next" :total="visibleOrders.length" :page-size="10" /></footer>

    <TrsApprovalDialog v-model="approvalVisible" @submit="submitApproval" />
    <BaseDialog v-model="rejectionVisible" title="拒绝订单" width="480px" align-center append-to-body class="trs-action-dialog"><div class="trs-action-dialog-body"><p>拒单后订单将转入已处理记录，请确认拒绝原因。</p><label class="trs-action-field is-required">拒绝原因<el-input v-model="rejectionReason" type="textarea" :rows="4" maxlength="300" show-word-limit placeholder="请填写拒单原因" /></label><p v-if="rejectionError" class="trs-action-validation is-error">{{ rejectionError }}</p></div><template #footer><el-button @click="rejectionVisible = false">取消[Esc]</el-button><el-button type="danger" @click="confirmReject">确认拒单[Enter]</el-button></template></BaseDialog>
    <BaseDialog v-model="detailVisible" title="HT请求详情" width="520px" align-center append-to-body class="trs-action-dialog"><div v-if="detailOrder" class="trs-action-dialog-body"><dl class="trs-pool-detail"><dt>订单编号</dt><dd>{{ detailOrder.orderNo }}</dd><dt>客户</dt><dd>{{ detailOrder.customer }}</dd><dt>标的物</dt><dd>{{ detailOrder.underlying }}</dd><dt>订单方向</dt><dd>{{ detailOrder.direction }} · {{ detailOrder.attribute }}</dd><dt>处理状态</dt><dd>{{ statusMeta[detailOrder.status] }}</dd><dt>处理人</dt><dd>{{ detailOrder.handler || '--' }}</dd><dt>处理时间</dt><dd>{{ detailOrder.processedAt || '--' }}</dd><dt>审批流</dt><dd>{{ detailOrder.approval?.chain || '--' }}</dd><dt>审批材料</dt><dd>{{ detailOrder.approval?.attachments?.join('、') || '--' }}</dd><dt>拒单原因</dt><dd>{{ detailOrder.rejectionReason || '--' }}</dd></dl></div><template #footer><el-button type="primary" @click="detailVisible = false">关闭[Esc]</el-button></template></BaseDialog>
  </section>
</template>
