import test from 'node:test'
import assert from 'node:assert/strict'
import { clearRememberedDemoAccounts, enterDemoSession, leaveDemoSession, readDemoAccount, readLastRememberedDemoLogin, readRememberedDemoAccounts, readRememberedDemoCredentials, readRememberPassword } from './demoSession.js'

function environment() {
  const createStorage = () => {
    const values = new Map()
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), values }
  }
  return { sessionStorage: createStorage(), localStorage: createStorage(), navigator: {}, location: { href: 'https://example.com/customer/equity-variants.html?layout=classic', assign(url) { this.destination = url } } }
}
const login = { username: '  Demo Trader  ', password: 'test-only-password', rememberPassword: true }

test('空用户名或密码不会建立演示会话', async () => {
  for (const values of [{ ...login, username: ' ' }, { ...login, password: '' }]) {
    const env = environment()
    await assert.rejects(enterDemoSession(values, env), /请输入用户名和密码/)
    assert.equal(env.sessionStorage.values.size, 0)
  }
})

test('只在当前标签会话保存密码，长期存储不含密码', async () => {
  const env = environment()
  await enterDemoSession(login, env)
  assert.equal(readDemoAccount(env.sessionStorage), 'Demo Trader')
  assert.equal(readRememberPassword(env.localStorage), true)
  assert.deepEqual(readLastRememberedDemoLogin(env), { username: 'Demo Trader', password: login.password })
  assert.doesNotMatch([...env.localStorage.values.values()].join('|'), /test-only-password/)
})

test('只有用户勾选时才将密码交给浏览器密码管理器', async () => {
  const env = environment()
  const saved = []
  env.PasswordCredential = class { constructor(values) { Object.assign(this, values) } }
  env.navigator.credentials = { store: credential => saved.push(credential) }
  await enterDemoSession({ ...login, rememberPassword: false }, env)
  assert.equal(saved.length, 0)
  await enterDemoSession(login, env)
  assert.deepEqual({ ...saved[0] }, { id: 'Demo Trader', password: login.password })
  assert.equal(saved.length, 1)
})

test('已记住的多个演示账号保留名称，清空后列表消失', async () => {
  const env = environment()
  await enterDemoSession(login, env)
  await enterDemoSession({ ...login, username: 'Second Trader' }, env)
  await enterDemoSession({ ...login, username: 'Demo Trader', rememberPassword: false }, env)
  assert.deepEqual(readRememberedDemoAccounts(env.localStorage), ['Second Trader', 'Demo Trader'])
  assert.equal(readRememberedDemoCredentials('Second Trader', env.sessionStorage), login.password)
  assert.deepEqual(readLastRememberedDemoLogin(env), { username: '', password: '' })
  clearRememberedDemoAccounts(env.localStorage, env.sessionStorage)
  assert.deepEqual(readRememberedDemoAccounts(env.localStorage), [])
  assert.equal(readRememberedDemoCredentials('Second Trader', env.sessionStorage), '')
  assert.doesNotMatch([...env.localStorage.values.values()].join('|'), /test-only-password/)
})

test('浏览器不支持或拒绝密码保存时，演示会话仍然可用', async () => {
  const env = environment()
  env.PasswordCredential = class {}
  env.navigator.credentials = { store: () => Promise.reject(new Error('cancelled')) }
  await enterDemoSession(login, env)
  assert.equal(readDemoAccount(env.sessionStorage), 'Demo Trader')
  const denied = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() { throw new Error('blocked') } }
  await assert.doesNotReject(enterDemoSession(login, { ...env, sessionStorage: denied, localStorage: denied }))
  assert.equal(readDemoAccount(denied), 'Kevin Zhang')
  assert.equal(readRememberPassword(denied), false)
})

test('退出清理演示名称并返回同站点登录页，保留记忆偏好', async () => {
  const env = environment()
  await enterDemoSession(login, env)
  leaveDemoSession(env)
  assert.equal(readDemoAccount(env.sessionStorage), 'Kevin Zhang')
  assert.equal(readRememberPassword(env.localStorage), true)
  assert.equal(env.location.destination, 'https://example.com/customer/login.html')
})
