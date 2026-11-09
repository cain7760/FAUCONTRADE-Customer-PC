import { read, utils } from 'xlsx'
import { instruments, validateInquiry } from './inquiryModel.js'

export const batchColumns = [
  ['name','标的简称'],['code','标的代码'],['direction','期权方向'],['size','询价规模(万)'],['strike','执行价(%)'],['tenor','期限'],['currency','币种'],['knockout','敲出规则'],['exercise','最快行权日'],['dividend','分红规则'],
]
export const maxBatchRows = 500
const clean = value => String(value ?? '').trim()
const headerKey = value => clean(value).replace(/[（]/g,'(').replace(/[）]/g,')').replace(/\s/g,'')
function resolveInstrument(value) {
  let code = clean(value).toUpperCase().replace(/\.(SZ|SH|HK)$/,'').replace(/(SZ|SH)$/,'')
  if (/^\d+$/.test(code)) {
    const candidates = /\.HK$/i.test(clean(value)) || code.length === 5 ? [code.padStart(5,'0')] : [code.padStart(6,'0'),code.padStart(5,'0')]
    return instruments.find(item => candidates.includes(item.code))
  }
  return instruments.find(item => item.code === code)
}
export function parseBatchWorkbook(buffer) {
  let workbook
  try { workbook = read(buffer, { type:'array', cellFormula:true, cellNF:true, sheetRows:maxBatchRows + 2 }) }
  catch { throw new Error('文件无法读取，请使用下载的 Excel 模板重新保存') }
  const sheet = workbook.Sheets['批量询价']
  if (!sheet) throw new Error('缺少「批量询价」工作表，请使用下载的模板')
  const matrix = utils.sheet_to_json(sheet,{header:1,defval:'',blankrows:true,raw:true})
  if (!matrix.length) throw new Error('文件为空，请填写询价记录')
  const headers = matrix[0].map(headerKey)
  const indexes = batchColumns.map(([,label]) => {
    const matches = headers.flatMap((value,index) => value === headerKey(label) ? [index] : [])
    if (matches.length !== 1) throw new Error(`模板字段「${label}」缺失或重复`)
    return matches[0]
  })
  const usedRange = sheet['!fullref'] || sheet['!ref']
  if (usedRange && utils.decode_range(usedRange).e.r > maxBatchRows) throw new Error(`每次最多导入 ${maxBatchRows} 行，请拆分文件`)
  const rows = matrix.slice(1).flatMap((values,index) => {
    if (values.every(value => clean(value) === '')) return []
    const rowNo = index + 2
    const raw = Object.fromEntries(batchColumns.map(([key],i) => [key,clean(values[indexes[i]])]))
    const instrument = resolveInstrument(raw.code)
    const errors = []
    for (const column of indexes) if (sheet[utils.encode_cell({r:index+1,c:column})]?.f) errors.push('参数不可使用公式，请粘贴为数值')
    if (!instrument) errors.push('标的代码不在当前标的库中')
    if (instrument && raw.name && raw.name !== instrument.name) errors.push('标的简称与代码不匹配')
    const strikeCell = sheet[utils.encode_cell({r:index+1,c:indexes[4]})]
    const strike = typeof values[indexes[4]] === 'number' && strikeCell?.z?.includes('%') ? values[indexes[4]] * 100 : Number(raw.strike.replace(/%$/,''))
    const draft = {code:instrument?.code || raw.code,direction:raw.direction === '看涨' ? 'call' : raw.direction,size:Number(raw.size.replace(/,/g,'')),strikes:[strike],tenors:[raw.tenor.toUpperCase()],currency:raw.currency.toUpperCase(),knockout:raw.knockout,exercise:raw.exercise,dividend:raw.dividend}
    const error = validateInquiry(draft)
    if (error && !errors.includes(error)) errors.push(error)
    for (const [key,allowed,label] of [['knockout',['主3创2','连板敲出','协商敲出','3连板','无要求'],'敲出规则'],['exercise',['T+1','T+5','无要求'],'最快行权日'],['dividend',['分红调整','分红不调整','分红调整初价','无要求'],'分红规则']]) if (raw[key] && !allowed.includes(raw[key])) errors.push(`${label}不在支持范围内`)
    return [{id:rowNo,rowNo,...raw,name:raw.name || instrument?.name || '',draft,errors}]
  })
  if (!rows.length) throw new Error('没有可导入的记录，请先填写「批量询价」工作表')
  return rows
}
export function validateBatchRows(rows) {
  const seen = new Set()
  return rows.map(row => {
    const errors = [...row.errors]
    const d = row.draft
    const key = JSON.stringify([d.code,d.direction,d.size,d.tenors,d.strikes,d.currency,d.knockout,d.exercise,d.dividend])
    if (seen.has(key)) errors.push('与文件中的其他询价记录重复')
    seen.add(key)
    return {...row,errors}
  })
}
