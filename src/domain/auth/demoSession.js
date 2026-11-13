// 演示入口仅在当前标签会话记住密码；正式认证应使用服务端会话。
const accountKey = 'faucon-demo-login-account'
const rememberKey = 'faucon-remember-password'
const accountsKey = 'faucon-demo-remembered-accounts'
const lastAccountKey = 'faucon-demo-last-account'
const credentialsKey = 'faucon-demo-session-credentials'

export function readDemoAccount(storage) {
  try { return (storage || window.sessionStorage).getItem(accountKey) || 'Kevin Zhang' } catch { return 'Kevin Zhang' }
}

export function readRememberPassword(storage) {
  try { return (storage || window.localStorage).getItem(rememberKey) === 'true' } catch { return false }
}

export function readRememberedDemoAccounts(storage) {
  try {
    const accounts = JSON.parse((storage || window.localStorage).getItem(accountsKey) || '[]')
    return Array.isArray(accounts) ? accounts.filter(account => typeof account === 'string' && account.trim()).slice(0, 5) : []
  } catch { return [] }
}

export function readRememberedDemoCredentials(username, storage) {
  try {
    const credentials = JSON.parse((storage || window.sessionStorage).getItem(credentialsKey) || '{}')
    return typeof credentials[username] === 'string' ? credentials[username] : ''
  } catch { return '' }
}

export function readLastRememberedDemoLogin(environment = window) {
  try {
    const username = environment.localStorage.getItem(lastAccountKey) || ''
    return { username, password: readRememberedDemoCredentials(username, environment.sessionStorage) }
  } catch { return { username: '', password: '' } }
}

export function clearRememberedDemoAccounts(storage, sessionStorage) {
  try {
    const local = storage || window.localStorage
    local.removeItem(accountsKey)
    local.removeItem(lastAccountKey)
    const session = sessionStorage || window.sessionStorage
    session.removeItem(credentialsKey)
  } catch { /* 存储不可用时页面仍可手动登录。 */ }
}

export async function enterDemoSession({ username, password, rememberPassword }, environment = window) {
  const account = username.trim()
  if (!account || !password) throw new Error('请输入用户名和密码')
  try { environment.sessionStorage.setItem(accountKey, account) } catch { /* 存储不可用时仍可预览。 */ }
  try { environment.localStorage.setItem(rememberKey, String(rememberPassword)) } catch { /* 偏好非登录前置条件。 */ }
  if (rememberPassword) {
    try {
      const accounts = readRememberedDemoAccounts(environment.localStorage).filter(name => name !== account)
      environment.localStorage.setItem(accountsKey, JSON.stringify([account, ...accounts].slice(0, 5)))
      environment.localStorage.setItem(lastAccountKey, account)
    } catch { /* 最近账号列表非登录前置条件。 */ }
    try {
      const credentials = JSON.parse(environment.sessionStorage.getItem(credentialsKey) || '{}')
      environment.sessionStorage.setItem(credentialsKey, JSON.stringify({ ...credentials, [account]: password }))
    } catch { /* 当前标签的密码记忆非登录前置条件。 */ }
  } else {
    try { environment.localStorage.removeItem(lastAccountKey) } catch { /* 偏好非登录前置条件。 */ }
    try {
      const credentials = JSON.parse(environment.sessionStorage.getItem(credentialsKey) || '{}')
      delete credentials[account]
      environment.sessionStorage.setItem(credentialsKey, JSON.stringify(credentials))
    } catch { /* 存储不可用时仍可登录。 */ }
  }

  // 浏览器若支持，还可保存到原生密码管理器，供后续浏览器自行填充。
  if (rememberPassword && environment.PasswordCredential && environment.navigator?.credentials?.store) {
    try {
      await environment.navigator.credentials.store(new environment.PasswordCredential({ id: account, password }))
    } catch { /* 浏览器拒绝或取消保存时，不影响演示登录。 */ }
  }
}

export function leaveDemoSession(environment = window) {
  try { environment.sessionStorage.removeItem(accountKey) } catch { /* 仍返回登录页。 */ }
  environment.location.assign(new URL('login.html', environment.location.href).href)
}
