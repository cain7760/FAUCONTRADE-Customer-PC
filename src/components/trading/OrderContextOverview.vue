<script setup>
defineProps({ title: { type: String, required: true } })
</script>

<template>
  <section class="order-context-overview" :aria-label="title">
    <header class="order-context-overview-heading">
      <div class="order-context-overview-title"><h3>{{ title }}</h3><slot name="tag" /></div>
      <slot name="reference" />
    </header>
    <dl><slot /></dl>
  </section>
</template>

<style>
.order-context-overview { flex: none; margin-top: 16px; padding: 10px 12px 12px; background: #25282d; }
.order-context-overview-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; margin-bottom: 10px; }
.order-context-overview-title { display: flex; align-items: center; gap: 6px; flex: none; }
.order-context-overview h3 { flex: none; margin: 0; color: #e8eaed; font-size: 12px; font-weight: 600; }
.order-context-overview-heading > span { min-width: 0; overflow: hidden; color: #949daa; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.order-context-overview-heading b { color: #edf0f4; font-weight: 500; }
.order-context-overview dl { display: grid; grid-template-columns: var(--order-overview-columns, 88px repeat(3, minmax(max-content, 1fr))); gap: 8px; margin: 0; overflow-x: auto; }
.order-context-overview dl > div { min-width: 0; }
.order-context-overview dt { color: #949daa; font-size: 10px; white-space: nowrap; }
.order-context-overview dd { margin: 4px 0 0; color: #edf0f4; font-size: 12px; line-height: 17px; white-space: nowrap; }
</style>
