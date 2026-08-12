import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    addCarouselModule,
    availableCarouselTypes,
    bottomModule,
    carouselCards,
    configFrom,
    draftFrom,
    removeCarouselModule,
    setBottomModule,
} from './boardDraft.js';
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

/** En tom draft: ingen moduler noe sted. */
function tomDraft() {
    return draftFrom(normalizeBoardConfig('x', { name: 'Tavla', placeName: 'Bergen' }));
}

describe('carouselCards', () => {
    it('gir kortene i katalogens rekkefølge, ikke i draftens', () => {
        assert.deepEqual(carouselCards(draftFrom(fullBoard())), ['weather', 'floorplan', 'departures']);
    });

    it('gir tom liste når karusellen er tom', () => {
        assert.deepEqual(carouselCards(tomDraft()), []);
    });

    it('gir ikke vær-kort når været står i bunnstripa', () => {
        const draft = { ...draftFrom(fullBoard()), weatherPlacement: 'stripe' };
        assert.deepEqual(carouselCards(draft), ['floorplan', 'departures']);
    });
});

describe('availableCarouselTypes', () => {
    it('tilbyr alt på en tom karusell', () => {
        assert.deepEqual(availableCarouselTypes(tomDraft()), ['weather', 'floorplan', 'departures']);
    });

    it('tilbyr ingenting når alt er lagt til', () => {
        assert.deepEqual(availableCarouselTypes(draftFrom(fullBoard())), []);
    });

    // Været bor ett sted: står det i bunnstripa, skal det ikke kunne legges
    // til i karusellen også. Ellers ville tavla pollet api.met.no to ganger.
    it('tilbyr ikke været når det står i bunnstripa', () => {
        const draft = { ...tomDraft(), weatherPlacement: 'stripe' };
        assert.deepEqual(availableCarouselTypes(draft), ['floorplan', 'departures']);
    });
});

describe('addCarouselModule og removeCarouselModule', () => {
    it('legger til og fjerner været', () => {
        const lagtTil = addCarouselModule(tomDraft(), 'weather');
        assert.equal(lagtTil.weatherPlacement, 'karusell');
        assert.equal(removeCarouselModule(lagtTil, 'weather').weatherPlacement, 'av');
    });

    it('legger til plantegningen med den eneste planen som finnes', () => {
        const lagtTil = addCarouselModule(tomDraft(), 'floorplan');
        assert.equal(lagtTil.floorplanEnabled, true);
        assert.equal(lagtTil.floorplanPlan, 'bergen-3');
        assert.equal(removeCarouselModule(lagtTil, 'floorplan').floorplanEnabled, false);
    });

    it('legger til og fjerner avgangstidene', () => {
        const lagtTil = addCarouselModule(tomDraft(), 'departures');
        assert.equal(lagtTil.departuresEnabled, true);
        assert.equal(removeCarouselModule(lagtTil, 'departures').departuresEnabled, false);
    });

    it('rører ikke draften den fikk inn', () => {
        const draft = tomDraft();
        addCarouselModule(draft, 'weather');
        assert.equal(draft.weatherPlacement, 'av');
    });

    // Koordinatene skal ikke forsvinne av å fjerne kortet: legger du det til
    // igjen, skal stedet stå der fortsatt.
    it('beholder koordinatene når vær-kortet fjernes', () => {
        const draft = removeCarouselModule(draftFrom(fullBoard()), 'weather');
        assert.equal(draft.weatherName, 'Bergen');
        assert.equal(draft.weatherLat, '60.39299');
    });
});

describe('bottomModule og setBottomModule', () => {
    it('gir null når bunnstripa er tom', () => {
        assert.equal(bottomModule(tomDraft()), null);
        assert.equal(bottomModule(draftFrom(fullBoard())), null);
    });

    it('gir weather når været står i stripa', () => {
        assert.equal(bottomModule({ ...tomDraft(), weatherPlacement: 'stripe' }), 'weather');
    });

    it('tar været fra karusellen når stripa velger det', () => {
        const draft = setBottomModule(draftFrom(fullBoard()), 'weather');
        assert.equal(draft.weatherPlacement, 'stripe');
        assert.deepEqual(carouselCards(draft), ['floorplan', 'departures']);
    });

    it('gjør været tilgjengelig i karusellen igjen når stripa settes til ingen', () => {
        const stripe = setBottomModule(tomDraft(), 'weather');
        const ingen = setBottomModule(stripe, null);
        assert.equal(ingen.weatherPlacement, 'av');
        assert.ok(availableCarouselTypes(ingen).includes('weather'));
    });

    // «Ingen» i stripa skal bare rive ned stripa. Et vær-kort som står i
    // karusellen har ingenting med det valget å gjøre.
    it('rører ikke et vær-kort i karusellen når stripa settes til ingen', () => {
        const draft = setBottomModule(draftFrom(fullBoard()), null);
        assert.equal(draft.weatherPlacement, 'karusell');
        assert.deepEqual(carouselCards(draft), ['weather', 'floorplan', 'departures']);
    });
});
