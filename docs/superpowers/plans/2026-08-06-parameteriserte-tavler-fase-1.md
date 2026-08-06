# Parameteriserte tavler — fase 1: implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gjøre velkomsttavla config-drevet — hva den viser skal komme fra et dokument i Firestore, ikke fra hardkodet JSX i `src/App.jsx`.

**Architecture:** En ny `boards`-collection holder ett dokument per tavle med tre felt: `top` (video eller logo), `middle` (hilsen, åpningstider) og `carousel` (vær, plantegning). All logikk som kan gå galt — ruteparsing, normalisering av config, åpningstider, validering — ligger i rene `.js`-moduler uten Firebase-importer, testet med `node --test`. Komponentene forblir tynne, slik resten av kodebasen allerede er skrudd sammen. Kiosken abonnerer på tavle-dokumentet med `onSnapshot`, akkurat som den allerede gjør med varsler, så en endring i admin slår ut på skjermen innen sekunder.

**Tech Stack:** React 19, Vite 8, Firebase Firestore 12 (web-SDK), Entur designsystem (`@entur/form`, `@entur/typography`, `@entur/layout`, `@entur/tokens`, `@entur/icons`), `node --test` for tester.

**Spec:** `docs/superpowers/specs/2026-08-06-parameteriserte-tavler-design.md`

## Global Constraints

- **Språk:** all kode-kommentar, UI-tekst og commit-melding på norsk (bokmål). Kodebasen er norsk.
- **Ingen nye avhengigheter.** Ingen router, ingen testbibliotek. `node --test` og det som allerede står i `package.json`.
- **Ingen komponenttester.** Kodebasen har ingen, og har ikke oppsett for å rendre JSX i test. Logikk som skal testes må ligge i en `.js`/`.mjs`-modul uten JSX og uten Firebase-import. Komponenter verifiseres med `yarn build` og dev-serveren.
- **Testfiler heter `*.test.mjs`** og ligger ved siden av modulen de tester (`src/boards/openingHours.test.mjs`).
- **Styling er inline-styles med Entur-tokens.** Ikke Tailwind-klasser, ikke CSS-filer.
- **`yarn test` og `yarn build` skal være grønne før hver commit.**
- **Tavla laster seg aldri på nytt av seg selv.** Ingen `location.reload()`, ingen full navigasjon i kiosk-visningen.
- **Fase 1 rører ikke `alerts` eller `admins`.** Meldinger er fortsatt globale, og tilgang er fortsatt `admins`-allowlisten. `boardIds` og `memberships` hører til fase 2.
- **Default tavle-id er `bergen-3`.**
- **Firestore-prosjekt:** `ent-tavleber-prd`. Emulator på port 8080 (Firestore) og 9099 (Auth), slått på med `VITE_USE_EMULATOR=true` i `.env.local`.

## Filstruktur

**Nye filer:**

| Fil | Ansvar |
|---|---|
| `src/routing/parseRoute.js` | Pathname → rute. Ingen React, ingen Firebase. |
| `src/routing/parseRoute.test.mjs` | Tester for de fire ruteformene. |
| `src/boards/openingHours.js` | Dagsnøkler, normalisering og formatering av åpningstider. |
| `src/boards/openingHours.test.mjs` | Tester. |
| `src/boards/boardConfig.js` | Modulkatalogen og normaliseringen av et tavle-dokument. |
| `src/boards/boardConfig.test.mjs` | Tester. |
| `src/boards/boardValidation.js` | Validering av oppsettskjemaet. Speiler `firestore.rules`. |
| `src/boards/boardValidation.test.mjs` | Tester. |
| `src/boards/boardsRepository.js` | Firestore-tilgang for `boards`. Speiler `alertsRepository.js`. |
| `src/components/TopBand.jsx` | Toppfeltet: video eller logo. |
| `src/components/Greeting.jsx` | Hilsen-blokka: illustrasjon + overskrift + tekst. |
| `src/components/OpeningHours.jsx` | Åpningstider-blokka. |
| `src/components/BoardMissing.jsx` | Skjermen når tavla ikke finnes. |
| `src/admin/BoardList.jsx` | Liste over tavler på `/admin`. |
| `src/admin/BoardAdmin.jsx` | Siden på `/admin/t/<id>`. |
| `src/admin/BoardConfigForm.jsx` | Oppsettskjemaet. |

**Endrede filer:**

| Fil | Endring |
|---|---|
| `src/App.jsx` | Fra hardkodet layout til renderer over en config. |
| `src/components/Carousel.jsx` | Tåler tom slide-liste. |
| `src/main.jsx` | Ruter på `parseRoute` i stedet for én `startsWith`-sjekk. |
| `src/admin/Admin.jsx` | Tar imot `route`, viser tavleliste eller tavleside. |
| `firestore.rules` | Regler for `boards`. |
| `README.md` | Tavler, ruter, modulkatalog, migrering. |

---

### Task 1: Ruteparsing

**Files:**
- Create: `src/routing/parseRoute.js`
- Test: `src/routing/parseRoute.test.mjs`

**Interfaces:**
- Consumes: ingenting.
- Produces: `parseRoute(pathname)` → `{ kind: 'board', boardId: string, canonical?: string }` | `{ kind: 'admin' }` | `{ kind: 'adminBoard', boardId: string }` | `{ kind: 'notFound', pathname: string }`. Konstanten `DEFAULT_BOARD_ID = 'bergen-3'`.

- [ ] **Step 1: Skriv den feilende testen**

Opprett `src/routing/parseRoute.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_BOARD_ID, parseRoute } from './parseRoute.js';

describe('parseRoute', () => {
    it('gir default-tavla på rot, med kanonisk sti', () => {
        assert.deepEqual(parseRoute('/'), {
            kind: 'board',
            boardId: DEFAULT_BOARD_ID,
            canonical: `/t/${DEFAULT_BOARD_ID}`,
        });
    });

    it('leser tavle-id fra /t/<id>', () => {
        assert.deepEqual(parseRoute('/t/billettkontor-bergen'), {
            kind: 'board',
            boardId: 'billettkontor-bergen',
        });
    });

    it('tåler etterfølgende skråstrek', () => {
        assert.equal(parseRoute('/t/bergen-3/').boardId, 'bergen-3');
        assert.equal(parseRoute('/admin/').kind, 'admin');
    });

    it('kjenner igjen admin-rutene', () => {
        assert.deepEqual(parseRoute('/admin'), { kind: 'admin' });
        assert.deepEqual(parseRoute('/admin/t/bergen-3'), {
            kind: 'adminBoard',
            boardId: 'bergen-3',
        });
    });

    it('lar ikke /admin/t/<id> bli tolket som en tavle', () => {
        assert.equal(parseRoute('/admin/t/bergen-3').kind, 'adminBoard');
    });

    it('avviser id-er med tegn som ikke er lovlige i en slug', () => {
        assert.equal(parseRoute('/t/Bergen 3').kind, 'notFound');
        assert.equal(parseRoute('/t/bergen_3').kind, 'notFound');
    });

    it('gir notFound for alt annet', () => {
        assert.deepEqual(parseRoute('/t/'), { kind: 'notFound', pathname: '/t/' });
        assert.deepEqual(parseRoute('/noe'), { kind: 'notFound', pathname: '/noe' });
    });
});
```

- [ ] **Step 2: Kjør testen og se at den feiler**

Run: `yarn test`
Expected: FAIL — `Cannot find module './parseRoute.js'`.

- [ ] **Step 3: Skriv implementasjonen**

Opprett `src/routing/parseRoute.js`:

```js
/**
 * Hvilken rute en pathname peker på.
 *
 * Ligger utenfor `main.jsx`, uten React- og Firebase-importer, slik at den kan
 * testes med `node --test`. Ingen router-avhengighet: kiosken skal ikke laste
 * kode den aldri bruker, og fire statiske former er tre regexer.
 */

/** Tavla som `/` skal vise. Skal kunne fjernes når skjermen peker på /t/<id>. */
export const DEFAULT_BOARD_ID = 'bergen-3';

// Samme tegnsett som id-forslaget i admin lager. Snevert med vilje: id-en er en
// URL, og en id med mellomrom eller store bokstaver er en felle.
const BOARD = /^\/t\/([a-z0-9-]+)\/?$/;
const ADMIN_BOARD = /^\/admin\/t\/([a-z0-9-]+)\/?$/;
const ADMIN = /^\/admin\/?$/;

export function parseRoute(pathname) {
    if (pathname === '/' || pathname === '') {
        return {
            kind: 'board',
            boardId: DEFAULT_BOARD_ID,
            canonical: `/t/${DEFAULT_BOARD_ID}`,
        };
    }

    // Admin-rutene først: /admin/t/<id> begynner ikke på /t/, men rekkefølgen
    // gjør det umulig å innføre en tavle-rute som spiser dem senere.
    const adminBoard = ADMIN_BOARD.exec(pathname);
    if (adminBoard) {
        return { kind: 'adminBoard', boardId: adminBoard[1] };
    }
    if (ADMIN.test(pathname)) {
        return { kind: 'admin' };
    }

    const board = BOARD.exec(pathname);
    if (board) {
        return { kind: 'board', boardId: board[1] };
    }

    return { kind: 'notFound', pathname };
}
```

- [ ] **Step 4: Kjør testen og se at den passerer**

Run: `yarn test`
Expected: PASS — alle sju testene i `parseRoute` grønne, og de eksisterende testene fortsatt grønne.

- [ ] **Step 5: Commit**

```bash
git add src/routing/parseRoute.js src/routing/parseRoute.test.mjs
git commit -m "feat: ruteparsing for tavle- og admin-rutene"
```

---

### Task 2: Åpningstider — dager, normalisering og formatering

**Files:**
- Create: `src/boards/openingHours.js`
- Test: `src/boards/openingHours.test.mjs`

**Interfaces:**
- Consumes: ingenting.
- Produces:
  - `DAY_KEYS` — `['mon','tue','wed','thu','fri','sat','sun']`
  - `DAY_LABELS` — objekt fra dagsnøkkel til norsk navn
  - `normalizeDays(value)` → alltid sju objekter i ukerekkefølge: `{ day, closed: true }` eller `{ day, closed: false, opens: 'HH:MM', closes: 'HH:MM' }`
  - `formatOpeningHours(days)` → `[{ day, label, value }]` der `value` er `'Stengt'` eller `'08:00–16:00'`
  - `isTimeOfDay(value)` → boolean

- [ ] **Step 1: Skriv den feilende testen**

Opprett `src/boards/openingHours.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    DAY_KEYS,
    formatOpeningHours,
    isTimeOfDay,
    normalizeDays,
} from './openingHours.js';

describe('normalizeDays', () => {
    it('gir alltid sju dager i ukerekkefølge', () => {
        const days = normalizeDays(undefined);
        assert.equal(days.length, 7);
        assert.deepEqual(days.map((d) => d.day), DAY_KEYS);
    });

    it('lar dager som mangler være stengt', () => {
        const days = normalizeDays([{ day: 'mon', opens: '08:00', closes: '16:00' }]);
        assert.deepEqual(days[0], { day: 'mon', closed: false, opens: '08:00', closes: '16:00' });
        assert.deepEqual(days[1], { day: 'tue', closed: true });
    });

    it('respekterer closed selv om tidene står der', () => {
        const days = normalizeDays([{ day: 'mon', closed: true, opens: '08:00', closes: '16:00' }]);
        assert.deepEqual(days[0], { day: 'mon', closed: true });
    });

    it('stenger dagen når et klokkeslett er ugyldig', () => {
        const days = normalizeDays([
            { day: 'mon', opens: '8:00', closes: '16:00' },
            { day: 'tue', opens: '08:00', closes: '25:00' },
            { day: 'wed', opens: '08:00' },
        ]);
        assert.equal(days[0].closed, true);
        assert.equal(days[1].closed, true);
        assert.equal(days[2].closed, true);
    });

    it('stenger dagen når den lukker før eller samtidig som den åpner', () => {
        const days = normalizeDays([
            { day: 'mon', opens: '16:00', closes: '08:00' },
            { day: 'tue', opens: '08:00', closes: '08:00' },
        ]);
        assert.equal(days[0].closed, true);
        assert.equal(days[1].closed, true);
    });

    it('tåler noe annet enn en liste', () => {
        assert.equal(normalizeDays('mandag 8-16').length, 7);
        assert.equal(normalizeDays(null).every((d) => d.closed), true);
    });
});

describe('formatOpeningHours', () => {
    it('skriver ut norsk dagsnavn og tidsrom', () => {
        const rows = formatOpeningHours(normalizeDays([
            { day: 'mon', opens: '08:00', closes: '16:00' },
        ]));
        assert.deepEqual(rows[0], { day: 'mon', label: 'Mandag', value: '08:00–16:00' });
        assert.equal(rows[1].value, 'Stengt');
    });
});

describe('isTimeOfDay', () => {
    it('godtar HH:MM i døgnet', () => {
        assert.equal(isTimeOfDay('00:00'), true);
        assert.equal(isTimeOfDay('23:59'), true);
    });

    it('avviser alt annet', () => {
        assert.equal(isTimeOfDay('24:00'), false);
        assert.equal(isTimeOfDay('8:00'), false);
        assert.equal(isTimeOfDay('08:60'), false);
        assert.equal(isTimeOfDay(''), false);
        assert.equal(isTimeOfDay(800), false);
    });
});
```

