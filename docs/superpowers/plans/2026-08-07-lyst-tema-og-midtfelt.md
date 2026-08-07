# Lyst tema, fri ansatt-illustrasjon og komprimerte åpningstider — implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tavla kan velge mellom mørkeblått og lavendel på de to øverste feltene, ansatt-illustrasjonen blir et selvstendig valg uavhengig av hilsen og åpningstider, og åpningstidene komprimeres til én rad per sammenhengende gruppe like dager.

**Architecture:** To nye felt på toppnivå i tavle-configen (`theme`, `staffImage`) normaliseres i `src/boards/boardConfig.js`, med tilbakefall til gammel plassering for `staffImage`. En ny ren modul `src/boards/boardTheme.js` oversetter `theme` til bakgrunn, tekstfarge, logo-fil og om `<Contrast>` skal brukes. En ny `src/components/MiddleBand.jsx` overtar midtfeltet fra `App.jsx` og erstatter `Greeting.jsx`. `formatOpeningHours` slår sammen nabodager med samme verdi.

**Tech Stack:** React 19, Vite 8, `@entur/tokens` / `@entur/typography` / `@entur/layout` / `@entur/form`, Firestore, `node --test` for enhetstester, Firestore-emulator for regeltester.

**Spec:** [`docs/superpowers/specs/2026-08-07-lyst-tema-og-midtfelt-design.md`](../specs/2026-08-07-lyst-tema-og-midtfelt-design.md)

## Global Constraints

- Alt brukervendt språk og alle kodekommentarer er på **norsk (bokmål)**.
- **Fire mellomrom** innrykk. Enkle fnutter i JS, ikke doble.
- **Ingen nye avhengigheter.** Fargene hentes fra `@entur/tokens`.
- Filer under `src/boards/` skal være **uten JSX og uten Firebase-importer**, slik at de kan testes med `node --test`.
- **Tankestrek** (`–`, U+2013), ikke bindestrek, mellom klokkeslett og mellom dagsnavn.
- Det finnes **ingen testoppsett for React-komponenter** i repoet (ingen jsdom, ingen komponenttest-runner). Komponenter verifiseres med `npm run build` og manuell kontroll i dev-serveren. Ikke innfør et testrammeverk for å følge TDD i JSX-oppgavene.
- Enhetstester ligger side om side med koden som `*.test.mjs` og kjøres med `npm test` (`node --test`). `firestore.rules.spec.mjs` heter bevisst `.spec.mjs` for at `npm test` ikke skal plukke den opp.
- Fargeverdier: mørkeblå `#181c56` (`base.light.baseColors.frame.contrast` / `colors.brand.blue`), lavendel `#aeb7e2` (`colors.brand.lavender`), hvit `#ffffff` (`colors.brand.white`). Karusellens lysere lavendel `#d9dae8` skal **ikke** brukes til de to feltene.
- Kommentarene om `justifyContent: 'flex-start'`, `maxHeight: 45vh` og værpollingens plassering i `App` er bevisste og skal bevares ordrett når koden flyttes.

---

## File Structure

**Nye filer**

| Fil | Ansvar |
|---|---|
| `src/boards/boardTheme.js` | Fargetabellen: `theme` → `{ background, color, logoSrc, contrast }`. Ingen JSX, ingen Firebase. |
| `src/boards/boardTheme.test.mjs` | Enhetstester for tabellen. |
| `src/components/MiddleBand.jsx` | Midtfeltet: bakgrunn/tema, varsler øverst, illustrasjon til venstre for overskrift, hilsen og åpningstider. |

**Endrede filer**

| Fil | Endring |
|---|---|
| `src/boards/openingHours.js` | `formatOpeningHours` slår sammen nabodager med samme verdi. |
| `src/boards/openingHours.test.mjs` | Nye tester for sammenslåingen. |
| `src/components/OpeningHours.jsx` | Ny radform (`key` i stedet for `day`). |
| `src/boards/boardConfig.js` | `THEMES`, `theme` og `staffImage` på toppnivå, migrering fra gammel plassering, `toFirestoreBoard`. |
| `src/boards/boardConfig.test.mjs` | Oppdaterte og nye tester. |
| `src/components/TopBand.jsx` | Tar `theme`, henter bakgrunn og logo-fil fra `bandTheme`. |
| `src/App.jsx` | Slutter å eie midtfeltet; sender data til `MiddleBand`. |
| `src/admin/BoardConfigForm.jsx` | Ny **Farger**-seksjon; ansatt-illustrasjonen flyttes ut av hilsen-blokka. |
| `src/admin/NewBoardForm.jsx` | Startoppsettet får `theme` og `staffImage` eksplisitt. |
| `firestore.rules` | `isValidBoard` validerer `theme` og `staffImage`. |
| `firestore.rules.spec.mjs` | Fixturen får de nye feltene; to nye avvisningstester. |
| `README.md` | Modultabellen, modulbeskrivelsene og åpningstidene. |

**Slettet fil**

| Fil | Hvorfor |
|---|---|
| `src/components/Greeting.jsx` | Fantes bare for å holde bilde, overskrift og tekst i samme rad. `MiddleBand` eier raden nå. |

---

### Task 1: Komprimerte åpningstider

Selvstendig: rører verken config eller tema. `formatOpeningHours` er den eneste funksjonen som endres, og `OpeningHours.jsx` er dens eneste konsument i kiosken. Admin-skjemaet bruker `DAY_LABELS` direkte og er uberørt.

