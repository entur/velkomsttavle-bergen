import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bandTheme } from './boardTheme.js';

describe('bandTheme', () => {
    it('gir mørkeblått felt med hvit logo', () => {
        assert.deepEqual(bandTheme('dark'), {
            background: '#181c56',
            color: '#ffffff',
            logoSrc: '/logo.svg',
            contrast: true,
        });
    });

    it('gir lavendel felt med farget logo og Entur-blå tekst', () => {
        assert.deepEqual(bandTheme('light'), {
            background: '#aeb7e2',
            color: '#181c56',
            logoSrc: '/logo-on-light.svg',
            contrast: false,
        });
    });

    it('faller på det mørke temaet når verdien er ukjent eller mangler', () => {
        assert.deepEqual(bandTheme('lilla'), bandTheme('dark'));
        assert.deepEqual(bandTheme(undefined), bandTheme('dark'));
    });

    it('bruker ikke karusellens lysere lavendel', () => {
        assert.notEqual(bandTheme('light').background, '#d9dae8');
    });
});
