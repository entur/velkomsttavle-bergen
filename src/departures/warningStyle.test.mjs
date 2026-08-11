import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { colors } from '@entur/tokens';

import { SURFACES, surfacePalette } from '../boards/surfaces.js';
import { contrast } from '../testing/contrast.mjs';
import { warningStyle } from './warningStyle.js';

describe('warningStyle', () => {
    it('er lesbar på alle seks flatene tavla kan ha', () => {
        // Dette er hele poenget med modulen. Gul tekst er 1.10 mot lys
        // lavendel; uten denne testen kommer den feilen tilbake.
        for (const name of SURFACES) {
            const palette = surfacePalette(name);
            const style = warningStyle(palette.mode);
            const bak = style.backgroundColor === 'transparent'
                ? palette.background
                : style.backgroundColor;
            const maalt = contrast(style.color, bak);
            assert.ok(maalt >= 4.5, `${name}: kontrast ${maalt.toFixed(2)}, krever 4.5`);
        }
    });

    it('bruker gul tekst uten fyll i mørkt tema', () => {
        const style = warningStyle('dark');
        assert.equal(style.color, colors.validation.canary);
        assert.equal(style.backgroundColor, 'transparent');
        assert.equal(style.border, 'none');
    });

    it('bruker gult fyll med mørkeblå tekst og kant i lyst tema', () => {
        const style = warningStyle('light');
        assert.equal(style.backgroundColor, colors.validation.canary);
        assert.equal(style.color, colors.brand.blue);
        assert.ok(style.border.startsWith('2px'));
    });

    it('faller til den lyse varianten for ukjent modus', () => {
        // Fyll med mørk tekst er lesbart mot enhver flate. Gul tekst er det
        // ikke, så det er den lyse varianten som er den trygge standarden.
        for (const ukjent of [undefined, null, '', 'lilla']) {
            assert.equal(warningStyle(ukjent).backgroundColor, colors.validation.canary);
        }
    });
});
