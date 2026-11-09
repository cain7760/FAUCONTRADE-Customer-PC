<script setup>
import { ref, watch } from 'vue'
import { Close } from '@element-plus/icons-vue'

const props = defineProps({ number: { type: String, required: true }, title: { type: String, required: true }, target: { type: Object, required: true } })
const visible = ref(false)
const position = ref(null)

// 标注脱离业务布局，只依据目标的视口坐标定位。
watch(() => props.target, (target, _, onCleanup) => {
  if (!target) { position.value = null; visible.value = false; return }
  function updatePosition() {
    const rect = target.getBoundingClientRect()
    const inViewport = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth
    position.value = inViewport ? { left: `${Math.min(window.innerWidth - 20, Math.max(0, rect.right - 14))}px`, top: `${Math.max(0, rect.top - 6)}px` } : null
    if (!inViewport) visible.value = false
  }
  const observer = new ResizeObserver(updatePosition)
  observer.observe(target)
  if (target.parentElement) observer.observe(target.parentElement)
  window.addEventListener('resize', updatePosition)
  window.addEventListener('scroll', updatePosition, true)
  updatePosition()
  onCleanup(() => {
    observer.disconnect()
    window.removeEventListener('resize', updatePosition)
    window.removeEventListener('scroll', updatePosition, true)
  })
}, { immediate: true, flush: 'post' })
</script>

<template>
  <Teleport to="body">
  <el-popover v-if="position" v-model:visible="visible" trigger="click" placement="right-start" :width="340" popper-class="variant-popper feature-annotation-popper" :popper-style="{ zIndex: 4001 }" :show-arrow="false" :offset="8">
    <template #reference>
      <button type="button" class="feature-annotation-marker" :style="position" :aria-label="`查看标注${number}：${title}`" :aria-expanded="visible" @click.stop @keydown.esc.stop="visible=false">{{ number }}</button>
    </template>
    <section class="feature-annotation-content" :aria-label="`${title}逻辑说明`" @keydown.esc.stop="visible=false">
      <header><strong>{{ number }} · {{ title }}</strong><button type="button" :aria-label="`关闭${title}标注`" @click="visible=false"><el-icon><Close /></el-icon></button></header>
      <slot />
    </section>
  </el-popover>
  </Teleport>
</template>

<style scoped>
.feature-annotation-marker{position:fixed;z-index:4000;display:grid;place-items:center;width:20px;height:20px;padding:0;border:0;border-radius:50%;background:#d8505e;color:#fff;font-size:10px;line-height:1;cursor:pointer}
.feature-annotation-marker:hover,.feature-annotation-marker[aria-expanded="true"]{background:#e4606c;color:#fff}
.feature-annotation-marker:focus-visible{outline:2px solid #f3a3aa;outline-offset:2px}
.feature-annotation-content{font-size:12px;line-height:1.7;white-space:normal;text-align:left;overflow-wrap:anywhere}
.feature-annotation-content header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
.feature-annotation-content strong{font-size:14px;color:#e8eaed;font-weight:600}
.feature-annotation-content header button{display:grid;place-items:center;width:20px;height:20px;padding:0;border:0;background:transparent;color:#969eaa;cursor:pointer}
.feature-annotation-content header button:hover{color:#e8eaed}
.feature-annotation-content :deep(h4){margin:10px 0 4px;font-size:12px;font-weight:500;color:#d6b877}
.feature-annotation-content :deep(ol){margin:0;padding-left:18px}
.feature-annotation-content :deep(li+li){margin-top:6px}
.feature-annotation-content :deep(p){margin:0}
</style>

<style>
.feature-annotation-popper.el-popover.el-popper{box-sizing:border-box;max-width:calc(100vw - 24px);padding:14px;background:#25282d;border:1px solid #454c57;border-radius:4px;color:#c9ced6;box-shadow:0 8px 24px #0006}
</style>
