import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    DAY_KEYS,
    formatOpeningHours,
    isTimeOfDay,
    normalizeDays,
} from './openingHours.js';

describe('normalizeDays', () => {
    it('gir alltid sju dager i ukerekkefølge', () => {
        const days = normalizeDays(undefined);
        assert.equal(days.length, 7);
        assert.deepEqual(days.map((d) => d.day), DAY_KEYS);
    });

    it('lar dager som mangler være stengt', () => {
        const days = normalizeDays([{ day: 'mon', opens: '08:00', closes: '16:00' }]);
        assert.deepEqual(days[0], { day: 'mon', closed: false, opens: '08:00', closes: '16:00' });
        assert.deepEqual(days[1], { day: 'tue', closed: true });
    });

    it('respekterer closed selv om tidene står der', () => {
        const days = normalizeDays([{ day: 'mon', closed: true, opens: '08:00', closes: '16:00' }]);
        assert.deepEqual(days[0], { day: 'mon', closed: true });
    });

    it('stenger dagen når et klokkeslett er ugyldig', () => {
        const days = normalizeDays([
            { day: 'mon', opens: '8:00', closes: '16:00' },
            { day: 'tue', opens: '08:00', closes: '25:00' },
            { day: 'wed', opens: '08:00' },
        ]);
        assert.equal(days[0].closed, true);
        assert.equal(days[1].closed, true);
        assert.equal(days[2].closed, true);
    });

    it('stenger dagen når den lukker før eller samtidig som den åpner', () => {
        const days = normalizeDays([
            { day: 'mon', opens: '16:00', closes: '08:00' },
            { day: 'tue', opens: '08:00', closes: '08:00' },
        ]);
        assert.equal(days[0].closed, true);
        assert.equal(days[1].closed, true);
    });

    it('tåler noe annet enn en liste', () => {
        assert.equal(normalizeDays('mandag 8-16').length, 7);
        assert.equal(normalizeDays(null).every((d) => d.closed), true);
    });
});

describe('formatOpeningHours', () => {
    it('skriver ut norsk dagsnavn og tidsrom', () => {
        const rows = formatOpeningHours(normalizeDays([
            { day: 'mon', opens: '08:00', closes: '16:00' },
        ]));
        assert.deepEqual(rows[0], { key: 'mon', label: 'Mandag', value: '08:00–16:00' });
    });

    it('slår sammen mandag til fredag når de er like', () => {
        const rows = formatOpeningHours(normalizeDays(
            ['mon', 'tue', 'wed', 'thu', 'fri'].map((day) => ({ day, opens: '08:00', closes: '16:00' })),
        ));
        assert.deepEqual(rows, [
            { key: 'mon', label: 'Mandag–Fredag', value: '08:00–16:00' },
            { key: 'sat', label: 'Lørdag–Søndag', value: 'Stengt' },
        ]);
    });

    it('skiller ut dagen som har andre tider', () => {
        const rows = formatOpeningHours(normalizeDays([
            ...['mon', 'tue', 'wed', 'thu'].map((day) => ({ day, opens: '08:00', closes: '16:00' })),
            { day: 'fri', opens: '08:00', closes: '14:00' },
        ]));
        assert.deepEqual(rows.map((row) => row.label), ['Mandag–Torsdag', 'Fredag', 'Lørdag–Søndag']);
        assert.equal(rows[1].value, '08:00–14:00');
    });

    it('gir én rad når hele uka er lik', () => {
        const rows = formatOpeningHours(normalizeDays([]));
        assert.deepEqual(rows, [{ key: 'mon', label: 'Mandag–Søndag', value: 'Stengt' }]);
    });

    it('slår ikke sammen dager som ikke ligger inntil hverandre', () => {
        const rows = formatOpeningHours(normalizeDays([
            { day: 'mon', opens: '08:00', closes: '16:00' },
            { day: 'wed', opens: '08:00', closes: '16:00' },
        ]));
        assert.deepEqual(rows.map((row) => row.label), ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag–Søndag']);
    });
});

describe('isTimeOfDay', () => {
    it('godtar HH:MM i døgnet', () => {
        assert.equal(isTimeOfDay('00:00'), true);
        assert.equal(isTimeOfDay('23:59'), true);
    });

    it('avviser alt annet', () => {
        assert.equal(isTimeOfDay('24:00'), false);
        assert.equal(isTimeOfDay('8:00'), false);
        assert.equal(isTimeOfDay('08:60'), false);
        assert.equal(isTimeOfDay(''), false);
        assert.equal(isTimeOfDay(800), false);
    });
});
