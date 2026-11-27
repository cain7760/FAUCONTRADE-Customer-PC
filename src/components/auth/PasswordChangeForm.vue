<script setup>
import { computed, onBeforeUnmount, ref, useId } from 'vue'

const props = defineProps({
  email: { type: String, default: '' },
  recovery: Boolean,
})
const emit = defineEmits(['success'])

const id = useId()
const enteredEmail = ref('')
const email = computed(() => props.recovery ? enteredEmail.value : props.email)
const verificationCode = ref('')
const password = ref('')
const passwordConfirmation = ref('')
const formError = ref('')
const passwordError = ref('')
const confirmationError = ref('')
const verificationEmail = ref('')
const remainingSeconds = ref(0)
let verificationTimer

const demoCode = '123456'
const passwordHint = '密码须包含英文字母与特殊符号，且长度不少于 8 位。'
const passwordRule = /^(?=.*[A-Za-z])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?\x60~])[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?\x60~]{8,}$/
const emailRule = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validatePassword(required = false) {
  passwordError.value = (!password.value && !required) || passwordRule.test(password.value) ? '' : passwordHint
  if (passwordConfirmation.value) validateConfirmation()
  return !passwordError.value
}

function validateConfirmation(required = false) {
  confirmationError.value = (!passwordConfirmation.value && !required) || password.value === passwordConfirmation.value
    ? ''
    : '两次输入的密码不一致，请重新确认。'
  return !confirmationError.value
}

function emailError() {
  if (props.recovery && !emailRule.test(email.value)) return '请输入有效的开户邮箱。'
  return email.value ? '' : '开户邮箱不可用，请联系客服。'
}

function stopVerification() {
  window.clearInterval(verificationTimer)
  remainingSeconds.value = 0
  verificationEmail.value = ''
}

function sendVerificationCode() {
  if (remainingSeconds.value) return
  formError.value = emailError()
  if (formError.value) return

  verificationEmail.value = email.value
  remainingSeconds.value = 60
  verificationTimer = window.setInterval(() => {
    remainingSeconds.value -= 1
    if (remainingSeconds.value === 0) stopVerification()
  }, 1000)
}

function submit() {
  const validPassword = validatePassword(true)
  const validConfirmation = validateConfirmation(true)
  formError.value = emailError()
  if (formError.value) return

  if (!verificationEmail.value) formError.value = '请先获取邮箱验证码。'
  else if (verificationEmail.value !== email.value) formError.value = '验证邮箱已变更，请重新获取验证码。'
  else if (verificationCode.value !== demoCode) formError.value = '邮箱验证码不正确。'
  else if (validPassword && validConfirmation) emit('success')
}

onBeforeUnmount(stopVerification)
defineExpose({ submit })
</script>

<template>
  <form class="password-change-form" novalidate @submit.prevent="submit">
    <div v-if="recovery" class="password-field">
      <label :for="id + '-email'">验证邮箱</label>
      <el-input :id="id + '-email'" v-model.trim="enteredEmail" type="email" autocomplete="email" placeholder="请输入开户邮箱" />
    </div>
    <div v-else class="password-field password-email-row">
      <span>验证邮箱</span><span class="password-email">{{ email }}</span>
    </div>

    <div class="password-field">
      <label :for="id + '-code'">邮箱验证码</label>
      <div class="password-code-row">
        <el-input :id="id + '-code'" v-model.trim="verificationCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="请输入 6 位验证码" />
        <el-button class="password-code-action" :disabled="remainingSeconds > 0" native-type="button" @click="sendVerificationCode">
          {{ remainingSeconds ? remainingSeconds + 's 后重发' : '获取验证码' }}
        </el-button>
      </div>
      <small v-if="recovery" role="status">
        {{ verificationEmail && verificationEmail === email ? '演示验证码：' + demoCode : '演示环境，验证码在此显示。' }}
      </small>
    </div>

    <div class="password-field">
      <label :for="id + '-new'">新密码</label>
      <el-input :id="id + '-new'" v-model="password" :class="{ 'is-error': passwordError }" :aria-invalid="Boolean(passwordError)" :aria-describedby="id + '-hint'" type="password" show-password autocomplete="new-password" placeholder="请输入新密码" @blur="validatePassword()" @input="passwordConfirmation && validateConfirmation()" />
      <small v-if="!passwordError" :id="id + '-hint'">{{ passwordHint }}</small>
      <p v-else :id="id + '-hint'" class="password-field-error" role="alert">{{ passwordError }}</p>
    </div>

    <div class="password-field">
      <label :for="id + '-confirmation'">重复密码</label>
      <el-input :id="id + '-confirmation'" v-model="passwordConfirmation" :class="{ 'is-error': confirmationError }" :aria-invalid="Boolean(confirmationError)" type="password" show-password autocomplete="new-password" placeholder="请再次输入新密码" @blur="validateConfirmation()" />
      <p v-if="confirmationError" class="password-field-error" role="alert">{{ confirmationError }}</p>
    </div>

    <p v-if="formError" class="password-form-error" role="alert">{{ formError }}</p>
    <button type="submit" hidden></button>
  </form>
</template>

<style scoped>
.password-change-form { display: grid; gap: 13px; max-width: 280px; margin: 0 auto; }
.password-field { display: grid; gap: 7px; color: #dce2e9; font-size: 12px; font-weight: 500; }
.password-email-row { display: flex; align-items: baseline; gap: 8px; }
.password-email { color: #aeb6c1; font-size: 13px; font-weight: 400; line-height: 20px; overflow-wrap: anywhere; user-select: text; }
.password-code-row { display: grid; grid-template-columns: minmax(0, 1fr) 112px; gap: 8px; }
.password-change-form :deep(.el-input__wrapper) { min-height: 32px; background: #25282d; box-shadow: 0 0 0 1px #3b3f46 inset; }
.password-change-form :deep(.el-input__wrapper:hover) { box-shadow: 0 0 0 1px #e8eaed inset; }
.password-change-form :deep(.el-input__wrapper.is-focus) { box-shadow: 0 0 0 1px #bb984a inset; }
.password-change-form :deep(.el-input.is-error .el-input__wrapper) { box-shadow: 0 0 0 1px #bf6571 inset; }
.password-change-form :deep(.el-input.is-error .el-input__wrapper.is-focus) { box-shadow: 0 0 0 1px #d77b87 inset; }
.password-change-form :deep(.el-input__inner) { color: #e3e7ec; font-size: 13px; font-weight: 400; }
.password-change-form :deep(.el-input__inner::placeholder) { color: #747b87; opacity: 1; }
.password-change-form small { color: #8f98a4; font-size: 11px; font-weight: 400; line-height: 14px; }
.password-code-action.el-button { height: 32px; margin: 0; border: 1px solid #bb984a; background: transparent; color: #dfc170; font-size: 12px; font-weight: 400; }
.password-code-action.el-button:not(:disabled):hover { border-color: #dfc170; background: #353026; color: #f0d681; }
.password-code-action.el-button:disabled { border-color: #454a53; background: transparent; color: #727b87; }
.password-form-error { margin: 0; color: #e58a94; font-size: 12px; line-height: 17px; }
.password-field-error { margin: 0; color: #e58a94; font-size: 11px; font-weight: 400; line-height: 14px; }
</style>