**Files:**
- Modify: `src/boards/openingHours.js:60-67`
- Modify: `src/components/OpeningHours.jsx:19`
- Modify: `README.md:48-50`
- Test: `src/boards/openingHours.test.mjs:55-69`

**Interfaces:**
- Consumes: `normalizeDays(value)` og `DAY_LABELS` fra samme fil (finnes fra før).
- Produces: `formatOpeningHours(days)` → `Array<{ key: string, label: string, value: string }>`. `key` er dagsnøkkelen til første dag i gruppa (`'mon'`), `label` er `'Mandag'` eller `'Mandag–Fredag'`, `value` er `'08:00–16:00'` eller `'Stengt'`. Feltet `day` finnes ikke lenger.

- [ ] **Step 1: Skriv de feilende testene**

Erstatt hele `describe('formatOpeningHours', …)`-blokka i `src/boards/openingHours.test.mjs` (linje 55–69) med:

```js
describe('formatOpeningHours', () => {
    it('skriver ut norsk dagsnavn og tidsrom', () => {
        const rows = formatOpeningHours(normalizeDays([
            { day: 'mon', opens: '08:00', closes: '16:00' },
        ]));
        assert.deepEqual(rows[0], { key: 'mon', label: 'Mandag', value: '08:00–16:00' });
    });

    it('slår sammen mandag til fredag når de er like', () => {
        const rows = formatOpeningHours(normalizeDays(
            ['mon', 'tue', 'wed', 'thu', 'fri'].map((day) => ({ day, opens: '08:00', closes: '16:00' })),
        ));
        assert.deepEqual(rows, [
            { key: 'mon', label: 'Mandag–Fredag', value: '08:00–16:00' },
            { key: 'sat', label: 'Lørdag–Søndag', value: 'Stengt' },
        ]);
    });

    it('skiller ut dagen som har andre tider', () => {
        const rows = formatOpeningHours(normalizeDays([
            ...['mon', 'tue', 'wed', 'thu'].map((day) => ({ day, opens: '08:00', closes: '16:00' })),
            { day: 'fri', opens: '08:00', closes: '14:00' },
        ]));
        assert.deepEqual(rows.map((row) => row.label), ['Mandag–Torsdag', 'Fredag', 'Lørdag–Søndag']);
        assert.equal(rows[1].value, '08:00–14:00');
    });

    it('gir én rad når hele uka er lik', () => {
        const rows = formatOpeningHours(normalizeDays([]));
        assert.deepEqual(rows, [{ key: 'mon', label: 'Mandag–Søndag', value: 'Stengt' }]);
    });

    it('slår ikke sammen dager som ikke ligger inntil hverandre', () => {
        const rows = formatOpeningHours(normalizeDays([
            { day: 'mon', opens: '08:00', closes: '16:00' },
            { day: 'wed', opens: '08:00', closes: '16:00' },
        ]));
        assert.deepEqual(rows.map((row) => row.label), ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag–Søndag']);
    });
});
```

- [ ] **Step 2: Kjør testene og se at de feiler**

```bash
npm test -- src/boards/openingHours.test.mjs
```

Forventet: FAIL. Første feil er `deepEqual`-sammenlikningen som får `{ day: 'mon', label: 'Mandag', … }` der testen venter `{ key: 'mon', … }`.

- [ ] **Step 3: Skriv implementasjonen**

Erstatt `formatOpeningHours` i `src/boards/openingHours.js` (linje 60–67) med:

```js
/**
 * Radene tavla viser. Dager som ligger etter hverandre og har samme verdi blir
 * én rad: «Mandag–Fredag 08:00–16:00» framfor fem like linjer.
 *
 * Sammenslåingen forutsetter at dagene står i ukerekkefølge. Det garanterer
 * normalizeDays; endres den rekkefølgen, blir gruppene stille feil.
 *
 * Tankestrek, ikke bindestrek, både mellom dagsnavnene og mellom tidene.
 */
export function formatOpeningHours(days) {
    const groups = [];
    for (const day of days) {
        const value = day.closed ? 'Stengt' : `${day.opens}–${day.closes}`;
        const previous = groups[groups.length - 1];
        if (previous && previous.value === value) {
            previous.to = day.day;
        } else {
            groups.push({ from: day.day, to: day.day, value });
        }
    }
    return groups.map((group) => ({
        key: group.from,
        label: group.from === group.to
            ? DAY_LABELS[group.from]
            : `${DAY_LABELS[group.from]}–${DAY_LABELS[group.to]}`,
        value: group.value,
    }));
}
```

- [ ] **Step 4: Kjør testene og se at de passerer**

```bash
npm test -- src/boards/openingHours.test.mjs
```

Forventet: PASS, alle testene i filen.

- [ ] **Step 5: Bruk den nye radformen i komponenten**

I `src/components/OpeningHours.jsx`, bytt nøkkelen på linje 19 fra `row.day` til `row.key`:

```jsx
                {rows.map((row) => (
                    <Fragment key={row.key}>
                        <span>{row.label}</span>
                        <span style={{ textAlign: 'right' }}>{row.value}</span>
                    </Fragment>
                ))}
```

- [ ] **Step 6: Oppdater README**

I `README.md`, erstatt setningen om at tavla viser dagene som de står (linje 48–50) med:

