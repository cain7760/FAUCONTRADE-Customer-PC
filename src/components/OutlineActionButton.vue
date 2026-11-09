<template>
  <el-button class="ft-outline-action" size="small"><slot/></el-button>
</template>

<style>
.ft-outline-action.el-button{height:28px;padding:0 10px;border:1px solid var(--el-color-primary);border-radius:3px;background:transparent;color:var(--el-color-primary);font-size:12px;font-weight:400}
.ft-outline-action.el-button:hover:not(:disabled){background:#bb984a18;color:var(--el-color-primary);border-color:var(--el-color-primary)}
.ft-outline-action.el-button.is-disabled{background:transparent;color:var(--el-color-primary);border-color:var(--el-color-primary);opacity:.45;cursor:not-allowed}
</style>
