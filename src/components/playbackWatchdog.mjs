/** HTMLMediaElement.HAVE_CURRENT_DATA — the first readyState with a decoded frame. */
const HAVE_CURRENT_DATA = 2

/**
 * Watches a <video> that has just been given a source and reports back if that
 * source never turns into a picture.
 *
 * The blob-URL fix for issue #105 assumed every browser can play a video from a
 * blob: URL. The Samsung display the board runs on could not, and nothing in the
 * app noticed: the download had succeeded, so the component sat in its ready
 * state pointing at a source the device cannot decode, showing black until
 * someone reloaded — and then showing black again.
 *
 * A media element that cannot use its source either fires `error` or simply
 * never reaches HAVE_CURRENT_DATA. This watches for both so the caller can fall
 * back to a source that does work.
 */
export function createPlaybackWatchdog({
  media,
  onStall,
  timeoutMs = 8000,
  schedule = (fn, ms) => {
    const id = setTimeout(fn, ms)
    return () => clearTimeout(id)
  },
}) {
  let cancelDeadline = null
  let finished = false

  function report() {
    if (finished) return
    finished = true
    stop()
    onStall()
  }

  function onError() {
    report()
  }

  function stop() {
    cancelDeadline?.()
    cancelDeadline = null
    media.removeEventListener('error', onError)
  }

  return {
    start() {
      media.addEventListener('error', onError)
      cancelDeadline = schedule(() => {
        cancelDeadline = null
        if (media.readyState < HAVE_CURRENT_DATA) report()
      }, timeoutMs)
    },

    stop() {
      finished = true
      stop()
    },
  }
}
