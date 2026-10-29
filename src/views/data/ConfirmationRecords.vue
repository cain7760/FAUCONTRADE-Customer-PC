<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowDownBold, Refresh } from '@element-plus/icons-vue'
import TradingTable from '../../components/trading/TradingTable.vue'
import SortHeader from '../../components/trading/SortHeader.vue'
import TradingOperationColumn from '../../components/trading/TradingOperationColumn.vue'
import { confirmationColumns, confirmationFilterFields } from './confirmationModel.js'
import ConfirmationFilterField from './ConfirmationFilterField.vue'
import { useConfirmationRecords } from './useConfirmationRecords.js'
import { prepareConfirmationDownload, saveConfirmationDownload } from './confirmationDownload.js'

const props = defineProps({ context: { type: Object, required: true } })
const { orderFilterBar, visibleOrderFilterCount } = props.context
const primaryFilterFields = confirmationFilterFields.filter(field => field.primary)
const moreFilterFields = computed(() => [...primaryFilterFields.slice(visibleOrderFilterCount.value), ...confirmationFilterFields.filter(field => !field.primary)])
const { today, draft, refreshKey, page, pageSize, sort, error, rows, groups, pageGroups, query, reset, sortBy, selected, allSelected, partiallySelected, toggleSelection, selectPage } = useConfirmationRecords()
const downloading = ref(false)
async function download(ids) {
  if (downloading.value) return
  downloading.value = true
  try { const archive = await prepareConfirmationDownload(ids, { baseUrl: import.meta.env.BASE_URL }); saveConfirmationDownload(archive); ElMessage.success(`已生成 ${archive.count} 份交易确认书`) }
  catch (error) { ElMessage.error(error.message || '下载失败，请重试') }
  finally { downloading.value = false }
}
const defaults = confirmationColumns.map(column => column.key).filter(key => key !== 'documentNo')
const visibleColumns = ref([...defaults])
const columns = computed(() => visibleColumns.value.map(key => confirmationColumns.find(column => column.key === key)))
const options = confirmationColumns.map(column => [column.key, column.label])
function toggleSort(key) {
  sortBy(key, sort.value.key !== key || !sort.value.direction ? 'ascending' : sort.value.direction === 'ascending' ? 'descending' : null)
}
function cell(row, key) {
  if (row.isDocument) return key === 'template' ? row.template : ''
  return ['documentNo', 'template'].includes(key) ? '' : row[key] || '--'
}
</script>

