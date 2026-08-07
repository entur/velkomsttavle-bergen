import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { COUNTDOWN_THRESHOLD_MINUTES, countdownLabel, minutesUntil } from './departureCountdown.js';

const NA = new Date('2026-08-07T10:23:00Z');

function om(minutter) {
    return new Date(NA.getTime() + minutter * 60000);
}

describe('minutesUntil', () => {
    it('teller hele minutter fram', () => {
        assert.equal(minutesUntil(om(4), NA), 4);
        assert.equal(minutesUntil(om(0), NA), 0);
    });

    it('runder ned, så «om 4 min» ikke blir 5 for tidlig', () => {
        assert.equal(minutesUntil(new Date(NA.getTime() + 4 * 60000 + 59000), NA), 4);
    });

    it('gir negative tall for avganger som er passert', () => {
        assert.equal(minutesUntil(om(-3), NA), -3);
    });

    it('gir null for noe som ikke er en brukbar dato', () => {
        assert.equal(minutesUntil(null, NA), null);
        assert.equal(minutesUntil(new Date('tull'), NA), null);
        assert.equal(minutesUntil('2026-08-07T10:27:00Z', NA), null);
    });
});

describe('countdownLabel', () => {
    it('teller ned under grensen', () => {
        assert.equal(countdownLabel(om(4), NA), 'om 4 min');
        assert.equal(countdownLabel(om(13), NA), 'om 13 min');
    });

    it('tar med grensen selv', () => {
        assert.equal(countdownLabel(om(COUNTDOWN_THRESHOLD_MINUTES), NA), 'om 20 min');
    });

    it('gir null over grensen — da skal klokkeslettet stå alene', () => {
        assert.equal(countdownLabel(om(COUNTDOWN_THRESHOLD_MINUTES + 1), NA), null);
        assert.equal(countdownLabel(om(94), NA), null);
    });

    it('sier «nå» når det er null minutter igjen', () => {
        assert.equal(countdownLabel(om(0), NA), 'nå');
    });

    it('gir null for avganger som er passert, framfor negative minutter', () => {
        assert.equal(countdownLabel(om(-1), NA), null);
    });

    it('gir null for ubrukelig dato', () => {
        assert.equal(countdownLabel(undefined, NA), null);
    });
});
