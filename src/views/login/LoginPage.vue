<script setup>
import { ref } from 'vue'
import { View, Hide, User, Lock, ArrowDown } from '@element-plus/icons-vue'
import { clearRememberedDemoAccounts, enterDemoSession, readLastRememberedDemoLogin, readRememberedDemoAccounts, readRememberedDemoCredentials, readRememberPassword } from '../../domain/auth/demoSession.js'
import logoCityComposite from '../../assets/login/logo-city-composite-dim.png'
import cityBackground from '../../assets/login/hong-kong-abstract-dim.png'

const logo = `${import.meta.env.BASE_URL}original-icons/logo-faucon-trade.png`
const form = ref(null)
const lastLogin = readRememberPassword() ? readLastRememberedDemoLogin() : { username: '', password: '' }
const values = ref({ ...lastLogin, rememberPassword: readRememberPassword() })
const submitting = ref(false)
const errorMessage = ref('')
const resetHelpVisible = ref(false)
const passwordVisible = ref(false)
const rememberedAccounts = ref(readRememberedDemoAccounts())
const selectedAccount = ref(false)
const rules = {
  username: [{ validator: (_rule, value, callback) => callback(value.trim() ? undefined : new Error('请输入用户名')), trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

function selectTerminal(terminal) {
  if (terminal !== 'trader') return
  const localPreview = ['127.0.0.1', 'localhost'].includes(window.location.hostname)
  const target = localPreview
    ? `${window.location.protocol}//${window.location.hostname}:4180/login.html`
    : 'https://cain7760.github.io/FAUCONTRADE-Trader-PC/'
  window.location.assign(target)
}

function selectAccount(command) {
  if (command === 'clear') {
    clearRememberedDemoAccounts()
    rememberedAccounts.value = []
    selectedAccount.value = false
    return
  }
  values.value.username = command
  values.value.password = readRememberedDemoCredentials(command)
  values.value.rememberPassword = true
  selectedAccount.value = true
  errorMessage.value = ''
  form.value?.clearValidate(['username', 'password'])
}

function onUsernameInput() {
  values.value.password = ''
  selectedAccount.value = false
}

async function submitLogin() {
  if (submitting.value) return
  if (!await form.value.validate().catch(() => false)) return
  errorMessage.value = ''
  submitting.value = true
  try {
    await enterDemoSession(values.value)
    window.location.assign(new URL('equity-variants.html?layout=classic', window.location.href).href)
  } catch {
    errorMessage.value = '暂时无法登录，请重试。'
    submitting.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <img class="login-background" :src="cityBackground" alt="" aria-hidden="true" />
    <div class="login-panel">
      <div class="login-visual" aria-hidden="true">
        <img class="login-brand-art" :src="logoCityComposite" alt="" width="1122" height="1402" fetchpriority="high" />
      </div>
      <section class="login-access" aria-labelledby="login-title">
        <div class="login-form-content">
          <header class="login-heading">
            <div class="login-brand-row">
              <img class="login-logo" :src="logo" alt="FAUCON TRADE" width="132" height="34" />
              <el-dropdown class="login-terminal-switch" trigger="click" placement="bottom-end" popper-class="login-terminal-popper" :show-arrow="false" @command="selectTerminal">
                <button type="button" class="login-terminal-trigger" aria-label="选择交易终端">客户交易终端 <el-icon><ArrowDown /></el-icon></button>
                <template #dropdown><el-dropdown-menu>
                  <el-dropdown-item command="customer" class="current-terminal">客户交易终端</el-dropdown-item>
                  <el-dropdown-item command="trader">交易员终端</el-dropdown-item>
                </el-dropdown-menu></template>
              </el-dropdown>
            </div>
            <div class="login-heading-title">
              <h1 id="login-title">欢迎登录</h1>
            </div>
            <p class="login-intro">登录猎盈交易端，继续把握每一个交易机会。</p>
          </header>

          <el-form ref="form" :model="values" :rules="rules" label-position="top" hide-required-asterisk class="login-form" :disabled="submitting" novalidate @submit.prevent="submitLogin">
            <el-form-item label="用户名" prop="username" for="login-username">
              <el-input id="login-username" v-model="values.username" name="username" placeholder="请输入用户名" autocomplete="username" :maxlength="128" :spellcheck="false" autocapitalize="none" :prefix-icon="User" @input="onUsernameInput">
                <template v-if="rememberedAccounts.length" #suffix>
                  <el-dropdown trigger="click" placement="bottom-end" popper-class="login-account-popper" @command="selectAccount">
                    <button type="button" class="login-account-switch" aria-label="切换已保存账号">{{ selectedAccount ? '切换' : '切换账号' }} <el-icon><ArrowDown /></el-icon></button>
                    <template #dropdown><el-dropdown-menu>
                      <el-dropdown-item v-for="account in rememberedAccounts" :key="account" :command="account">{{ account }}</el-dropdown-item>
                      <el-dropdown-item divided command="clear">清空账号列表</el-dropdown-item>
                    </el-dropdown-menu></template>
                  </el-dropdown>
                </template>
              </el-input>
            </el-form-item>
            <el-form-item label="密码" prop="password" for="login-password">
              <el-input id="login-password" v-model="values.password" name="password" placeholder="请输入密码" :type="passwordVisible ? 'text' : 'password'" :autocomplete="values.rememberPassword ? 'current-password' : 'off'" :maxlength="256" :prefix-icon="Lock">
                <template #suffix><button type="button" class="login-password-toggle" :aria-label="passwordVisible ? '隐藏密码' : '显示密码'" :aria-pressed="passwordVisible" :disabled="submitting" @click="passwordVisible = !passwordVisible"><el-icon><Hide v-if="passwordVisible" /><View v-else /></el-icon></button></template>
              </el-input>
            </el-form-item>

            <div class="login-options">
              <el-checkbox v-model="values.rememberPassword">记住密码</el-checkbox>
              <button type="button" class="login-reset-link" :aria-expanded="resetHelpVisible" aria-controls="login-reset-help" @click="resetHelpVisible = !resetHelpVisible">忘记密码？</button>
            </div>
            <p v-if="resetHelpVisible" id="login-reset-help" class="login-reset-help" role="status">请联系您的账户管理员重置密码。</p>
            <p v-if="errorMessage" class="login-submit-error" role="alert">{{ errorMessage }}</p>
            <el-button class="login-submit" type="primary" native-type="submit" :loading="submitting">{{ submitting ? '正在登录' : '登录' }}</el-button>
          </el-form>
          <p class="login-demo-note">演示环境，输入用户名与密码即可体验</p>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.login-page {
  --login-space: 24px;
  position: relative;
  isolation: isolate;
  display: grid;
  place-items: center;
  min-height: 100dvh;
  padding: 40px 32px;
  background: #111315;
  color: var(--el-text-color-primary);
  font-size: 14px;
}
.login-page ::selection { background: #615331; color: #fff; }
.login-page::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(rgb(13 18 24 / 16%), rgb(13 18 24 / 30%));
  pointer-events: none;
}
.login-background {
  position: absolute;
  inset: 0;
  z-index: -2;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: brightness(1.18);
  pointer-events: none;
}
.login-panel {
  display: grid;
  /* 原 52/48 双栏中，表单区域缩窄 20%，图像区域保留原有宽度。 */
  grid-template-columns: minmax(0, 52fr) minmax(0, 38.4fr);
  width: min(1012px, 100%);
  aspect-ratio: 1.61803398875 / 1;
  overflow: hidden;
  border-radius: 8px;
  background: var(--el-bg-color);
  box-shadow: 0 24px 72px rgb(0 0 0 / 30%);
}
.login-access {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  min-width: 0;
  padding: 48px 56px;
}
.login-terminal-switch { flex: none; }
.login-terminal-trigger { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 7px; border: 1px solid #544831; border-radius: 4px; background: rgb(187 152 74 / 12%); color: #c6aa6c; font-size: 11px; white-space: nowrap; }
.login-terminal-trigger:hover { border-color: #bb984a; color: #d3ad64; }
.login-terminal-trigger .el-icon { font-size: 11px; }
.login-brand-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 28px; }
.login-logo {
  display: block;
  width: 132px;
  height: 34px;
  object-fit: contain;
}
.login-form-content { width: 100%; }
.login-heading { margin-bottom: 14px; }
.login-heading-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.login-heading h1 { margin: 0; font-size: 26px; line-height: 1.4; font-weight: 600; }
.login-intro { margin: 6px 0 0; color: var(--el-text-color-secondary); font-size: 12px; line-height: 18px; }
.login-visual {
  position: relative;
  min-width: 0;
  overflow: hidden;
  background: #0d1114;
}
.login-visual::after {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 36%;
  background: linear-gradient(180deg, rgb(42 42 42 / 32%), rgb(42 42 42 / 14%) 55%, transparent);
  pointer-events: none;
}
.login-brand-art {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  animation: login-brand-drift 18s ease-in-out infinite alternate;
}
@keyframes login-brand-drift {
  from { transform: scale(1.03) translateX(-.5%); }
  to { transform: scale(1.07) translateX(.5%); }
}
@media (prefers-reduced-motion: reduce) {
  .login-brand-art { animation: none; }
}
.login-form :deep(.el-form-item) { margin-bottom: 28px; }
.login-form :deep(.el-form-item__label) { height: auto; padding: 0; margin-bottom: 10px; font-size: 14px; line-height: 20px; color: var(--el-text-color-regular); }
.login-form :deep(.el-input__wrapper) { min-height: 44px; padding: 0 14px; background: var(--el-bg-color-overlay); border-radius: var(--el-border-radius-base); }
.login-form :deep(.el-input__inner) { height: 44px; font-size: 14px; caret-color: var(--el-color-primary); }
.login-form :deep(.el-input__inner::placeholder) { color: var(--el-text-color-secondary); }
.login-account-switch { display: inline-flex; align-items: center; gap: 5px; padding: 4px 0 4px 6px; border: 0; background: transparent; color: #c6aa6c; font-size: 12px; white-space: nowrap; }
.login-account-switch:hover { color: #e0bc72; }
.login-account-switch .el-icon { font-size: 18px; }
.login-account-switch .el-icon svg { stroke-width: 3; }
.login-password-toggle { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: var(--el-border-radius-base); background: transparent; color: var(--el-text-color-secondary); font-size: 16px; }
.login-password-toggle:hover { color: var(--el-text-color-primary); }
.login-form :deep(.el-form-item__error) { padding-top: 6px; font-size: 12px; }
.login-options { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: -8px; }
.login-options :deep(.el-checkbox) { height: 24px; }
.login-options :deep(.el-checkbox__label) { color: var(--el-text-color-regular); font-size: 12px; }
.login-options :deep(.el-checkbox__inner) { width: 14px; height: 14px; }
.login-reset-link { border: 0; padding: 0; min-height: 24px; background: transparent; color: var(--el-color-primary); font-size: 12px; }
.login-reset-link:hover { color: var(--el-color-primary-light-3); }
.login-reset-help { margin: 12px 0 0; font-size: 12px; line-height: 1.6; color: var(--el-text-color-regular); }
.login-submit-error { margin: 12px 0 0; font-size: 12px; color: var(--el-color-danger); }
.login-form .login-submit { width: 100%; height: 46px; margin: var(--login-space) 0 0; padding: 0 18px; border: 1px solid #d2aa5d; border-radius: 5px; background: linear-gradient(100deg, #b78b3d, #d3ad64); color: #fff; font-size: 14px; font-weight: 650; transition: filter .15s, transform .15s; --el-button-text-color: #fff; --el-button-hover-text-color: #fff; --el-button-active-text-color: #fff; }
.login-form .login-submit:hover:not(.is-loading) { border-color: #d2aa5d; background: linear-gradient(100deg, #b78b3d, #d3ad64); color: #fff; filter: brightness(1.09); transform: translateY(-1px); }
.login-form .login-submit:active:not(.is-loading) { transform: translateY(0); }
.login-demo-note { margin: 20px 0 0; font-size: 12px; line-height: 1.6; text-align: center; color: var(--el-text-color-secondary); }
@media (max-width: 1000px) {
  .login-panel { aspect-ratio: auto; min-height: 640px; }
  .login-access { padding: 40px 32px; }
  .login-logo { width: 116px; }
  .login-brand-art {
    top: 50%;
    bottom: auto;
    height: auto;
    translate: 0 -50%;
    mask-image: linear-gradient(transparent, #000 12%, #000 88%, transparent);
  }
}
@media (max-width: 740px) {
  .login-page { padding: 24px 20px; }
  .login-panel { width: min(440px, 100%); min-height: 600px; grid-template-columns: minmax(0, 1fr); }
  .login-access { padding: 40px 28px; }
  .login-visual { display: none; }
}
</style>

<style>
.login-terminal-popper.el-popper { --el-dropdown-menuItem-hover-fill: #30343a; --el-dropdown-menuItem-hover-color: #bb984a; border: 1px solid #3a3e45; background: #24272c; }
.login-terminal-popper .el-dropdown-menu { background: #24272c; }
.login-terminal-popper .el-dropdown-menu__item { min-width: 102px; min-height: 32px; padding: 0 8px; font-size: 12px; }
.login-terminal-popper .current-terminal { color: #bb984a; }
.login-account-popper.el-popper { --el-dropdown-menuItem-hover-fill: #30343a; --el-dropdown-menuItem-hover-color: #d3ad64; border: 1px solid #3a3e45; background: #24272c; }
.login-account-popper .el-dropdown-menu { background: #24272c; }
.login-account-popper .el-dropdown-menu__item { min-height: 32px; color: #cdd1d7; }
.login-account-popper .el-dropdown-menu__item:hover, .login-account-popper .el-dropdown-menu__item:focus { background: #30343a; color: #d3ad64; }
</style>
