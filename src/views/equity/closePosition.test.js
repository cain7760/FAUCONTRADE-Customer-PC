import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import { accounts } from './fixtures.js'
import { variantRows, zeroAvailablePosition } from './variantData.js'

const { descriptor } = parse(readFileSync(new URL('./EquityVariants.vue', import.meta.url), 'utf8'))
const declarations = compileScript(descriptor, { id: 'close-position-test' }).scriptSetupAst
const source = name => {
  const node = declarations.find(node => node.id?.name === name || node.declarations?.some(item => item.id.name === name))
  return descriptor.scriptSetup.content.slice(node.start, node.end)
}
function scenario() {
  const context = {
    systemRunning: { value: true }, closePositionVisible: { value: false },
    closingPosition: { value: null }, unavailablePositionVisible: { value: false },
  }
  const open = new Function(...Object.keys(context), source('openClosePosition') + '; return openClosePosition')(...Object.values(context))
  return { context, open }
}

test('无可用持仓直接失败，并清除先前平仓面板和标的', () => {
  for (const available of [0, '0', -100, undefined, null, NaN]) {
    const { context, open } = scenario()
    open({ available: 100, code: '000001' })
    open({ available, code: '00700' })
    assert.equal(context.closePositionVisible.value, false)
    assert.equal(context.closingPosition.value, null)
    assert.equal(context.unavailablePositionVisible.value, true)
  }
})

test('正常持仓仍可打开平仓，系统中断时两个入口状态都不改变', () => {
  const { context, open } = scenario()
  open(zeroAvailablePosition)
  const row = { available: 100, code: '000001' }
  open(row)
  assert.equal(context.closePositionVisible.value, true)
  assert.equal(context.closingPosition.value, row)
  assert.equal(context.unavailablePositionVisible.value, false)
  const paused = scenario()
  paused.context.systemRunning.value = false
  paused.open(zeroAvailablePosition)
  paused.open(row)
  assert.equal(paused.context.closePositionVisible.value, false)
  assert.equal(paused.context.unavailablePositionVisible.value, false)
  assert.equal(paused.context.closingPosition.value, null)
})

test('腾讯冻结持仓独立于原订单种子，仅出现在自营一号账户', () => {
  assert.equal(variantRows.length, 12)
  assert.equal(variantRows.some(row => row.code === zeroAvailablePosition.code), false)
  assert.equal(zeroAvailablePosition.code, '00700')
  assert.equal(zeroAvailablePosition.qty, 1000)
  assert.equal(zeroAvailablePosition.available, 0)
  assert.equal(zeroAvailablePosition.available, zeroAvailablePosition.qty - zeroAvailablePosition.pendingSell)
  assert.equal(zeroAvailablePosition.currency, 'HKD')
  const accountId = { value: 'TZS_T0' }
  const context = { accounts, variantRows, zeroAvailablePosition, accountId,
    computed: fn => ({ get value() { return fn() } }), syncedHtPositions: { value: [] }, mockCnyExchangeRates: { HKD: .92 }, positionMarginInCny: row => row.marginOccupied }
  const state = new Function(...Object.keys(context),
    [source('secondAccountPosition'), source('instruments'), source('allPositionRows'), 'return { instruments, allPositionRows }'].join('\n'))(...Object.values(context))
  assert.equal(state.instruments.value.length, 13)
  accountId.value = 'TZS_T1'
  assert.equal(state.instruments.value.length, 12)
  const demoRows = state.allPositionRows.value.filter(row => row.code === '00700')
  assert.equal(state.allPositionRows.value.length, 25)
  assert.equal(demoRows.length, 1)
  assert.equal(demoRows[0].account, 'TZS_T0')
})
