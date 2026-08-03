import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MIN_REFRESH_MS,
  nextRefreshDelay,
  fetchWeatherForecast,
  startWeatherPolling,
} from './metForecast.js'

const flush = () => new Promise((resolve) => setImmediate(resolve))

const T0 = Date.parse('2026-08-03T10:00:00Z')

test('nextRefreshDelay uses the minimum interval when there is no Expires header', () => {
  assert.equal(nextRefreshDelay(null, T0), MIN_REFRESH_MS)
  assert.equal(nextRefreshDelay(undefined, T0), MIN_REFRESH_MS)
})

test('nextRefreshDelay waits until Expires when that is further out than the minimum', () => {
  const expires = new Date(T0 + 30 * 60 * 1000).toUTCString()
  assert.equal(nextRefreshDelay(expires, T0), 30 * 60 * 1000)
})

test('nextRefreshDelay never polls faster than the minimum interval', () => {
  const soon = new Date(T0 + 60 * 1000).toUTCString()
  const past = new Date(T0 - 60 * 60 * 1000).toUTCString()
  assert.equal(nextRefreshDelay(soon, T0), MIN_REFRESH_MS)
  assert.equal(nextRefreshDelay(past, T0), MIN_REFRESH_MS)
})

test('nextRefreshDelay falls back to the minimum interval for an unparseable Expires header', () => {
  assert.equal(nextRefreshDelay('i morgen tidlig', T0), MIN_REFRESH_MS)
})

test('fetchWeatherForecast requests the compact endpoint and returns body plus Expires', async () => {
  const calls = []
  const fetchImpl = async (url, options) => {
    calls.push({ url, options })
    return {
      ok: true,
      headers: { get: (name) => (name.toLowerCase() === 'expires' ? 'Sun, 03 Aug 2026 10:30:00 GMT' : null) },
      json: async () => ({ properties: { timeseries: [] } }),
    }
  }

  const result = await fetchWeatherForecast(60.39299, 5.32415, { fetchImpl })

  assert.equal(calls.length, 1)
  assert.equal(
    calls[0].url,
    'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=60.39299&lon=5.32415'
  )
  assert.deepEqual(result.data, { properties: { timeseries: [] } })
  assert.equal(result.expires, 'Sun, 03 Aug 2026 10:30:00 GMT')
})

test('fetchWeatherForecast returns no data instead of throwing when the request fails', async () => {
  let attempts = 0
  const fetchImpl = async () => {
    attempts++
    throw new Error('nettverket er nede')
  }

  const result = await fetchWeatherForecast(60, 5, { fetchImpl })

  assert.equal(attempts, 1, 'kallet skal faktisk ha blitt forsøkt')
  assert.deepEqual(result, { data: null, expires: null })
})

test('fetchWeatherForecast returns no data on a non-OK response', async () => {
  let attempts = 0
  const fetchImpl = async () => {
    attempts++
    return {
      ok: false,
      status: 429,
      headers: { get: () => null },
      json: async () => ({ error: 'throttled' }),
    }
  }

  const result = await fetchWeatherForecast(60, 5, { fetchImpl })

  assert.equal(attempts, 1, 'kallet skal faktisk ha blitt forsøkt')
  assert.deepEqual(result, { data: null, expires: null })
})

// Liten testrigg: en falsk timer-kø vi kan fyre av manuelt
function fakeTimers() {
  const scheduled = new Map()
  let nextId = 1
  return {
    delays: [],
    cancelled: [],
    setTimer(callback, delay) {
      const id = nextId++
      this.delays.push(delay)
      scheduled.set(id, callback)
      return id
    },
    clearTimer(id) {
      this.cancelled.push(id)
      scheduled.delete(id)
    },
    async fireAll() {
      const callbacks = [...scheduled.values()]
      scheduled.clear()
      for (const callback of callbacks) await callback()
      await flush()
    },
    get pending() {
      return scheduled.size
    },
  }
}

test('startWeatherPolling fetches once immediately and reports the data', async () => {
  const timers = fakeTimers()
  const received = []
  let fetches = 0
  const fetchForecast = async () => {
    fetches++
    return { data: { forecast: fetches }, expires: null }
  }

  startWeatherPolling({
    location: { lat: 60, lng: 5 },
    onData: (data) => received.push(data),
    fetchForecast,
    setTimer: timers.setTimer.bind(timers),
    clearTimer: timers.clearTimer.bind(timers),
  })
  await flush()

  assert.equal(fetches, 1)
  assert.deepEqual(received, [{ forecast: 1 }])
})

