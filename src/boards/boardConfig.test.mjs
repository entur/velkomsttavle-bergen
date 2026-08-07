import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    THEMES,
    boardHeading,
    findModule,
    normalizeBoardConfig,
    toFirestoreBoard,
} from './boardConfig.js';

/**
 * Et dokument slik det ser ut i Firestore for dagens Bergen-tavle. `staffImage`
 * ligger her bevisst inne i greeting-modulen, på formen fra før migreringen
 * til toppnivå — det gjør at mange tester treffer migreringsveien gratis.
 */
function bergenDocument() {
    return {
        name: 'Bergen 3. etasje',
        placeName: 'Bergen',
        top: { kind: 'video' },
        middle: [{ type: 'greeting', text: 'auto', staffImage: true }],
        carousel: [
            { type: 'weather', name: 'Bergen', lat: 60.39299, lng: 5.32415 },
            { type: 'floorplan', plan: 'bergen-3' },
        ],
    };
}

describe('normalizeBoardConfig', () => {
    it('beholder et gyldig dokument', () => {
        const config = normalizeBoardConfig('bergen-3', bergenDocument());
        assert.equal(config.id, 'bergen-3');
        assert.equal(config.name, 'Bergen 3. etasje');
        assert.equal(config.placeName, 'Bergen');
        assert.equal(config.top.kind, 'video');
        assert.deepEqual(config.middle, [{ type: 'greeting', text: 'auto' }]);
        assert.equal(config.carousel.length, 2);
    });

    it('hopper over modultyper den ikke kjenner', () => {
        // Typen her må være en som IKKE står i katalogen. Testen brukte
        // opprinnelig `departures`, men den finnes fra fase 3 — poenget er at en
        // kiosk som ikke er lastet på nytt skal tåle en modultype fra framtida.
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            carousel: [{ type: 'kantinemeny', rett: 'fiskesuppe' }, { type: 'floorplan', plan: 'bergen-3' }],
        });
        assert.deepEqual(config.carousel, [{ type: 'floorplan', plan: 'bergen-3' }]);
    });

    it('beholder bare den første modulen av hver type', () => {
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            carousel: [
                { type: 'weather', name: 'Bergen', lat: 60.4, lng: 5.3 },
                { type: 'weather', name: 'Oslo', lat: 59.9, lng: 10.7 },
            ],
        });
        assert.equal(config.carousel.length, 1);
        assert.equal(config.carousel[0].name, 'Bergen');
    });

    it('tvinger rekkefølgen fra katalogen', () => {
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            carousel: [{ type: 'floorplan', plan: 'bergen-3' }, { type: 'weather', name: 'Bergen', lat: 60.4, lng: 5.3 }],
        });
        assert.deepEqual(config.carousel.map((m) => m.type), ['weather', 'floorplan']);
    });

    it('dropper vær uten brukbare koordinater', () => {
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            carousel: [{ type: 'weather', name: 'Bergen', lat: 'nord', lng: 5.3 }],
        });
        assert.deepEqual(config.carousel, []);
    });

    it('dropper plantegning med ukjent plan', () => {
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            carousel: [{ type: 'floorplan', plan: 'oslo-7' }],
        });
        assert.deepEqual(config.carousel, []);
    });

    it('faller tilbake til video når toppen er ukjent eller mangler', () => {
        assert.equal(normalizeBoardConfig('x', { ...bergenDocument(), top: { kind: 'banner' } }).top.kind, 'video');
        assert.equal(normalizeBoardConfig('x', { ...bergenDocument(), top: undefined }).top.kind, 'video');
    });

    it('godtar logo som topp', () => {
        assert.equal(normalizeBoardConfig('x', { ...bergenDocument(), top: { kind: 'logo' } }).top.kind, 'logo');
    });

    it('faller på det mørke temaet når theme mangler eller er ukjent', () => {
        assert.equal(normalizeBoardConfig('x', bergenDocument()).theme, 'dark');
        assert.equal(normalizeBoardConfig('x', { ...bergenDocument(), theme: 'lilla' }).theme, 'dark');
        assert.equal(normalizeBoardConfig('x', {}).theme, 'dark');
    });

    it('godtar det lyse temaet', () => {
        assert.equal(normalizeBoardConfig('x', { ...bergenDocument(), theme: 'light' }).theme, 'light');
    });

    it('leser ansatt-illustrasjonen fra toppnivå', () => {
        assert.equal(normalizeBoardConfig('x', { ...bergenDocument(), staffImage: false }).staffImage, false);
        assert.equal(normalizeBoardConfig('x', { ...bergenDocument(), staffImage: true }).staffImage, true);
    });

    it('arver ansatt-illustrasjonen fra en gammel hilsen-modul', () => {
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            middle: [{ type: 'greeting', text: 'auto', staffImage: false }],
        });
        assert.equal(config.staffImage, false);
        assert.deepEqual(config.middle, [{ type: 'greeting', text: 'auto' }]);
    });

    it('lar toppnivået vinne over den gamle plasseringen', () => {
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            staffImage: true,
            middle: [{ type: 'greeting', text: 'auto', staffImage: false }],
        });
        assert.equal(config.staffImage, true);
    });

    it('viser ansatt-illustrasjonen når ingen av plassene sier noe', () => {
        assert.equal(normalizeBoardConfig('x', {}).staffImage, true);
        assert.equal(normalizeBoardConfig('x', {
            ...bergenDocument(),
            middle: [{ type: 'openingHours', days: [] }],
        }).staffImage, true);
    });

    it('gir hilsenen forsvarlige verdier', () => {
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            middle: [{ type: 'greeting' }],
        });
        assert.deepEqual(config.middle, [{ type: 'greeting', text: 'auto' }]);
        assert.equal(config.staffImage, true);
    });

    it('trimmer og beholder en fast hilsen-tekst', () => {
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            middle: [{ type: 'greeting', text: '  Hei og velkommen  ', staffImage: false }],
        });
        assert.deepEqual(config.middle, [{ type: 'greeting', text: 'Hei og velkommen' }]);
    });

    it('normaliserer åpningstidene til sju dager', () => {
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            middle: [{ type: 'openingHours', days: [{ day: 'mon', opens: '08:00', closes: '16:00' }] }],
        });
        assert.equal(config.middle[0].days.length, 7);
        assert.equal(config.middle[0].days[0].closed, false);
    });

    it('beholder en gyldig avgangsmodul', () => {
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            carousel: [{ type: 'departures', stopPlaceId: 'NSR:StopPlace:59983', stopPlaceName: 'Bergen stasjon' }],
        });
        assert.deepEqual(config.carousel, [
            { type: 'departures', stopPlaceId: 'NSR:StopPlace:59983', stopPlaceName: 'Bergen stasjon' },
        ]);
    });

    it('dropper avgangsmodul med ubrukelig stoppested', () => {
        for (const stopPlaceId of ['59983', 'NSR:Quay:1', 'NSR:StopPlace:', undefined]) {
            const config = normalizeBoardConfig('x', {
                ...bergenDocument(),
                carousel: [{ type: 'departures', stopPlaceId, stopPlaceName: 'Noe' }],
            });
            assert.deepEqual(config.carousel, [], String(stopPlaceId));
        }
    });

    it('setter avganger etter vær og plantegning i katalogrekkefølgen', () => {
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            carousel: [
                { type: 'departures', stopPlaceId: 'NSR:StopPlace:59983', stopPlaceName: 'Bergen stasjon' },
                { type: 'weather', name: 'Bergen', lat: 60.4, lng: 5.3 },
            ],
        });
        assert.deepEqual(config.carousel.map((m) => m.type), ['weather', 'departures']);
    });

    it('leser karusell-temaet', () => {
        assert.equal(normalizeBoardConfig('x', { ...bergenDocument(), carouselTheme: 'dark' }).carouselTheme, 'dark');
        assert.equal(normalizeBoardConfig('x', { ...bergenDocument(), carouselTheme: 'light' }).carouselTheme, 'light');
    });

    it('faller til lyst tema når feltet mangler eller er ukjent', () => {
        assert.equal(normalizeBoardConfig('x', bergenDocument()).carouselTheme, 'light');
        assert.equal(normalizeBoardConfig('x', { ...bergenDocument(), carouselTheme: 'lilla' }).carouselTheme, 'light');
    });

    it('godtar tomme felt', () => {
        const config = normalizeBoardConfig('x', { name: 'Tom', placeName: 'Bergen', middle: [], carousel: [] });
        assert.deepEqual(config.middle, []);
        assert.deepEqual(config.carousel, []);
    });

    it('tåler et dokument med hull i', () => {
        const config = normalizeBoardConfig('x', {});
        assert.equal(config.name, '');
        assert.equal(config.placeName, '');
        assert.equal(config.top.kind, 'video');
        assert.deepEqual(config.middle, []);
        assert.deepEqual(config.carousel, []);
    });
});

