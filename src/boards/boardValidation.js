/**
 * Validerer oppsettskjemaet før lagring.
 *
 * Speiler firestore.rules og normaliseringen i boardConfig med vilje: her ligger
 * den gode feilmeldingen, der ligger håndhevingen. Endrer du grensene her, endre
 * dem der også.
 *
 * Returnerer et objekt med feilmelding per feltnavn. Tomt objekt = gyldig.
 */
import {
    FLOORPLAN_PLANS,
    GREETING_TEXT_MAX_LENGTH,
    NAME_MAX_LENGTH,
    PLACE_NAME_MAX_LENGTH,
    isValidStopPlaceId,
} from './boardConfig.js';
import { SURFACES } from './surfaces.js';
import { DAY_LABELS, isTimeOfDay } from './openingHours.js';

export function validateBoardInput(draft) {
    const errors = {};

    const name = trimmed(draft.name);
    if (name.length === 0) {
        errors.name = 'Navn er påkrevd';
    } else if (name.length > NAME_MAX_LENGTH) {
        errors.name = `Navn kan være maks ${NAME_MAX_LENGTH} tegn`;
    }

    const placeName = trimmed(draft.placeName);
    if (placeName.length === 0) {
        errors.placeName = 'Stedsnavn er påkrevd';
    } else if (placeName.length > PLACE_NAME_MAX_LENGTH) {
        errors.placeName = `Stedsnavn kan være maks ${PLACE_NAME_MAX_LENGTH} tegn`;
    }

    if (draft.greetingEnabled && !draft.greetingAuto) {
        const text = trimmed(draft.greetingText);
        if (text.length === 0) {
            errors.greetingText = 'Skriv en tekst, eller velg automatisk hilsen';
        } else if (text.length > GREETING_TEXT_MAX_LENGTH) {
            errors.greetingText = `Hilsen kan være maks ${GREETING_TEXT_MAX_LENGTH} tegn`;
        }
    }

    if (draft.openingHoursEnabled) {
        const openingHoursError = firstOpeningHoursError(draft.days);
        if (openingHoursError) {
            errors.openingHours = openingHoursError;
        }
    }

    // Samme krav uansett hvilket felt været står i: det er de samme
    // koordinatene som sendes til api.met.no.
    if (draft.weatherPlacement === 'karusell' || draft.weatherPlacement === 'stripe') {
        if (trimmed(draft.weatherName).length === 0) {
            errors.weatherName = 'Stedsnavn for været er påkrevd';
        }
        if (!isCoordinate(draft.weatherLat, 90)) {
            errors.weatherLat = 'Breddegrad må være et tall mellom -90 og 90';
        }
        if (!isCoordinate(draft.weatherLng, 180)) {
            errors.weatherLng = 'Lengdegrad må være et tall mellom -180 og 180';
        }
    }

    if (draft.floorplanEnabled && !FLOORPLAN_PLANS.includes(draft.floorplanPlan)) {
        errors.floorplan = 'Velg en plantegning';
    }

    if (draft.departuresEnabled && !isValidStopPlaceId(draft.stopPlaceId)) {
        errors.stopPlace = 'Søk opp og velg et stoppested';
    }

    if (!SURFACES.includes(draft.carouselSurface)) {
        errors.carouselSurface = 'Velg en farge for karusellen';
    }

    if (!SURFACES.includes(draft.bottomSurface)) {
        errors.bottomSurface = 'Velg en farge for bunnstripa';
    }

    return errors;
}

export function hasErrors(errors) {
    return Object.keys(errors).length > 0;
}

/**
 * Én melding om gangen, ikke sju. Skjemaet har én feilrad for åpningstidene, og
 * en liste med sju halvferdige feil hjelper ingen.
 */
function firstOpeningHoursError(days) {
    const list = Array.isArray(days) ? days : [];
    for (const day of list) {
        if (day.closed) {
            continue;
        }
        if (!isTimeOfDay(day.opens) || !isTimeOfDay(day.closes)) {
            return `${DAY_LABELS[day.day]}: klokkeslettene må være på formen 08:00`;
        }
        if (day.opens >= day.closes) {
            return `${DAY_LABELS[day.day]}: stengetid må være etter åpningstid`;
        }
    }
    if (list.every((day) => day.closed)) {
        return 'Minst én dag må ha en åpningstid';
    }
    return null;
}

function isCoordinate(value, limit) {
    const text = trimmed(value);
    const number = Number(text);
    return text !== '' && Number.isFinite(number) && Math.abs(number) <= limit;
}

function trimmed(value) {
    return typeof value === 'string' ? value.trim() : '';
}
