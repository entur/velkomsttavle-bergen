# Avgangstider og tema på karusellen — fase 3: implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En tavle kan vise sanntids avgangstider fra ett stoppested, og karusellen kan settes lys eller mørk per tavle.

**Architecture:** Avgangene hentes med ett GraphQL-kall mot Entur Journey Planner v3, uten nøkkel og uten backend — APIet er CORS-åpent. All logikk som kan gå galt (mapping, språkvalg, nedtelling, fargevalg, normalisering) ligger i rene `.js`-moduler testet med `node --test`; komponentene er tynne. Temaet er ett felt på tavla og gjelder hele karusellen, fordi en karusell som skifter bakgrunn mellom slides er en feil, ikke et design.

**Tech Stack:** React 19, Vite 8, Firebase Firestore 12, Entur designsystem (`@entur/tokens`, `@entur/icons`, `@entur/form`), `node --test`, `@firebase/rules-unit-testing`.

**Spec:** `docs/superpowers/specs/2026-08-07-avgangstider-og-karuselltema-design.md`
**Bygger på:** fase 1 og 2, begge i `main`.

## Global Constraints

- **Språk:** all kode-kommentar, UI-tekst og commit-melding på norsk (bokmål).
- **Ingen nye avhengigheter.** Alt finnes: `@entur/tokens` har `colors.validation` og `transport`, `@entur/icons` har `ClockIcon`.
- **Ingen komponenttester.** Logikk som skal testes må ligge i en `.js`-modul uten JSX og uten Firebase-import.
- **Testfiler heter `*.test.mjs`.** Regeltester heter `*.rules.spec.mjs` og kjøres med `yarn test:rules` (krever fri port 8080).
- **`yarn test`, `yarn test:rules` og `yarn build` skal være grønne før hver commit.**
- **Styling er inline-styles med Entur-tokens.**
- **Tavla laster seg aldri på nytt av seg selv.**
- **`ET-Client-Name: entur-velkomsttavle`** på alle kall mot `api.entur.io`. Påkrevd av Entur.
- **Faste verdier:** 6 avganger, `timeRange` 10800 sekunder (3 timer), henting hvert 60. sekund, nedtelling regnet om hvert 15. sekund, nedtellingsgrense 20 minutter. Ingen av dem er konfigurerbare.
- **Innstilling heter `cancellation`** i Journey Planner v3. `cancelled` finnes ikke og gir valideringsfeil.

## Filstruktur

**Nye filer:**

| Fil | Ansvar |
|---|---|
| `src/boards/carouselTheme.js` + `.test.mjs` | Tema → palett av tokens. |
| `src/departures/lineAppearance.js` + `.test.mjs` | Farge på linjemerket: kategori L/R/F, ellers transport-mode. |
| `src/departures/departureCountdown.js` + `.test.mjs` | Nedtelling og 20-minuttersgrensen. |
| `src/departures/departureMapper.js` + `.test.mjs` | GraphQL-svar → vår form, inkludert språkvalg i situasjoner. |
| `src/departures/enturDepartures.js` + `.test.mjs` | Spørring, henting og polling. Speiler `metForecast.js`. |
| `src/departures/stopPlaceSearch.js` + `.test.mjs` | Søk mot geocoderen. |
| `src/components/Departures.jsx` | Avgangs-sliden. |
| `src/admin/StopPlaceField.jsx` | Søkefelt for stoppested i admin. |

**Endrede filer:**

| Fil | Endring |
|---|---|
| `src/boards/boardConfig.js` | `departures` i katalogen, `carouselTheme` på tavla. |
| `src/boards/boardValidation.js` | Validering av stoppested og tema. |
| `src/components/Carousel.jsx` | Bakgrunn og ikonfarger fra tema. Retter kontrastfeilen. |
| `src/components/Weather.jsx` | Egen bakgrunn ut, Nå-kort og fersken-kort per tema. |
| `src/floorplan/OfficeMap.jsx` | Lyst panel også i mørkt tema. |
| `src/App.jsx` | Avgangs-polling, tema til karusellen, ny slide. |
| `src/admin/BoardConfigForm.jsx` | Avgangsmodul og temavalg. |
| `firestore.rules` + `firestore.rules.spec.mjs` | `carouselTheme` valideres. |
| `README.md` | Avgangsmodulen og temaet. |

---

### Task 1: Tema-paletten

**Files:**
- Create: `src/boards/carouselTheme.js`, `src/boards/carouselTheme.test.mjs`

**Interfaces:**
- Consumes: `@entur/tokens`.
- Produces: `CAROUSEL_THEMES`, `DEFAULT_CAROUSEL_THEME`, `carouselPalette(theme)` → `{ theme, background, panel, text, iconActive, iconInactive }`.

- [ ] **Step 1: Skriv den feilende testen**

Opprett `src/boards/carouselTheme.test.mjs`:

```js
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

});
```

- [ ] **Step 2: Kjør testen og se at den feiler**

Run: `yarn test`
Expected: FAIL — `Cannot find module './carouselTheme.js'`.

- [ ] **Step 3: Skriv implementasjonen**

Opprett `src/boards/carouselTheme.js`:

```js
/**
 * Fargepalett for karusellen, per tema.
 *
 * Temaet ligger på tavla og gjelder hele karusellen. En karusell som skifter
 * bakgrunn mellom slides er ikke et design, det er en feil.
 *
 * Uten JSX og uten Firebase-import, slik at palettene kan kontrastmåles med
 * `node --test`. Det er ikke pynt: dagens inaktive karusellikon er hvitt mot
 * lavendel, kontrast 1.39, altså usynlig. Testen holder den feilen borte.
 */
import { base, colors, semantic } from '@entur/tokens';

export const CAROUSEL_THEMES = ['light', 'dark'];
export const DEFAULT_CAROUSEL_THEME = 'light';

const DARK_BACKGROUND = base.light.baseColors.frame.contrast;
const LIGHT_BACKGROUND = semantic.fill.background.subdued.light;
const CORAL = base.light.baseColors.shape.highlight;
const BRAND_BLUE = colors.brand.blue;

export function carouselPalette(theme) {
    const dark = theme === 'dark';
    return {
        theme: dark ? 'dark' : 'light',
        background: dark ? DARK_BACKGROUND : LIGHT_BACKGROUND,
        // Flate for moduler som trenger å skille seg fra bakgrunnen. På mørkt
        // tema er den lysere enn bakgrunnen, ellers hvit.
        panel: dark ? base.light.baseColors.frame.contrastalt : '#ffffff',
        text: dark ? '#ffffff' : BRAND_BLUE,
        iconActive: CORAL,
        iconInactive: dark ? '#ffffff' : BRAND_BLUE,
    };
}
```

Paletten holder seg til flater, tekst og ikoner. Fargen på **merkene** — linjemerket og avviks-brikkene — eies av `lineAppearance` og `Chip`, som begge har sin egen logikk for fyll og tekst. Å legge `badgeText`/`badgeBorder` her også ville vært et felt ingen leser.
```

- [ ] **Step 4: Kjør testen og se at den passerer**

Run: `yarn test`
Expected: PASS.

Feiler kontrast-testen, er det paletten som er feil, ikke testen. Verdiene er målt på forhånd: inaktivt ikon blir 11.31 i lyst tema og 15.68 i mørkt.

- [ ] **Step 5: Commit**

```bash
git add src/boards/carouselTheme.js src/boards/carouselTheme.test.mjs
git commit -m "feat: fargepalett for lyst og mørkt karusell-tema"
```

---

### Task 2: Farge på linjemerket

**Files:**
- Create: `src/departures/lineAppearance.js`, `src/departures/lineAppearance.test.mjs`

**Interfaces:**
- Consumes: `@entur/tokens`.
- Produces: `lineAppearance(lineCode, transportMode, theme)` → `{ fill, text, border }`.

- [ ] **Step 1: Skriv den feilende testen**

Opprett `src/departures/lineAppearance.test.mjs`:

```js
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
        assert.ok(lineAppearance('L4', 'rail', 'light').border.startsWith('2px'));
        assert.equal(lineAppearance('L4', 'rail', 'dark').border, 'none');
    });
});
```

- [ ] **Step 2: Kjør testen og se at den feiler**

Run: `yarn test`
Expected: FAIL — `Cannot find module './lineAppearance.js'`.

- [ ] **Step 3: Skriv implementasjonen**

Opprett `src/departures/lineAppearance.js`:

```js
/**
 * Farge på linjemerket i avgangstavla.
 *
 * Fargen settes av linjekategori — L lokaltog, R regiontog, F fjerntog — fordi
 * det er kodingen Bane NOR bruker på perrongskjermene. Den reisende går fra
 * billettkontoret til sporet og møter samme farge.
 *
 * Enturs eget `line.presentation.colour` brukes IKKE: det er en operatørfarge,
 * ikke en linjefarge. Alle tre togene fra Bergen stasjon er Vy og får samme
 * røde, og de fleste bussrutene har feltet tomt. Verifisert mot APIet.
 *
 * Hex-verdiene for grønn, rød og blå er de nærmeste tokenene i Entur-
 * designsystemet, ikke målt på Bane NORs skjermer. De kan justeres.
 */
import { colors, transport } from '@entur/tokens';

const CATEGORY_FILLS = {
    L: { light: colors.validation.mint, dark: colors.validation.mintContrast },
    R: { light: colors.validation.lava, dark: colors.validation.lavaContrast },
    F: { light: colors.validation.sky, dark: colors.validation.skyContrast },
};

// Tallet er ikke pynt: «L4» er en kategori, «Lillestrøm» er et stedsnavn.
const CATEGORY_CODE = /^([LRF])\d+$/i;

/** Nøytral når transportmiddelet er ukjent. Må skille seg fra bakgrunnen. */
const NEUTRAL = { light: colors.brand.blue, dark: colors.blues.blue60 };

export function lineAppearance(lineCode, transportMode, theme) {
    const dark = theme === 'dark';
    return {
        fill: fillFor(lineCode, transportMode, dark),
        text: dark ? colors.brand.blue : '#ffffff',
        border: dark ? 'none' : `2px solid ${colors.brand.blue}`,
    };
}

