# Bunnstripe og konfigurerbare flatefarger — implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tavla får et fjerde felt nederst med egen modulliste og kompakt værvisning, og fargen på karusellen og stripa velges uavhengig fra seks navngitte flater.

**Architecture:** All ny logikk legges i rene moduler uten JSX (`surfaces.js`, `rotation.mjs`, `forecastViews.mjs`, `boardConfig.js`) som testes med `node --test`. Komponentene blir tynne og tar imot et ferdig `palette`-objekt i stedet for en tema-streng, fordi `Weather` nå rendres i to felt med hver sin flate. Firestore-dokumentet får `bottom`, `carouselSurface` og `bottomSurface`; gamle dokumenter migreres ved lesing, ikke med en batch-jobb.

**Tech Stack:** React 19, Vite 8, `@entur/tokens` / `@entur/form` / `@entur/typography`, Firebase Firestore, `node --test`, `@firebase/rules-unit-testing`.

**Spec:** `docs/superpowers/specs/2026-08-10-bunnstripe-og-flatefarger-design.md`

## Global Constraints

- **Språk:** all kode, kommentarer, commit-meldinger og brukertekst er på norsk bokmål. Kommentarer forklarer *hvorfor*, ikke *hva*.
- **Rene moduler:** alt under `src/boards/` og alle `.mjs`-filer skal være uten JSX og uten Firebase-import, slik at de kan kjøres av `node --test`.
- **Testkommandoer:** `npm test` (= `node --test`) for enhetstester. `npm run test:rules` for regeltester (krever Java + emulator). `npm run build` før PR.
- **`node --test` globber ikke `.spec.mjs`** — derfor heter regelfilen `firestore.rules.spec.mjs` og holdes utenfor `npm test`.
- **Flatenavn er ASCII-slugs uten æøå:** `morkebla`, `morkebla-lys`, `lavendel`, `lys-lavendel`, `hvit`, `fersken`. De lagres i Firestore og gjentas som literal liste i `firestore.rules`.
- **Fargeverdier hentes fra `@entur/tokens`**, aldri som hex-literal i komponentkode. Unntaket er `#ffffff` der tokenet er `colors.brand.white`.
- **Værpollingen i `App.jsx` må aldri få et objekt i `useEffect`-avhengighetene.** Bare `lat` og `lng` som tall. Et objekt gir nytt kall til api.met.no ved hver lagring i admin, og MET sine vilkår ber om det motsatte.
- **`MiddleBand` sin `justifyContent: 'flex-start'` og `overflow: 'hidden'` skal ikke røres.** Kommentaren over dem forklarer hvorfor feltet må klippes nedenfra.
- **Ingen komponenttester i dette repoet.** Det finnes ingen JSX-testoppsett. Logikk som skal testes, trekkes ut til `.mjs`; komponenter verifiseres med `npm run build` og i nettleseren.

---

## Filstruktur

**Nye filer**

| Fil | Ansvar |
|---|---|
| `src/boards/surfaces.js` | Flatetabellen: navn → `{ name, mode, background, panel, text, accent }` |
| `src/boards/surfaces.test.mjs` | Kontrastmåling av alle seks flater |
| `src/components/rotation.mjs` | Vekslingen mellom visninger, som ren regning |
| `src/components/rotation.test.mjs` | Test av vekslingen |
| `src/weather/forecastViews.mjs` | `nowSummary`, `hourlyForecast`, `dailyForecast` |
| `src/weather/forecastViews.test.mjs` | Test av avledningene |
| `src/components/ProgressBar.jsx` | 6px bar, delt av `Carousel` og `WeatherStripe` |
| `src/components/BottomBand.jsx` | Feltet nederst: bakgrunn + modulene i `bottom` |
| `src/components/WeatherStripe.jsx` | Kompakt vær: «nå» fast, høyre side veksler |

**Endrede filer**

| Fil | Endring |
|---|---|
| `src/boards/boardConfig.js` | `BOTTOM_TYPES`, `bottom`-normalisering, ett-sted-regelen, flatemigrering |
| `src/boards/boardValidation.js` | `SURFACES` i stedet for `CAROUSEL_THEMES`, `weatherPlacement` |
| `src/components/Carousel.jsx` | Tar `palette`, bruker `rotation.mjs` + `ProgressBar`, progress-bar-feilen fikses |
| `src/components/Weather.jsx` | Tar `palette`, bruker `forecastViews.mjs`, `PEACH` → `palette.panel` |
| `src/components/Departures.jsx` | Tar `palette` |
| `src/floorplan/OfficeMap.jsx` | Tar `palette` |
| `src/components/MiddleBand.jsx` | Ny prop `hasBottom`, ny høyderegel |
| `src/App.jsx` | Slår opp begge palettene, finner vær i `bottom` før `carousel`, rendrer `BottomBand` |
| `src/admin/BoardConfigForm.jsx` | Flateveljere, plassering av været, ny seksjon «Bunnstripa» |
| `firestore.rules` | `bottom`, `carouselSurface`, `bottomSurface` |
| `firestore.rules.spec.mjs` | Tester for de nye feltene |

**Slettede filer**

| Fil | Hvorfor |
|---|---|
| `src/boards/carouselTheme.js` | Erstattet av `surfaces.js` |
| `src/boards/carouselTheme.test.mjs` | Erstattet av `surfaces.test.mjs` |

---

### Task 1: Flatetabellen

**Files:**
- Create: `src/boards/surfaces.js`
- Test: `src/boards/surfaces.test.mjs`

**Interfaces:**
- Consumes: `@entur/tokens` (`base`, `colors`, `semantic`)
- Produces:
  - `SURFACES: string[]` — de seks navnene, i visningsrekkefølge
  - `SURFACE_LABELS: Record<string, string>` — navn → etikett for admin
  - `DEFAULT_CAROUSEL_SURFACE = 'lys-lavendel'`
  - `DEFAULT_BOTTOM_SURFACE = 'morkebla'`
  - `surfacePalette(name) → { name, mode, background, panel, text, accent }` der `mode` er `'dark' | 'light'` og de fire andre er hex-strenger

`carouselTheme.js` røres ikke i denne oppgaven. Den lever videre til Task 7, som er den siste som slutter å importere den.

- [ ] **Step 1: Skriv den feilende testen**

Opprett `src/boards/surfaces.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    DEFAULT_BOTTOM_SURFACE,
    DEFAULT_CAROUSEL_SURFACE,
    SURFACES,
    SURFACE_LABELS,
    surfacePalette,
} from './surfaces.js';

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
});
```

- [ ] **Step 2: Kjør testen og se at den feiler**

```bash
npm test -- src/boards/surfaces.test.mjs
```

Forventet: FAIL med `Cannot find module './surfaces.js'`.

- [ ] **Step 3: Skriv tabellen**

Opprett `src/boards/surfaces.js`:

```js
/**
 * Flatene et felt på tavla kan ha, som en lukket liste med målt kontrast.
 *
 * Uten JSX og uten Firebase-import, slik at fargene kan kontrastmåles med
 * `node --test`. Det er ikke pynt: karusellens inaktive ikon var en gang hvitt
 * på lavendel, kontrast 1.39, altså usynlig. Testen holder den feilen borte for
 * alle seks flatene på én gang.
 *
 * Navnene er ASCII-slugs uten æøå fordi de lagres som verdier i Firestore og
 * gjentas som literal liste i firestore.rules — regler kan ikke importere.
 * Endrer du listen her, endre den der også.
 *
 * `mode` er nøkkelen til at seks farger ble billig: Weather, Departures og
 * OfficeMap forgrener seg allerede på lys/mørk, og de forgreningene overlever
 * uendret når hver flate bærer sin egen modus.
 *
 * Paletten holder seg til flater, tekst og accent. Fargen på merkene —
 * linjemerket og avviks-brikkene — eies av `lineAppearance` og `Chip`, som
 * begge har sin egen logikk for fyll og tekst.
 */
import { base, colors, semantic } from '@entur/tokens';

/** Rekkefølgen her er rekkefølgen i nedtrekkslistene i admin. */
export const SURFACES = [
    'morkebla',
    'morkebla-lys',
    'lavendel',
    'lys-lavendel',
    'hvit',
    'fersken',
];

export const SURFACE_LABELS = {
    'morkebla': 'Mørk blå',
    'morkebla-lys': 'Mørk blå, lysere',
    'lavendel': 'Lavendel',
    'lys-lavendel': 'Lys lavendel',
    'hvit': 'Hvit',
    'fersken': 'Fersken',
};

/**
 * Standardene er ulike med vilje: stripa ligger inntil karusellen, og to felt
 * med samme farge ville lest som ett.
 */
export const DEFAULT_CAROUSEL_SURFACE = 'lys-lavendel';
export const DEFAULT_BOTTOM_SURFACE = 'morkebla';

const WHITE = colors.brand.white;
const BLUE = colors.brand.blue;
const CORAL = base.light.baseColors.shape.highlight;

const TABLE = {
    'morkebla': {
        mode: 'dark',
        background: base.light.baseColors.frame.contrast,
        panel: base.light.baseColors.frame.contrastalt,
    },
    'morkebla-lys': {
        mode: 'dark',
        background: base.light.baseColors.frame.contrastalt,
        // Panelet er mørkere enn bakgrunnen her, motsatt av de andre mørke
        // flatene. Retningen spiller ingen rolle; separasjonen gjør det.
        panel: base.light.baseColors.frame.contrastalt2,
    },
    'lavendel': {
        mode: 'light',
        background: colors.brand.lavender,
        panel: WHITE,
    },
    'lys-lavendel': {
        mode: 'light',
        background: semantic.fill.background.subdued.light,
        panel: WHITE,
    },
    'hvit': {
        mode: 'light',
        background: WHITE,
        panel: semantic.fill.background.subdued.light,
    },
    'fersken': {
        mode: 'light',
        background: colors.brand.peach,
        panel: WHITE,
    },
};

/** Ukjent navn gir karusellens standard, slik at en tullverdi ikke krasjer tavla. */
export function surfacePalette(name) {
    const key = Object.hasOwn(TABLE, name ?? '') ? name : DEFAULT_CAROUSEL_SURFACE;
    const { mode, background, panel } = TABLE[key];
    return {
        name: key,
        mode,
        background,
        panel,
        text: mode === 'dark' ? WHITE : BLUE,
        accent: CORAL,
    };
}
```

