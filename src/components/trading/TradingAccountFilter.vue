<script setup>
import { computed, ref } from 'vue'
import { Search } from '@element-plus/icons-vue'
const props = defineProps({ accounts: { type: Array, required: true }, labelFor: { type: Function, required: true }, inPopover: Boolean })
const accountIds = defineModel({ type: Array, required: true })
const search = ref('')
const allValue = '__ALL_ACCOUNTS__'
const selected = computed({
  get: () => accountIds.value.length ? accountIds.value : [allValue],
  set: ids => {
    const hadAll = !accountIds.value.length
    accountIds.value = !ids.length || (ids.includes(allValue) && !hadAll) ? [] : ids.filter(id => id !== allValue)
  },
})
const filteredAccounts = computed(() => props.accounts.filter(account => `${account.id} ${account.name}`.toLowerCase().includes(search.value.trim().toLowerCase())))
</script>

<template>
  <div class="trading-account-filter" :class="inPopover ? 'is-in-popover' : 'order-filter-optional'">
    <span v-if="inPopover">交易账户</span>
    <el-select v-model="selected" multiple collapse-tags :max-collapse-tags="1" placeholder="全部账户" aria-label="交易账户筛选" popper-class="variant-popper global-account-popper" :teleported="!inPopover" :offset="2" @visible-change="visible => { if (!visible) search = '' }">
      <template v-if="!accountIds.length" #tag><span class="trading-account-all">全部账户</span></template>
      <template #header><div class="account-dropdown-search" @click.stop><el-input v-model="search" :prefix-icon="Search" placeholder="搜索名称/编号" aria-label="搜索交易账户" clearable /></div></template>
      <el-option label="全部账户" :value="allValue" />
      <el-option v-for="account in filteredAccounts" :key="account.id" :value="account.id" :label="labelFor(account.id)" />
    </el-select>
  </div>
</template>

<style scoped>
.trading-account-filter { flex: none; width: 160px; }
.trading-account-filter :deep(.el-select) { width: 100%; min-width: 0; }
.trading-account-filter :deep(.el-select__wrapper) { height: 28px; min-height: 28px; padding-top: 0; padding-bottom: 0; }
.trading-account-filter :deep(.el-select__selection) { min-height: 24px; }
.trading-account-all { color: var(--el-text-color-regular); line-height: 24px; }
.trading-account-filter.is-in-popover { display: grid; grid-template-columns: 56px minmax(0, 1fr); align-items: center; gap: 8px; width: 100%; color: #aeb6c1; font-size: 11px; }
</style>
