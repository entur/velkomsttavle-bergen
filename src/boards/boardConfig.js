/**
 * Modulkatalogen: hva en tavle kan vise, og hvordan et dokument fra Firestore
 * gjøres om til noe kiosken trygt kan rendre.
 *
 * Uten Firebase-importer og uten JSX, slik at katalogen kan testes med
 * `node --test`.
 *
 * Normaliseringen er kiosken sitt vern. Firestore-reglene kan ikke iterere over
 * en liste og validerer derfor bare grovformen på `middle` og `carousel`; et
 * dokument skrevet for hånd i konsollet kan altså inneholde tull. Alt som ikke
 * går an å rendre blir derfor kastet her, ikke i komponentene.
 */
import { normalizeDays } from './openingHours.js';

export const TOP_KINDS = ['video', 'logo'];

/** Rekkefølgen her er rekkefølgen på skjermen. */
export const MIDDLE_TYPES = ['greeting', 'openingHours'];
export const CAROUSEL_TYPES = ['weather', 'floorplan'];

/** `departures` kommer i fase 3. Katalogen står klar; modulen finnes ikke. */
export const FLOORPLAN_PLANS = ['bergen-3'];

export const GREETING_AUTO = 'auto';
export const GREETING_TEXT_MAX_LENGTH = 120;
export const NAME_MAX_LENGTH = 60;
export const PLACE_NAME_MAX_LENGTH = 40;

const DEFAULT_TOP_KIND = 'video';

export function normalizeBoardConfig(id, data = {}) {
    const source = data ?? {};
    return {
        id,
        name: asText(source.name, NAME_MAX_LENGTH),
        placeName: asText(source.placeName, PLACE_NAME_MAX_LENGTH),
        top: { kind: TOP_KINDS.includes(source.top?.kind) ? source.top.kind : DEFAULT_TOP_KIND },
        middle: normalizeModules(source.middle, MIDDLE_TYPES, MIDDLE_NORMALIZERS),
        carousel: normalizeModules(source.carousel, CAROUSEL_TYPES, CAROUSEL_NORMALIZERS),
    };
}

export function findModule(list, type) {
    return list.find((module) => module.type === type);
}

export function boardHeading(placeName) {
    return `Velkommen til Entur ${placeName}`;
}

export function toFirestoreBoard(config, userEmail) {
    return {
        name: config.name.trim(),
        placeName: config.placeName.trim(),
        top: { kind: config.top.kind },
        middle: config.middle,
        carousel: config.carousel,
        updatedBy: userEmail,
    };
}

const MIDDLE_NORMALIZERS = {
    greeting: (module) => {
        const text = typeof module.text === 'string' ? module.text.trim() : '';
        return {
            type: 'greeting',
            text: text === '' || text === GREETING_AUTO
                ? GREETING_AUTO
                : text.slice(0, GREETING_TEXT_MAX_LENGTH),
            // Standard er på: dagens tavle har illustrasjonen, og et dokument
            // uten feltet skal ikke endre hvordan den ser ut.
            staffImage: module.staffImage !== false,
        };
    },
    openingHours: (module) => ({ type: 'openingHours', days: normalizeDays(module.days) }),
};

const CAROUSEL_NORMALIZERS = {
    // Vær uten koordinater kan ikke hente noe. Da er det bedre å la modulen
    // falle bort enn å vise en tom slide karusellen bruker 30 sekunder på.
    weather: (module) => {
        const lat = Number(module.lat);
        const lng = Number(module.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return null;
        }
        return { type: 'weather', name: asText(module.name, PLACE_NAME_MAX_LENGTH), lat, lng };
    },
    floorplan: (module) => (
        FLOORPLAN_PLANS.includes(module.plan) ? { type: 'floorplan', plan: module.plan } : null
    ),
};

/**
 * Går gjennom katalogen, ikke gjennom dokumentet. Det gir tre ting på én gang:
 * ukjente typer faller bort, rekkefølgen blir katalogens, og en type som står
 * to ganger blir til én.
 */
function normalizeModules(value, order, normalizers) {
    const list = Array.isArray(value) ? value : [];
    const result = [];
    for (const type of order) {
        const found = list.find((module) => module && module.type === type);
        if (!found) {
            continue;
        }
        const normalized = normalizers[type](found);
        if (normalized) {
            result.push(normalized);
        }
    }
    return result;
}

function asText(value, maxLength) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}
