/**
 * Modulkatalogen: hva en tavle kan vise, og hvordan et dokument fra Firestore
 * gjøres om til noe kiosken trygt kan rendre.
 *
 * Uten Firebase-importer og uten JSX, slik at katalogen kan testes med
 * `node --test`.
 *
 * Normaliseringen er kiosken sitt vern. Firestore-reglene kan ikke iterere over
 * en liste og validerer derfor bare grovformen på `middle`, `carousel` og
 * `bottom`; et dokument skrevet for hånd i konsollet kan altså inneholde tull.
 * Alt som ikke går an å rendre blir derfor kastet her, ikke i komponentene.
 */
import { normalizeDays } from './openingHours.js';
import {
    DEFAULT_BOTTOM_SURFACE,
    DEFAULT_CAROUSEL_SURFACE,
    SURFACES,
} from './surfaces.js';

export const TOP_KINDS = ['video', 'logo'];

/** Fargen på toppfeltet og midtfeltet. Fargeverdiene ligger i boardTheme.js. */
export const THEMES = ['dark', 'light'];

/**
 * Midtfeltet rendrer disse typene eksplisitt i `MiddleBand.jsx`, ikke ved å
 * iterere over listen. En ny type må derfor også legges inn der.
 */
export const MIDDLE_TYPES = ['greeting', 'openingHours'];

/** Rekkefølgen her er rekkefølgen på skjermen. */
export const CAROUSEL_TYPES = ['weather', 'floorplan', 'departures'];

/**
 * Bunnstripa rendrer disse typene eksplisitt i `BottomBand.jsx`, ikke ved å
 * iterere over listen. En ny type må derfor også legges inn der.
 *
 * Bare vær foreløpig. Plantegningen hører ikke hjemme her: kartet trenger
 * høyde, og etikettene blir ubrukelige på 16vh.
 */
export const BOTTOM_TYPES = ['weather'];

export const FLOORPLAN_PLANS = ['bergen-3'];

/** NSR-id-en til et stoppested. Quay-er og bare tall er ikke stoppesteder. */
export const STOP_PLACE_ID_PATTERN = /^NSR:StopPlace:\d+$/;

export function isValidStopPlaceId(value) {
    return typeof value === 'string' && STOP_PLACE_ID_PATTERN.test(value);
}

export const GREETING_AUTO = 'auto';
export const GREETING_TEXT_MAX_LENGTH = 120;
export const NAME_MAX_LENGTH = 60;
export const PLACE_NAME_MAX_LENGTH = 40;

const DEFAULT_TOP_KIND = 'video';
const DEFAULT_THEME = 'dark';

export function normalizeBoardConfig(id, data = {}) {
    const source = data ?? {};
    return {
        id,
        name: asText(source.name, NAME_MAX_LENGTH),
        placeName: asText(source.placeName, PLACE_NAME_MAX_LENGTH),
        theme: THEMES.includes(source.theme) ? source.theme : DEFAULT_THEME,
        staffImage: staffImageFrom(source),
        top: { kind: TOP_KINDS.includes(source.top?.kind) ? source.top.kind : DEFAULT_TOP_KIND },
        carouselSurface: carouselSurfaceFrom(source),
        bottomSurface: SURFACES.includes(source.bottomSurface)
            ? source.bottomSurface
            : DEFAULT_BOTTOM_SURFACE,
        middle: normalizeModules(source.middle, MIDDLE_TYPES, MIDDLE_NORMALIZERS),
        ...screenModules(source),
    };
}

/**
 * Ansatt-illustrasjonen lå tidligere inne i hilsen-modulen. Dokumenter skrevet
 * før flyttingen har den fortsatt der, og skal se like ut etter oppgraderingen —
 * derfor leses den gamle plasseringen når toppnivået ikke sier noe. Standarden
 * er på: dagens tavler har illustrasjonen.
 */
function staffImageFrom(source) {
    if (typeof source.staffImage === 'boolean') {
        return source.staffImage;
    }
    const list = Array.isArray(source.middle) ? source.middle : [];
    const greeting = list.find((module) => module && module.type === 'greeting');
    return greeting ? greeting.staffImage !== false : true;
}

/**
 * Flaten karusellen står på.
 *
 * Samme mønster som `staffImageFrom`: nytt felt først, gammel plassering som
 * fallback. Dokumenter skrevet før flatetabellen har `carouselTheme` med to
 * verdier, og skal se like ut etter oppgraderingen.
 */
const CAROUSEL_THEME_TO_SURFACE = { dark: 'morkebla', light: 'lys-lavendel' };

function carouselSurfaceFrom(source) {
    if (SURFACES.includes(source.carouselSurface)) {
        return source.carouselSurface;
    }
    return CAROUSEL_THEME_TO_SURFACE[source.carouselTheme] ?? DEFAULT_CAROUSEL_SURFACE;
}

/**
 * Karusellen og bunnstripa normaliseres sammen fordi de deler modulkatalog, og
 * fordi regelen «en modul bor ett sted» krever begge listene på én gang.
 *
 * `bottom` vinner. Regelen håndheves her og ikke bare i admin: et dokument
 * redigert for hånd i Firestore-konsollet skal ikke kunne gi to værmoduler, og
 * dermed to pollinger mot api.met.no.
 */
function screenModules(source) {
    const bottom = normalizeModules(source.bottom, BOTTOM_TYPES, MODULE_NORMALIZERS);
    const taken = new Set(bottom.map((module) => module.type));
    const carousel = normalizeModules(source.carousel, CAROUSEL_TYPES, MODULE_NORMALIZERS)
        .filter((module) => !taken.has(module.type));
    return { carousel, bottom };
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
        theme: config.theme,
        staffImage: config.staffImage,
        top: { kind: config.top.kind },
        carouselSurface: config.carouselSurface,
        bottomSurface: config.bottomSurface,
        middle: config.middle,
        carousel: config.carousel,
        bottom: config.bottom,
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
        };
    },
    openingHours: (module) => ({ type: 'openingHours', days: normalizeDays(module.days) }),
};

/** Delt av karusellen og bunnstripa. Middle har sin egen tabell. */
const MODULE_NORMALIZERS = {
    // Vær uten koordinater kan ikke hente noe. Da er det bedre å la modulen
    // falle bort enn å vise et tomt felt — en slide karusellen står 30
    // sekunder på, eller en stripe som aldri får noe å vise.
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
    // Uten et brukbart stoppested kan modulen ikke slå opp noe. Da er det bedre
    // å la den falle bort enn å vise en tom slide karusellen står 30 sekunder på.
    // (Avganger finnes bare i CAROUSEL_TYPES, ikke BOTTOM_TYPES — «slide» er
    // derfor riktig her, i motsetning til i vær-normalisatoren over.)
    departures: (module) => (
        isValidStopPlaceId(module.stopPlaceId)
            ? {
                type: 'departures',
                stopPlaceId: module.stopPlaceId,
                stopPlaceName: asText(module.stopPlaceName, PLACE_NAME_MAX_LENGTH),
            }
            : null
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