<template>
  <div class="confirmation-records">
    <div ref="orderFilterBar" class="order-filters confirmation-filter-bar">
      <el-button class="filter-query confirmation-batch-download" size="small" :disabled="!selected.length || downloading" :loading="downloading" @click="download(selected)">生成交易确认书{{ selected.length ? ` (${selected.length})` : '' }}</el-button>
      <ConfirmationFilterField v-for="(field, index) in primaryFilterFields" v-show="index < visibleOrderFilterCount" :key="field.key" v-model="draft[field.key]" :field="field" :max-date="today" />
      <el-popover trigger="click" placement="bottom-start" :width="282" popper-class="variant-popper order-filter-more-popper"><template #reference><el-button class="order-filter-more order-filter-more-required" aria-label="更多筛选条件">更多<el-icon><ArrowDownBold /></el-icon></el-button></template><div class="order-filter-more-panel"><ConfirmationFilterField v-for="field in moreFilterFields" :key="field.key" v-model="draft[field.key]" :field="field" :max-date="today" in-popover /></div></el-popover>
      <el-button class="filter-query" @click="query">查询</el-button><el-button link @click="reset">重置</el-button>
      <div class="table-toolbar-actions"><el-tooltip content="刷新当前表格" placement="top"><button class="refresh-table" aria-label="刷新交易确认书" @click="query"><el-icon><Refresh /></el-icon></button></el-tooltip></div>
    </div>
    <p v-if="error" class="confirmation-error" role="alert">{{ error }}</p>
    <TradingTable :key="refreshKey" class="original-fields orders-table" :data="pageGroups" row-key="id" default-expand-all :tree-props="{ children: 'children' }" height="100%" :fit="false" empty-text="暂无交易确认书记录">
      <el-table-column width="56" fixed="left" align="left" header-align="left" class-name="confirmation-selection-column" label-class-name="confirmation-selection-column"><template #header><el-checkbox :model-value="allSelected" :indeterminate="partiallySelected" :disabled="!pageGroups.length || downloading" aria-label="选择本页全部确认书" @change="selectPage" /></template><template #default="{ row }"><el-checkbox v-if="row.isDocument" :model-value="selected.includes(row.documentNo)" :disabled="downloading" :aria-label="`选择确认书 ${row.documentNo}`" @change="toggleSelection(row.documentNo)" /></template></el-table-column>
      <el-table-column label="确认书文档编号" :width="confirmationColumns[0].width" show-overflow-tooltip fixed="left" label-class-name="confirmation-document-heading"><template #default="{ row }"><span v-if="row.isDocument">{{ row.documentNo }} ({{ row.children.length }})</span></template></el-table-column>
      <template v-for="column in columns" :key="column.key">
        <el-table-column v-if="column.key !== 'documentNo'" :prop="column.key" :width="column.width" show-overflow-tooltip>
          <template #header><SortHeader :label="column.label" :direction="sort.key === column.key ? sort.direction : null" @sort="toggleSort(column.key)" /></template>
          <template #default="{ row }">{{ cell(row, column.key) }}</template>
        </el-table-column>
      </template>
      <TradingOperationColumn :width="112" v-model="visibleColumns" :options="options.filter(([key]) => key !== 'documentNo')" :defaults="defaults">
        <template #default="{ row }"><button v-if="row.isDocument" type="button" class="history-view confirmation-generate-action" :disabled="downloading" :aria-label="`生成交易确认书 ${row.documentNo}`" @click.stop="download([row.documentNo])">生成交易确认书</button></template>
      </TradingOperationColumn>
    </TradingTable>
    <footer class="positions-footer confirmation-footer"><span>共 {{ groups.length }} 份交易确认书 · {{ rows.length }} 条交易事件</span><el-pagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[20, 50, 100]" :total="groups.length" layout="sizes, prev, pager, next" small /></footer>
  </div>
</template>

<style scoped>
.confirmation-records { display: flex; flex: 1; flex-direction: column; min-height: 0; min-width: 0; }
.confirmation-records .order-filters > .confirmation-batch-download { width: 120px; height: 28px; margin-right: 16px; padding: 0 6px; font-size: 12px; }
.confirmation-generate-action:disabled { opacity: .5; cursor: not-allowed; }
.confirmation-error { margin: 0; padding: 4px 12px; color: #ed858b; font-size: 12px; }
/* 表头移入左侧选择列，与展开箭头图标共用左边缘。 */
.confirmation-records :deep(.confirmation-document-heading .cell) { overflow: visible; transform: translateX(-25px); }
/* 树表自动把箭头放在首列；这里只重排选择列，使全选框与父节点复选框共用左边缘。 */
.confirmation-records :deep(.confirmation-selection-column .cell) { display: flex; align-items: center; gap: 4px; padding-left: 12px; overflow: visible; }
.confirmation-records :deep(.confirmation-selection-column .el-checkbox) { order: -1; flex: none; margin: 0; }
.confirmation-records :deep(.confirmation-selection-column .el-table__expand-icon) { flex: none; margin: 0; }
.confirmation-records :deep(.confirmation-selection-column .el-table__indent),
.confirmation-records :deep(.confirmation-selection-column .el-table__placeholder) { display: none; }
.confirmation-footer { display: flex; flex: none; min-height: 38px; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
</style>
