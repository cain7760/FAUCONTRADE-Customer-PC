import test from 'node:test'
import assert from 'node:assert/strict'
import { buildInquiryItems, calculateOptionFee, canAutoQuoteBatch, createInitialInquiries, createInquiryFormDraft, defaultDraft, inquiryRoundKey, inquiryStatusLabel, markBestQuotes, matchesInquiryFilter, quoteIsBest, resolveInquiryBatch, validateInquiry } from './inquiryModel.js'
import { REINQUIRY_DEMO_DELAY_MS, useOptionsInquiry } from './useOptionsInquiry.js'

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
    assert.throws(() => store.placeOrder({ item, quote: { ...quote, ...changed }, entryMode: 'limit', limitPrice: 11.78, principal: 500 }), /报价已更新/)
  }
  assert.throws(() => store.placeOrder({ item, quote, entryMode: 'limit', limitPrice: 11.78, principal: quote.capacity + 1 }), /不可超过/)
  const order = store.placeOrder({ item, quote, entryMode: 'limit', limitPrice: 11.78, principal: 500, remark: '客户备注' })
  assert.equal(order.status, '待报')
  assert.equal(order.account, 'TZS_T1')
  assert.equal(order.optionFee, calculateOptionFee(500, quote.rate))
  assert.equal(useOptionsInquiry().openingOrders.value[0].id, order.id)
  const countBeforeReinquiry = store.items.value.length
  const [pending] = store.reinquire([item.id])
  assert.notEqual(pending.id, item.id)
  assert.equal(pending.sourceInquiryId, item.id)
  assert.equal(pending.status, 'pending')
  assert.notEqual(inquiryRoundKey(pending), inquiryRoundKey(item))
  assert.equal(store.items.value.length, countBeforeReinquiry + 1)
  assert.equal(store.items.value.find(entry => entry.id === item.id).status, 'expired')
  assert.throws(() => store.placeOrder({ item, quote, entryMode:'limit', limitPrice:11.78, principal:500 }), /当前报价不可下单/)
  assert.deepEqual(pending.quotes, [])
  context.mock.timers.tick(REINQUIRY_DEMO_DELAY_MS - 1)
  assert.equal(store.items.value.find(entry => entry.id === pending.id).status, 'pending')
  context.mock.timers.tick(1)
  const refreshed = store.items.value.find((entry) => entry.id === pending.id)
  assert.equal(refreshed.status, 'quoted')
  assert.equal(refreshed.quotes[0].previousRate, quote.rate)
  assert.equal(store.items.value.find(entry => entry.id === item.id).status, 'expired')
  assert.throws(() => store.placeOrder({ item, quote, entryMode:'limit', limitPrice:11.78, principal:500 }), /当前报价不可下单/)
  const next = store.reinquire([item.id, refreshed.id])
  assert.equal(next.length, 1, 're-inquiry must not multiply duplicate historical conditions')
  context.mock.timers.tick(REINQUIRY_DEMO_DELAY_MS)
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

test('multi-selection filters match any chosen value and allow empty selections', () => {
  assert.equal(matchesInquiryFilter('1M', []), true)
  assert.equal(matchesInquiryFilter('2M', ['1M', '2M']), true)
  assert.equal(matchesInquiryFilter('3M', ['1M', '2M']), false)
})

test('inquiry defaults and reset source leave all three trading rules unrestricted', () => {
  const draft = defaultDraft()
  assert.deepEqual([draft.knockout, draft.exercise, draft.dividend], ['无要求','无要求','无要求'])
  assert.equal(canAutoQuoteBatch(buildInquiryItems(draft)), true)
})

test('seed has entire instruments pending, unavailable and expired', () => {
  const initial = createInitialInquiries('2026-11-06T03:00:00Z')
  for (const [code, status] of [['600030','pending'],['600036','empty'],['600570','expired']]) {
    const group = initial.filter(item => item.code === code)
    assert.equal(group.length, 2)
    assert.ok(group.every(item => item.status === status && item.quotes.length === 0))
  }
})

