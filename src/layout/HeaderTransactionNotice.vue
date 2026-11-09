<script setup>
import { ref, watch } from 'vue'
import { Close, Tickets } from '@element-plus/icons-vue'

const props = defineProps({ notice: Object })
const emit = defineEmits(['open-messages'])
const expanded = ref(false)
watch(() => props.notice?.id, () => { expanded.value = false }, { flush: 'sync' })
function openMessages() { expanded.value = false; emit('open-messages') }
</script>

<template>
  <TransitionGroup tag="div" name="header-transaction-slide" class="header-transaction-notice" aria-live="polite" aria-atomic="true" @keydown.esc="expanded = false">
      <div v-for="item in notice ? [notice] : []" :key="item.id" class="header-transaction-slide-item">
        <el-popover v-model:visible="expanded" trigger="click" placement="bottom-end" :width="300" :show-arrow="false" popper-class="header-transaction-popper" :offset="8">
          <template #reference>
            <button type="button" class="header-transaction-trigger" :aria-label="'查看订单回报：' + item.name + '，' + item.status + '，' + item.quantity + '，' + item.price" :aria-expanded="expanded" aria-haspopup="dialog">
              <span class="transaction-notice-symbol"><el-icon><Tickets /></el-icon></span>
              <span class="transaction-notice-copy">
                <span class="transaction-notice-heading"><strong>{{ item.name }}</strong><span class="transaction-notice-status" :class="'is-' + item.tone">{{ item.status }}</span></span>
                <span class="transaction-notice-metrics"><span>{{ item.quantity }}</span><i aria-hidden="true">·</i><span>{{ item.price }}</span></span>
              </span>
            </button>
          </template>
          <section class="transaction-notice-detail" role="dialog" aria-label="订单回报详情" @keydown.esc="expanded = false">
            <header><span>权益交易 · 订单回报</span><button type="button" aria-label="关闭订单回报详情" @click="expanded = false"><el-icon><Close /></el-icon></button></header>
            <div class="transaction-detail-instrument"><div><strong>{{ item.name }}</strong><small>{{ item.code }}</small></div><span class="transaction-notice-status" :class="'is-' + item.tone">{{ item.status }}</span></div>
            <dl><div><dt>{{ item.quantityLabel }}</dt><dd>{{ item.quantity }}</dd></div><div><dt>{{ item.priceLabel }}</dt><dd>{{ item.price }}</dd></div></dl>
            <button type="button" class="transaction-notice-all" @click="openMessages">查看全部消息</button>
          </section>
        </el-popover>
      </div>
  </TransitionGroup>
</template>

<style scoped>
.header-transaction-notice { position: relative; width: 300px; max-width: 100%; min-width: 0; height: 30px; margin-left: auto; overflow: hidden; }
.header-transaction-slide-item { width: 100%; height: 100%; }
.header-transaction-trigger { display: flex; align-items: center; gap: 8px; width: 100%; height: 30px; padding: 0 8px 0 6px; border: 1px solid var(--el-border-color); border-left: 2px solid var(--el-color-primary); border-radius: 4px; background: var(--el-bg-color-overlay); color: var(--el-text-color-regular); font-size: 12px; text-align: left; white-space: nowrap; }
.header-transaction-trigger:hover, .header-transaction-trigger[aria-expanded="true"] { border-color: var(--el-color-primary); background: var(--el-fill-color-light); }
.header-transaction-trigger:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: -2px; }
.transaction-notice-symbol { display: grid; place-items: center; flex: 0 0 20px; height: 20px; border-radius: 3px; background: #bb984a14; color: var(--el-color-primary); font-size: 13px; }
.transaction-notice-copy { display: flex; flex: 1; align-items: center; justify-content: space-between; gap: 10px; min-width: 0; overflow: hidden; }
.transaction-notice-heading { display: flex; align-items: center; gap: 6px; min-width: 0; }
.transaction-notice-heading strong { overflow: hidden; color: var(--el-text-color-primary); font-size: 12px; font-weight: 500; text-overflow: ellipsis; }
.transaction-notice-status { flex: 0 0 auto; font-size: 11px; }
.transaction-notice-status.is-success { color: #80b79e; }
.transaction-notice-status.is-partial { color: #d89b61; }
.transaction-notice-status.is-rejected { color: #cf7b86; }
.transaction-notice-status.is-reported { color: #8ab9d2; }
.transaction-notice-status.is-review { color: var(--el-text-color-regular); }
.transaction-notice-metrics { display: flex; flex: 0 0 auto; align-items: center; gap: 6px; color: var(--el-text-color-secondary); font-family: var(--ft-font-numeric, inherit); font-size: 11px; font-variant-numeric: tabular-nums; }
.transaction-notice-metrics i { color: var(--el-border-color); font-style: normal; }
.transaction-notice-detail { color: var(--el-text-color-regular); font-size: 12px; }
.transaction-notice-detail header { display: flex; align-items: center; justify-content: space-between; color: var(--el-color-primary); font-size: 11px; }
.transaction-notice-detail header button { display: grid; place-items: center; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 3px; background: transparent; color: var(--el-text-color-secondary); }
.transaction-notice-detail header button:hover { background: var(--el-fill-color-light); }
.transaction-detail-instrument { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 8px 0 12px; }
.transaction-detail-instrument > div { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.transaction-detail-instrument strong { overflow: hidden; color: var(--el-text-color-primary); font-size: 14px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.transaction-detail-instrument small { color: var(--el-text-color-secondary); font-family: var(--ft-font-numeric, inherit); font-size: 11px; }
.transaction-detail-instrument .transaction-notice-status { padding: 2px 5px; border: 1px solid currentColor; border-radius: 3px; }
.transaction-notice-detail dl { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 0; padding: 10px 0; border-top: 1px solid var(--el-border-color); border-bottom: 1px solid var(--el-border-color); }
.transaction-notice-detail dt { color: var(--el-text-color-secondary); font-size: 11px; }
.transaction-notice-detail dd { margin: 5px 0 0; color: var(--el-text-color-primary); font-family: var(--ft-font-numeric, inherit); font-size: 13px; font-variant-numeric: tabular-nums; }
.transaction-notice-all { margin-top: 10px; padding: 0; border: 0; background: transparent; color: var(--el-color-primary); font-size: 12px; }
.header-transaction-slide-enter-active, .header-transaction-slide-leave-active { transition: transform .2s cubic-bezier(.2, .7, .2, 1), opacity .16s ease; }
.header-transaction-slide-enter-from { opacity: 0; transform: translateY(-100%); }
.header-transaction-slide-leave-to { opacity: 0; transform: translateY(100%); }
.header-transaction-slide-leave-active { position: absolute; inset: 0; pointer-events: none; }
/* 沿用导航剩余空间的折叠规则，不改变菜单和下单区域的宽度。 */
@container header-notifications (max-width: 319px) {
  .transaction-notice-copy { display: none; }
  .header-transaction-trigger { justify-content: center; padding: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .header-transaction-slide-enter-active, .header-transaction-slide-leave-active { transition: none; }
}
</style>

<style>
.el-popper.header-transaction-popper { padding: 10px 12px; border: 1px solid var(--el-border-color); border-top: 2px solid var(--el-color-primary); border-radius: 4px; background: var(--el-bg-color-overlay); color: var(--el-text-color-regular); box-shadow: 0 8px 24px #0006; }
</style>
