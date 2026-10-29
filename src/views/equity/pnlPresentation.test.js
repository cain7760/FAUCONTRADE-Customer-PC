import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import { formatPnl } from '../../utils/pnlFormat.js'

const { descriptor } = parse(readFileSync(new URL('./EquityVariants.vue', import.meta.url), 'utf8'))
const declarations = compileScript(descriptor, { id: 'pnl-presentation-test' }).scriptSetupAst
const source = name => {
  const node = declarations.find(node => node.type === 'FunctionDeclaration' && node.id.name === name)
  return descriptor.scriptSetup.content.slice(node.start, node.end)
}
const number = value => Number(value).toLocaleString('en-US')
const money = value => Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

test('账户盈亏大额提示只在首段显示符号，其他资产正数保持无符号', () => {
  const parts = new Function('number', source('assetAmountParts') + '; return assetAmountParts')(number)
  assert.deepEqual(parts(123456789.12, true), [{ value: '+1', unit: '亿' }, { value: '2,345', unit: '万' }, { value: '6789.12', unit: '' }])
  assert.deepEqual(parts(-123456789.12, true), [{ value: '-1', unit: '亿' }, { value: '2,345', unit: '万' }, { value: '6789.12', unit: '' }])
  assert.deepEqual(parts(123.45, true), [{ value: '+123.45', unit: '' }])
  assert.deepEqual(parts(-123.45, true), [{ value: '-123.45', unit: '' }])
  assert.deepEqual(parts(0, true), [{ value: '0.00', unit: '' }])
  assert.equal(parts(123.45)[0].value, '123.45')
})

test('持仓导出所有盈亏使用带符号数值，市值和数量不受影响', () => {
  const result = {}
  const context = { money, number, signedMoney: value => formatPnl(value, money), formatPrice: money,
    accountLabel: value => value, accountTypeLabel: () => '自营', marketLabel: value => value, currencyFor: () => 'CNY',
    downloadCsv: (filename, header, records) => Object.assign(result, { filename, header, records }) }
  const exportPositions = new Function(...Object.keys(context), source('exportPositions') + '; return exportPositions')(...Object.values(context))
  const row = { direction: '多', code: '000001', market: 'SZ', name: '平安银行', cost: 10, price: 11, opening: 1000, qty: 1000, available: 900,
    value: 11000, marginOccupied: 1000, marginRate: 10, floatingProfit: 1234.56, dailyRealizedProfit: -234.56, totalProfit: 1000, account: 'TZS_T0', currency: 'CNY' }
  exportPositions([row])
  for (const [label, expected] of [['浮动盈亏', '+1,234.56'], ['实现盈亏', '-234.56'], ['总盈亏', '+1,000.00']]) {
    const index = result.header.indexOf(label)
    if (index >= 0) assert.equal(result.records[0][index], expected)
  }
  assert.equal(result.records[0][result.header.indexOf('市值')], '11,000.00')
  assert.equal(result.records[0][result.header.indexOf('持仓数量')], '1,000')
  assert.equal(row.floatingProfit, 1234.56)
})