- [ ] **Step 2: Kjør testen og se at den feiler**

Run: `yarn test`
Expected: FAIL — `Cannot find module './openingHours.js'`.

- [ ] **Step 3: Skriv implementasjonen**

Opprett `src/boards/openingHours.js`:

```js
/**
 * Åpningstider: dagsnøkler, normalisering og visningsform.
 *
 * Uten Firebase-importer og uten JSX, slik at det kan testes med `node --test`.
 *
 * Åpningstidene er lagt inn i et skjema, ikke som fritekst, og tavla viser dem
 * som de står. Det finnes ingen «åpent nå»-logikk — det ville krevd at vi tok
 * stilling til tidssone og helligdager, og ingen har bedt om det.
 */

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const DAY_LABELS = {
    mon: 'Mandag',
    tue: 'Tirsdag',
    wed: 'Onsdag',
    thu: 'Torsdag',
    fri: 'Fredag',
    sat: 'Lørdag',
    sun: 'Søndag',
};

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Om verdien er et klokkeslett på formen HH:MM innenfor døgnet. */
export function isTimeOfDay(value) {
    return typeof value === 'string' && TIME_OF_DAY.test(value);
}

/**
 * Alltid sju dager i ukerekkefølge, uansett hva som lå i dokumentet.
 *
 * Alt som ikke er en hel, gyldig åpningstid blir «stengt». Et dokument skrevet
 * for hånd i konsollet skal ikke kunne gi tavla en dag som verken er åpen eller
 * stengt — da er det bedre å vise «Stengt» enn et tomt felt.
 *
 * Sammenlikningen `opens >= closes` er tekstsammenlikning, som er riktig for
 * HH:MM med ledende null. En dag som lukker ved midnatt (`00:00`) blir dermed
 * stengt; det er en kjent begrensning, ikke en glipp.
 */
export function normalizeDays(value) {
    const list = Array.isArray(value) ? value : [];
    return DAY_KEYS.map((day) => {
        const found = list.find((entry) => entry && entry.day === day);
        if (!found || found.closed === true) {
            return { day, closed: true };
        }
        if (!isTimeOfDay(found.opens) || !isTimeOfDay(found.closes)) {
            return { day, closed: true };
        }
        if (found.opens >= found.closes) {
            return { day, closed: true };
        }
        return { day, closed: false, opens: found.opens, closes: found.closes };
    });
}

/** Radene tavla og admin viser. Tankestrek, ikke bindestrek, mellom tidene. */
export function formatOpeningHours(days) {
    return days.map((day) => ({
        day: day.day,
        label: DAY_LABELS[day.day],
        value: day.closed ? 'Stengt' : `${day.opens}–${day.closes}`,
    }));
}
```

- [ ] **Step 4: Kjør testen og se at den passerer**

Run: `yarn test`
Expected: PASS. Nøklene i `DAY_LABELS` må stemme nøyaktig med `DAY_KEYS` — en `fre` der det skal stå `fri` gir `label: undefined` på fredag uten at noe annet feiler.

- [ ] **Step 5: Commit**

```bash
git add src/boards/openingHours.js src/boards/openingHours.test.mjs
git commit -m "feat: normalisering og formatering av åpningstider"
```

---

### Task 3: Modulkatalogen og normalisering av config

**Files:**
- Create: `src/boards/boardConfig.js`
- Test: `src/boards/boardConfig.test.mjs`

**Interfaces:**
- Consumes: `normalizeDays` fra `src/boards/openingHours.js` (Task 2).
- Produces:
  - Katalog-konstanter: `TOP_KINDS`, `MIDDLE_TYPES`, `CAROUSEL_TYPES`, `FLOORPLAN_PLANS`, `GREETING_AUTO`, `GREETING_TEXT_MAX_LENGTH`, `NAME_MAX_LENGTH`, `PLACE_NAME_MAX_LENGTH`
  - `normalizeBoardConfig(id, data)` → `{ id, name, placeName, top: { kind }, middle: [], carousel: [] }`
  - `findModule(list, type)` → modulen eller `undefined`
  - `boardHeading(placeName)` → `'Velkommen til Entur <placeName>'`
  - `toFirestoreBoard(config, userEmail)` → feltene som skrives til Firestore

- [ ] **Step 1: Skriv den feilende testen**

Opprett `src/boards/boardConfig.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    boardHeading,
    findModule,
    normalizeBoardConfig,
    toFirestoreBoard,
} from './boardConfig.js';

/** Et dokument slik det ser ut i Firestore for dagens Bergen-tavle. */
function bergenDocument() {
    return {
        name: 'Bergen 3. etasje',
        placeName: 'Bergen',
        top: { kind: 'video' },
        middle: [{ type: 'greeting', text: 'auto', staffImage: true }],
        carousel: [
            { type: 'weather', name: 'Bergen', lat: 60.39299, lng: 5.32415 },
            { type: 'floorplan', plan: 'bergen-3' },
        ],
    };
}

describe('normalizeBoardConfig', () => {
    it('beholder et gyldig dokument', () => {
        const config = normalizeBoardConfig('bergen-3', bergenDocument());
        assert.equal(config.id, 'bergen-3');
        assert.equal(config.name, 'Bergen 3. etasje');
        assert.equal(config.placeName, 'Bergen');
        assert.equal(config.top.kind, 'video');
        assert.deepEqual(config.middle, [{ type: 'greeting', text: 'auto', staffImage: true }]);
        assert.equal(config.carousel.length, 2);
    });

    it('hopper over modultyper den ikke kjenner', () => {
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            carousel: [{ type: 'departures', stopPlaceId: 'NSR:StopPlace:1' }, { type: 'floorplan', plan: 'bergen-3' }],
        });
        assert.deepEqual(config.carousel, [{ type: 'floorplan', plan: 'bergen-3' }]);
    });

    it('beholder bare den første modulen av hver type', () => {
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            carousel: [
                { type: 'weather', name: 'Bergen', lat: 60.4, lng: 5.3 },
                { type: 'weather', name: 'Oslo', lat: 59.9, lng: 10.7 },
            ],
        });
        assert.equal(config.carousel.length, 1);
        assert.equal(config.carousel[0].name, 'Bergen');
    });

    it('tvinger rekkefølgen fra katalogen', () => {
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            carousel: [{ type: 'floorplan', plan: 'bergen-3' }, { type: 'weather', name: 'Bergen', lat: 60.4, lng: 5.3 }],
        });
        assert.deepEqual(config.carousel.map((m) => m.type), ['weather', 'floorplan']);
    });

    it('dropper vær uten brukbare koordinater', () => {
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            carousel: [{ type: 'weather', name: 'Bergen', lat: 'nord', lng: 5.3 }],
        });
        assert.deepEqual(config.carousel, []);
    });

    it('dropper plantegning med ukjent plan', () => {
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            carousel: [{ type: 'floorplan', plan: 'oslo-7' }],
        });
        assert.deepEqual(config.carousel, []);
    });

    it('faller tilbake til video når toppen er ukjent eller mangler', () => {
        assert.equal(normalizeBoardConfig('x', { ...bergenDocument(), top: { kind: 'banner' } }).top.kind, 'video');
        assert.equal(normalizeBoardConfig('x', { ...bergenDocument(), top: undefined }).top.kind, 'video');
    });

    it('godtar logo som topp', () => {
        assert.equal(normalizeBoardConfig('x', { ...bergenDocument(), top: { kind: 'logo' } }).top.kind, 'logo');
    });

    it('gir hilsenen forsvarlige verdier', () => {
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            middle: [{ type: 'greeting' }],
        });
        assert.deepEqual(config.middle, [{ type: 'greeting', text: 'auto', staffImage: true }]);
    });

    it('trimmer og beholder en fast hilsen-tekst', () => {
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            middle: [{ type: 'greeting', text: '  Hei og velkommen  ', staffImage: false }],
        });
        assert.deepEqual(config.middle, [{ type: 'greeting', text: 'Hei og velkommen', staffImage: false }]);
    });

    it('normaliserer åpningstidene til sju dager', () => {
        const config = normalizeBoardConfig('x', {
            ...bergenDocument(),
            middle: [{ type: 'openingHours', days: [{ day: 'mon', opens: '08:00', closes: '16:00' }] }],
        });
        assert.equal(config.middle[0].days.length, 7);
        assert.equal(config.middle[0].days[0].closed, false);
    });

    it('godtar tomme felt', () => {
        const config = normalizeBoardConfig('x', { name: 'Tom', placeName: 'Bergen', middle: [], carousel: [] });
        assert.deepEqual(config.middle, []);
        assert.deepEqual(config.carousel, []);
    });

    it('tåler et dokument med hull i', () => {
        const config = normalizeBoardConfig('x', {});
        assert.equal(config.name, '');
        assert.equal(config.placeName, '');
        assert.equal(config.top.kind, 'video');
        assert.deepEqual(config.middle, []);
        assert.deepEqual(config.carousel, []);
    });
});

describe('findModule', () => {
    it('finner modulen med riktig type', () => {
        const config = normalizeBoardConfig('x', bergenDocument());
        assert.equal(findModule(config.carousel, 'weather').name, 'Bergen');
        assert.equal(findModule(config.carousel, 'departures'), undefined);
    });
});

describe('boardHeading', () => {
    it('setter stedsnavnet inn i overskriften', () => {
        assert.equal(boardHeading('Bergen'), 'Velkommen til Entur Bergen');
    });
});

describe('toFirestoreBoard', () => {
    it('skriver feltene tavla trenger, med den innlogget som updatedBy', () => {
        const config = normalizeBoardConfig('bergen-3', bergenDocument());
        const data = toFirestoreBoard(config, 'ola@entur.org');
        assert.equal(data.name, 'Bergen 3. etasje');
        assert.equal(data.updatedBy, 'ola@entur.org');
        assert.deepEqual(data.top, { kind: 'video' });
        assert.equal(data.carousel.length, 2);
        assert.equal('id' in data, false);
    });
});
```

- [ ] **Step 2: Kjør testen og se at den feiler**

Run: `yarn test`
Expected: FAIL — `Cannot find module './boardConfig.js'`.

- [ ] **Step 3: Skriv implementasjonen**

Opprett `src/boards/boardConfig.js`:

```js
/**
 * Modulkatalogen: hva en tavle kan vise, og hvordan et dokument fra Firestore
 * gjøres om til noe kiosken trygt kan rendre.
 *
 * Uten Firebase-importer og uten JSX, slik at katalogen kan testes med
 * `node --test`.
 *
 * Normaliseringen er kiosken sitt vern. Firestore-reglene kan ikke iterere over
 * en liste og validerer derfor bare grovformen på `middle` og `carousel`; et
 * dokument skrevet for hånd i konsollet kan altså inneholde tull. Alt som ikke
 * går an å rendre blir derfor kastet her, ikke i komponentene.
 */
import { normalizeDays } from './openingHours.js';

export const TOP_KINDS = ['video', 'logo'];

/** Rekkefølgen her er rekkefølgen på skjermen. */
export const MIDDLE_TYPES = ['greeting', 'openingHours'];
export const CAROUSEL_TYPES = ['weather', 'floorplan'];

/** `departures` kommer i fase 3. Katalogen står klar; modulen finnes ikke. */
export const FLOORPLAN_PLANS = ['bergen-3'];

export const GREETING_AUTO = 'auto';
export const GREETING_TEXT_MAX_LENGTH = 120;
export const NAME_MAX_LENGTH = 60;
export const PLACE_NAME_MAX_LENGTH = 40;

const DEFAULT_TOP_KIND = 'video';

export function normalizeBoardConfig(id, data = {}) {
    const source = data ?? {};
    return {
        id,
        name: asText(source.name, NAME_MAX_LENGTH),
        placeName: asText(source.placeName, PLACE_NAME_MAX_LENGTH),
        top: { kind: TOP_KINDS.includes(source.top?.kind) ? source.top.kind : DEFAULT_TOP_KIND },
        middle: normalizeModules(source.middle, MIDDLE_TYPES, MIDDLE_NORMALIZERS),
        carousel: normalizeModules(source.carousel, CAROUSEL_TYPES, CAROUSEL_NORMALIZERS),
    };
}

export function findModule(list, type) {
    return list.find((module) => module.type === type);
}

export function boardHeading(placeName) {
    return `Velkommen til Entur ${placeName}`;
}

export function toFirestoreBoard(config, userEmail) {
    return {
        name: config.name.trim(),
        placeName: config.placeName.trim(),
        top: { kind: config.top.kind },
        middle: config.middle,
        carousel: config.carousel,
        updatedBy: userEmail,
    };
}

const MIDDLE_NORMALIZERS = {
    greeting: (module) => {
        const text = typeof module.text === 'string' ? module.text.trim() : '';
        return {
            type: 'greeting',
            text: text === '' || text === GREETING_AUTO
                ? GREETING_AUTO
                : text.slice(0, GREETING_TEXT_MAX_LENGTH),
            // Standard er på: dagens tavle har illustrasjonen, og et dokument
            // uten feltet skal ikke endre hvordan den ser ut.
            staffImage: module.staffImage !== false,
        };
    },
    openingHours: (module) => ({ type: 'openingHours', days: normalizeDays(module.days) }),
};

const CAROUSEL_NORMALIZERS = {
    // Vær uten koordinater kan ikke hente noe. Da er det bedre å la modulen
    // falle bort enn å vise en tom slide karusellen bruker 30 sekunder på.
    weather: (module) => {
        const lat = Number(module.lat);
        const lng = Number(module.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return null;
        }
        return { type: 'weather', name: asText(module.name, PLACE_NAME_MAX_LENGTH), lat, lng };
    },
    floorplan: (module) => (
        FLOORPLAN_PLANS.includes(module.plan) ? { type: 'floorplan', plan: module.plan } : null
    ),
};

/**
 * Går gjennom katalogen, ikke gjennom dokumentet. Det gir tre ting på én gang:
 * ukjente typer faller bort, rekkefølgen blir katalogens, og en type som står
 * to ganger blir til én.
 */
function normalizeModules(value, order, normalizers) {
    const list = Array.isArray(value) ? value : [];
    const result = [];
    for (const type of order) {
        const found = list.find((module) => module && module.type === type);
        if (!found) {
            continue;
        }
        const normalized = normalizers[type](found);
        if (normalized) {
            result.push(normalized);
        }
    }
    return result;
}

function asText(value, maxLength) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}
```

- [ ] **Step 4: Kjør testen og se at den passerer**

Run: `yarn test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/boards/boardConfig.js src/boards/boardConfig.test.mjs
git commit -m "feat: modulkatalog og normalisering av tavle-config"
```

---

### Task 4: Validering av oppsettskjemaet

**Files:**
- Create: `src/boards/boardValidation.js`
- Test: `src/boards/boardValidation.test.mjs`

**Interfaces:**
- Consumes: `GREETING_TEXT_MAX_LENGTH`, `NAME_MAX_LENGTH`, `PLACE_NAME_MAX_LENGTH`, `FLOORPLAN_PLANS` fra `boardConfig.js` (Task 3); `DAY_LABELS`, `isTimeOfDay` fra `openingHours.js` (Task 2).
- Produces: `validateBoardInput(draft)` → objekt med feilmelding per feltnavn (`name`, `placeName`, `greetingText`, `openingHours`, `weatherName`, `weatherLat`, `weatherLng`, `floorplan`), og `hasErrors(errors)`.

Utkastet (`draft`) er den flate formen skjemaet jobber med — den defineres i Task 9, men validering skrives først fordi den er ren logikk. Formen er:

```js
{
    id, name, placeName, topKind,
    greetingEnabled, greetingAuto, greetingText, staffImage,
    openingHoursEnabled, days,          // days: sju objekter fra normalizeDays
    weatherEnabled, weatherName, weatherLat, weatherLng,   // lat/lng som streng
    floorplanEnabled, floorplanPlan,
}
```

- [ ] **Step 1: Skriv den feilende testen**

Opprett `src/boards/boardValidation.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { hasErrors, validateBoardInput } from './boardValidation.js';

function validDraft(overrides = {}) {
    return {
        id: 'bergen-3',
        name: 'Bergen 3. etasje',
        placeName: 'Bergen',
        topKind: 'video',
        greetingEnabled: true,
        greetingAuto: true,
        greetingText: '',
        staffImage: true,
        openingHoursEnabled: false,
        days: [
            { day: 'mon', closed: false, opens: '08:00', closes: '16:00' },
            { day: 'tue', closed: true },
            { day: 'wed', closed: true },
            { day: 'thu', closed: true },
            { day: 'fri', closed: true },
            { day: 'sat', closed: true },
            { day: 'sun', closed: true },
        ],
        weatherEnabled: true,
        weatherName: 'Bergen',
        weatherLat: '60.39299',
        weatherLng: '5.32415',
        floorplanEnabled: true,
        floorplanPlan: 'bergen-3',
        ...overrides,
    };
}

describe('validateBoardInput', () => {
    it('godtar et gyldig oppsett', () => {
        assert.deepEqual(validateBoardInput(validDraft()), {});
        assert.equal(hasErrors({}), false);
    });

    it('krever navn og stedsnavn', () => {
        const errors = validateBoardInput(validDraft({ name: '   ', placeName: '' }));
        assert.equal(errors.name, 'Navn er påkrevd');
        assert.equal(errors.placeName, 'Stedsnavn er påkrevd');
        assert.equal(hasErrors(errors), true);
    });

    it('setter en øvre grense på navn og stedsnavn', () => {
        const errors = validateBoardInput(validDraft({ name: 'a'.repeat(61), placeName: 'b'.repeat(41) }));
        assert.equal(errors.name, 'Navn kan være maks 60 tegn');
        assert.equal(errors.placeName, 'Stedsnavn kan være maks 40 tegn');
    });

    it('krever tekst når hilsenen ikke er automatisk', () => {
        const errors = validateBoardInput(validDraft({ greetingAuto: false, greetingText: '  ' }));
        assert.equal(errors.greetingText, 'Skriv en tekst, eller velg automatisk hilsen');
    });

    it('setter en øvre grense på hilsen-teksten', () => {
        const errors = validateBoardInput(validDraft({ greetingAuto: false, greetingText: 'a'.repeat(121) }));
        assert.equal(errors.greetingText, 'Hilsen kan være maks 120 tegn');
    });

    it('ser bort fra hilsen-teksten når hilsenen er slått av', () => {
        const errors = validateBoardInput(validDraft({ greetingEnabled: false, greetingAuto: false, greetingText: '' }));
        assert.equal(errors.greetingText, undefined);
    });

    it('krever brukbare koordinater når vær er på', () => {
        const errors = validateBoardInput(validDraft({ weatherLat: 'nord', weatherLng: '' }));
        assert.equal(errors.weatherLat, 'Breddegrad må være et tall mellom -90 og 90');
        assert.equal(errors.weatherLng, 'Lengdegrad må være et tall mellom -180 og 180');
    });

    it('avviser koordinater utenfor kloden', () => {
        const errors = validateBoardInput(validDraft({ weatherLat: '91', weatherLng: '181' }));
        assert.equal(errors.weatherLat, 'Breddegrad må være et tall mellom -90 og 90');
        assert.equal(errors.weatherLng, 'Lengdegrad må være et tall mellom -180 og 180');
    });

    it('krever stedsnavn på værmodulen', () => {
        const errors = validateBoardInput(validDraft({ weatherName: '' }));
        assert.equal(errors.weatherName, 'Stedsnavn for været er påkrevd');
    });

    it('ser bort fra været når modulen er slått av', () => {
        const errors = validateBoardInput(validDraft({ weatherEnabled: false, weatherLat: 'nord', weatherName: '' }));
        assert.equal(errors.weatherLat, undefined);
        assert.equal(errors.weatherName, undefined);
    });

    it('peker på første dag med ugyldig åpningstid', () => {
        const errors = validateBoardInput(validDraft({
            openingHoursEnabled: true,
            days: [
                { day: 'mon', closed: true },
                { day: 'tue', closed: false, opens: '16:00', closes: '08:00' },
                { day: 'wed', closed: false, opens: '', closes: '16:00' },
                { day: 'thu', closed: true },
                { day: 'fri', closed: true },
                { day: 'sat', closed: true },
                { day: 'sun', closed: true },
            ],
        }));
        assert.equal(errors.openingHours, 'Tirsdag: stengetid må være etter åpningstid');
    });

    it('krever at åpningstider har minst én åpen dag', () => {
        const errors = validateBoardInput(validDraft({
            openingHoursEnabled: true,
            days: [
                { day: 'mon', closed: true }, { day: 'tue', closed: true },
                { day: 'wed', closed: true }, { day: 'thu', closed: true },
                { day: 'fri', closed: true }, { day: 'sat', closed: true },
                { day: 'sun', closed: true },
            ],
        }));
        assert.equal(errors.openingHours, 'Minst én dag må ha en åpningstid');
    });

    it('avviser en plantegning som ikke finnes', () => {
        const errors = validateBoardInput(validDraft({ floorplanPlan: 'oslo-7' }));
        assert.equal(errors.floorplan, 'Velg en plantegning');
    });
});
```

- [ ] **Step 2: Kjør testen og se at den feiler**

Run: `yarn test`
Expected: FAIL — `Cannot find module './boardValidation.js'`.

- [ ] **Step 3: Skriv implementasjonen**

Opprett `src/boards/boardValidation.js`:

```js
/**
 * Validerer oppsettskjemaet før lagring.
 *
 * Speiler firestore.rules og normaliseringen i boardConfig med vilje: her ligger
 * den gode feilmeldingen, der ligger håndhevingen. Endrer du grensene her, endre
 * dem der også.
 *
 * Returnerer et objekt med feilmelding per feltnavn. Tomt objekt = gyldig.
 */
import {
    FLOORPLAN_PLANS,
    GREETING_TEXT_MAX_LENGTH,
    NAME_MAX_LENGTH,
    PLACE_NAME_MAX_LENGTH,
} from './boardConfig.js';
import { DAY_LABELS, isTimeOfDay } from './openingHours.js';

export function validateBoardInput(draft) {
    const errors = {};

    const name = trimmed(draft.name);
    if (name.length === 0) {
        errors.name = 'Navn er påkrevd';
    } else if (name.length > NAME_MAX_LENGTH) {
        errors.name = `Navn kan være maks ${NAME_MAX_LENGTH} tegn`;
    }

    const placeName = trimmed(draft.placeName);
    if (placeName.length === 0) {
        errors.placeName = 'Stedsnavn er påkrevd';
    } else if (placeName.length > PLACE_NAME_MAX_LENGTH) {
        errors.placeName = `Stedsnavn kan være maks ${PLACE_NAME_MAX_LENGTH} tegn`;
    }

    if (draft.greetingEnabled && !draft.greetingAuto) {
        const text = trimmed(draft.greetingText);
        if (text.length === 0) {
            errors.greetingText = 'Skriv en tekst, eller velg automatisk hilsen';
        } else if (text.length > GREETING_TEXT_MAX_LENGTH) {
            errors.greetingText = `Hilsen kan være maks ${GREETING_TEXT_MAX_LENGTH} tegn`;
        }
    }

    if (draft.openingHoursEnabled) {
        const openingHoursError = firstOpeningHoursError(draft.days);
        if (openingHoursError) {
            errors.openingHours = openingHoursError;
        }
    }

    if (draft.weatherEnabled) {
        if (trimmed(draft.weatherName).length === 0) {
            errors.weatherName = 'Stedsnavn for været er påkrevd';
        }
        if (!isCoordinate(draft.weatherLat, 90)) {
            errors.weatherLat = 'Breddegrad må være et tall mellom -90 og 90';
        }
        if (!isCoordinate(draft.weatherLng, 180)) {
            errors.weatherLng = 'Lengdegrad må være et tall mellom -180 og 180';
        }
    }

    if (draft.floorplanEnabled && !FLOORPLAN_PLANS.includes(draft.floorplanPlan)) {
        errors.floorplan = 'Velg en plantegning';
    }

    return errors;
}

export function hasErrors(errors) {
    return Object.keys(errors).length > 0;
}

/**
 * Én melding om gangen, ikke sju. Skjemaet har én feilrad for åpningstidene, og
 * en liste med sju halvferdige feil hjelper ingen.
 */
function firstOpeningHoursError(days) {
    const list = Array.isArray(days) ? days : [];
    for (const day of list) {
        if (day.closed) {
            continue;
        }
        if (!isTimeOfDay(day.opens) || !isTimeOfDay(day.closes)) {
            return `${DAY_LABELS[day.day]}: klokkeslettene må være på formen 08:00`;
        }
        if (day.opens >= day.closes) {
            return `${DAY_LABELS[day.day]}: stengetid må være etter åpningstid`;
        }
    }
    if (list.every((day) => day.closed)) {
        return 'Minst én dag må ha en åpningstid';
    }
    return null;
}

function isCoordinate(value, limit) {
    const number = Number(trimmed(value));
    return trimmed(value) !== '' && Number.isFinite(number) && Math.abs(number) <= limit;
}

function trimmed(value) {
    return typeof value === 'string' ? value.trim() : '';
}
```

