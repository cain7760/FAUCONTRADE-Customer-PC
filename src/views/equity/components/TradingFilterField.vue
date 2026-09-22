<script setup>
defineProps({ label: { type: String, required: true } })
</script>

<template>
  <label class="trading-filter-field">
    <span>{{ label }}</span>
    <slot />
  </label>
</template>

<style>
.trading-filter-field{display:grid;gap:5px;min-width:0;color:#969eaa;font-size:11px}.trading-filter-field>span{text-align:left;line-height:16px;white-space:nowrap}.trading-filter-field .el-input,.trading-filter-field .el-select{height:28px}.trading-filter-field .el-input__wrapper,.trading-filter-field .el-select__wrapper{box-sizing:border-box;height:28px;min-height:28px;background:#1b1d20;box-shadow:0 0 0 1px #3b3f46 inset}.trading-filter-field .el-input__wrapper:hover,.trading-filter-field .el-select__wrapper:hover{box-shadow:0 0 0 1px #e8eaed inset}.trading-filter-field .el-input__wrapper.is-focus,.trading-filter-field .el-select__wrapper.is-focused{box-shadow:0 0 0 1px #bb984a inset}.trading-filter-field .el-input__inner{color:#d8dee6;font-size:11px}.trading-filter-field .el-input__inner::placeholder{color:#747b87;opacity:1}.trading-filter-popper.el-popper{border-color:#3b3f46;background:#24272c}.trading-filter-popper .el-select-dropdown__item{height:30px;color:#cbd2dc;font-size:11px;line-height:30px}.trading-filter-popper .el-select-dropdown__item.is-hovering,.trading-filter-popper .el-select-dropdown__item:hover{background:#30343a}.trading-filter-popper .el-select-dropdown__item.is-selected{background:#353026;color:#dfc890;font-weight:400}
</style>