test('startWeatherPolling schedules the next fetch from the Expires header', async () => {
  const timers = fakeTimers()
  const fetchForecast = async () => ({
    data: { forecast: 1 },
    expires: new Date(T0 + 45 * 60 * 1000).toUTCString(),
  })

  startWeatherPolling({
    location: { lat: 60, lng: 5 },
    onData: () => {},
    fetchForecast,
    now: () => T0,
    setTimer: timers.setTimer.bind(timers),
    clearTimer: timers.clearTimer.bind(timers),
  })
  await flush()

  assert.deepEqual(timers.delays, [45 * 60 * 1000])
})

test('startWeatherPolling fetches again only when the scheduled timer fires', async () => {
  const timers = fakeTimers()
  let fetches = 0
  const fetchForecast = async () => {
    fetches++
    return { data: { forecast: fetches }, expires: null }
  }
  const received = []

  startWeatherPolling({
    location: { lat: 60, lng: 5 },
    onData: (data) => received.push(data),
    fetchForecast,
    setTimer: timers.setTimer.bind(timers),
    clearTimer: timers.clearTimer.bind(timers),
  })
  await flush()
  assert.equal(fetches, 1)

  await timers.fireAll()

  assert.equal(fetches, 2)
  assert.deepEqual(received, [{ forecast: 1 }, { forecast: 2 }])
  assert.deepEqual(timers.delays, [MIN_REFRESH_MS, MIN_REFRESH_MS])
})

test('stop cancels the pending timer so polling ends', async () => {
  const timers = fakeTimers()
  let fetches = 0
  const fetchForecast = async () => {
    fetches++
    return { data: { forecast: fetches }, expires: null }
  }

  const stop = startWeatherPolling({
    location: { lat: 60, lng: 5 },
    onData: () => {},
    fetchForecast,
    setTimer: timers.setTimer.bind(timers),
    clearTimer: timers.clearTimer.bind(timers),
  })
  await flush()
  stop()

  assert.equal(timers.cancelled.length, 1)
  assert.equal(timers.pending, 0)

  await timers.fireAll()
  assert.equal(fetches, 1)
})

test('stop keeps a fetch that is already in flight from reporting data', async () => {
  const timers = fakeTimers()
  let resolveFetch
  const fetchForecast = () =>
    new Promise((resolve) => {
      resolveFetch = resolve
    })
  const received = []

  const stop = startWeatherPolling({
    location: { lat: 60, lng: 5 },
    onData: (data) => received.push(data),
    fetchForecast,
    setTimer: timers.setTimer.bind(timers),
    clearTimer: timers.clearTimer.bind(timers),
  })

  stop()
  resolveFetch({ data: { forecast: 1 }, expires: null })
  await flush()

  assert.deepEqual(received, [])
  assert.equal(timers.pending, 0)
})

test('a failed fetch keeps the previous data and retries after the minimum interval', async () => {
  const timers = fakeTimers()
  const results = [
    { data: { forecast: 'first' }, expires: null },
    { data: null, expires: null },
    { data: { forecast: 'third' }, expires: null },
  ]
  const fetchForecast = async () => results.shift()
  const received = []

  startWeatherPolling({
    location: { lat: 60, lng: 5 },
    onData: (data) => received.push(data),
    fetchForecast,
    setTimer: timers.setTimer.bind(timers),
    clearTimer: timers.clearTimer.bind(timers),
  })
  await flush()

  await timers.fireAll() // feiler
  assert.deepEqual(received, [{ forecast: 'first' }], 'onData skal ikke kalles med null')

  await timers.fireAll() // lykkes igjen
  assert.deepEqual(received, [{ forecast: 'first' }, { forecast: 'third' }])
  assert.deepEqual(timers.delays, [MIN_REFRESH_MS, MIN_REFRESH_MS, MIN_REFRESH_MS])
})

test('startWeatherPolling passes the location coordinates to the fetcher', async () => {
  const timers = fakeTimers()
  const calls = []
  const fetchForecast = async (lat, lng) => {
    calls.push([lat, lng])
    return { data: {}, expires: null }
  }

  startWeatherPolling({
    location: { lat: 60.39299, lng: 5.32415 },
    onData: () => {},
    fetchForecast,
    setTimer: timers.setTimer.bind(timers),
    clearTimer: timers.clearTimer.bind(timers),
  })
  await flush()

  assert.deepEqual(calls, [[60.39299, 5.32415]])
})
