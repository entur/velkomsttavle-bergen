import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isDelayed, isPlatformChanged, situationText, toDeparture, toDepartures } from './departureMapper.js';

/** En EstimatedCall slik Journey Planner v3 faktisk svarer. */
function call(overrides = {}) {
    return {
        realtime: true,
        cancellation: false,
        aimedDepartureTime: '2026-08-07T10:27:00+02:00',
        expectedDepartureTime: '2026-08-07T10:27:00+02:00',
        destinationDisplay: { frontText: 'Arna' },
        quay: { publicCode: '1' },
        situations: [],
        serviceJourney: { line: { publicCode: 'L4', transportMode: 'rail' } },
        ...overrides,
    };
}

describe('toDeparture', () => {
    it('plukker ut feltene tavla trenger', () => {
        const d = toDeparture(call());
        assert.equal(d.lineCode, 'L4');
        assert.equal(d.transportMode, 'rail');
        assert.equal(d.destination, 'Arna');
        assert.equal(d.platform, '1');
        assert.equal(d.realtime, true);
        assert.equal(d.cancelled, false);
        assert.equal(d.situation, '');
        assert.ok(d.aimedAt instanceof Date);
        assert.equal(d.aimedAt.toISOString(), '2026-08-07T08:27:00.000Z');
    });

    it('leser innstilling fra cancellation, ikke cancelled', () => {
        // `cancelled` finnes ikke på EstimatedCall i v3 og gir valideringsfeil.
        assert.equal(toDeparture(call({ cancellation: true })).cancelled, true);
        assert.equal(toDeparture(call({ cancelled: true })).cancelled, false);
    });

    it('tåler at sporet mangler', () => {
        assert.equal(toDeparture(call({ quay: null })).platform, '');
        assert.equal(toDeparture(call({ quay: {} })).platform, '');
    });

    it('faller tilbake til planlagt tid når forventet mangler', () => {
        const d = toDeparture(call({ expectedDepartureTime: null }));
        assert.equal(d.expectedAt.toISOString(), d.aimedAt.toISOString());
    });

    it('tåler et svar med hull i', () => {
        const d = toDeparture({});
        assert.equal(d.lineCode, '');
        assert.equal(d.destination, '');
        assert.equal(d.aimedAt, null);
        assert.equal(d.realtime, false);
        assert.equal(d.cancelled, false);
    });

    it('regner rutetid som ikke-sanntid', () => {
        assert.equal(toDeparture(call({ realtime: false })).realtime, false);
    });
});

describe('situationText', () => {
    it('velger norsk når det finnes', () => {
        assert.equal(situationText([
            { value: 'Platform moved', language: 'en' },
            { value: 'Haldeplass flytta', language: 'no' },
        ]), 'Haldeplass flytta');
    });

    it('godtar nb og nn som norsk', () => {
        assert.equal(situationText([{ value: 'Bokmål', language: 'nb' }]), 'Bokmål');
        assert.equal(situationText([{ value: 'Nynorsk', language: 'nn' }]), 'Nynorsk');
    });

    it('viser engelsk framfor ingenting når norsk mangler', () => {
        assert.equal(situationText([{ value: 'Platform moved', language: 'en' }]), 'Platform moved');
    });

    it('gir tom streng når det ikke er noe å vise', () => {
        assert.equal(situationText([]), '');
        assert.equal(situationText(undefined), '');
        assert.equal(situationText([{ language: 'no' }]), '');
    });
});

describe('toDepartures', () => {
    it('mapper lista og tar med situasjonsteksten', () => {
        const departures = toDepartures({
            estimatedCalls: [
                call(),
                call({
                    serviceJourney: { line: { publicCode: 'R40', transportMode: 'rail' } },
                    situations: [{ summary: [{ value: 'Arbeid mellom Finse og Myrdal', language: 'no' }] }],
                }),
            ],
        });
        assert.equal(departures.length, 2);
        assert.equal(departures[1].lineCode, 'R40');
        assert.equal(departures[1].situation, 'Arbeid mellom Finse og Myrdal');
    });

    it('gir tom liste når stoppestedet mangler eller er tomt', () => {
        assert.deepEqual(toDepartures(null), []);
        assert.deepEqual(toDepartures({}), []);
        assert.deepEqual(toDepartures({ estimatedCalls: [] }), []);
    });
});

