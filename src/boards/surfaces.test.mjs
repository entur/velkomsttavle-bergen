import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    DEFAULT_BOTTOM_SURFACE,
    DEFAULT_CAROUSEL_SURFACE,
    SURFACES,
    SURFACE_LABELS,
    surfacePalette,
} from './surfaces.js';
import { contrast } from '../testing/contrast.mjs';

describe('surfacePalette', () => {
    it('kjenner de seks flatene, med standarder som skiller stripa fra karusellen', () => {
        assert.deepEqual(SURFACES, [
            'morkebla', 'morkebla-lys', 'lavendel', 'lys-lavendel', 'hvit', 'fersken',
        ]);
        assert.equal(DEFAULT_CAROUSEL_SURFACE, 'lys-lavendel');
        assert.equal(DEFAULT_BOTTOM_SURFACE, 'morkebla');
        assert.notEqual(DEFAULT_CAROUSEL_SURFACE, DEFAULT_BOTTOM_SURFACE);
    });

    it('har en etikett for hver flate, og ingen til overs', () => {
        assert.deepEqual(Object.keys(SURFACE_LABELS).sort(), [...SURFACES].sort());
    });

    it('gir navnet tilbake, og faller til standarden for ukjent flate', () => {
        assert.equal(surfacePalette('fersken').name, 'fersken');
        assert.equal(surfacePalette('lilla').name, DEFAULT_CAROUSEL_SURFACE);
        assert.equal(surfacePalette(undefined).name, DEFAULT_CAROUSEL_SURFACE);
        assert.equal(surfacePalette(null).name, DEFAULT_CAROUSEL_SURFACE);
    });

    it('gir alle fargefeltene som gyldig hex, og en kjent modus', () => {
        for (const name of SURFACES) {
            const p = surfacePalette(name);
            for (const key of ['background', 'panel', 'text', 'accent']) {
                assert.match(p[key], /^#[0-9a-fA-F]{6}$/, `${name}.${key}`);
            }
            assert.ok(p.mode === 'dark' || p.mode === 'light', `${name}.mode`);
        }
    });

    it('gir alle flatene unik bakgrunn', () => {
        const backgrounds = SURFACES.map((name) => surfacePalette(name).background);
        assert.equal(new Set(backgrounds).size, SURFACES.length);
    });

    // Hele grunnen til at tabellen er en egen fil: en ny farge skal ikke kunne
    // snike inn uleselig tekst. Grensene er målt, ikke gjettet — laveste
    // faktiske verdi per rad står i speccen.
    it('gir teksten lesbar kontrast mot både bakgrunn og panel', () => {
        for (const name of SURFACES) {
            const p = surfacePalette(name);
            assert.ok(
                contrast(p.text, p.background) >= 4.5,
                `${name}: tekst mot bakgrunn er ${contrast(p.text, p.background).toFixed(2)}`,
            );
            assert.ok(
                contrast(p.text, p.panel) >= 4.5,
                `${name}: tekst mot panel er ${contrast(p.text, p.panel).toFixed(2)}`,
            );
        }
    });

    // Panelet er flaten Weather maler times- og dagskortene med. Er den for lik
    // bakgrunnen, forsvinner kortene — nøyaktig det som ville skjedd på
    // «fersken» hvis PEACH hadde blitt stående i Weather.jsx.
    it('gir panelet en synlig flate mot bakgrunnen', () => {
        for (const name of SURFACES) {
            const p = surfacePalette(name);
            assert.ok(
                contrast(p.panel, p.background) >= 1.2,
                `${name}: panel mot bakgrunn er ${contrast(p.panel, p.background).toFixed(2)}`,
            );
        }
    });

    it('gir progress-baren synlig kontrast mot alle bakgrunner', () => {
        for (const name of SURFACES) {
            const p = surfacePalette(name);
            assert.ok(
                contrast(p.accent, p.background) >= 1.5,
                `${name}: accent mot bakgrunn er ${contrast(p.accent, p.background).toFixed(2)}`,
            );
        }
    });

    /**
     * Tavla kjører på en Samsung-skjerm med Tizen, ikke i Chrome. Motoren der er
     * flere år gammel, og `Object.hasOwn` (ES2022, Chromium 93+) finnes ikke.
     *
     * Denne funksjonen kalles fra `App` sin komponentkropp, utenfor enhver
     * ErrorBoundary, så et kast her river ned hele React-treet og gir en helt
     * hvit skjerm i resepsjonen. Testen kjører funksjonen under nøyaktig den
     * betingelsen enheten har.
     */
    it('virker på en motor uten Object.hasOwn', () => {
        const original = Object.hasOwn;
        delete Object.hasOwn;
        try {
            assert.equal(surfacePalette('fersken').name, 'fersken');
            assert.equal(surfacePalette('morkebla').name, 'morkebla');
            assert.equal(surfacePalette('lilla').name, DEFAULT_CAROUSEL_SURFACE);
            assert.equal(surfacePalette(undefined).name, DEFAULT_CAROUSEL_SURFACE);
        } finally {
            Object.hasOwn = original;
        }
    });
});
