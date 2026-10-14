<script setup>
const { activeOrder, splitInputLabel, isAmountOrder } = defineProps({
  activeOrder: Object,
  splitInputLabel: String,
  isAmountOrder: Boolean,
})
</script>

<template>
  <table><tbody><tr><th>交易类型</th><td>新单</td><th>标的物</th><td>{{ `${activeOrder.underlying}（${activeOrder.code?.split('.')[0] || '--'}）` }}</td></tr><tr><th>方向</th><td>{{ activeOrder.direction }}</td><th>订单属性</th><td>{{ activeOrder.attribute }}</td></tr><tr><th>订单价格</th><td class="trs-numeric">{{ activeOrder.price }}</td><th>{{ splitInputLabel }}</th><td class="trs-numeric">{{ isAmountOrder ? activeOrder.amount : activeOrder.quantity }}</td></tr><tr><th>{{ isAmountOrder ? '预估数量' : '下单金额' }}</th><td class="trs-numeric">{{ isAmountOrder ? activeOrder.quantity : activeOrder.amount }}</td><th>提交时间</th><td>{{ activeOrder.submittedAt }}</td></tr><tr><th>备注</th><td colspan="3">{{ activeOrder.remark }}</td></tr><tr v-if="activeOrder.request"><th>客户请求</th><td colspan="3">{{ activeOrder.request }}</td></tr><tr v-if="activeOrder.approval"><th>审批状态</th><td colspan="3">{{ activeOrder.approval.chain }} · 审批中</td></tr><tr v-if="activeOrder.approval?.attachments?.length"><th>审批材料</th><td colspan="3">{{ activeOrder.approval.attachments.join('、') }}</td></tr></tbody></table>
</template>
