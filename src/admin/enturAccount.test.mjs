import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isEnturUser } from './enturAccount.js';

describe('isEnturUser', () => {
    it('godtar en entur.org-adresse', () => {
        assert.equal(isEnturUser({ email: 'sturle@entur.org' }), true);
    });

    it('godtar store bokstaver', () => {
        assert.equal(isEnturUser({ email: 'STURLE@ENTUR.ORG' }), true);
    });

    it('avviser et domene som bare slutter likt', () => {
        assert.equal(isEnturUser({ email: 'noen@ikkeentur.org' }), false);
    });

    it('avviser entur.org som subdomene i et annet domene', () => {
        assert.equal(isEnturUser({ email: 'noen@entur.org.example.com' }), false);
    });

    it('avviser et subdomene under entur.org', () => {
        assert.equal(isEnturUser({ email: 'noen@intern.entur.org' }), false);
    });

    it('avviser andre domener', () => {
        assert.equal(isEnturUser({ email: 'noen@gmail.com' }), false);
    });

    it('avviser bruker uten e-post', () => {
        assert.equal(isEnturUser({}), false);
    });

    it('avviser null og undefined', () => {
        assert.equal(isEnturUser(null), false);
        assert.equal(isEnturUser(undefined), false);
    });
});
