<script setup>
import TradingTable from './TradingTable.vue'
import ColumnConfigPopover from './ColumnConfigPopover.vue'

const { pagedDoneOrders, doneColumnOptions, doneColumnDefaults, doneStatusLabel, doneOrderInputValue, doneOrderOutputValue, doneSystemOrderValue, doneSystemOrderPrice, doneSystemOrderInputValue, doneSystemOrderDealAmount, doneSystemOrderDealQuantity, doneSystemOrderStatus, doneDealNo, doneDealPrice, doneDealQuantity } = defineProps({
  pagedDoneOrders: Array,
  doneColumnOptions: Array,
  doneColumnDefaults: Array,
  doneStatusLabel: Object,
  doneOrderInputValue: Function,
  doneOrderOutputValue: Function,
  doneSystemOrderValue: Function,
  doneSystemOrderPrice: Function,
  doneSystemOrderInputValue: Function,
  doneSystemOrderDealAmount: Function,
  doneSystemOrderDealQuantity: Function,
  doneSystemOrderStatus: Function,
  doneDealNo: Function,
  doneDealPrice: Function,
  doneDealQuantity: Function,
})
const visibleDoneColumnKeys = defineModel('visibleDoneColumnKeys', { type: Array })
const emit = defineEmits(['selection-change', 'history', 'send-email', 'deal-update'])
</script>

<template>
      <TradingTable class="trs-done-trading-table" :data="pagedDoneOrders" row-key="id" height="100%" border :fit="false" empty-text="暂无已办订单" @selection-change="rows => emit('selection-change', rows)">
        <el-table-column type="selection" width="42" align="center" />
        <template v-for="columnKey in visibleDoneColumnKeys" :key="columnKey">
          <el-table-column v-if="columnKey === 'customerInfo'" label="客户信息">
            <el-table-column prop="customer" label="客户名" width="118" />
            <el-table-column prop="customerCode" label="客户编号" width="106" />
            <el-table-column label="订单状态" width="88" align="center" class-name="trs-done-status-cell" label-class-name="trs-done-status-cell"><template #default="{ row }"><span class="trs-done-status-tag" :class="`is-${row.status}`">{{ doneStatusLabel[row.status] }}</span></template></el-table-column>
            <el-table-column prop="account" label="交易账户" width="130" show-overflow-tooltip />
            <el-table-column label="交易类型" width="76" align="center"><template #default>新单</template></el-table-column>
          </el-table-column>
          <el-table-column v-else-if="columnKey === 'customerOrder'" label="客户下单信息">
            <el-table-column label="交易类型" width="76" align="center"><template #default>新单</template></el-table-column>
            <el-table-column prop="underlying" label="标的物" width="126" show-overflow-tooltip />
            <el-table-column prop="direction" label="方向" width="60" align="center" />
            <el-table-column prop="attribute" label="订单属性" width="76" align="center" />
            <el-table-column prop="price" label="订单价格" width="88" align="right" />
            <el-table-column label="订单数量/金额" width="114" align="right"><template #default="{ row }">{{ doneOrderInputValue(row) }}</template></el-table-column>
            <el-table-column label="下单金额/预估数量" width="132" align="right"><template #default="{ row }">{{ doneOrderOutputValue(row) }}</template></el-table-column>
            <el-table-column prop="submittedAt" label="提交时间" width="154" />
            <el-table-column prop="remark" label="备注" width="180" show-overflow-tooltip />
          </el-table-column>
          <el-table-column v-else-if="columnKey === 'traderOrder'" label="交易员下单信息">
            <el-table-column label="上手方" width="104" show-overflow-tooltip><template #default="{ row }">{{ doneSystemOrderValue(row, line => line.counterparty || '线下单') }}</template></el-table-column>
            <el-table-column label="算法" width="76" align="center"><template #default="{ row }">{{ doneSystemOrderValue(row, line => line.strategy || '--') }}</template></el-table-column>
            <el-table-column label="下单账户" width="132" show-overflow-tooltip><template #default="{ row }">{{ doneSystemOrderValue(row, line => line.account || '--') }}</template></el-table-column>
            <el-table-column label="订单属性" width="76" align="center"><template #default="{ row }">{{ doneSystemOrderValue(row, line => line.orderType === 'market' ? '市价单' : '限价单') }}</template></el-table-column>
            <el-table-column label="订单价格" width="88" align="right"><template #default="{ row }">{{ doneSystemOrderValue(row, doneSystemOrderPrice) }}</template></el-table-column>
            <el-table-column label="订单数量/金额" width="114" align="right"><template #default="{ row }">{{ doneSystemOrderValue(row, doneSystemOrderInputValue, '/') }}</template></el-table-column>
            <el-table-column label="成交金额" width="132" align="right"><template #default="{ row }">{{ doneSystemOrderValue(row, doneSystemOrderDealAmount) }}</template></el-table-column>
            <el-table-column label="成交数量" width="110" align="right"><template #default="{ row }">{{ doneSystemOrderValue(row, doneSystemOrderDealQuantity) }}</template></el-table-column>
            <el-table-column label="方向" width="60" align="center"><template #default="{ row }">{{ doneSystemOrderValue(row, line => line.side === 'sell' ? '卖出' : '买入') }}</template></el-table-column>
            <el-table-column label="订单状态" width="88" align="center"><template #default="{ row }">{{ doneSystemOrderStatus(row) }}</template></el-table-column>
          </el-table-column>
          <el-table-column v-else-if="columnKey === 'dealInfo'" label="成交信息">
            <el-table-column label="成交编号" width="148" show-overflow-tooltip><template #default="{ row }">{{ doneDealNo(row) }}</template></el-table-column>
            <el-table-column label="成交价格" width="102" align="right"><template #default="{ row }">{{ doneDealPrice(row) }}</template></el-table-column>
            <el-table-column label="成交数量" width="116" align="right"><template #default="{ row }">{{ doneDealQuantity(row) }}</template></el-table-column>
          </el-table-column>
        </template>
        <el-table-column prop="orderNo" label="订单编号" width="154" />
        <el-table-column label="历史" width="52" align="center" header-align="center" class-name="history-column" label-class-name="history-column"><template #default="{ row }"><button type="button" class="history-view" @click.stop="emit('history', row)">查看</button></template></el-table-column>
        <el-table-column label="操作" width="154" fixed="right" :resizable="false" align="center" header-align="center" class-name="operation-column trs-done-actions-cell" label-class-name="operation-column trs-done-actions-cell"><template #header><span class="trs-done-operation-header"><span>操作</span><ColumnConfigPopover v-model="visibleDoneColumnKeys" :options="doneColumnOptions" :defaults="doneColumnDefaults" /></span></template><template #default="{ row }"><span class="trs-done-row-actions"><el-button link :disabled="row.status !== 'feedbackCompleted'" @click="emit('send-email', row)">发送邮件</el-button><el-button v-if="row.status === 'feedbackCompleted'" link type="primary" @click="emit('deal-update', row)">更新成交信息</el-button></span></template></el-table-column>
      </TradingTable>
</template>