- [ ] **Step 4: Kjør testen og se at den passerer**

```bash
npm test -- src/boards/surfaces.test.mjs
```

Forventet: PASS, alle åtte testene.

Feiler en kontrasttest, er det tabellen som er feil, ikke grensen. Grensene er satt under de målte verdiene med margin — laveste faktiske er 8,0 for tekst, 1,28 for panel og 1,56 for accent.

- [ ] **Step 5: Commit**

```bash
git add src/boards/surfaces.js src/boards/surfaces.test.mjs
git commit -m "feat: flatetabell med seks navngitte farger og kontrasttest"
```

---

### Task 2: Vekslingen som ren funksjon

**Files:**
- Create: `src/components/rotation.mjs`
- Test: `src/components/rotation.test.mjs`

**Interfaces:**
- Consumes: ingenting
- Produces: `advance({ elapsed, index }, { tick, duration, count }) → { elapsed, index }`

Samme mønster som `playbackWatchdog.mjs` og `videoBlobLoader.mjs`: logikken i en ren `.mjs`, komponenten blir en tynn `useEffect` rundt den.

- [ ] **Step 1: Skriv den feilende testen**

Opprett `src/components/rotation.test.mjs`:

```js
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
            advance({ elapsed: 250, index: 0 }, { tick: 100, duration: 300, count: 1 }),
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
```

- [ ] **Step 2: Kjør testen og se at den feiler**

```bash
npm test -- src/components/rotation.test.mjs
```

Forventet: FAIL med `Cannot find module './rotation.mjs'`.

- [ ] **Step 3: Skriv funksjonen**

Opprett `src/components/rotation.mjs`:

```js
/**
 * Vekslingen mellom flere visninger, som ren regning.
 *
 * Ligger utenfor komponentene, uten React-import, slik at den kan testes med
 * `node --test` — samme grep som `playbackWatchdog.mjs`. Både karusellen og
 * bunnstripa er en `useEffect` med et intervall rundt denne funksjonen.
 *
 * @param {{ elapsed: number, index: number }} state Tilstanden nå
 * @param {{ tick: number, duration: number, count: number }} options
 *        `tick` er ms siden forrige kall, `duration` ms per visning,
 *        `count` antall visninger.
 * @returns {{ elapsed: number, index: number }} Neste tilstand
 */
export function advance({ elapsed, index }, { tick, duration, count }) {
    // Ingenting å veksle mellom. Tilstanden fryses, slik at komponentene trygt
    // kan skjule progress-baren på det samme vilkåret.
    if (count <= 1) {
        return { elapsed: 0, index: 0 };
    }
    // Lista kan ha krympet siden forrige tick — tavla kan lagres i admin mens
    // karusellen kjører. Uten dette peker index utenfor lista.
    if (index >= count) {
        return { elapsed: 0, index: 0 };
    }
    const next = elapsed + tick;
    if (next >= duration) {
        return { elapsed: 0, index: (index + 1) % count };
    }
    return { elapsed: next, index };
}
```

- [ ] **Step 4: Kjør testen og se at den passerer**

```bash
npm test -- src/components/rotation.test.mjs
```

Forventet: PASS, alle syv testene.

- [ ] **Step 5: Commit**

```bash
git add src/components/rotation.mjs src/components/rotation.test.mjs
git commit -m "feat: veksling mellom visninger som ren, testbar funksjon"
```

---

### Task 3: Værutregningene som ren modul

**Files:**
- Create: `src/weather/forecastViews.mjs`
- Test: `src/weather/forecastViews.test.mjs`

**Interfaces:**
- Consumes: ingenting
- Produces:
  - `nowSummary(timeseries) → { symbol, temperature, wind, precipitation } | null`
  - `hourlyForecast(timeseries, hours = 6) → [{ time, symbol, temperature, precipitation }]`
  - `dailyForecast(timeseries, days = 4, now = new Date()) → [{ date, weekday, max, min, symbol }]`

Logikken finnes allerede som lokal kode i `Weather.jsx` (`buildDailyForecast` på linje 24 og utpakkingen på linje 68–76). Denne oppgaven flytter den ut uendret, slik at `WeatherStripe` kan bruke det samme. `Weather.jsx` kobles om i Task 7.

`now` er en parameter og ikke `new Date()` inni funksjonen, slik at «hopp over resten av i dag»-regelen kan testes uten å vente til midnatt.

- [ ] **Step 1: Skriv den feilende testen**

Opprett `src/weather/forecastViews.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dailyForecast, hourlyForecast, nowSummary } from './forecastViews.mjs';

/** Én oppføring i timeseriene, med bare feltene modulen leser. */
function entry(time, { temp = 10, wind = 3, precip = 0, symbol = 'clearsky_day', next6 } = {}) {
    return {
        time,
        data: {
            instant: { details: { air_temperature: temp, wind_speed: wind } },
            next_1_hours: symbol === null
                ? undefined
                : { summary: { symbol_code: symbol }, details: { precipitation_amount: precip } },
            next_6_hours: next6 ? { summary: { symbol_code: next6 } } : undefined,
        },
    };
}

describe('nowSummary', () => {
    it('leser temperatur, vind, nedbør og symbol fra første oppføring', () => {
        const result = nowSummary([entry('2026-08-10T09:00:00Z', { temp: 18, wind: 4, precip: 0.5 })]);
        assert.deepEqual(result, {
            symbol: 'clearsky_day', temperature: 18, wind: 4, precipitation: 0.5,
        });
    });

    it('faller tilbake til seks-timers-symbolet når én time mangler', () => {
        const result = nowSummary([entry('2026-08-10T09:00:00Z', { symbol: null, next6: 'cloudy' })]);
        assert.equal(result.symbol, 'cloudy');
        // Nedbør ligger bare på next_1_hours. Uten den er 0 riktigere enn undefined:
        // stripa skal vise «0 mm», ikke et tomt felt.
        assert.equal(result.precipitation, 0);
    });

    it('gir null uten data', () => {
        assert.equal(nowSummary([]), null);
        assert.equal(nowSummary(undefined), null);
    });
});

describe('hourlyForecast', () => {
    it('hopper over inneværende time og gir så mange som bedt om', () => {
        const series = Array.from({ length: 10 }, (_, i) =>
            entry(`2026-08-10T${String(9 + i).padStart(2, '0')}:00:00Z`, { temp: i }));
        const result = hourlyForecast(series, 3);
        assert.equal(result.length, 3);
        assert.equal(result[0].time, '2026-08-10T10:00:00Z');
        assert.equal(result[0].temperature, 1);
    });

    it('gir tom liste når det bare finnes inneværende time', () => {
        assert.deepEqual(hourlyForecast([entry('2026-08-10T09:00:00Z')], 6), []);
    });
});

describe('dailyForecast', () => {
    const now = new Date('2026-08-10T09:00:00Z');

    it('hopper over resten av dagen now peker på', () => {
        const series = [
            entry('2026-08-10T12:00:00Z', { temp: 20 }),
            entry('2026-08-11T12:00:00Z', { temp: 15 }),
        ];
        const result = dailyForecast(series, 4, now);
        assert.equal(result.length, 1);
        assert.equal(result[0].max, 15);
    });

    it('gir min og max for hele dagen, og ukedagen på norsk', () => {
        const series = [
            entry('2026-08-11T06:00:00Z', { temp: 9 }),
            entry('2026-08-11T12:00:00Z', { temp: 21 }),
            entry('2026-08-11T18:00:00Z', { temp: 14 }),
        ];
        const [dag] = dailyForecast(series, 4, now);
        assert.equal(dag.min, 9);
        assert.equal(dag.max, 21);
        assert.equal(dag.weekday, 'tir');
    });

    it('respekterer antallet dager', () => {
        const series = Array.from({ length: 8 }, (_, i) =>
            entry(`2026-08-${String(11 + i).padStart(2, '0')}T12:00:00Z`));
        assert.equal(dailyForecast(series, 4, now).length, 4);
    });

    // Sent på kvelden finnes det bare data for i dag. Stripa faller da tilbake
    // til bare timesvisningen, og det er denne tomme lista som utløser det.
    it('gir tom liste når det bare finnes data for i dag', () => {
        assert.deepEqual(dailyForecast([entry('2026-08-10T23:00:00Z')], 4, now), []);
    });
});
```

