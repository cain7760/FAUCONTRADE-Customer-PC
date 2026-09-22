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
.ft-dialog-frame .el-dialog__footer{box-sizing:border-box;border-top:1px solid var(--ft-dialog-frame-line)!important;background:#202226!important}
.ft-dialog-frame .el-dialog__footer .el-button{font-weight:400!important}
.ft-dialog-frame .settings-title,.ft-dialog-frame .message-center-header,.ft-dialog-frame .cp-header,.ft-dialog-frame .close-position-header{box-sizing:border-box;width:100%;height:48px!important;padding:0!important;border:0!important}
</style>