```markdown
   **Åpningstider** (`openingHours`) er den andre modulen i midtfeltet. Sju dager
   med åpner/stenger eller «Stengt», lagt inn i et skjema. Tavla slår sammen
   dager som ligger etter hverandre og har samme verdi, slik at fem like ukedager
   blir «Mandag–Fredag 08:00–16:00». Det finnes ingen «åpent nå»-logikk.
```

- [ ] **Step 7: Kjør hele testsuiten og bygget**

```bash
npm test && npm run build
```

Forventet: alle tester passerer, bygget går gjennom.

- [ ] **Step 8: Commit**

```bash
git add src/boards/openingHours.js src/boards/openingHours.test.mjs src/components/OpeningHours.jsx README.md
git commit -m "feat: slå sammen like nabodager i åpningstidene"
```

---

### Task 2: Fargetabellen

Ren modul uten konsumenter ennå. Kan reviewes og forkastes uten at noe annet i planen faller.

**Files:**
- Create: `src/boards/boardTheme.js`
- Test: `src/boards/boardTheme.test.mjs`

**Interfaces:**
- Consumes: `base` og `colors` fra `@entur/tokens` (verifisert at `node --test` klarer navngitte ESM-importer fra pakken).
- Produces: `bandTheme(theme)` → `{ background: string, color: string, logoSrc: string, contrast: boolean }`. Brukes av Task 4 (`TopBand`, `MiddleBand`). `THEMES` eksporteres **ikke** herfra — den hører hjemme i modulkatalogen, se Task 3.

- [ ] **Step 1: Skriv den feilende testen**

Opprett `src/boards/boardTheme.test.mjs`:

```js
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
```

- [ ] **Step 2: Kjør testen og se at den feiler**

```bash
npm test -- src/boards/boardTheme.test.mjs
```

Forventet: FAIL med `ERR_MODULE_NOT_FOUND` — `./boardTheme.js` finnes ikke.

- [ ] **Step 3: Skriv implementasjonen**

Opprett `src/boards/boardTheme.js`:

```js
/**
 * Fargene de to øverste feltene kan ha.
 *
 * Uten Firebase-importer og uten JSX, slik at tabellen kan testes med
 * `node --test`.
 *
 * Det lyse temaet dropper <Contrast>-wrapperen framfor å overstyre farger inni
 * den: uten wrapperen faller @entur/typography tilbake på --primary-text-color,
 * som allerede er Entur-blå. `color` settes likevel på feltet, slik at vanlig
 * tekst uten typografi-komponent — åpningstidene — arver den samme fargen.
 */
import { base, colors } from '@entur/tokens';

const DARK = {
    background: base.light.baseColors.frame.contrast,
    color: colors.brand.white,
    logoSrc: '/logo.svg',
    contrast: true,
};

// Lavendel fra merkevaren, ikke den lysere lavendelen karusellen bruker
// (#d9dae8). De tre feltene skal fortsatt leses som tre felt.
//
// logo-on-light.svg har mørkeblått ordmerke og hører til lyse flater; den lå
// der fra før for admin-sidene.
const LIGHT = {
    background: colors.brand.lavender,
    color: colors.brand.blue,
    logoSrc: '/logo-on-light.svg',
    contrast: false,
};

/** Ukjent verdi gir det mørke temaet, som er slik tavlene så ut før valget fantes. */
export function bandTheme(theme) {
    return theme === 'light' ? LIGHT : DARK;
}
```

- [ ] **Step 4: Kjør testen og se at den passerer**

```bash
npm test -- src/boards/boardTheme.test.mjs
```

Forventet: PASS, fire tester.

- [ ] **Step 5: Commit**

```bash
git add src/boards/boardTheme.js src/boards/boardTheme.test.mjs
git commit -m "feat: fargetabell for mørkt og lyst tema"
```

---

### Task 3: `theme` og `staffImage` i configmodellen

Her ligger migreringen. Etter denne oppgaven leser normaliseringen begge feltene, men ingen rendrer dem ennå — tavla ser uendret ut.

**Files:**
- Modify: `src/boards/boardConfig.js:15-76`
- Test: `src/boards/boardConfig.test.mjs`

**Interfaces:**
- Consumes: `normalizeDays` fra `./openingHours.js` (finnes fra før).
- Produces:
  - `THEMES` → `['dark', 'light']`, eksportert fra `boardConfig.js` ved siden av `TOP_KINDS`.
  - `normalizeBoardConfig(id, data)` returnerer i tillegg `theme: 'dark' | 'light'` og `staffImage: boolean` på toppnivå. Greeting-moduler i `middle` har ikke lenger feltet `staffImage` — de er `{ type: 'greeting', text: string }`.
  - `toFirestoreBoard(config, userEmail)` skriver `theme` og `staffImage` på toppnivå.

- [ ] **Step 1: Skriv de feilende testene**

I `src/boards/boardConfig.test.mjs`:

**a)** Legg `THEMES` til importlista øverst:

```js
import {
    THEMES,
    boardHeading,
    findModule,
    normalizeBoardConfig,
    toFirestoreBoard,
} from './boardConfig.js';
```

**b)** Fjern `staffImage` fra de tre eksisterende forventningene til greeting-modulen — linje 32, 94 og 102:

```js
        assert.deepEqual(config.middle, [{ type: 'greeting', text: 'auto' }]);
```

```js
        assert.deepEqual(config.middle, [{ type: 'greeting', text: 'auto' }]);
```

```js
        assert.deepEqual(config.middle, [{ type: 'greeting', text: 'Hei og velkommen' }]);
```

