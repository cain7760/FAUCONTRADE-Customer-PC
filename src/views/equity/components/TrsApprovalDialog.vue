<script setup>
import { computed, ref, watch } from 'vue'
import { Upload } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import BaseDialog from '../../../components/BaseDialog.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  approval: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'submit'])

const approvalForm = ref({ chain: '', remark: '' })
const approvalFiles = ref([])
const approvalError = ref('')
const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})
const isDetail = computed(() => Boolean(props.approval))
const allowedExtensions = new Set(['doc', 'docx', 'xls', 'xlsx', 'pdf', 'png', 'jpg', 'jpeg'])

watch(() => props.modelValue, isVisible => {
  if (!isVisible) return
  if (isDetail.value) return
  approvalForm.value = { chain: '', remark: '' }
  approvalFiles.value = []
  approvalError.value = ''
})

function validateFile(file) {
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  const exceedsSize = (file.raw?.size || 0) > 20 * 1024 * 1024
  if (allowedExtensions.has(extension) && !exceedsSize) return
  approvalFiles.value = approvalFiles.value.filter(item => item.uid !== file.uid)
  ElMessage.error(allowedExtensions.has(extension) ? `“${file.name}”超过 20MB，请压缩或更换文件` : `“${file.name}”格式不支持，请选择 Word、Excel、PDF 或 PNG/JPG 文件`)
}

function handleFileExceed() {
  ElMessage.warning('最多上传 8 个审批材料，请先删除不需要的文件')
}

function submit() {
  if (!approvalForm.value.chain) {
    approvalError.value = '请选择审批流'
    return
  }
  emit('submit', {
    ...approvalForm.value,
    attachments: approvalFiles.value.map(file => file.name),
  })
}
</script>

<template>
  <BaseDialog v-model="visible" :title="isDetail ? '审批详情' : '转审批'" width="480px" align-center append-to-body class="trs-action-dialog trs-approval-dialog">
    <div class="trs-action-dialog-body">
      <template v-if="isDetail">
        <p>该订单正在审批中，审批完成前不可下单、拆单或拒单。</p>
        <dl class="trs-approval-detail"><dt>审批流</dt><dd>{{ approval.chain }}</dd><dt>审批说明</dt><dd>{{ approval.remark || '--' }}</dd><dt>提交时间</dt><dd>{{ approval.submittedAt }}</dd><dt>审批材料</dt><dd>{{ approval.attachments?.length ? approval.attachments.join('、') : '--' }}</dd></dl>
      </template>
      <template v-else>
        <p>提交后订单将进入审批中；审批通过后才可继续处理。</p>
        <label class="trs-action-field">审批流
          <el-select v-model="approvalForm.chain" placeholder="请选择审批流" popper-class="variant-popper">
            <el-option label="客户保证金不足审批" value="客户保证金不足审批" />
            <el-option label="客户余额不足审批" value="客户余额不足审批" />
            <el-option label="非标合约审批" value="非标合约审批" />
          </el-select>
        </label>
        <label class="trs-action-field">审批说明
          <el-input v-model="approvalForm.remark" type="textarea" :rows="4" maxlength="300" show-word-limit placeholder="请输入审批说明" />
        </label>
        <label class="trs-action-field">审批材料
          <el-upload v-model:file-list="approvalFiles" class="trs-approval-upload" action="#" accept=".doc,.docx,.xls,.xlsx,.pdf,.png,.jpg,.jpeg" :auto-upload="false" :limit="8" multiple :on-change="validateFile" :on-exceed="handleFileExceed">
            <el-button plain :icon="Upload">选择文件</el-button>
            <template #tip><span class="trs-approval-upload-tip">支持 Word、Excel、PDF、PNG/JPG；单个文件不超过 20MB，最多 8 个。</span></template>
          </el-upload>
        </label>
        <p v-if="approvalError" class="trs-action-validation is-error">{{ approvalError }}</p>
      </template>
    </div>
    <template #footer>
      <template v-if="isDetail"><el-button type="primary" @click="visible = false">关闭[Esc]</el-button></template>
      <template v-else><el-button @click="visible = false">取消[Esc]</el-button><el-button type="primary" @click="submit">提交审批[Enter]</el-button></template>
    </template>
  </BaseDialog>
</template>
