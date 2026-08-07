import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { colors, transport } from '@entur/tokens';

import { lineAppearance } from './lineAppearance.js';

describe('lineAppearance — togkategori', () => {
    it('gir lokaltog grønt, regiontog rødt og fjerntog blått i lyst tema', () => {
        assert.equal(lineAppearance('L4', 'rail', 'light').fill, colors.validation.mint);
        assert.equal(lineAppearance('R40', 'rail', 'light').fill, colors.validation.lava);
        assert.equal(lineAppearance('F4', 'rail', 'light').fill, colors.validation.sky);
    });

    it('bruker kontrast-variantene i mørkt tema', () => {
        assert.equal(lineAppearance('L4', 'rail', 'dark').fill, colors.validation.mintContrast);
        assert.equal(lineAppearance('R40', 'rail', 'dark').fill, colors.validation.lavaContrast);
        assert.equal(lineAppearance('F4', 'rail', 'dark').fill, colors.validation.skyContrast);
    });

    it('godtar liten forbokstav', () => {
        assert.equal(lineAppearance('l4', 'rail', 'light').fill, colors.validation.mint);
    });

    it('krever tall etter kategoribokstaven', () => {
        // «Lillestrøm» er ikke en L-kategori. Uten denne sjekken ville enhver
        // linje som tilfeldigvis begynner på L blitt grønn.
        assert.equal(lineAppearance('Lillestrøm', 'bus', 'light').fill, transport.standard.bus);
        assert.equal(lineAppearance('RE', 'rail', 'light').fill, transport.standard.rail ?? colors.brand.blue);
    });
});

describe('lineAppearance — fallback på transportmiddel', () => {
    it('bruker Enturs transportpalett for linjer uten kategori', () => {
        assert.equal(lineAppearance('51', 'bus', 'light').fill, transport.standard.bus);
        assert.equal(lineAppearance('2', 'tram', 'light').fill, transport.standard.tram);
        assert.equal(lineAppearance('51', 'bus', 'dark').fill, transport.contrast.bus);
    });

    it('faller til en nøytral farge for ukjent transportmiddel', () => {
        const lys = lineAppearance('51', 'hyperloop', 'light');
        const mork = lineAppearance('51', 'hyperloop', 'dark');
        assert.match(lys.fill, /^#[0-9a-fA-F]{6}$/);
        assert.match(mork.fill, /^#[0-9a-fA-F]{6}$/);
        // Den nøytrale i mørkt tema kan ikke være selve bakgrunnen, ellers
        // forsvinner merket.
        assert.notEqual(mork.fill.toLowerCase(), colors.brand.blue.toLowerCase());
    });

    it('tåler at linjekode eller transportmiddel mangler', () => {
        assert.match(lineAppearance(undefined, undefined, 'light').fill, /^#[0-9a-fA-F]{6}$/);
        assert.match(lineAppearance('', null, 'dark').fill, /^#[0-9a-fA-F]{6}$/);
    });
});

describe('lineAppearance — tekst og kant', () => {
    it('setter hvit tekst i lyst tema og mørkeblå i mørkt', () => {
        assert.equal(lineAppearance('L4', 'rail', 'light').text, '#ffffff');
        assert.equal(lineAppearance('L4', 'rail', 'dark').text, colors.brand.blue);
    });

    it('har kant bare i lyst tema', () => {
        // I lyst tema ligger tre av fyllfargene for nær lavendel i lyshet til
        // at formen leses. I mørkt tema er alle over 6.8 og trenger ingen kant.
        assert.ok(lineAppearance('L4', 'rail', 'light').border.startsWith('2px'));
        assert.equal(lineAppearance('L4', 'rail', 'dark').border, 'none');
    });
});
