<script setup>
import { inject } from 'vue'
import { ArrowDownBold, Search, View, Hide, Close } from '@element-plus/icons-vue'
import { accounts } from '../fixtures'
import { marketInstruments, money, number, price as formatPrice } from '../variantData'
import { tradingContextKey } from '../tradingContext'
import BaseDialog from '../../../components/BaseDialog.vue'
import OrderBook from '../components/OrderBook.vue'
import OrderTicket from '../components/OrderTicket.vue'
import ClosePositionDialog from '../components/ClosePositionDialog.vue'
import ChaseOrderDialog from '../components/ChaseOrderDialog.vue'
import AmendOrderDialog from '../components/AmendOrderDialog.vue'
import OrderHistoryDialog from '../components/OrderHistoryDialog.vue'
import PositionsTable from '../components/PositionsTable.vue'
import OrdersTable from '../components/OrdersTable.vue'
import TradesTable from '../components/TradesTable.vue'
const {
  assetUrl, systemRunning, transactionToasts, messageIcon, dismissTransactionToast, tradeStatusVisual, tradeStatusLabel,
  allAccountsValue, workspace, selectedAccountIds, globalAccountSearch, filteredGlobalAccounts, accountLabel,
  updateGlobalAccountSelection, handleGlobalAccountVisible, tab, allRows, orders, trades, collapsed,
  dock, dragging, resizing, floating, start, startResize, floatStyle, isTicketLayoutModified, resetTicketLayout,
  selected, selectedCode, quote, ticketResetKey, ticketContext, account, selectTicketAccount, acceptOrder,
  assetsVisible, assetsCollapsed, assetAmountParts, realtimeAvailable, portfolioMarketValue, portfolioFloatingPnl,
  floatingPnlClass, toggleAssetsVisible, toggleSystemStatus,
  closePositionVisible, closingPosition, closingAccount, acceptClosePosition,
  chaseOrderVisible, chasingPosition, chasingOrder, chasingAccount, acceptChaseOrder,
  amendOrderVisible, amendingOrder, amendingSymbol, amendingAccount, acceptAmendOrder,
  historyVisible, historyRecord, convertManualVisible, convertingManualOrder, conversionRemark,
  marketLabel, confirmConvertToManual, cancelOrderVisible, cancelingOrder, cancelableQuantity, confirmCancelOrder,
} = inject(tradingContextKey)
</script>