function fillFor(lineCode, transportMode, dark) {
    const match = typeof lineCode === 'string' ? CATEGORY_CODE.exec(lineCode) : null;
    if (match) {
        const category = CATEGORY_FILLS[match[1].toUpperCase()];
        return dark ? category.dark : category.light;
    }
    const palette = dark ? transport.contrast : transport.standard;
    const byMode = typeof transportMode === 'string' ? palette[transportMode] : undefined;
    return byMode ?? (dark ? NEUTRAL.dark : NEUTRAL.light);
}
```

- [ ] **Step 4: Kjør testen og se at den passerer**

Run: `yarn test`
Expected: PASS.

Merk testen `assert.equal(lineAppearance('RE', …).fill, transport.standard.rail ?? colors.brand.blue)`: `transport.standard` har ingen `rail`-nøkkel (den heter `train`), så uttrykket faller til `colors.brand.blue`, som er nøyaktig den nøytrale fargen implementasjonen skal gi. Testen er riktig som den står.

- [ ] **Step 5: Commit**

```bash
git add src/departures/lineAppearance.js src/departures/lineAppearance.test.mjs
git commit -m "feat: kategorifarge på linjemerket, med transportmiddel som fallback"
```

---

### Task 3: Nedtelling

**Files:**
- Create: `src/departures/departureCountdown.js`, `src/departures/departureCountdown.test.mjs`

**Interfaces:**
- Consumes: ingenting.
- Produces: `COUNTDOWN_THRESHOLD_MINUTES`, `minutesUntil(expectedAt, now)` → tall eller `null`, `countdownLabel(expectedAt, now)` → streng eller `null`.

- [ ] **Step 1: Skriv den feilende testen**

Opprett `src/departures/departureCountdown.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { COUNTDOWN_THRESHOLD_MINUTES, countdownLabel, minutesUntil } from './departureCountdown.js';

const NA = new Date('2026-08-07T10:23:00Z');

function om(minutter) {
    return new Date(NA.getTime() + minutter * 60000);
}

describe('minutesUntil', () => {
    it('teller hele minutter fram', () => {
        assert.equal(minutesUntil(om(4), NA), 4);
        assert.equal(minutesUntil(om(0), NA), 0);
    });

    it('runder ned, så «om 4 min» ikke blir 5 for tidlig', () => {
        assert.equal(minutesUntil(new Date(NA.getTime() + 4 * 60000 + 59000), NA), 4);
    });

    it('gir negative tall for avganger som er passert', () => {
        assert.equal(minutesUntil(om(-3), NA), -3);
    });

    it('gir null for noe som ikke er en brukbar dato', () => {
        assert.equal(minutesUntil(null, NA), null);
        assert.equal(minutesUntil(new Date('tull'), NA), null);
        assert.equal(minutesUntil('2026-08-07T10:27:00Z', NA), null);
    });
});

describe('countdownLabel', () => {
    it('teller ned under grensen', () => {
        assert.equal(countdownLabel(om(4), NA), 'om 4 min');
        assert.equal(countdownLabel(om(13), NA), 'om 13 min');
    });

    it('tar med grensen selv', () => {
        assert.equal(countdownLabel(om(COUNTDOWN_THRESHOLD_MINUTES), NA), 'om 20 min');
    });

    it('gir null over grensen — da skal klokkeslettet stå alene', () => {
        assert.equal(countdownLabel(om(COUNTDOWN_THRESHOLD_MINUTES + 1), NA), null);
        assert.equal(countdownLabel(om(94), NA), null);
    });

    it('sier «nå» når det er null minutter igjen', () => {
        assert.equal(countdownLabel(om(0), NA), 'nå');
    });

    it('gir null for avganger som er passert, framfor negative minutter', () => {
        assert.equal(countdownLabel(om(-1), NA), null);
    });

    it('gir null for ubrukelig dato', () => {
        assert.equal(countdownLabel(undefined, NA), null);
    });
});
```

- [ ] **Step 2: Kjør testen og se at den feiler**

Run: `yarn test`
Expected: FAIL — `Cannot find module './departureCountdown.js'`.

- [ ] **Step 3: Skriv implementasjonen**

Opprett `src/departures/departureCountdown.js`:

```js
/**
 * Nedtelling til avgang.
 *
 * Under grensen viser tavla «om 4 min», over den bare klokkeslettet. «Om 83
 * min» er ubrukelig informasjon, mens «om 4 min» er nettopp det man vil vite
 * når man står i billettkontoret og lurer på om man rekker toget.
 *
 * Kalleren skal regne fra FORVENTET tid, ikke planlagt. Et tog som er ti
 * minutter forsinket skal si «om 13 min», ikke «om 3 min» — ellers teller
 * tavla ned til et tidspunkt som ikke finnes.
 */

export const COUNTDOWN_THRESHOLD_MINUTES = 20;

/** Hele minutter til tidspunktet, eller null om datoen ikke er brukbar. */
export function minutesUntil(expectedAt, now) {
    if (!(expectedAt instanceof Date) || Number.isNaN(expectedAt.getTime())) {
        return null;
    }
    return Math.floor((expectedAt.getTime() - now.getTime()) / 60000);
}

/** Teksten i avgangskolonnen, eller null når klokkeslettet skal stå alene. */
export function countdownLabel(expectedAt, now) {
    const minutes = minutesUntil(expectedAt, now);
    if (minutes === null || minutes < 0 || minutes > COUNTDOWN_THRESHOLD_MINUTES) {
        return null;
    }
    return minutes === 0 ? 'nå' : `om ${minutes} min`;
}
```

- [ ] **Step 4: Kjør testen og se at den passerer**

Run: `yarn test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/departures/departureCountdown.js src/departures/departureCountdown.test.mjs
git commit -m "feat: nedtelling til avgang med 20-minuttersgrense"
```

---

### Task 4: Mapping av avganger

**Files:**
- Create: `src/departures/departureMapper.js`, `src/departures/departureMapper.test.mjs`

**Interfaces:**
- Consumes: ingenting.
- Produces: `situationText(summary)`, `toDeparture(call)`, `toDepartures(stopPlace)`, `isDelayed(departure)`.
  Formen på en avgang: `{ lineCode, transportMode, destination, platform, aimedAt: Date|null, expectedAt: Date|null, realtime: boolean, cancelled: boolean, situation: string }`.

- [ ] **Step 1: Skriv den feilende testen**

Opprett `src/departures/departureMapper.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isDelayed, situationText, toDeparture, toDepartures } from './departureMapper.js';

/** En EstimatedCall slik Journey Planner v3 faktisk svarer. */
function call(overrides = {}) {
    return {
        realtime: true,
        cancellation: false,
        aimedDepartureTime: '2026-08-07T10:27:00+02:00',
        expectedDepartureTime: '2026-08-07T10:27:00+02:00',
        destinationDisplay: { frontText: 'Arna' },
        quay: { publicCode: '1' },
        situations: [],
        serviceJourney: { line: { publicCode: 'L4', transportMode: 'rail' } },
        ...overrides,
    };
}

describe('toDeparture', () => {
    it('plukker ut feltene tavla trenger', () => {
        const d = toDeparture(call());
        assert.equal(d.lineCode, 'L4');
        assert.equal(d.transportMode, 'rail');
        assert.equal(d.destination, 'Arna');
        assert.equal(d.platform, '1');
        assert.equal(d.realtime, true);
        assert.equal(d.cancelled, false);
        assert.equal(d.situation, '');
        assert.ok(d.aimedAt instanceof Date);
        assert.equal(d.aimedAt.toISOString(), '2026-08-07T08:27:00.000Z');
    });

    it('leser innstilling fra cancellation, ikke cancelled', () => {
        // `cancelled` finnes ikke på EstimatedCall i v3 og gir valideringsfeil.
        assert.equal(toDeparture(call({ cancellation: true })).cancelled, true);
        assert.equal(toDeparture(call({ cancelled: true })).cancelled, false);
    });

    it('tåler at sporet mangler', () => {
        assert.equal(toDeparture(call({ quay: null })).platform, '');
        assert.equal(toDeparture(call({ quay: {} })).platform, '');
    });

    it('faller tilbake til planlagt tid når forventet mangler', () => {
        const d = toDeparture(call({ expectedDepartureTime: null }));
        assert.equal(d.expectedAt.toISOString(), d.aimedAt.toISOString());
    });

    it('tåler et svar med hull i', () => {
        const d = toDeparture({});
        assert.equal(d.lineCode, '');
        assert.equal(d.destination, '');
        assert.equal(d.aimedAt, null);
        assert.equal(d.realtime, false);
        assert.equal(d.cancelled, false);
    });

    it('regner rutetid som ikke-sanntid', () => {
        assert.equal(toDeparture(call({ realtime: false })).realtime, false);
    });
});

describe('situationText', () => {
    it('velger norsk når det finnes', () => {
        assert.equal(situationText([
            { value: 'Platform moved', language: 'en' },
            { value: 'Haldeplass flytta', language: 'no' },
        ]), 'Haldeplass flytta');
    });

    it('godtar nb og nn som norsk', () => {
        assert.equal(situationText([{ value: 'Bokmål', language: 'nb' }]), 'Bokmål');
        assert.equal(situationText([{ value: 'Nynorsk', language: 'nn' }]), 'Nynorsk');
    });

    it('viser engelsk framfor ingenting når norsk mangler', () => {
        assert.equal(situationText([{ value: 'Platform moved', language: 'en' }]), 'Platform moved');
    });

    it('gir tom streng når det ikke er noe å vise', () => {
        assert.equal(situationText([]), '');
        assert.equal(situationText(undefined), '');
        assert.equal(situationText([{ language: 'no' }]), '');
    });
});

