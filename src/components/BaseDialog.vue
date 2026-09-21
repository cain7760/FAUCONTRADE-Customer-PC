<script setup>
defineOptions({ inheritAttrs: false })

defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <el-dialog v-bind="$attrs" :model-value="modelValue" class="ft-dialog-frame" @update:model-value="emit('update:modelValue', $event)">
    <template v-if="$slots.header" #header="slotProps"><slot name="header" v-bind="slotProps" /></template>
    <slot />
    <template v-if="$slots.footer" #footer="slotProps"><slot name="footer" v-bind="slotProps" /></template>
  </el-dialog>
</template>

<style>
.ft-dialog-frame.el-dialog{--ft-dialog-frame-line:#313238;overflow:hidden;border:1px solid var(--ft-dialog-frame-line)!important;border-radius:5px!important;background:#202226!important;box-shadow:0 22px 64px #000b}
.ft-dialog-frame .el-dialog__header{box-sizing:border-box;height:48px;margin:0!important;padding:0 16px!important;border-bottom:1px solid var(--ft-dialog-frame-line)!important;background:#24272c!important}
.ft-dialog-frame .el-dialog__title{display:inline-flex;align-items:center;height:100%;color:#e6ebf3!important;font-size:14px!important;font-weight:600!important;line-height:20px!important}
.ft-dialog-frame .el-dialog__header h2{color:#e6ebf3!important;font-size:14px!important;font-weight:600!important;line-height:20px!important}
.ft-dialog-frame .el-dialog__header h2{margin:0}
.ft-dialog-frame .el-dialog__headerbtn{top:0!important;right:0!important;display:grid;place-items:center;width:48px!important;height:48px!important;color:#aebaca!important}
.ft-dialog-frame .el-dialog__headerbtn:hover{color:#e6ebf3!important}
.ft-dialog-frame .el-dialog__body{background:#202226!important}
.ft-dialog-frame .el-dialog__footer{box-sizing:border-box;border-top:1px solid var(--ft-dialog-frame-line)!important;background:#202226!important}
.ft-dialog-frame .el-dialog__footer .el-button{font-weight:400!important}
.ft-dialog-frame .settings-title,.ft-dialog-frame .message-center-header,.ft-dialog-frame .cp-header,.ft-dialog-frame .close-position-header{box-sizing:border-box;width:100%;height:48px!important;padding:0!important;border:0!important}
</style>
