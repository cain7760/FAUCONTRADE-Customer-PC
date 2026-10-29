<script setup>
import { inject } from 'vue'
import { money, price as formatPrice } from '../variantData'
import { tradingContextKey, chaseActionsVisible } from '../tradingContext'
import SharedRecords from '../../../components/trading/TradeRecords.vue'
const context = { ...inject(tradingContextKey), money, formatPrice, chaseActionsVisible }
</script>

<template><SharedRecords :context="context" /></template>
