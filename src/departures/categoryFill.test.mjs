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
        // I lyst tema er fyllet bare 2.1–3.4 mot lavendel og fersken, så
        // formen forsvinner uten kant. I mørkt tema er det 4.3–7.4.
        assert.ok(categoryFill('L4', 'light').border.startsWith('2px'));
        assert.equal(categoryFill('L4', 'dark').border, 'none');
    });
});
