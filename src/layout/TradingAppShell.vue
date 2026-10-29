<script setup>
import { CaretBottom, InfoFilled, Close, Setting } from '@element-plus/icons-vue'
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
})
const emit = defineEmits(['select-nav', 'open-message-center', 'dismiss-notice', 'open-settings', 'open-help-center', 'trigger-demo-toast'])
const assetUrl = name => `${import.meta.env.BASE_URL}original-icons/${name}`
</script>

<template>
  <main class="variants-app" :class="`version-${variant}`">
    <header class="variant-header">
      <img :src="assetUrl('logo-faucon-trade.png')" alt="FAUCON TRADE"><i class="header-brand-divider" aria-hidden="true"></i>
      <nav aria-label="产品菜单">
        <button v-for="item in visibleNav" :key="item.label" :class="{ active: activeNav === item.label }" @click="emit('select-nav', item.label)"><span class="nav-menu-content"><span class="source-composite variant-nav-icon" aria-hidden="true"><img v-for="part in item.icon" :key="part[0]" :src="assetUrl(part[0])" :style="{ left: `${part[1]}px`, top: `${part[2]}px`, width: `${part[3]}px`, height: `${part[4]}px` }" alt=""></span><span class="nav-menu-label">{{ item.label }}</span></span></button>
        <el-dropdown v-if="overflowNav.length" trigger="click" popper-class="variant-nav-popper" @command="label => emit('select-nav', label)"><button class="more-nav" :class="{ active: overflowNav.some(item => item.label === activeNav) }">更多<el-icon><CaretBottom /></el-icon></button><template #dropdown><el-dropdown-menu><el-dropdown-item v-for="item in overflowNav" :key="item.label" :command="item.label"><span class="source-composite variant-nav-icon" aria-hidden="true"><img v-for="part in item.icon" :key="part[0]" :src="assetUrl(part[0])" :style="{ left: `${part[1]}px`, top: `${part[2]}px`, width: `${part[3]}px`, height: `${part[4]}px` }" alt=""></span>{{ item.label }}</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
      </nav>
      <section v-if="showHeaderNotice && systemNoticeEnabled && !systemRunning" class="header-marquee" aria-label="系统通知" role="button" tabindex="0" @click="emit('open-message-center')" @keydown.enter="emit('open-message-center')"><el-icon><InfoFilled /></el-icon><b>系统通知</b><span class="notice-scroll"><i>{{ headerNotice.text }}　{{ headerNotice.text }}</i></span><button type="button" aria-label="关闭系统通知" @click.stop="emit('dismiss-notice')"><el-icon><Close /></el-icon></button></section>
      <div class="variant-header-end"><button class="notification-action" aria-label="打开消息中心" @click="emit('open-message-center')"><ClientLineIcon type="notification" /><em v-if="showUnreadBadge && unreadMessageCount">{{ unreadMessageCount }}</em></button><button class="header-settings-action" aria-label="系统设置" @click="emit('open-settings')"><el-icon><Setting /></el-icon></button><el-tooltip :content="helpCenterUrl ? '打开帮助中心' : '帮助中心地址待配置'" placement="bottom"><button class="header-help-action" :aria-label="helpCenterUrl ? '打开帮助中心' : '帮助中心地址待配置'" @click="emit('open-help-center')"><ClientLineIcon type="help" /></button></el-tooltip><button type="button" class="small-avatar avatar-toast-trigger" aria-label="触发交易消息提示" @click="emit('trigger-demo-toast')">K</button><span>Kevin Zhang</span></div>
    </header>
    <slot name="notifications" />
    <slot />
  </main>
</template>
