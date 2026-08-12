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
            for (const key of ['background', 'text', 'accent']) {
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
    // snike inn uleselig tekst. Grensene er målt, ikke gjettet.
    //
    // Bakgrunnen er den eneste flaten som finnes nå — værmodulene mistet
    // panelkortene sine, så all tekst i dem står rett på den.
    it('gir teksten lesbar kontrast mot bakgrunnen', () => {
        for (const name of SURFACES) {
            const p = surfacePalette(name);
            assert.ok(
                contrast(p.text, p.background) >= 4.5,
                `${name}: tekst mot bakgrunn er ${contrast(p.text, p.background).toFixed(2)}`,
            );
        }
    });

    // Grensen er 1.5, ikke 4.5, og det er hele poenget: accent er en stripe som
    // skal ses, ikke tekst som skal leses. Korall er 1.56 mot lavendel, så den
    // tåler ikke å bli tekstfarge — værets nedbørslabel var det siste stedet den
    // ble brukt slik, og den arver nå `text`.
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

// Resten av testene i denne fila sjekker egenskaper (gyldig hex, unike
// bakgrunner, kontrast) — ingen av dem fester en konkret verdi. Det holder for
// fire av de seks flatene, men ikke for disse to: `morkebla` og `lavendel` er
// nettopp det gamle `theme`-feltet («dark» og «light») ble migrert til, og
// migreringen er lovet fargeidentisk. Et gammelt dokument som bare har
// `theme: 'light'` skal se nøyaktig ut som før oppgraderingen til `topSurface`/
// `middleSurface` — og det kravet kan bare festes med de faktiske fargene, ikke
// med en egenskap. Verdiene er de samme som `boardTheme.test.mjs` hadde før
// den fila ble erstattet.
describe('de to migrerte flatene holder fargen theme-feltet hadde', () => {
    it('morkebla er theme: dark sin gamle farge, mørkeblå bakgrunn med hvit tekst', () => {
        const p = surfacePalette('morkebla');
        assert.equal(p.background, '#181c56');
        assert.equal(p.text, '#ffffff');
    });

    it('lavendel er theme: light sin gamle farge, lavendel bakgrunn med Entur-blå tekst', () => {
        const p = surfacePalette('lavendel');
        assert.equal(p.background, '#aeb7e2');
        assert.equal(p.text, '#181c56');
    });

    it('lavendel er ikke karusellens lysere lys-lavendel', () => {
        // #d9dae8 er nøyaktig tokenet lys-lavendel bruker. Ville lavendel
        // pekt dit i stedet, ville hver tavle med bare theme: 'light' skiftet
        // farge — testen ovenfor fanger den konkrete verdien, denne fanger
        // forveksling med den nærliggende, feil flaten.
        assert.notEqual(surfacePalette('lavendel').background, '#d9dae8');
    });
});
