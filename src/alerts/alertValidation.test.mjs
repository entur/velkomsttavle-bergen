import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    BODY_MAX_LENGTH,
    TITLE_MAX_LENGTH,
    hasErrors,
    validateAlertInput,
} from './alertValidation.js';

function input(overrides = {}) {
    return {
        title: 'Heisen er ute av drift',
        body: 'Bruk trappa i mellomtiden.',
        level: 'warning',
        startsAt: new Date('2026-08-03T08:00:00Z'),
        endsAt: new Date('2026-08-04T08:00:00Z'),
        enabled: true,
        ...overrides,
    };
}

describe('validateAlertInput', () => {
    it('godtar en fullt utfylt melding', () => {
        assert.deepEqual(validateAlertInput(input()), {});
    });

    it('godtar tom slutt', () => {
        assert.deepEqual(validateAlertInput(input({ endsAt: null })), {});
    });

    it('krever tittel', () => {
        const errors = validateAlertInput(input({ title: '   ' }));
        assert.equal(errors.title, 'Tittel er påkrevd');
    });

    it('krever tekst', () => {
        const errors = validateAlertInput(input({ body: '' }));
        assert.equal(errors.body, 'Tekst er påkrevd');
    });

    it('avviser for lang tittel', () => {
        const errors = validateAlertInput(input({ title: 'a'.repeat(TITLE_MAX_LENGTH + 1) }));
        assert.equal(errors.title, `Tittel kan være maks ${TITLE_MAX_LENGTH} tegn`);
    });

    it('godtar tittel på nøyaktig maks lengde', () => {
        const errors = validateAlertInput(input({ title: 'a'.repeat(TITLE_MAX_LENGTH) }));
        assert.equal(errors.title, undefined);
    });

    it('avviser for lang tekst', () => {
        const errors = validateAlertInput(input({ body: 'a'.repeat(BODY_MAX_LENGTH + 1) }));
        assert.equal(errors.body, `Tekst kan være maks ${BODY_MAX_LENGTH} tegn`);
    });

    it('avviser ukjent nivå', () => {
        const errors = validateAlertInput(input({ level: 'katastrofe' }));
        assert.equal(errors.level, 'Velg et nivå');
    });

    it('krever starttidspunkt', () => {
        const errors = validateAlertInput(input({ startsAt: null }));
        assert.equal(errors.startsAt, 'Starttidspunkt er påkrevd');
    });

    it('avviser ugyldig dato som starttidspunkt', () => {
        const errors = validateAlertInput(input({ startsAt: new Date('tull') }));
        assert.equal(errors.startsAt, 'Starttidspunkt er påkrevd');
    });

    it('avviser ugyldig dato som sluttidspunkt', () => {
        const errors = validateAlertInput(input({ endsAt: new Date('tull') }));
        assert.equal(errors.endsAt, 'Sluttidspunkt er ugyldig');
    });

    it('avviser slutt før start', () => {
        const errors = validateAlertInput(input({
            startsAt: new Date('2026-08-04T08:00:00Z'),
            endsAt: new Date('2026-08-03T08:00:00Z'),
        }));
        assert.equal(errors.endsAt, 'Slutt må være etter start');
    });

    it('avviser slutt lik start', () => {
        const same = new Date('2026-08-03T08:00:00Z');
        const errors = validateAlertInput(input({ startsAt: same, endsAt: same }));
        assert.equal(errors.endsAt, 'Slutt må være etter start');
    });

    it('klager ikke på rekkefølgen når start allerede er ugyldig', () => {
        const errors = validateAlertInput(input({ startsAt: null }));
        assert.equal(errors.endsAt, undefined);
    });

    it('tåler et tomt objekt', () => {
        const errors = validateAlertInput({});
        assert.equal(errors.title, 'Tittel er påkrevd');
        assert.equal(errors.body, 'Tekst er påkrevd');
        assert.equal(errors.level, 'Velg et nivå');
        assert.equal(errors.startsAt, 'Starttidspunkt er påkrevd');
    });
});

describe('hasErrors', () => {
    it('er false for tomt objekt', () => {
        assert.equal(hasErrors({}), false);
    });

    it('er true når det finnes en feil', () => {
        assert.equal(hasErrors({ title: 'Tittel er påkrevd' }), true);
    });
});