- [ ] **Step 2: Kjør testen og se at den feiler**

```bash
npm test -- src/weather/forecastViews.test.mjs
```

Forventet: FAIL med `Cannot find module './forecastViews.mjs'`.

- [ ] **Step 3: Skriv modulen**

Opprett `src/weather/forecastViews.mjs`:

```js
/**
 * Avledningene begge værvisningene trenger: nå-kortet, timesstripa og dagsraden.
 *
 * Uten JSX og uten nettverk, slik at de kan testes med `node --test` — samme
 * grep som `playbackWatchdog.mjs`. Både `Weather` (karusellen) og
 * `WeatherStripe` (bunnstripa) leser de samme tre funksjonene, slik at
 * visningene ikke kan komme til å vise ulike tall for samme varsel.
 */

const WEEKDAYS = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];

/** Symbolet for en oppføring: én time først, ellers seks. */
function symbolOf(entry) {
    return entry.data.next_1_hours?.summary?.symbol_code
        || entry.data.next_6_hours?.summary?.symbol_code
        || null;
}

/**
 * Været akkurat nå, eller null når det ikke finnes data.
 *
 * Nedbør ligger bare på `next_1_hours`. Mangler den, er 0 riktigere enn
 * undefined: visningene skal vise «0 mm», ikke et tomt felt.
 */
export function nowSummary(timeseries) {
    const list = Array.isArray(timeseries) ? timeseries : [];
    const now = list[0];
    if (!now) {
        return null;
    }
    return {
        symbol: symbolOf(now),
        temperature: now.data.instant.details.air_temperature,
        wind: now.data.instant.details.wind_speed,
        precipitation: now.data.next_1_hours?.details?.precipitation_amount ?? 0,
    };
}

/** De neste timene. Inneværende time hoppes over — den dekkes av nå-kortet. */
export function hourlyForecast(timeseries, hours = 6) {
    const list = Array.isArray(timeseries) ? timeseries : [];
    return list.slice(1, 1 + hours).map((entry) => ({
        time: entry.time,
        symbol: symbolOf(entry),
        temperature: entry.data.instant.details.air_temperature,
        precipitation: entry.data.next_1_hours?.details?.precipitation_amount ?? 0,
    }));
}

/**
 * De neste dagene, gruppert per lokale dato.
 *
 * Resten av inneværende dag hoppes over — den dekkes av nå-kortet og
 * timesstripa. Sent på kvelden betyr det at lista kan bli tom, og visningene
 * må tåle det.
 *
 * `now` er en parameter og ikke `new Date()` her inne, slik at regelen over kan
 * testes uten å vente til midnatt.
 */
export function dailyForecast(timeseries, days = 4, now = new Date()) {
    const list = Array.isArray(timeseries) ? timeseries : [];
    const byDate = new Map();
    for (const entry of list) {
        const date = new Date(entry.time);
        const key = date.toDateString();
        if (!byDate.has(key)) {
            byDate.set(key, { date, entries: [] });
        }
        byDate.get(key).entries.push(entry);
    }

    const todayKey = now.toDateString();
    const result = [];
    for (const { date, entries } of byDate.values()) {
        if (date.toDateString() === todayKey) {
            continue;
        }
        const temps = entries.map((entry) => entry.data.instant.details.air_temperature);
        // Symbolet fra oppføringen nærmest kl. 12 representerer dagen bedre enn
        // den første, som ofte er natt.
        const midday = entries.reduce((best, entry) => (
            Math.abs(new Date(entry.time).getHours() - 12)
                < Math.abs(new Date(best.time).getHours() - 12) ? entry : best
        ));
        result.push({
            date,
            weekday: WEEKDAYS[date.getDay()],
            max: Math.max(...temps),
            min: Math.min(...temps),
            symbol: midday.data.next_6_hours?.summary?.symbol_code
                || midday.data.next_12_hours?.summary?.symbol_code
                || midday.data.next_1_hours?.summary?.symbol_code
                || null,
        });
        if (result.length >= days) {
            break;
        }
    }
    return result;
}
```

- [ ] **Step 4: Kjør testen og se at den passerer**

```bash
npm test -- src/weather/forecastViews.test.mjs
```

Forventet: PASS, alle ni testene.

- [ ] **Step 5: Commit**

```bash
git add src/weather/forecastViews.mjs src/weather/forecastViews.test.mjs
git commit -m "feat: værutregninger som ren, testbar modul"
```

---

### Task 4: Configmodellen

**Files:**
- Modify: `src/boards/boardConfig.js`
- Test: `src/boards/boardConfig.test.mjs`

**Interfaces:**
- Consumes: `SURFACES`, `DEFAULT_CAROUSEL_SURFACE`, `DEFAULT_BOTTOM_SURFACE` fra Task 1
- Produces:
  - `BOTTOM_TYPES = ['weather']`
  - `normalizeBoardConfig(id, data)` gir nå også `bottom: Array`, `carouselSurface: string`, `bottomSurface: string` — og ikke lenger `carouselTheme`
  - `toFirestoreBoard(config, userEmail)` skriver `bottom`, `carouselSurface`, `bottomSurface` og ikke lenger `carouselTheme`

`CAROUSEL_THEMES` og importen fra `carouselTheme.js` forsvinner fra denne fila. `boardValidation.js` importerer fortsatt `CAROUSEL_THEMES` derfra til Task 5 — `carouselTheme.js` slettes først i Task 7.

- [ ] **Step 1: Skriv de feilende testene**

Legg til i `src/boards/boardConfig.test.mjs` (behold alt som står der fra før, og legg til importene `BOTTOM_TYPES` fra `./boardConfig.js` øverst):

```js
describe('bunnstripa', () => {
    it('kjenner bare vær foreløpig', () => {
        assert.deepEqual(BOTTOM_TYPES, ['weather']);
    });

    it('normaliserer bottom som de andre listene', () => {
        const config = normalizeBoardConfig('x', {
            bottom: [{ type: 'weather', name: 'Bergen', lat: 60.4, lng: 5.3 }],
        });
        assert.deepEqual(config.bottom, [
            { type: 'weather', name: 'Bergen', lat: 60.4, lng: 5.3 },
        ]);
    });

    it('gir tom liste når feltet mangler', () => {
        assert.deepEqual(normalizeBoardConfig('x', {}).bottom, []);
    });

    it('kaster ukjente typer og vær uten koordinater', () => {
        const config = normalizeBoardConfig('x', {
            bottom: [
                { type: 'floorplan', plan: 'bergen-3' },
                { type: 'weather', name: 'Bergen' },
            ],
        });
        assert.deepEqual(config.bottom, []);
    });

    // Regelen «en modul bor ett sted» håndheves her, ikke bare i admin: et
    // dokument redigert for hånd i konsollet skal ikke kunne gi to værmoduler
    // og dermed to pollinger mot api.met.no.
    it('lar bottom vinne når været står begge steder', () => {
        const config = normalizeBoardConfig('x', {
            carousel: [
                { type: 'weather', name: 'Oslo', lat: 59.9, lng: 10.7 },
                { type: 'floorplan', plan: 'bergen-3' },
            ],
            bottom: [{ type: 'weather', name: 'Bergen', lat: 60.4, lng: 5.3 }],
        });
        assert.deepEqual(config.carousel, [{ type: 'floorplan', plan: 'bergen-3' }]);
        assert.equal(config.bottom.length, 1);
        assert.equal(config.bottom[0].name, 'Bergen');
    });
});

describe('flater', () => {
    it('leser flatenavnene når de finnes', () => {
        const config = normalizeBoardConfig('x', {
            carouselSurface: 'fersken',
            bottomSurface: 'hvit',
        });
        assert.equal(config.carouselSurface, 'fersken');
        assert.equal(config.bottomSurface, 'hvit');
    });

    it('migrerer fra carouselTheme begge veier', () => {
        assert.equal(
            normalizeBoardConfig('x', { carouselTheme: 'dark' }).carouselSurface,
            'morkebla',
        );
        assert.equal(
            normalizeBoardConfig('x', { carouselTheme: 'light' }).carouselSurface,
            'lys-lavendel',
        );
    });

    it('lar carouselSurface vinne over det gamle feltet', () => {
        const config = normalizeBoardConfig('x', {
            carouselTheme: 'dark',
            carouselSurface: 'fersken',
        });
        assert.equal(config.carouselSurface, 'fersken');
    });

    it('faller på standardene uten felt og for ukjent navn', () => {
        assert.equal(normalizeBoardConfig('x', {}).carouselSurface, 'lys-lavendel');
        assert.equal(normalizeBoardConfig('x', {}).bottomSurface, 'morkebla');
        assert.equal(
            normalizeBoardConfig('x', { carouselSurface: 'lilla' }).carouselSurface,
            'lys-lavendel',
        );
        assert.equal(
            normalizeBoardConfig('x', { bottomSurface: 'lilla' }).bottomSurface,
            'morkebla',
        );
    });

    it('slutter å eksponere carouselTheme', () => {
        assert.equal(normalizeBoardConfig('x', { carouselTheme: 'dark' }).carouselTheme, undefined);
    });
});

describe('toFirestoreBoard', () => {
    it('skriver de nye feltene og ikke det gamle', () => {
        const config = normalizeBoardConfig('x', {
            name: 'Tavla', placeName: 'Bergen', carouselTheme: 'dark',
            bottom: [{ type: 'weather', name: 'Bergen', lat: 60.4, lng: 5.3 }],
        });
        const document = toFirestoreBoard(config, 'ola@entur.org');
        assert.equal(document.carouselSurface, 'morkebla');
        assert.equal(document.bottomSurface, 'morkebla');
        assert.equal(document.bottom.length, 1);
        assert.equal('carouselTheme' in document, false);
    });
});
```

