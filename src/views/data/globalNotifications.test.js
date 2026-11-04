import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from '@vue/compiler-sfc'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const template = path => parse(read(path)).descriptor.template.ast
const element = (node, tag) => node.type === 1 && node.tag === tag
const conditional = node => node.props.some(prop => ['if', 'else-if', 'else'].includes(prop.name))

test('全局交易消息不随权益页或历史页切换而卸载', () => {
  const shell = template('../equity/EquityVariants.vue').children.find(node => element(node, 'TradingAppShell'))
  const notifications = shell.children.find(node => element(node, 'template') && node.props.some(prop => prop.name === 'slot' && prop.arg?.content === 'notifications'))
  assert.ok(notifications, '根控制器向框架提供全局消息插槽')
  assert.equal(conditional(notifications), false)
  assert.ok(notifications.children.some(node => element(node, 'HeaderTransactionNotice')))
  assert.ok(shell.props.some(prop => prop.name === 'on' && prop.arg?.content === 'trigger-demo-toast' && prop.exp?.content === 'triggerDemoTransactionToast'))

  const main = template('../../layout/TradingAppShell.vue').children.find(node => element(node, 'main'))
  const header = main.children.find(node => element(node, 'header'))
  const area = header.children.find(node => element(node, 'div') && node.props.some(prop => prop.name === 'class' && prop.value?.content === 'header-notification-area'))
  const fallback = area.children.find(node => element(node, 'div'))
  assert.ok(fallback.children.some(node => element(node, 'slot') && node.props.some(prop => prop.name === 'name' && prop.value?.content === 'notifications')), '交易提示在公共导航内，与系统通知共用区域')
  assert.doesNotMatch(read('../equity/pages/EquityTradingPage.vue'), /transaction-toast-stack/)
})