**c)** Legg disse testene inn i `describe('normalizeBoardConfig', …)`, rett etter testen `godtar logo som topp`:

```js
    it('faller på det mørke temaet når theme mangler eller er ukjent', () => {
        assert.equal(normalizeBoardConfig('x', bergenDocument()).theme, 'dark');
        assert.equal(normalizeBoardConfig('x', { ...bergenDocument(), theme: 'lilla' }).theme, 'dark');
        assert.equal(normalizeBoardConfig('x', {}).theme, 'dark');
    });

    it('godtar det lyse temaet', () => {
        assert.equal(normalizeBoardConfig('x', { ...bergenDocument(), theme: 'light' }).theme, 'light');
    });

    it('leser ansatt-illustrasjonen fra toppnivå', () => {
        assert.equal(normalizeBoardConfig('x', { ...bergenDocument(), staffImage: false }).staffImage, false);
        assert.equal(normalizeBoardConfig('x', { ...bergenDocument(), staffImage: true }).staffImage, true);
    });

    it('arver ansatt-illustrasjonen fra en gammel hilsen-modul', () => {
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            middle: [{ type: 'greeting', text: 'auto', staffImage: false }],
        });
        assert.equal(config.staffImage, false);
        assert.deepEqual(config.middle, [{ type: 'greeting', text: 'auto' }]);
    });

    it('lar toppnivået vinne over den gamle plasseringen', () => {
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            staffImage: true,
            middle: [{ type: 'greeting', text: 'auto', staffImage: false }],
        });
        assert.equal(config.staffImage, true);
    });

    it('viser ansatt-illustrasjonen når ingen av plassene sier noe', () => {
        assert.equal(normalizeBoardConfig('x', {}).staffImage, true);
        assert.equal(normalizeBoardConfig('x', {
            ...bergenDocument(),
            middle: [{ type: 'openingHours', days: [] }],
        }).staffImage, true);
    });
```

**d)** Legg denne testen inn nederst i filen, som en egen blokk:

```js
describe('THEMES', () => {
    it('har nøyaktig de to temaene', () => {
        assert.deepEqual(THEMES, ['dark', 'light']);
    });
});
```

**e)** Utvid `toFirestoreBoard`-testen med de nye feltene — legg til rett før `assert.equal('id' in data, false);`:

```js
        assert.equal(data.theme, 'dark');
        assert.equal(data.staffImage, true);
```

- [ ] **Step 2: Kjør testene og se at de feiler**

```bash
npm test -- src/boards/boardConfig.test.mjs
```

Forventet: FAIL. `THEMES` er `undefined`, og greeting-modulene har fortsatt `staffImage` i seg.

- [ ] **Step 3: Skriv implementasjonen**

I `src/boards/boardConfig.js`:

**a)** Legg `THEMES` rett under `TOP_KINDS` (linje 15):

```js
export const TOP_KINDS = ['video', 'logo'];

/** Fargen på toppfeltet og midtfeltet. Fargeverdiene ligger i boardTheme.js. */
export const THEMES = ['dark', 'light'];
```

**b)** Legg standardverdien ved siden av `DEFAULT_TOP_KIND` (linje 29):

```js
const DEFAULT_TOP_KIND = 'video';
const DEFAULT_THEME = 'dark';
```

**c)** Utvid returverdien i `normalizeBoardConfig`:

```js
export function normalizeBoardConfig(id, data = {}) {
    const source = data ?? {};
    return {
        id,
        name: asText(source.name, NAME_MAX_LENGTH),
        placeName: asText(source.placeName, PLACE_NAME_MAX_LENGTH),
        theme: THEMES.includes(source.theme) ? source.theme : DEFAULT_THEME,
        staffImage: staffImageFrom(source),
        top: { kind: TOP_KINDS.includes(source.top?.kind) ? source.top.kind : DEFAULT_TOP_KIND },
        middle: normalizeModules(source.middle, MIDDLE_TYPES, MIDDLE_NORMALIZERS),
        carousel: normalizeModules(source.carousel, CAROUSEL_TYPES, CAROUSEL_NORMALIZERS),
    };
}
```

**d)** Legg denne funksjonen rett under `normalizeBoardConfig`:

```js
/**
 * Ansatt-illustrasjonen lå tidligere inne i hilsen-modulen. Dokumenter skrevet
 * før flyttingen har den fortsatt der, og skal se like ut etter oppgraderingen —
 * derfor leses den gamle plasseringen når toppnivået ikke sier noe. Standarden
 * er på: dagens tavler har illustrasjonen.
 */
function staffImageFrom(source) {
    if (typeof source.staffImage === 'boolean') {
        return source.staffImage;
    }
    const list = Array.isArray(source.middle) ? source.middle : [];
    const greeting = list.find((module) => module && module.type === 'greeting');
    return greeting ? greeting.staffImage !== false : true;
}
```

**e)** Ta `staffImage` ut av greeting-normalisereren (linje 62–74):

```js
const MIDDLE_NORMALIZERS = {
    greeting: (module) => {
        const text = typeof module.text === 'string' ? module.text.trim() : '';
        return {
            type: 'greeting',
            text: text === '' || text === GREETING_AUTO
                ? GREETING_AUTO
                : text.slice(0, GREETING_TEXT_MAX_LENGTH),
        };
    },
    openingHours: (module) => ({ type: 'openingHours', days: normalizeDays(module.days) }),
};
```

**f)** Skriv de nye feltene i `toFirestoreBoard`:

