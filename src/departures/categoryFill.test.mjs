import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { colors } from '@entur/tokens';

import { badgeText, categoryFill } from './categoryFill.js';

describe('categoryFill — togkategori', () => {
    it('gir lokaltog grønt, regiontog rødt og fjerntog blått i lyst tema', () => {
        assert.equal(categoryFill('L4', 'light').background, colors.validation.mint);
        assert.equal(categoryFill('R40', 'light').background, colors.validation.lava);
        assert.equal(categoryFill('F4', 'light').background, colors.validation.sky);
    });

    it('bruker kontrast-variantene i mørkt tema', () => {
        assert.equal(categoryFill('L4', 'dark').background, colors.validation.mintContrast);
        assert.equal(categoryFill('R40', 'dark').background, colors.validation.lavaContrast);
        assert.equal(categoryFill('F4', 'dark').background, colors.validation.skyContrast);
    });

    it('godtar liten forbokstav', () => {
        assert.equal(categoryFill('l4', 'light').background, colors.validation.mint);
    });
});

describe('categoryFill — når TravelTag skal fargelegge selv', () => {
    it('gir null for linjer uten kategorikode', () => {
        // «Lillestrøm» er ikke en L-kategori. Uten tallkravet ville enhver
        // linje som tilfeldigvis begynner på L blitt grønn.
        assert.equal(categoryFill('Lillestrøm', 'light'), null);
        assert.equal(categoryFill('RE', 'light'), null);
        assert.equal(categoryFill('51', 'light'), null);
        assert.equal(categoryFill('2', 'dark'), null);
    });

    it('gir null når linjekoden mangler eller ikke er en streng', () => {
        assert.equal(categoryFill(undefined, 'light'), null);
        assert.equal(categoryFill(null, 'dark'), null);
        assert.equal(categoryFill('', 'light'), null);
        assert.equal(categoryFill(4, 'light'), null);
    });
});

describe('badgeText', () => {
    it('setter hvit tekst i lyst tema og mørkeblå i mørkt', () => {
        assert.equal(badgeText('light'), '#ffffff');
        assert.equal(badgeText('dark'), colors.brand.blue);
    });

    it('gir den lyse varianten for ukjent modus', () => {
        assert.equal(badgeText(undefined), '#ffffff');
        assert.equal(badgeText('lilla'), '#ffffff');
    });
});

describe('categoryFill — kant', () => {
    it('har kant bare i lyst tema', () => {
        // I lyst tema er fyllet 2.10–3.84 mot lavendel, lys-lavendel og
        // fersken — på eller under 3.0 for de fleste, så formen forsvinner
        // uten kant. Mot hvit er det 4.13–5.33, der kanten strengt tatt ikke
        // er nødvendig, men beholdes for at merket skal se likt ut på alle
        // lyse flater. I mørkt tema er det 4.3–7.4 og trenger ingen.
        assert.ok(categoryFill('L4', 'light').border.startsWith('2px'));
        assert.equal(categoryFill('L4', 'dark').border, 'none');
    });
});