<template>
    <aside class="transaction-toast-stack" aria-live="polite" aria-label="订单结果提示">
      <transition-group name="transaction-toast">
        <article v-for="toast in transactionToasts" :key="toast.message.id" class="transaction-toast-card">
          <header><span class="transaction-toast-type"><img :src="messageIcon('消息')" alt="">权益交易 · 订单回报</span><span class="transaction-toast-countdown">{{ toast.remaining }}s 后自动关闭</span><button type="button" :aria-label="`关闭${toast.message.title}`" @click="dismissTransactionToast(toast.message.id)"><el-icon><Close /></el-icon></button></header>
          <p class="transaction-toast-instrument"><span>{{ toast.message.trade.name }}</span><small>（{{ toast.message.trade.code }}）</small><em :class="`is-${tradeStatusVisual(toast.message.trade.status).tone}`"><el-icon><component :is="tradeStatusVisual(toast.message.trade.status).icon" /></el-icon>{{ tradeStatusLabel(toast.message.trade.status) }}</em></p>
          <dl class="transaction-toast-metrics"><div><dt>{{ toast.message.trade.quantityLabel || '成交数量' }}</dt><dd>{{ toast.message.trade.quantity ? `${number(toast.message.trade.quantity)} 股` : '--' }}</dd></div><div><dt>{{ toast.message.trade.priceLabel || '成交均价' }}</dt><dd>{{ toast.message.trade.price !== null ? `${money(toast.message.trade.price)} CNY` : '--' }}</dd></div></dl>
        </article>
      </transition-group>
    </aside>
    <div ref="workspace" class="variants-workspace" :class="[`dock-${dock}`,{'ticket-collapsed':collapsed,'is-dragging':dragging}]">
      <section class="positions-pane workspace-panel">
        <header class="positions-tabs"><button :class="{active:tab==='positions'}" @click="tab='positions'">所有持仓<span>({{ allRows.length }})</span></button><button :class="{active:tab==='orders'}" @click="tab='orders'">所有订单<span>({{ orders.length }})</span></button><button :class="{active:tab==='trades'}" @click="tab='trades'">所有成交<span>({{ trades.length }})</span></button><el-select v-model="selectedAccountIds" class="global-account-filter" multiple collapse-tags :max-collapse-tags="1" placeholder="下单账户" aria-label="全局下单账户筛选" popper-class="variant-popper global-account-popper" :offset="2" @visible-change="handleGlobalAccountVisible" @change="updateGlobalAccountSelection"><template #header><div class="account-dropdown-search" @click.stop><el-input v-model="globalAccountSearch" :prefix-icon="Search" placeholder="搜索下单账户" clearable /></div></template><el-option label="全部账户" :value="allAccountsValue" /><el-option v-for="option in filteredGlobalAccounts" :key="option.id" :label="accountLabel(option.id)" :value="option.id" /></el-select><button v-if="collapsed" class="workspace-restore-ticket" @click="collapsed=false"><img class="restore-panel-icon" :src="assetUrl('panel-expand.svg')" alt=""><span class="restore-panel-label">展开下单面板</span></button></header>
        <PositionsTable v-if="tab==='positions'" />
        <OrdersTable v-else-if="tab==='orders'" />
        <TradesTable v-else />
      </section>
      <section class="trade-dock is-portfolio-summary" :class="{floating:dock==='floating', resizing, 'assets-collapsed':assetsCollapsed}" :style="floatStyle">
        <OrderBook v-show="!collapsed" :symbol="selected" :compact="dock === 'bottom'" hide-ticks roomy-depth @drag="start" @quote="value=>{quote=value;collapsed=false}" />
        <section v-show="!collapsed" class="ticket-pane workspace-panel">
          <header class="module-heading drag-heading" @pointerdown="start"><span class="drag-title"><span class="drag-grip" aria-hidden="true"><i v-for="n in 8" :key="n" /></span><h2>交易订单</h2></span><span class="ticket-layout-actions"><el-tooltip v-if="isTicketLayoutModified" content="将面板重置到默认位置" placement="top" popper-class="ticket-reset-popper"><button type="button" aria-label="将面板重置到默认位置" class="reset-ticket-layout" @pointerdown.stop @click="resetTicketLayout"><svg class="reset-layout-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 2.5H2.5V6m7.5-3.5h3.5V6M10 13.5h3.5V10M6 13.5H2.5V10M5 8h6m-2.5-2.5L11 8l-2.5 2.5" /></svg></button></el-tooltip><button aria-label="收起交易区域" class="collapse-ticket" @pointerdown.stop @click="collapsed=true"><img :src="assetUrl('panel-collapse.svg')" alt=""></button></span></header>
          <OrderTicket :key="ticketResetKey" :instruments="marketInstruments" :accounts="accounts" :symbol="selected" :account="account" :quote="quote" :paused="!systemRunning" :ticket-context="ticketContext" @account-select="selectTicketAccount" @select="code=>{ selectedCode=code; if (!code) quote=null }" @order="acceptOrder" />
        </section>
        <section v-show="!collapsed" class="compact-assets ticket-assets is-portfolio-summary" :class="{ 'is-collapsed': assetsCollapsed }" aria-label="账户资金"><div class="asset-summary-heading"><span>资产账户概要</span><button class="asset-visibility" type="button" :aria-label="assetsVisible ? '隐藏资金数值' : '查看资金数值'" @click="toggleAssetsVisible"><el-icon><View v-if="assetsVisible" /><Hide v-else /></el-icon></button><button class="asset-collapse" type="button" :aria-label="assetsCollapsed ? '展开资产账户概要' : '收起资产账户概要'" @click="assetsCollapsed=!assetsCollapsed"><el-icon><ArrowDownBold /></el-icon></button></div><div v-show="!assetsCollapsed" class="asset-summary-grid"><div class="asset-metric asset-available"><span>大账户实时可用</span><el-tooltip v-if="assetsVisible" placement="top" popper-class="asset-value-popper"><template #content><span class="asset-large-value"><template v-for="part in assetAmountParts(realtimeAvailable)" :key="`${part.value}${part.unit}`"><b>{{ part.value }}</b><i v-if="part.unit">{{ part.unit }}</i></template></span></template><b class="asset-number">{{ money(realtimeAvailable) }}</b></el-tooltip><b v-else class="asset-number">••••••••</b><small>CNY</small></div><div class="asset-metric"><span>持仓市值</span><el-tooltip v-if="assetsVisible" placement="top" popper-class="asset-value-popper"><template #content><span class="asset-large-value"><template v-for="part in assetAmountParts(portfolioMarketValue)" :key="`${part.value}${part.unit}`"><b>{{ part.value }}</b><i v-if="part.unit">{{ part.unit }}</i></template></span></template><b class="asset-number">{{ money(portfolioMarketValue) }}</b></el-tooltip><b v-else class="asset-number">••••••••</b><small>CNY</small></div><div class="asset-metric"><span>浮动盈亏</span><el-tooltip v-if="assetsVisible" placement="top" popper-class="asset-value-popper"><template #content><span class="asset-large-value"><template v-for="part in assetAmountParts(portfolioFloatingPnl)" :key="`${part.value}${part.unit}`"><b>{{ part.value }}</b><i v-if="part.unit">{{ part.unit }}</i></template></span></template><b class="asset-number" :class="floatingPnlClass">{{ money(portfolioFloatingPnl) }}</b></el-tooltip><b v-else class="asset-number">••••••••</b><small>CNY</small></div></div></section>
        <button v-if="dock === 'floating'" type="button" class="floating-resize-handle" aria-label="调整下单面板高度" @pointerdown="startResize"><span></span></button>
      </section>
      <div v-if="dragging" class="dock-targets"><div class="dock-target target-left">停靠左侧</div><div class="dock-target target-right">停靠右侧</div><div class="dock-target target-bottom">停靠底部</div><span class="float-instruction">拖至边缘停靠 · 放在中间悬浮</span></div>
    </div>
    <footer class="variant-status"><span class="system-status"><i class="status-dot" :class="{ 'is-interrupted': !systemRunning }"/>{{ systemRunning ? '运行中' : '系统中断' }} · 演示环境<button type="button" class="system-status-toggle" @click="toggleSystemStatus">{{ systemRunning ? '切换为中断' : '恢复运行' }}</button></span><span>行情：静态快照</span><span class="status-end">系统版本：方案 V0.2</span></footer>
    <ClosePositionDialog v-model="closePositionVisible" :position="closingPosition" :account="closingAccount" :paused="!systemRunning" @submit="acceptClosePosition" />
    <ChaseOrderDialog :paused="!systemRunning" v-model="chaseOrderVisible" :position="chasingPosition" :order="chasingOrder" :account="chasingAccount" @submit="acceptChaseOrder" />
    <AmendOrderDialog v-model="amendOrderVisible" :order="amendingOrder" :symbol="amendingSymbol" :account="amendingAccount" @submit="acceptAmendOrder" />
    <OrderHistoryDialog v-model="historyVisible" :record="historyRecord" />
    <BaseDialog v-model="convertManualVisible" width="680px" align-center append-to-body class="variant-confirm convert-manual-dialog" title="转为手工单" :close-on-press-escape="false">
      <template v-if="convertingManualOrder">
        <p class="convert-manual-intro">转为手工单后，将由交易员直接接入审核；订单编号、价格、数量及异常状态保持不变。</p>
        <el-descriptions class="convert-manual-details" :column="2" border size="small" aria-label="待转换订单信息">
          <el-descriptions-item label="订单编号">{{ convertingManualOrder.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="下单账户">{{ accountLabel(convertingManualOrder.account) }}</el-descriptions-item>
          <el-descriptions-item label="标的">{{ convertingManualOrder.name }}（{{ convertingManualOrder.code }}.{{ convertingManualOrder.market }}）</el-descriptions-item>
          <el-descriptions-item label="市场">{{ marketLabel(convertingManualOrder.market) }}</el-descriptions-item>
          <el-descriptions-item label="交易方向"><span :class="convertingManualOrder.side === 'buy' ? 'is-buy' : 'is-sell'">{{ convertingManualOrder.side === 'buy' ? '买入' : '卖出' }}</span> · {{ convertingManualOrder.openClose === '开' ? '开仓' : '平仓' }}</el-descriptions-item>
          <el-descriptions-item label="原订单类型">{{ convertingManualOrder.orderType }} · {{ convertingManualOrder.attribute || '--' }}</el-descriptions-item>
          <el-descriptions-item label="执行算法">{{ convertingManualOrder.algorithm || '--' }}</el-descriptions-item>
          <el-descriptions-item label="订单价格">{{ convertingManualOrder.price === null ? '市价' : formatPrice(convertingManualOrder.price, convertingManualOrder.market) }}</el-descriptions-item>
          <el-descriptions-item label="订单数量">{{ number(convertingManualOrder.quantity) }} 股</el-descriptions-item>
          <el-descriptions-item label="订单金额">{{ money(convertingManualOrder.estimate) }} CNY</el-descriptions-item>
          <el-descriptions-item label="订单状态">{{ convertingManualOrder.status }}</el-descriptions-item>
          <el-descriptions-item label="下单时间">{{ convertingManualOrder.orderTime }}</el-descriptions-item>
          <el-descriptions-item label="异常原因" :span="2">{{ convertingManualOrder.feedback || '系统处理异常' }}</el-descriptions-item>
          <el-descriptions-item label="原下单备注" :span="2">{{ convertingManualOrder.orderRemark || '--' }}</el-descriptions-item>
        </el-descriptions>
        <label class="convert-manual-remark" for="convert-manual-remark">手工单备注<el-input id="convert-manual-remark" v-model="conversionRemark" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="请输入备注，供交易员处理时参考" /></label>
      </template>
      <template #footer><el-button @click="convertManualVisible=false; conversionRemark=''">取消[Esc]</el-button><el-button type="primary" @click="confirmConvertToManual">确认转换[Enter]</el-button></template>
    </BaseDialog>
    <BaseDialog v-model="cancelOrderVisible" width="360px" class="variant-confirm order-cancel-dialog" title="撤单确认" :teleported="false" :close-on-press-escape="false">
      <template v-if="cancelingOrder">
        <section class="order-cancel-summary" aria-label="待撤订单摘要">
          <header class="order-cancel-summary-head">
            <div><strong>{{ cancelingOrder.name }}({{ cancelingOrder.code }})</strong></div>
          </header>
          <div class="order-cancel-summary-metrics">
            <div><span>订单价格</span><b :class="{ 'is-market': cancelingOrder.price === null }">{{ cancelingOrder.price === null ? '市价' : money(cancelingOrder.price) }}</b><small v-if="cancelingOrder.price === null">以市场价格成交</small></div>
            <div><span>订单数量</span><b>{{ number(cancelableQuantity(cancelingOrder)) }}</b></div>
          </div>
        </section>
        <dl class="order-cancel-details" aria-label="订单信息">
          <div><dt>订单编号</dt><dd>{{ cancelingOrder.orderNo }}</dd></div>
          <div><dt>下单账户</dt><dd>{{ accountLabel(cancelingOrder.account) }}</dd></div>
          <div><dt>开平方向</dt><dd>{{ cancelingOrder.openClose === '开' ? '开仓' : '平仓' }}</dd></div>
          <div><dt>买卖方向</dt><dd :class="cancelingOrder.side === 'buy' ? 'up' : 'down'">{{ cancelingOrder.side === 'buy' ? '买入' : '卖出' }}</dd></div>
          <div><dt>订单方式</dt><dd>{{ cancelingOrder.type === 'market' ? '市价单' : '限价单' }}</dd></div>
        </dl>
      </template>
      <template #footer><el-button @click="cancelOrderVisible=false">取消[Esc]</el-button><el-button type="primary" @click="confirmCancelOrder">确认撤单[Enter]</el-button></template>
    </BaseDialog>
</template>