describe('findModule', () => {
    it('finner modulen med riktig type', () => {
        const config = normalizeBoardConfig('x', bergenDocument());
        assert.equal(findModule(config.carousel, 'weather').name, 'Bergen');
        assert.equal(findModule(config.carousel, 'departures'), undefined);
    });
});

describe('boardHeading', () => {
    it('setter stedsnavnet inn i overskriften', () => {
        assert.equal(boardHeading('Bergen'), 'Velkommen til Entur Bergen');
    });
});

describe('toFirestoreBoard', () => {
    it('skriver feltene tavla trenger, med den innlogget som updatedBy', () => {
        const config = normalizeBoardConfig('bergen-3', bergenDocument());
        const data = toFirestoreBoard(config, 'ola@entur.org');
        assert.equal(data.name, 'Bergen 3. etasje');
        assert.equal(data.updatedBy, 'ola@entur.org');
        assert.deepEqual(data.top, { kind: 'video' });
        assert.equal(data.carousel.length, 2);
        assert.equal(data.theme, 'dark');
        assert.equal(data.staffImage, true);
        assert.equal('id' in data, false);
    });

    it('skriver med karusell-temaet', () => {
        const config = normalizeBoardConfig('bergen-3', { ...bergenDocument(), carouselTheme: 'dark' });
        assert.equal(toFirestoreBoard(config, 'ola@entur.org').carouselTheme, 'dark');
    });
});

describe('THEMES', () => {
    it('har nøyaktig de to temaene', () => {
        assert.deepEqual(THEMES, ['dark', 'light']);
    });
});
