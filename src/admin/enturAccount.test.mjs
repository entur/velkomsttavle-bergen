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

import { isVerifiedEnturUser, normalizeEmail } from './enturAccount.js';

describe('normalizeEmail', () => {
    it('lowercaser adressen', () => {
        assert.equal(normalizeEmail('Sturle@Entur.Org'), 'sturle@entur.org');
    });

    it('trimmer whitespace', () => {
        assert.equal(normalizeEmail('  sturle@entur.org  '), 'sturle@entur.org');
    });

    it('gir tom streng for manglende adresse', () => {
        assert.equal(normalizeEmail(undefined), '');
        assert.equal(normalizeEmail(null), '');
        assert.equal(normalizeEmail(42), '');
    });
});

describe('isVerifiedEnturUser', () => {
    it('godtar verifisert entur-konto', () => {
        assert.equal(isVerifiedEnturUser({ email: 'sturle@entur.org', emailVerified: true }), true);
    });

    it('avviser uverifisert entur-konto', () => {
        assert.equal(isVerifiedEnturUser({ email: 'sturle@entur.org', emailVerified: false }), false);
    });

    it('avviser konto uten emailVerified-felt', () => {
        assert.equal(isVerifiedEnturUser({ email: 'sturle@entur.org' }), false);
    });

    it('avviser verifisert ikke-entur-konto', () => {
        assert.equal(isVerifiedEnturUser({ email: 'noen@gmail.com', emailVerified: true }), false);
    });

    it('avviser null', () => {
        assert.equal(isVerifiedEnturUser(null), false);
    });
});
