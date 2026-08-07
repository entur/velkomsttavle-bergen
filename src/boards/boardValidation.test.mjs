import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { hasErrors, validateBoardInput } from './boardValidation.js';

function validDraft(overrides = {}) {
    return {
        id: 'bergen-3',
        name: 'Bergen 3. etasje',
        placeName: 'Bergen',
        topKind: 'video',
        greetingEnabled: true,
        greetingAuto: true,
        greetingText: '',
        staffImage: true,
        openingHoursEnabled: false,
        days: [
            { day: 'mon', closed: false, opens: '08:00', closes: '16:00' },
            { day: 'tue', closed: true },
            { day: 'wed', closed: true },
            { day: 'thu', closed: true },
            { day: 'fri', closed: true },
            { day: 'sat', closed: true },
            { day: 'sun', closed: true },
        ],
        weatherEnabled: true,
        weatherName: 'Bergen',
        weatherLat: '60.39299',
        weatherLng: '5.32415',
        floorplanEnabled: true,
        floorplanPlan: 'bergen-3',
        departuresEnabled: false,
        stopPlaceId: '',
        stopPlaceName: '',
        carouselTheme: 'light',
        ...overrides,
    };
}

describe('validateBoardInput', () => {
    it('godtar et gyldig oppsett', () => {
        assert.deepEqual(validateBoardInput(validDraft()), {});
        assert.equal(hasErrors({}), false);
    });

    it('krever navn og stedsnavn', () => {
        const errors = validateBoardInput(validDraft({ name: '   ', placeName: '' }));
        assert.equal(errors.name, 'Navn er påkrevd');
        assert.equal(errors.placeName, 'Stedsnavn er påkrevd');
        assert.equal(hasErrors(errors), true);
    });

    it('setter en øvre grense på navn og stedsnavn', () => {
        const errors = validateBoardInput(validDraft({ name: 'a'.repeat(61), placeName: 'b'.repeat(41) }));
        assert.equal(errors.name, 'Navn kan være maks 60 tegn');
        assert.equal(errors.placeName, 'Stedsnavn kan være maks 40 tegn');
    });

    it('krever tekst når hilsenen ikke er automatisk', () => {
        const errors = validateBoardInput(validDraft({ greetingAuto: false, greetingText: '  ' }));
        assert.equal(errors.greetingText, 'Skriv en tekst, eller velg automatisk hilsen');
    });

    it('setter en øvre grense på hilsen-teksten', () => {
        const errors = validateBoardInput(validDraft({ greetingAuto: false, greetingText: 'a'.repeat(121) }));
        assert.equal(errors.greetingText, 'Hilsen kan være maks 120 tegn');
    });

    it('ser bort fra hilsen-teksten når hilsenen er slått av', () => {
        const errors = validateBoardInput(validDraft({ greetingEnabled: false, greetingAuto: false, greetingText: '' }));
        assert.equal(errors.greetingText, undefined);
    });

    it('krever brukbare koordinater når vær er på', () => {
        const errors = validateBoardInput(validDraft({ weatherLat: 'nord', weatherLng: '' }));
        assert.equal(errors.weatherLat, 'Breddegrad må være et tall mellom -90 og 90');
        assert.equal(errors.weatherLng, 'Lengdegrad må være et tall mellom -180 og 180');
    });

    it('avviser koordinater utenfor kloden', () => {
        const errors = validateBoardInput(validDraft({ weatherLat: '91', weatherLng: '181' }));
        assert.equal(errors.weatherLat, 'Breddegrad må være et tall mellom -90 og 90');
        assert.equal(errors.weatherLng, 'Lengdegrad må være et tall mellom -180 og 180');
    });

    it('krever stedsnavn på værmodulen', () => {
        const errors = validateBoardInput(validDraft({ weatherName: '' }));
        assert.equal(errors.weatherName, 'Stedsnavn for været er påkrevd');
    });

    it('ser bort fra været når modulen er slått av', () => {
        const errors = validateBoardInput(validDraft({ weatherEnabled: false, weatherLat: 'nord', weatherName: '' }));
        assert.equal(errors.weatherLat, undefined);
        assert.equal(errors.weatherName, undefined);
    });

    it('peker på første dag med ugyldig åpningstid', () => {
        const errors = validateBoardInput(validDraft({
            openingHoursEnabled: true,
            days: [
                { day: 'mon', closed: true },
                { day: 'tue', closed: false, opens: '16:00', closes: '08:00' },
                { day: 'wed', closed: false, opens: '', closes: '16:00' },
                { day: 'thu', closed: true },
                { day: 'fri', closed: true },
                { day: 'sat', closed: true },
                { day: 'sun', closed: true },
            ],
        }));
        assert.equal(errors.openingHours, 'Tirsdag: stengetid må være etter åpningstid');
    });

    it('krever at åpningstider har minst én åpen dag', () => {
        const errors = validateBoardInput(validDraft({
            openingHoursEnabled: true,
            days: [
                { day: 'mon', closed: true }, { day: 'tue', closed: true },
                { day: 'wed', closed: true }, { day: 'thu', closed: true },
                { day: 'fri', closed: true }, { day: 'sat', closed: true },
                { day: 'sun', closed: true },
            ],
        }));
        assert.equal(errors.openingHours, 'Minst én dag må ha en åpningstid');
    });

    it('ser bort fra åpningstidene når modulen er slått av', () => {
        const errors = validateBoardInput(validDraft({
            openingHoursEnabled: false,
            days: [
                { day: 'mon', closed: false, opens: '16:00', closes: '08:00' },
                { day: 'tue', closed: true }, { day: 'wed', closed: true },
                { day: 'thu', closed: true }, { day: 'fri', closed: true },
                { day: 'sat', closed: true }, { day: 'sun', closed: true },
            ],
        }));
        assert.equal(errors.openingHours, undefined);
    });

    it('avviser en plantegning som ikke finnes', () => {
        const errors = validateBoardInput(validDraft({ floorplanPlan: 'oslo-7' }));
        assert.equal(errors.floorplan, 'Velg en plantegning');
    });
});

describe('validateBoardInput — avganger og tema', () => {
    it('godtar en avgangsmodul med valgt stoppested', () => {
        const errors = validateBoardInput(validDraft({
            departuresEnabled: true,
            stopPlaceId: 'NSR:StopPlace:59983',
            stopPlaceName: 'Bergen stasjon',
        }));
        assert.equal(errors.stopPlace, undefined);
    });

    it('krever at et stoppested er valgt når modulen er på', () => {
        const errors = validateBoardInput(validDraft({ departuresEnabled: true }));
        assert.equal(errors.stopPlace, 'Søk opp og velg et stoppested');
    });

    it('avviser en id som ikke er et stoppested', () => {
        const errors = validateBoardInput(validDraft({
            departuresEnabled: true,
            stopPlaceId: 'NSR:Quay:1',
            stopPlaceName: 'Noe',
        }));
        assert.equal(errors.stopPlace, 'Søk opp og velg et stoppested');
    });

    it('ser bort fra stoppestedet når modulen er slått av', () => {
        assert.equal(validateBoardInput(validDraft({ stopPlaceId: 'tull' })).stopPlace, undefined);
    });

    it('avviser et ukjent tema', () => {
        assert.equal(validateBoardInput(validDraft({ carouselTheme: 'lilla' })).carouselTheme, 'Velg lyst eller mørkt');
        assert.equal(validateBoardInput(validDraft({ carouselTheme: 'dark' })).carouselTheme, undefined);
    });
});
