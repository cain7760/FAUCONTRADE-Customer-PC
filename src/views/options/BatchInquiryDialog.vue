<script setup>
import { computed, ref, watch } from 'vue'
import { UploadFilled, Download, CircleCheck, Search } from '@element-plus/icons-vue'
import BaseDialog from '../../components/BaseDialog.vue'
import DialogActions from '../../components/DialogActions.vue'
import OutlineActionButton from '../../components/OutlineActionButton.vue'
import TradingTable from '../../components/trading/TradingTable.vue'
import SortHeader from '../../components/trading/SortHeader.vue'
import OptionDirectionBadge from './OptionDirectionBadge.vue'
import { useDialogShortcuts } from '../../composables/useDialogShortcuts'
import { batchColumns, maxBatchRows, parseBatchWorkbook, validateBatchRows } from './batchInquiryExcel.js'
const baseUrl = import.meta.env.BASE_URL
const props = defineProps({ modelValue:Boolean, paused:Boolean, submitBatch:{type:Function,required:true} })
const emit = defineEmits(['update:modelValue'])
const fileInput = ref(null), filename = ref(''), rows = ref([]), message = ref(''), reading = ref(false), submitting = ref(false), dragging = ref(false)
let readVersion = 0
const checkedRows = computed(() => validateBatchRows(rows.value))
const symbolSearch = ref('')
const sort = ref({ key:'', direction:null })
const columnWidths = { name:120, code:96, direction:80, size:104, strike:96, tenor:68, currency:64, knockout:96, exercise:104, dividend:104 }
const previewRows = computed(() => {
  const keyword = symbolSearch.value.trim().toLowerCase()
  const matching = checkedRows.value.filter(row => !keyword || `${row.name} ${row.code} ${row.draft.code}`.toLowerCase().includes(keyword))
  if (!sort.value.direction) return matching
  const { key, direction } = sort.value
  const value = row => key === 'size' ? row.draft.size : key === 'strike' ? row.draft.strikes[0] : key === 'tenor' ? Number.parseFloat(row.tenor) : key === 'errors' ? row.errors.join('；') || '通过' : row[key]
  return [...matching].sort((a,b) => {
    const x = value(a), y = value(b)
    if (typeof x === 'number' && typeof y === 'number') {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return Number.isFinite(x) ? -1 : Number.isFinite(y) ? 1 : a.rowNo-b.rowNo
    }
    const result = typeof x === 'number' ? x-y : String(x).localeCompare(String(y),'zh-CN',{numeric:true})
    return result * (direction === 'ascending' ? 1 : -1) || a.rowNo-b.rowNo
  })
})
function toggleSort(key) { sort.value = { key, direction:sort.value.key !== key || !sort.value.direction ? 'ascending' : sort.value.direction === 'ascending' ? 'descending' : null } }
const invalidCount = computed(() => checkedRows.value.filter(row => row.errors.length).length)
const close = () => { if (!submitting.value) emit('update:modelValue',false) }
watch(() => props.modelValue, open => { if (open) { ++readVersion; filename.value=''; rows.value=[]; message.value=''; symbolSearch.value=''; reading.value=false } else ++readVersion })
function chooseFile(){fileInput.value?.click()}
async function loadFiles(files) {
  const version = ++readVersion
  reading.value=false
  symbolSearch.value=''
  sort.value={key:'',direction:null}
  message.value='';rows.value=[];filename.value=''
  if (files.length !== 1) { message.value='请每次上传一个 Excel 文件'; return }
  const file = files[0]
  if (!/\.(xls|xlsx)$/i.test(file.name)) { message.value='仅支持 .xls、.xlsx 格式'; return }
  if (file.size > 5 * 1024 * 1024) { message.value='文件不可超过 5MB'; return }
  reading.value=true
  try {
    const parsed = parseBatchWorkbook(await file.arrayBuffer())
    if(version !== readVersion) return
    rows.value=parsed;filename.value=file.name
  } catch(error) { if(version === readVersion) message.value=error.message || '导入失败，请检查文件' }
  finally { if(version === readVersion) reading.value=false }
}
function handleFile(event){const files=[...event.target.files];event.target.value='';if(files.length)loadFiles(files)}
function drop(event){dragging.value=false;if(!submitting.value)loadFiles([...event.dataTransfer.files])}
async function submit(){
  if(submitting.value || reading.value || !rows.value.length || invalidCount.value || props.paused)return
  submitting.value=true;message.value=''
  try { await props.submitBatch(checkedRows.value.map(row=>row.draft));emit('update:modelValue',false) }
  catch(error){message.value=error.message || '询价提交失败，请重试'}
  finally{submitting.value=false}
}
useDialogShortcuts(computed(() => props.modelValue), {
  confirm: submit,
  cancel: close,
  ignoreEnterFrom: 'button, a, [role="button"]',
})
</script>
<template>
  <BaseDialog :model-value="modelValue" title="批量询价" width="950px" align-center class="batch-inquiry-dialog" :close-on-click-modal="false" :close-on-press-escape="!submitting" @update:model-value="close">
    <div class="batch-template-note"><span>上传前请按 Excel 模板填写询价参数</span><a :href="`${baseUrl}templates/option-inquiry-template.xlsx`" download="期权批量询价模板.xlsx"><el-icon><Download/></el-icon>下载 Excel 模板</a></div>
    <div class="batch-file-toolbar"><OutlineActionButton :disabled="reading || submitting" @click="chooseFile">{{filename ? '重新上传' : '上传文件'}}</OutlineActionButton><template v-if="filename"><svg class="batch-excel-icon" viewBox="0 0 20 20" role="img" aria-label="Excel 文件"><rect x="6" y="2" width="13" height="16" rx="1.5" fill="#21a366"/><path d="M10 6h6M10 10h6M10 14h6M13 4v12" fill="none" stroke="#fff" stroke-opacity=".65" stroke-width=".8"/><rect x="1" y="5" width="10" height="12" rx="1" fill="#107c41"/><path d="m3.5 8 4.5 6m0-6-4.5 6" fill="none" stroke="#fff" stroke-width="1.5"/></svg><span class="batch-filename">{{filename}}</span><span class="batch-import-state" :class="{invalid:invalidCount}"><el-icon v-if="!invalidCount"><CircleCheck/></el-icon>{{invalidCount ? `${invalidCount} 条记录需修正或移除` : `校验通过，共 ${rows.length} 条`}}</span></template><el-input v-model="symbolSearch" class="batch-symbol-search" :prefix-icon="Search" placeholder="标的名称 / 代码" aria-label="搜索导入标的" clearable :disabled="!filename || submitting"/></div>
    <input ref="fileInput" type="file" accept=".xls,.xlsx" hidden aria-label="上传批量询价文件" @change="handleFile"/>
    <div v-if="!filename" class="batch-upload-area" :class="{'is-dragging':dragging}" role="button" tabindex="0" aria-label="选择或拖拽 Excel 文件" @click="chooseFile" @keydown.enter.prevent="chooseFile" @keydown.space.prevent="chooseFile" @dragover.prevent="dragging=true" @dragleave.prevent="dragging=false" @drop.prevent.stop="drop">
      <el-icon><UploadFilled/></el-icon><strong>{{reading ? '正在读取文件…' : '点击上传，或将文件拖拽至此区域'}}</strong><span>支持 .xls、.xlsx，最多 {{maxBatchRows}} 条，文件不超过 5MB</span>
    </div>
    <TradingTable v-else class="batch-preview-table" table-layout="fixed" :data="previewRows" row-key="id" height="100%" :row-class-name="({row})=>row.errors.length?'batch-invalid-row':''">
      <el-table-column v-for="[key,label] in batchColumns" :key="key" :prop="key" :label="label" :class-name="['size','strike','tenor'].includes(key) ? 'batch-numeric-column' : ''" :fixed="['name','code'].includes(key)?'left':false" :width="columnWidths[key]" align="left" header-align="left" show-overflow-tooltip><template #header><span v-if="['name','code'].includes(key)">{{label}}</span><SortHeader v-else :label="label" :numeric="['size','strike','tenor'].includes(key)" :direction="sort.key === key ? sort.direction : null" @sort="toggleSort(key)"/></template><template #default="{row}"><OptionDirectionBadge v-if="key === 'direction' && row.direction === '看涨'" /><span v-else>{{row[key]}}</span></template></el-table-column>
      <el-table-column label="校验结果" width="144" align="left" header-align="left" show-overflow-tooltip><template #header><SortHeader label="校验结果" :direction="sort.key === 'errors' ? sort.direction : null" @sort="toggleSort('errors')"/></template><template #default="{row}"><span :class="{'batch-error-text':row.errors.length}">{{row.errors.join('；') || '通过'}}</span></template></el-table-column>
      <el-table-column label="操作" width="56" fixed="right" align="center"><template #default="{row}"><el-button link type="primary" :disabled="submitting" @click="rows=rows.filter(item=>item.id!==row.id)">移除</el-button></template></el-table-column>
    </TradingTable>
    <p v-if="message" class="batch-error-text" role="alert">{{message}}</p>
    <p class="batch-import-footnote"><template v-if="symbolSearch.trim()">当前显示 {{previewRows.length}} / {{rows.length}} 条，提交全部 {{rows.length}} 条未移除记录。</template>每行是一组独立询价参数；同一标的可填写不同规模、期限。仅支持看涨。</p>
    <template #footer><DialogActions cancel-text="取消[Esc]" confirm-text="提交询价[Enter]" :loading="submitting" :confirm-disabled="paused || reading || !rows.length || !!invalidCount" @cancel="close" @confirm="submit"/></template>
  </BaseDialog>
