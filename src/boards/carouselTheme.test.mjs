import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CAROUSEL_THEMES, DEFAULT_CAROUSEL_THEME, carouselPalette } from './carouselTheme.js';

/** WCAG-kontrast mellom to hex-farger. */
function contrast(a, b) {
    const lum = (hex) => {
        const c = hex.replace('#', '').match(/../g)
            .map((x) => parseInt(x, 16) / 255)
            .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const [l1, l2] = [lum(a), lum(b)];
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

describe('carouselPalette', () => {
    it('kjenner to temaer, med lyst som standard', () => {
        assert.deepEqual(CAROUSEL_THEMES, ['light', 'dark']);
        assert.equal(DEFAULT_CAROUSEL_THEME, 'light');
    });

    it('gir ulik bakgrunn for de to temaene', () => {
        assert.notEqual(carouselPalette('light').background, carouselPalette('dark').background);
    });

    it('faller tilbake til lyst for ukjent tema', () => {
        assert.deepEqual(carouselPalette('lilla'), carouselPalette('light'));
        assert.deepEqual(carouselPalette(undefined), carouselPalette('light'));
    });

    it('gir alle fargene som en palett skal ha', () => {
        for (const theme of CAROUSEL_THEMES) {
            const p = carouselPalette(theme);
            for (const key of ['background', 'panel', 'text', 'iconActive', 'iconInactive']) {
                assert.match(p[key], /^#[0-9a-fA-F]{6}$/, `${theme}.${key}`);
            }
        }
    });

    // Dette er hele grunnen til at temaarbeidet ble tatt med: dagens inaktive
    // ikon er hvitt på lavendel, kontrast 1.39. Testen låser rettelsen.
    it('gir inaktive ikoner lesbar kontrast mot bakgrunnen i begge temaer', () => {
        for (const theme of CAROUSEL_THEMES) {
            const p = carouselPalette(theme);
            assert.ok(
                contrast(p.iconInactive, p.background) >= 4.5,
                `${theme}: inaktivt ikon har kontrast ${contrast(p.iconInactive, p.background).toFixed(2)}`,
            );
        }
    });

    it('gir teksten lesbar kontrast mot bakgrunnen i begge temaer', () => {
        for (const theme of CAROUSEL_THEMES) {
            const p = carouselPalette(theme);
            assert.ok(contrast(p.text, p.background) >= 4.5, theme);
        }
    });

    it('gir panelet en flate som skiller seg fra bakgrunnen', () => {
        for (const theme of CAROUSEL_THEMES) {
            const p = carouselPalette(theme);
            assert.notEqual(p.panel, p.background, theme);
        }
    });
});
