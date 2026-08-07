/**
 * Søk etter stoppesteder i Enturs geocoder.
 *
 * Brukes bare av admin. `NSR:StopPlace:59983` er ikke noe et menneske skal
 * taste, så oppsettskjemaet har et søkefelt framfor et id-felt.
 *
 * `layers=venue` er det som gir stoppesteder. Uten filteret kommer også
 * adresser og gater, som ikke har noen avganger.
 */
import { isValidStopPlaceId } from '../boards/boardConfig.js';
import { ET_CLIENT_NAME } from './enturDepartures.js';

const ENDPOINT = 'https://api.entur.io/geocoder/v1/autocomplete';
const MAX_RESULTS = 5;

export async function searchStopPlaces(text, { fetchImpl = fetch } = {}) {
    const query = typeof text === 'string' ? text.trim() : '';
    if (query === '') {
        return [];
    }
    const url = `${ENDPOINT}?text=${encodeURIComponent(query)}&size=${MAX_RESULTS}&layers=venue`;
    try {
        const response = await fetchImpl(url, { headers: { 'ET-Client-Name': ET_CLIENT_NAME } });
        if (!response.ok) {
            console.warn(`Geocoderen svarte ${response.status}`);
            return [];
        }
        const body = await response.json();
        return (body.features ?? [])
            .map((feature) => ({ id: feature?.properties?.id, label: feature?.properties?.label ?? '' }))
            .filter((treff) => isValidStopPlaceId(treff.id));
    } catch (error) {
        console.warn('Klarte ikke søke etter stoppested', error);
        return [];
    }
}