describe('toDepartures', () => {
    it('mapper lista og tar med situasjonsteksten', () => {
        const departures = toDepartures({
            estimatedCalls: [
                call(),
                call({
                    serviceJourney: { line: { publicCode: 'R40', transportMode: 'rail' } },
                    situations: [{ summary: [{ value: 'Arbeid mellom Finse og Myrdal', language: 'no' }] }],
                }),
            ],
        });
        assert.equal(departures.length, 2);
        assert.equal(departures[1].lineCode, 'R40');
        assert.equal(departures[1].situation, 'Arbeid mellom Finse og Myrdal');
    });

    it('gir tom liste når stoppestedet mangler eller er tomt', () => {
        assert.deepEqual(toDepartures(null), []);
        assert.deepEqual(toDepartures({}), []);
        assert.deepEqual(toDepartures({ estimatedCalls: [] }), []);
    });
});

describe('isDelayed', () => {
    it('er sann bare når forventet er etter planlagt', () => {
        assert.equal(isDelayed(toDeparture(call())), false);
        assert.equal(isDelayed(toDeparture(call({ expectedDepartureTime: '2026-08-07T10:36:00+02:00' }))), true);
    });

    it('regner et tog som går før tida som ikke forsinket', () => {
        assert.equal(isDelayed(toDeparture(call({ expectedDepartureTime: '2026-08-07T10:25:00+02:00' }))), false);
    });

    it('tåler manglende tider', () => {
        assert.equal(isDelayed(toDeparture({})), false);
    });
});
```

- [ ] **Step 2: Kjør testen og se at den feiler**

Run: `yarn test`
Expected: FAIL — `Cannot find module './departureMapper.js'`.

- [ ] **Step 3: Skriv implementasjonen**

Opprett `src/departures/departureMapper.js`:

```js
/**
 * Oversettelsen fra Journey Planner v3 til appens egen form.
 *
 * Uten JSX og uten nettverk, slik at den kan testes med `node --test`.
 *
 * Tre ting her kan faktisk gå galt, og det er dem testene handler om:
 * innstilling heter `cancellation` og ikke `cancelled`, `quay.publicCode` kan
 * mangle, og forsinkelse er en SAMMENLIKNING mellom to tidspunkter — ikke et
 * felt APIet gir oss.
 */

const NORWEGIAN = ['no', 'nb', 'nn'];

/**
 * Teksten i en situasjon.
 *
 * `summary` er en liste av `{ value, language }`. Norsk foretrekkes, men en
 * situasjon som bare finnes på engelsk skal vises på engelsk framfor å
 * forsvinne — en reisende som ser en fremmed tekst er bedre stilt enn en som
 * ikke vet at noe er annerledes.
 */
export function situationText(summary) {
    if (!Array.isArray(summary)) {
        return '';
    }
    const withText = summary.filter((entry) => entry && typeof entry.value === 'string');
    const norwegian = withText.find((entry) => NORWEGIAN.includes(String(entry.language).toLowerCase()));
    return (norwegian ?? withText[0])?.value ?? '';
}

export function toDeparture(estimatedCall) {
    const line = estimatedCall?.serviceJourney?.line ?? {};
    const aimedAt = toDate(estimatedCall?.aimedDepartureTime);
    return {
        lineCode: asText(line.publicCode),
        transportMode: asText(line.transportMode),
        destination: asText(estimatedCall?.destinationDisplay?.frontText),
        platform: asText(estimatedCall?.quay?.publicCode),
        aimedAt,
        expectedAt: toDate(estimatedCall?.expectedDepartureTime) ?? aimedAt,
        realtime: estimatedCall?.realtime === true,
        cancelled: estimatedCall?.cancellation === true,
        situation: situationText(estimatedCall?.situations?.[0]?.summary),
    };
}

export function toDepartures(stopPlace) {
    const calls = stopPlace?.estimatedCalls;
    return Array.isArray(calls) ? calls.map(toDeparture) : [];
}

/** Forsinket er forventet ETTER planlagt. Et tog før tida er ikke forsinket. */
export function isDelayed(departure) {
    const { aimedAt, expectedAt } = departure;
    if (!(aimedAt instanceof Date) || !(expectedAt instanceof Date)) {
        return false;
    }
    return expectedAt.getTime() > aimedAt.getTime();
}

function toDate(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function asText(value) {
    return typeof value === 'string' ? value : '';
}
```

- [ ] **Step 4: Kjør testen og se at den passerer**

Run: `yarn test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/departures/departureMapper.js src/departures/departureMapper.test.mjs
git commit -m "feat: mapping av avganger fra journey planner"
```

---

### Task 5: Katalog, validering og regler

**Files:**
- Modify: `src/boards/boardConfig.js`, `src/boards/boardValidation.js`, `firestore.rules`
- Test: `src/boards/boardConfig.test.mjs`, `src/boards/boardValidation.test.mjs`, `firestore.rules.spec.mjs`

**Interfaces:**
- Consumes: `CAROUSEL_THEMES`, `DEFAULT_CAROUSEL_THEME` fra `carouselTheme.js` (Task 1).
- Produces: `departures` i `CAROUSEL_TYPES`, `STOP_PLACE_ID_PATTERN`, `isValidStopPlaceId(value)`; `carouselTheme` på normalisert config; feilnøkkelen `stopPlace` i valideringen.

- [ ] **Step 1: Skriv de feilende testene**

Legg til i `src/boards/boardConfig.test.mjs`, innenfor `describe('normalizeBoardConfig', …)`:

```js
    it('beholder en gyldig avgangsmodul', () => {
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            carousel: [{ type: 'departures', stopPlaceId: 'NSR:StopPlace:59983', stopPlaceName: 'Bergen stasjon' }],
        });
        assert.deepEqual(config.carousel, [
            { type: 'departures', stopPlaceId: 'NSR:StopPlace:59983', stopPlaceName: 'Bergen stasjon' },
        ]);
    });

    it('dropper avgangsmodul med ubrukelig stoppested', () => {
        for (const stopPlaceId of ['59983', 'NSR:Quay:1', 'NSR:StopPlace:', undefined]) {
            const config = normalizeBoardConfig('x', {
                ...bergenDocument(),
                carousel: [{ type: 'departures', stopPlaceId, stopPlaceName: 'Noe' }],
            });
            assert.deepEqual(config.carousel, [], String(stopPlaceId));
        }
    });

    it('setter avganger etter vær og plantegning i katalogrekkefølgen', () => {
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            carousel: [
                { type: 'departures', stopPlaceId: 'NSR:StopPlace:59983', stopPlaceName: 'Bergen stasjon' },
                { type: 'weather', name: 'Bergen', lat: 60.4, lng: 5.3 },
            ],
        });
        assert.deepEqual(config.carousel.map((m) => m.type), ['weather', 'departures']);
    });

    it('leser karusell-temaet', () => {
        assert.equal(normalizeBoardConfig('x', { ...bergenDocument(), carouselTheme: 'dark' }).carouselTheme, 'dark');
        assert.equal(normalizeBoardConfig('x', { ...bergenDocument(), carouselTheme: 'light' }).carouselTheme, 'light');
    });

    it('faller til lyst tema når feltet mangler eller er ukjent', () => {
        assert.equal(normalizeBoardConfig('x', bergenDocument()).carouselTheme, 'light');
        assert.equal(normalizeBoardConfig('x', { ...bergenDocument(), carouselTheme: 'lilla' }).carouselTheme, 'light');
    });
```

og i `describe('toFirestoreBoard', …)`:

```js
    it('skriver med karusell-temaet', () => {
        const config = normalizeBoardConfig('bergen-3', { ...bergenDocument(), carouselTheme: 'dark' });
        assert.equal(toFirestoreBoard(config, 'ola@entur.org').carouselTheme, 'dark');
    });
```

Legg til i `src/boards/boardValidation.test.mjs` — utvid først `validDraft()` med de nye feltene:

```js
        departuresEnabled: false,
        stopPlaceId: '',
        stopPlaceName: '',
        carouselTheme: 'light',
```

og legg til en ny blokk:

```js
describe('validateBoardInput — avganger og tema', () => {
    it('godtar en avgangsmodul med valgt stoppested', () => {
        const errors = validateBoardInput(validDraft({
            departuresEnabled: true,
            stopPlaceId: 'NSR:StopPlace:59983',
            stopPlaceName: 'Bergen stasjon',
        }));
        assert.equal(errors.stopPlace, undefined);
    });

    it('krever at et stoppested er valgt når modulen er på', () => {
        const errors = validateBoardInput(validDraft({ departuresEnabled: true }));
        assert.equal(errors.stopPlace, 'Søk opp og velg et stoppested');
    });

    it('avviser en id som ikke er et stoppested', () => {
        const errors = validateBoardInput(validDraft({
            departuresEnabled: true,
            stopPlaceId: 'NSR:Quay:1',
            stopPlaceName: 'Noe',
        }));
        assert.equal(errors.stopPlace, 'Søk opp og velg et stoppested');
    });

    it('ser bort fra stoppestedet når modulen er slått av', () => {
        assert.equal(validateBoardInput(validDraft({ stopPlaceId: 'tull' })).stopPlace, undefined);
    });

    it('avviser et ukjent tema', () => {
        assert.equal(validateBoardInput(validDraft({ carouselTheme: 'lilla' })).carouselTheme, 'Velg lyst eller mørkt');
        assert.equal(validateBoardInput(validDraft({ carouselTheme: 'dark' })).carouselTheme, undefined);
    });
});
```

Legg til i `firestore.rules.spec.mjs`, i `describe('boards', …)`:

```js
    it('godtar begge karusell-temaene', async () => {
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({ carouselTheme: 'dark' })));
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({ carouselTheme: 'light' })));
    });

    it('godtar en tavle uten carouselTheme — feltet er nytt i fase 3', async () => {
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board()));
    });

    it('avviser et ukjent karusell-tema', async () => {
        await assertFails(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({ carouselTheme: 'lilla' })));
    });
