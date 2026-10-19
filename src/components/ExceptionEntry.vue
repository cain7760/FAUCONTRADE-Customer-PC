<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import EquityVariants from '../views/equity/EquityVariants.vue'
import ExceptionState from './ExceptionState.vue'
import { normalizeException } from './exceptionStates'

const pageName = location.pathname.split('/').pop()
const isUnknownPage = !!pageName && !['index.html', 'equity-variants.html'].includes(pageName)
const previewException = normalizeException(new URLSearchParams(location.search).get('exception'))
const raisedException = ref(null)
const isOnline = ref(navigator.onLine)
const activeException = computed(() => !isOnline.value ? 'network' : isUnknownPage ? 'not-found' : raisedException.value || previewException)

function updateConnection() { isOnline.value = navigator.onLine }
// 数据请求层可派发 faucon:exception，detail.type 为 exceptionStates 中的状态键或常见 HTTP 状态码。
function handleException(event) { raisedException.value = normalizeException(event.detail?.type) }
function handleAction() {
  if (activeException.value === 'not-found') {
    location.assign(new URL('equity-variants.html', location.href))
    return
  }
  const target = new URL(location.href)
  target.searchParams.delete('exception')
  location.assign(target)
}
onMounted(() => {
  window.addEventListener('online', updateConnection)
  window.addEventListener('offline', updateConnection)
  window.addEventListener('faucon:exception', handleException)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', updateConnection)
  window.removeEventListener('offline', updateConnection)
  window.removeEventListener('faucon:exception', handleException)
})
</script>

<template>
  <ExceptionState v-if="activeException" :type="activeException" @action="handleAction" />
  <EquityVariants v-else />
</template>
