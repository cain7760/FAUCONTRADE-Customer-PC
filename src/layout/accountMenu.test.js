import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'

const source = readFileSync(new URL('./TradingAppShell.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source)
const all = node => [node, ...(node.children || []).flatMap(all)]
const nodes = all(descriptor.template.ast)
const attribute = (node, name) => node.props?.find(prop => prop.name === name)?.value?.content

test('ID点击菜单复用深色下拉，帮助与退出均有图标和文本；头像仍触发交易回报', () => {
  const menu = nodes.find(node => node.tag === 'el-dropdown' && attribute(node, 'popper-class')?.includes('header-account-popper'))
  assert.equal(attribute(menu, 'trigger'), 'click')
  const items = all(menu).filter(node => node.tag === 'el-dropdown-item')
  assert.deepEqual(items.map(node => attribute(node, 'command')), ['help', 'logout'])
  assert.ok(all(items[0]).some(node => node.tag === 'ClientLineIcon' && attribute(node, 'type') === 'help'))
  assert.ok(all(items[1]).some(node => node.tag === 'SwitchButton'))
  for (const item of items) assert.ok(all(item).some(node => node.tag === 'span'))
  assert.equal(nodes.some(node => attribute(node, 'class') === 'header-help-action'), false)
  const avatar = nodes.find(node => attribute(node, 'class') === 'small-avatar avatar-toast-trigger')
  assert.ok(avatar.props.some(prop => prop.name === 'on' && prop.arg?.content === 'click' && prop.exp?.content === "emit('trigger-demo-toast')"))
})

test('帮助菜单调用现有帮助入口，退出只发出预留事件，不伪造退出状态', () => {
  const node = compileScript(descriptor, { id: 'account-menu' }).scriptSetupAst.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'handleAccountCommand')
  const code = descriptor.scriptSetup.content.slice(node.start, node.end)
  const events = []
  const command = new Function('emit', `${code}; return handleAccountCommand`)(value => events.push(value))
  command('help'); command('logout'); command('unknown')
  assert.deepEqual(events, ['open-help-center', 'logout'])
})