```js
export function toFirestoreBoard(config, userEmail) {
    return {
        name: config.name.trim(),
        placeName: config.placeName.trim(),
        theme: config.theme,
        staffImage: config.staffImage,
        top: { kind: config.top.kind },
        middle: config.middle,
        carousel: config.carousel,
        updatedBy: userEmail,
    };
}
```

- [ ] **Step 4: Kjør testene og se at de passerer**

```bash
npm test
```

Forventet: PASS i hele suiten. Går noe annet i stykker her, er det fordi en test forventet `staffImage` inne i en greeting-modul.

- [ ] **Step 5: Commit**

```bash
git add src/boards/boardConfig.js src/boards/boardConfig.test.mjs
git commit -m "feat: theme og staffImage på toppnivå i tavle-configen"
```

---

### Task 4: Midtfeltet og toppfeltet tar i bruk temaet

Den synlige endringen. Ingen enhetstester — repoet har ikke oppsett for komponenttester (se Global Constraints). Verifisering er `npm run build` og manuell kontroll i dev-serveren.

**Files:**
- Create: `src/components/MiddleBand.jsx`
- Modify: `src/components/TopBand.jsx`
- Modify: `src/App.jsx:1-18,96-147`
- Modify: `README.md:18-20,40-47`
- Delete: `src/components/Greeting.jsx`

**Interfaces:**
- Consumes: `bandTheme(theme)` fra Task 2; `config.theme` og `config.staffImage` fra Task 3; `formatOpeningHours`-radene fra Task 1 (indirekte, via `OpeningHours`).
- Produces:
  - `<TopBand kind={string} theme={string} />`
  - `<MiddleBand theme={string} boardId={string} heading={string} greetingText={string|null} openingHoursDays={Array|null} staffImageSrc={string|null} hasCarousel={boolean} />` — alle `null`-verdiene betyr «ikke vis denne delen».

- [ ] **Step 1: Legg temaet inn i toppfeltet**

Erstatt hele `src/components/TopBand.jsx` med:

```jsx
import LoopingVideo from './LoopingVideo';
import { bandTheme } from '../boards/boardTheme';

/** Toppfeltet er 40vh i begge variantene, så resten av layouten ikke flytter seg. */
const SIZE = { width: '100vw', height: '40vh' };

/**
 * Toppen av tavla: enten intro-videoen eller Entur-logoen.
 *
 * Logofila følger temaet: public/logo.svg er hvit og koral og hører til det
 * mørkeblå feltet, public/logo-on-light.svg har mørkeblått ordmerke og hører til
 * lavendel.
 *
 * Videoen dekker hele feltet, så bakgrunnen bak den vises bare når videoen ikke
 * kan spilles av. Den følger likevel temaet, slik at fallbacket ikke blir
 * mørkeblått på en lys tavle.
 */
function TopBand({ kind, theme }) {
    const { background, logoSrc } = bandTheme(theme);
    const band = { ...SIZE, backgroundColor: background };

    if (kind === 'logo') {
        return (
            <div style={{ ...band, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={logoSrc} alt="Entur" style={{ maxHeight: '50%', maxWidth: '60%' }} />
            </div>
        );
    }
    return <LoopingVideo src="/entur.mp4" style={{ ...band, display: 'block', objectFit: 'cover' }} />;
}

export default TopBand;
```

- [ ] **Step 2: Skriv midtfeltet som egen komponent**

Opprett `src/components/MiddleBand.jsx`:

```jsx
import { Contrast } from '@entur/layout';
import { Heading2, LeadParagraph } from '@entur/typography';

import AlertBanner from './AlertBanner';
import ErrorBoundary from './ErrorBoundary';
import OpeningHours from './OpeningHours';
import { bandTheme } from '../boards/boardTheme';

/**
 * Feltet under toppen: varsler øverst i full bredde, og under dem
 * ansatt-illustrasjonen til venstre for overskrift, hilsen og åpningstider.
 *
 * Illustrasjonen er et selvstendig valg på tavla, ikke en del av hilsenen: en
 * tavle med bare åpningstider kan ha den, og en tavle med hilsen kan la være.
 *
 * Det lyse temaet dropper <Contrast>-wrapperen. Den setter både bakgrunn og
 * hvit tekstfarge, og uten den finner typografien Entur-blå selv.
 *
 * justifyContent: 'flex-start' er bevisst, ikke 'center'. Feltet har
 * maxHeight + overflow: hidden, så noe MÅ klippes bort når stacken
 * (varsler + hilsen) er høyere enn 45vh. Med 'center' klippes det
 * symmetrisk fra begge kanter, og siden selectVisibleAlerts sorterer
 * alvorligste varsel øverst, er det nettopp det alvorligste varselet
 * som forsvinner over den øvre kanten først. Med 'flex-start' klippes
 * det i stedet nedenfra: hilsenen og de minst alvorlige varslene
 * lengst ned ryker først, og prioritert rekkefølge bevares. Ikke
 * endre denne tilbake til 'center'.
 *
 * Uten karusell-moduler får feltet plassen karusellen ellers hadde
 * hatt (flex: 1 i stedet for maxHeight), men klippes fortsatt nedenfra.
 */
function MiddleBand({ theme, boardId, heading, greetingText, openingHoursDays, staffImageSrc, hasCarousel }) {
    const { background, color, contrast } = bandTheme(theme);
    const style = {
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        backgroundColor: background,
        color,
        flexDirection: 'column',
        padding: '1.5rem 0',
        overflow: 'hidden',
        ...(hasCarousel ? { maxHeight: '45vh' } : { flex: 1, minHeight: 0 }),
    };

    const content = (
        <>
            <ErrorBoundary>
                <AlertBanner boardId={boardId} />
            </ErrorBoundary>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                {staffImageSrc && (
                    // Dekorativ illustrasjon: tom alt, ikke «Staff». Ingen skjermleser
                    // står foran denne skjermen, og et meningsløst alt er verre enn ingen.
                    <img
                        src={staffImageSrc}
                        alt=""
                        style={{ maxHeight: '18vh', maxWidth: '40%', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }}
                    />
                )}
                {/* Overskriften står der uansett hvilke moduler tavla har. */}
                <div style={{ marginLeft: staffImageSrc ? '2rem' : 0 }}>
                    <Heading2>{heading}</Heading2>
                    {greetingText && <LeadParagraph>{greetingText}</LeadParagraph>}
                    {openingHoursDays && (
                        <ErrorBoundary>
                            <OpeningHours days={openingHoursDays} />
                        </ErrorBoundary>
                    )}
                </div>
            </div>
        </>
    );

    return contrast ? <Contrast style={style}>{content}</Contrast> : <div style={style}>{content}</div>;
}

export default MiddleBand;
```

