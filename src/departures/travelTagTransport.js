/**
 * Enturs `transportMode` oversatt til `transport`-propen på `TravelTag`.
 *
 * Dette er en krasjsperre, ikke pynt. `getTransportStyle` i `@entur/travel`
 * kaster på alt den ikke kjenner: `default:` gir «Please select a transport for
 * the Travel component», og `scooter`, `bike`, `car` og `foot` kaster hver for
 * seg som utgåtte. Fem av de fjorten verdiene i Enturs TransportMode-enum —
 * `coach`, `lift`, `monorail`, `trolleybus` og `unknown` — treffer `default:`.
 * `coach` er vanlig på regionbusser.
 *
 * `Departures` ligger inne i en `ErrorBoundary`, så et kast gir ikke hvit
 * skjerm — men avgangstavla forsvinner fra karusellen til neste henting.
 *
 * Derfor en oppslagstabell og ikke en passthrough med unntak: det som ikke står
 * her blir `none`, som `TravelTag` håndterer med et tomt ikon. En ny verdi i
 * Enturs enum gir da et merke uten ikon, ikke en tom karusellslide.
 */
const TRANSPORT = {
    air: 'air',
    bus: 'bus',
    cableway: 'cableway',
    coach: 'bus',
    funicular: 'funicular',
    lift: 'cableway',
    metro: 'metro',
    monorail: 'metro',
    rail: 'rail',
    taxi: 'taxi',
    tram: 'tram',
    trolleybus: 'bus',
    water: 'water',
};

export function travelTagTransport(transportMode) {
    if (typeof transportMode !== 'string') {
        return 'none';
    }
    return TRANSPORT[transportMode] ?? 'none';
}
