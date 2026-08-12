import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { logoSrcFor } from './boardTheme.js';

describe('logoSrcFor', () => {
    it('gir den hvite og korale logoen på mørke flater', () => {
        assert.equal(logoSrcFor('dark'), '/logo.svg');
    });

    it('gir den fargede logoen på lyse flater', () => {
        assert.equal(logoSrcFor('light'), '/logo-on-light.svg');
    });

    // surfacePalette gir alltid 'dark' eller 'light', så dette skjer ikke i
    // praksis. Standarden er likevel den mørke, slik tavlene så ut før valget
    // fantes.
    it('faller på den mørke logoen for en ukjent modus', () => {
        assert.equal(logoSrcFor(undefined), '/logo.svg');
        assert.equal(logoSrcFor('lilla'), '/logo.svg');
    });
});