- [ ] **Step 2: Kjør testene og se at de feiler**

```bash
npm test -- src/boards/boardConfig.test.mjs
```

Forventet: FAIL — `BOTTOM_TYPES` er ikke eksportert, og `config.bottom` er `undefined`.

- [ ] **Step 3: Endre `boardConfig.js`**

Bytt importen på linje 14:

```js
import {
    DEFAULT_BOTTOM_SURFACE,
    DEFAULT_CAROUSEL_SURFACE,
    SURFACES,
} from './surfaces.js';
```

Legg til under `CAROUSEL_TYPES` (linje 28):

```js
/**
 * Bunnstripa rendrer disse typene eksplisitt i `BottomBand.jsx`, ikke ved å
 * iterere over listen. En ny type må derfor også legges inn der.
 *
 * Bare vær foreløpig. Plantegningen hører ikke hjemme her: kartet trenger
 * høyde, og etikettene blir ubrukelige på 20vh.
 */
export const BOTTOM_TYPES = ['weather'];
```

Bytt ut `carouselTheme`-linjene i `normalizeBoardConfig` (linje 56–60) med:

```js
        carouselSurface: carouselSurfaceFrom(source),
        bottomSurface: SURFACES.includes(source.bottomSurface)
            ? source.bottomSurface
            : DEFAULT_BOTTOM_SURFACE,
        middle: normalizeModules(source.middle, MIDDLE_TYPES, MIDDLE_NORMALIZERS),
        ...screenModules(source),
```

og legg til under `staffImageFrom`:

```js
/**
 * Flaten karusellen står på.
 *
 * Samme mønster som `staffImageFrom`: nytt felt først, gammel plassering som
 * fallback. Dokumenter skrevet før flatetabellen har `carouselTheme` med to
 * verdier, og skal se like ut etter oppgraderingen.
 */
const CAROUSEL_THEME_TO_SURFACE = { dark: 'morkebla', light: 'lys-lavendel' };

function carouselSurfaceFrom(source) {
    if (SURFACES.includes(source.carouselSurface)) {
        return source.carouselSurface;
    }
    return CAROUSEL_THEME_TO_SURFACE[source.carouselTheme] ?? DEFAULT_CAROUSEL_SURFACE;
}

/**
 * Karusellen og bunnstripa normaliseres sammen fordi de deler modulkatalog, og
 * fordi regelen «en modul bor ett sted» krever begge listene på én gang.
 *
 * `bottom` vinner. Regelen håndheves her og ikke bare i admin: et dokument
 * redigert for hånd i Firestore-konsollet skal ikke kunne gi to værmoduler, og
 * dermed to pollinger mot api.met.no.
 */
function screenModules(source) {
    const bottom = normalizeModules(source.bottom, BOTTOM_TYPES, MODULE_NORMALIZERS);
    const taken = new Set(bottom.map((module) => module.type));
    const carousel = normalizeModules(source.carousel, CAROUSEL_TYPES, MODULE_NORMALIZERS)
        .filter((module) => !taken.has(module.type));
    return { carousel, bottom };
}
```

Døp om `CAROUSEL_NORMALIZERS` til `MODULE_NORMALIZERS` (linje 114) — tabellen deles nå av begge listene — og bytt kommentaren over den til:

```js
/** Delt av karusellen og bunnstripa. Middle har sin egen tabell. */
```

Bytt `toFirestoreBoard` (linje 87–99):

```js
export function toFirestoreBoard(config, userEmail) {
    return {
        name: config.name.trim(),
        placeName: config.placeName.trim(),
        theme: config.theme,
        staffImage: config.staffImage,
        top: { kind: config.top.kind },
        carouselSurface: config.carouselSurface,
        bottomSurface: config.bottomSurface,
        middle: config.middle,
        carousel: config.carousel,
        bottom: config.bottom,
        updatedBy: userEmail,
    };
}
```

Merk: `saveBoardConfig` skriver med `{ merge: true }`, så `carouselTheme` blir liggende i gamle dokumenter. Det er greit — normaliseringen leser `carouselSurface` først. Konsekvensen for reglene håndteres i Task 6.

- [ ] **Step 4: Kjør testene og se at de passerer**

```bash
npm test -- src/boards/boardConfig.test.mjs
```

Forventet: PASS, både de nye og alle de gamle testene i fila.

- [ ] **Step 5: Kjør hele testsuiten**

```bash
npm test
```

Forventet: `boardValidation.test.mjs` kan feile, fordi validering av `carouselTheme` ikke lenger har et felt å se på. Det fikses i Task 5. Alt annet skal passere.

- [ ] **Step 6: Commit**

```bash
git add src/boards/boardConfig.js src/boards/boardConfig.test.mjs
git commit -m "feat: bottom-liste og flatefelt i configmodellen"
```

---

### Task 5: Valideringen

**Files:**
- Modify: `src/boards/boardValidation.js`
- Test: `src/boards/boardValidation.test.mjs`

**Interfaces:**
- Consumes: `SURFACES` fra Task 1
- Produces: `validateBoardInput(draft)` godtar nå `draft.weatherPlacement` (`'av' | 'karusell' | 'stripe'`), `draft.carouselSurface` og `draft.bottomSurface`

Skjemaet bytter fra `weatherEnabled: boolean` til `weatherPlacement`, fordi været nå kan stå to steder og bare ett av dem. Feltnavnet brukes av `BoardConfigForm` i Task 9.

- [ ] **Step 1: Skriv de feilende testene**

Legg til i `src/boards/boardValidation.test.mjs`:

```js
describe('flater og plassering av været', () => {
    /** Et minimalt gyldig utkast, slik at testene bare måler det de handler om. */
    function draft(overrides = {}) {
        return {
            name: 'Tavla',
            placeName: 'Bergen',
            weatherPlacement: 'av',
            carouselSurface: 'lys-lavendel',
            bottomSurface: 'morkebla',
            ...overrides,
        };
    }

    it('godtar et utkast uten vær', () => {
        assert.deepEqual(validateBoardInput(draft()), {});
    });

    it('krever sted og koordinater når været står i karusellen', () => {
        const errors = validateBoardInput(draft({ weatherPlacement: 'karusell' }));
        assert.ok(errors.weatherName);
        assert.ok(errors.weatherLat);
        assert.ok(errors.weatherLng);
    });

    // Samme krav uansett hvilket felt været står i: det er de samme
    // koordinatene som sendes til api.met.no.
    it('krever det samme når været står i stripa', () => {
        const errors = validateBoardInput(draft({ weatherPlacement: 'stripe' }));
        assert.ok(errors.weatherName);
        assert.ok(errors.weatherLat);
        assert.ok(errors.weatherLng);
    });

    it('godtar gyldige koordinater i begge feltene', () => {
        for (const placement of ['karusell', 'stripe']) {
            const errors = validateBoardInput(draft({
                weatherPlacement: placement,
                weatherName: 'Bergen',
                weatherLat: '60.39299',
                weatherLng: '5.32415',
            }));
            assert.deepEqual(errors, {}, placement);
        }
    });

    it('avviser ukjente flatenavn i begge feltene', () => {
        assert.ok(validateBoardInput(draft({ carouselSurface: 'lilla' })).carouselSurface);
        assert.ok(validateBoardInput(draft({ bottomSurface: 'lilla' })).bottomSurface);
    });
});
```

