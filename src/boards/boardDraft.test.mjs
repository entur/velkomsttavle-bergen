import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { configFrom, draftFrom } from './boardDraft.js';
import { normalizeBoardConfig } from './boardConfig.js';

/** En tavle med alt påskrudd, så rundturen treffer alle grenene. */
function fullBoard() {
    return normalizeBoardConfig('bergen-3', {
        name: 'Bergen 3. etasje',
        placeName: 'Bergen',
        topSurface: 'fersken',
        middleSurface: 'lavendel',
        staffImage: true,
        top: { kind: 'logo' },
        carouselSurface: 'hvit',
        bottomSurface: 'morkebla-lys',
        middle: [
            { type: 'greeting', text: 'Hei og velkommen' },
            { type: 'openingHours', days: [{ day: 'mon', opens: '08:00', closes: '16:00' }] },
        ],
        carousel: [
            { type: 'weather', name: 'Bergen', lat: 60.39299, lng: 5.32415 },
            { type: 'floorplan', plan: 'bergen-3' },
            { type: 'departures', stopPlaceId: 'NSR:StopPlace:548', stopPlaceName: 'Bergen busstasjon' },
        ],
    });
}

describe('draftFrom', () => {
    it('leser alle feltene ut av configen', () => {
        const draft = draftFrom(fullBoard());
        assert.equal(draft.id, 'bergen-3');
        assert.equal(draft.topKind, 'logo');
        assert.equal(draft.topSurface, 'fersken');
        assert.equal(draft.middleSurface, 'lavendel');
        assert.equal(draft.carouselSurface, 'hvit');
        assert.equal(draft.bottomSurface, 'morkebla-lys');
        assert.equal(draft.staffImage, true);
        assert.equal(draft.greetingEnabled, true);
        assert.equal(draft.greetingAuto, false);
        assert.equal(draft.greetingText, 'Hei og velkommen');
        assert.equal(draft.openingHoursEnabled, true);
        assert.equal(draft.floorplanEnabled, true);
        assert.equal(draft.departuresEnabled, true);
        assert.equal(draft.stopPlaceId, 'NSR:StopPlace:548');
    });

    // Koordinatene er strenger i skjemaet: et halvskrevet «60.» er ikke et
    // tall, og feltet skal ikke hoppe mens man skriver.
    it('gjør koordinatene til strenger', () => {
        const draft = draftFrom(fullBoard());
        assert.equal(draft.weatherLat, '60.39299');
        assert.equal(draft.weatherLng, '5.32415');
    });

    it('leser automatisk hilsen som automatisk, med tom tekst', () => {
        const board = normalizeBoardConfig('x', { middle: [{ type: 'greeting', text: 'auto' }] });
        const draft = draftFrom(board);
        assert.equal(draft.greetingEnabled, true);
        assert.equal(draft.greetingAuto, true);
        assert.equal(draft.greetingText, '');
    });

    it('gir av som værplassering når været ikke finnes', () => {
        assert.equal(draftFrom(normalizeBoardConfig('x', {})).weatherPlacement, 'av');
    });

    it('leser været fra karusellen som karusell', () => {
        const board = normalizeBoardConfig('x', {
            carousel: [{ type: 'weather', name: 'Bergen', lat: 60.4, lng: 5.3 }],
        });
        assert.equal(draftFrom(board).weatherPlacement, 'karusell');
    });

    it('leser været fra bunnstripa som stripe', () => {
        const board = normalizeBoardConfig('x', {
            bottom: [{ type: 'weather', name: 'Bergen', lat: 60.4, lng: 5.3 }],
        });
        const draft = draftFrom(board);
        assert.equal(draft.weatherPlacement, 'stripe');
        assert.equal(draft.weatherName, 'Bergen');
    });
});

describe('configFrom', () => {
    it('går rundturen uten å miste noe', () => {
        const board = fullBoard();
        const rundtur = draftFrom(normalizeBoardConfig('bergen-3', configFrom(draftFrom(board))));
        assert.deepEqual(rundtur, draftFrom(board));
    });

    it('setter været i karusellen når plasseringen er karusell', () => {
        const config = configFrom(draftFrom(fullBoard()));
        assert.equal(config.carousel.filter((m) => m.type === 'weather').length, 1);
        assert.deepEqual(config.bottom, []);
    });

    it('setter været i bunnstripa når plasseringen er stripe', () => {
        const draft = { ...draftFrom(fullBoard()), weatherPlacement: 'stripe' };
        const config = configFrom(draft);
        assert.deepEqual(config.carousel.map((m) => m.type), ['floorplan', 'departures']);
        assert.equal(config.bottom.length, 1);
        assert.equal(config.bottom[0].name, 'Bergen');
    });

    it('slipper ikke været ut noe sted når plasseringen er av', () => {
        const draft = { ...draftFrom(fullBoard()), weatherPlacement: 'av' };
        const config = configFrom(draft);
        assert.equal(config.carousel.some((m) => m.type === 'weather'), false);
        assert.deepEqual(config.bottom, []);
    });

    it('gjør koordinatene til tall igjen', () => {
        const config = configFrom(draftFrom(fullBoard()));
        const weather = config.carousel.find((m) => m.type === 'weather');
        assert.equal(weather.lat, 60.39299);
        assert.equal(weather.lng, 5.32415);
    });

    it('skriver de fire flatene', () => {
        const config = configFrom(draftFrom(fullBoard()));
        assert.equal(config.topSurface, 'fersken');
        assert.equal(config.middleSurface, 'lavendel');
        assert.equal(config.carouselSurface, 'hvit');
        assert.equal(config.bottomSurface, 'morkebla-lys');
    });

    it('trimmer navn og stedsnavn', () => {
        const draft = { ...draftFrom(fullBoard()), name: '  Tavla  ', placeName: '  Bergen  ' };
        const config = configFrom(draft);
        assert.equal(config.name, 'Tavla');
        assert.equal(config.placeName, 'Bergen');
    });

    it('skriver auto som hilsen-tekst når hilsenen er automatisk', () => {
        const draft = { ...draftFrom(fullBoard()), greetingAuto: true };
        const greeting = configFrom(draft).middle.find((m) => m.type === 'greeting');
        assert.equal(greeting.text, 'auto');
    });
});