- [ ] **Step 3: Koble App til de to feltene**

I `src/App.jsx`:

**a)** Bytt importene på linje 1–18 til:

```jsx
import { useState, useEffect } from 'react';
import Weather from './components/Weather';
import OfficeMap from './floorplan/OfficeMap';
import Carousel from './components/Carousel';
import ErrorBoundary from './components/ErrorBoundary';
import TopBand from './components/TopBand';
import MiddleBand from './components/MiddleBand';
import BoardMissing from './components/BoardMissing';
import { startWeatherPolling } from './weather/metForecast';
import { subscribeToBoard } from './boards/boardsRepository';
import { GREETING_AUTO, boardHeading, findModule } from './boards/boardConfig';
import { DEFAULT_BOARD_ID } from './routing/parseRoute';
import { SunCloudIcon, MapIcon } from '@entur/icons';
```

**b)** Erstatt linje 93–147 — alt fra `const hasCarousel = …` til og med `}` som lukker `App` — med:

```jsx
    const hasCarousel = slides.length > 0;
    const greeting = findModule(config.middle, 'greeting');
    const openingHours = findModule(config.middle, 'openingHours');

    return (
        <div className="app" style={{ minHeight: '100vh', minWidth: '100vw', width: '100vw', height: '100vh', boxSizing: 'border-box', margin: 0, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <TopBand kind={config.top.kind} theme={config.theme} />
            <MiddleBand
                theme={config.theme}
                boardId={boardId}
                heading={boardHeading(config.placeName)}
                greetingText={greetingTextFrom(greeting, autoGreeting)}
                openingHoursDays={openingHours ? openingHours.days : null}
                staffImageSrc={config.staffImage ? staffImage : null}
                hasCarousel={hasCarousel}
            />
            {hasCarousel && <Carousel slides={slides} />}
        </div>
    );
}

/** Hilsenen slik den skal stå på skjermen, eller null når tavla ikke har noen. */
function greetingTextFrom(greeting, autoGreeting) {
    if (!greeting) {
        return null;
    }
    return greeting.text === GREETING_AUTO ? autoGreeting : greeting.text;
}
```

Merk at `}` som lukket `App` nå står før `greetingTextFrom`. `getGreetingText` og `export default App` blir stående uendret nedenfor.

- [ ] **Step 4: Slett Greeting-komponenten**

```bash
git rm src/components/Greeting.jsx
```

- [ ] **Step 5: Bygg og se at ingenting mangler**

```bash
npm run build
```

Forventet: bygget går gjennom. En feilmelding om `./components/Greeting` betyr at en import ble stående igjen.

- [ ] **Step 6: Manuell kontroll i dev-serveren**

Start emulatoren i én terminal (krever Java 11+, se README «Lokal utvikling mot emulator»):

```bash
yarn firebase emulators:start --only auth,firestore --project ent-tavleber-prd
```

Start dev-serveren i en annen terminal:

```bash
VITE_USE_EMULATOR=true npm run dev
```

Legg inn en tavle i emulator-UI-et på http://localhost:4000 og åpne http://localhost:3000/t/<tavle-id>. Sjekk disse seks tilfellene ved å endre dokumentet i emulator-UI-et:

1. `theme: 'dark'` — feltene er mørkeblå, teksten hvit, logoen hvit og koral.
2. `theme: 'light'` — feltene er lavendel, all tekst er mørkeblå, logoen har mørkeblått ordmerke. Ingen hvit tekst noe sted.
3. `staffImage: true` uten greeting-modul — illustrasjonen står til venstre for overskriften.
4. `staffImage: false` med greeting-modul — hilsenen står uten illustrasjon.
5. Bare `openingHours` i `middle`, med `staffImage: true` — illustrasjon, overskrift og åpningstider i samme rad.
6. Et varsel oppe i det lyse temaet — `BannerAlertBox` har egne farger og skal fortsatt være lesbar mot lavendel.

- [ ] **Step 7: Oppdater README**

**a)** Modultabellen (linje 18–20) — legg til fargeraden og ta illustrasjonen ut av greeting-beskrivelsen:

```markdown
| Felt | Moduler |
|---|---|
| Farger | `dark` (mørkeblått) eller `light` (lavendel) — gjelder toppen og midten samlet |
| Toppen | `video` (intro-videoen) eller `logo` (Entur-logoen) |
| Midten | `greeting` (hilsen, automatisk eller fast tekst) og `openingHours` (åpningstider lagt inn dag for dag). Ansatt-illustrasjonen (`staffImage`) er et eget valg, uavhengig av begge |
| Karusellen | `weather` (værmelding for valgte koordinater) og `floorplan` (plantegning) |
```

**b)** Modulbeskrivelsen for toppen og hilsenen (linje 40–47):

```markdown
1. **Intro-video** (`top: video`) – `public/entur.mp4` spilles av i loop øverst
   (lyd av, autoplay). Videoen serveres same-origin med `immutable`-cache (se
   `firebase.json`) slik at den looper fra nettleser-cache uten flaky
   nettverkskall. Alternativet `top: logo` viser Entur-logoen, i den varianten
   som passer fargevalget.
2. **Velkomsthilsen** (`greeting`) – en hilsen under «Velkommen til Entur
   Bergen». Med `text: 'auto'` varierer hilsenen med klokkeslett og ukedag (god
   morgen, vel hjem, god helg osv.) og oppdateres hvert 15. minutt; ellers står
   den faste teksten fra oppsettet.

   **Ansatt-illustrasjonen** (`staffImage`) er et eget valg på tavla, ikke en del
   av hilsenen: en tilfeldig av `staff_man.svg` / `staff_woman.svg` står til
   venstre for innholdet i midtfeltet, uansett om tavla har hilsen,
   åpningstider eller bare overskriften.
```

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx src/components/TopBand.jsx src/components/MiddleBand.jsx README.md
git commit -m "feat: lyst tema på de to øverste feltene, og fri ansatt-illustrasjon"
```

---

### Task 5: Admin-skjemaene

Ingen enhetstester: `BoardConfigForm` og `NewBoardForm` er JSX. `boardValidation` får ingen nye regler — begge feltene er lukkede valg fra skjemaet og kan ikke få ugyldige verdier der.

**Files:**
- Modify: `src/admin/BoardConfigForm.jsx:19-82,151-183`
- Modify: `src/admin/NewBoardForm.jsx:11-20`

**Interfaces:**
- Consumes: `config.theme` og `config.staffImage` fra Task 3.
- Produces: skjemaet skriver `theme` og `staffImage` på toppnivå gjennom `saveBoardConfig` → `toFirestoreBoard`. Task 6 sperrer for alt annet.

- [ ] **Step 1: Flytt feltene inn i draft-formen**

I `src/admin/BoardConfigForm.jsx`, i `draftFrom` (linje 25–44): bytt linja `staffImage: greeting ? greeting.staffImage : true,` mot to linjer rett under `topKind`:

```js
        topKind: board.top.kind,
        theme: board.theme,
        staffImage: board.staffImage,
        greetingEnabled: Boolean(greeting),
```

- [ ] **Step 2: Skriv feltene tilbake i configFrom**

I samme fil, i `configFrom`: greeting-modulen skal ikke lenger ha `staffImage`, og returverdien får de to feltene:

```js
    const middle = [];
    if (draft.greetingEnabled) {
        middle.push({
            type: 'greeting',
            text: draft.greetingAuto ? GREETING_AUTO : draft.greetingText.trim(),
        });
    }
```

```js
    return {
        id: draft.id,
        name: draft.name.trim(),
        placeName: draft.placeName.trim(),
        theme: draft.theme,
        staffImage: draft.staffImage,
        top: { kind: draft.topKind },
        middle,
        carousel,
    };
```

- [ ] **Step 3: Legg inn Farger-seksjonen**

I samme fil, rett etter `</section>` som lukker **Toppen** (linje 161):

```jsx
            <section>
                <Heading3>Farger</Heading3>
                <Paragraph>
                    Gjelder toppen og midten samlet. Logoen bytter med: hvit og koral på
                    mørkeblått, farget på lavendel.
                </Paragraph>
                <RadioGroup
                    name="theme"
                    value={draft.theme}
                    onChange={(event) => update('theme', event.target.value)}
                >
                    <Radio value="dark">Mørk blå</Radio>
                    <Radio value="light">Lys lavendel</Radio>
                </RadioGroup>
            </section>
```

- [ ] **Step 4: Flytt illustrasjons-avkryssingen ut av hilsen-blokka**

I **Midtfeltet**-seksjonen: fjern `Checkbox`-en «Vis ansatt-illustrasjon» fra blokka inni `{draft.greetingEnabled && (…)}` (linje 178–183), og legg den i stedet rett etter `</Paragraph>` som avslutter avsnittet om meldinger, altså **før** avkryssingen for hilsen:

```jsx
                <Checkbox
                    checked={draft.staffImage}
                    onChange={(event) => update('staffImage', event.target.checked)}
                >
                    Vis ansatt-illustrasjon
                </Checkbox>

                <Checkbox
                    checked={draft.greetingEnabled}
                    onChange={(event) => update('greetingEnabled', event.target.checked)}
                >
                    Hilsen
                </Checkbox>