- [ ] **Step 2: Kjør testene og se at de feiler**

```bash
npm test -- src/boards/boardValidation.test.mjs
```

Forventet: FAIL — `errors.carouselTheme` settes fortsatt, og `weatherPlacement` ignoreres.

- [ ] **Step 3: Endre `boardValidation.js`**

Bytt importen på linje 17 fra `./carouselTheme.js` til:

```js
import { SURFACES } from './surfaces.js';
```

Bytt `if (draft.weatherEnabled) {` (linje 56) til:

```js
    // Samme krav uansett hvilket felt været står i: det er de samme
    // koordinatene som sendes til api.met.no.
    if (draft.weatherPlacement === 'karusell' || draft.weatherPlacement === 'stripe') {
```

Bytt `carouselTheme`-blokka (linje 73–75) til:

```js
    if (!SURFACES.includes(draft.carouselSurface)) {
        errors.carouselSurface = 'Velg en farge for karusellen';
    }

    if (!SURFACES.includes(draft.bottomSurface)) {
        errors.bottomSurface = 'Velg en farge for bunnstripa';
    }
```

- [ ] **Step 4: Kjør testene og se at de passerer**

```bash
npm test -- src/boards/boardValidation.test.mjs
```

Forventet: PASS. Gamle tester i fila som bruker `weatherEnabled: true` må skrives om til `weatherPlacement: 'karusell'` — gjør det nå, uten å endre hva de sjekker.

- [ ] **Step 5: Kjør hele testsuiten**

```bash
npm test
```

Forventet: PASS på alt.

- [ ] **Step 6: Commit**

```bash
git add src/boards/boardValidation.js src/boards/boardValidation.test.mjs
git commit -m "feat: valider flatenavn og plassering av været"
```

---

### Task 6: Firestore-reglene

**Files:**
- Modify: `firestore.rules:52-62`
- Test: `firestore.rules.spec.mjs`

**Interfaces:**
- Consumes: flatenavnene fra Task 1, som literal liste — regler kan ikke importere
- Produces: ingenting for andre oppgaver

Krever Java og Firebase-emulatoren. Går ikke `npm run test:rules` i det hele tatt, sjekk at `node_modules` finnes i worktreet — en tom `node_modules` gir misvisende feil på alt.

- [ ] **Step 1: Skriv de feilende testene**

Legg til i `firestore.rules.spec.mjs`, inne i `describe`-blokka for tavler:

```js
    it('godtar en tavle med bunnstripe og begge flatefeltene', async () => {
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({
            carouselSurface: 'fersken',
            bottomSurface: 'morkebla',
            bottom: [{ type: 'weather', name: 'Bergen', lat: 60.4, lng: 5.3 }],
        }), { merge: true }));
    });

    // Gamle dokumenter beholder carouselTheme fordi saveBoardConfig skriver med
    // merge. Klausulen for det feltet må derfor bli stående i reglene — uten
    // den avvises hver eneste lagring på en tavle som finnes fra før.
    it('godtar en tavle som fortsatt har det gamle carouselTheme', async () => {
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({
            carouselTheme: 'dark',
            carouselSurface: 'morkebla',
        }), { merge: true }));
    });

    it('godtar en tavle helt uten de nye feltene', async () => {
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board(), { merge: true }));
    });

    it('avviser ukjent flatenavn', async () => {
        await assertFails(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({
            carouselSurface: 'lilla',
        }), { merge: true }));
        await assertFails(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({
            bottomSurface: 'lilla',
        }), { merge: true }));
    });

    it('avviser bottom som ikke er en liste', async () => {
        await assertFails(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({
            bottom: 'vær',
        }), { merge: true }));
    });

    it('avviser en bottom-liste med for mange moduler', async () => {
        await assertFails(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({
            bottom: [1, 2, 3, 4, 5, 6],
        }), { merge: true }));
    });
```

- [ ] **Step 2: Kjør regeltestene og se at de feiler**

```bash
npm run test:rules
```

Forventet: de fire siste feiler — reglene godtar i dag hva som helst i felt de ikke kjenner.

- [ ] **Step 3: Utvid `isValidBoard`**

I `firestore.rules`, legg til etter `carouselTheme`-linja (linje 58):

```
        // Flatenavnene står også i src/boards/surfaces.js. Regler kan ikke
        // importere, så lista finnes to steder — endrer du den ene, endre den
        // andre. Samme duplisering som theme og top.kind allerede har.
        && (!d.keys().hasAny(['carouselSurface'])
            || d.carouselSurface in ['morkebla', 'morkebla-lys', 'lavendel', 'lys-lavendel', 'hvit', 'fersken'])
        && (!d.keys().hasAny(['bottomSurface'])
            || d.bottomSurface in ['morkebla', 'morkebla-lys', 'lavendel', 'lys-lavendel', 'hvit', 'fersken'])
        && (!d.keys().hasAny(['bottom']) || (d.bottom is list && d.bottom.size() <= 5))
```

`carouselTheme`-klausulen over blir stående. Den er ikke død kode: `saveBoardConfig` bruker `merge`, så feltet ligger igjen i gamle dokumenter og er med i den sammenslåtte `request.resource.data`.

- [ ] **Step 4: Kjør regeltestene og se at de passerer**

```bash
npm run test:rules
```

Forventet: PASS på alt, også de eksisterende testene.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules firestore.rules.spec.mjs
git commit -m "feat: valider bottom og flatefelt i firestore-reglene"
```

---

### Task 7: Komponentene tar palett i stedet for tema

**Files:**
- Create: `src/components/ProgressBar.jsx`
- Modify: `src/components/Carousel.jsx`, `src/components/Weather.jsx`, `src/components/Departures.jsx:72-73`, `src/floorplan/OfficeMap.jsx:13-14`, `src/App.jsx`
- Delete: `src/boards/carouselTheme.js`, `src/boards/carouselTheme.test.mjs`

**Interfaces:**
- Consumes: `surfacePalette` fra Task 1, `advance` fra Task 2, `nowSummary`/`hourlyForecast`/`dailyForecast` fra Task 3, `config.carouselSurface` fra Task 4
- Produces:
  - `<ProgressBar progress={number} palette={palette} />` — `progress` er 0–1
  - `<Carousel slides={slides} palette={palette} />`
  - `<Weather weather={weather} palette={palette} />`
  - `<Departures departures={...} stopPlaceName={...} palette={palette} />`
  - `<OfficeMap palette={palette} />`

Ren omskriving uten funksjonsendring, med ett unntak: progress-baren i karusellen begynner å vises igjen. Det er en feilretting, ikke en ny funksjon — se under.

- [ ] **Step 1: Skriv `ProgressBar.jsx`**

Opprett `src/components/ProgressBar.jsx`:

```js
/**
 * Full-bredde bar som fylles fram til neste bytte.
 *
 * Delt av karusellen og bunnstripa. Fargen er `accent` på alle flater — én
 * accent er lettere å lese enn seks, og `surfaces.test.mjs` holder kontrasten
 * mot hver enkelt bakgrunn over 1.5.
 *
 * Rendres ikke når det ikke er noe å veksle mellom; det avgjør kalleren, som
 * er den som vet hvor mange visninger den har.
 */
function ProgressBar({ progress, palette }) {
    return (
        <div style={{ width: '100%', height: '6px', backgroundColor: palette.background, flex: '0 0 auto' }}>
            <div style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: palette.accent }} />
        </div>
    );
}

export default ProgressBar;
```

- [ ] **Step 2: Skriv om `Carousel.jsx`**

Erstatt hele fila:

```js
import { useState, useEffect, useRef } from 'react';

import ProgressBar from './ProgressBar';
import { advance } from './rotation.mjs';

const SLIDE_DURATION = 30000; // 30 sek per slide
const TICK = 100; // ms mellom hver progress-oppdatering

/**
 * Karusell som bytter mellom flere slides på et fast intervall, med en
 * full-bredde progress-bar øverst som fylles fram til neste bytte.
 *
 * Bakgrunn og tekstfarge kommer inn som `palette` fra `App`. Komponenten slår
 * den ikke opp selv: `Weather` rendres nå i to felt med hver sin flate, og da
 * må flaten følge med ovenfra.
 *
 * slides: Array<{ key: string, node: React.ReactNode }>
 */
