import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as vue from 'vue'
import * as market from '../../domain/orders/marketSession.js'
import * as schedule from '../../domain/orders/executionSchedule.js'

function setup(props) {
  const { descriptor } = parse(readFileSync(new URL('./ExecutionTimeRange.vue', import.meta.url), 'utf8'))
  const script = compileScript(descriptor, { id: 'execution-time-default-test' }).content
  const imports = { ...vue, ...market, ...schedule, onMounted() {} }
  const component = new Function(...Object.keys(imports), script.replace(/^import .*$/gm, '').replace('export default', 'return'))(...Object.values(imports))
  const events = []
  const form = component.setup(props, { expose() {}, emit: (...args) => events.push(args) })
  return { form, events }
}

test('开始时间默认选中标的市场当前分钟，匹配时间选择器本地时钟', () => {
  for (const [code, expected] of [['SZ', [10, 20]], ['HK', [10, 20]], ['US', [21, 20]]]) {
    const { form } = setup(vue.reactive({ item: { market: code }, modelValue: ['', ''], optional: true }))
    form.now.value = new Date('2026-11-17T10:20:30+08:00')
    const value = form.defaultStartTime.value
    assert.deepEqual([value.getHours(), value.getMinutes()], expected)
    assert.equal(value.getSeconds(), 0)
  }
})

test('刷新默认值时恢复开始时间焦点，保留空值和已有时间', async () => {
  for (const range of [['', ''], ['13:00', '14:00']]) {
    const props = vue.reactive({ item: { market: 'SZ' }, modelValue: range, optional: true })
    const { form, events } = setup(props)
    form.now.value = new Date('2000-01-01T00:00:00Z')
    let focused = 0, opened = 0
    form.startPicker.value = { focus() { focused++ }, handleOpen() { opened++ } }
    await form.prepareTimePicker(0)
    assert.deepEqual(props.modelValue, range)
    assert.deepEqual(events, [])
    assert.equal(focused, 1)
    assert.equal(opened, 1)
  }
})