```

- [ ] **Step 2: Kjør testene og se at de feiler**

Run: `yarn test`
Expected: FAIL — `config.carouselTheme` er `undefined` og avgangsmodulen faller bort.

Run: `yarn test:rules`
Expected: FAIL på «avviser et ukjent karusell-tema» — reglene sier ingenting om feltet ennå, så det slipper gjennom.

- [ ] **Step 3: Utvid katalogen**

I `src/boards/boardConfig.js`:

1. Legg til importen øverst:

```js
import { CAROUSEL_THEMES, DEFAULT_CAROUSEL_THEME } from './carouselTheme.js';
```

2. Utvid `CAROUSEL_TYPES` og fjern den utdaterte kommentaren over `FLOORPLAN_PLANS`:

```js
export const CAROUSEL_TYPES = ['weather', 'floorplan', 'departures'];

export const FLOORPLAN_PLANS = ['bergen-3'];

/** NSR-id-en til et stoppested. Quay-er og bare tall er ikke stoppesteder. */
export const STOP_PLACE_ID_PATTERN = /^NSR:StopPlace:\d+$/;

export function isValidStopPlaceId(value) {
    return typeof value === 'string' && STOP_PLACE_ID_PATTERN.test(value);
}
```

3. Legg `carouselTheme` inn i `normalizeBoardConfig`, rett etter `top`:

```js
        carouselTheme: CAROUSEL_THEMES.includes(source.carouselTheme)
            ? source.carouselTheme
            : DEFAULT_CAROUSEL_THEME,
```

4. Legg feltet inn i `toFirestoreBoard`, rett etter `top`:

```js
        carouselTheme: config.carouselTheme,
```

5. Legg normalisereren inn i `CAROUSEL_NORMALIZERS`, etter `floorplan`:

```js
    // Uten et brukbart stoppested kan modulen ikke slå opp noe. Da er det bedre
    // å la den falle bort enn å vise en tom slide karusellen bruker 30 sekunder på.
    departures: (module) => (
        isValidStopPlaceId(module.stopPlaceId)
            ? {
                type: 'departures',
                stopPlaceId: module.stopPlaceId,
                stopPlaceName: asText(module.stopPlaceName, PLACE_NAME_MAX_LENGTH),
            }
            : null
    ),
```

- [ ] **Step 4: Utvid valideringen**

I `src/boards/boardValidation.js`:

1. Utvid importen fra `boardConfig.js` med `isValidStopPlaceId`, og legg til:

```js
import { CAROUSEL_THEMES } from './carouselTheme.js';
```

2. Legg denne blokka inn i `validateBoardInput`, rett før `return errors;`:

```js
    if (draft.departuresEnabled && !isValidStopPlaceId(draft.stopPlaceId)) {
        errors.stopPlace = 'Søk opp og velg et stoppested';
    }

    if (!CAROUSEL_THEMES.includes(draft.carouselTheme)) {
        errors.carouselTheme = 'Velg lyst eller mørkt';
    }
```

- [ ] **Step 5: Utvid reglene**

I `firestore.rules`, legg til denne linja i `isValidBoard`, rett etter `d.top is map && d.top.kind in ['video', 'logo']`:

```
        && (!d.keys().hasAny(['carouselTheme']) || d.carouselTheme in ['light', 'dark'])
```

Feltet er nytt i fase 3, og tavler skrevet før den finnes uten det. Regelen godtar derfor at det mangler, men ikke at det har en verdi appen ikke kjenner.

- [ ] **Step 6: Kjør begge testsuitene**

Run: `yarn test`
Expected: PASS.

Run: `yarn test:rules`
Expected: PASS. Krever fri port 8080 — kjører du emulatoren fra før, stopp den først.

- [ ] **Step 7: Commit**

```bash
git add src/boards/boardConfig.js src/boards/boardValidation.js src/boards/boardConfig.test.mjs src/boards/boardValidation.test.mjs firestore.rules firestore.rules.spec.mjs
git commit -m "feat: avgangsmodul og karusell-tema i katalog, validering og regler"
```

---

### Task 6: Entur-klienten

**Files:**
- Create: `src/departures/enturDepartures.js`, `src/departures/enturDepartures.test.mjs`, `src/departures/stopPlaceSearch.js`, `src/departures/stopPlaceSearch.test.mjs`

**Interfaces:**
- Consumes: `toDepartures` fra `departureMapper.js` (Task 4); `isValidStopPlaceId` fra `boardConfig.js` (Task 5).
- Produces:
  - `ET_CLIENT_NAME`, `DEPARTURE_REFRESH_MS`, `DEPARTURE_COUNT`, `TIME_RANGE_SECONDS`
  - `fetchDepartures(stopPlaceId, { fetchImpl })` → `Promise<{ departures: Array|null }>`
  - `startDeparturePolling({ stopPlaceId, onData, fetchDepartures, intervalMs, setTimer, clearTimer })` → stopp-funksjon
  - `searchStopPlaces(text, { fetchImpl })` → `Promise<Array<{ id, label }>>`

- [ ] **Step 1: Skriv den feilende testen for henting og polling**

Opprett `src/departures/enturDepartures.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ET_CLIENT_NAME, fetchDepartures, startDeparturePolling } from './enturDepartures.js';

function svar(estimatedCalls) {
    return {
        ok: true,
        json: async () => ({ data: { stopPlace: { name: 'Bergen stasjon', estimatedCalls } } }),
    };
}

const EN_AVGANG = [{
    realtime: true,
    cancellation: false,
    aimedDepartureTime: '2026-08-07T10:27:00+02:00',
    expectedDepartureTime: '2026-08-07T10:27:00+02:00',
    destinationDisplay: { frontText: 'Arna' },
    quay: { publicCode: '1' },
    situations: [],
    serviceJourney: { line: { publicCode: 'L4', transportMode: 'rail' } },
}];

describe('fetchDepartures', () => {
    it('sender ET-Client-Name, som Entur krever', async () => {
        let sett = null;
        await fetchDepartures('NSR:StopPlace:59983', {
            fetchImpl: async (url, options) => {
                sett = { url, options };
                return svar(EN_AVGANG);
            },
        });
        assert.match(sett.url, /journey-planner\/v3\/graphql$/);
        assert.equal(sett.options.method, 'POST');
        assert.equal(sett.options.headers['ET-Client-Name'], ET_CLIENT_NAME);
        assert.equal(sett.options.headers['Content-Type'], 'application/json');
    });

    it('sender stoppestedet som variabel og ber om innstilte avganger', async () => {
        let body = null;
        await fetchDepartures('NSR:StopPlace:59983', {
            fetchImpl: async (_url, options) => {
                body = JSON.parse(options.body);
                return svar(EN_AVGANG);
            },
        });
        assert.equal(body.variables.stopPlaceId, 'NSR:StopPlace:59983');
        assert.match(body.query, /includeCancelledTrips:\s*true/);
        // `cancelled` finnes ikke på EstimatedCall i v3 og gir valideringsfeil.
        assert.doesNotMatch(body.query, /\bcancelled\b/);
    });

    it('gir mappede avganger', async () => {
        const { departures } = await fetchDepartures('NSR:StopPlace:59983', {
            fetchImpl: async () => svar(EN_AVGANG),
        });
        assert.equal(departures.length, 1);
        assert.equal(departures[0].lineCode, 'L4');
        assert.equal(departures[0].destination, 'Arna');
    });

    it('gir tom liste når stoppestedet ikke finnes', async () => {
        const { departures } = await fetchDepartures('NSR:StopPlace:1', {
            fetchImpl: async () => ({ ok: true, json: async () => ({ data: { stopPlace: null } }) }),
        });
        assert.deepEqual(departures, []);
    });

    it('gir null framfor å kaste ved nettverksfeil', async () => {
        const { departures } = await fetchDepartures('NSR:StopPlace:59983', {
            fetchImpl: async () => { throw new Error('nede'); },
        });
        assert.equal(departures, null);
    });

    it('gir null ved feilkode og ved GraphQL-feil', async () => {
        const feilkode = await fetchDepartures('NSR:StopPlace:59983', {
            fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }),
        });
        assert.equal(feilkode.departures, null);

        const graphqlFeil = await fetchDepartures('NSR:StopPlace:59983', {
            fetchImpl: async () => ({ ok: true, json: async () => ({ errors: [{ message: 'nei' }] }) }),
        });
        assert.equal(graphqlFeil.departures, null);
    });

    it('avviser en id som ikke er et stoppested uten å ringe APIet', async () => {
        let kalt = false;
        const { departures } = await fetchDepartures('tull', {
            fetchImpl: async () => { kalt = true; return svar([]); },
        });
        assert.equal(departures, null);
        assert.equal(kalt, false);
    });
});

describe('startDeparturePolling', () => {
    function rigg() {
        const timers = [];
        return {
            timers,
            setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
            clearTimer: (id) => { timers[id - 1] = null; },
        };
    }

    it('henter én gang med en gang og rapporterer', async () => {
        const rapportert = [];
        const { setTimer, clearTimer } = rigg();
        startDeparturePolling({
            stopPlaceId: 'NSR:StopPlace:59983',
            onData: (d) => rapportert.push(d),
            fetchDepartures: async () => ({ departures: [{ lineCode: 'L4' }] }),
            setTimer,
            clearTimer,
        });
        await Promise.resolve();
        await Promise.resolve();
        assert.equal(rapportert.length, 1);
        assert.equal(rapportert[0][0].lineCode, 'L4');
    });

    it('planlegger neste henting etter intervallet', async () => {
        const { timers, setTimer, clearTimer } = rigg();
        startDeparturePolling({
            stopPlaceId: 'NSR:StopPlace:59983',
            onData: () => {},
            fetchDepartures: async () => ({ departures: [] }),
            intervalMs: 60000,
            setTimer,
            clearTimer,
        });
        await Promise.resolve();
        await Promise.resolve();
        assert.equal(timers[0].ms, 60000);
    });

    it('beholder forrige liste når en henting feiler', async () => {
        const rapportert = [];
        const { setTimer, clearTimer } = rigg();
        startDeparturePolling({
            stopPlaceId: 'NSR:StopPlace:59983',
            onData: (d) => rapportert.push(d),
            fetchDepartures: async () => ({ departures: null }),
            setTimer,
            clearTimer,
        });
        await Promise.resolve();
        await Promise.resolve();
        assert.equal(rapportert.length, 0);
    });

    it('stopp hindrer at en henting underveis rapporterer', async () => {
        const rapportert = [];
        const { setTimer, clearTimer } = rigg();
        const stopp = startDeparturePolling({
            stopPlaceId: 'NSR:StopPlace:59983',
            onData: (d) => rapportert.push(d),
            fetchDepartures: async () => ({ departures: [] }),
            setTimer,
            clearTimer,
        });
        stopp();
        await Promise.resolve();
        await Promise.resolve();
        assert.equal(rapportert.length, 0);
    });
});
```

- [ ] **Step 2: Kjør testen og se at den feiler**

Run: `yarn test`
Expected: FAIL — `Cannot find module './enturDepartures.js'`.

- [ ] **Step 3: Skriv klienten**

Opprett `src/departures/enturDepartures.js`:

```js
/**
 * Henting og polling av avganger fra Entur Journey Planner v3.
 *
 * Ligger utenfor React fordi karusellen bare rendrer den aktive sliden:
 * avgangskomponenten avmonteres og remonteres hver gang sliden kommer tilbake,
 * så all henting som bor i en `useEffect` der inne ville hentet like ofte.
 * Pollingen eies derfor av `App`, som står montert hele tiden. Samme grunn som
 * for værmodulen, se `App.jsx`.
 *
 * APIet er en åpen tjeneste uten nøkkel, men krever headeren `ET-Client-Name`.
 * Det er CORS-åpent (`access-control-allow-origin: *`), så kiosken kaller det
 * direkte fra nettleseren uten backend.
 */