function Carousel({ slides, palette }) {
    const [state, setState] = useState({ elapsed: 0, index: 0 });
    const stateRef = useRef(state);

    useEffect(() => {
        const id = setInterval(() => {
            stateRef.current = advance(stateRef.current, {
                tick: TICK,
                duration: SLIDE_DURATION,
                count: slides.length,
            });
            setState(stateRef.current);
        }, TICK);
        return () => clearInterval(id);
    }, [slides.length]);

    // En tavle uten karusell-moduler er lovlig: velger man bare video og
    // hilsen, skal feltet falle bort framfor at slides[index] krasjer. Vakten
    // må stå etter hooks-kallene — de må kjøre ubetinget, ellers bryter React
    // sine regler når lista går fra tom til ikke-tom.
    if (slides.length === 0) {
        return null;
    }

    // `advance` fryser indeksen på 0 når lista krymper, men tilstanden kan være
    // ett tick gammel her. Klemmen gjør at renderingen aldri ser utenfor lista.
    const index = Math.min(state.index, slides.length - 1);

    return (
        <div style={{ flex: 1, minHeight: 0, width: '100vw', backgroundColor: palette.background, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {slides.length > 1 && (
                <ProgressBar progress={state.elapsed / SLIDE_DURATION} palette={palette} />
            )}
            <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {slides[index].node}
            </div>
        </div>
    );
}

export default Carousel;
```

Dette retter samtidig feilen fra 44a7074: progress-baren lå i `slides.map(() => { <div/> })` — en blokk-kropp uten `return` — og rendret derfor ingenting.

`Icon` faller ut av `slides`-formen. Ikon-raden ble fjernet i 44a7074, og feltet har vært ubrukt siden.

- [ ] **Step 3: Koble `Weather.jsx` til palett og forecastViews**

I `src/components/Weather.jsx`:

1. Bytt importene: fjern `import { carouselPalette } from '../boards/carouselTheme';`, legg til `import { dailyForecast, hourlyForecast, nowSummary } from '../weather/forecastViews.mjs';`
2. Slett den lokale `buildDailyForecast` (linje 24–54) og `WEEKDAYS` (linje 21) — de bor nå i `forecastViews.mjs`.
3. Slett `const PEACH = base.light.baseColors.frame.highlightalt;` (linje 9).
4. Bytt signaturen til `export default function Weather({ weather, palette })` og fjern `const palette = carouselPalette(theme);` (linje 77).
5. Bytt `const dark = palette.theme === 'dark';` til `const dark = palette.mode === 'dark';`
6. Bytt utpakkingen (linje 68–76) til:

```js
    const timeSeries = weather.properties.timeseries;
    const now = nowSummary(timeSeries);
    const hourly = hourlyForecast(timeSeries, 6);
    const daily = dailyForecast(timeSeries, 4);
```

7. I nå-kortet: `nowSymbol` → `now.symbol`, `nowDetails.air_temperature` → `now.temperature`, `nowDetails.wind_speed` → `now.wind`, `nowPrecip` → `now.precipitation`.
8. I timesstripa: `weather.time.substring(11, 16)` → `time.substring(11, 16)`, `weather.data.instant.details.air_temperature` → `temperature`, og symbol/nedbør fra de nye feltene. Map-en blir `{hourly.map(({ time, symbol, temperature, precipitation }) => (...))}` med `key={time}`.
9. **Begge stedene `PEACH` sto**, altså bakgrunnen på timesstripa (linje 136) og dagsraden (linje 161), byttes til `palette.panel`:

```js
backgroundColor: dark ? palette.panel : PEACH,   // før
backgroundColor: palette.panel,                  // etter
```

Uttrykket `dark ? ... : ...` faller bort helt: `palette.panel` er allerede riktig i begge modi. Legg inn kommentaren:

```js
// palette.panel, ikke en fast fersken: «fersken» er selv en mulig
// bakgrunn, og et ferskent kort på ferskent felt er usynlig.
// surfaces.test.mjs holder panelet synlig mot hver bakgrunn.
```

10. `color: dark ? '#ffffff' : undefined` på de samme to kortene byttes til `color: palette.text`.

- [ ] **Step 4: Koble `Departures.jsx` og `OfficeMap.jsx` til palett**

I `src/components/Departures.jsx`:

```js
// fjern: import { carouselPalette } from '../boards/carouselTheme';

function Departures({ departures, stopPlaceName, palette }) {
    // fjern: const palette = carouselPalette(theme);
```

`LineBadge` og `Chip` tar fortsatt en `theme`-streng, fordi `lineAppearance` gjør det. Kallstedene sender nå `theme={palette.mode}`. Ikke rør `lineAppearance.js` — merkefargene er en egen logikk med egen test.

I `src/floorplan/OfficeMap.jsx`:

```js
// fjern: import { carouselPalette } from '../boards/carouselTheme';

function OfficeMap({ palette }) {
    const dark = palette.mode === 'dark';
```

- [ ] **Step 5: Koble `App.jsx` til palettene**

I `src/App.jsx`:

1. Legg til `import { surfacePalette } from './boards/surfaces';`
2. Etter `const config = ...` (linje 47), legg til:

```js
    const carouselPalette = config ? surfacePalette(config.carouselSurface) : null;
```

3. Bytt alle fire `theme={config.carouselTheme}` til `palette={carouselPalette}`, og `<Carousel slides={slides} theme={...} />` til `<Carousel slides={slides} palette={carouselPalette} />`.
4. Fjern `Icon`-feltene fra `slides`-objektene og importen av `ClockIcon, SunCloudIcon, MapIcon` fra `@entur/icons` — ingen leser dem etter Step 2.

- [ ] **Step 6: Slett `carouselTheme.js` og bevis at ingen importerer den**

```bash
git rm src/boards/carouselTheme.js src/boards/carouselTheme.test.mjs
grep -rn "carouselTheme\|carouselPalette" src/
```

Forventet fra `grep`: bare treffet i `boardConfig.js` (`CAROUSEL_THEME_TO_SURFACE` og kommentaren om migrering) og den lokale variabelen `carouselPalette` i `App.jsx`. Ingen importer.

- [ ] **Step 7: Kjør testene og bygg**

```bash
npm test && npm run build
```

Forventet: PASS på alle enhetstester, og et bygg uten feil. Bygget er det som fanger en glemt prop eller en import som peker på en slettet fil.

- [ ] **Step 8: Commit**

```bash
git add -A src/ && git commit -m "refactor: komponentene tar palett i stedet for tema

Fikser samtidig progress-baren i karusellen, som siden 44a7074 lå i en
slides.map med blokk-kropp uten return og derfor ikke rendret noe."
```

---

### Task 8: Bunnstripa

**Files:**
- Create: `src/components/BottomBand.jsx`, `src/components/WeatherStripe.jsx`
- Modify: `src/components/MiddleBand.jsx:32-45`, `src/App.jsx`

**Interfaces:**
- Consumes: `advance` (Task 2), `nowSummary`/`hourlyForecast`/`dailyForecast` (Task 3), `config.bottom` og `config.bottomSurface` (Task 4), `ProgressBar` (Task 7)
- Produces:
  - `<BottomBand modules={config.bottom} palette={palette} weather={weather} />`
  - `<WeatherStripe weather={weather} palette={palette} />`
  - `<MiddleBand ... hasCarousel={boolean} hasBottom={boolean} />`

- [ ] **Step 1: Skriv `WeatherStripe.jsx`**

Opprett `src/components/WeatherStripe.jsx`:

```js
import { useState, useEffect, useRef } from 'react';
import { UmbrellaIcon, WindIcon } from '@entur/icons';
import { base } from '@entur/tokens';
import { Label } from '@entur/typography';

import ProgressBar from './ProgressBar';
import { advance } from './rotation.mjs';
import { dailyForecast, hourlyForecast, nowSummary } from '../weather/forecastViews.mjs';

const HIGHLIGHT = base.light.baseColors.shape.highlight;

/**
 * 15 sekunder, ikke karusellens 30: hver visning er liten og lest på tre
 * sekunder, og med 30 ville stripa stått stille gjennom nesten en hel
 * karusellslide.
 */
const VIEW_DURATION = 15000;
const TICK = 100;

/**
 * Været i bunnstripa: «nå» fast til venstre, og en høyre side som veksler
 * mellom de neste seks timene og de neste fire dagene.
 *
 * Henter ingenting selv. `weather` kommer fra samme polling i `App` som
 * karusellværet — se kommentaren der om hvorfor den ikke kan ligge her.
 *
 * Ingen egen bakgrunn: den hører til feltet. Maler modulen sin egen, blir været
 * et panel som svever på stripa.
 */
function WeatherStripe({ weather, palette }) {
    const timeseries = weather?.properties?.timeseries;
    const now = nowSummary(timeseries);
    const hourly = hourlyForecast(timeseries, 6);
    // Sent på kvelden finnes det ikke flere hele dager. Da faller
    // dagsvisningen bort og timesvisningen står alene — samme regel som
    // karusellen har for én slide.
    const daily = dailyForecast(timeseries, 4);
    const views = daily.length > 0 ? ['hours', 'days'] : ['hours'];

    const [state, setState] = useState({ elapsed: 0, index: 0 });
    const stateRef = useRef(state);

    useEffect(() => {
        const id = setInterval(() => {
            stateRef.current = advance(stateRef.current, {
                tick: TICK,
                duration: VIEW_DURATION,
                count: views.length,
            });
            setState(stateRef.current);
        }, TICK);
        return () => clearInterval(id);
    }, [views.length]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', boxSizing: 'border-box', color: palette.text }}>
            {views.length > 1 && (
                <ProgressBar progress={state.elapsed / VIEW_DURATION} palette={palette} />
            )}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch', gap: '1.5rem', padding: '0.75rem 2rem' }}>
                <NowCard now={now} palette={palette} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-around', backgroundColor: palette.panel, borderRadius: '12px', padding: '0.5rem 1.5rem', overflow: 'hidden' }}>
                    {views[Math.min(state.index, views.length - 1)] === 'hours'
                        ? hourly.map((hour) => <HourCell key={hour.time} hour={hour} />)
                        : daily.map((day) => <DayCell key={day.date.toDateString()} day={day} />)}
                </div>
            </div>
        </div>
    );
}

/**
 * Nå-kortet står fast. Uten data viser det «–» framfor å forsvinne: feltet skal
 * beholde høyden, slik at layouten ikke hopper når varselet kommer.
 */
function NowCard({ now, palette }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: '0 0 auto', backgroundColor: palette.panel, borderRadius: '12px', padding: '0.5rem 1.5rem' }}>
            {now?.symbol && (
                <img src={`/yrSymbols/${now.symbol}.svg`} alt={now.symbol} style={{ width: '64px', height: '64px', display: 'block' }} />
            )}
            <div style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1 }}>
                {now ? `${Math.round(now.temperature)}°` : '–'}
            </div>
            {now && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <WindIcon size={20} color={palette.text} />
                        <Label style={{ margin: 0, color: palette.text }}>{now.wind} m/s</Label>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <UmbrellaIcon size={20} color={palette.text} />
                        <Label style={{ margin: 0, color: palette.text }}>{now.precipitation} mm</Label>
                    </span>
                </div>
            )}
        </div>
    );
}

