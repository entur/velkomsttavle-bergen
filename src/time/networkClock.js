/**
 * Tid fra nett, ikke fra enheten.
 *
 * Skjermen i resepsjonen har en klokke som går flere minutter for fort. Det
 * gjorde at nedtellinga slo om til «nå» fem minutter for tidlig og deretter
 * forsvant helt — `countdownLabel` gir `null` så snart minuttene blir negative
 * — mens klokkeslettet ved siden av sto riktig, fordi det kommer fra APIet.
 * To ulike tidskilder i samme rad. Se
 * `docs/superpowers/specs/2026-08-12-nettverksklokke-design.md`.
 *
 * Kilden er vårt eget domene. Entur sender `Date`, men eksponerer den ikke over
 * CORS — svaret har ingen `Access-Control-Expose-Headers`, og `Date` står ikke
 * på safelista — så nettleseren skjuler den. `serverInfo` i skjemaet har bare
 * byggetider. Same-origin-svar har ingen slik begrensning, og Firebase Hosting
 * sin `Date` ble målt til å stemme på sekundet.
 *
 * Modulnivå-tilstand framfor props: `AlertBanner` bor i `MiddleBand` og
 * `Departures` i karusellen, så en delt verdi måtte ellers vært tredd gjennom
 * to uavhengige grener av treet. Regnestykket og hentingen er skilt ut som rene
 * funksjoner, slik at det som kan testes, testes.
 */

/** Hentes ved oppstart og så hver time. Klokkedrift er langsom. */
export const CLOCK_SYNC_MS = 60 * 60 * 1000;

/** Eget domene. Hva som ligger her spiller ingen rolle — vi vil bare ha headeren. */
const TIME_URL = '/';

let offsetMs = 0;

/** Millisekunder å legge til enhetsklokka, eller `null` om noe mangler. */
export function clockOffset(serverDate, deviceDate) {
    if (!erBrukbar(serverDate) || !erBrukbar(deviceDate)) {
        return null;
    }
    return serverDate.getTime() - deviceDate.getTime();
}

/**
 * Servertid fra `Date`-headeren, eller `null`.
 *
 * `no-store` er ikke pynt: et svar fra cache ville båret sin opprinnelige
 * `Date`, og offsetten ville vokst med alderen på cachen i stedet for å rette
 * klokka. `HEAD` fordi kroppen ikke interesserer oss.
 *
 * Feiler aldri utad. Tavla skal ikke stoppe fordi en tidssjekk gjorde det.
 */
export async function fetchServerTime({ fetchImpl = fetch, url = TIME_URL } = {}) {
    try {
        const response = await fetchImpl(url, { method: 'HEAD', cache: 'no-store' });
        if (!response || !response.ok) {
            return null;
        }
        const header = response.headers ? response.headers.get('date') : null;
        if (typeof header !== 'string') {
            return null;
        }
        const date = new Date(header);
        return Number.isNaN(date.getTime()) ? null : date;
    } catch (error) {
        console.warn('Klarte ikke hente nettverkstid', error);
        return null;
    }
}

/** Enhetens klokke, rettet opp med det vi sist visste om avviket. */
export function networkNow() {
    return new Date(Date.now() + offsetMs);
}

/**
 * Starter synkroniseringa: henter én gang med en gang, og deretter hvert
 * `intervalMs`. Returnerer en stopp-funksjon.
 *
 * Samme form som `startDeparturePolling`, av samme grunn: timerne injiseres
 * slik at testene slipper å vente på ekte tid.
 */
export function startClockSync({
    fetchTime = fetchServerTime,
    intervalMs = CLOCK_SYNC_MS,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
} = {}) {
    let stopped = false;
    let timer = null;

    async function sync() {
        const serverTime = await fetchTime();
        if (stopped) return;
        const offset = clockOffset(serverTime, new Date());
        // Uten svar beholder vi forrige offset. En mislykket henting skal ikke
        // kaste oss tilbake til den klokka vi nettopp rettet.
        if (offset !== null) {
            offsetMs = offset;
        }
        timer = setTimer(sync, intervalMs);
    }

    sync();

    return function stop() {
        stopped = true;
        if (timer !== null) clearTimer(timer);
    };
}

/** Nullstiller offsetten. Finnes for at testene skal være uavhengige av rekkefølge. */
export function resetClock() {
    offsetMs = 0;
}

function erBrukbar(value) {
    return value instanceof Date && !Number.isNaN(value.getTime());
}
