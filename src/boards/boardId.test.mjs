import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BOARD_ID_MAX_LENGTH, isValidBoardId, suggestBoardId } from './boardId.js';
import { parseRoute } from '../routing/parseRoute.js';

describe('suggestBoardId', () => {
    it('gjør et navn om til en slug', () => {
        assert.equal(suggestBoardId('Bergen 3. etasje'), 'bergen-3-etasje');
        assert.equal(suggestBoardId('Billettkontor Bergen'), 'billettkontor-bergen');
    });

    it('skriver om norske bokstaver framfor å kaste dem', () => {
        assert.equal(suggestBoardId('Tøyen'), 'toeyen');
        assert.equal(suggestBoardId('Ålesund'), 'aalesund');
        assert.equal(suggestBoardId('Værnes'), 'vaernes');
    });

    it('slår sammen skilletegn og trimmer kantene', () => {
        assert.equal(suggestBoardId('  Oslo –– S  '), 'oslo-s');
        assert.equal(suggestBoardId('A/B & C'), 'a-b-c');
    });

    it('klipper til maksimallengden uten å ende på bindestrek', () => {
        const id = suggestBoardId('a'.repeat(80));
        assert.equal(id.length, BOARD_ID_MAX_LENGTH);
        assert.equal(id.endsWith('-'), false);
    });

    it('gir tom streng når det ikke er noe brukbart igjen', () => {
        assert.equal(suggestBoardId('///'), '');
        assert.equal(suggestBoardId(''), '');
        assert.equal(suggestBoardId(null), '');
    });
});

describe('isValidBoardId', () => {
    it('godtar små bokstaver, tall og enkle bindestreker', () => {
        assert.equal(isValidBoardId('bergen-3'), true);
        assert.equal(isValidBoardId('a'), true);
        assert.equal(isValidBoardId('billettkontor-bergen'), true);
    });

    it('avviser store bokstaver, mellomrom og understrek', () => {
        assert.equal(isValidBoardId('Bergen-3'), false);
        assert.equal(isValidBoardId('bergen 3'), false);
        assert.equal(isValidBoardId('bergen_3'), false);
    });

    it('avviser bindestrek i kantene og doble bindestreker', () => {
        assert.equal(isValidBoardId('-bergen'), false);
        assert.equal(isValidBoardId('bergen-'), false);
        assert.equal(isValidBoardId('bergen--3'), false);
    });

    it('avviser tomt og for langt', () => {
        assert.equal(isValidBoardId(''), false);
        assert.equal(isValidBoardId('a'.repeat(BOARD_ID_MAX_LENGTH + 1)), false);
        assert.equal(isValidBoardId(null), false);
    });

    it('godtar alt suggestBoardId lager som ikke er tomt', () => {
        for (const navn of ['Bergen 3. etasje', 'Tøyen', 'A/B & C', 'a'.repeat(80)]) {
            assert.equal(isValidBoardId(suggestBoardId(navn)), true, navn);
        }
    });

    it('lager en id parseRoute faktisk finner igjen', () => {
        // Tegnsettet her må stemme med regexen i parseRoute, ellers peker
        // skjermen på en adresse appen svarer «ukjent adresse» på.
        for (const navn of ['Bergen 3. etasje', 'Tøyen', 'Billettkontor Bergen']) {
            assert.equal(parseRoute(`/t/${suggestBoardId(navn)}`).kind, 'board', navn);
        }
    });
});
