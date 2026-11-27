<script setup>
import { computed, onBeforeUnmount, ref, useId } from 'vue'
import { ElButton, ElInput } from 'element-plus'

const props = defineProps({
  email: { type: String, default: '' },
  recovery: Boolean,
})
const emit = defineEmits(['success'])

const id = useId()
const username = ref('')
const verificationTarget = computed(() => props.recovery ? username.value.trim() : props.email)
const verificationCode = ref('')
const verificationCodeInvalid = ref(false)
const password = ref('')
const passwordConfirmation = ref('')
const formError = ref('')
const passwordError = ref('')
const confirmationError = ref('')
const requestedTarget = ref('')
const remainingSeconds = ref(0)
let verificationTimer

const demoCode = '123456'
const passwordHint = '密码须包含英文字母与特殊符号，且长度不少于 8 位。'
const passwordRule = /^(?=.*[A-Za-z])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?\x60~])[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?\x60~]{8,}$/

function verificationTargetError() {
  if (verificationTarget.value) return ''
  return props.recovery ? '请输入用户名。' : '开户邮箱不可用，请联系客服。'
}

function stopVerification() {
  window.clearInterval(verificationTimer)
  remainingSeconds.value = 0
  requestedTarget.value = ''
}

function sendVerificationCode() {
  if (remainingSeconds.value) return
  verificationCodeInvalid.value = false
  formError.value = verificationTargetError()
  if (formError.value) return

  requestedTarget.value = verificationTarget.value
  remainingSeconds.value = 60
  verificationTimer = window.setInterval(() => {
    remainingSeconds.value -= 1
    if (remainingSeconds.value === 0) stopVerification()
  }, 1000)
}

function submit() {
  verificationCodeInvalid.value = false
  passwordError.value = passwordRule.test(password.value) ? '' : passwordHint
  confirmationError.value = password.value === passwordConfirmation.value ? '' : '两次输入的密码不一致，请重新确认。'
  formError.value = verificationTargetError()
  if (formError.value) return

  if (!requestedTarget.value) formError.value = '请先获取邮箱验证码。'
  else if (requestedTarget.value !== verificationTarget.value) {
    formError.value = props.recovery ? '用户名已变更，请重新获取验证码。' : '验证邮箱已变更，请重新获取验证码。'
  } else if (verificationCode.value !== demoCode) verificationCodeInvalid.value = true
  else if (!passwordError.value && !confirmationError.value) emit('success')
}

onBeforeUnmount(stopVerification)
defineExpose({ submit })
</script>

<template>
  <form class="password-change-form" novalidate @submit.prevent="submit">
    <div v-if="recovery" class="password-field">
      <label :for="id + '-username'">用户名</label>
      <el-input :id="id + '-username'" v-model.trim="username" name="username" autocomplete="username" :maxlength="128" :spellcheck="false" autocapitalize="none" placeholder="请输入用户名" />
    </div>

    <div class="password-field">
      <label :for="id + '-code'">邮箱验证码</label>
      <div class="password-code-row">
        <el-input :id="id + '-code'" v-model.trim="verificationCode" :class="{ 'is-error': verificationCodeInvalid }" :aria-invalid="verificationCodeInvalid" :aria-describedby="verificationCodeInvalid ? id + '-code-error' : undefined" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="请输入 6 位验证码" @input="verificationCodeInvalid = false" />
        <el-button class="password-code-action" :disabled="remainingSeconds > 0" native-type="button" @click="sendVerificationCode">
          {{ remainingSeconds ? remainingSeconds + 's 后重发' : '获取验证码' }}
        </el-button>
        <p v-if="verificationCodeInvalid" :id="id + '-code-error'" class="password-field-error" role="alert">邮箱验证码不正确。</p>
      </div>
    </div>

    <div class="password-field">
      <label :for="id + '-new'">新密码</label>
      <el-input :id="id + '-new'" v-model="password" :class="{ 'is-error': passwordError }" :aria-invalid="Boolean(passwordError)" :aria-describedby="passwordError ? id + '-hint' : undefined" :aria-description="!passwordError ? passwordHint : undefined" type="password" show-password autocomplete="new-password" placeholder="至少 8 位，含英文字母和特殊符号" @input="passwordError = ''; confirmationError = ''" />
      <p v-if="passwordError" :id="id + '-hint'" class="password-field-error" role="alert">{{ passwordError }}</p>
    </div>

    <div class="password-field">
      <label :for="id + '-confirmation'">重复密码</label>
      <el-input :id="id + '-confirmation'" v-model="passwordConfirmation" :class="{ 'is-error': confirmationError }" :aria-invalid="Boolean(confirmationError)" type="password" show-password autocomplete="new-password" placeholder="请再次输入新密码" @input="confirmationError = ''" />
      <p v-if="confirmationError" class="password-field-error" role="alert">{{ confirmationError }}</p>
    </div>

    <p v-if="formError" class="password-form-error" role="alert">{{ formError }}</p>
    <button type="submit" hidden></button>
  </form>
</template>

<style scoped>
.password-change-form { display: grid; gap: 13px; max-width: 280px; margin: 0 auto; }
.password-field { display: grid; gap: 7px; color: #dce2e9; font-size: 12px; font-weight: 500; }
.password-code-row { display: grid; grid-template-columns: minmax(0, 1fr) 112px; gap: 8px; }
.password-change-form :deep(.el-input__wrapper) { min-height: 32px; background: #25282d; box-shadow: 0 0 0 1px #3b3f46 inset; }
.password-change-form :deep(.el-input__wrapper:hover) { box-shadow: 0 0 0 1px #e8eaed inset; }
.password-change-form :deep(.el-input__wrapper.is-focus) { box-shadow: 0 0 0 1px #bb984a inset; }
.password-change-form :deep(.el-input.is-error .el-input__wrapper) { box-shadow: 0 0 0 1px #bf6571 inset; }
.password-change-form :deep(.el-input.is-error .el-input__wrapper.is-focus) { box-shadow: 0 0 0 1px #d77b87 inset; }
.password-change-form :deep(.el-input__inner) { color: #e3e7ec; font-size: 13px; font-weight: 400; }
.password-change-form :deep(.el-input__inner::placeholder) { color: #747b87; opacity: 1; }
.password-code-action.el-button { height: 32px; margin: 0; border: 1px solid #bb984a; background: transparent; color: #dfc170; font-size: 12px; font-weight: 400; }
.password-code-action.el-button:not(:disabled):hover { border-color: #dfc170; background: #353026; color: #f0d681; }
.password-code-action.el-button:disabled { border-color: #454a53; background: transparent; color: #727b87; }
.password-form-error { margin: 0; color: #e58a94; font-size: 12px; line-height: 17px; }
.password-field-error { margin: 0; color: #e58a94; font-size: 11px; font-weight: 400; line-height: 14px; }
</style>
