import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { utils, write } from 'xlsx'
import { batchColumns, parseBatchWorkbook, validateBatchRows } from './batchInquiryExcel.js'
const valid = ['平安银行','000001','看涨',100,100,'1M','CNY','无要求','无要求','无要求']
function buffer(rows,edit){const ws=utils.aoa_to_sheet([batchColumns.map(([,label])=>label),...rows]);edit?.(ws);const wb=utils.book_new();utils.book_append_sheet(wb,ws,'批量询价');return write(wb,{type:'buffer',bookType:'xlsx'})}
test('reads independent rows for same instrument with different sizes and tenors',()=>{
 const rows=validateBatchRows(parseBatchWorkbook(buffer([valid,[...valid.slice(0,3),500,90,'2M',...valid.slice(6)]])))
 assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.draft.size),[100,500]);assert.deepEqual(rows.map(r=>r.draft.tenors[0]),['1M','2M']);assert.ok(rows.every(r=>!r.errors.length))
})
test('matches numeric identifiers and market suffixes; blank names derive from code',()=>{
 for(const [code,expected] of [[1,'000001'],['000001SZ','000001'],['00700.HK','00700'],[700,'00700'],['HSCEI','HSCEI']]){const row=[...valid];row[0]='';row[1]=code;const parsed=parseBatchWorkbook(buffer([row]))[0];assert.equal(parsed.draft.code,expected);assert.equal(parsed.errors.length,0)}
})
test('reports rejected directions, bounds, enums and code-name mismatch',()=>{
 for(const [column,value,match] of [[2,'看跌',/看涨/],[3,1.5,/整数/],[4,'1M',/执行价/],[5,'100M',/99M/],[7,'其他',/敲出/],[1,'600570',/不匹配/]]){const row=[...valid];row[column]=value;assert.match(parseBatchWorkbook(buffer([row]))[0].errors.join('；'),match)}
})
test('rejects formulas, wrong headers, empty files, too many rows, duplicate rows',()=>{
 assert.match(parseBatchWorkbook(buffer([valid],ws=>ws.D2.f='100'))[0].errors.join('；'),/公式/)
 assert.throws(()=>parseBatchWorkbook(buffer([valid],ws=>ws.A1.v='错误')),/字段/)
 assert.throws(()=>parseBatchWorkbook(buffer([])),/没有可导入/)
 assert.throws(()=>parseBatchWorkbook(buffer(Array.from({length:501},()=>valid))),/500/)
 const parsed=parseBatchWorkbook(buffer([valid,valid]));assert.match(validateBatchRows(parsed)[1].errors.join('；'),/重复/);assert.equal(validateBatchRows(parsed.slice(1))[0].errors.length,0)
})
test('understands Excel percent format without guessing ordinary decimals',()=>{
 const row=[...valid];row[4]=.8
 assert.equal(parseBatchWorkbook(buffer([row],ws=>ws.E2.z='0%'))[0].draft.strikes[0],80)
 assert.match(parseBatchWorkbook(buffer([row]))[0].errors.join('；'),/执行价/)
})
test('downloaded template has no accidental sample inquiries',()=>{
 assert.throws(()=>parseBatchWorkbook(fs.readFileSync(new URL('../../../public/templates/option-inquiry-template.xlsx',import.meta.url))),/没有可导入/)
})