function HourCell({ hour }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{hour.time.substring(11, 16)}</span>
            {hour.symbol && (
                <img src={`/yrSymbols/${hour.symbol}.svg`} alt={hour.symbol} style={{ width: '44px', height: '44px', display: 'block' }} />
            )}
            <span style={{ fontSize: '1.4rem', fontWeight: 700, lineHeight: 1 }}>{Math.round(hour.temperature)}°</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: HIGHLIGHT, fontSize: '0.95rem' }}>
                <UmbrellaIcon size={14} />
                {hour.precipitation} mm
            </span>
        </div>
    );
}

function DayCell({ day }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 600, textTransform: 'capitalize' }}>{day.weekday}</span>
            {day.symbol && (
                <img src={`/yrSymbols/${day.symbol}.svg`} alt={day.symbol} style={{ width: '44px', height: '44px', display: 'block' }} />
            )}
            <span style={{ fontSize: '1.4rem', fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap' }}>
                {Math.round(day.max)}° / {Math.round(day.min)}°
            </span>
        </div>
    );
}

export default WeatherStripe;
```

- [ ] **Step 2: Skriv `BottomBand.jsx`**

Opprett `src/components/BottomBand.jsx`:

```js
import ErrorBoundary from './ErrorBoundary';
import WeatherStripe from './WeatherStripe';

/**
 * Feltet nederst på tavla.
 *
 * Rendrer modulene i `bottom` eksplisitt, ikke ved å iterere over en registry —
 * samme grep som `MiddleBand` bruker for `middle`. En ny type i `BOTTOM_TYPES`
 * må derfor også legges inn her.
 *
 * Høyden er fast, ikke `flex: 1`: stripa skal være en stripe, og karusellen over
 * skal få resten. `MiddleBand` kjenner tallet gjennom `hasBottom`.
 */
const HEIGHT = '20vh';

function BottomBand({ modules, palette, weather }) {
    if (modules.length === 0) {
        return null;
    }

    return (
        <div style={{ flex: `0 0 ${HEIGHT}`, width: '100vw', boxSizing: 'border-box', backgroundColor: palette.background, overflow: 'hidden' }}>
            {modules.map((module) => {
                if (module.type === 'weather') {
                    return (
                        <ErrorBoundary key="weather">
                            <WeatherStripe weather={weather} palette={palette} />
                        </ErrorBoundary>
                    );
                }
                return null;
            })}
        </div>
    );
}

