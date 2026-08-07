/**
 * Henting og polling av avganger fra Entur Journey Planner v3.
 *
 * Ligger utenfor React fordi karusellen bare rendrer den aktive sliden:
 * avgangskomponenten avmonteres og remonteres hver gang sliden kommer tilbake,
 * så all henting som bor i en `useEffect` der inne ville hentet like ofte.
 * Pollingen eies derfor av `App`, som står montert hele tiden. Samme grunn som
 * for værmodulen, se `App.jsx`.
 *
 * APIet er en åpen tjeneste uten nøkkel, men krever headeren `ET-Client-Name`.
 * Det er CORS-åpent (`access-control-allow-origin: *`), så kiosken kaller det
 * direkte fra nettleseren uten backend.
 */
import { isValidStopPlaceId } from '../boards/boardConfig.js';
import { toDepartures } from './departureMapper.js';

const ENDPOINT = 'https://api.entur.io/journey-planner/v3/graphql';

/** Formen Entur ber om: <selskap>-<applikasjon>, små bokstaver, uten mellomrom. */
export const ET_CLIENT_NAME = 'entur-velkomsttavle';

export const DEPARTURE_REFRESH_MS = 60 * 1000;
export const DEPARTURE_COUNT = 6;
export const TIME_RANGE_SECONDS = 3 * 60 * 60;

// `includeCancelledTrips: true` er et bevisst valg: et innstilt tog skal vises
// overstrøket, ikke forsvinne. Står du i billettkontoret og toget bare er borte
// fra tavla, tror du at du har husket feil.
//
// Feltet for innstilling heter `cancellation`. `cancelled` finnes ikke på
// EstimatedCall i v3 og gir valideringsfeil fra APIet.
const QUERY = `
query Avganger($stopPlaceId: String!, $count: Int!, $timeRange: Int!) {
  stopPlace(id: $stopPlaceId) {
    id
    name
    estimatedCalls(numberOfDepartures: $count, timeRange: $timeRange, includeCancelledTrips: true) {
      realtime
      cancellation
      aimedDepartureTime
      expectedDepartureTime
      destinationDisplay { frontText }
      quay { publicCode }
      situations { summary { value language } }
      serviceJourney { line { publicCode transportMode } }
    }
  }
}`;

/**
 * Henter avgangene for ett stoppested. Feiler aldri utad — nettverksfeil,
 * feilkoder og GraphQL-feil gir `{ departures: null }`, slik at kalleren kan
 * beholde forrige liste. En tavle som viser avganger fra et minutt siden er
 * langt bedre enn en tom tavle.
 */
export async function fetchDepartures(stopPlaceId, { fetchImpl = fetch } = {}) {
    if (!isValidStopPlaceId(stopPlaceId)) {
        console.warn('Ugyldig stoppested-id, hopper over henting', stopPlaceId);
        return { departures: null };
    }
    try {
        const response = await fetchImpl(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'ET-Client-Name': ET_CLIENT_NAME },
            body: JSON.stringify({
                query: QUERY,
                variables: { stopPlaceId, count: DEPARTURE_COUNT, timeRange: TIME_RANGE_SECONDS },
            }),
        });
        if (!response.ok) {
            console.warn(`Journey Planner svarte ${response.status}`);
            return { departures: null };
        }
        const body = await response.json();
        if (body.errors) {
            console.warn('Journey Planner svarte med feil', body.errors);
            return { departures: null };
        }
        return { departures: toDepartures(body.data?.stopPlace) };
    } catch (error) {
        console.warn('Klarte ikke hente avganger', error);
        return { departures: null };
    }
}

/**
 * Starter polling: henter én gang med en gang, og deretter hvert
 * `intervalMs`. Returnerer en stopp-funksjon som avbryter både den planlagte
 * hentingen og en henting som er underveis.
 */
export function startDeparturePolling({
    stopPlaceId,
    onData,
    fetchDepartures: fetchImpl = fetchDepartures,
    intervalMs = DEPARTURE_REFRESH_MS,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
}) {
    let stopped = false;
    let timer = null;

    async function refresh() {
        const { departures } = await fetchImpl(stopPlaceId);
        if (stopped) return;
        // Uten data beholder vi forrige liste framfor å tømme skjermen
        if (departures) onData(departures);
        timer = setTimer(refresh, intervalMs);
    }

    refresh();

    return function stop() {
        stopped = true;
        if (timer !== null) clearTimer(timer);
    };
}
