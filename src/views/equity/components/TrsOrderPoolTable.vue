<script setup>
import TradingTable from './TradingTable.vue'

const { orders, status, riskTagMeta, underlyingCode } = defineProps({
  orders: Array,
  status: String,
  riskTagMeta: Object,
  underlyingCode: Function,
})
const emit = defineEmits(['selection-change', 'claim', 'reject', 'detail'])
</script>

<template>
      <TradingTable :data="orders" row-key="id" height="100%" class="trs-pool-trading-table" empty-text="暂无符合条件的HT请求" @selection-change="rows => emit('selection-change', rows)">
        <el-table-column v-if="status === 'pending'" type="selection" width="42" fixed="left" />
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
        <el-table-column v-if="status !== 'pending'" prop="handler" label="处理人" width="72" />
        <el-table-column v-if="status !== 'pending'" prop="processedAt" label="处理时间" width="126" />
        <el-table-column label="操作" width="154" fixed="right" align="center" class-name="trs-pool-operation-column" label-class-name="trs-pool-operation-column"><template #default="{ row }"><div v-if="status === 'pending'" class="trs-pool-row-actions"><el-button link type="primary" @click="emit('claim', [row.id])">认领</el-button><el-button link type="primary" @click="emit('claim', [row.id])">处理</el-button><el-button link type="danger" @click="emit('reject', [row.id])">拒单</el-button></div><el-button v-else link class="trs-pool-view" @click="emit('detail', row)">查看</el-button></template></el-table-column>
      </TradingTable>
</template>
