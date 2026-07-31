import { ALERT_LEVEL_VALUES } from './alertLevels.js';

export const TITLE_MAX_LENGTH = 80;
export const BODY_MAX_LENGTH = 400;

/**
 * Validerer skjemainnholdet før lagring.
 *
 * Speiler firestore.rules med vilje: her ligger den gode feilmeldingen,
 * der ligger håndhevingen. Endrer du grensene her, endre dem der også.
 *
 * Returnerer et objekt med feilmelding per feltnavn. Tomt objekt = gyldig.
 */
export function validateAlertInput(input) {
    const errors = {};

    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (title.length === 0) {
        errors.title = 'Tittel er påkrevd';
    } else if (title.length > TITLE_MAX_LENGTH) {
        errors.title = `Tittel kan være maks ${TITLE_MAX_LENGTH} tegn`;
    }

    const body = typeof input.body === 'string' ? input.body.trim() : '';
    if (body.length === 0) {
        errors.body = 'Tekst er påkrevd';
    } else if (body.length > BODY_MAX_LENGTH) {
        errors.body = `Tekst kan være maks ${BODY_MAX_LENGTH} tegn`;
    }

    if (!ALERT_LEVEL_VALUES.includes(input.level)) {
        errors.level = 'Velg et nivå';
    }

    if (!isUsableDate(input.startsAt)) {
        errors.startsAt = 'Starttidspunkt er påkrevd';
    }

    if (input.endsAt != null) {
        if (!isUsableDate(input.endsAt)) {
            errors.endsAt = 'Sluttidspunktet er ugyldig';
        } else if (!errors.startsAt && input.endsAt.getTime() <= input.startsAt.getTime()) {
            errors.endsAt = 'Slutt må være etter start';
        }
    }

    return errors;
}

export function hasErrors(errors) {
    return Object.keys(errors).length > 0;
}

function isUsableDate(value) {
    return value instanceof Date && !Number.isNaN(value.getTime());
}
