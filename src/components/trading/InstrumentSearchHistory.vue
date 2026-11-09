<script setup>
import { reactive } from 'vue'
defineProps({ items: { type: Array, default: () => [] } })
defineEmits(['select', 'remove'])
const overflowed = reactive({})
function checkOverflow(event, code) {
  overflowed[code] = event.currentTarget.scrollWidth > event.currentTarget.clientWidth
}
</script>

<template>
  <div v-if="items.length" class="instrument-history">
    <span>搜索历史</span>
    <div>
      <div v-for="item in items" :key="item.code" class="instrument-history-chip">
        <el-tooltip :content="`${item.name}（${item.code}）`" :disabled="!overflowed[item.code]" :show-after="250" placement="top" popper-class="variant-popper instrument-history-tooltip"><button type="button" class="instrument-history-select" @mouseenter="checkOverflow($event, item.code)" @focus="checkOverflow($event, item.code)" @mousedown.prevent @click.stop="$emit('select', item.code)">{{ item.name }}（{{ item.code }}）</button></el-tooltip>
        <button type="button" class="instrument-history-remove" :aria-label="`删除历史标的 ${item.name}`" title="删除" @mousedown.prevent @click.stop="$emit('remove', item.code)">×</button>
      </div>
    </div>
  </div>
</template>

<style>
.instrument-history-tooltip.el-popper{max-width:280px;background:#25282d;color:#c9ced6;border-color:#454c57;white-space:normal;overflow-wrap:anywhere;font-size:12px}
.instrument-history-tooltip.el-popper .el-popper__arrow:before{background:#25282d;border-color:#454c57}
</style>
