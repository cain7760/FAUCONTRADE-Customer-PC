<script setup>
import TradingTable from './TradingTable.vue'
import { canUseMarketOrder } from '../orderMarketRules.js'

const { activeOrder, splitInputLabel, splitCounterparties, isEditingSystemOrder, formatSplitValue } = defineProps({
  activeOrder: Object,
  splitInputLabel: String,
  splitCounterparties: Array,
  isEditingSystemOrder: Function,
  formatSplitValue: Function,
})
const systemOrderEditDraft = defineModel('systemOrderEditDraft')
const emit = defineEmits(['save', 'cancel-edit', 'edit', 'cancel-line'])
</script>

<template>
            <TradingTable class="trs-split-details-table" :data="activeOrder.systemOrders || []" height="100%" empty-text="暂无下单数据">
              <el-table-column label="上手方" width="100" align="left" header-align="left" show-overflow-tooltip><template #default="{ row }"><el-select v-if="isEditingSystemOrder(row)" v-model="systemOrderEditDraft.counterparty" class="trs-line-edit-control" :disabled="activeOrder.standard === '非标'"><el-option v-for="option in splitCounterparties" :key="option.value" :label="option.label" :value="option.value" /></el-select><template v-else>{{ row.counterparty || '线下单' }}</template></template></el-table-column>
              <el-table-column label="算法" width="68" align="left" header-align="left"><template #default="{ row }"><el-select v-if="isEditingSystemOrder(row)" v-model="systemOrderEditDraft.strategy" class="trs-line-edit-control"><el-option label="DMA" value="DMA" /><el-option label="TWAP" value="TWAP" /><el-option label="POV" value="POV" /></el-select><template v-else>{{ row.strategy }}</template></template></el-table-column>
              <el-table-column label="下单账户" width="156" align="left" header-align="left" show-overflow-tooltip><template #default="{ row }"><el-input v-if="isEditingSystemOrder(row)" v-model="systemOrderEditDraft.account" class="trs-line-edit-control" /><template v-else>{{ row.account }}</template></template></el-table-column>
              <el-table-column label="订单属性" width="80" align="left" header-align="left"><template #default="{ row }"><el-select v-if="isEditingSystemOrder(row)" v-model="systemOrderEditDraft.orderType" class="trs-line-edit-control"><el-option label="限价单" value="limit" /><el-option v-if="canUseMarketOrder(activeOrder)" label="市价单" value="market" /></el-select><template v-else>{{ row.orderType === 'market' ? '市价单' : '限价单' }}</template></template></el-table-column>
              <el-table-column label="订单价格" width="80" align="left" header-align="left"><template #default="{ row }"><el-input-number v-if="isEditingSystemOrder(row)" v-model="systemOrderEditDraft.price" class="trs-line-edit-control" :min="0" :precision="2" :controls="false" /><template v-else>{{ row.orderType === 'market' ? '--' : Number(row.price || 0).toFixed(2) }}</template></template></el-table-column>
              <el-table-column :label="splitInputLabel" width="98" align="right" header-align="right"><template #default="{ row }"><el-input-number v-if="isEditingSystemOrder(row)" :model-value="row.orderValueMode === 'amount' ? systemOrderEditDraft.inputAmount : systemOrderEditDraft.quantity" class="trs-line-edit-control" :min="0" :precision="2" :controls="false" @update:model-value="value => row.orderValueMode === 'amount' ? systemOrderEditDraft.inputAmount = value : systemOrderEditDraft.quantity = value" /><template v-else>{{ row.orderValueMode === 'amount' ? formatSplitValue(row.inputAmount, true) : Number(row.quantity || 0).toFixed(2) }}</template></template></el-table-column>
              <el-table-column label="成交金额" width="144" align="right" header-align="right" show-overflow-tooltip><template #default="{ row }">{{ row.orderStatus === '已成交' ? row.deal?.nominalPrincipal || '--' : '--' }}</template></el-table-column>
              <el-table-column label="成交数量" width="100" align="right" header-align="right"><template #default="{ row }">{{ row.orderStatus === '已成交' ? row.deal?.counterpartyQuantity || '--' : '--' }}</template></el-table-column>
              <el-table-column label="方向" width="56" align="left" header-align="left"><template #default="{ row }"><el-select v-if="isEditingSystemOrder(row)" v-model="systemOrderEditDraft.side" class="trs-line-edit-control"><el-option label="买入" value="buy" /><el-option label="卖出" value="sell" /></el-select><template v-else>{{ row.side === 'sell' ? '卖出' : '买入' }}</template></template></el-table-column>
              <el-table-column label="订单状态" width="72" align="left" header-align="left"><template #default="{ row }"><span class="trs-split-order-status" :class="{ 'is-filled': row.orderStatus === '已成交', 'is-rejected': row.orderStatus === '拒绝', 'is-exception': row.orderStatus === '异常' }">{{ row.orderStatus || '委托中' }}</span></template></el-table-column>
              <el-table-column label="操作" min-width="112" align="left" header-align="left"><template #default="{ row }"><span class="trs-detail-row-actions"><template v-if="isEditingSystemOrder(row)"><el-button link type="primary" @click="emit('save', row)">保存</el-button><el-button link @click="emit('cancel-edit')">取消</el-button></template><template v-else-if="row.orderStatus === '委托中'"><el-button link type="primary" @click="emit('edit', row)">改单</el-button><el-button link type="danger" @click="emit('cancel-line', row)">撤单</el-button></template><span v-else>--</span></span></template></el-table-column>
            </TradingTable>
</template>
