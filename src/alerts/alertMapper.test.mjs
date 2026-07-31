import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ALERT_LEVEL_VALUES } from './alertLevels.js';
import { toAlert, toFirestoreData } from './alertMapper.js';

/** Etterlikner en Firestore-Timestamp: alt vi bruker er .toDate(). */
function timestamp(iso) {
    return { toDate: () => new Date(iso) };
}

describe('toAlert', () => {
    it('gjør Timestamp om til Date', () => {
        const alert = toAlert('abc', {
            title: 'Tittel',
            body: 'Tekst',
            level: 'warning',
            startsAt: timestamp('2026-08-03T08:00:00Z'),
            endsAt: timestamp('2026-08-04T08:00:00Z'),
            enabled: true,
            createdBy: 'a@entur.org',
            updatedBy: 'b@entur.org',
        });

        assert.equal(alert.id, 'abc');
        assert.ok(alert.startsAt instanceof Date);
        assert.equal(alert.startsAt.toISOString(), '2026-08-03T08:00:00.000Z');
        assert.equal(alert.endsAt.toISOString(), '2026-08-04T08:00:00.000Z');
        assert.equal(alert.enabled, true);
        assert.equal(alert.createdBy, 'a@entur.org');
        assert.equal(alert.updatedBy, 'b@entur.org');
    });

    it('beholder null som endsAt', () => {
        const alert = toAlert('abc', {
            title: 'Tittel',
            body: 'Tekst',
            level: 'information',
            startsAt: timestamp('2026-08-03T08:00:00Z'),
            endsAt: null,
            enabled: true,
        });
        assert.equal(alert.endsAt, null);
    });

    it('gir null når startsAt mangler framfor å krasje', () => {
        const alert = toAlert('abc', { title: 'T', body: 'B', level: 'information' });
        assert.equal(alert.startsAt, null);
        assert.equal(alert.endsAt, null);
    });

    it('regner alt annet enn true som avslått', () => {
        const alert = toAlert('abc', {
            title: 'T',
            body: 'B',
            level: 'information',
            startsAt: timestamp('2026-08-03T08:00:00Z'),
            enabled: 'ja',
        });
        assert.equal(alert.enabled, false);
    });

    it('fyller inn tomme strenger for manglende tekstfelt', () => {
        const alert = toAlert('abc', { startsAt: timestamp('2026-08-03T08:00:00Z') });
        assert.equal(alert.title, '');
        assert.equal(alert.body, '');
        assert.equal(alert.createdBy, '');
        assert.equal(alert.updatedBy, '');
    });

    it('klemmer et ukjent nivå til information framfor å velte hele varselbåndet', () => {
        // Reglene validerer enum-verdien, men et hånd-skrevet dokument (konsoll
        // eller Admin-SDK) omgår dem. 'Kritisk' er den norske *etiketten*
        // admin-UI-et viser — nettopp den feilen et menneske faktisk gjør.
        const alert = toAlert('abc', {
            title: 'T',
            body: 'B',
            level: 'Kritisk',
            startsAt: timestamp('2026-08-03T08:00:00Z'),
            enabled: true,
        });
        assert.equal(alert.level, 'information');
    });

    for (const level of ALERT_LEVEL_VALUES) {
        it(`slipper gyldig nivå '${level}' gjennom urørt`, () => {
            const alert = toAlert('abc', {
                title: 'T',
                body: 'B',
                level,
                startsAt: timestamp('2026-08-03T08:00:00Z'),
                enabled: true,
            });
            assert.equal(alert.level, level);
        });
    }
});

describe('toFirestoreData', () => {
    const input = {
        title: '  Heisen er ute av drift  ',
        body: '  Bruk trappa.  ',
        level: 'warning',
        startsAt: new Date('2026-08-03T08:00:00Z'),
        endsAt: new Date('2026-08-04T08:00:00Z'),
        enabled: true,
    };

    it('trimmer tittel og tekst', () => {
        const data = toFirestoreData(input, 'a@entur.org');
        assert.equal(data.title, 'Heisen er ute av drift');
        assert.equal(data.body, 'Bruk trappa.');
    });

    it('setter updatedBy til den innloggede', () => {
        const data = toFirestoreData(input, 'a@entur.org');
        assert.equal(data.updatedBy, 'a@entur.org');
    });

    it('sender Date-objekter videre urørt', () => {
        const data = toFirestoreData(input, 'a@entur.org');
        assert.ok(data.startsAt instanceof Date);
        assert.equal(data.startsAt.toISOString(), '2026-08-03T08:00:00.000Z');
    });

    it('skriver null når slutt mangler', () => {
        const data = toFirestoreData({ ...input, endsAt: undefined }, 'a@entur.org');
        assert.equal(data.endsAt, null);
    });

    it('tar ikke med id, createdAt eller updatedAt', () => {
        const data = toFirestoreData({ ...input, id: 'abc' }, 'a@entur.org');
        assert.equal(data.id, undefined);
        assert.equal(data.createdAt, undefined);
        assert.equal(data.updatedAt, undefined);
    });
});
