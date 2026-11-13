<script setup>
import callIcon from '../../assets/icons/option-call.svg'
</script>

<template>
  <span class="option-call-icon" :style="{ maskImage: `url(${callIcon})` }" aria-hidden="true" />
</template>

<style scoped>
.option-call-icon {
  display: inline-block;
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  background-color: currentColor;
  mask-size: contain;
  mask-position: center;
  mask-repeat: no-repeat;
}
</style>
