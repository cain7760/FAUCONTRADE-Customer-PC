<script setup>
import { computed, ref, watch } from 'vue'
import { Close, Tickets } from '@element-plus/icons-vue'

const props = defineProps({ notice: Object, count: { type: Number, default: 0 } })
const emit = defineEmits(['open-messages'])
const expanded = ref(false)
const selectedNotice = ref(null)
const currentNotice = computed(() => expanded.value ? selectedNotice.value : props.notice)
// 阅读详情时保留这一条快照，不受新回报或原有八秒提示计时影响。
watch(expanded, value => { if (value) selectedNotice.value = props.notice }, { flush: 'sync' })
function openMessages() { expanded.value = false; emit('open-messages') }
</script>

<template>
  <div class="header-transaction-notice" aria-live="polite" aria-atomic="true" @keydown.esc="expanded = false">
    <el-popover v-if="currentNotice" v-model:visible="expanded" trigger="click" placement="bottom-end" :width="300" :show-arrow="false" popper-class="header-transaction-popper" :offset="8">
      <template #reference>
        <button type="button" class="header-transaction-trigger" :aria-label="`查看订单回报：${currentNotice.name}，${currentNotice.status}，${Math.max(count, 1)}条提示`" :aria-expanded="expanded" aria-haspopup="dialog">
          <el-icon class="transaction-notice-icon"><Tickets /></el-icon>
          <span class="transaction-notice-copy"><strong>{{ currentNotice.name }}</strong><span class="transaction-notice-status" :class="`is-${currentNotice.tone}`">{{ currentNotice.status }}</span><span class="transaction-notice-number">{{ currentNotice.quantity }}</span><span class="transaction-notice-number">{{ currentNotice.price }}</span></span>
          <span v-if="count > 1" class="transaction-notice-count">{{ count > 99 ? '99+' : count }}</span>
        </button>
      </template>
      <section v-if="currentNotice" class="transaction-notice-detail" role="dialog" aria-label="订单回报详情" @keydown.esc="expanded = false">
        <header><span>权益交易 · 订单回报</span><button type="button" aria-label="关闭订单回报详情" @click="expanded = false"><el-icon><Close /></el-icon></button></header>
        <p><strong>{{ currentNotice.name }}</strong><small>（{{ currentNotice.code }}）</small><span class="transaction-notice-status" :class="`is-${currentNotice.tone}`">{{ currentNotice.status }}</span></p>
        <dl><div><dt>{{ currentNotice.quantityLabel }}</dt><dd>{{ currentNotice.quantity }}</dd></div><div><dt>{{ currentNotice.priceLabel }}</dt><dd>{{ currentNotice.price }}</dd></div></dl>
        <button type="button" class="transaction-notice-all" @click="openMessages">查看全部消息</button>
      </section>
    </el-popover>
  </div>
</template>

<style scoped>
.header-transaction-notice { width: 100%; min-width: 0; height: 30px; }
.header-transaction-trigger { display: flex; align-items: center; gap: 8px; width: 100%; height: 30px; padding: 0 8px; border: 1px solid var(--el-border-color); border-radius: 3px; background: var(--el-bg-color); color: var(--el-text-color-regular); font-size: 12px; white-space: nowrap; }
.header-transaction-trigger:hover, .header-transaction-trigger[aria-expanded="true"] { border-color: var(--el-color-primary); background: var(--el-fill-color-light); }
.header-transaction-trigger:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 2px; }
.transaction-notice-icon { flex: 0 0 14px; color: var(--el-color-primary); font-size: 14px; }
.transaction-notice-copy { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; flex: 1; overflow: hidden; }
.transaction-notice-copy strong { overflow: hidden; font-weight: 500; text-overflow: ellipsis; }
.transaction-notice-status { flex: 0 0 auto; font-size: 12px; }
.transaction-notice-status.is-success { color: #80b79e; }
.transaction-notice-status.is-partial { color: #d89b61; }
.transaction-notice-status.is-rejected { color: #cf7b86; }
.transaction-notice-status.is-reported { color: #8ab9d2; }
.transaction-notice-status.is-review { color: var(--el-text-color-regular); }
.transaction-notice-number { font-family: var(--ft-font-numeric); font-variant-numeric: tabular-nums; }
.transaction-notice-count { flex: 0 0 auto; min-width: 18px; padding: 0 4px; border-radius: 2px; background: #bb984a26; color: var(--el-color-primary); font-size: 11px; line-height: 18px; text-align: center; }
.transaction-notice-detail { color: var(--el-text-color-regular); font-size: 12px; }
.transaction-notice-detail header { display: flex; align-items: center; justify-content: space-between; color: var(--el-color-primary); }
.transaction-notice-detail header button { display: grid; place-items: center; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 3px; background: transparent; color: var(--el-text-color-secondary); }
.transaction-notice-detail header button:hover { background: var(--el-fill-color-light); }
.transaction-notice-detail p { display: flex; align-items: center; gap: 4px; margin: 8px 0; }
.transaction-notice-detail p strong { font-size: 13px; font-weight: 500; }
.transaction-notice-detail p small { color: var(--el-text-color-secondary); font-size: 12px; }
.transaction-notice-detail p .transaction-notice-status { margin-left: auto; }
.transaction-notice-detail dl { display: grid; grid-template-columns: 1fr 1fr; margin: 0; padding-top: 8px; border-top: 1px solid var(--el-border-color); }
.transaction-notice-detail dl > div + div { padding-left: 12px; border-left: 1px solid var(--el-border-color); }
.transaction-notice-detail dt { color: var(--el-text-color-secondary); font-size: 11px; }
.transaction-notice-detail dd { margin: 4px 0 0; font-family: var(--ft-font-numeric); font-variant-numeric: tabular-nums; }
.transaction-notice-all { margin-top: 10px; padding: 0; border: 0; background: transparent; color: var(--el-color-primary); font-size: 12px; }
/* 以导航剩余空间决定折叠，不绑定截图的视口宽度。 */
@container header-notifications (max-width: 319px) {
  .transaction-notice-copy { display: none; }
  .header-transaction-trigger { position: relative; justify-content: center; gap: 4px; padding: 0 4px; }
  .transaction-notice-count { position: absolute; top: 1px; right: 2px; min-width: 14px; padding: 0 2px; font-size: 10px; line-height: 14px; }
}
</style>

<style>
.el-popper.header-transaction-popper { padding: 10px 12px; border: 1px solid var(--el-border-color); border-radius: 4px; background: var(--el-bg-color-overlay); color: var(--el-text-color-regular); box-shadow: 0 8px 24px #0006; }
</style>