</template>
<style>
.batch-inquiry-dialog.el-dialog{display:flex;flex-direction:column;box-sizing:border-box;height:650px;max-width:calc(100vw - 32px);max-height:calc(100dvh - 32px);padding:0}
.batch-inquiry-dialog .el-dialog__header{flex-shrink:0}
.batch-inquiry-dialog .el-dialog__body{display:flex;flex:1;flex-direction:column;min-height:0;padding:16px;overflow:auto;color:var(--el-text-color-regular);font-size:12px}
/* 公共框架的 footer 使用重要声明；此处只将定高按钮区的留白改为上下对称。 */
.batch-inquiry-dialog.ft-dialog-frame .el-dialog__footer{flex:0 0 64px;padding:0 16px!important}
.batch-inquiry-dialog .batch-template-note,.batch-inquiry-dialog .batch-file-toolbar,.batch-inquiry-dialog .batch-import-footnote{flex-shrink:0}
.batch-template-note{display:flex;gap:20px;align-items:center;flex-wrap:wrap;padding:12px 14px;background:var(--el-fill-color-light)}
.batch-template-note a{display:inline-flex;gap:6px;align-items:center;text-decoration:none;color:var(--el-color-primary)}
.batch-file-toolbar{display:flex;align-items:center;gap:10px;margin:16px 0;min-height:28px}.batch-excel-icon{width:16px;height:16px;flex:none}.batch-filename{min-width:0;max-width:32%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.batch-import-state{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;color:#53b395}.batch-import-state.invalid,.batch-error-text{color:var(--el-color-danger)}
.batch-file-toolbar>.batch-symbol-search{flex:0 0 180px;width:180px;height:28px;margin-left:auto}.batch-symbol-search .el-input__wrapper{height:28px;min-height:28px;box-sizing:border-box;background:var(--el-fill-color-blank)}.batch-symbol-search .el-input__inner{height:26px;line-height:26px;font-size:12px}
.batch-upload-area{flex:1;min-height:160px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;border:1px dashed #555d68;background:var(--el-fill-color-light);cursor:pointer;color:var(--el-text-color-secondary)}.batch-upload-area>.el-icon{font-size:42px}.batch-upload-area strong{font-size:14px;font-weight:400;color:var(--el-text-color-regular)}.batch-upload-area.is-dragging{border-color:var(--el-color-primary);background:#353126}.batch-import-footnote{margin:12px 0 0;color:var(--el-text-color-secondary)}
.batch-preview-table{--el-table-bg-color:#1e2023;--el-table-tr-bg-color:#1e2023;--el-table-header-bg-color:#25282d;--el-table-row-hover-bg-color:#2c3036;--el-table-border-color:#30343a;--el-table-text-color:#c2c6ce;--el-table-header-text-color:#969eaa;font-size:12px}.batch-preview-table .batch-invalid-row{--el-table-tr-bg-color:#302328}.batch-preview-table .el-button{font-size:12px}
.batch-preview-table.el-table{flex:1;min-height:0}
.batch-preview-table td.batch-numeric-column>.cell{font-size:13px;font-family:var(--ft-font-numeric);font-variant-numeric:tabular-nums;font-weight:500;}
/* auto 布局将表头放进 body，固定列在所有横向滚动位置都使用同一表头背景。 */
.batch-preview-table.el-table th.el-table-fixed-column--left,.batch-preview-table.el-table th.el-table-fixed-column--right{background:var(--el-table-header-bg-color)}
.batch-preview-table.el-table td.el-table-fixed-column--left,.batch-preview-table.el-table td.el-table-fixed-column--right{background:var(--el-table-tr-bg-color)}
.batch-preview-table.el-table tr.hover-row>td.el-table-fixed-column--left,.batch-preview-table.el-table tr.hover-row>td.el-table-fixed-column--right{background:var(--el-table-row-hover-bg-color)}
</style>