import { isValidStopPlaceId } from '../boards/boardConfig.js';
import { toDepartures } from './departureMapper.js';

const ENDPOINT = 'https://api.entur.io/journey-planner/v3/graphql';

/** Formen Entur ber om: <selskap>-<applikasjon>, små bokstaver, uten mellomrom. */
export const ET_CLIENT_NAME = 'entur-velkomsttavle';

export const DEPARTURE_REFRESH_MS = 60 * 1000;
export const DEPARTURE_COUNT = 6;
export const TIME_RANGE_SECONDS = 3 * 60 * 60;

// `includeCancelledTrips: true` er et bevisst valg: et innstilt tog skal vises
// overstrøket, ikke forsvinne. Står du i billettkontoret og toget bare er borte
// fra tavla, tror du at du har husket feil.
//
// Feltet for innstilling heter `cancellation`. `cancelled` finnes ikke på
// EstimatedCall i v3 og gir valideringsfeil fra APIet.
const QUERY = `
query Avganger($stopPlaceId: String!, $count: Int!, $timeRange: Int!) {
  stopPlace(id: $stopPlaceId) {
    id
    name
    estimatedCalls(numberOfDepartures: $count, timeRange: $timeRange, includeCancelledTrips: true) {
      realtime
      cancellation
      aimedDepartureTime
      expectedDepartureTime
      destinationDisplay { frontText }
      quay { publicCode }
      situations { summary { value language } }
      serviceJourney { line { publicCode transportMode } }
    }
  }
}`;

/**
 * Henter avgangene for ett stoppested. Feiler aldri utad — nettverksfeil,
 * feilkoder og GraphQL-feil gir `{ departures: null }`, slik at kalleren kan
 * beholde forrige liste. En tavle som viser avganger fra et minutt siden er
 * langt bedre enn en tom tavle.
 */
export async function fetchDepartures(stopPlaceId, { fetchImpl = fetch } = {}) {
    if (!isValidStopPlaceId(stopPlaceId)) {
        console.warn('Ugyldig stoppested-id, hopper over henting', stopPlaceId);
        return { departures: null };
    }
    try {
        const response = await fetchImpl(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'ET-Client-Name': ET_CLIENT_NAME },
            body: JSON.stringify({
                query: QUERY,
                variables: { stopPlaceId, count: DEPARTURE_COUNT, timeRange: TIME_RANGE_SECONDS },
            }),
        });
        if (!response.ok) {
            console.warn(`Journey Planner svarte ${response.status}`);
            return { departures: null };
        }
        const body = await response.json();
        if (body.errors) {
            console.warn('Journey Planner svarte med feil', body.errors);
            return { departures: null };
        }
        return { departures: toDepartures(body.data?.stopPlace) };
    } catch (error) {
        console.warn('Klarte ikke hente avganger', error);
        return { departures: null };
    }
}

/**
 * Starter polling: henter én gang med en gang, og deretter hvert
 * `intervalMs`. Returnerer en stopp-funksjon som avbryter både den planlagte
 * hentingen og en henting som er underveis.
 */
export function startDeparturePolling({
    stopPlaceId,
    onData,
    fetchDepartures: fetchImpl = fetchDepartures,
    intervalMs = DEPARTURE_REFRESH_MS,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
}) {
    let stopped = false;
    let timer = null;

    async function refresh() {
        const { departures } = await fetchImpl(stopPlaceId);
        if (stopped) return;
        // Uten data beholder vi forrige liste framfor å tømme skjermen
        if (departures) onData(departures);
        timer = setTimer(refresh, intervalMs);
    }

    refresh();

    return function stop() {
        stopped = true;
        if (timer !== null) clearTimer(timer);
    };
}
```

- [ ] **Step 4: Skriv testen for stoppestedssøket**

Opprett `src/departures/stopPlaceSearch.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { searchStopPlaces } from './stopPlaceSearch.js';

function geocoderSvar(features) {
    return { ok: true, json: async () => ({ features }) };
}

function treff(id, label) {
    return { properties: { id, label } };
}

describe('searchStopPlaces', () => {
    it('gir id og etikett for hvert treff', async () => {
        const resultat = await searchStopPlaces('Bergen stasjon', {
            fetchImpl: async () => geocoderSvar([
                treff('NSR:StopPlace:59983', 'Bergen stasjon, Bergen'),
                treff('NSR:StopPlace:398', 'Arna stasjon, Bergen'),
            ]),
        });
        assert.deepEqual(resultat, [
            { id: 'NSR:StopPlace:59983', label: 'Bergen stasjon, Bergen' },
            { id: 'NSR:StopPlace:398', label: 'Arna stasjon, Bergen' },
        ]);
    });

    it('kaster treff som ikke er stoppesteder', async () => {
        const resultat = await searchStopPlaces('Bergen', {
            fetchImpl: async () => geocoderSvar([
                treff('NSR:StopPlace:59983', 'Bergen stasjon'),
                treff('NSR:Quay:1', 'En perrong'),
                treff(undefined, 'Uten id'),
            ]),
        });
        assert.equal(resultat.length, 1);
        assert.equal(resultat[0].id, 'NSR:StopPlace:59983');
    });

    it('sender ET-Client-Name og søketeksten', async () => {
        let sett = null;
        await searchStopPlaces('Bergen stasjon', {
            fetchImpl: async (url, options) => {
                sett = { url, options };
                return geocoderSvar([]);
            },
        });
        assert.match(sett.url, /geocoder\/v1\/autocomplete/);
        assert.match(sett.url, /text=Bergen%20stasjon/);
        assert.match(sett.url, /layers=venue/);
        assert.equal(sett.options.headers['ET-Client-Name'], 'entur-velkomsttavle');
    });

    it('gir tom liste for tomt søk, uten å ringe APIet', async () => {
        let kalt = false;
        const resultat = await searchStopPlaces('  ', {
            fetchImpl: async () => { kalt = true; return geocoderSvar([]); },
        });
        assert.deepEqual(resultat, []);
        assert.equal(kalt, false);
    });

    it('gir tom liste framfor å kaste når søket feiler', async () => {
        const resultat = await searchStopPlaces('Bergen', {
            fetchImpl: async () => { throw new Error('nede'); },
        });
        assert.deepEqual(resultat, []);
    });
});
```

- [ ] **Step 5: Skriv søket**

Opprett `src/departures/stopPlaceSearch.js`:

```js
/**
 * Søk etter stoppesteder i Enturs geocoder.
 *
 * Brukes bare av admin. `NSR:StopPlace:59983` er ikke noe et menneske skal
 * taste, så oppsettskjemaet har et søkefelt framfor et id-felt.
 *
 * `layers=venue` er det som gir stoppesteder. Uten filteret kommer også
 * adresser og gater, som ikke har noen avganger.
 */
import { isValidStopPlaceId } from '../boards/boardConfig.js';
import { ET_CLIENT_NAME } from './enturDepartures.js';

const ENDPOINT = 'https://api.entur.io/geocoder/v1/autocomplete';
const MAX_RESULTS = 5;

export async function searchStopPlaces(text, { fetchImpl = fetch } = {}) {
    const query = typeof text === 'string' ? text.trim() : '';
    if (query === '') {
        return [];
    }
    const url = `${ENDPOINT}?text=${encodeURIComponent(query)}&size=${MAX_RESULTS}&layers=venue`;
    try {
        const response = await fetchImpl(url, { headers: { 'ET-Client-Name': ET_CLIENT_NAME } });
        if (!response.ok) {
            console.warn(`Geocoderen svarte ${response.status}`);
            return [];
        }
        const body = await response.json();
        return (body.features ?? [])
            .map((feature) => ({ id: feature?.properties?.id, label: feature?.properties?.label ?? '' }))
            .filter((treff) => isValidStopPlaceId(treff.id));
    } catch (error) {
        console.warn('Klarte ikke søke etter stoppested', error);
        return [];
    }
}
```

- [ ] **Step 6: Kjør testene**

Run: `yarn test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/departures/enturDepartures.js src/departures/enturDepartures.test.mjs src/departures/stopPlaceSearch.js src/departures/stopPlaceSearch.test.mjs
git commit -m "feat: henting av avganger og søk etter stoppested mot entur"
```

---

### Task 7: Avgangs-komponenten

**Files:**
- Create: `src/components/Departures.jsx`

**Interfaces:**
- Consumes: `carouselPalette` (Task 1), `lineAppearance` (Task 2), `countdownLabel` (Task 3), `isDelayed` (Task 4).
- Produces: `<Departures departures={Array|null} stopPlaceName={string} theme={'light'|'dark'} />`.

Komponenten er ren presentasjon og tar imot ferdige data. Den kan ikke enhetstestes — kodebasen har ikke oppsett for å rendre JSX i test — så den verifiseres visuelt i Task 9.

**Avvik fra speccen, bevisst.** Speccen skiller «ukjent stoppested» fra «tom liste» med hver sin melding. Det lar seg ikke gjøre uten å utvide `fetchDepartures` med et eget signal, fordi `stopPlace: null` og `estimatedCalls: []` begge blir en tom liste gjennom `toDepartures`. Siden normaliseringen allerede kaster id-er som ikke er stoppesteder, er «gyldig id som ikke finnes» et tilfelle som bare oppstår ved feilskrevet oppsett. Begge gir derfor **«Ingen avganger de neste 3 timene»**, og vi legger ikke inn maskineri for å skille dem.

- [ ] **Step 1: Skriv komponenten**

Opprett `src/components/Departures.jsx`:

```jsx
import { Fragment, useEffect, useState } from 'react';
import { Heading3, Paragraph } from '@entur/typography';
import { colors } from '@entur/tokens';

