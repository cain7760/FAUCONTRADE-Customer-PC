<script setup>
import FeatureAnnotation from '../../components/FeatureAnnotation.vue'
defineProps({ target: { type: Object, required: true } })
</script>

<template>
  <FeatureAnnotation number="01" title="重询" :target="target">
      <h4>功能说明</h4>
      <ol>
        <li>点击重询，先弹出确认窗口；取消不改变任何记录。</li>
        <li>确认后沿用所选组的询价参数（批量重询为全部勾选组），生成独立的新询价组，原始记录保留。</li>
        <li>原询价整组变为「报价已失效」，旧报价不可继续下单。</li>
        <li>新组等待反馈时显示「重询中…」，收到反馈后展示报价或「暂无报价」。</li>
        <li>非交易时间提交时提示「当前非交易时间，不可进行操作。」；系统中断时不可提交。</li>
        <li>服务端需同步使原询价失效，并校验旧报价不可下单。客户侧不区分系统自动反馈或交易员手动反馈；如需修改参数，应重新发起询价。</li>
      </ol>
    </FeatureAnnotation>
</template>
