import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createVideoBlobLoader } from './videoBlobLoader.mjs'

test('fetches the video exactly once and reports ready with an object URL', async () => {
  const requested = []
  const loader = createVideoBlobLoader({
    src: '/entur.mp4',
    fetchImpl: async (url) => {
      requested.push(url)
      return { ok: true, blob: async () => 'the-blob' }
    },
    createObjectURL: (blob) => `blob:${blob}`,
    revokeObjectURL: () => {},
  })

  const states = []
  await loader.start((state) => states.push(state))

  assert.deepEqual(requested, ['/entur.mp4'])
  assert.deepEqual(states, [{ status: 'loading' }, { status: 'ready', url: 'blob:the-blob' }])
})

test('cancel revokes the object URL it created', async () => {
  const revoked = []
  const loader = createVideoBlobLoader({
    src: '/entur.mp4',
    fetchImpl: async () => ({ ok: true, blob: async () => 'the-blob' }),
    createObjectURL: (blob) => `blob:${blob}`,
    revokeObjectURL: (url) => revoked.push(url),
  })

  await loader.start(() => {})
  loader.cancel()

  assert.deepEqual(revoked, ['blob:the-blob'])
})

test('cancel aborts a fetch that is still in flight', async () => {
  let capturedSignal = null
  const loader = createVideoBlobLoader({
    src: '/entur.mp4',
    fetchImpl: (url, options) => {
      capturedSignal = options.signal
      return new Promise(() => {}) // never settles
    },
    createObjectURL: () => 'blob:unused',
    revokeObjectURL: () => {},
  })

  loader.start(() => {})
  assert.equal(capturedSignal.aborted, false, 'signal should be live while fetching')

  loader.cancel()

  assert.equal(capturedSignal.aborted, true)
})

test('does not report state after cancel, even if the fetch resolves later', async () => {
  let resolveFetch
  const loader = createVideoBlobLoader({
    src: '/entur.mp4',
    fetchImpl: () => new Promise((resolve) => { resolveFetch = resolve }),
    createObjectURL: (blob) => `blob:${blob}`,
    revokeObjectURL: () => {},
  })

  const states = []
  const started = loader.start((state) => states.push(state))

  loader.cancel()
  resolveFetch({ ok: true, blob: async () => 'late-blob' })
  await started

  assert.deepEqual(states, [{ status: 'loading' }], 'only the pre-cancel state should be reported')
})

test('retries a failing fetch with backoff until it succeeds', async () => {
  let attempts = 0
  const waits = []
  const loader = createVideoBlobLoader({
    src: '/entur.mp4',
    fetchImpl: async () => {
      attempts++
      if (attempts < 3) throw new Error('network down')
      return { ok: true, blob: async () => 'the-blob' }
    },
    createObjectURL: (blob) => `blob:${blob}`,
    revokeObjectURL: () => {},
    delay: async (ms) => { waits.push(ms) },
  })

  const states = []
  await loader.start((state) => states.push(state))

  assert.equal(attempts, 3)
  assert.deepEqual(states.at(-1), { status: 'ready', url: 'blob:the-blob' })
  assert.equal(waits.length, 2, 'one wait between each retry')
  assert.ok(waits[1] > waits[0], `backoff should grow, got ${waits}`)
})

test('treats a non-ok response as a failure worth retrying', async () => {
  let attempts = 0
  const loader = createVideoBlobLoader({
    src: '/entur.mp4',
    fetchImpl: async () => {
      attempts++
      if (attempts < 2) return { ok: false, status: 503, blob: async () => 'error-page' }
      return { ok: true, blob: async () => 'the-blob' }
    },
    createObjectURL: (blob) => `blob:${blob}`,
    revokeObjectURL: () => {},
    delay: async () => {},
  })

  const states = []
  await loader.start((state) => states.push(state))

  assert.equal(attempts, 2)
  assert.deepEqual(states.at(-1), { status: 'ready', url: 'blob:the-blob' })
})

test('gives up with failed after the last attempt', async () => {
  let attempts = 0
  const loader = createVideoBlobLoader({
    src: '/entur.mp4',
    fetchImpl: async () => { attempts++; throw new Error('network down') },
    createObjectURL: () => 'blob:unused',
    revokeObjectURL: () => {},
    delay: async () => {},
    maxAttempts: 3,
  })

  const states = []
  await loader.start((state) => states.push(state))

  assert.equal(attempts, 3)
  assert.deepEqual(states.at(-1), { status: 'failed' })
})

test('stops retrying when cancelled mid-backoff', async () => {
  let attempts = 0
  const loader = createVideoBlobLoader({
    src: '/entur.mp4',
    fetchImpl: async () => { attempts++; throw new Error('network down') },
    createObjectURL: () => 'blob:unused',
    revokeObjectURL: () => {},
    delay: async () => { loader.cancel() },
  })

  const states = []
  await loader.start((state) => states.push(state))

  assert.equal(attempts, 1, 'no further attempts after cancel')
  assert.deepEqual(states, [{ status: 'loading' }], 'no failed state after cancel')
})
