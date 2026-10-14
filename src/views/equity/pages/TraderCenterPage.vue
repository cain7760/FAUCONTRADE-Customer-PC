<script setup>
import { inject } from 'vue'
import { tradingContextKey } from '../tradingContext'
import { Expand, Fold } from '@element-plus/icons-vue'
import { accounts } from '../fixtures'
import TrsMyHtOrders from '../components/TrsMyHtOrders.vue'
import TrsOrderPool from '../components/TrsOrderPool.vue'
import TrsQuickOrderWorkspace from '../components/TrsQuickOrderWorkspace.vue'
const { systemRunning, traderPrimaryMenu, activeTraderPrimary, activeTraderSecondary, traderSecondaryCollapsed, activeTraderGroup, selectTraderPrimary, selectedCode, trsOrderTicketVisible, trsOrderRequest, collapsed, account, instruments, trsTicketSymbol, trsTicketInstruments, orders, openTrsPoolExport, selectTicketAccount, openTrsOrderTicket, acceptTrsOrder, recordHtDealInEquity } = inject(tradingContextKey)
</script>

<template>
    <section class="trader-center-layout" :class="{ 'is-secondary-collapsed': traderSecondaryCollapsed }" aria-label="交易员中心">
      <nav class="trader-primary-nav" aria-label="交易员中心一级菜单">
        <button v-for="group in traderPrimaryMenu" :key="group.key" type="button" :class="{ active: activeTraderPrimary === group.key }" @click="selectTraderPrimary(group.key)">
          <el-icon><component :is="group.icon" /></el-icon><span>{{ group.label }}</span>
        </button>
        <button v-if="traderSecondaryCollapsed" type="button" class="trader-primary-expand" aria-label="展开二级菜单" @click="traderSecondaryCollapsed=false"><el-icon><Expand /></el-icon></button>
      </nav>
      <aside class="trader-secondary-nav" aria-label="交易员中心二级菜单">
        <header><span>{{ activeTraderGroup.title }}</span><button type="button" class="trader-secondary-collapse" aria-label="收起二级菜单" @click="traderSecondaryCollapsed = true"><el-icon><Fold /></el-icon></button></header>
        <nav>
          <button v-for="item in activeTraderGroup.children" :key="item.label" type="button" :class="{ active: activeTraderSecondary === item.label }" @click="activeTraderSecondary = item.label"><el-icon><component :is="item.icon" /></el-icon><span>{{ item.label }}</span></button>
        </nav>
      </aside>
      <TrsOrderPool v-if="activeTraderPrimary === 'swap' && activeTraderSecondary === '订单管理'" @open-my-orders="activeTraderSecondary = '我的HT订单'" @export="openTrsPoolExport" />
      <TrsMyHtOrders v-else-if="activeTraderPrimary === 'swap' && activeTraderSecondary === '我的HT订单'" @back-to-pool="activeTraderSecondary = '订单管理'" @place-order="openTrsOrderTicket" @deal-recorded="recordHtDealInEquity" />
      <section v-else class="trader-center-canvas" :aria-label="activeTraderSecondary"></section>
      <el-drawer v-model="trsOrderTicketVisible" title="快速下单" direction="rtl" size="599px" :close-on-click-modal="false" :close-on-press-escape="false" class="trs-quick-order-drawer">
        <TrsQuickOrderWorkspace :instruments="trsTicketInstruments" :accounts="accounts" :symbol="trsTicketSymbol" :account="account" :paused="!systemRunning" :ticket-context="{ executionType: 'highTouch' }" :initial-order="trsOrderRequest?.initialOrder" @account-select="selectTicketAccount" @select="code => { selectedCode = code }" @order="acceptTrsOrder" />
      </el-drawer>
    </section>
</template>
