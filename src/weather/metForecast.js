/**
 * Henting og polling av værvarsel fra MET Norway / Yr.
 *
 * Ligger utenfor React fordi karusellen bare rendrer den aktive sliden:
 * værkomponenten avmonteres og remonteres omtrent hvert 60. sekund, så all
 * henting som bor i en `useEffect` der inne vil polle api.met.no like ofte.
 * Pollingen eies derfor av `App`, som står montert hele tiden.
 *
 * MET sine vilkår (https://api.met.no/doc/TermsOfService) ber om at klienter
 * respekterer `Expires` og ikke poller oftere enn dataene faktisk endrer seg.
 */

/** Nedre grense for hvor ofte vi kontakter api.met.no. */
export const MIN_REFRESH_MS = 15 * 60 * 1000

/**
 * Hvor lenge vi skal vente før neste henting: så lenge `Expires` sier, men
 * aldri kortere enn minimumsintervallet. Mangler eller ugyldig header gir
 * minimumet.
 *
 * @param {string|null|undefined} expiresHeader
 * @param {number} now Millisekunder siden epoch
 * @param {number} [minMs]
 * @returns {number} Ventetid i millisekunder
 */
export function nextRefreshDelay(expiresHeader, now, minMs = MIN_REFRESH_MS) {
  if (!expiresHeader) return minMs
  const expiresAt = Date.parse(expiresHeader)
  if (Number.isNaN(expiresAt)) return minMs
  return Math.max(minMs, expiresAt - now)
}

/**
 * Henter værvarselet for én posisjon. Feiler aldri utad — nettverksfeil og
 * feilkoder gir `{ data: null }` slik at kalleren kan beholde forrige varsel.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{ data: unknown|null, expires: string|null }>}
 */
export async function fetchWeatherForecast(lat, lng, { fetchImpl = fetch } = {}) {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lng}`
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      console.warn(`api.met.no svarte ${response.status}`)
      return { data: null, expires: null }
    }
    return { data: await response.json(), expires: response.headers.get('Expires') }
  } catch (error) {
    console.warn('Klarte ikke hente værvarsel', error)
    return { data: null, expires: null }
  }
}

/**
 * Starter polling: henter én gang med en gang, og deretter etter `Expires`
 * (minst `minIntervalMs`). Returnerer en stopp-funksjon som avbryter både den
 * planlagte hentingen og en henting som er underveis.
 *
 * @param {{
 *   location: { lat: number, lng: number },
 *   onData: (data: unknown) => void,
 *   fetchForecast?: typeof fetchWeatherForecast,
 *   minIntervalMs?: number,
 *   now?: () => number,
 *   setTimer?: typeof setTimeout,
 *   clearTimer?: typeof clearTimeout,
 * }} options
 * @returns {() => void} stopp-funksjon
 */
export function startWeatherPolling({
  location,
  onData,
  fetchForecast = fetchWeatherForecast,
  minIntervalMs = MIN_REFRESH_MS,
  now = () => Date.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let stopped = false
  let timer = null

  async function refresh() {
    const { data, expires } = await fetchForecast(location.lat, location.lng)
    if (stopped) return
    // Uten data beholder vi forrige varsel framfor å tømme skjermen
    if (data) onData(data)
    timer = setTimer(refresh, nextRefreshDelay(expires, now(), minIntervalMs))
  }

  refresh()

  return function stop() {
    stopped = true
    if (timer !== null) clearTimer(timer)
  }
}
