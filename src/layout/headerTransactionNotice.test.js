import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import { effectScope, reactive, ref, watch } from 'vue'

function notificationController() {
  const { descriptor } = parse(readFileSync(new URL('../views/equity/EquityVariants.vue', import.meta.url), 'utf8'))
  const ast = compileScript(descriptor, { id: 'header-timer-test' }).scriptSetupAst
  const functions = ['showTransactionToast', 'dismissTransactionToast'].map(name => {
    const node = ast.find(node => node.type === 'FunctionDeclaration' && node.id.name === name)
    return descriptor.scriptSetup.content.slice(node.start, node.end)
  }).join('\n')
  const toasts = ref([])
  const browser = { setTimeout: (...args) => setTimeout(...args), clearTimeout: id => clearTimeout(id) }
  return new Function('transactionToasts', 'window', `let transactionToastTimer; ${functions}; return { showTransactionToast, dismissTransactionToast, toasts: transactionToasts }`)(toasts, browser)
}
const message = id => ({ id, trade: { name: id } })

test('只保留最新回报，新回报重新计时5秒，旧回报不再回显', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const controller = notificationController()
  controller.showTransactionToast(message('old'))
  t.mock.timers.tick(3000)
  controller.showTransactionToast(message('new'))
  assert.deepEqual(controller.toasts.value.map(row => row.message.id), ['new'])
  t.mock.timers.tick(2000)
  assert.equal(controller.toasts.value[0].message.id, 'new')
  controller.dismissTransactionToast('old')
  assert.equal(controller.toasts.value[0].message.id, 'new')
  t.mock.timers.tick(2999)
  assert.equal(controller.toasts.value.length, 1)
  t.mock.timers.tick(1)
  assert.deepEqual(controller.toasts.value, [])
})

test('同一回报再次触发也获得完整5秒，非交易消息不会清除当前提示', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const controller = notificationController()
  controller.showTransactionToast(message('one'))
  t.mock.timers.tick(4000)
  controller.showTransactionToast(message('one'))
  controller.showTransactionToast({ id: 'system' })
  t.mock.timers.tick(4999)
  assert.equal(controller.toasts.value.length, 1)
  t.mock.timers.tick(1)
  assert.equal(controller.toasts.value.length, 0)
})

test('新回报或5秒到期关闭旧详情，不继续固定上一条消息', () => {
  const { descriptor } = parse(readFileSync(new URL('./HeaderTransactionNotice.vue', import.meta.url), 'utf8'))
  const compiled = compileScript(descriptor, { id: 'header-notice-test' }).content.replace(/^import .*$/gm, '').replace('export default', 'return')
  const component = new Function('ref', 'watch', 'Close', 'Tickets', compiled)(ref, watch, {}, {})
  const props = reactive({ notice: message('old') }), scope = effectScope()
  const state = scope.run(() => component.setup(props, { expose() {}, emit() {} }))
  state.expanded.value = true
  props.notice = message('new')
  assert.equal(state.expanded.value, false)
  state.expanded.value = true
  props.notice = null
  assert.equal(state.expanded.value, false)
  scope.stop()
})