describe('isDelayed', () => {
    it('er sann bare når forventet er etter planlagt', () => {
        assert.equal(isDelayed(toDeparture(call())), false);
        assert.equal(isDelayed(toDeparture(call({ expectedDepartureTime: '2026-08-07T10:36:00+02:00' }))), true);
    });

    it('regner et tog som går før tida som ikke forsinket', () => {
        assert.equal(isDelayed(toDeparture(call({ expectedDepartureTime: '2026-08-07T10:25:00+02:00' }))), false);
    });

    it('tåler manglende tider', () => {
        assert.equal(isDelayed(toDeparture({})), false);
    });
});

/** En EstimatedCall der planlagt og faktisk kvai kan settes hver for seg. */
function medKvai({ planlagt, faktisk, posisjon = 1 }) {
    return call({
        stopPositionInPattern: posisjon,
        quay: { id: faktisk, publicCode: '1' },
        serviceJourney: {
            line: { publicCode: 'L4', transportMode: 'rail' },
            quays: [{ id: 'NSR:Quay:100' }, { id: planlagt }, { id: 'NSR:Quay:102' }],
        },
    });
}

describe('isPlatformChanged', () => {
    it('er sann når sanntid gir en annen kvai enn rutemønsteret', () => {
        assert.equal(isPlatformChanged(medKvai({ planlagt: 'NSR:Quay:5', faktisk: 'NSR:Quay:9' })), true);
    });

    it('er usann når kvaiene er like', () => {
        assert.equal(isPlatformChanged(medKvai({ planlagt: 'NSR:Quay:5', faktisk: 'NSR:Quay:5' })), false);
    });

    it('er usann når rutemønsteret mangler', () => {
        // En tavle som ikke vet, skal ikke rope.
        assert.equal(isPlatformChanged(call()), false);
        assert.equal(isPlatformChanged({}), false);
        assert.equal(isPlatformChanged(null), false);
    });

    it('er usann når posisjonen peker utenfor lista', () => {
        assert.equal(isPlatformChanged(medKvai({ planlagt: 'NSR:Quay:5', faktisk: 'NSR:Quay:9', posisjon: 7 })), false);
        assert.equal(isPlatformChanged(medKvai({ planlagt: 'NSR:Quay:5', faktisk: 'NSR:Quay:9', posisjon: -1 })), false);
    });

    it('er usann når posisjonen ikke er et heltall', () => {
        assert.equal(isPlatformChanged(medKvai({ planlagt: 'NSR:Quay:5', faktisk: 'NSR:Quay:9', posisjon: null })), false);
        assert.equal(isPlatformChanged(medKvai({ planlagt: 'NSR:Quay:5', faktisk: 'NSR:Quay:9', posisjon: 1.5 })), false);
    });

    it('er usann når en av kvai-id-ene er tom', () => {
        assert.equal(isPlatformChanged(medKvai({ planlagt: '', faktisk: 'NSR:Quay:9' })), false);
        assert.equal(isPlatformChanged(medKvai({ planlagt: 'NSR:Quay:5', faktisk: '' })), false);
    });
});

describe('toDeparture — sporendring', () => {
    it('legger platformChanged på avgangen', () => {
        assert.equal(toDeparture(medKvai({ planlagt: 'NSR:Quay:5', faktisk: 'NSR:Quay:9' })).platformChanged, true);
        assert.equal(toDeparture(medKvai({ planlagt: 'NSR:Quay:5', faktisk: 'NSR:Quay:5' })).platformChanged, false);
        assert.equal(toDeparture({}).platformChanged, false);
    });
});
