<script setup>
defineProps({ items: { type: Array, default: () => [] } })
defineEmits(['select', 'remove'])
</script>

<template>
  <div v-if="items.length" class="instrument-history">
    <span>搜索历史</span>
    <div>
      <div v-for="item in items" :key="item.code" class="instrument-history-chip">
        <button type="button" class="instrument-history-select" @mousedown.prevent @click.stop="$emit('select', item.code)">{{ item.name }}（{{ item.code }}）</button>
        <button type="button" class="instrument-history-remove" :aria-label="`删除历史标的 ${item.name}`" title="删除" @mousedown.prevent @click.stop="$emit('remove', item.code)">×</button>
      </div>
    </div>
  </div>
</template>