test('re-inquiry expires old unquoted rows for the whole instrument and ignores stale responses', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const store = useOptionsInquiry(), previous = store.items.value
  context.after(() => { store.items.value = previous })
  const draft = { ...defaultDraft(), code: '600519', account: 'REQUERY_EXPIRY_TEST' }
  const [pending] = store.submitInquiry(draft)
  context.mock.timers.tick(600)
  const quoted = resolveInquiryBatch(buildInquiryItems({ ...draft, tenors: ['2M'] }))[0]
  const empty = { ...buildInquiryItems({ ...draft, tenors: ['3M'] })[0], status: 'empty' }
  const unrelated = { ...empty, id: 'unrelated', code: '600036' }
  store.items.value = [...store.items.value, quoted, empty, unrelated]
  const quotedBefore = JSON.stringify(quoted)
  const [added] = store.reinquire([pending.id])
  assert.notEqual(added.id, pending.id)
  assert.equal(added.status, 'pending')
  for (const id of [pending.id,empty.id]) assert.equal(store.items.value.find(item => item.id === id).status, 'expired')
  assert.equal(store.items.value.find(item => item.id === unrelated.id).status, 'empty')
  assert.equal(JSON.stringify(store.items.value.find(item => item.id === quoted.id)), quotedBefore)
  context.mock.timers.tick(600) // The old request finishes, but cannot revive its expired record.
  assert.equal(store.items.value.find(item => item.id === pending.id).status, 'expired')
  assert.equal(store.items.value.find(item => item.id === added.id).status, 'pending')
  context.mock.timers.tick(REINQUIRY_DEMO_DELAY_MS - 600)
  assert.equal(store.items.value.find(item => item.id === added.id).status, 'quoted')
  assert.equal(store.items.value.find(item => item.id === pending.id).status, 'expired')
  assert.equal(store.items.value.find(item => item.id === empty.id).status, 'expired')
})

test('inquiry form starts with empty required selections and unrestricted default rules', () => {
  const draft = createInquiryFormDraft()
  assert.deepEqual({ code:draft.code, size:draft.size, tenors:draft.tenors, strikes:draft.strikes }, { code:'', size:null, tenors:[], strikes:[] })
  assert.deepEqual([draft.knockout,draft.exercise,draft.dividend,draft.currency], ['无要求','无要求','无要求','CNY'])
  draft.tenors.push('1M')
  assert.deepEqual(createInquiryFormDraft().tenors, [])
})


test('round identities separate the same instrument and best prices never cross rounds', () => {
  const [base] = buildInquiryItems(defaultDraft())
  const old = { ...base, status: 'quoted', inquiryRound: 'old', quotes: [{ id: 'old-q', rate: 1 }] }
  const current = { ...old, id: 'current', inquiryRound: 'current', quotes: [{ id: 'new-q', rate: 8 }] }
  assert.notEqual(inquiryRoundKey(old), inquiryRoundKey(current))
  const quoted = markBestQuotes([old, current])
  assert.ok(quoted.every(item => item.quotes[0].isBest))
  const waiting = markBestQuotes([old, { ...current, status: 'pending', quotes: [] }])
  assert.equal(waiting[0].quotes[0].isBest, true)
  assert.equal(inquiryRoundKey({ ...base, batchId: 'legacy-1' }), `${base.code}:legacy-1`)
})


test('pending inquiry text distinguishes re-inquiry origin without changing result states', () => {
  assert.equal(inquiryStatusLabel({status:'pending'}), '询价中…')
  assert.equal(inquiryStatusLabel({status:'pending',sourceInquiryId:'original'}), '重询中…')
  for (const [status, label] of [['empty','暂无报价'], ['expired','报价已失效'], ['quoted','报价成功']]) {
    assert.equal(inquiryStatusLabel({status,sourceInquiryId:'original'}), label)
  }
})
