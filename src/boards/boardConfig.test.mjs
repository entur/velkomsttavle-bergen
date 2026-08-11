import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    BOTTOM_TYPES,
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
});

describe('THEMES', () => {
    it('har nøyaktig de to temaene', () => {
        assert.deepEqual(THEMES, ['dark', 'light']);
    });
});

describe('bunnstripa', () => {
    it('kjenner bare vær foreløpig', () => {
        assert.deepEqual(BOTTOM_TYPES, ['weather']);
    });

    it('normaliserer bottom som de andre listene', () => {
        const config = normalizeBoardConfig('x', {
            bottom: [{ type: 'weather', name: 'Bergen', lat: 60.4, lng: 5.3 }],
        });
        assert.deepEqual(config.bottom, [
            { type: 'weather', name: 'Bergen', lat: 60.4, lng: 5.3 },
        ]);
    });

    it('gir tom liste når feltet mangler', () => {
        assert.deepEqual(normalizeBoardConfig('x', {}).bottom, []);
    });

    it('kaster ukjente typer og vær uten koordinater', () => {
        const config = normalizeBoardConfig('x', {
            bottom: [
                { type: 'floorplan', plan: 'bergen-3' },
                { type: 'weather', name: 'Bergen' },
            ],
        });
        assert.deepEqual(config.bottom, []);
    });

    // Regelen «en modul bor ett sted» håndheves her, ikke bare i admin: et
    // dokument redigert for hånd i konsollet skal ikke kunne gi to værmoduler
    // og dermed to pollinger mot api.met.no.
    it('lar bottom vinne når været står begge steder', () => {
        const config = normalizeBoardConfig('x', {
            carousel: [
                { type: 'weather', name: 'Oslo', lat: 59.9, lng: 10.7 },
                { type: 'floorplan', plan: 'bergen-3' },
            ],
            bottom: [{ type: 'weather', name: 'Bergen', lat: 60.4, lng: 5.3 }],
        });
        assert.deepEqual(config.carousel, [{ type: 'floorplan', plan: 'bergen-3' }]);
        assert.equal(config.bottom.length, 1);
        assert.equal(config.bottom[0].name, 'Bergen');
    });
});

describe('flater', () => {
    it('leser flatenavnene når de finnes', () => {
        const config = normalizeBoardConfig('x', {
            carouselSurface: 'fersken',
            bottomSurface: 'hvit',
        });
        assert.equal(config.carouselSurface, 'fersken');
        assert.equal(config.bottomSurface, 'hvit');
    });

    it('migrerer fra carouselTheme begge veier', () => {
        assert.equal(
            normalizeBoardConfig('x', { carouselTheme: 'dark' }).carouselSurface,
            'morkebla',
        );
        assert.equal(
            normalizeBoardConfig('x', { carouselTheme: 'light' }).carouselSurface,
            'lys-lavendel',
        );
    });

    it('lar carouselSurface vinne over det gamle feltet', () => {
        const config = normalizeBoardConfig('x', {
            carouselTheme: 'dark',
            carouselSurface: 'fersken',
        });
        assert.equal(config.carouselSurface, 'fersken');
    });

    it('faller på standardene uten felt og for ukjent navn', () => {
        assert.equal(normalizeBoardConfig('x', {}).carouselSurface, 'lys-lavendel');
        assert.equal(normalizeBoardConfig('x', {}).bottomSurface, 'morkebla');
        assert.equal(
            normalizeBoardConfig('x', { carouselSurface: 'lilla' }).carouselSurface,
            'lys-lavendel',
        );
        assert.equal(
            normalizeBoardConfig('x', { bottomSurface: 'lilla' }).bottomSurface,
            'morkebla',
        );
    });

    // Et dokument redigert for hånd kan ha et gammelt carouselTheme-navn som
    // aldri fantes i den to-verdis lista. Da skal migreringen falle til
    // standarden, ikke kaste eller la tullverdien lekke gjennom.
    it('faller på standarden for et ukjent carouselTheme-navn', () => {
        assert.equal(
            normalizeBoardConfig('x', { carouselTheme: 'sunset' }).carouselSurface,
            'lys-lavendel',
        );
    });

    it('slutter å eksponere carouselTheme', () => {
        assert.equal(normalizeBoardConfig('x', { carouselTheme: 'dark' }).carouselTheme, undefined);
    });
});

describe('toFirestoreBoard', () => {
    it('skriver de nye feltene og ikke det gamle', () => {
        const config = normalizeBoardConfig('x', {
            name: 'Tavla', placeName: 'Bergen', carouselTheme: 'dark',
            bottom: [{ type: 'weather', name: 'Bergen', lat: 60.4, lng: 5.3 }],
        });
        const document = toFirestoreBoard(config, 'ola@entur.org');
        assert.equal(document.carouselSurface, 'morkebla');
        assert.equal(document.bottomSurface, 'morkebla');
        assert.equal(document.bottom.length, 1);
        assert.equal('carouselTheme' in document, false);
    });
});
