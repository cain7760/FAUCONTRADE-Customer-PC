<script setup>
import { Close } from '@element-plus/icons-vue'

defineOptions({ inheritAttrs: false })

defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue'])
function close() { emit('update:modelValue', false) }
</script>

<template>
  <el-dialog v-bind="$attrs" :model-value="modelValue" :show-close="false" class="ft-dialog-frame" @update:model-value="emit('update:modelValue', $event)">
    <template v-if="$slots.header" #header="slotProps"><slot name="header" v-bind="slotProps" /></template>
    <template v-else #header><div class="ft-dialog-default-header"><h2>{{ $attrs.title }}</h2><button type="button" class="ft-dialog-close" aria-label="关闭弹窗" @click="close"><el-icon><Close /></el-icon></button></div></template>
    <slot />
    <template v-if="$slots.footer" #footer="slotProps"><slot name="footer" v-bind="slotProps" /></template>
  </el-dialog>
</template>

<style>
.ft-dialog-frame.el-dialog{--ft-dialog-frame-line:#313238;overflow:hidden;border:1px solid var(--ft-dialog-frame-line)!important;border-radius:5px!important;background:#202226!important;box-shadow:0 22px 64px #000b}
.ft-dialog-frame .el-dialog__header{box-sizing:border-box;height:48px;margin:0!important;padding:0 16px!important;border-bottom:1px solid var(--ft-dialog-frame-line)!important;background:#24272c!important}
.ft-dialog-frame .el-dialog__title{display:inline-flex;align-items:center;height:100%;color:#e6ebf3!important;font-size:14px!important;font-weight:600!important;line-height:20px!important}
.ft-dialog-frame .el-dialog__header h2{margin:0;color:#e6ebf3!important;font-size:14px!important;font-weight:600!important;line-height:20px!important}
.ft-dialog-default-header{display:flex;align-items:center;justify-content:space-between;width:100%;height:100%}
.ft-dialog-close{display:grid;place-items:center;width:28px;height:28px;margin-right:-6px;padding:0;border:0;border-radius:3px;background:transparent;color:#aebaca;cursor:pointer}
.ft-dialog-close:hover{background:#303237;color:#e6ebf3}.ft-dialog-close .el-icon{font-size:17px}
.ft-dialog-frame .el-dialog__body{background:#202226!important}
.ft-dialog-frame .el-dialog__footer{display:flex;align-items:center;justify-content:center;gap:8px;box-sizing:border-box;margin:0!important;padding:12px 16px 16px!important;border-top:1px solid var(--ft-dialog-frame-line)!important;background:#202226!important}
.ft-dialog-frame .el-dialog__footer .el-button{min-width:88px;height:32px;margin:0!important;border-color:#555d68;background:#2c3036;color:#d5dbe4;font-size:12px;font-weight:400!important}
.ft-dialog-frame .el-dialog__footer .el-button:hover{border-color:#737d8a;background:#343940;color:#f0f3f7}
.ft-dialog-frame .el-dialog__footer .el-button--primary{border-color:#bb984a;background:#bb984a;color:#fff}
.ft-dialog-frame .el-dialog__footer .el-button--primary:hover{border-color:#c8a757;background:#c8a757;color:#fff}
.ft-dialog-frame .el-dialog__footer .el-button--danger{border-color:#8d4d58;background:#5b353c;color:#f1c8cf}
.ft-dialog-frame .el-dialog__footer .el-button--danger:hover{border-color:#a45b67;background:#6b3d45;color:#fff}
.ft-dialog-frame .settings-title,.ft-dialog-frame .message-center-header,.ft-dialog-frame .cp-header,.ft-dialog-frame .close-position-header{box-sizing:border-box;width:100%;height:48px!important;padding:0!important;border:0!important}
</style>
