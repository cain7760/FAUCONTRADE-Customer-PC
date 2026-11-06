import test from 'node:test'
import assert from 'node:assert/strict'
import { buildInquiryItems, calculateOptionFee, canAutoQuoteBatch, createInitialInquiries, defaultDraft, markBestQuotes, quoteIsBest, resolveInquiryBatch, validateInquiry } from './inquiryModel.js'
import { useOptionsInquiry } from './useOptionsInquiry.js'

test('inquiry validation enforces independent selection limits and strike bounds', () => {
  assert.equal(validateInquiry({ ...defaultDraft(), direction: 'put' }), '目前仅支持看涨期权')
  assert.equal(validateInquiry(defaultDraft()), '')
  for (const tenor of ['1M','99M']) assert.equal(validateInquiry({ ...defaultDraft(), tenors:[tenor] }), '')
  for (const tenor of ['0M','100M','30D','1Y']) assert.match(validateInquiry({ ...defaultDraft(), tenors:[tenor] }), /99M/)
  assert.match(validateInquiry({ ...defaultDraft(), tenors: ['1M', '2M', '3M', '6M', '9M'] }), /1 至 4/)
  assert.match(validateInquiry({ ...defaultDraft(), strikes: [80, 90, 100, 105] }), /1 至 3/)
  for (const strike of [69.99, 120.01, NaN]) assert.match(validateInquiry({ ...defaultDraft(), strikes: [strike] }), /70% 至 120%/)
  for (const strike of [70, 120]) assert.equal(validateInquiry({ ...defaultDraft(), strikes: [strike] }), '')
  for (const size of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.match(validateInquiry({ ...defaultDraft(), size }), /整数询价规模/)
  assert.equal(validateInquiry({ ...defaultDraft(), size: 777 }), '')
  assert.match(validateInquiry({ ...defaultDraft(), strikes: [100, '100'] }), /重复/)
})

test('catalog permits A shares, Hong Kong shares and indices without prior inquiries or positions', () => {
  for (const code of ['600570', '00005', 'HSI', '000300']) {
    const [item] = buildInquiryItems({ ...defaultDraft(), code })
    assert.equal(item.code, code)
    assert.equal(item.status, 'pending')
  }
})

test('one inquiry creates every selected tenor and strike combination in a single batch', () => {
  const batch = buildInquiryItems({ ...defaultDraft(), tenors: ['1M', '2M', '3M', '6M'], strikes: [80, 100, 105] }, undefined, '2026-11-05T03:00:00Z')
  assert.equal(batch.length, 12)
  assert.equal(new Set(batch.map((item) => item.id)).size, 12)
  assert.equal(new Set(batch.map((item) => item.batchId)).size, 1)
  assert.ok(batch.every((item) => item.status === 'pending' && item.quotes.length === 0 && item.size === 500))
  assert.ok(batch.every((item) => item.account === 'TZS_T0'))
  assert.equal(buildInquiryItems({ ...defaultDraft(), account: 'TZS_T1' })[0].account, 'TZS_T1')
})

test('automatic matching requires every requested combination and sufficient capacity', () => {
  const standard = buildInquiryItems(defaultDraft())
  assert.equal(canAutoQuoteBatch(standard), true)
  const unsupported = buildInquiryItems({ ...defaultDraft(), tenors: ['1M', '9M'] })
  assert.equal(canAutoQuoteBatch(unsupported), false)
  const oversized = buildInquiryItems({ ...defaultDraft(), size: 2500 })
  assert.equal(canAutoQuoteBatch(oversized), false)
  const feedback = resolveInquiryBatch(unsupported)
  assert.ok(feedback.every((item) => item.status === 'quoted' && item.quotes.length === 1))
  assert.ok(feedback.every((item) => !('source' in item) && !('automatic' in item)))
})

test('resolved quotation respects explicit rules and uses whole-request capacity', () => {
  const batch = buildInquiryItems({ ...defaultDraft(), size: 1500, knockout: '协商敲出', dividend: '分红调整初价' })
  assert.equal(canAutoQuoteBatch(batch), true)
  const [result] = resolveInquiryBatch(batch)
  assert.ok(result.quotes.every((quote) => quote.capacity >= 1500 && quote.knockout === '协商敲出' && quote.dividend === '分红调整初价'))
})

test('unavailable fixture has empty state and seed includes successful and empty feedback', () => {
  const [result] = resolveInquiryBatch(buildInquiryItems({ ...defaultDraft(), code: '000002' }))
  assert.equal(result.status, 'empty')
  assert.deepEqual(result.quotes, [])
  const initial = createInitialInquiries()
  assert.ok(initial.some((item) => item.status === 'empty'))
  assert.ok(initial.some((item) => item.status === 'quoted'))
})

test('best quote waits for all responses in the structure group and includes ties', () => {
  const [base] = buildInquiryItems(defaultDraft())
  const quoted = { ...base, status: 'quoted', quotes: [{ id: 'a', rate: 5 }, { id: 'b', rate: 5 }, { id: 'c', rate: 6 }] }
  const pending = { ...base, id: 'pending', status: 'pending', quotes: [] }
  const waiting = markBestQuotes([quoted, pending])
  assert.ok(waiting[0].quotes.every((quote) => !quoteIsBest(waiting[0], quote)))
  const settled = markBestQuotes([quoted, { ...pending, status: 'empty' }])
  assert.deepEqual(settled[0].quotes.map((quote) => quoteIsBest(settled[0], quote)), [true, true, false])
  const lower = markBestQuotes([quoted, { ...quoted, id: 'lower', quotes: [{ id: 'd', rate: 4 }] }])
  assert.ok(lower[0].quotes.every((quote) => !quoteIsBest(lower[0], quote)))
  assert.equal(quoteIsBest(lower[1], lower[1].quotes[0]), true)
  const otherAccount = markBestQuotes([quoted, { ...quoted, id: 'other-account', account: 'TZS_T1', quotes: [{ id: 'e', rate: 4 }] }])
  assert.equal(quoteIsBest(otherAccount[0], otherAccount[0].quotes[0]), true)
  for (const difference of [{ currency: 'USD' }, { size: 1000 }]) {
    const distinct = markBestQuotes([quoted, { ...quoted, ...difference, id: 'different-terms', quotes: [{ id: 'f', rate: 4 }] }])
    assert.equal(quoteIsBest(distinct[0], distinct[0].quotes[0]), true)
    assert.equal(quoteIsBest(distinct[1], distinct[1].quotes[0]), true)
    const separatePending = markBestQuotes([quoted, { ...pending, ...difference }])
    assert.equal(quoteIsBest(separatePending[0], separatePending[0].quotes[0]), true)
  }
})

test('re-inquiry retains prior response values without mutating its input', () => {
  const original = resolveInquiryBatch(buildInquiryItems(defaultDraft()))
  const before = JSON.stringify(original)
  const refreshed = resolveInquiryBatch(original, '2026-11-05T04:00:00Z')
  assert.equal(JSON.stringify(original), before)
  assert.equal(refreshed[0].quotes[0].previousRate, original[0].quotes[0].rate)
  assert.equal(refreshed[0].quotes[0].previousCapacity, original[0].quotes[0].capacity)
})

test('premium converts ten-thousand nominal units and percentage quotation', () => {
  assert.equal(calculateOptionFee(500, 5.62), 281000)
  assert.equal(calculateOptionFee(0.01, 1.23), 1.23)
})

test('customer flow resolves together, rejects duplicate pending requests, and creates an opening order', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const store = useOptionsInquiry()
  const previousItems = store.items.value
  const previousOrders = [...store.openingOrders.value]
  context.after(() => {
    store.items.value = previousItems
    store.openingOrders.value = previousOrders
  })
  const draft = { ...defaultDraft(), account: 'TZS_T1', tenors: ['1M', '2M'] }
  const originalCount = store.items.value.length
  assert.throws(() => store.submitInquiry({ ...draft, strikes: [130] }), /70% 至 120%/)
  assert.equal(store.items.value.length, originalCount)
  const submitted = store.submitInquiry(draft)
  assert.equal(submitted.length, 2)
  assert.ok(submitted.every((item) => item.status === 'pending'))
  assert.throws(() => store.submitInquiry(draft), /正在询价/)
  const independent = store.submitInquiry({ ...draft, account: 'TZS_T2' })
  assert.equal(independent.length, 2)
  context.mock.timers.tick(1200)
  const resolved = store.items.value.filter((item) => submitted.some((entry) => entry.id === item.id))
  assert.ok(resolved.every((item) => item.status === 'quoted'))
  const item = resolved[0]
  const quote = item.quotes[0]
  for (const changed of [{ rate: quote.rate + 0.1 }, { capacity: quote.capacity + 1 }, { quotedAt: '2020-01-01T00:00:00Z' }]) {
    assert.throws(() => store.placeOrder({ item, quote: { ...quote, ...changed }, entryMode: 'limit', principal: 500 }), /报价已更新/)
  }
  assert.throws(() => store.placeOrder({ item, quote, entryMode: 'limit', principal: quote.capacity + 1 }), /不可超过/)
  const order = store.placeOrder({ item, quote, entryMode: 'limit', principal: 500, remark: '客户备注' })
  assert.equal(order.status, '待报')
  assert.equal(order.account, 'TZS_T1')
  assert.equal(order.optionFee, calculateOptionFee(500, quote.rate))
  assert.equal(useOptionsInquiry().openingOrders.value[0].id, order.id)
  store.reinquire([item.id])
  assert.throws(() => store.placeOrder({ item, quote, entryMode: 'limit', principal: 500 }), /当前报价不可下单/)
  context.mock.timers.tick(1200)
  const refreshed = store.items.value.find((entry) => entry.id === item.id)
  assert.equal(refreshed.status, 'quoted')
  assert.equal(refreshed.quotes[0].previousRate, quote.rate)
})

