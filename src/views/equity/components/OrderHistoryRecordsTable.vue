<script setup>
import TradingTable from './TradingTable.vue'

const { records } = defineProps({ records: Array })
</script>

<template>
        <TradingTable :data="records" class="history-records-table"><el-table-column prop="operator" label="操作人" width="104" /><el-table-column prop="time" label="操作时间" width="150" /><el-table-column prop="type" label="操作类型" width="104" /><el-table-column prop="content" label="操作内容" min-width="220" /></TradingTable>
</template>
