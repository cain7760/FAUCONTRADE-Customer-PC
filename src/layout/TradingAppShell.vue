<script setup>
import { CaretBottom, InfoFilled, Close, Setting, SwitchButton } from '@element-plus/icons-vue'
import ClientLineIcon from '../ClientLineIcon.vue'

const { variant, visibleNav, overflowNav, activeNav, showHeaderNotice, systemNoticeEnabled, systemRunning, headerNotice, showUnreadBadge, unreadMessageCount, helpCenterUrl } = defineProps({
  variant: String,
  visibleNav: Array,
  overflowNav: Array,
  activeNav: String,
  showHeaderNotice: Boolean,
  systemNoticeEnabled: Boolean,
  systemRunning: Boolean,
  headerNotice: Object,
  showUnreadBadge: Boolean,
  unreadMessageCount: Number,
  helpCenterUrl: String,
  accountName: { type: String, default: 'Kevin Zhang' },
})
const emit = defineEmits(['select-nav', 'open-message-center', 'dismiss-notice', 'open-settings', 'open-help-center', 'trigger-demo-toast', 'logout'])
const assetUrl = name => `${import.meta.env.BASE_URL}original-icons/${name}`
function handleAccountCommand(command) {
  if (command === 'help') emit('open-help-center')
  else if (command === 'logout') emit('logout')
}
</script>

<template>
  <main class="variants-app" :class="`version-${variant}`">
    <header class="variant-header">
      <img :src="assetUrl('logo-faucon-trade.png')" alt="FAUCON TRADE"><i class="header-brand-divider" aria-hidden="true"></i>
      <nav aria-label="产品菜单">
        <button v-for="item in visibleNav" :key="item.label" :class="{ active: activeNav === item.label }" @click="emit('select-nav', item.label)"><span class="nav-menu-content"><span class="source-composite variant-nav-icon" aria-hidden="true"><img v-for="part in item.icon" :key="part[0]" :src="assetUrl(part[0])" :style="{ left: `${part[1]}px`, top: `${part[2]}px`, width: `${part[3]}px`, height: `${part[4]}px` }" alt=""></span><span class="nav-menu-label">{{ item.label }}</span></span></button>
        <el-dropdown v-if="overflowNav.length" trigger="click" popper-class="variant-nav-popper" @command="label => emit('select-nav', label)"><button class="more-nav" :class="{ active: overflowNav.some(item => item.label === activeNav) }">更多<el-icon><CaretBottom /></el-icon></button><template #dropdown><el-dropdown-menu><el-dropdown-item v-for="item in overflowNav" :key="item.label" :command="item.label"><span class="source-composite variant-nav-icon" aria-hidden="true"><img v-for="part in item.icon" :key="part[0]" :src="assetUrl(part[0])" :style="{ left: `${part[1]}px`, top: `${part[2]}px`, width: `${part[3]}px`, height: `${part[4]}px` }" alt=""></span>{{ item.label }}</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
      </nav>
      <div class="header-notification-area">
        <section v-if="showHeaderNotice && systemNoticeEnabled && !systemRunning" class="header-marquee" aria-label="系统通知" role="button" tabindex="0" @click="emit('open-message-center')" @keydown.enter="emit('open-message-center')"><el-icon><InfoFilled /></el-icon><b>系统通知</b><span class="notice-scroll"><i>{{ headerNotice.text }}　{{ headerNotice.text }}</i></span><button type="button" aria-label="关闭系统通知" @click.stop="emit('dismiss-notice')"><el-icon><Close /></el-icon></button></section>
        <div v-else class="header-transaction-slot"><slot name="notifications" /></div>
      </div>
      <div class="variant-header-end">
        <button class="notification-action" aria-label="打开消息中心" @click="emit('open-message-center')"><ClientLineIcon type="notification" /><em v-if="showUnreadBadge && unreadMessageCount">{{ unreadMessageCount }}</em></button>
        <button class="header-settings-action" aria-label="系统设置" @click="emit('open-settings')"><el-icon><Setting /></el-icon></button>
        <div class="header-user">
          <button type="button" class="small-avatar avatar-toast-trigger" aria-label="触发交易消息提示" @click="emit('trigger-demo-toast')">{{ ($props.accountName || 'K').slice(0, 1).toUpperCase() }}</button>
          <el-dropdown trigger="click" placement="bottom-end" popper-class="variant-nav-popper header-account-popper" :show-arrow="false" :offset="8" @command="handleAccountCommand">
            <button type="button" class="header-account-trigger" :aria-label="`用户菜单 ${$props.accountName}`"><span>{{ $props.accountName }}</span><el-icon class="header-account-chevron" aria-hidden="true"><CaretBottom /></el-icon></button>
            <template #dropdown><el-dropdown-menu>
              <el-dropdown-item command="help"><ClientLineIcon type="help" /><span>帮助中心</span></el-dropdown-item>
              <el-dropdown-item command="logout"><el-icon><SwitchButton /></el-icon><span>退出登录</span></el-dropdown-item>
            </el-dropdown-menu></template>
          </el-dropdown>
        </div>
      </div>
    </header>
    <slot />
  </main>
</template>

<style scoped>
.header-notification-area {
  container: header-notifications / inline-size;
  flex: 1 1 352px;
  min-width: 44px;
  max-width: 352px;
  height: 30px;
  margin-left: auto;
}
.header-transaction-slot { width: 100%; height: 100%; }
.variants-app .variant-header-end { flex: 0 0 auto; margin-left: 0; white-space: nowrap; }
.variants-app .header-user { display: flex; align-items: center; gap: 6px; }
.variants-app .header-user .el-dropdown { color: inherit; font-size: inherit; }
.variants-app .header-account-trigger { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; white-space: nowrap; }
.variants-app .header-account-chevron { font-size: 11px; }
.variants-app .header-account-trigger > span { max-width: 128px; overflow: hidden; text-overflow: ellipsis; }
.variants-app .header-account-trigger:hover { color: var(--el-color-primary); }
.variants-app .header-notification-area .header-marquee { display: flex; width: 100%; max-width: none; height: 30px; margin: 0; }
@container header-notifications (max-width: 319px) {
  .variants-app .header-marquee { justify-content: center; padding: 0; }
  .variants-app .header-marquee > .el-icon { margin: 0; }
  .variants-app .header-marquee > b, .variants-app .header-marquee > span, .variants-app .header-marquee > button { display: none; }
}
</style>

<style>
.header-account-popper .el-dropdown-menu__item { min-width: 136px; min-height: 32px; gap: 8px; padding: 0 10px; font-size: 12px; }
.header-account-popper .el-dropdown-menu__item > .el-icon { margin-right: 0; font-size: 16px; }
.header-account-popper .client-line-icon { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
</style>