```

Etter flyttingen begynner blokka inni `{draft.greetingEnabled && (…)}` med `<RadioGroup name="greetingAuto" …>`.

- [ ] **Step 5: Gi nye tavler et eksplisitt startoppsett**

I `src/admin/NewBoardForm.jsx`, `startConfig` (linje 11–20):

```js
/** Oppsettet en ny tavle starter med: det samme som Bergen-tavla har. */
function startConfig(id, name, placeName) {
    return normalizeBoardConfig(id, {
        name,
        placeName,
        theme: 'dark',
        staffImage: true,
        top: { kind: 'video' },
        middle: [{ type: 'greeting', text: 'auto' }],
        carousel: [{ type: 'weather', name: placeName, lat: 60.39299, lng: 5.32415 }],
    });
}
```

- [ ] **Step 6: Bygg**

```bash
npm run build
```

Forventet: bygget går gjennom.

- [ ] **Step 7: Manuell kontroll av skjemaet**

Med emulator og dev-server fra Task 4, åpne http://localhost:3000/admin, logg inn i auth-emulatoren og velg en tavle. Sjekk:

1. **Farger**-seksjonen står under **Toppen** og viser tavlas nåværende valg.
2. «Vis ansatt-illustrasjon» står i **Midtfeltet** over «Hilsen», og lar seg krysse av mens «Hilsen» er av.
3. Lagring gir kvittering, og dokumentet i emulator-UI-et har `theme` og `staffImage` på toppnivå — og ingen `staffImage` inne i greeting-modulen.
4. En ny tavle opprettet fra **Ny tavle** får `theme: 'dark'` og `staffImage: true`.

- [ ] **Step 8: Commit**

```bash
git add src/admin/BoardConfigForm.jsx src/admin/NewBoardForm.jsx
git commit -m "feat: fargevalg og fri ansatt-illustrasjon i admin"
```

---

### Task 6: Firestore-reglene

Sist, slik at klienten skriver de nye feltene før reglene begynner å kreve dem. Krever Java 11+ for emulatoren.

**Files:**
- Modify: `firestore.rules` (`isValidBoard`)
- Test: `firestore.rules.spec.mjs:34-45,89-127`

**Interfaces:**
- Consumes: dokumentformen `toFirestoreBoard` skriver etter Task 3.
- Produces: ingen kode andre oppgaver bruker.

- [ ] **Step 1: Skriv de feilende regeltestene**

I `firestore.rules.spec.mjs`:

**a)** Gi fixturen de nye feltene (linje 34–45):

```js
function board(overrides = {}) {
    return {
        name: 'Bergen 3. etasje',
        placeName: 'Bergen',
        theme: 'dark',
        staffImage: true,
        top: { kind: 'video' },
        middle: [],
        carousel: [],
        createdBy: 'ola@entur.org',
        updatedBy: 'ola@entur.org',
        ...overrides,
    };
}
```

**b)** Legg disse testene inn i `describe('boards', …)`, etter den siste update-testen og før slette-testen:

```js
    it('avviser en tavle med ukjent tema', async () => {
        await assertFails(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({ theme: 'lilla' })));
    });

    it('avviser en tavle uten tema', async () => {
        const { theme, ...utenTema } = board();
        await assertFails(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), utenTema));
    });

    it('avviser en tavle der ansatt-illustrasjonen ikke er en boolean', async () => {
        await assertFails(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({ staffImage: 'ja' })));
    });

    it('godtar det lyse temaet', async () => {
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({ theme: 'light' })));
    });
```

- [ ] **Step 2: Kjør regeltestene og se at de feiler**

```bash
npm run test:rules
```

Forventet: de tre avvisningstestene FEILER — reglene godtar fortsatt `theme: 'lilla'`, dokumentet uten `theme`, og `staffImage: 'ja'`. Kjører du emulatoren fra Task 4 fortsatt, må den stoppes først; `emulators:exec` vil ha port 8080 selv.

- [ ] **Step 3: Stram inn regelen**

I `firestore.rules`, utvid `isValidBoard`:

```
    function isValidBoard(d) {
      return d.name is string && d.name.size() > 0 && d.name.size() <= 60
        && d.placeName is string && d.placeName.size() > 0 && d.placeName.size() <= 40
        && d.theme in ['dark', 'light']
        && d.staffImage is bool
        && d.top is map && d.top.kind in ['video', 'logo']
        && d.middle is list && d.middle.size() <= 5
        && d.carousel is list && d.carousel.size() <= 5
        && d.updatedBy == callerEmail();
    }
```

- [ ] **Step 4: Kjør regeltestene og se at de passerer**

```bash
npm run test:rules
```

Forventet: PASS i hele filen.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules firestore.rules.spec.mjs
git commit -m "feat: krev gyldig theme og staffImage på tavle-dokumenter"
```

---

### Sluttkontroll

- [ ] **Step 1: Kjør alt**

```bash
npm test && npm run build && npm run test:rules
```

Forventet: alle tre går grønt. Ingen påstand om at arbeidet er ferdig før denne kommandoen faktisk er kjørt og utdataene lest.

- [ ] **Step 2: Se over diffen**

```bash
git diff main --stat
```

Forventet: `src/components/Greeting.jsx` er borte, `src/components/MiddleBand.jsx` og `src/boards/boardTheme.js` er nye, og ingen fil utenfor tabellen i **File Structure** er rørt.

- [ ] **Step 3: Bekreft migreringen mot et gammelt dokument**

Legg et dokument uten `theme` og med `staffImage` inne i greeting-modulen inn i emulatoren, og åpne tavla. Forventet: mørkeblått tema, og illustrasjonen vises eller ikke i tråd med den gamle verdien. Lagre fra admin, og bekreft at dokumentet etterpå har feltene på toppnivå.
