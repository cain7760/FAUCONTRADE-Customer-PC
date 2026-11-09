<script setup>
defineProps({
  cancelText: { type: String, default: '取消' },
  confirmText: { type: String, default: '确定' },
  cancelDisabled: Boolean,
  confirmDisabled: Boolean,
  loading: Boolean,
})
defineEmits(['cancel', 'confirm'])
</script>

<template>
  <div class="ft-dialog-actions">
    <el-button native-type="button" :disabled="cancelDisabled || loading" @click="$emit('cancel')">{{ cancelText }}</el-button>
    <el-button native-type="button" type="primary" :disabled="confirmDisabled || loading" :loading="loading" @click="$emit('confirm')">{{ confirmText }}</el-button>
  </div>
</template>

<style>
.ft-dialog-actions{display:flex;align-items:center;justify-content:center;gap:8px}
.ft-dialog-frame .el-dialog__footer .ft-dialog-actions .el-button{box-sizing:border-box;min-width:88px;height:32px;padding:0 14px;border-radius:4px;border-color:#454a53;background:#292c31;color:#c8ced7;font-size:12px;line-height:1}
.ft-dialog-frame .el-dialog__footer .ft-dialog-actions .el-button:not(:disabled):hover{border-color:#6a707a;background:#32363d;color:#f0f2f5}
.ft-dialog-frame .el-dialog__footer .ft-dialog-actions .el-button--primary{border-color:#bb984a;background:#bb984a;color:#fff}
.ft-dialog-frame .el-dialog__footer .ft-dialog-actions .el-button--primary:not(:disabled):hover{border-color:#c8a757;background:#c8a757;color:#fff}
.ft-dialog-actions .el-button:focus-visible{outline:2px solid #bb984a;outline-offset:2px}
.ft-dialog-actions .el-button.is-disabled{opacity:.45}
.ft-dialog-actions .el-button.is-loading{opacity:.7}
</style>