- [ ] **Step 4: Kjør testen og se at den passerer**

Run: `yarn test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/boards/boardValidation.js src/boards/boardValidation.test.mjs
git commit -m "feat: validering av oppsettskjemaet for tavler"
```

---

### Task 5: Firestore-regler for `boards`

**Files:**
- Modify: `firestore.rules:48` (rett etter `match /alerts/{alertId}`-blokka)

**Interfaces:**
- Consumes: de eksisterende hjelpefunksjonene `callerEmail()`, `isEnturUser()` og `isAdmin()` i `firestore.rules`.
- Produces: en `boards`-collection som er lesbar for alle og skrivbar for de som står i `admins`.

Reglene har ingen automatiske tester i dette repoet — de verifiseres mot emulatoren. Denne oppgaven er derfor bygget rundt en manuell, men presis, verifisering. **Ikke gjett på hva reglene gjør; kjør probene.**

- [ ] **Step 1: Skriv reglene**

I `firestore.rules`, legg inn en valideringsfunksjon rett under `isValidAlert` (etter linje 30):

```
    function isValidBoard(d) {
      return d.name is string && d.name.size() > 0 && d.name.size() <= 60
        && d.placeName is string && d.placeName.size() > 0 && d.placeName.size() <= 40
        && d.top is map && d.top.kind in ['video', 'logo']
        && d.middle is list && d.middle.size() <= 5
        && d.carousel is list && d.carousel.size() <= 5
        && d.updatedBy == callerEmail();
    }
```

og en ny `match`-blokk rett etter `match /alerts/{alertId} { ... }`:

```
    match /boards/{boardId} {
      // Tavla er en kiosk uten pålogging og må kunne lese oppsettet sitt
      // uautentisert. Konsekvens: oppsettet er offentlig lesbart — stoppested,
      // koordinater og åpningstider like mye som meldingene. Se speccen.
      allow read: if true;

      allow create: if isAdmin()
        && isValidBoard(request.resource.data)
        && request.resource.data.createdBy == callerEmail();

      allow update: if isAdmin()
        && isValidBoard(request.resource.data)
        && request.resource.data.createdBy == resource.data.createdBy;

      // Ingen sletting fra klienten i fase 1. En tavle som skal bort, tas i
      // konsollet — det er sjeldent nok, og en feilklikk-sletting tar en skjerm
      // ned uten at noen ser det.
      allow delete: if false;
    }
```

Merk at reglene bare validerer grovformen på `middle` og `carousel`. Regler kan ikke iterere over en liste, så innholdet i modulene valideres ikke her — det er `normalizeBoardConfig` sin jobb, og derfor kan ikke et rart dokument velte kiosken.

- [ ] **Step 2: Start emulatoren**

I én terminal:

```bash
yarn firebase emulators:start --only auth,firestore --project ent-tavleber-prd
```

Krever Java 11+ (`brew install openjdk`). La den stå.

- [ ] **Step 3: Lag et token og en tavle å prøve mot**

I en annen terminal. Tokenet er en **usignert** JWT — det er slik emulatoren vil ha det, og det er den eneste måten å teste reglene som en innlogget bruker uten å logge inn på ekte:

```bash
export PROJECT=ent-tavleber-prd
export BASE="http://127.0.0.1:8080/v1/projects/$PROJECT/databases/(default)/documents"
export TOKEN=$(node -e '
const p = "ent-tavleber-prd";
const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
process.stdout.write(
  b({ alg: "none", typ: "JWT" }) + "." +
  b({
    iss: `https://securetoken.google.com/${p}`, aud: p,
    sub: "tester", user_id: "tester",
    email: "test@entur.org", email_verified: true,
    auth_time: 1000000000, iat: 1000000000, exp: 9999999999,
    firebase: { sign_in_provider: "google.com", identities: {} },
  }) + "."
);
')
```

Legg inn en tavle med eier-bypass (går utenom reglene, slik README allerede beskriver for `admins`):

```bash
curl -s -o /dev/null -w 'opprett tavle: %{http_code}\n' -X POST \
  -H 'Authorization: Bearer owner' -H 'Content-Type: application/json' \
  "$BASE/boards?documentId=bergen-3" \
  -d '{"fields":{
    "name":{"stringValue":"Bergen 3. etasje"},
    "placeName":{"stringValue":"Bergen"},
    "top":{"mapValue":{"fields":{"kind":{"stringValue":"video"}}}},
    "middle":{"arrayValue":{"values":[]}},
    "carousel":{"arrayValue":{"values":[]}},
    "createdBy":{"stringValue":"test@entur.org"},
    "updatedBy":{"stringValue":"test@entur.org"}
  }}'
```

Expected: `opprett tavle: 200`

- [ ] **Step 4: Kjør probene og sammenlikn med forventet svar**

Lagre en gyldig oppdatering i en fil, så de neste kommandoene blir korte:

```bash
cat > /tmp/board-update.json <<'JSON'
{"fields":{
  "name":{"stringValue":"Bergen 3. etasje"},
  "placeName":{"stringValue":"Bergen"},
  "top":{"mapValue":{"fields":{"kind":{"stringValue":"logo"}}}},
  "middle":{"arrayValue":{"values":[]}},
  "carousel":{"arrayValue":{"values":[]}},
  "createdBy":{"stringValue":"test@entur.org"},
  "updatedBy":{"stringValue":"test@entur.org"}
}}
JSON
```

**Probe 1 — kiosken leser uten pålogging:**

```bash
curl -s -o /dev/null -w 'uautentisert lesing: %{http_code}\n' "$BASE/boards/bergen-3"
```
Expected: `200`

**Probe 2 — Entur-bruker uten oppføring i `admins` får ikke skrive:**

```bash
curl -s -o /dev/null -w 'skriv uten admins: %{http_code}\n' -X PATCH \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  "$BASE/boards/bergen-3" -d @/tmp/board-update.json
```
Expected: `403`

**Probe 3 — samme bruker med oppføring i `admins` får skrive:**

```bash
curl -s -o /dev/null -w 'legg i admins: %{http_code}\n' -X POST \
  -H 'Authorization: Bearer owner' -H 'Content-Type: application/json' \
  "$BASE/admins?documentId=test@entur.org" -d '{"fields":{"addedBy":{"stringValue":"probe"}}}'

curl -s -o /dev/null -w 'skriv som admin: %{http_code}\n' -X PATCH \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  "$BASE/boards/bergen-3" -d @/tmp/board-update.json
```
Expected: `legg i admins: 200` og `skriv som admin: 200`

**Probe 4 — ukjent topp-variant avvises:**

```bash
sed 's/"logo"/"banner"/' /tmp/board-update.json > /tmp/board-bad-top.json
curl -s -o /dev/null -w 'ugyldig top.kind: %{http_code}\n' -X PATCH \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  "$BASE/boards/bergen-3" -d @/tmp/board-bad-top.json
```
Expected: `403`

**Probe 5 — man kan ikke skrive i andres navn:**

```bash
sed 's/"updatedBy":{"stringValue":"test@entur.org"}/"updatedBy":{"stringValue":"andre@entur.org"}/' \
  /tmp/board-update.json > /tmp/board-wrong-user.json
curl -s -o /dev/null -w 'feil updatedBy: %{http_code}\n' -X PATCH \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  "$BASE/boards/bergen-3" -d @/tmp/board-wrong-user.json
```
Expected: `403`

**Probe 6 — `createdBy` kan ikke overtas:**

```bash
sed 's/"createdBy":{"stringValue":"test@entur.org"}/"createdBy":{"stringValue":"andre@entur.org"}/' \
  /tmp/board-update.json > /tmp/board-steal.json
curl -s -o /dev/null -w 'endret createdBy: %{http_code}\n' -X PATCH \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  "$BASE/boards/bergen-3" -d @/tmp/board-steal.json
```
Expected: `403`

**Probe 7 — sletting er stengt:**

```bash
curl -s -o /dev/null -w 'sletting: %{http_code}\n' -X DELETE \
  -H "Authorization: Bearer $TOKEN" "$BASE/boards/bergen-3"
```
Expected: `403`

**Probe 8 — for langt navn avvises (`size()` teller tegn):**

```bash
node -e '
const long = "a".repeat(61);
const doc = require("fs").readFileSync("/tmp/board-update.json", "utf8");
require("fs").writeFileSync("/tmp/board-long-name.json", doc.replace("Bergen 3. etasje", long));
'
curl -s -o /dev/null -w 'for langt navn: %{http_code}\n' -X PATCH \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  "$BASE/boards/bergen-3" -d @/tmp/board-long-name.json
```
Expected: `403`

Får du et annet svar enn det som står som Expected, er det reglene som er feil — ikke proben. Rett reglene og kjør serien på nytt.

- [ ] **Step 5: Rydd opp og commit**

```bash
rm -f /tmp/board-update.json /tmp/board-bad-top.json /tmp/board-wrong-user.json /tmp/board-steal.json /tmp/board-long-name.json
git add firestore.rules
git commit -m "feat: firestore-regler for boards-collectionen"
```

Stopp emulatoren (Ctrl-C i første terminal) når du er ferdig med hele planen — den trengs igjen i Task 7 og 9.

---

### Task 6: Presentasjonskomponentene

**Files:**
- Create: `src/components/TopBand.jsx`, `src/components/Greeting.jsx`, `src/components/OpeningHours.jsx`, `src/components/BoardMissing.jsx`

**Interfaces:**
- Consumes: `formatOpeningHours` fra `src/boards/openingHours.js` (Task 2); `LoopingVideo` fra `src/components/LoopingVideo.jsx`.
- Produces:
  - `<TopBand kind="video" | "logo" />`
  - `<Greeting heading={string} text={string} staffImageSrc={string|null} />`
  - `<OpeningHours days={days} />`
  - `<BoardMissing boardId={string} />`

Komponentene er rene og tas ikke i bruk før Task 7. De kan ikke enhetstestes — kodebasen har ikke oppsett for å rendre JSX i test — så de verifiseres med `yarn build` her og visuelt i Task 7.

- [ ] **Step 1: Skriv `TopBand`**

Opprett `src/components/TopBand.jsx`:

```jsx
import LoopingVideo from './LoopingVideo';
import { base } from '@entur/tokens';

const CONTRAST = base.light.baseColors.frame.contrast;

/** Toppfeltet er 40vh i begge variantene, så resten av layouten ikke flytter seg. */
const BAND = { width: '100vw', height: '40vh', backgroundColor: CONTRAST };

