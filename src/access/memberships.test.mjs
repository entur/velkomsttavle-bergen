import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    BOARDS_PER_USER_MAX,
    addBoard,
    isLastMember,
    normalizeBoards,
    removeBoard,
    validateGranteeEmail,
} from './memberships.js';

describe('normalizeBoards', () => {
    it('beholder gyldige id-er', () => {
        assert.deepEqual(normalizeBoards(['bergen-3', 'billettkontor-bergen']), ['bergen-3', 'billettkontor-bergen']);
    });

    it('kaster ugyldige id-er og duplikater', () => {
        assert.deepEqual(normalizeBoards(['bergen-3', 'Bergen-3', 'bergen-3', 42, null]), ['bergen-3']);
    });

    it('tåler noe annet enn en liste', () => {
        assert.deepEqual(normalizeBoards(undefined), []);
        assert.deepEqual(normalizeBoards('bergen-3'), []);
    });

    it('håndhever taket', () => {
        const mange = Array.from({ length: BOARDS_PER_USER_MAX + 5 }, (_, i) => `tavle-${i}`);
        assert.equal(normalizeBoards(mange).length, BOARDS_PER_USER_MAX);
    });
});

describe('addBoard', () => {
    it('legger til uten å lage duplikat', () => {
        assert.deepEqual(addBoard(['bergen-3'], 'oslo-1'), ['bergen-3', 'oslo-1']);
        assert.deepEqual(addBoard(['bergen-3'], 'bergen-3'), ['bergen-3']);
    });

    it('nekter en ugyldig id', () => {
        assert.deepEqual(addBoard(['bergen-3'], 'Ugyldig'), ['bergen-3']);
    });

    it('endrer ikke lista som ble sendt inn', () => {
        const original = ['bergen-3'];
        addBoard(original, 'oslo-1');
        assert.deepEqual(original, ['bergen-3']);
    });
});

describe('removeBoard', () => {
    it('fjerner id-en og lar resten stå', () => {
        assert.deepEqual(removeBoard(['bergen-3', 'oslo-1'], 'bergen-3'), ['oslo-1']);
    });

    it('tåler en id som ikke er der', () => {
        assert.deepEqual(removeBoard(['bergen-3'], 'oslo-1'), ['bergen-3']);
    });
});

describe('validateGranteeEmail', () => {
    it('godtar en Entur-adresse som ikke har tilgang fra før', () => {
        assert.equal(validateGranteeEmail('Ola.Nordmann@Entur.org', ['kari@entur.org']), null);
    });

    it('krever en adresse', () => {
        assert.equal(validateGranteeEmail('  ', []), 'Skriv en e-postadresse');
    });

    it('avviser adresser utenfor entur.org', () => {
        assert.equal(validateGranteeEmail('ola@example.com', []), 'Adressen må være en @entur.org-adresse');
        assert.equal(validateGranteeEmail('ola@entur.org.example.com', []), 'Adressen må være en @entur.org-adresse');
    });

    it('sier fra når personen allerede har tilgang, uansett skrivemåte', () => {
        assert.equal(validateGranteeEmail('Kari@Entur.org', ['kari@entur.org']), 'Kari@Entur.org har allerede tilgang');
    });
});

describe('isLastMember', () => {
    it('er sann bare når du er den eneste igjen', () => {
        assert.equal(isLastMember(['ola@entur.org'], 'ola@entur.org'), true);
        assert.equal(isLastMember(['ola@entur.org', 'kari@entur.org'], 'ola@entur.org'), false);
        assert.equal(isLastMember(['kari@entur.org'], 'ola@entur.org'), false);
    });

    it('sammenlikner på normalisert form', () => {
        assert.equal(isLastMember(['Ola@Entur.org'], 'ola@entur.org'), true);
    });
});