import { carouselPalette } from '../boards/carouselTheme';
import { lineAppearance } from '../departures/lineAppearance';
import { countdownLabel } from '../departures/departureCountdown';
import { isDelayed } from '../departures/departureMapper';

/**
 * Hvor ofte nedtellingen regnes om. Ingen nettverkskall — det er ren regning
 * på data vi allerede har. Å binde den til hentingen ville enten gitt et tall
 * som står stille i et minutt, eller seksti ganger så mange kall som nødvendig.
 */
const TICK_MS = 15 * 1000;

const klokke = new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit' });

function tid(date) {
    return date instanceof Date ? klokke.format(date) : '';
}

/** Merket med linjekoden. Farge fra kategori, ellers transportmiddel. */
function LineBadge({ lineCode, transportMode, theme }) {
    const { fill, text, border } = lineAppearance(lineCode, transportMode, theme);
    return (
        <span style={{
            display: 'inline-block', minWidth: '3.5rem', textAlign: 'center',
            backgroundColor: fill, color: text, border,
            borderRadius: '8px', padding: '0.25rem 0.6rem',
            fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1,
        }}>
            {lineCode || '–'}
        </span>
    );
}

/** Gul brikke ved forsinkelse, rød ved innstilling. Aldri farget tekst. */
function Chip({ label, tone, theme }) {
    const dark = theme === 'dark';
    const fill = tone === 'cancelled'
        ? (dark ? colors.validation.lavaContrast : colors.validation.lava)
        : colors.validation.canary;
    // Gul har mørk tekst i begge temaer. Rød har hvit tekst i lyst tema, der
    // fyllet er mettet, og mørk i mørkt, der fyllet er lyst.
    const text = tone === 'cancelled' && !dark ? '#ffffff' : colors.brand.blue;
    return (
        <span style={{
            backgroundColor: fill, color: text,
            border: dark ? 'none' : `2px solid ${colors.brand.blue}`,
            borderRadius: '999px', padding: '0.15rem 0.75rem',
            fontSize: '1.375rem', fontWeight: 600, whiteSpace: 'nowrap',
        }}>
            {label}
        </span>
    );
}

function Departures({ departures, stopPlaceName, theme }) {
    const palette = carouselPalette(theme);
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), TICK_MS);
        return () => clearInterval(id);
    }, []);

    if (departures === null) {
        return <Melding palette={palette}>Henter avganger …</Melding>;
    }
    if (departures.length === 0) {
        return <Melding palette={palette}>Ingen avganger de neste 3 timene</Melding>;
    }

    return (
        <div style={{ width: '100%', height: '100%', boxSizing: 'border-box', padding: '1.5rem 2.5rem', color: palette.text, overflow: 'hidden' }}>
            <Heading3 style={{ color: palette.text, margin: '0 0 1rem' }}>
                Avganger fra {stopPlaceName}
            </Heading3>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto auto',
                columnGap: '1.5rem', rowGap: '0.75rem',
                alignItems: 'center', fontSize: '1.75rem',
            }}>
                {departures.map((departure, index) => {
                    const nedtelling = countdownLabel(departure.expectedAt, now);
                    const forsinket = isDelayed(departure);
                    return (
                        <Fragment key={`${departure.lineCode}-${departure.aimedAt?.toISOString() ?? index}`}>
                            <LineBadge lineCode={departure.lineCode} transportMode={departure.transportMode} theme={theme} />
                            <span>
                                {departure.destination}
                                {departure.situation && (
                                    <span style={{ display: 'block', fontSize: '1.25rem', opacity: 0.85 }}>
                                        ↳ {departure.situation}
                                    </span>
                                )}
                            </span>
                            <span style={{ whiteSpace: 'nowrap' }}>
                                {departure.platform ? `Spor ${departure.platform}` : ''}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                                {departure.cancelled && <Chip label="Innstilt" tone="cancelled" theme={theme} />}
                                {!departure.cancelled && nedtelling && <Chip label={nedtelling} tone="delayed" theme={theme} />}
                                {(departure.cancelled || forsinket) && (
                                    <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>{tid(departure.aimedAt)}</span>
                                )}
                                {!departure.cancelled && (
                                    <span style={{ fontWeight: 700 }}>{tid(departure.expectedAt)}</span>
                                )}
                                {!departure.realtime && !departure.cancelled && (
                                    <span style={{ fontSize: '1rem', opacity: 0.7 }}>rutetid</span>
                                )}
                            </span>
                        </Fragment>
                    );
                })}
            </div>
        </div>
    );
}

function Melding({ palette, children }) {
    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: palette.text }}>
            <Paragraph style={{ color: palette.text }}>{children}</Paragraph>
        </div>
    );
}

export default Departures;
```

- [ ] **Step 2: Sjekk at filen parser**

`yarn build` når ikke komponenten før den importeres i Task 9, så parse den direkte med esbuild, som følger med Vite:

```bash
npx esbuild --outfile=/dev/null src/components/Departures.jsx && echo ok
```
Expected: `ok`.

Ikke `--loader=jsx` — det flagget gjelder bare når esbuild leser fra stdin, og gir «"loader" without extension only applies when reading from stdin» for en filsti.

- [ ] **Step 3: Commit**

```bash
git add src/components/Departures.jsx
git commit -m "feat: avgangs-slide med nedtelling, avvik og linjemerke"
```

---

### Task 8: Tema i karusellen, været og plantegningen

**Files:**
- Modify: `src/components/Carousel.jsx`, `src/components/Weather.jsx`, `src/floorplan/OfficeMap.jsx`

**Interfaces:**
- Consumes: `carouselPalette` (Task 1).
- Produces: `<Carousel slides={…} theme={'light'|'dark'} />`, `<Weather weather={…} theme={…} />`, `<OfficeMap theme={…} />`.

- [ ] **Step 1: Gi karusellen tema, og rett kontrastfeilen**

I `src/components/Carousel.jsx`:

1. Bytt importene og fjern `LAVENDER`-konstanten:

```jsx
import { useState, useEffect, useRef } from 'react';
import { base } from '@entur/tokens';

import { carouselPalette } from '../boards/carouselTheme';

const CORAL = base.light.baseColors.shape.highlight; // #ff5959
const SLIDE_DURATION = 30000; // 30 sek per slide
const TICK = 100; // ms mellom hver progress-oppdatering
```

2. Endre signaturen til `function Carousel({ slides, theme })` og legg inn paletten rett etter hooks-kallene, før den tomme-lista-vakten:

```jsx
    const palette = carouselPalette(theme);
```

3. Bytt de tre stedene som bruker farge:

```jsx
        <div style={{ flex: 1, minHeight: 0, width: '100vw', backgroundColor: palette.background, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', height: '6px', backgroundColor: palette.background, flex: '0 0 auto' }}>
                <div style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: CORAL }} />
            </div>
```

og ikonfargen:

```jsx
                        <Icon
                            key={slide.key}
                            size={48}
                            color={i === index ? palette.iconActive : palette.iconInactive}
                        />
```

Den siste linja er rettelsen: inaktive ikoner var `#ffffff` i begge tilfeller, altså hvitt på lavendel med kontrast 1.39. Nå blir de mørkeblå i lyst tema og hvite i mørkt.

- [ ] **Step 2: Gi været tema**

I `src/components/Weather.jsx`:

1. Legg til importen:

```jsx
import { carouselPalette } from '../boards/carouselTheme';
```

2. Endre signaturen til `export default function Weather({ weather, theme })` og legg inn paletten rett etter de tidlige returene:

```jsx
    const palette = carouselPalette(theme);
    const dark = palette.theme === 'dark';
```

3. **Fjern modulens egen bakgrunn.** Bytt `backgroundColor: semantic.fill.background.subdued.light` i ytterste `div` (linje 85) med `color: palette.text`. Bakgrunnen hører til karusellen; maler modulen sin egen, blir været et lavendelpanel som svever på mørk bunn.

4. **Skill «Nå»-kortet fra bakgrunnen.** Kortet er i dag en mørkeblå gradient som er nesten nøyaktig fargen på den mørke karusellen, så det forsvinner. Legg til en kant i mørkt tema. I `style`-objektet til nå-kortet (linje 90–97), etter `background`:

```jsx
                    border: dark ? `2px solid ${palette.panel}` : 'none',
```

5. **Bytt fersken-kortene.** `PEACH` er lyst med mørk tekst og fungerer bare i lyst tema. Erstatt de to stedene som bruker `backgroundColor: PEACH` (linje 127 og 152) med:

```jsx
                        backgroundColor: dark ? palette.panel : PEACH,
                        color: dark ? '#ffffff' : undefined,
```

6. Fjern importen av `semantic` fra `@entur/tokens` hvis den ikke lenger brukes.

- [ ] **Step 3: Gi plantegningen et lyst panel**