/**
 * Toppen av tavla: enten intro-videoen eller Entur-logoen.
 *
 * Logoen i public/logo.svg er hvit og koral, altså tegnet for mørk bakgrunn —
 * derfor står den på det samme mørkeblå feltet som videoen faller tilbake på.
 */
function TopBand({ kind }) {
    if (kind === 'logo') {
        return (
            <div style={{ ...BAND, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/logo.svg" alt="Entur" style={{ maxHeight: '50%', maxWidth: '60%' }} />
            </div>
        );
    }
    return <LoopingVideo src="/entur.mp4" style={{ ...BAND, display: 'block', objectFit: 'cover' }} />;
}

export default TopBand;
```

- [ ] **Step 2: Skriv `Greeting`**

Opprett `src/components/Greeting.jsx`. Dette er dagens `StaffAndHeadings` fra `App.jsx:18`, flyttet ut og gjort parameterisert:

```jsx
import { memo } from 'react';
import { Heading2, LeadParagraph } from '@entur/typography';

/**
 * Hilsen-blokka: illustrasjon til venstre, overskrift og hilsen til høyre.
 *
 * Memoisert fordi teksten bare endrer seg hvert 15. minutt, mens komponenten
 * over den rendrer på hver eneste snapshot fra Firestore.
 */
const Greeting = memo(function Greeting({ heading, text, staffImageSrc }) {
    return (
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
            <div style={{ marginLeft: staffImageSrc ? '2rem' : 0 }}>
                <Heading2>{heading}</Heading2>
                <LeadParagraph>{text}</LeadParagraph>
            </div>
        </div>
    );
});

export default Greeting;
```

- [ ] **Step 3: Skriv `OpeningHours`**

Opprett `src/components/OpeningHours.jsx`:

```jsx
import { Fragment } from 'react';
import { Heading3 } from '@entur/typography';

import { formatOpeningHours } from '../boards/openingHours';

/**
 * Åpningstider i det mørkeblå feltet.
 *
 * Skaleres opp på samme måte som varslene: tavla leses fra andre siden av
 * rommet, ikke fra en laptop.
 */
function OpeningHours({ days }) {
    const rows = formatOpeningHours(days);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 2rem' }}>
            <Heading3>Åpningstider</Heading3>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', columnGap: '2.5rem', rowGap: '0.25rem', fontSize: '1.375rem' }}>
                {rows.map((row) => (
                    <Fragment key={row.day}>
                        <span>{row.label}</span>
                        <span style={{ textAlign: 'right' }}>{row.value}</span>
                    </Fragment>
                ))}
            </div>
        </div>
    );
}

export default OpeningHours;
```

- [ ] **Step 4: Skriv `BoardMissing`**

Opprett `src/components/BoardMissing.jsx`:

```jsx
import { Contrast } from '@entur/layout';
import { Heading1, Paragraph } from '@entur/typography';
import { base } from '@entur/tokens';

/**
 * Vises når tavle-id-en i URL-en ikke finnes i Firestore.
 *
 * En blank skjerm i en resepsjon forteller ingen hva som er galt. Denne sier
 * hvilken id som ble forsøkt, slik at den som satte opp skjermen ser feilen.
 */
function BoardMissing({ boardId }) {
    return (
        <Contrast style={{ minHeight: '100vh', width: '100vw', backgroundColor: base.light.baseColors.frame.contrast, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem', boxSizing: 'border-box' }}>
            <img src="/logo.svg" alt="Entur" style={{ height: '4rem' }} />
            <Heading1>Fant ingen tavle</Heading1>
            <Paragraph>Det finnes ingen tavle med id-en «{boardId}».</Paragraph>
        </Contrast>
    );
}

export default BoardMissing;
```

- [ ] **Step 5: Sjekk at filene parser, og commit**

`yarn build` er **ikke** nok her: ingen av de fire filene importeres av noe ennå, så Vite når dem aldri og et syntaksfeil ville gått rett gjennom. Parse dem direkte med esbuild, som følger med Vite:

```bash
for f in TopBand Greeting OpeningHours BoardMissing; do
  npx esbuild --loader=jsx --outfile=/dev/null "src/components/$f.jsx" && echo "$f ok"
done
```
Expected: fire «ok»-linjer.

Dette fanger bare parsefeil. At komponentene ser riktige ut på skjermen, verifiseres i Task 7 og 8, når de faktisk tas i bruk.

Run: `yarn test && yarn build`
Expected: begge grønne (uendret fra før — ingenting nytt er koblet inn).

```bash
git add src/components/TopBand.jsx src/components/Greeting.jsx src/components/OpeningHours.jsx src/components/BoardMissing.jsx
git commit -m "feat: presentasjonskomponenter for topp, hilsen, åpningstider og manglende tavle"
```

---

### Task 7: Kiosken rendrer fra config

**Files:**
- Create: `src/boards/boardsRepository.js`
- Modify: `src/App.jsx` (hele filen skrives om), `src/components/Carousel.jsx:17-35`

**Interfaces:**
- Consumes: `normalizeBoardConfig`, `toFirestoreBoard`, `findModule`, `boardHeading` fra `boardConfig.js` (Task 3); `DEFAULT_BOARD_ID` fra `parseRoute.js` (Task 1); komponentene fra Task 6; `db` fra `src/alerts/firebase.js`.
- Produces:
  - `subscribeToBoard(boardId, onBoard, onError)` → avmeldingsfunksjon. `onBoard` får en normalisert config, eller `null` når tavla ikke finnes.
  - `fetchBoard(boardId)` → config eller `null`
  - `fetchBoards()` → liste av configer
  - `saveBoardConfig(config, userEmail)` → `Promise<void>`
  - `<App boardId={string} />`

- [ ] **Step 1: Skriv repositoryet**

Opprett `src/boards/boardsRepository.js`, bygget som `src/alerts/alertsRepository.js`:

```js
import { collection, doc, getDoc, getDocs, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from '../alerts/firebase.js';
import { normalizeBoardConfig, toFirestoreBoard } from './boardConfig.js';

const COLLECTION = 'boards';

/**
 * Live-abonnement på én tavle. `onBoard` får null når dokumentet ikke finnes.
 *
 * Abonnement, ikke engangshenting: endrer noen oppsettet i admin, endrer
 * skjermen i resepsjonen seg innen sekunder, uten at noen laster siden på nytt.
 */
export function subscribeToBoard(boardId, onBoard, onError) {
    return onSnapshot(
        doc(db, COLLECTION, boardId),
        (snapshot) => onBoard(snapshot.exists() ? normalizeBoardConfig(snapshot.id, snapshot.data()) : null),
        onError,
    );
}

/** Engangshenting. Admin-skjemaet skal ikke få innholdet endret mens man skriver. */
export async function fetchBoard(boardId) {
    const snapshot = await getDoc(doc(db, COLLECTION, boardId));
    return snapshot.exists() ? normalizeBoardConfig(snapshot.id, snapshot.data()) : null;
}

/** Alle tavler, for oversikten i admin. */
export async function fetchBoards() {
    const snapshot = await getDocs(collection(db, COLLECTION));
    return snapshot.docs.map((document) => normalizeBoardConfig(document.id, document.data()));
}

/**
 * Lagrer oppsettet på en tavle som finnes fra før.
 *
 * `merge: true` fordi createdBy og createdAt ikke er med i skrivingen, og
 * reglene krever at createdBy står uendret. Med merge ser reglene det
 * sammenslåtte dokumentet, altså med createdBy i behold.
 */
export async function saveBoardConfig(config, userEmail) {
    await setDoc(
        doc(db, COLLECTION, config.id),
        { ...toFirestoreBoard(config, userEmail), updatedAt: serverTimestamp() },
        { merge: true },
    );
}
```

- [ ] **Step 2: La karusellen tåle en tom liste**

I `src/components/Carousel.jsx`, legg inn en tidlig retur **etter** `useEffect`-blokka og før `const progress = ...` på linje 34. Den kan ikke stå øverst i komponenten: hooks må kalles ubetinget, ellers bryter React-reglene når lista går fra tom til ikke-tom.

```jsx
    // En tavle uten karusell-moduler er lovlig: velger man bare video og
    // hilsen, skal feltet falle bort framfor at slides[index] krasjer.
    if (slides.length === 0) {
        return null;
    }
```

- [ ] **Step 3: Skriv om `App.jsx`**

Erstatt hele `src/App.jsx`:

```jsx
import { useState, useEffect } from 'react';
import Weather from './components/Weather';
import OfficeMap from './floorplan/OfficeMap';
import Carousel from './components/Carousel';
import AlertBanner from './components/AlertBanner';
import ErrorBoundary from './components/ErrorBoundary';
import TopBand from './components/TopBand';
import Greeting from './components/Greeting';
import OpeningHours from './components/OpeningHours';
import BoardMissing from './components/BoardMissing';
import { startWeatherPolling } from './weather/metForecast';
import { subscribeToBoard } from './boards/boardsRepository';
import { GREETING_AUTO, boardHeading, findModule } from './boards/boardConfig';
import { DEFAULT_BOARD_ID } from './routing/parseRoute';
import { Heading2 } from '@entur/typography';
import { Contrast } from '@entur/layout';
import { base } from '@entur/tokens';
import { SunCloudIcon, MapIcon } from '@entur/icons';

const STAFF_IMAGES = ['/staff_woman.svg', '/staff_man.svg'];
const GREETING_REFRESH_MS = 15 * 60 * 1000;

function App({ boardId = DEFAULT_BOARD_ID }) {
    const [board, setBoard] = useState({ status: 'loading' });
    const [weather, setWeather] = useState(null);
    const [staffImage, setStaffImage] = useState(STAFF_IMAGES[0]);
    const [autoGreeting, setAutoGreeting] = useState(() => getGreetingText(new Date()));

    useEffect(() => subscribeToBoard(
        boardId,
        (config) => setBoard(config ? { status: 'ready', config } : { status: 'missing' }),
        (error) => {
            console.error('Kunne ikke hente tavla', error);
            setBoard({ status: 'missing' });
        },
    ), [boardId]);

    // Illustrasjon og hilsen byttes hvert 15. minutt, uavhengig av configen.
    useEffect(() => {
        function updateAll() {
            setStaffImage(STAFF_IMAGES[Math.floor(Math.random() * STAFF_IMAGES.length)]);
            setAutoGreeting(getGreetingText(new Date()));
        }
        updateAll();
        const interval = setInterval(updateAll, GREETING_REFRESH_MS);
        return () => clearInterval(interval);
    }, []);

    const config = board.status === 'ready' ? board.config : null;
    const weatherModule = config ? findModule(config.carousel, 'weather') : undefined;

    // Avhengighetene er tall, ikke modul-objektet. onSnapshot gir et nytt objekt
    // for hver eneste oppdatering av tavle-dokumentet, og et objekt her ville
    // startet pollingen på nytt — altså et nytt kall til api.met.no — hver gang
    // noen lagret i admin. MET sine vilkår ber om det motsatte.
    const lat = weatherModule ? weatherModule.lat : null;
    const lng = weatherModule ? weatherModule.lng : null;

    // Pollingen ligger her, ikke i Weather: karusellen rendrer bare den aktive
    // sliden, så Weather avmonteres og remonteres omtrent hvert minutt.
    useEffect(() => {
        if (lat === null || lng === null) {
            return undefined;
        }
        return startWeatherPolling({ location: { lat, lng }, onData: setWeather });
    }, [lat, lng]);

    if (board.status === 'loading') {
        return null;
    }
    if (board.status === 'missing') {
        return <BoardMissing boardId={boardId} />;
    }

    const slides = config.carousel.map((module) => {
        if (module.type === 'weather') {
            return {
                key: 'weather',
                Icon: SunCloudIcon,
                node: <ErrorBoundary><Weather weather={weather} /></ErrorBoundary>,
            };
        }
        if (module.type === 'floorplan') {
            return {
                key: 'floorplan',
                Icon: MapIcon,
                node: <ErrorBoundary><OfficeMap /></ErrorBoundary>,
            };
        }
        return null;
    }).filter(Boolean);

    const hasCarousel = slides.length > 0;
    const hasGreeting = Boolean(findModule(config.middle, 'greeting'));

    return (
        <div className="app" style={{ minHeight: '100vh', minWidth: '100vw', width: '100vw', height: '100vh', boxSizing: 'border-box', margin: 0, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <TopBand kind={config.top.kind} />
            {/*
              justifyContent: 'flex-start' er bevisst, ikke 'center'. Feltet har
              maxHeight + overflow: hidden, så noe MÅ klippes bort når stacken
              (varsler + hilsen) er høyere enn 45vh. Med 'center' klippes det
              symmetrisk fra begge kanter, og siden selectVisibleAlerts sorterer
              alvorligste varsel øverst, er det nettopp det alvorligste varselet
              som forsvinner over den øvre kanten først. Med 'flex-start' klippes
              det i stedet nedenfra: hilsenen og de minst alvorlige varslene
              lengst ned ryker først, og prioritert rekkefølge bevares. Ikke
              endre denne tilbake til 'center'.

              Uten karusell-moduler får feltet plassen karusellen ellers hadde
              hatt (flex: 1 i stedet for maxHeight), men klippes fortsatt nedenfra.
            */}
            <Contrast style={{
                width: '100vw',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                backgroundColor: base.light.baseColors.frame.contrast,
                flexDirection: 'column',
                padding: '1.5rem 0',
                overflow: 'hidden',
                ...(hasCarousel ? { maxHeight: '45vh' } : { flex: 1, minHeight: 0 }),
            }}>
                <ErrorBoundary>
                    <AlertBanner />
                </ErrorBoundary>
                {/* Overskriften skal alltid stå der. Har tavla en hilsen, eier
                    den overskriften; ellers står den alene. */}
                {!hasGreeting && <Heading2>{boardHeading(config.placeName)}</Heading2>}
                {config.middle.map((module) => (
                    <ErrorBoundary key={module.type}>
                        {module.type === 'greeting' ? (
                            <Greeting
                                heading={boardHeading(config.placeName)}
                                text={module.text === GREETING_AUTO ? autoGreeting : module.text}
                                staffImageSrc={module.staffImage ? staffImage : null}
                            />
                        ) : (
                            <OpeningHours days={module.days} />
                        )}
                    </ErrorBoundary>
                ))}
            </Contrast>
            {hasCarousel && <Carousel slides={slides} />}
        </div>
    );
}

// Hilsenen som følger klokka og ukedagen.
function getGreetingText(date) {
    const hour = date.getHours();
    const day = date.getDay(); // 0 = søndag, 1 = mandag, ..., 5 = fredag, 6 = lørdag
    if (day === 5 && hour >= 6) {
        return 'Vi håper du får en strålende helg!';
    }
    if (day === 6 || day === 0 || (day === 1 && hour < 6)) {
        return 'Vi håper du får en strålende helg!';
    }
    if (hour >= 6 && hour < 10) {
        return 'God morgen, vi ønsker deg en fin dag på kontoret!';
    }
    if (hour >= 10 && hour < 14) {
        return 'Entur gjør det enklere å reise kollektivt i hele Norge!';
    }
    if (hour >= 14) {
        return 'Vel hjem. Håper du får en fin kveld!';
    }
    return 'Vi ønsker deg en fin dag på kontoret!';
}

export default App;
```

- [ ] **Step 4: Verifiser mot emulatoren**

Emulatoren fra Task 5 skal fortsatt kjøre, med `boards/bergen-3` i seg. Lag `.env.local` hvis den ikke finnes:

```bash
echo 'VITE_USE_EMULATOR=true' > .env.local
```

Fyll tavla med et fullt oppsett (eier-bypass):

```bash
export BASE="http://127.0.0.1:8080/v1/projects/ent-tavleber-prd/databases/(default)/documents"
curl -s -o /dev/null -w 'fullt oppsett: %{http_code}\n' -X PATCH \
  -H 'Authorization: Bearer owner' -H 'Content-Type: application/json' \
  "$BASE/boards/bergen-3" -d '{"fields":{
    "name":{"stringValue":"Bergen 3. etasje"},
    "placeName":{"stringValue":"Bergen"},
    "top":{"mapValue":{"fields":{"kind":{"stringValue":"video"}}}},
    "middle":{"arrayValue":{"values":[
      {"mapValue":{"fields":{"type":{"stringValue":"greeting"},"text":{"stringValue":"auto"},"staffImage":{"booleanValue":true}}}}
    ]}},
    "carousel":{"arrayValue":{"values":[
      {"mapValue":{"fields":{"type":{"stringValue":"weather"},"name":{"stringValue":"Bergen"},"lat":{"doubleValue":60.39299},"lng":{"doubleValue":5.32415}}}},
      {"mapValue":{"fields":{"type":{"stringValue":"floorplan"},"plan":{"stringValue":"bergen-3"}}}}
    ]}},
    "createdBy":{"stringValue":"test@entur.org"},
    "updatedBy":{"stringValue":"test@entur.org"}
  }}'
```

Start dev-serveren (`yarn dev`) og gå til http://localhost:3000. Sjekk, i denne rekkefølgen:

1. Tavla ser ut som før: video på toppen, hilsen med illustrasjon, karusell med vær og kontorkart.
2. Bytt toppen til logo mens siden står åpen — kjør PATCH-en over på nytt med `"video"` byttet til `"logo"`. Logoen skal dukke opp **uten** at du laster siden på nytt.
3. Tøm karusellen: sett `"carousel"` til `{"arrayValue":{"values":[]}}`. Karusell-feltet skal falle bort, og det mørkeblå feltet skal ta plassen.
4. Legg inn åpningstider i `middle` i stedet for hilsen:
   `{"mapValue":{"fields":{"type":{"stringValue":"openingHours"},"days":{"arrayValue":{"values":[{"mapValue":{"fields":{"day":{"stringValue":"mon"},"opens":{"stringValue":"08:00"},"closes":{"stringValue":"16:00"}}}}]}}}}}`
   Overskriften «Velkommen til Entur Bergen» skal fortsatt stå der, med åpningstidene under og de seks andre dagene som «Stengt».
5. «Fant ingen tavle»-skjermen kan ikke testes via URL ennå — ruting kommer i Task 8, og `main.jsx` rendrer fortsatt `<App />` uten `boardId`, altså default-tavla uansett adresse. Test den ved å slette dokumentet i stedet:
   `curl -s -o /dev/null -w '%{http_code}\n' -X DELETE -H 'Authorization: Bearer owner' "$BASE/boards/bergen-3"` → skjermen skal bytte til «Fant ingen tavle» uten reload. Legg dokumentet inn igjen med PATCH-en over etterpå.

- [ ] **Step 5: Bygg, test og commit**

Run: `yarn test && yarn build`
Expected: begge grønne.

```bash
git add src/boards/boardsRepository.js src/App.jsx src/components/Carousel.jsx
git commit -m "feat: kiosken rendrer tavla fra config i firestore"
```

---

### Task 8: Ruting

**Files:**
- Modify: `src/main.jsx` (hele filen skrives om)
- Create: `src/components/RouteNotFound.jsx`

**Interfaces:**
- Consumes: `parseRoute` fra `src/routing/parseRoute.js` (Task 1); `<App boardId>` fra Task 7.
- Produces: `/t/<id>` viser tavla, `/` viser default-tavla og retter opp URL-en, `/admin` og `/admin/t/<id>` går til `Admin` med `route` som prop.

`Admin` tar ennå ikke imot `route` — den kommer i Task 9. Å sende inn en prop komponenten ignorerer er trygt, og gjør at denne oppgaven kan committes for seg.

- [ ] **Step 1: Skriv `RouteNotFound`**

Opprett `src/components/RouteNotFound.jsx`:

```jsx
import { Contrast } from '@entur/layout';
import { Heading1, Paragraph } from '@entur/typography';
import { base } from '@entur/tokens';

/** URL-en peker ikke på noen av rutene appen har. */
function RouteNotFound({ pathname }) {
    return (
        <Contrast style={{ minHeight: '100vh', width: '100vw', backgroundColor: base.light.baseColors.frame.contrast, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem', boxSizing: 'border-box' }}>
            <img src="/logo.svg" alt="Entur" style={{ height: '4rem' }} />
            <Heading1>Ukjent adresse</Heading1>
            <Paragraph>«{pathname}» peker ikke på noen tavle. En tavle ligger på /t/&lt;id&gt;.</Paragraph>
        </Contrast>
    );
}

export default RouteNotFound;
```

- [ ] **Step 2: Skriv om `main.jsx`**

Erstatt hele `src/main.jsx`:

```jsx
import './css/main.css';
import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import RouteNotFound from './components/RouteNotFound.jsx';
import { parseRoute } from './routing/parseRoute.js';

// Lazy: kiosken skal ikke laste firebase/auth, skjemakomponenter eller
// datovelger den aldri bruker. Én router-avhengighet for fire statiske ruter er
// ikke verdt vekten.
const Admin = lazy(() => import('./admin/Admin.jsx'));

const route = parseRoute(window.location.pathname);

// replaceState, ikke redirect: skjermen i resepsjonen peker fortsatt på «/», og
// den skal ikke laste seg på nytt. URL-en rettes opp i adressefeltet slik at den
// er delbar, uten at noe navigeres.
if (route.canonical) {
    window.history.replaceState(null, '', route.canonical);
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        {renderRoute(route)}
    </React.StrictMode>
);

function renderRoute(current) {
    if (current.kind === 'admin' || current.kind === 'adminBoard') {
        return (
            <Suspense fallback={null}>
                <Admin route={current} />
            </Suspense>
        );
    }
    if (current.kind === 'board') {
        return <App boardId={current.boardId} />;
    }
    return <RouteNotFound pathname={current.pathname} />;
}
```

- [ ] **Step 3: Verifiser rutene**

Emulatoren og `yarn dev` skal kjøre, med `boards/bergen-3` på plass.

1. http://localhost:3000/ → Bergen-tavla, og adressefeltet skal bytte til `/t/bergen-3` uten at siden lastes på nytt.
2. http://localhost:3000/t/bergen-3 → samme tavle.
3. http://localhost:3000/t/finnes-ikke → «Fant ingen tavle».
4. http://localhost:3000/tull → «Ukjent adresse».
5. http://localhost:3000/admin → admin-siden som før.

Hosting trenger ingen endring: `firebase.json` rewriter allerede `**` til `/index.html`, så dyplenker virker i produksjon.

- [ ] **Step 4: Bygg, test og commit**

Run: `yarn test && yarn build`
Expected: begge grønne.

```bash
git add src/main.jsx src/components/RouteNotFound.jsx
git commit -m "feat: ruting på /t/<id> med default-tavle på rot"
```

---

### Task 9: Oppsettskjemaet i admin

**Files:**
- Create: `src/admin/BoardConfigForm.jsx`, `src/admin/BoardAdmin.jsx`, `src/admin/BoardList.jsx`
- Modify: `src/admin/Admin.jsx:14` (signatur), `:112-162` (innholdet etter tilgangssjekkene)

**Interfaces:**
- Consumes: `fetchBoard`, `fetchBoards`, `saveBoardConfig` fra `boardsRepository.js` (Task 7); `validateBoardInput`, `hasErrors` fra `boardValidation.js` (Task 4); `findModule`, `GREETING_AUTO`, `GREETING_TEXT_MAX_LENGTH`, `NAME_MAX_LENGTH`, `PLACE_NAME_MAX_LENGTH`, `FLOORPLAN_PLANS` fra `boardConfig.js` (Task 3); `normalizeDays`, `DAY_LABELS` fra `openingHours.js` (Task 2); `normalizeEmail` fra `enturAccount.js`.
- Produces: `<BoardList />`, `<BoardAdmin boardId userEmail />`, `<BoardConfigForm board userEmail />`.

- [ ] **Step 1: Skriv `BoardConfigForm`**

Opprett `src/admin/BoardConfigForm.jsx`:

```jsx
import { useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { PrimaryButton } from '@entur/button';
import { Checkbox, Radio, RadioGroup, TextField } from '@entur/form';
import { Heading3, Paragraph } from '@entur/typography';

import {
    FLOORPLAN_PLANS,
    GREETING_AUTO,
    GREETING_TEXT_MAX_LENGTH,
    NAME_MAX_LENGTH,
    PLACE_NAME_MAX_LENGTH,
    findModule,
} from '../boards/boardConfig';
import { DAY_LABELS, normalizeDays } from '../boards/openingHours';
import { hasErrors, validateBoardInput } from '../boards/boardValidation';
import { saveBoardConfig } from '../boards/boardsRepository';

/** Config → den flate formen skjemafeltene jobber med. */
function draftFrom(board) {
    const greeting = findModule(board.middle, 'greeting');
    const openingHours = findModule(board.middle, 'openingHours');
    const weather = findModule(board.carousel, 'weather');
    const floorplan = findModule(board.carousel, 'floorplan');
    return {
        id: board.id,
        name: board.name,
        placeName: board.placeName,
        topKind: board.top.kind,
        greetingEnabled: Boolean(greeting),
        greetingAuto: !greeting || greeting.text === GREETING_AUTO,
        greetingText: greeting && greeting.text !== GREETING_AUTO ? greeting.text : '',
        staffImage: greeting ? greeting.staffImage : true,
        openingHoursEnabled: Boolean(openingHours),
        days: normalizeDays(openingHours ? openingHours.days : []),
        weatherEnabled: Boolean(weather),
        weatherName: weather ? weather.name : '',
        // Koordinatene er strenger i skjemaet: et halvskrevet «60.» er ikke et
        // tall, og feltet skal ikke hoppe mens man skriver.
        weatherLat: weather ? String(weather.lat) : '',
        weatherLng: weather ? String(weather.lng) : '',
        floorplanEnabled: Boolean(floorplan),
        floorplanPlan: floorplan ? floorplan.plan : FLOORPLAN_PLANS[0],
    };
}

/** Den flate formen → config, slik repositoryet vil ha den. */
function configFrom(draft) {
    const middle = [];
    if (draft.greetingEnabled) {
        middle.push({
            type: 'greeting',
            text: draft.greetingAuto ? GREETING_AUTO : draft.greetingText.trim(),
            staffImage: draft.staffImage,
        });
    }
    if (draft.openingHoursEnabled) {
        middle.push({ type: 'openingHours', days: draft.days });
    }

    const carousel = [];
    if (draft.weatherEnabled) {
        carousel.push({
            type: 'weather',
            name: draft.weatherName.trim(),
            lat: Number(draft.weatherLat),
            lng: Number(draft.weatherLng),
        });
    }
    if (draft.floorplanEnabled) {
        carousel.push({ type: 'floorplan', plan: draft.floorplanPlan });
    }

    return {
        id: draft.id,
        name: draft.name.trim(),
        placeName: draft.placeName.trim(),
        top: { kind: draft.topKind },
        middle,
        carousel,
    };
}

function BoardConfigForm({ board, userEmail }) {
    const [draft, setDraft] = useState(() => draftFrom(board));
    const [errors, setErrors] = useState({});
    const [saveError, setSaveError] = useState(null);
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);

    function update(field, value) {
        setSaved(false);
        setDraft((current) => ({ ...current, [field]: value }));
    }

    function updateDay(dayKey, changes) {
        setSaved(false);
        setDraft((current) => ({
            ...current,
            days: current.days.map((day) => (day.day === dayKey ? { ...day, ...changes } : day)),
        }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setSaveError(null);

        const validationErrors = validateBoardInput(draft);
        setErrors(validationErrors);
        if (hasErrors(validationErrors)) {
            return;
        }

        setSaving(true);
        try {
            await saveBoardConfig(configFrom(draft), userEmail);
            setSaved(true);
        } catch (error) {
            console.error('Kunne ikke lagre oppsettet', error);
            setSaveError('Kunne ikke lagre oppsettet. Prøv igjen.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 16rem' }}>
                    <TextField
                        label="Navn"
                        value={draft.name}
                        maxLength={NAME_MAX_LENGTH}
                        onChange={(event) => update('name', event.target.value)}
                        variant={errors.name ? 'negative' : undefined}
                        feedback={errors.name ?? 'Vises bare her i admin.'}
                    />
                </div>
                <div style={{ flex: '1 1 16rem' }}>
                    <TextField
                        label="Stedsnavn"
                        value={draft.placeName}
                        maxLength={PLACE_NAME_MAX_LENGTH}
                        onChange={(event) => update('placeName', event.target.value)}
                        variant={errors.placeName ? 'negative' : undefined}
                        feedback={errors.placeName ?? `Gir «Velkommen til Entur ${draft.placeName || '…'}»`}
                    />
                </div>
            </div>

            <section>
                <Heading3>Toppen</Heading3>
                <RadioGroup
                    name="topKind"
                    value={draft.topKind}
                    onChange={(event) => update('topKind', event.target.value)}
                >
                    <Radio value="video">Intro-video</Radio>
                    <Radio value="logo">Entur-logo</Radio>
                </RadioGroup>
            </section>

            <section>
                <Heading3>Midtfeltet</Heading3>
                <Paragraph>
                    Meldinger vises alltid øverst her, og overskriften «Velkommen til Entur
                    {' '}{draft.placeName || '…'}» står der uansett hva du velger.
                </Paragraph>

                <Checkbox
                    checked={draft.greetingEnabled}
                    onChange={(event) => update('greetingEnabled', event.target.checked)}
                >
                    Hilsen
                </Checkbox>
                {draft.greetingEnabled && (
                    <div style={{ margin: '0.75rem 0 1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <Checkbox
                            checked={draft.staffImage}
                            onChange={(event) => update('staffImage', event.target.checked)}
                        >
                            Vis ansatt-illustrasjon
                        </Checkbox>
                        <RadioGroup
                            name="greetingAuto"
                            value={draft.greetingAuto ? 'auto' : 'fast'}
                            onChange={(event) => update('greetingAuto', event.target.value === 'auto')}
                        >
                            <Radio value="auto">Automatisk hilsen etter klokka og ukedagen</Radio>
                            <Radio value="fast">Fast tekst</Radio>
                        </RadioGroup>
                        {!draft.greetingAuto && (
                            <TextField
                                label="Tekst"
                                value={draft.greetingText}
                                maxLength={GREETING_TEXT_MAX_LENGTH}
                                onChange={(event) => update('greetingText', event.target.value)}
                                variant={errors.greetingText ? 'negative' : undefined}
                                feedback={errors.greetingText}
                            />
                        )}
                    </div>
                )}

                <Checkbox
                    checked={draft.openingHoursEnabled}
                    onChange={(event) => update('openingHoursEnabled', event.target.checked)}
                >
                    Åpningstider
                </Checkbox>
                {draft.openingHoursEnabled && (
                    <div style={{ margin: '0.75rem 0 0 2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {draft.days.map((day) => (
                            <div key={day.day} style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                <span style={{ width: '6rem' }}>{DAY_LABELS[day.day]}</span>
                                <Checkbox
                                    checked={!day.closed}
                                    onChange={(event) => updateDay(day.day, event.target.checked
                                        ? { closed: false, opens: day.opens ?? '08:00', closes: day.closes ?? '16:00' }
                                        : { closed: true })}
                                >
                                    Åpent
                                </Checkbox>
                                {!day.closed && (
                                    <>
                                        <TextField
                                            label="Fra"
                                            type="time"
                                            value={day.opens ?? ''}
                                            onChange={(event) => updateDay(day.day, { opens: event.target.value })}
                                        />
                                        <TextField
                                            label="Til"
                                            type="time"
                                            value={day.closes ?? ''}
                                            onChange={(event) => updateDay(day.day, { closes: event.target.value })}
                                        />
                                    </>
                                )}
                            </div>
                        ))}
                        {errors.openingHours && (
                            <SmallAlertBox variant="negative">{errors.openingHours}</SmallAlertBox>
                        )}
                    </div>
                )}
            </section>

            <section>
                <Heading3>Karusellen</Heading3>
                <Checkbox
                    checked={draft.weatherEnabled}
                    onChange={(event) => update('weatherEnabled', event.target.checked)}
                >
                    Værmelding
                </Checkbox>
                {draft.weatherEnabled && (
                    <div style={{ margin: '0.75rem 0 1.5rem 2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 12rem' }}>
                            <TextField
                                label="Sted"
                                value={draft.weatherName}
                                onChange={(event) => update('weatherName', event.target.value)}
                                variant={errors.weatherName ? 'negative' : undefined}
                                feedback={errors.weatherName}
                            />
                        </div>
                        <div style={{ flex: '1 1 10rem' }}>
                            <TextField
                                label="Breddegrad"
                                value={draft.weatherLat}
                                onChange={(event) => update('weatherLat', event.target.value)}
                                variant={errors.weatherLat ? 'negative' : undefined}
                                feedback={errors.weatherLat}
                            />
                        </div>
                        <div style={{ flex: '1 1 10rem' }}>
                            <TextField
                                label="Lengdegrad"
                                value={draft.weatherLng}
                                onChange={(event) => update('weatherLng', event.target.value)}
                                variant={errors.weatherLng ? 'negative' : undefined}
                                feedback={errors.weatherLng}
                            />
                        </div>
                    </div>
                )}

                <Checkbox
                    checked={draft.floorplanEnabled}
                    onChange={(event) => update('floorplanEnabled', event.target.checked)}
                >
                    Plantegning
                </Checkbox>
                {draft.floorplanEnabled && (
                    <div style={{ margin: '0.75rem 0 0 2rem' }}>
                        {/* Ingen velger: repoet har nøyaktig én plantegning, og
                            synken i scripts/sync-floorplan.mjs er hardkodet mot
                            den. En velger med ett valg er bare støy. */}
                        <Paragraph>Bergen, 3. etasje — den eneste plantegningen som finnes.</Paragraph>
                        {errors.floorplan && (
                            <SmallAlertBox variant="negative">{errors.floorplan}</SmallAlertBox>
                        )}
                    </div>
                )}
            </section>

            {saveError && <SmallAlertBox variant="negative">{saveError}</SmallAlertBox>}
            {saved && !saving && (
                <SmallAlertBox variant="success">
                    Lagret. Skjermen oppdaterer seg selv innen noen sekunder.
                </SmallAlertBox>
            )}

            <div>
                <PrimaryButton type="submit" disabled={saving}>
                    {saving ? 'Lagrer …' : 'Lagre oppsett'}
                </PrimaryButton>
            </div>
        </form>
    );
}

export default BoardConfigForm;
```

- [ ] **Step 2: Skriv `BoardAdmin`**

Opprett `src/admin/BoardAdmin.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { Heading1, Paragraph } from '@entur/typography';

import BoardConfigForm from './BoardConfigForm';
import { fetchBoard } from '../boards/boardsRepository';

/**
 * Oppsettet for én tavle.
 *
 * Henter configen én gang, ikke som abonnement: skjemaet skal ikke få innholdet
 * byttet under fingrene mens noen skriver i det.
 */
function BoardAdmin({ boardId, userEmail }) {
    const [state, setState] = useState({ status: 'laster' });

    useEffect(() => {
        let current = true;
        fetchBoard(boardId)
            .then((board) => {
                if (!current) return;
                setState(board ? { status: 'ok', board } : { status: 'mangler' });
            })
            .catch((error) => {
                console.error('Kunne ikke hente tavla', error);
                if (current) setState({ status: 'feil' });
            });
        return () => {
            current = false;
        };
    }, [boardId]);

    if (state.status === 'laster') {
        return <Paragraph>Henter tavla …</Paragraph>;
    }
    if (state.status === 'mangler') {
        return <SmallAlertBox variant="negative">Det finnes ingen tavle med id-en «{boardId}».</SmallAlertBox>;
    }
    if (state.status === 'feil') {
        return <SmallAlertBox variant="negative">Kunne ikke hente tavla. Last siden på nytt.</SmallAlertBox>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
                <Heading1>{state.board.name || boardId}</Heading1>
                <Paragraph>
                    Skjermen skal peke på <a href={`/t/${boardId}`}>/t/{boardId}</a>. <a href="/admin">Tilbake til oversikten</a>
                </Paragraph>
            </div>
            <SmallAlertBox variant="information" title="Oppsettet er offentlig lesbart">
                Tavla henter oppsettet uten pålogging, så koordinater og åpningstider kan
                leses av hvem som helst som finner adressen.
            </SmallAlertBox>
            <BoardConfigForm board={state.board} userEmail={userEmail} />
        </div>
    );
}

export default BoardAdmin;
```

- [ ] **Step 3: Skriv `BoardList`**

Opprett `src/admin/BoardList.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { Heading3, Paragraph } from '@entur/typography';

import { fetchBoards } from '../boards/boardsRepository';

/**
 * Tavlene som finnes.
 *
 * I fase 1 er det alle: tilgang er fortsatt den globale admins-allowlisten, og
 * boards er offentlig lesbar. I fase 2 blir lista begrenset til dine egne.
 */
function BoardList() {
    const [state, setState] = useState({ status: 'laster' });

    useEffect(() => {
        let current = true;
        fetchBoards()
            .then((boards) => {
                if (current) setState({ status: 'ok', boards });
            })
            .catch((error) => {
                console.error('Kunne ikke hente tavler', error);
                if (current) setState({ status: 'feil' });
            });
        return () => {
            current = false;
        };
    }, []);

    if (state.status === 'laster') {
        return <Paragraph>Henter tavler …</Paragraph>;
    }
    if (state.status === 'feil') {
        return <SmallAlertBox variant="negative">Kunne ikke hente tavlene.</SmallAlertBox>;
    }
    if (state.boards.length === 0) {
        return <Paragraph>Ingen tavler er lagt inn ennå.</Paragraph>;
    }

    return (
        <section>
            <Heading3>Tavler</Heading3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {state.boards.map((board) => (
                    <li key={board.id}>
                        <a href={`/admin/t/${board.id}`}>{board.name || board.id}</a>
                        {' — '}
                        <a href={`/t/${board.id}`}>se tavla</a>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export default BoardList;
```

- [ ] **Step 4: Koble det inn i `Admin.jsx`**

I `src/admin/Admin.jsx`:

1. Legg til importene øverst:

```jsx
import BoardAdmin from './BoardAdmin';
import BoardList from './BoardList';
```

2. Endre signaturen på linje 14 fra `function Admin() {` til:

```jsx
function Admin({ route }) {
```

3. Erstatt `return`-blokka på linje 112–162 (den som starter med `<main style={{ maxWidth: '60rem' ...`) med:

```jsx
    const heading = route.kind === 'adminBoard' ? 'Oppsett for tavla' : 'Meldinger på velkomsttavla';

    return (
        <main style={{ maxWidth: '60rem', margin: '2rem auto', padding: '0 1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <Heading1>{heading}</Heading1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Paragraph>{user.email}</Paragraph>
                    <SecondaryButton onClick={signOutUser}>Logg ut</SecondaryButton>
                </div>
            </div>

            {route.kind === 'adminBoard' ? (
                <div style={{ marginTop: '1.5rem' }}>
                    <BoardAdmin boardId={route.boardId} userEmail={normalizeEmail(user.email)} />
                </div>
            ) : (
                <>
                    <div style={{ margin: '1.5rem 0' }}>
                        <SmallAlertBox variant="information" title="Meldingene er offentlig lesbare">
                            Tavla står i resepsjonen og henter meldingene uten pålogging, så de kan
                            leses av hvem som helst som finner adressen. Ikke skriv sensitiv eller
                            intern-klassifisert informasjon her.
                        </SmallAlertBox>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <BoardList />
                    </div>

                    {formOpen ? (
                        <AlertForm
                            editing={editing}
                            userEmail={normalizeEmail(user.email)}
                            onSaved={() => {
                                setFormOpen(false);
                                setEditing(null);
                            }}
                            onCancel={() => {
                                setFormOpen(false);
                                setEditing(null);
                            }}
                        />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <PrimaryButton
                                onClick={() => {
                                    setEditing(null);
                                    setFormOpen(true);
                                }}
                            >
                                Ny melding
                            </PrimaryButton>
                            <AlertList
                                onEdit={(alert) => {
                                    setEditing(alert);
                                    setFormOpen(true);
                                }}
                            />
                        </div>
                    )}
                </>
            )}
        </main>
    );
```

Merk at `heading` deklareres etter de tidlige returene i komponenten — det er greit, alle hooks kalles før dem.

- [ ] **Step 5: Verifiser mot emulatoren**

Emulatoren og `yarn dev` skal kjøre. Legg deg selv i `admins` hvis du ikke er der (README har kommandoen), og logg inn med Auth-emulatoren.

1. http://localhost:3000/admin → «Tavler» med `bergen-3` i lista, over meldingene som før.
2. Klikk tavla → oppsettskjemaet med dagens verdier fylt inn.
3. Bytt toppen til logo, trykk «Lagre oppsett» → grønn kvittering. Ha `/t/bergen-3` åpen i en annen fane og se at logoen kommer uten reload.
4. Tøm stedsnavnet og lagre → rød feilmelding på feltet, ingen skriving.
5. Skriv «nord» i breddegrad og lagre → rød feilmelding på breddegrad.
6. Huk av åpningstider, sett mandag åpen 16:00–08:00, lagre → «Mandag: stengetid må være etter åpningstid».
7. Rett til 08:00–16:00, lagre → grønn kvittering, og åpningstidene dukker opp på tavla.
8. Slå av både vær og plantegning, lagre → karusellen forsvinner fra tavla og det mørkeblå feltet tar plassen.

- [ ] **Step 6: Bygg, test og commit**

Run: `yarn test && yarn build`
Expected: begge grønne.

```bash
git add src/admin/BoardConfigForm.jsx src/admin/BoardAdmin.jsx src/admin/BoardList.jsx src/admin/Admin.jsx
git commit -m "feat: oppsettskjema for tavler i admin"
```

---

### Task 10: Migrering av produksjon og dokumentasjon

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: alt fra Task 1–9.
- Produces: `boards/bergen-3` i produksjon, og en README som beskriver tavler, ruter og modulkatalogen.

**Rekkefølgen er kritisk.** Deploy tar hosting og regler i samme kjøring ved push til `main`. Blir koden merget før dokumentet finnes, viser skjermen i resepsjonen «Fant ingen tavle» inntil noen rekker å legge det inn.

- [ ] **Step 1: Opprett tavle-dokumentet i produksjon — før merge**

Krever `roles/datastore.user` (eller mer) på `ent-tavleber-prd`. Kjøres mot **produksjon**, ikke emulatoren:

```bash
curl -s -o /dev/null -w 'bergen-3 opprettet: %{http_code}\n' -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H 'Content-Type: application/json' \
  'https://firestore.googleapis.com/v1/projects/ent-tavleber-prd/databases/(default)/documents/boards?documentId=bergen-3' \
  -d '{"fields":{
    "name":{"stringValue":"Bergen 3. etasje"},
    "placeName":{"stringValue":"Bergen"},
    "top":{"mapValue":{"fields":{"kind":{"stringValue":"video"}}}},
    "middle":{"arrayValue":{"values":[
      {"mapValue":{"fields":{"type":{"stringValue":"greeting"},"text":{"stringValue":"auto"},"staffImage":{"booleanValue":true}}}}
    ]}},
    "carousel":{"arrayValue":{"values":[
      {"mapValue":{"fields":{"type":{"stringValue":"weather"},"name":{"stringValue":"Bergen"},"lat":{"doubleValue":60.39299},"lng":{"doubleValue":5.32415}}}},
      {"mapValue":{"fields":{"type":{"stringValue":"floorplan"},"plan":{"stringValue":"bergen-3"}}}}
    ]}},
    "createdBy":{"stringValue":"DIN.EPOST@entur.org"},
    "updatedBy":{"stringValue":"DIN.EPOST@entur.org"}
  }}'
```

Bytt `DIN.EPOST@entur.org` med din egen adresse i små bokstaver. Expected: `200`.

Går ikke `gcloud`, gjør det samme i Firebase-konsollet: opprett collectionen `boards`, dokument-id `bergen-3`, med feltene over. `top` er en map, `middle` og `carousel` er arrays av maps.

Bekreft:

```bash
curl -s -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  'https://firestore.googleapis.com/v1/projects/ent-tavleber-prd/databases/(default)/documents/boards/bergen-3' \
  | head -30
```

- [ ] **Step 2: Oppdater README**

I `README.md`:

1. Erstatt avsnittet «Hva tavla viser» (linje 7–35) med en beskrivelse av at innholdet kommer fra en config. Behold beskrivelsen av hver enkelt modul — den er fortsatt riktig — men skriv om innledningen til:

```markdown
## Hva tavla viser

Hva som står på en tavle bestemmes av et dokument i Firestore-collectionen
`boards`, ikke av koden. Skjermen peker på `/t/<tavle-id>`, appen abonnerer på
dokumentet, og en endring i admin slår ut på skjermen innen sekunder uten at
noen laster siden på nytt.

Layouten er den samme på alle tavler — tre felt ovenfra og ned — men innholdet i
hvert felt velges per tavle:

| Felt | Moduler |
|---|---|
| Toppen | `video` (intro-videoen) eller `logo` (Entur-logoen) |
| Midten | `greeting` (hilsen, automatisk eller fast tekst, med eller uten ansatt-illustrasjon) og `openingHours` (åpningstider lagt inn dag for dag) |
| Karusellen | `weather` (værmelding for valgte koordinater) og `floorplan` (plantegning) |

Overskriften «Velkommen til Entur `<stedsnavn>`» og eventuelle **varsler** står
alltid i midtfeltet, uansett hvilke moduler tavla har. Ukjente modultyper hoppes
over, så en skjerm som ikke er lastet på nytt svartner ikke av at noen legger
til en modul den ikke kjenner.

Modulkatalogen ligger i [`src/boards/boardConfig.js`](src/boards/boardConfig.js).
Der ligger også normaliseringen som gjør et dokument om til noe kiosken trygt
kan rendre — Firestore-reglene kan ikke iterere over en liste og validerer bare
grovformen, så det er normaliseringen som er vernet mot et dokument skrevet for
hånd i konsollet.
```

2. Legg til et nytt avsnitt rett etter, om ruter:

```markdown
## Ruter

| Rute | Hva |
|---|---|
| `/t/<tavle-id>` | tavla |
| `/` | default-tavla (`bergen-3`), og adressefeltet rettes til `/t/bergen-3` |
| `/admin` | tavleoversikt og meldinger |
| `/admin/t/<tavle-id>` | oppsettet for én tavle |

Rot-ruten finnes fordi skjermen i resepsjonen ble satt opp mot `/` før tavlene
fikk hver sin id. Den bruker `history.replaceState`, ikke en redirect — tavla
skal aldri laste seg på nytt av seg selv. Konstanten `DEFAULT_BOARD_ID` i
[`src/routing/parseRoute.js`](src/routing/parseRoute.js) kan fjernes når
skjermen peker på `/t/bergen-3`.
```

3. I avsnittet «Pålogging og tilgang», legg til en setning etter beskrivelsen av `admins`-allowlisten:

```markdown
Allowlisten gir også tilgang til å endre oppsettet på tavlene. Det gjøres om i
fase 2, der tilgang blir noe man har per tavle — se speccen
[2026-08-06-parameteriserte-tavler-design.md](docs/superpowers/specs/2026-08-06-parameteriserte-tavler-design.md).
```

4. I avsnittet «Tester», legg til de nye testfilene i opplistingen: ruteparsing (`src/routing/parseRoute.test.mjs`), åpningstider (`src/boards/openingHours.test.mjs`), modulkatalogen (`src/boards/boardConfig.test.mjs`) og validering av oppsett (`src/boards/boardValidation.test.mjs`).

- [ ] **Step 3: Kjør hele testsuiten og bygget**

Run: `yarn test && yarn build`
Expected: begge grønne.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: beskriv tavler, ruter og modulkatalogen"
```

- [ ] **Step 5: Merge og verifiser i produksjon**

Etter merge til `main` og fullført deploy:

1. Åpne produksjons-URL-en på `/` → Bergen-tavla skal se ut nøyaktig som før, og adressefeltet skal bli `/t/bergen-3`.
2. Åpne `/admin` → tavla skal ligge i lista.
3. Sjekk skjermen i resepsjonen: den står på `/` og skal være uendret. **Ikke** last den på nytt for å «sjekke» — den henter oppsettet selv.

---

## Etter fase 1

Dette står igjen, og hører til fase 2 og 3 i speccen:

- `memberships`, `boardIds` på meldinger og de nye reglene med `@firebase/rules-unit-testing`.
- Å opprette og slette tavler fra admin, og tilgangssiden.
- `departures`-modulen.

Ikke bygg noe av dette inn i fase 1 «siden vi likevel er i filen».
