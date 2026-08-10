import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { advance } from './rotation.mjs';

const TRE_SLIDES = { tick: 100, duration: 300, count: 3 };

describe('advance', () => {
    it('teller opp uten å bytte når tiden ikke er ute', () => {
        assert.deepEqual(
            advance({ elapsed: 0, index: 0 }, TRE_SLIDES),
            { elapsed: 100, index: 0 },
        );
    });

    it('bytter og nullstiller når tiden er ute', () => {
        assert.deepEqual(
            advance({ elapsed: 200, index: 0 }, TRE_SLIDES),
            { elapsed: 0, index: 1 },
        );
    });

    it('går rundt fra siste til første', () => {
        assert.deepEqual(
            advance({ elapsed: 200, index: 2 }, TRE_SLIDES),
            { elapsed: 0, index: 0 },
        );
    });

    // Én visning har ingenting å veksle til. Da skal heller ikke progress-baren
    // telle ned mot et bytte som aldri kommer — komponentene skjuler den når
    // count <= 1, og her fryses tilstanden slik at de kan stole på det.
    it('står stille med bare én visning', () => {
        assert.deepEqual(
            advance({ elapsed: 0, index: 0 }, { tick: 100, duration: 300, count: 1 }),
            { elapsed: 0, index: 0 },
        );
    });

    it('står stille uten visninger', () => {
        assert.deepEqual(
            advance({ elapsed: 250, index: 0 }, { tick: 100, duration: 300, count: 0 }),
            { elapsed: 0, index: 0 },
        );
    });

    // Tavla kan lagres i admin mens karusellen kjører, og lista kan bli kortere
    // midt i en runde. Uten dette ville slides[index] vært undefined.
    it('faller tilbake til første når indeksen er utenfor lista', () => {
        assert.deepEqual(
            advance({ elapsed: 100, index: 4 }, TRE_SLIDES),
            { elapsed: 0, index: 0 },
        );
    });

    it('bytter også når tick treffer varigheten nøyaktig', () => {
        assert.deepEqual(
            advance({ elapsed: 0, index: 0 }, { tick: 300, duration: 300, count: 2 }),
            { elapsed: 0, index: 1 },
        );
    });
});