test('bulk inquiries are atomic when a later instrument is pending, invalid, or duplicated', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const store = useOptionsInquiry()
  const previousItems = store.items.value
  context.after(() => { store.items.value = previousItems })
  const pendingDraft = { ...defaultDraft(), account: 'ATOMIC_TEST' }
  const firstDraft = { ...pendingDraft, code: 'HSCEI' }
  const [existing] = store.submitInquiry(pendingDraft)
  const before = JSON.stringify(store.items.value)
  assert.throws(() => store.submitInquiries([firstDraft, pendingDraft]), /正在询价/)
  assert.equal(JSON.stringify(store.items.value), before)
  assert.throws(() => store.submitInquiries([firstDraft, { ...pendingDraft, strikes: [130] }]), /70% 至 120%/)
  assert.equal(JSON.stringify(store.items.value), before)
  assert.throws(() => store.submitInquiries([firstDraft, { ...firstDraft }]), /重复批量询价/)
  assert.equal(JSON.stringify(store.items.value), before)
  context.mock.timers.tick(1200)
  assert.equal(store.items.value.filter((item) => item.account === 'ATOMIC_TEST').length, 1)
  assert.equal(store.items.value.find((item) => item.id === existing.id).status, 'quoted')
  const accepted = store.submitInquiries([firstDraft, { ...pendingDraft, code: '00700', tenors: ['9M'] }])
  assert.equal(accepted.length, 2)
  context.mock.timers.tick(1200)
  const feedback = accepted.map((item) => store.items.value.find((entry) => entry.id === item.id))
  assert.ok(feedback.every((item) => item.status === 'quoted'))
  assert.ok(feedback[0].quotes.length > 1, 'another instrument requiring manual feedback must not change this instrument response group')
  assert.equal(feedback[1].quotes.length, 1)
})
