import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPlaybackWatchdog } from './playbackWatchdog.mjs'

// Minimal stand-in for an HTMLMediaElement: just the surface the watchdog touches.
function fakeMedia({ readyState = 0 } = {}) {
  const listeners = new Map()
  return {
    readyState,
    listenerCount: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type).add(fn)
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn)
    },
    emit(type) {
      for (const fn of listeners.get(type) ?? []) fn()
    },
  }
}

// Captures the scheduled deadline so tests can fire it deliberately.
function manualSchedule() {
  let pending = null
  const schedule = (fn) => {
    pending = fn
    return () => { pending = null }
  }
  return { schedule, fire: () => pending?.(), isPending: () => pending !== null }
}

test('reports a stall when no frame has decoded by the deadline', () => {
  const media = fakeMedia({ readyState: 0 }) // HAVE_NOTHING
  const clock = manualSchedule()
  let stalls = 0

  createPlaybackWatchdog({ media, onStall: () => stalls++, schedule: clock.schedule }).start()
  clock.fire()

  assert.equal(stalls, 1)
})

test('stays quiet when a frame has decoded by the deadline', () => {
  const media = fakeMedia({ readyState: 2 }) // HAVE_CURRENT_DATA
  const clock = manualSchedule()
  let stalls = 0

  createPlaybackWatchdog({ media, onStall: () => stalls++, schedule: clock.schedule }).start()
  clock.fire()

  assert.equal(stalls, 0)
})

test('reports a stall as soon as the element errors, without waiting for the deadline', () => {
  const media = fakeMedia({ readyState: 0 })
  const clock = manualSchedule()
  let stalls = 0

  createPlaybackWatchdog({ media, onStall: () => stalls++, schedule: clock.schedule }).start()
  media.emit('error')

  assert.equal(stalls, 1)
})

test('reports a stall only once, even if the element errors after the deadline fired', () => {
  const media = fakeMedia({ readyState: 0 })
  const clock = manualSchedule()
  let stalls = 0

  createPlaybackWatchdog({ media, onStall: () => stalls++, schedule: clock.schedule }).start()
  clock.fire()
  media.emit('error')

  assert.equal(stalls, 1)
})

test('reports nothing after stop', () => {
  const media = fakeMedia({ readyState: 0 })
  const clock = manualSchedule()
  let stalls = 0

  const watchdog = createPlaybackWatchdog({ media, onStall: () => stalls++, schedule: clock.schedule })
  watchdog.start()
  watchdog.stop()
  clock.fire()
  media.emit('error')

  assert.equal(stalls, 0)
})

test('releases its listeners on stop', () => {
  const media = fakeMedia({ readyState: 0 })
  const clock = manualSchedule()

  const watchdog = createPlaybackWatchdog({ media, onStall: () => {}, schedule: clock.schedule })
  watchdog.start()
  assert.ok(media.listenerCount() > 0, 'should listen while running')

  watchdog.stop()

  assert.equal(media.listenerCount(), 0)
  assert.equal(clock.isPending(), false, 'deadline should be cancelled')
})