I `src/floorplan/OfficeMap.jsx`, endre signaturen til `function OfficeMap({ theme })` og legg et lyst panel rundt tegningen i mørkt tema:

```jsx
import BergenThird from './BergenThird';
import labels from './bergenThirdLabels.json';
import { carouselPalette } from '../boards/carouselTheme';

/**
 * Plantegningen står alltid på lys flate.
 *
 * BergenThird.jsx og romfargene synkes ukentlig fra `entur/plantegning` av en
 * GitHub Action, så en restyling ville blitt overskrevet neste mandag.
 * Romfargene er lyse pasteller som fungerer på hvitt; panelet gjør at de
 * fortsetter å gjøre det også når karusellen er mørk.
 */
function OfficeMap({ theme }) {
    const palette = carouselPalette(theme);
    const dark = palette.theme === 'dark';
    return (
        <div style={{ width: '100%', height: '100%', backgroundColor: 'transparent', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem 0' }}>
            <div style={{
                flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%',
                backgroundColor: dark ? '#ffffff' : 'transparent',
                borderRadius: dark ? '16px' : 0,
                padding: dark ? '1rem' : 0,
                boxSizing: 'border-box',
            }}>
                <BergenThird labels={labels} />
            </div>
        </div>
    );
}

export default OfficeMap;
```

- [ ] **Step 4: Bygg**

Run: `yarn test && yarn build`
Expected: begge grønne. `App.jsx` sender ennå ikke `theme`, så alle tre komponentene får `undefined` og faller til lyst — altså uendret utseende. Det kobles i Task 9.

- [ ] **Step 5: Commit**

```bash
git add src/components/Carousel.jsx src/components/Weather.jsx src/floorplan/OfficeMap.jsx
git commit -m "feat: tema på karusellen, været og plantegningen"
```

---

### Task 9: App kobler alt sammen

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `startDeparturePolling` (Task 6), `<Departures>` (Task 7), `<Carousel theme>`, `<Weather theme>`, `<OfficeMap theme>` (Task 8), `findModule` fra `boardConfig.js`.
- Produces: en tavle som viser avganger og respekterer temaet.

- [ ] **Step 1: Legg inn importene**

I `src/App.jsx`:

```jsx
import Departures from './components/Departures';
import { startDeparturePolling } from './departures/enturDepartures';
import { ClockIcon, SunCloudIcon, MapIcon } from '@entur/icons';
```

(erstatt den eksisterende `@entur/icons`-linja med den over).

- [ ] **Step 2: Legg inn tilstand og polling**

Etter `const [weather, setWeather] = useState(null);`:

```jsx
    const [departures, setDepartures] = useState(null);
```

og etter vær-pollingen, denne blokka:

```jsx
    const departuresModule = config ? findModule(config.carousel, 'departures') : undefined;

    // Avhengigheten er en streng, ikke modul-objektet. onSnapshot gir et nytt
    // objekt for hver oppdatering av tavla, og et objekt her ville startet
    // pollingen på nytt hver gang noen lagret i admin.
    const stopPlaceId = departuresModule ? departuresModule.stopPlaceId : null;

    // Pollingen ligger her, ikke i Departures: karusellen rendrer bare den
    // aktive sliden, så komponenten avmonteres og remonteres hver gang sliden
    // kommer tilbake.
    useEffect(() => {
        if (stopPlaceId === null) {
            return undefined;
        }
        setDepartures(null);
        return startDeparturePolling({ stopPlaceId, onData: setDepartures });
    }, [stopPlaceId]);
```

Merk at `departuresModule` må stå etter `const config = …`, sammen med `weatherModule`.

- [ ] **Step 3: Legg til sliden og send temaet videre**

Utvid `slides`-mappingen med en gren for avganger, og send `theme` til de to andre:

```jsx
    const slides = config.carousel.map((module) => {
        if (module.type === 'weather') {
            return {
                key: 'weather',
                Icon: SunCloudIcon,
                node: <ErrorBoundary><Weather weather={weather} theme={config.carouselTheme} /></ErrorBoundary>,
            };
        }
        if (module.type === 'floorplan') {
            return {
                key: 'floorplan',
                Icon: MapIcon,
                node: <ErrorBoundary><OfficeMap theme={config.carouselTheme} /></ErrorBoundary>,
            };
        }
        if (module.type === 'departures') {
            return {
                key: 'departures',
                // ClockIcon, ikke TrainIcon: modulen tar hvilket som helst
                // stoppested, og et togikon ville løyet på en bussterminal.
                Icon: ClockIcon,
                node: (
                    <ErrorBoundary>
                        <Departures
                            departures={departures}
                            stopPlaceName={module.stopPlaceName}
                            theme={config.carouselTheme}
                        />
                    </ErrorBoundary>
                ),
            };
        }
        return null;
    }).filter(Boolean);
```

og send temaet til karusellen:

```jsx
            {hasCarousel && <Carousel slides={slides} theme={config.carouselTheme} />}
```

- [ ] **Step 4: Verifiser mot emulatoren**

Start emulatoren i én terminal:

```bash
yarn firebase emulators:start --only auth,firestore --project ent-tavleber-prd
```

Legg inn en tavle med avganger og mørkt tema:

```bash
BASE="http://127.0.0.1:8080/v1/projects/ent-tavleber-prd/databases/(default)/documents"
curl -s -o /dev/null -w 'tavle: %{http_code}\n' -X PATCH \
  -H 'Authorization: Bearer owner' -H 'Content-Type: application/json' \
  "$BASE/boards/billettkontor" -d '{"fields":{
    "name":{"stringValue":"Billettkontoret"},
    "placeName":{"stringValue":"Bergen"},
    "carouselTheme":{"stringValue":"dark"},
    "top":{"mapValue":{"fields":{"kind":{"stringValue":"logo"}}}},
    "middle":{"arrayValue":{"values":[
      {"mapValue":{"fields":{"type":{"stringValue":"greeting"},"text":{"stringValue":"auto"},"staffImage":{"booleanValue":true}}}}
    ]}},
    "carousel":{"arrayValue":{"values":[
      {"mapValue":{"fields":{"type":{"stringValue":"weather"},"name":{"stringValue":"Bergen"},"lat":{"doubleValue":60.39299},"lng":{"doubleValue":5.32415}}}},
      {"mapValue":{"fields":{"type":{"stringValue":"departures"},"stopPlaceId":{"stringValue":"NSR:StopPlace:59983"},"stopPlaceName":{"stringValue":"Bergen stasjon"}}}}
    ]}},
    "createdBy":{"stringValue":"test@entur.org"},
    "updatedBy":{"stringValue":"test@entur.org"}
  }}'
```

Med `yarn dev`, åpne http://localhost:3000/t/billettkontor og sjekk i denne rekkefølgen:

1. **Karusellen er mørkeblå**, og de inaktive ikonene er hvite og synlige. Sammenlikn med `/t/bergen-3`, som er lys — der skal de inaktive ikonene nå være mørkeblå, ikke usynlige.
2. **Avgangs-sliden viser ekte avganger** fra Bergen stasjon, med linjemerker: L4 grønn, R40 rød, F4 blå.
3. **Nedtelling** står på avganger under 20 minutter, klokkeslett alene på resten.
4. **Værmodulen på mørkt tema:** ingen lavendel-flate, «Nå»-kortet har en synlig kant, og time- og dagsradene er mørke med lys tekst.
5. Bytt tavla til `"carouselTheme":{"stringValue":"light"}` med samme PATCH → karusellen blir lavendel **uten reload**, og været går tilbake til fersken-kort.
6. Sett `stopPlaceId` til `"NSR:StopPlace:1"` → «Ingen avganger de neste 3 timene».
7. Sett `stopPlaceId` til `"tull"` → hele avgangsmodulen faller bort, og karusellen viser bare været.

- [ ] **Step 5: Bygg, test og commit**

Run: `yarn test && yarn build`
Expected: begge grønne.

```bash
git add src/App.jsx
git commit -m "feat: kiosken viser avganger og respekterer karusell-temaet"
```

---

### Task 10: Admin — stoppestedssøk og temavalg

**Files:**
- Create: `src/admin/StopPlaceField.jsx`
- Modify: `src/admin/BoardConfigForm.jsx`

**Interfaces:**
- Consumes: `searchStopPlaces` (Task 6); `CAROUSEL_THEMES` (Task 1); `findModule`, `isValidStopPlaceId` fra `boardConfig.js` (Task 5).
- Produces: `<StopPlaceField value={{id, name}} onChange={fn} error={string} />`.

- [ ] **Step 1: Skriv søkefeltet**

Opprett `src/admin/StopPlaceField.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { TextField } from '@entur/form';

import { searchStopPlaces } from '../departures/stopPlaceSearch';

/** Ventetid før søket sendes. Et tastetrykk er ikke et søk. */
const DEBOUNCE_MS = 300;

/**
 * Søkefelt for stoppested.
 *
 * `NSR:StopPlace:59983` er ikke noe et menneske skal taste, så feltet søker i
 * Enturs geocoder og lar deg velge. Id-en vises under valget så den kan
 * etterprøves, men den kan ikke skrives inn.
 */
function StopPlaceField({ value, onChange, error }) {
    const [query, setQuery] = useState(value.name ?? '');
    const [treff, setTreff] = useState([]);
    const [apen, setApen] = useState(false);

    useEffect(() => {
        // Har brukeren allerede valgt noe som stemmer med teksten, skal vi ikke
        // slå opp igjen — da ville lista sprettet opp av seg selv.
        if (query.trim() === '' || query === value.name) {
            setTreff([]);
            return undefined;
        }
        let current = true;
        const timer = setTimeout(() => {
            searchStopPlaces(query).then((resultat) => {
                if (current) {
                    setTreff(resultat);
                    setApen(true);
                }
            });
        }, DEBOUNCE_MS);
        return () => {
            current = false;
            clearTimeout(timer);
        };
    }, [query, value.name]);

    function velg(stopPlace) {
        onChange({ id: stopPlace.id, name: stopPlace.label });
        setQuery(stopPlace.label);
        setApen(false);
        setTreff([]);
    }

    return (
        <div style={{ position: 'relative' }}>
            <TextField
                label="Stoppested"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                variant={error ? 'negative' : undefined}
                feedback={error ?? 'Søk på navn, og velg fra lista.'}
            />
            {apen && treff.length > 0 && (
                <ul style={{ listStyle: 'none', margin: '0.25rem 0 0', padding: 0, border: '1px solid #babbcf', borderRadius: '4px', background: '#ffffff', position: 'absolute', zIndex: 2, width: '100%' }}>
                    {treff.map((stopPlace) => (
                        <li key={stopPlace.id}>
                            <button
                                type="button"
                                onClick={() => velg(stopPlace)}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', border: 'none', background: 'none', cursor: 'pointer', font: 'inherit' }}
                            >
                                {stopPlace.label}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {value.id && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                    Valgt: {value.name} ({value.id})
                </div>
            )}
            {error && !value.id && (
                <div style={{ marginTop: '0.5rem' }}>
                    <SmallAlertBox variant="negative">{error}</SmallAlertBox>
                </div>
            )}
        </div>
    );
}

export default StopPlaceField;
```

