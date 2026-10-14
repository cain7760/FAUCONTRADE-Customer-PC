<script setup>
import { inject } from 'vue'
import { Search, Refresh, InfoFilled } from '@element-plus/icons-vue'
import { money, price as formatPrice } from '../variantData'
import { tradingContextKey } from '../tradingContext'
import SortHeader from './SortHeader.vue'
import ColumnConfigPopover from './ColumnConfigPopover.vue'
import TradingTable from './TradingTable.vue'
import ExportDataPopover from './ExportDataPopover.vue'
const { tradeFilters, tradeSortState, tradeVisibleColumnKeys, tradeColumnOptions, tradeColumnDefaults, sortedTrades, tableRefreshKey, copyableIdentifierCellClass, handleTableCellDoubleClick, accountLabel, marketLabel, timeLabel, currencyForRow, sharesWithUnit, orderActivityHint, orderActivity, openOrderHistory, toggleTradeSort, applyTradeFilters, clearTradeFilters, confirmExport, refreshTable } = inject(tradingContextKey)
</script>

<template>
          <div class="order-filters">
            <el-input v-model="tradeFilters.symbol" :prefix-icon="Search" placeholder="标的名称 / 代码" aria-label="搜索成交标的" clearable />
            <el-select v-model="tradeFilters.side" aria-label="买卖方向筛选" popper-class="variant-popper" :offset="2"><el-option label="买卖方向" value="ALL"/><el-option label="买入" value="buy"/><el-option label="卖出" value="sell"/></el-select>
            <el-select v-model="tradeFilters.openClose" aria-label="开平类型筛选" popper-class="variant-popper" :offset="2"><el-option label="开平类型" value="ALL"/><el-option label="开仓" value="开"/><el-option label="平仓" value="平"/></el-select>
            <el-select v-model="tradeFilters.orderType" aria-label="订单类型筛选" popper-class="variant-popper" :offset="2"><el-option label="订单类型" value="ALL"/><el-option label="系统单" value="系统单"/><el-option label="手工单" value="手工单"/></el-select>
            <el-button class="filter-query" @click="applyTradeFilters">查询</el-button><el-button link @click="clearTradeFilters">重置</el-button>
            <div class="table-toolbar-actions"><el-tooltip content="刷新当前表格" placement="top"><button class="refresh-table" aria-label="刷新成交记录" @click="refreshTable"><el-icon><Refresh /></el-icon></button></el-tooltip><ExportDataPopover label="成交" @export="dateRange => confirmExport('trades', dateRange)"><button class="export-orders" aria-label="导出成交记录" title="选择时间范围后导出当前筛选结果"><el-icon><svg class="export-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M4 11v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/></svg></el-icon></button></ExportDataPopover></div>
          </div>
          <TradingTable :key="`trades-${tableRefreshKey}`" class="original-fields orders-table trades-table" :data="sortedTrades" height="100%" :fit="false" empty-text="暂无成交记录" :cell-class-name="copyableIdentifierCellClass" @cell-dblclick="handleTableCellDoubleClick">
            <el-table-column type="index" label="序号" width="44" align="center" header-align="center" class-name="order-index-column" label-class-name="order-index-column" />
            <template v-for="columnKey in tradeVisibleColumnKeys" :key="columnKey">
              <el-table-column v-if="columnKey === 'side'" prop="side" label="方向" width="64" align="left" header-align="left"><template #default="{row}"><span :class="row.side === 'buy' ? 'up' : 'down'">{{ row.side === 'buy' ? '买入' : '卖出' }}</span></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'openClose'" prop="openClose" label="开平方向" width="64" align="left" header-align="left"><template #default="{row}">{{ row.openClose === '开' ? '开仓' : '平仓' }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'code'" prop="code" label="证券代码" width="68" />
              <el-table-column v-else-if="columnKey === 'name'" prop="name" label="证券名称" width="68" />
              <el-table-column v-else-if="columnKey === 'filledPrice'" prop="filledPrice" width="76" align="right" header-align="right"><template #header><SortHeader label="成交均价" numeric :direction="tradeSortState.prop === 'filledPrice' ? tradeSortState.direction : null" @sort="toggleTradeSort('filledPrice')" /></template><template #default="{row}">{{ formatPrice(row.filledPrice, row.market) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'filledQuantity'" prop="filledQuantity" width="88" align="right" header-align="right"><template #header><SortHeader label="成交数量" numeric :direction="tradeSortState.prop === 'filledQuantity' ? tradeSortState.direction : null" @sort="toggleTradeSort('filledQuantity')" /></template><template #default="{row}">{{ sharesWithUnit(row.filledQuantity) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'filledAmount'" prop="filledAmount" width="100" align="right" header-align="right"><template #header><SortHeader label="成交金额" numeric :direction="tradeSortState.prop === 'filledAmount' ? tradeSortState.direction : null" @sort="toggleTradeSort('filledAmount')" /></template><template #default="{row}">{{ money(row.filledAmount) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'filledTime'" prop="filledTime" label="成交时间" width="80"><template #default="{row}">{{ timeLabel(row.filledTime) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'orderTime'" prop="orderTime" label="订单时间" width="80"><template #default="{row}">{{ timeLabel(row.orderTime) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'tradeNo'" prop="tradeNo" label="成交编号" width="112" />
              <el-table-column v-else-if="columnKey === 'entrustNo'" prop="entrustNo" label="订单编号" width="128" />
              <el-table-column v-else-if="columnKey === 'tradeDate'" prop="tradeDate" label="交易日期" width="90" />
              <el-table-column v-else-if="columnKey === 'account'" prop="account" label="下单账户" width="132"><template #default="{row}">{{ accountLabel(row.account) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'market'" prop="market" label="市场" width="48"><template #default="{row}">{{ marketLabel(row.market) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'currency'" prop="currency" label="币种" width="56"><template #default="{row}">{{ currencyForRow(row) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'feedback'" prop="feedback" label="订单动态" width="168" show-overflow-tooltip><template #header><span class="order-activity-heading"><span>订单动态</span><el-tooltip :content="orderActivityHint" :trigger="['hover', 'focus']" placement="top" popper-class="order-help-popper"><button type="button" class="total-help" aria-label="订单动态说明"><el-icon><InfoFilled /></el-icon></button></el-tooltip></span></template><template #default="{row}">{{ orderActivity(row) }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'orderType'" prop="orderType" label="订单类型" width="64" align="left" header-align="left"><template #default="{row}"><span class="order-type-tag" :class="row.orderType === '手工单' ? 'is-manual' : 'is-system'">{{ row.orderType || '--' }}</span></template></el-table-column>
              <el-table-column v-else-if="columnKey === 'algorithm'" prop="algorithm" label="执行算法" width="64" align="center" header-align="center"><template #default="{row}">{{ row.algorithm || '--' }}</template></el-table-column>
              <el-table-column v-else-if="columnKey === 'orderRemark'" prop="orderRemark" label="下单备注" width="128" show-overflow-tooltip><template #default="{row}">{{ row.orderRemark || '--' }}</template></el-table-column>
            </template>
            <el-table-column label="历史" width="52" align="center" header-align="center" class-name="history-column" label-class-name="history-column"><template #default="{row}"><button type="button" class="history-view" @click.stop="openOrderHistory(row)">查看</button></template></el-table-column>
            <el-table-column width="22" fixed="right" align="center" header-align="center" class-name="column-config-column" label-class-name="column-config-column"><template #header><ColumnConfigPopover v-model="tradeVisibleColumnKeys" :options="tradeColumnOptions" :defaults="tradeColumnDefaults" /></template></el-table-column>
          </TradingTable>
</template>
