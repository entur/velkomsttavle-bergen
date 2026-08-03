/**
 * Loads a video once into memory and hands back a blob URL to loop from.
 *
 * A `<video loop>` pointing at a plain URL re-fetches byte ranges whenever the
 * browser's media cache drops them, which cost us ~59 GB of Hosting egress per
 * day (issue #105). Pointing it at a blob URL instead keeps the bytes in memory,
 * so loop restarts cannot reach the network at all.
 *
 * Dependencies are injected so the lifecycle can be unit tested without a DOM.
 */
export function createVideoBlobLoader({
  src,
  fetchImpl = (...args) => fetch(...args),
  createObjectURL = (blob) => URL.createObjectURL(blob),
  revokeObjectURL = (url) => URL.revokeObjectURL(url),
  delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  maxAttempts = 3,
}) {
  let objectUrl = null
  let cancelled = false
  const controller = new AbortController()

  async function fetchBlob() {
    const response = await fetchImpl(src, { signal: controller.signal })
    if (!response.ok) throw new Error(`${src} returned ${response.status}`)
    return response.blob()
  }

  return {
    async start(onState) {
      onState({ status: 'loading' })

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const blob = await fetchBlob()
          if (cancelled) return
          objectUrl = createObjectURL(blob)
          onState({ status: 'ready', url: objectUrl })
          return
        } catch {
          if (cancelled) return
          if (attempt === maxAttempts) {
            // Falling back to a direct src means streaming again, so only do it
            // once the network has had several chances — a screen that boots
            // before wi-fi is up must not get stuck on the expensive path.
            onState({ status: 'failed' })
            return
          }
          await delay(attempt * attempt * 1000)
          if (cancelled) return
        }
      }
    },

    cancel() {
      cancelled = true
      controller.abort()
      if (objectUrl) {
        revokeObjectURL(objectUrl)
        objectUrl = null
      }
    },
  }
}