- [ ] **Step 2: Koble modulen og temaet inn i oppsettskjemaet**

I `src/admin/BoardConfigForm.jsx`:

1. Legg til importene:

```jsx
import StopPlaceField from './StopPlaceField';
import { CAROUSEL_THEMES } from '../boards/carouselTheme';
```

2. Utvid `draftFrom(board)` med de nye feltene. Legg til etter `floorplanPlan`:

```js
        departuresEnabled: Boolean(findModule(board.carousel, 'departures')),
        stopPlaceId: findModule(board.carousel, 'departures')?.stopPlaceId ?? '',
        stopPlaceName: findModule(board.carousel, 'departures')?.stopPlaceName ?? '',
        carouselTheme: board.carouselTheme,
```

3. Utvid `configFrom(draft)`. Legg til etter floorplan-blokka:

```js
    if (draft.departuresEnabled) {
        carousel.push({
            type: 'departures',
            stopPlaceId: draft.stopPlaceId,
            stopPlaceName: draft.stopPlaceName.trim(),
        });
    }
```

og ta med temaet i returen, etter `top`:

```js
        carouselTheme: draft.carouselTheme,
```

4. Legg temavalget øverst i «Karusellen»-seksjonen, rett etter `<Heading3>Karusellen</Heading3>`:

```jsx
                <RadioGroup
                    name="carouselTheme"
                    label="Bakgrunn"
                    value={draft.carouselTheme}
                    onChange={(event) => update('carouselTheme', event.target.value)}
                >
                    <Radio value="light">Lys</Radio>
                    <Radio value="dark">Mørk</Radio>
                </RadioGroup>
                {errors.carouselTheme && (
                    <SmallAlertBox variant="negative">{errors.carouselTheme}</SmallAlertBox>
                )}
```

5. Legg avgangsmodulen inn nederst i samme seksjon, etter plantegningen:

```jsx
                <Checkbox
                    checked={draft.departuresEnabled}
                    onChange={(event) => update('departuresEnabled', event.target.checked)}
                >
                    Avgangstider
                </Checkbox>
                {draft.departuresEnabled && (
                    <div style={{ margin: '0.75rem 0 0 2rem', maxWidth: '28rem' }}>
                        <StopPlaceField
                            value={{ id: draft.stopPlaceId, name: draft.stopPlaceName }}
                            onChange={(valgt) => {
                                update('stopPlaceId', valgt.id);
                                update('stopPlaceName', valgt.name);
                            }}
                            error={errors.stopPlace}
                        />
                    </div>
                )}
```

Merk at `CAROUSEL_THEMES` **ikke** importeres i skjemaet. Radioknappene er to faste valg med hver sin norske etikett, og en `map` over konstanten ville krevd en egen etikett-tabell for å si «Lys» og «Mørk». Håndhevingen av lovlige verdier ligger i valideringen og i normaliseringen, som begge bruker konstanten.

- [ ] **Step 3: Verifiser mot emulatoren**

Med emulatoren og `yarn dev` i gang, og innlogget i admin:

1. Åpne oppsettet for en tavle → «Bakgrunn» med Lys/Mørk, og «Avgangstider» nederst i karusell-seksjonen.
2. Huk av «Avgangstider», skriv «Bergen st» → lista viser treff fra geocoderen innen et halvt sekund.
3. Velg «Bergen stasjon, Bergen» → «Valgt: Bergen stasjon, Bergen (NSR:StopPlace:59983)».
4. Lagre → grønn kvittering. Åpne `/t/<id>` i en annen fane → avgangene står der.
5. Huk av «Avgangstider» uten å velge stoppested, og lagre → «Søk opp og velg et stoppested», ingenting lagres.
6. Velg «Mørk» og lagre → tavla bytter bakgrunn uten reload.

- [ ] **Step 4: Bygg, test og commit**

Run: `yarn test && yarn build`
Expected: begge grønne.

```bash
git add src/admin/StopPlaceField.jsx src/admin/BoardConfigForm.jsx
git commit -m "feat: stoppestedssøk og temavalg i oppsettskjemaet"
```

---

### Task 11: Dokumentasjon og sluttverifisering

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Oppdater modultabellen**

I `README.md`, i avsnittet «Hva tavla viser», utvid karusell-raden i tabellen:

```markdown
| Karusellen | `weather` (værmelding for valgte koordinater), `floorplan` (plantegning) og `departures` (avgangstider fra ett stoppested) |
```

og legg til en rad under tabellen:

```markdown
Karusellen kan settes **lys eller mørk** per tavle (`carouselTheme`). Temaet
gjelder hele karusellen, ikke enkeltmoduler — en karusell som skifter bakgrunn
mellom slides er en feil, ikke et design.
```

- [ ] **Step 2: Beskriv avgangsmodulen**

Legg til et nytt avsnitt etter «Ruter»:

```markdown
## Avgangstider

Avgangsmodulen henter fra [Entur Journey Planner v3](https://api.entur.io/journey-planner/v3/graphql),
en åpen tjeneste uten nøkkel. Den krever headeren `ET-Client-Name`, som vi setter
til `entur-velkomsttavle`. APIet er CORS-åpent, så kiosken kaller det direkte fra
nettleseren — ingen backend.

Faste verdier, ikke konfigurerbare: **6 avganger**, maks **3 timer** fram,
hentet hvert **60. sekund**. Nedtellingen regnes om hvert 15. sekund uten
nettverkskall.

Tavla viser nedtelling («om 4 min») under 20 minutter og klokkeslett ellers.
Nedtellingen regnes fra **forventet** tid, ikke planlagt — et tog som er ti
minutter forsinket skal si «om 13 min», ikke «om 3 min».

Avvik kommer i tre former, og de behandles ulikt:

| Form | Felt i APIet | På tavla |
|---|---|---|
| Forsinkelse | `expectedDepartureTime` ≠ `aimedDepartureTime` | Gul brikke, planlagt tid gjennomstreket |
| Innstilling | `cancellation` | Rød brikke. Avgangen **forsvinner ikke** |
| Situasjon | `situations[].summary` | Fritekst under destinasjonen |

> Feltet for innstilling heter `cancellation`. `cancelled` finnes ikke på
> `EstimatedCall` i v3 og gir valideringsfeil fra APIet.

Linjemerket farges etter **kategori** — `L` lokaltog grønn, `R` regiontog rød,
`F` fjerntog blå — fordi det er kodingen Bane NORs perrongskjermer bruker.
Linjer uten kategori får farge etter transportmiddel fra Enturs egen palett.

`line.presentation.colour` fra APIet brukes **ikke**: det er en operatørfarge,
ikke en linjefarge. Alle tre togene fra Bergen stasjon er Vy og får samme røde,
og de fleste bussrutene har feltet tomt.

**Bane NORs trafikkmeldinger brukes ikke.** Bane NOR er en kilde *inn* i Entur,
feeden deres sender ingen CORS-headere, og meldingene gjelder strekninger over
lange perioder framfor enkeltavganger. Strekningsarbeid legges inn som en vanlig
melding på tavla.
```

- [ ] **Step 3: Utvid testavsnittet**

I «Tester», legg til i opplistingen av tavle-tester:

```markdown
For avganger dekkes mapping fra GraphQL-svaret
(`src/departures/departureMapper.test.mjs`), nedtellingen
(`departureCountdown.test.mjs`), linjefargene (`lineAppearance.test.mjs`),
henting og polling (`enturDepartures.test.mjs`) og stoppestedssøket
(`stopPlaceSearch.test.mjs`). Karusell-paletten
(`src/boards/carouselTheme.test.mjs`) kontrastmåler seg selv — den låser
rettelsen av inaktive ikoner, som lå på 1.39 mot lavendel.
```

- [ ] **Step 4: Kjør alle tre portene**

Run: `yarn test`
Expected: PASS.

Run: `yarn test:rules`
Expected: PASS. Krever fri port 8080.

Run: `yarn build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: avgangstider og tema på karusellen"
```

- [ ] **Step 6: Etter merge — sett opp billettkontor-tavla**

Ingen migrering trengs. `carouselTheme` mangler på `boards/bergen-3`, og normaliseringen gir den `light`, som er dagens utseende. Reglene godtar at feltet mangler.

Billettkontor-tavla opprettes som en hvilken som helst ny tavle: logg inn på
`/admin`, trykk «Ny tavle», og sett den opp med mørk bakgrunn, avgangstider fra
Bergen stasjon og værmelding.

---

## Etter fase 3

Hele designet fra `2026-08-06-parameteriserte-tavler-design.md` er da levert.

Ting som bevisst ble stående utenfor, og som kan tas hver for seg om behovet melder seg:

- Flere stoppesteder på samme tavle.
- Filter på transportmiddel (`modes`).
- Konfigurerbart antall avganger og tidsvindu.
- Flere plantegninger — `sync-floorplan.mjs` er hardkodet mot én fil.
- Egen video per tavle.