export default BottomBand;
```

- [ ] **Step 3: Gi `MiddleBand` den nye høyderegelen**

I `src/components/MiddleBand.jsx`, bytt signaturen til:

```js
function MiddleBand({ theme, boardId, heading, greetingText, openingHoursDays, staffImageSrc, hasCarousel, hasBottom }) {
```

og `...(hasCarousel ? ...)`-linja (linje 44) til:

```js
        ...middleHeight(hasCarousel, hasBottom),
```

Legg til under komponenten:

```js
/**
 * Hvor mye plass midtfeltet får.
 *
 * Toppen er faste 40vh og stripa faste 20vh, så taket må ned når begge feltene
 * under er der — ellers har karusellen ingenting igjen. Uten karusell tar
 * midtfeltet resten, med eller uten stripe.
 *
 * Tallene er justert mot skjerm, ikke utledet. Endrer du dem, se på en tavle med
 * varsel, hilsen og åpningstider oppe samtidig.
 */
function middleHeight(hasCarousel, hasBottom) {
    if (!hasCarousel) {
        return { flex: 1, minHeight: 0 };
    }
    return { maxHeight: hasBottom ? '35vh' : '45vh' };
}
```

Kommentaren over `justifyContent: 'flex-start'` og `overflow: 'hidden'` skal ikke røres — feltet må fortsatt klippes nedenfra.

- [ ] **Step 4: Koble stripa inn i `App.jsx`**

1. Legg til `import BottomBand from './components/BottomBand';`
2. Bytt værmodul-oppslaget (linje 48) til:

```js
    // Været kan stå i karusellen eller i stripa, aldri begge: normaliseringen
    // lar bottom vinne. Oppslaget må derfor lete begge steder, men finner
    // høyst ett treff — og pollingen under startes bare én gang.
    const weatherModule = config
        ? (findModule(config.bottom, 'weather') ?? findModule(config.carousel, 'weather'))
        : undefined;
```

Kommentaren over `lat`/`lng` om hvorfor avhengighetene er tall og ikke objekter skal stå urørt.

3. Legg til ved siden av `carouselPalette`:

```js
    const bottomPalette = config ? surfacePalette(config.bottomSurface) : null;
```

4. Legg til under `const hasCarousel = ...`:

```js
    const hasBottom = config.bottom.length > 0;
```

5. Bytt render-blokka:

```js
            <MiddleBand
                theme={config.theme}
                boardId={boardId}
                heading={boardHeading(config.placeName)}
                greetingText={greetingTextFrom(greeting, autoGreeting)}
                openingHoursDays={openingHours ? openingHours.days : null}
                staffImageSrc={config.staffImage ? staffImage : null}
                hasCarousel={hasCarousel}
                hasBottom={hasBottom}
            />
            {hasCarousel && <Carousel slides={slides} palette={carouselPalette} />}
            {hasBottom && (
                <BottomBand modules={config.bottom} palette={bottomPalette} weather={weather} />
            )}
```

- [ ] **Step 5: Kjør testene og bygg**

```bash
npm test && npm run build
```

Forventet: PASS og et bygg uten feil.

- [ ] **Step 6: Commit**

```bash
git add -A src/ && git commit -m "feat: bunnstripe med kompakt værvisning"
```

---

### Task 9: Admin-skjemaet

**Files:**
- Modify: `src/admin/BoardConfigForm.jsx`

**Interfaces:**
- Consumes: `SURFACES` og `SURFACE_LABELS` (Task 1), `validateBoardInput` med `weatherPlacement` (Task 5)
- Produces: ingenting for andre oppgaver

- [ ] **Step 1: Utvid `draftFrom` og `configFrom`**

I `src/admin/BoardConfigForm.jsx`, bytt importene fra `../boards/boardConfig` til å ta med det som trengs, og legg til:

```js
import { SURFACES, SURFACE_LABELS } from '../boards/surfaces';
import { Dropdown } from '@entur/dropdown';
```

Gå ikke videre før du har sjekket at `@entur/dropdown` finnes i `package.json`. Gjør den ikke det, bruk `<RadioGroup>` med seks `<Radio>` i stedet — ikke installer en ny pakke for dette.

I `draftFrom`, bytt værlinjene (linje 39–44) til:

```js
        // Været bor ett sted. Ett felt med tre verdier gjør regelen synlig i
        // skjemaet, i stedet for en valideringsfeil du oppdager etter å ha
        // trykket lagre.
        weatherPlacement: bottomWeather ? 'stripe' : (weather ? 'karusell' : 'av'),
        weatherName: weatherModule ? weatherModule.name : '',
        weatherLat: weatherModule ? String(weatherModule.lat) : '',
        weatherLng: weatherModule ? String(weatherModule.lng) : '',
```

med disse over, ved siden av de andre `findModule`-kallene:

```js
    const bottomWeather = findModule(board.bottom, 'weather');
    const weatherModule = bottomWeather ?? weather;
```

og bytt `carouselTheme: board.carouselTheme` (linje 50) til:

```js
        carouselSurface: board.carouselSurface,
        bottomSurface: board.bottomSurface,
```

I `configFrom`, bytt værblokka (linje 68–75) til:

```js
    const weatherModule = {
        type: 'weather',
        name: draft.weatherName.trim(),
        lat: Number(draft.weatherLat),
        lng: Number(draft.weatherLng),
    };

    const carousel = [];
    if (draft.weatherPlacement === 'karusell') {
        carousel.push(weatherModule);
    }
```

og legg til før `return`:

```js
    const bottom = draft.weatherPlacement === 'stripe' ? [weatherModule] : [];
```

og bytt returobjektet (linje 87–97) til:

```js
    return {
        id: draft.id,
        name: draft.name.trim(),
        placeName: draft.placeName.trim(),
        theme: draft.theme,
        staffImage: draft.staffImage,
        top: { kind: draft.topKind },
        carouselSurface: draft.carouselSurface,
        bottomSurface: draft.bottomSurface,
        middle,
        carousel,
        bottom,
    };
```

- [ ] **Step 2: Bytt karusellens fargevelger og flytt været**

Erstatt `RadioGroup` for `carouselTheme` (linje 284–295) med:

```js
                <Dropdown
                    label="Bakgrunn"
                    items={SURFACES.map((name) => ({ value: name, label: SURFACE_LABELS[name] }))}
                    selectedItem={{ value: draft.carouselSurface, label: SURFACE_LABELS[draft.carouselSurface] }}
                    onChange={(item) => update('carouselSurface', item.value)}
                />
                {errors.carouselSurface && (
                    <SmallAlertBox variant="negative">{errors.carouselSurface}</SmallAlertBox>
                )}
```

Erstatt `Checkbox` for `weatherEnabled` (linje 297–302) med:

```js
                <RadioGroup
                    name="weatherPlacement"
                    label="Værmelding"
                    value={draft.weatherPlacement}
                    onChange={(event) => update('weatherPlacement', event.target.value)}
                >
                    <Radio value="av">Av</Radio>
                    <Radio value="karusell">I karusellen</Radio>
                    <Radio value="stripe">I bunnstripa</Radio>
                </RadioGroup>
```

og vilkåret for sted/koordinater-blokka (linje 303) fra `{draft.weatherEnabled && (` til:

```js
                {draft.weatherPlacement !== 'av' && (
```

- [ ] **Step 3: Legg til seksjonen «Bunnstripa»**

Rett etter `</section>` for karusellen (linje 371):

```js
            <section>
                <Heading3>Bunnstripa</Heading3>
                <Paragraph>
                    Et lavt felt nederst på skjermen. Velg «I bunnstripa» over for å
                    vise været her i stedet for i karusellen.
                </Paragraph>
                <Dropdown
                    label="Bakgrunn"
                    items={SURFACES.map((name) => ({ value: name, label: SURFACE_LABELS[name] }))}
                    selectedItem={{ value: draft.bottomSurface, label: SURFACE_LABELS[draft.bottomSurface] }}
                    onChange={(item) => update('bottomSurface', item.value)}
                />
                {errors.bottomSurface && (
                    <SmallAlertBox variant="negative">{errors.bottomSurface}</SmallAlertBox>
                )}
            </section>
```

- [ ] **Step 4: Kjør testene og bygg**

```bash
npm test && npm run build
```

Forventet: PASS og et bygg uten feil.

- [ ] **Step 5: Commit**

```bash
git add -A src/ && git commit -m "feat: velg flatefarge og plassering av været i admin"
```

---

### Task 10: Visuell verifisering

**Files:** ingen — dette er porten før PR.

- [ ] **Step 1: Bygg og start forhåndsvisningen**

```bash
npm run build
```

Start deretter serveren `preview` fra `.claude/launch.json` med preview-verktøyet. Ikke bruk `Bash` til å kjøre dev-servere.

- [ ] **Step 2: Sjekk konsoll og nettverk**

Les konsollmeldinger og serverlogg. Forventet: ingen feil, og ingen advarsel om manglende `key` eller ukjent prop.

- [ ] **Step 3: Gå gjennom kombinasjonene**

På `/t/bergen-3`, og med oppsettet endret fra `/admin/t/bergen-3` mellom rundene:

1. Vær i stripa, karusell med plantegning — sjekk at nå-kortet står stille og at høyre side veksler etter 15 sekunder.
2. Vær i stripa, ingen karusell — midtfeltet skal ta plassen, stripa beholde 20vh.
3. Vær i karusellen, ingen stripe — nøyaktig som før endringen, og progress-baren skal nå være synlig igjen øverst i karusellen.
4. Karusell og stripe samtidig med varsel, hilsen og åpningstider oppe — ingenting skal falle utenfor 100vh.
5. Flatekombinasjoner: `morkebla` karusell over `lys-lavendel` stripe, og motsatt.
6. **`fersken` på begge feltene** — det er denne flaten `PEACH`-byttet i Weather handler om. Times- og dagskortene skal fortsatt skille seg fra bakgrunnen.
7. **`morkebla-lys`** på karusellen — nå-kortets mørkeblå gradient ligger nærmest bakgrunnen her, og kanten er det eneste som skiller dem.

- [ ] **Step 4: Juster tallene om nødvendig**

`20vh` (stripa), `35vh` (midtfeltet med både karusell og stripe) og `15000` (vekslingen) er utgangspunkt fra speccen, ikke fasit. Ser noe klemt eller stresset ut, endre tallet der det står — `BottomBand.HEIGHT`, `middleHeight` i `MiddleBand.jsx`, `VIEW_DURATION` i `WeatherStripe.jsx` — og se på det igjen.

- [ ] **Step 5: Ta skjermbilder som dokumentasjon**

Minst tre: stripa med timesvisning, stripa med dagsvisning, og en `fersken`-tavle.

- [ ] **Step 6: Kjør alt en siste gang**

```bash
npm test && npm run test:rules && npm run build
```

Forventet: PASS på alle tre.

- [ ] **Step 7: Commit eventuelle justeringer**

```bash
git add -A && git commit -m "fix: juster høyder og vekslingstakt etter visuell kontroll"
```

---

## Egenkontroll av planen

Gjennomgått mot speccen:

- **Datamodell** (`bottom`, `carouselSurface`, `bottomSurface`, migrering, ett-sted-regelen) → Task 4
- **Flatetabellen** med seks navn, `mode`, kontrastgrenser → Task 1
- **Ferskenfellen** (`PEACH` → `palette.panel`) → Task 7, Step 3, punkt 9
- **Komponentene tar palett** → Task 7
- **Værpollingen leter i begge listene** → Task 8, Step 4, punkt 2
- **`BottomBand`** → Task 8, Step 2
- **`WeatherStripe`** med fast nå-kort, veksling, tom-data og tom dagsliste → Task 8, Step 1
- **Delte værutregninger** → Task 3
- **Delt veksling** + `ProgressBar` + karusell-feilen → Task 2 og Task 7
- **Høyderegelen** → Task 8, Step 3
- **Admin** → Task 9
- **Firestore-regler**, inkludert at `carouselTheme`-klausulen blir stående → Task 6
- **Testing** → tester i Task 1–6, visuell kontroll i Task 10
- **Sletting av `carouselTheme.js`** → Task 7, Step 6

Navnekontroll på tvers av oppgavene: `surfacePalette`, `SURFACES`, `SURFACE_LABELS`, `DEFAULT_CAROUSEL_SURFACE`, `DEFAULT_BOTTOM_SURFACE` (Task 1) brukes med de samme navnene i Task 4, 5, 7 og 9. `advance({ elapsed, index }, { tick, duration, count })` (Task 2) kalles med samme signatur i Task 7 og 8. `nowSummary`/`hourlyForecast`/`dailyForecast` (Task 3) kalles med samme signatur i Task 7 og 8. `palette.mode` — ikke `palette.theme` — overalt.

Én avhengighet å være obs på i Task 9: `@entur/dropdown` står ikke i `package.json` i dag. Steget sier eksplisitt at man skal falle tilbake på `RadioGroup` framfor å installere en ny pakke.
