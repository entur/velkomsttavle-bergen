# Parameteriserte tavler — fase 2: implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flere tavler med eierskap og deling — enhver Entur-konto kan opprette en tavle, gi andre tilgang, og publisere én melding på flere tavler samtidig.

**Architecture:** Tilgang lagres per bruker i `memberships/<e-post>` som en liste av tavle-id-er, ikke som en medlemsliste på tavla. Det er *fordi* en melding kan gjelde flere tavler: reglene må da avgjøre om alle tavlene i meldinga er dine, og det blir ett oppslag og én listesammenlikning. Den globale `admins`-allowlisten forsvinner. Reglene blir vesentlig mer sammensatte enn i fase 1 og får derfor automatiske tester med `@firebase/rules-unit-testing`.

**Tech Stack:** React 19, Vite 8, Firebase Firestore 12, Entur designsystem, `node --test` for ren logikk, `@firebase/rules-unit-testing` + Firestore-emulatoren for reglene.

**Spec:** `docs/superpowers/specs/2026-08-06-parameteriserte-tavler-design.md`
**Bygger på:** `docs/superpowers/plans/2026-08-06-parameteriserte-tavler-fase-1.md` (levert, i `main`)

## Regel-syntaksen er verifisert på forhånd

Speccen krevde at reglenes byggeklosser ble prøvd mot emulatoren før de ble skrevet inn i en plan. Det er gjort — sytten prober, alle som forventet:

| Byggekloss | Status |
|---|---|
| `myBoards()` via `exists()` + `get()`-ternær; tom liste når dokumentet mangler | virker |
| `boardId in myBoards()` | virker |
| `boardIds.hasOnly(myBoards())` | virker |
| `request…hasOnly(resource…concat(myBoards()))` begge veier — styrer tillegg **og** fjerning | virker, seks saker |
| Bootstrap: `claiming`-felt slått opp mot `boards/<id>.createdBy` | virker, fem saker |

Ingen Cloud Function og ingen `Set`-operasjoner er nødvendige. Reglene i Task 4 er skrevet ut fra disse målingene, ikke ut fra hukommelse.

## Global Constraints

- **Språk:** all kode-kommentar, UI-tekst og commit-melding på norsk (bokmål).
- **Én ny avhengighet, kun dev:** `@firebase/rules-unit-testing`. Installeres med `yarn add --dev @firebase/rules-unit-testing --ignore-engines` — uten flagget stopper Node 26 mot pakkens engines-felt i dette repoet.
- **Ingen komponenttester.** Logikk som skal testes må ligge i en `.js`-modul uten JSX og uten Firebase-import.
- **Rene tester heter `*.test.mjs`.** Regeltester heter `*.rules.spec.mjs` — verifisert at `node --test` **ikke** globber `.spec.mjs` (den tar `*.test.mjs`, `*-test.mjs`, `*_test.mjs`, `test-*.mjs`). Det holder `yarn test` kjørbar uten emulator.
- **`yarn test`, `yarn test:rules` og `yarn build` skal være grønne før hver commit** fra og med Task 4.
- **Styling er inline-styles med Entur-tokens.**
- **Tavla laster seg aldri på nytt av seg selv.**
- **Ingen sammensatte indekser.** `boardIds` og `boards` spørres med `array-contains` alene. `enabled` filtreres i klienten — `selectVisibleAlerts` filtrerer allerede på `alertStatus`, som håndterer `enabled`, så ingen endring trengs der.
- **Maks 20 tavler per melding** (`BOARD_IDS_MAX`), håndhevet både i validering og regler.

## Kjent kollisjon

Oppgaven «Fiks usynlig logo på admin-innloggingen» kjører i en egen worktree og endrer `src/admin/Admin.jsx`. Denne planen skriver om samme fil betydelig (Task 7). La logo-PR-en lande i `main` først, og rebase denne grenen på den — ellers blir det en konflikt i `Admin.jsx` som må løses for hånd.

## Filstruktur

**Nye filer:**

| Fil | Ansvar |
|---|---|
| `src/boards/boardId.js` + `.test.mjs` | Forslag til tavle-id fra navn, og validering av id. |
| `src/access/memberships.js` + `.test.mjs` | Ren logikk for tilgangslister: normalisering, legg til/fjern, validering av e-post. |
| `src/access/membershipsRepository.js` | Firestore-tilgang for `memberships`. |
| `firestore.rules.spec.mjs` | Regeltester mot emulatoren. |
| `src/admin/NewBoardForm.jsx` | «Ny tavle». |
| `src/admin/BoardAccess.jsx` | Tilgangsseksjonen på tavlesiden. |
| `src/admin/BoardAlerts.jsx` | Meldingsseksjonen på tavlesiden. |
| `src/admin/BoardPicker.jsx` | Avkryssing av tavler i meldingsskjemaet. |

**Endrede filer:**

| Fil | Endring |
|---|---|
| `src/alerts/alertMapper.js` | `boardIds` inn og ut. |
| `src/alerts/alertValidation.js` | `boardIds` påkrevd, 1–20. |
| `src/alerts/alertsRepository.js` | Spørringer per tavle. |
| `src/boards/boardsRepository.js` | `createBoard`, `deleteBoard`. |
| `src/components/AlertBanner.jsx` | Tar `boardId`. |
| `src/App.jsx` | Sender `boardId` til `AlertBanner`. |
| `src/admin/AlertForm.jsx` | Tavlevelger. |
| `src/admin/AlertList.jsx` | Viser hvilke andre tavler en melding står på. |
| `src/admin/BoardList.jsx` | Bare dine tavler, pluss «Ny tavle». |
| `src/admin/BoardAdmin.jsx` | Tre seksjoner: oppsett, tilgang, meldinger. |
| `src/admin/Admin.jsx` | `admins`-porten fjernes. |
| `firestore.rules` | Hele den nye modellen. |
| `package.json` | `test:rules`-script og dev-avhengigheten. |
| `.github/workflows/deploy.yml` | Regeltester i CI. |
| `README.md` | Tilgangsmodellen. |

**Slettede filer:** `src/admin/adminAccess.js` (og testen dens hvis den finnes) — erstattes av medlemskap.

---

### Task 1: Tavle-id — forslag og validering

**Files:**
- Create: `src/boards/boardId.js`, `src/boards/boardId.test.mjs`

**Interfaces:**
- Consumes: ingenting.
- Produces: `BOARD_ID_MAX_LENGTH`, `suggestBoardId(name)`, `isValidBoardId(value)`.

- [ ] **Step 1: Skriv den feilende testen**

Opprett `src/boards/boardId.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BOARD_ID_MAX_LENGTH, isValidBoardId, suggestBoardId } from './boardId.js';

describe('suggestBoardId', () => {
    it('gjør et navn om til en slug', () => {
        assert.equal(suggestBoardId('Bergen 3. etasje'), 'bergen-3-etasje');
        assert.equal(suggestBoardId('Billettkontor Bergen'), 'billettkontor-bergen');
    });

    it('skriver om norske bokstaver framfor å kaste dem', () => {
        assert.equal(suggestBoardId('Tøyen'), 'toeyen');
        assert.equal(suggestBoardId('Ålesund'), 'aalesund');
        assert.equal(suggestBoardId('Værnes'), 'vaernes');
    });

    it('slår sammen skilletegn og trimmer kantene', () => {
        assert.equal(suggestBoardId('  Oslo –– S  '), 'oslo-s');
        assert.equal(suggestBoardId('A/B & C'), 'a-b-c');
    });

    it('klipper til maksimallengden uten å ende på bindestrek', () => {
        const id = suggestBoardId('a'.repeat(80));
        assert.equal(id.length, BOARD_ID_MAX_LENGTH);
        assert.equal(id.endsWith('-'), false);
    });

    it('gir tom streng når det ikke er noe brukbart igjen', () => {
        assert.equal(suggestBoardId('///'), '');
        assert.equal(suggestBoardId(''), '');
        assert.equal(suggestBoardId(null), '');
    });
});

describe('isValidBoardId', () => {
    it('godtar små bokstaver, tall og enkle bindestreker', () => {
        assert.equal(isValidBoardId('bergen-3'), true);
        assert.equal(isValidBoardId('a'), true);
        assert.equal(isValidBoardId('billettkontor-bergen'), true);
    });

    it('avviser store bokstaver, mellomrom og understrek', () => {
        assert.equal(isValidBoardId('Bergen-3'), false);
        assert.equal(isValidBoardId('bergen 3'), false);
        assert.equal(isValidBoardId('bergen_3'), false);
    });

    it('avviser bindestrek i kantene og doble bindestreker', () => {
        assert.equal(isValidBoardId('-bergen'), false);
        assert.equal(isValidBoardId('bergen-'), false);
        assert.equal(isValidBoardId('bergen--3'), false);
    });

    it('avviser tomt og for langt', () => {
        assert.equal(isValidBoardId(''), false);
        assert.equal(isValidBoardId('a'.repeat(BOARD_ID_MAX_LENGTH + 1)), false);
        assert.equal(isValidBoardId(null), false);
    });

    it('godtar alt suggestBoardId lager som ikke er tomt', () => {
        for (const navn of ['Bergen 3. etasje', 'Tøyen', 'A/B & C', 'a'.repeat(80)]) {
            assert.equal(isValidBoardId(suggestBoardId(navn)), true, navn);
        }
    });
});
```

- [ ] **Step 2: Kjør testen og se at den feiler**

Run: `yarn test`
Expected: FAIL — `Cannot find module './boardId.js'`.

- [ ] **Step 3: Skriv implementasjonen**

Opprett `src/boards/boardId.js`:

```js
/**
 * Tavle-id: den delen av URL-en skjermen peker på.
 *
 * Snevert tegnsett med vilje — id-en står i en adresse som skal tastes inn på en
 * kiosk, og en id med mellomrom eller store bokstaver er en felle. Må stemme med
 * regexen i `parseRoute`, som ellers ikke finner tavla.
 */

export const BOARD_ID_MAX_LENGTH = 40;

const VALID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Norske bokstaver skrives om framfor å kastes: «Tøyen» skal bli «toeyen», ikke
// «tyen». Rekkefølgen er viktig — æ/ø/å før den generelle opprydningen.
const TRANSLITERATIONS = [
    [/æ/g, 'ae'], [/ø/g, 'oe'], [/å/g, 'aa'],
];

export function suggestBoardId(name) {
    if (typeof name !== 'string') {
        return '';
    }
    let slug = name.toLowerCase();
    for (const [pattern, replacement] of TRANSLITERATIONS) {
        slug = slug.replace(pattern, replacement);
    }
    slug = slug
        .normalize('NFD').replace(/[̀-ͯ]/g, '')  // é → e
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    if (slug.length <= BOARD_ID_MAX_LENGTH) {
        return slug;
    }
    // Klipp, og fjern en bindestrek som havnet i enden av klippet.
    return slug.slice(0, BOARD_ID_MAX_LENGTH).replace(/-+$/, '');
}

export function isValidBoardId(value) {
    return typeof value === 'string'
        && value.length > 0
        && value.length <= BOARD_ID_MAX_LENGTH
        && VALID.test(value);
}
```

- [ ] **Step 4: Kjør testen og se at den passerer**

Run: `yarn test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/boards/boardId.js src/boards/boardId.test.mjs
git commit -m "feat: forslag til og validering av tavle-id"
```

---

### Task 2: Meldinger får `boardIds`

**Files:**
- Modify: `src/alerts/alertMapper.js`, `src/alerts/alertValidation.js`
- Test: `src/alerts/alertMapper.test.mjs`, `src/alerts/alertValidation.test.mjs`

**Interfaces:**
- Consumes: `isValidBoardId` fra `boardId.js` (Task 1).
- Produces: `toAlert` og `toFirestoreData` med `boardIds`; `BOARD_IDS_MAX`; `validateAlertInput` som krever minst én tavle.

- [ ] **Step 1: Skriv de feilende testene**

Legg til i `src/alerts/alertMapper.test.mjs`, innenfor `describe('toAlert', …)`:

```js
    it('leser boardIds og kaster det som ikke er brukbare id-er', () => {
        const alert = toAlert('abc', {
            title: 'Tittel',
            body: 'Tekst',
            level: 'information',
            startsAt: timestamp('2026-08-03T08:00:00Z'),
            endsAt: null,
            enabled: true,
            boardIds: ['bergen-3', 42, 'Ugyldig Id', 'billettkontor-bergen', null],
        });
        assert.deepEqual(alert.boardIds, ['bergen-3', 'billettkontor-bergen']);
    });

    it('gir tom liste når boardIds mangler', () => {
        const alert = toAlert('abc', {
            title: 'Tittel', body: 'Tekst', level: 'information',
            startsAt: timestamp('2026-08-03T08:00:00Z'), endsAt: null, enabled: true,
        });
        assert.deepEqual(alert.boardIds, []);
    });
```

og innenfor `describe('toFirestoreData', …)`:

```js
    it('skriver boardIds videre', () => {
        const data = toFirestoreData({
            title: 'Tittel', body: 'Tekst', level: 'information',
            startsAt: new Date('2026-08-03T08:00:00Z'), endsAt: null, enabled: true,
            boardIds: ['bergen-3'],
        }, 'ola@entur.org');
        assert.deepEqual(data.boardIds, ['bergen-3']);
    });
```

Legg til i `src/alerts/alertValidation.test.mjs`:

```js
describe('validateAlertInput — tavler', () => {
    function grunnlag(overrides = {}) {
        return {
            title: 'Tittel',
            body: 'Tekst',
            level: 'information',
            startsAt: new Date('2026-08-03T08:00:00Z'),
            endsAt: null,
            enabled: true,
            boardIds: ['bergen-3'],
            ...overrides,
        };
    }

    it('godtar én tavle', () => {
        assert.equal(validateAlertInput(grunnlag()).boardIds, undefined);
    });

    it('krever minst én tavle', () => {
        assert.equal(validateAlertInput(grunnlag({ boardIds: [] })).boardIds, 'Velg minst én tavle');
        assert.equal(validateAlertInput(grunnlag({ boardIds: undefined })).boardIds, 'Velg minst én tavle');
    });

    it('setter et tak på antall tavler', () => {
        const mange = Array.from({ length: BOARD_IDS_MAX + 1 }, (_, i) => `tavle-${i}`);
        assert.equal(
            validateAlertInput(grunnlag({ boardIds: mange })).boardIds,
            `En melding kan stå på maks ${BOARD_IDS_MAX} tavler`,
        );
    });
});
```

Husk å utvide importen øverst i `alertValidation.test.mjs` med `BOARD_IDS_MAX`.

- [ ] **Step 2: Kjør testene og se at de feiler**

Run: `yarn test`
Expected: FAIL — `alert.boardIds` er `undefined`, og `BOARD_IDS_MAX` finnes ikke.

- [ ] **Step 3: Skriv implementasjonen**

I `src/alerts/alertMapper.js`, legg til importen øverst:

```js
import { isValidBoardId } from '../boards/boardId.js';
```

I `toAlert`, legg til feltet rett etter `id`:

```js
        // Ugyldige id-er kastes her, ikke i komponentene: en id som ikke kan
        // være en tavle kan uansett ikke matche noen, og en liste med tull i
        // gjør bare feilsøkingen vanskeligere lenger ned.
        boardIds: Array.isArray(data.boardIds) ? data.boardIds.filter(isValidBoardId) : [],
```

I `toFirestoreData`, legg til:

```js
        boardIds: Array.isArray(input.boardIds) ? input.boardIds.filter(isValidBoardId) : [],
```

I `src/alerts/alertValidation.js`, legg til konstanten øverst:

```js
/** Taket speiler firestore.rules. Endrer du det her, endre det der også. */
export const BOARD_IDS_MAX = 20;
```

og denne blokka i `validateAlertInput`, rett før `return errors;`:

```js
    const boardIds = Array.isArray(input.boardIds) ? input.boardIds : [];
    if (boardIds.length === 0) {
        errors.boardIds = 'Velg minst én tavle';
    } else if (boardIds.length > BOARD_IDS_MAX) {
        errors.boardIds = `En melding kan stå på maks ${BOARD_IDS_MAX} tavler`;
    }
```

- [ ] **Step 4: Kjør testene og se at de passerer**

Run: `yarn test`
Expected: PASS. Merk at eksisterende `alertValidation`-tester som ikke sender `boardIds` nå får en `boardIds`-feil i tillegg — de asserter på enkeltfelt (`errors.title` osv.), ikke på hele objektet, så de skal fortsatt passere. Gjør de ikke det, legg `boardIds: ['bergen-3']` inn i testens grunnlagsobjekt framfor å myke opp valideringen.

- [ ] **Step 5: Commit**

```bash
git add src/alerts/alertMapper.js src/alerts/alertValidation.js src/alerts/alertMapper.test.mjs src/alerts/alertValidation.test.mjs
git commit -m "feat: meldinger hører til én eller flere tavler"
```

---

### Task 3: Medlemskap — ren logikk

**Files:**
- Create: `src/access/memberships.js`, `src/access/memberships.test.mjs`

**Interfaces:**
- Consumes: `isValidBoardId` fra `boardId.js` (Task 1); `ENTUR_DOMAIN`, `normalizeEmail` fra `src/admin/enturAccount.js`.
- Produces: `BOARDS_PER_USER_MAX`, `normalizeBoards(value)`, `addBoard(boards, boardId)`, `removeBoard(boards, boardId)`, `validateGranteeEmail(email, existingMembers)`, `isLastMember(memberEmails, email)`.

- [ ] **Step 1: Skriv den feilende testen**

Opprett `src/access/memberships.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    BOARDS_PER_USER_MAX,
    addBoard,
    isLastMember,
    normalizeBoards,
    removeBoard,
    validateGranteeEmail,
} from './memberships.js';

describe('normalizeBoards', () => {
    it('beholder gyldige id-er', () => {
        assert.deepEqual(normalizeBoards(['bergen-3', 'billettkontor-bergen']), ['bergen-3', 'billettkontor-bergen']);
    });

    it('kaster ugyldige id-er og duplikater', () => {
        assert.deepEqual(normalizeBoards(['bergen-3', 'Bergen-3', 'bergen-3', 42, null]), ['bergen-3']);
    });

    it('tåler noe annet enn en liste', () => {
        assert.deepEqual(normalizeBoards(undefined), []);
        assert.deepEqual(normalizeBoards('bergen-3'), []);
    });
});

describe('addBoard', () => {
    it('legger til uten å lage duplikat', () => {
        assert.deepEqual(addBoard(['bergen-3'], 'oslo-1'), ['bergen-3', 'oslo-1']);
        assert.deepEqual(addBoard(['bergen-3'], 'bergen-3'), ['bergen-3']);
    });

    it('nekter en ugyldig id', () => {
        assert.deepEqual(addBoard(['bergen-3'], 'Ugyldig'), ['bergen-3']);
    });
});

describe('removeBoard', () => {
    it('fjerner id-en og lar resten stå', () => {
        assert.deepEqual(removeBoard(['bergen-3', 'oslo-1'], 'bergen-3'), ['oslo-1']);
    });

    it('tåler en id som ikke er der', () => {
        assert.deepEqual(removeBoard(['bergen-3'], 'oslo-1'), ['bergen-3']);
    });
});

describe('validateGranteeEmail', () => {
    it('godtar en Entur-adresse som ikke har tilgang fra før', () => {
        assert.equal(validateGranteeEmail('Ola.Nordmann@Entur.org', ['kari@entur.org']), null);
    });

    it('krever en adresse', () => {
        assert.equal(validateGranteeEmail('  ', []), 'Skriv en e-postadresse');
    });

    it('avviser adresser utenfor entur.org', () => {
        assert.equal(validateGranteeEmail('ola@example.com', []), 'Adressen må være en @entur.org-adresse');
        assert.equal(validateGranteeEmail('ola@entur.org.example.com', []), 'Adressen må være en @entur.org-adresse');
    });

    it('sier fra når personen allerede har tilgang, uansett skrivemåte', () => {
        assert.equal(validateGranteeEmail('Kari@Entur.org', ['kari@entur.org']), 'Kari@Entur.org har allerede tilgang');
    });
});

describe('isLastMember', () => {
    it('er sann bare når du er den eneste igjen', () => {
        assert.equal(isLastMember(['ola@entur.org'], 'ola@entur.org'), true);
        assert.equal(isLastMember(['ola@entur.org', 'kari@entur.org'], 'ola@entur.org'), false);
        assert.equal(isLastMember(['kari@entur.org'], 'ola@entur.org'), false);
    });
});

describe('BOARDS_PER_USER_MAX', () => {
    it('er et tak normalizeBoards håndhever', () => {
        const mange = Array.from({ length: BOARDS_PER_USER_MAX + 5 }, (_, i) => `tavle-${i}`);
        assert.equal(normalizeBoards(mange).length, BOARDS_PER_USER_MAX);
    });
});
```

- [ ] **Step 2: Kjør testen og se at den feiler**

Run: `yarn test`
Expected: FAIL — `Cannot find module './memberships.js'`.

- [ ] **Step 3: Skriv implementasjonen**

Opprett `src/access/memberships.js`:

```js
/**
 * Tilgangslister: hvilke tavler én person har tilgang til.
 *
 * Tilgang lagres per bruker (`memberships/<e-post>`), ikke som en medlemsliste
 * på tavla. Grunnen er meldingene: én melding kan gjelde flere tavler, og
 * regelen må avgjøre om *alle* tavlene i lista er dine. Med tilgang lagret per
 * bruker er det ett oppslag og én listesammenlikning; med en medlemsliste per
 * tavle måtte reglene iterert over lista, og det kan de ikke.
 *
 * Uten Firebase-importer, slik at logikken kan testes med `node --test`.
 */
import { isValidBoardId } from '../boards/boardId.js';
import { ENTUR_DOMAIN, normalizeEmail } from '../admin/enturAccount.js';

/** Taket speiler firestore.rules. Endrer du det her, endre det der også. */
export const BOARDS_PER_USER_MAX = 100;

export function normalizeBoards(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const seen = [];
    for (const boardId of value) {
        if (isValidBoardId(boardId) && !seen.includes(boardId)) {
            seen.push(boardId);
        }
        if (seen.length === BOARDS_PER_USER_MAX) {
            break;
        }
    }
    return seen;
}

export function addBoard(boards, boardId) {
    if (!isValidBoardId(boardId) || boards.includes(boardId)) {
        return boards;
    }
    return [...boards, boardId];
}

export function removeBoard(boards, boardId) {
    return boards.filter((existing) => existing !== boardId);
}

/**
 * Om adressen kan gis tilgang. Returnerer feilmeldingen, eller null når alt er i
 * orden.
 *
 * Sjekken mot eksisterende medlemmer gjøres på normalisert form, slik at
 * «Kari@Entur.org» og «kari@entur.org» regnes som samme person — det er den
 * samme normaliseringen dokument-id-en og reglene bruker.
 */
export function validateGranteeEmail(email, existingMembers) {
    const normalized = normalizeEmail(email);
    if (normalized === '') {
        return 'Skriv en e-postadresse';
    }
    if (!normalized.endsWith(`@${ENTUR_DOMAIN}`)) {
        return `Adressen må være en @${ENTUR_DOMAIN}-adresse`;
    }
    if (existingMembers.some((member) => normalizeEmail(member) === normalized)) {
        return `${email} har allerede tilgang`;
    }
    return null;
}

/**
 * Om denne personen er den siste med tilgang.
 *
 * En tavle uten noen med tilgang må ordnes i Firebase-konsollet, så den siste
 * skal ikke kunne fjernes ved et uhell. Dette er kun for å gi en tydelig sperre
 * i grensesnittet — reglene kan ikke telle medlemmer, så håndhevingen finnes
 * ikke der.
 */
export function isLastMember(memberEmails, email) {
    const normalized = normalizeEmail(email);
    return memberEmails.length === 1 && normalizeEmail(memberEmails[0]) === normalized;
}
```

- [ ] **Step 4: Kjør testen og se at den passerer**

Run: `yarn test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/access/memberships.js src/access/memberships.test.mjs
git commit -m "feat: ren logikk for tilgangslister"
```

---

### Task 4: Firestore-reglene og regeltestene

**Files:**
- Modify: `firestore.rules`, `package.json`
- Create: `firestore.rules.spec.mjs`

**Interfaces:**
- Consumes: ingenting fra tidligere tasks — reglene står for seg selv.
- Produces: `boards`, `memberships` og `alerts` med den nye tilgangsmodellen, og `yarn test:rules` som kjører testene mot emulatoren.

Dette er den farligste oppgaven i planen: en feil her er et sikkerhetshull som ikke ser feil ut. Reglene skrives derfor sammen med testene sine, og testene er ikke valgfrie.

- [ ] **Step 1: Installer testbiblioteket og legg inn scriptet**

```bash
yarn add --dev @firebase/rules-unit-testing --ignore-engines
```

`--ignore-engines` er nødvendig: Node 26 i dette repoet er nyere enn pakkens engines-felt, og uten flagget stopper installasjonen.

Legg til i `package.json` under `scripts`:

```json
		"test:rules": "firebase emulators:exec --only firestore --project ent-tavleber-prd \"node --test firestore.rules.spec.mjs\"",
```

`emulators:exec` starter emulatoren, kjører kommandoen og rydder opp. Filnavnet er `.rules.spec.mjs`, ikke `.test.mjs`, slik at `node --test` ikke plukker den opp under vanlige `yarn test` — den ville feilet uten emulator.

- [ ] **Step 2: Skriv de feilende regeltestene**

Opprett `firestore.rules.spec.mjs` i repo-rota:

```js
/**
 * Tester for firestore.rules.
 *
 * Kjøres med `yarn test:rules`, som starter Firestore-emulatoren rundt dem.
 * Ligger utenfor `yarn test` med vilje — de krever emulator og Java, mens
 * `yarn test` skal kunne kjøres hvor som helst.
 *
 * Det som testes er grensene som faktisk kan misbrukes: mellom tavler, «før og
 * etter»-sjekken på meldinger, og at ingen kan gi seg selv tilgang.
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, deleteDoc, collection, query, where } from 'firebase/firestore';

let testEnv;

/** Firestore-instans for en innlogget Entur-bruker. */
function as(email) {
    return testEnv.authenticatedContext(email, {
        email,
        email_verified: true,
    }).firestore();
}

/** Firestore-instans uten pålogging — slik kiosken leser. */
function anonymous() {
    return testEnv.unauthenticatedContext().firestore();
}

function board(overrides = {}) {
    return {
        name: 'Bergen 3. etasje',
        placeName: 'Bergen',
        top: { kind: 'video' },
        middle: [],
        carousel: [],
        createdBy: 'ola@entur.org',
        updatedBy: 'ola@entur.org',
        ...overrides,
    };
}

function alert(overrides = {}) {
    return {
        title: 'Tittel',
        body: 'Tekst',
        level: 'information',
        startsAt: new Date('2026-08-03T08:00:00Z'),
        endsAt: null,
        enabled: true,
        boardIds: ['bergen-3'],
        createdBy: 'ola@entur.org',
        updatedBy: 'ola@entur.org',
        ...overrides,
    };
}

before(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: 'ent-tavleber-prd',
        firestore: {
            rules: await readFile('firestore.rules', 'utf8'),
            host: '127.0.0.1',
            port: 8080,
        },
    });
});

after(async () => {
    await testEnv.cleanup();
});

beforeEach(async () => {
    await testEnv.clearFirestore();
    // Utgangspunkt: ola eier bergen-3, kari eier oslo-1, ingen deler noe.
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'boards/bergen-3'), board());
        await setDoc(doc(db, 'boards/oslo-1'), board({ createdBy: 'kari@entur.org', updatedBy: 'kari@entur.org' }));
        await setDoc(doc(db, 'memberships/ola@entur.org'), { boards: ['bergen-3'] });
        await setDoc(doc(db, 'memberships/kari@entur.org'), { boards: ['oslo-1'] });
    });
});

describe('boards', () => {
    it('kan leses uten pålogging — kiosken har ingen', async () => {
        await assertSucceeds(getDoc(doc(anonymous(), 'boards/bergen-3')));
    });

    it('kan endres av den som har tilgang', async () => {
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({ placeName: 'Bergen sentrum' })));
    });

    it('kan ikke endres av noen uten tilgang', async () => {
        await assertFails(setDoc(doc(as('kari@entur.org'), 'boards/bergen-3'), board({ placeName: 'Kapret' })));
    });

    it('kan opprettes av enhver Entur-konto, med seg selv som createdBy', async () => {
        await assertSucceeds(setDoc(doc(as('ny@entur.org'), 'boards/ny-tavle'), board({ createdBy: 'ny@entur.org', updatedBy: 'ny@entur.org' })));
    });

    it('kan ikke opprettes i en annens navn', async () => {
        await assertFails(setDoc(doc(as('ny@entur.org'), 'boards/ny-tavle'), board({ createdBy: 'ola@entur.org', updatedBy: 'ny@entur.org' })));
    });

    it('kan ikke opprettes av en konto utenfor entur.org', async () => {
        await assertFails(setDoc(doc(as('utenfor@example.com'), 'boards/ny-tavle'), board({ createdBy: 'utenfor@example.com', updatedBy: 'utenfor@example.com' })));
    });

    it('kan ikke få createdBy overtatt ved en oppdatering', async () => {
        // Forsøk på å skrive om createdBy til en annen skal avvises …
        await assertFails(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({ createdBy: 'kari@entur.org', name: 'Nytt' })));
        // … mens den samme endringen med createdBy urørt skal gå gjennom.
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({ name: 'Nytt' })));
    });

    it('kan slettes av den som har tilgang, men ikke av andre', async () => {
        await assertFails(deleteDoc(doc(as('kari@entur.org'), 'boards/bergen-3')));
        await assertSucceeds(deleteDoc(doc(as('ola@entur.org'), 'boards/bergen-3')));
    });
});

describe('memberships', () => {
    it('lar deg lese din egen oppføring', async () => {
        await assertSucceeds(getDoc(doc(as('ola@entur.org'), 'memberships/ola@entur.org')));
    });

    it('lar deg ikke lese oppføringen til en du ikke deler tavle med', async () => {
        await assertFails(getDoc(doc(as('ola@entur.org'), 'memberships/kari@entur.org')));
    });

    it('lar deg finne hvem som deler en tavle med deg', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'memberships/per@entur.org'), { boards: ['bergen-3'] });
        });
        const db = as('ola@entur.org');
        const treff = query(collection(db, 'memberships'), where('boards', 'array-contains', 'bergen-3'));
        await assertSucceeds(getDocs(treff));
    });

    it('lar deg gi bort en tavle du har', async () => {
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'memberships/per@entur.org'), { boards: ['bergen-3'] }));
    });

    it('lar deg ikke gi bort en tavle du ikke har', async () => {
        await assertFails(setDoc(doc(as('ola@entur.org'), 'memberships/per@entur.org'), { boards: ['oslo-1'] }));
    });

    it('lar deg ikke gi deg selv tilgang til en fremmed tavle', async () => {
        await assertFails(setDoc(doc(as('ola@entur.org'), 'memberships/ola@entur.org'), { boards: ['bergen-3', 'oslo-1'] }));
    });

    it('lar deg ikke fjerne en tavle du ikke har fra en annens liste', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'memberships/per@entur.org'), { boards: ['bergen-3', 'oslo-1'] });
        });
        // ola har bare bergen-3; å skrive lista uten oslo-1 fjerner en tilgang han ikke rår over
        await assertFails(setDoc(doc(as('ola@entur.org'), 'memberships/per@entur.org'), { boards: ['bergen-3'] }));
        // men å fjerne bergen-3 og la oslo-1 stå er lov
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'memberships/per@entur.org'), { boards: ['oslo-1'] }));
    });

    it('lar deg gjøre krav på en tavle du selv har opprettet', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'boards/min-nye'), board({ createdBy: 'ny@entur.org', updatedBy: 'ny@entur.org' }));
        });
        await assertSucceeds(setDoc(doc(as('ny@entur.org'), 'memberships/ny@entur.org'), {
            boards: ['min-nye'], claiming: 'min-nye',
        }));
    });

    it('lar deg ikke gjøre krav på en tavle du ikke har opprettet', async () => {
        await assertFails(setDoc(doc(as('ny@entur.org'), 'memberships/ny@entur.org'), {
            boards: ['bergen-3'], claiming: 'bergen-3',
        }));
    });

    it('lar deg ikke smugle en ekstra tavle inn sammen med et gyldig krav', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'boards/min-nye'), board({ createdBy: 'ny@entur.org', updatedBy: 'ny@entur.org' }));
        });
        await assertFails(setDoc(doc(as('ny@entur.org'), 'memberships/ny@entur.org'), {
            boards: ['min-nye', 'bergen-3'], claiming: 'min-nye',
        }));
    });

    it('lar deg ikke gjøre krav i en annens navn', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'boards/min-nye'), board({ createdBy: 'ny@entur.org', updatedBy: 'ny@entur.org' }));
        });
        await assertFails(setDoc(doc(as('ny@entur.org'), 'memberships/per@entur.org'), {
            boards: ['min-nye'], claiming: 'min-nye',
        }));
    });
});

describe('alerts', () => {
    it('kan leses uten pålogging', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'alerts/a1'), alert());
        });
        await assertSucceeds(getDoc(doc(anonymous(), 'alerts/a1')));
    });

    it('kan opprettes på en tavle du har', async () => {
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'alerts/a1'), alert()));
    });

    it('kan ikke opprettes på en tavle du ikke har', async () => {
        await assertFails(setDoc(doc(as('ola@entur.org'), 'alerts/a1'), alert({ boardIds: ['oslo-1'] })));
    });

    it('kan ikke opprettes med en blanding av dine og andres tavler', async () => {
        await assertFails(setDoc(doc(as('ola@entur.org'), 'alerts/a1'), alert({ boardIds: ['bergen-3', 'oslo-1'] })));
    });

    it('kan ikke opprettes uten tavle', async () => {
        await assertFails(setDoc(doc(as('ola@entur.org'), 'alerts/a1'), alert({ boardIds: [] })));
    });

    it('kan ikke avpubliseres fra en tavle du ikke har', async () => {
        // Meldinga står på begge tavler. ola har bare bergen-3.
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'alerts/delt'), alert({ boardIds: ['bergen-3', 'oslo-1'] }));
        });
        // Å skrive den om til bare bergen-3 ville tatt den ned fra oslo-1.
        await assertFails(setDoc(doc(as('ola@entur.org'), 'alerts/delt'), alert({ boardIds: ['bergen-3'] })));
    });

    it('kan ikke endres når den står på en tavle du ikke har', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'alerts/delt'), alert({ boardIds: ['bergen-3', 'oslo-1'] }));
        });
        await assertFails(setDoc(doc(as('ola@entur.org'), 'alerts/delt'), alert({ boardIds: ['bergen-3', 'oslo-1'], title: 'Kapret' })));
    });

    it('kan slettes bare når alle tavlene er dine', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'alerts/min'), alert());
            await setDoc(doc(context.firestore(), 'alerts/delt'), alert({ boardIds: ['bergen-3', 'oslo-1'] }));
        });
        await assertFails(deleteDoc(doc(as('ola@entur.org'), 'alerts/delt')));
        await assertSucceeds(deleteDoc(doc(as('ola@entur.org'), 'alerts/min')));
    });

    it('kan ikke skrives i en annens navn', async () => {
        await assertFails(setDoc(doc(as('ola@entur.org'), 'alerts/a1'), alert({ updatedBy: 'kari@entur.org' })));
    });

    it('krever verifisert e-post', async () => {
        const uverifisert = testEnv.authenticatedContext('ola@entur.org', {
            email: 'ola@entur.org', email_verified: false,
        }).firestore();
        await assertFails(setDoc(doc(uverifisert, 'alerts/a1'), alert()));
    });
});

describe('admins-collectionen er borte', () => {
    it('kan verken leses eller skrives', async () => {
        await assertFails(getDoc(doc(as('ola@entur.org'), 'admins/ola@entur.org')));
        await assertFails(setDoc(doc(as('ola@entur.org'), 'admins/ola@entur.org'), { addedBy: 'meg' }));
    });
});
```

- [ ] **Step 3: Kjør regeltestene og se at de feiler**

Run: `yarn test:rules`
Expected: FAIL — de fleste testene faller fordi `memberships` ennå ikke finnes i reglene og `alerts` fortsatt bruker `admins`-allowlisten.

- [ ] **Step 4: Skriv reglene**

Erstatt hele `firestore.rules`:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function callerEmail() {
      return request.auth.token.email.lower();
    }

    function isEnturUser() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && callerEmail().matches('.*@entur[.]org$');
    }

    // Tavlene du har tilgang til. Tilgang lagres per bruker, ikke som en
    // medlemsliste på tavla, fordi en melding kan gjelde flere tavler: regelen
    // må avgjøre om ALLE tavlene i lista er dine, og regler kan ikke iterere
    // over en liste. Med denne formen er det ett oppslag og én hasOnly.
    function myBoards() {
      return exists(/databases/$(database)/documents/memberships/$(callerEmail()))
        ? get(/databases/$(database)/documents/memberships/$(callerEmail())).data.boards
        : [];
    }

    function isMember(boardId) {
      return isEnturUser() && boardId in myBoards();
    }

    // Tavla klienten gjør krav på fordi den nettopp opprettet den.
    //
    // Uten dette er den første tavla di et hull: du oppretter boards/x, men
    // myBoards() er tom, så du får ikke lagt x inn i din egen oppføring — og
    // sitter med en tavle du ikke kan redigere. Id-en står i et eget felt, ikke
    // bare i lista, nettopp fordi regelen må kunne slå den opp; å finne «det
    // nye elementet» i en liste er ikke mulig uten iterasjon.
    function claimed() {
      return request.resource.data.keys().hasAny(['claiming'])
        && exists(/databases/$(database)/documents/boards/$(request.resource.data.claiming))
        && get(/databases/$(database)/documents/boards/$(request.resource.data.claiming)).data.createdBy == callerEmail()
        ? [request.resource.data.claiming]
        : [];
    }

    function isValidBoard(d) {
      return d.name is string && d.name.size() > 0 && d.name.size() <= 60
        && d.placeName is string && d.placeName.size() > 0 && d.placeName.size() <= 40
        && d.top is map && d.top.kind in ['video', 'logo']
        && d.middle is list && d.middle.size() <= 5
        && d.carousel is list && d.carousel.size() <= 5
        && d.updatedBy == callerEmail();
    }

    function isValidMembership(d) {
      return d.boards is list && d.boards.size() <= 100;
    }

    function isValidAlert(d) {
      return d.title is string && d.title.size() > 0 && d.title.size() <= 80
        && d.body is string && d.body.size() > 0 && d.body.size() <= 400
        && d.level in ['information', 'success', 'warning', 'negative']
        && d.startsAt is timestamp
        && (d.endsAt == null || (d.endsAt is timestamp && d.endsAt > d.startsAt))
        && d.enabled is bool
        && d.boardIds is list
        && d.boardIds.size() > 0
        && d.boardIds.size() <= 20;
    }

    match /boards/{boardId} {
      // Kiosken har ingen pålogging og må lese oppsettet sitt uautentisert.
      // Konsekvens: oppsettet er offentlig lesbart. Se speccen.
      allow read: if true;

      allow create: if isEnturUser()
        && isValidBoard(request.resource.data)
        && request.resource.data.createdBy == callerEmail();

      allow update: if isMember(boardId)
        && isValidBoard(request.resource.data)
        && request.resource.data.createdBy == resource.data.createdBy;

      allow delete: if isMember(boardId);
    }

    match /memberships/{email} {
      // Egen oppføring, eller oppføringen til noen du deler en tavle med — det
      // siste er det admin-siden bruker for å vise hvem som har tilgang.
      allow read: if isEnturUser()
        && (email == callerEmail() || resource.data.boards.hasAny(myBoards()));

      allow create: if isEnturUser()
        && isValidMembership(request.resource.data)
        && request.resource.data.boards.hasOnly(myBoards().concat(claimed()));

      // Både det som legges til og det som fjernes må være tavler du selv har.
      // Uten den andre linja kunne jeg fjernet en tilgang jeg ikke rår over.
      allow update: if isEnturUser()
        && isValidMembership(request.resource.data)
        && request.resource.data.boards.hasOnly(resource.data.boards.concat(myBoards()).concat(claimed()))
        && resource.data.boards.hasOnly(request.resource.data.boards.concat(myBoards()));

      // Tilgang fjernes ved å tømme lista, ikke ved å slette dokumentet — da
      // ville en sletting tatt bort tilganger giveren ikke rår over.
      allow delete: if false;
    }

    match /alerts/{alertId} {
      allow read: if true;

      allow create: if isEnturUser()
        && isValidAlert(request.resource.data)
        && request.resource.data.boardIds.hasOnly(myBoards())
        && request.resource.data.createdBy == callerEmail()
        && request.resource.data.updatedBy == callerEmail();

      // Både før og etter: sjekkes bare den nye lista, kan jeg ta en melding som
      // står på din tavle og min, fjerne din fra lista og skrive om teksten —
      // altså avpublisere fra en tavle jeg ikke har tilgang til.
      allow update: if isEnturUser()
        && isValidAlert(request.resource.data)
        && resource.data.boardIds.hasOnly(myBoards())
        && request.resource.data.boardIds.hasOnly(myBoards())
        && request.resource.data.updatedBy == callerEmail()
        && request.resource.data.createdBy == resource.data.createdBy;

      allow delete: if isEnturUser()
        && resource.data.boardIds.hasOnly(myBoards());
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 5: Kjør regeltestene til de er grønne**

Run: `yarn test:rules`
Expected: PASS — alle testene.

Feiler noe, er det reglene som er feil, ikke testen. Ett unntak er verdt å kjenne til: testen «lar deg finne hvem som deler en tavle med deg» kjører en `array-contains`-spørring, og Firestore evaluerer regelen per dokument spørringen returnerer. Slår den feil, skyldes det at et dokument i resultatet ikke tilfredsstiller `resource.data.boards.hasAny(myBoards())` — ikke at spørringen i seg selv er ulovlig.

Run: `yarn test`
Expected: PASS — regeltestene skal *ikke* dukke opp her.

- [ ] **Step 6: Commit**

```bash
git add firestore.rules firestore.rules.spec.mjs package.json yarn.lock
git commit -m "feat: tilgangsmodell per tavle i firestore-reglene, med tester"
```

---

### Task 5: Repositories

**Files:**
- Create: `src/access/membershipsRepository.js`
- Modify: `src/boards/boardsRepository.js`, `src/alerts/alertsRepository.js`

**Interfaces:**
- Consumes: `normalizeBoards`, `addBoard`, `removeBoard` fra `memberships.js` (Task 3); `normalizeEmail` fra `enturAccount.js`; `normalizeBoardConfig`, `toFirestoreBoard` fra `boardConfig.js`.
- Produces:
  - `subscribeToMyBoardIds(email, onIds, onError)` → avmeldingsfunksjon
  - `fetchMyBoardIds(email)` → `Promise<string[]>`
  - `fetchMemberEmails(boardId)` → `Promise<string[]>`
  - `grantAccess(granteeEmail, boardId)` → `Promise<void>`
  - `revokeAccess(granteeEmail, boardId)` → `Promise<void>`
  - `claimBoard(email, boardId)` → `Promise<void>`
  - `createBoard(config, userEmail)` og `deleteBoard(boardId)` i `boardsRepository`
  - `subscribeToBoardAlerts(boardId, onAlerts, onError)` og `subscribeToBoardAlertss(boardIds, onAlerts, onError)`

- [ ] **Step 1: Skriv `membershipsRepository`**

Opprett `src/access/membershipsRepository.js`:

```js
import { collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, where } from 'firebase/firestore';

import { db } from '../alerts/firebase.js';
import { normalizeEmail } from '../admin/enturAccount.js';
import { addBoard, normalizeBoards, removeBoard } from './memberships.js';

const COLLECTION = 'memberships';

/** Live-abonnement på dine egne tavler. Tom liste når oppføringen mangler. */
export function subscribeToMyBoardIds(email, onIds, onError) {
    return onSnapshot(
        doc(db, COLLECTION, normalizeEmail(email)),
        (snapshot) => onIds(snapshot.exists() ? normalizeBoards(snapshot.data().boards) : []),
        onError,
    );
}

export async function fetchMyBoardIds(email) {
    const snapshot = await getDoc(doc(db, COLLECTION, normalizeEmail(email)));
    return snapshot.exists() ? normalizeBoards(snapshot.data().boards) : [];
}

/**
 * Hvem som har tilgang til en tavle.
 *
 * Tilgang er lagret per bruker, så dette er en spørring, ikke et oppslag.
 * `array-contains` alene trenger ingen sammensatt indeks. Reglene tillater
 * spørringen fordi hvert dokument i svaret deler en tavle med deg.
 */
export async function fetchMemberEmails(boardId) {
    const members = query(collection(db, COLLECTION), where('boards', 'array-contains', boardId));
    const snapshot = await getDocs(members);
    return snapshot.docs.map((document) => document.id);
}

/**
 * Les-så-skriv, ikke arrayUnion.
 *
 * Reglene sammenlikner hele lista før og etter, og en les-så-skriv gjør det
 * åpenbart hva som faktisk skrives. Kappløpet det åpner for — to personer som
 * gir tilgang til samme person i samme sekund — er ikke en reell risiko på
 * 5–20 tavler, og verste utfall er at den ene må gjøre det om igjen.
 */
export async function grantAccess(granteeEmail, boardId) {
    const email = normalizeEmail(granteeEmail);
    const current = await fetchMyBoardIdsFor(email);
    await setDoc(doc(db, COLLECTION, email), { boards: addBoard(current, boardId) }, { merge: true });
}

export async function revokeAccess(granteeEmail, boardId) {
    const email = normalizeEmail(granteeEmail);
    const current = await fetchMyBoardIdsFor(email);
    await setDoc(doc(db, COLLECTION, email), { boards: removeBoard(current, boardId) }, { merge: true });
}

/**
 * Gjør krav på en tavle du nettopp opprettet.
 *
 * `claiming` er feltet regelen slår opp for å bekrefte at `createdBy` på tavla
 * er deg. Uten det ville din første tavle vært umulig å få tilgang til: du har
 * ingen tavler ennå, og regelen krever at det du legger til er en du har.
 *
 * Feltet blir liggende i dokumentet etterpå. Det er ufarlig: `claimed()` gir bare
 * uttelling når `createdBy` på den tavla er den som skriver, så en gammel verdi
 * kan ikke gi noen andre tilgang til noe. Å rydde den bort ville krevd en ekstra
 * skriving uten at noe ble tryggere.
 */
export async function claimBoard(email, boardId) {
    const normalized = normalizeEmail(email);
    const current = await fetchMyBoardIdsFor(normalized);
    await setDoc(
        doc(db, COLLECTION, normalized),
        { boards: addBoard(current, boardId), claiming: boardId },
        { merge: true },
    );
}

/**
 * Andres liste kan vi bare lese når vi deler en tavle. Klarer vi ikke lese den,
 * behandler vi den som tom — reglene avviser uansett en skriving som ville lagt
 * til eller fjernet noe vi ikke rår over.
 */
async function fetchMyBoardIdsFor(email) {
    try {
        const snapshot = await getDoc(doc(db, COLLECTION, email));
        return snapshot.exists() ? normalizeBoards(snapshot.data().boards) : [];
    } catch (error) {
        console.warn('Kunne ikke lese tilgangslista', error);
        return [];
    }
}
```

- [ ] **Step 2: Utvid `boardsRepository`**

I `src/boards/boardsRepository.js`, bytt importlinja fra `firebase/firestore` til:

```js
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
```

og legg til nederst:

```js
/**
 * Oppretter en tavle. Kaster `Error('id-opptatt')` hvis id-en finnes.
 *
 * Sjekken er her og ikke i reglene fordi feilmeldingen ellers blir feil: en
 * `create` mot et dokument som finnes behandles av reglene som en `update`, og
 * avvises med permission-denied — som ser ut som manglende tilgang, ikke som en
 * opptatt id.
 */
export async function createBoard(config, userEmail) {
    const existing = await getDoc(doc(db, COLLECTION, config.id));
    if (existing.exists()) {
        throw new Error('id-opptatt');
    }
    await setDoc(doc(db, COLLECTION, config.id), {
        ...toFirestoreBoard(config, userEmail),
        createdBy: userEmail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
}

/**
 * Sletter tavla. Meldingene røres ikke: en melding som peker på en slettet tavle
 * blir liggende med en id ingen renderer, og vises fortsatt på de andre tavlene
 * sine. Alternativet er å rydde i meldinger man kanskje ikke har lov å endre.
 */
export function deleteBoard(boardId) {
    return deleteDoc(doc(db, COLLECTION, boardId));
}
```

- [ ] **Step 3: Legg tavle-spørringene i `alertsRepository`**

I `src/alerts/alertsRepository.js`, erstatt `subscribeToEnabledAlerts` og `subscribeToAllAlerts` med:

```js
/**
 * Tavla: meldingene som gjelder denne tavla.
 *
 * Ingen `enabled`-filtrering i spørringen — `array-contains` sammen med en
 * likhetstest ville krevd en sammensatt indeks, og `selectVisibleAlerts`
 * filtrerer allerede på status, som håndterer både av-bryteren og tidsvinduet.
 */
export function subscribeToBoardAlerts(boardId, onAlerts, onError) {
    const forBoard = query(collection(db, COLLECTION), where('boardIds', 'array-contains', boardId));
    return onSnapshot(forBoard, (snapshot) => onAlerts(mapSnapshot(snapshot)), onError);
}
```

Tavla og admin bruker **samme** funksjon. Skillet i fase 1 — «bare aktive» mot
«alt» — var en serverside-filtrering som nå er borte, og tavla filtrerer uansett
med `selectVisibleAlerts` mens admin vil ha alt. To navn for én spørring ville
bare vært to steder å endre.

`saveAlert`, `deleteAlert` og `mapSnapshot` står uendret — `toFirestoreData` tar med `boardIds` etter Task 2.

- [ ] **Step 4: Ikke commit ennå — gå videre til Task 6**

Denne oppgaven fjerner `subscribeToEnabledAlerts` og `subscribeToAllAlerts`, som
`AlertBanner.jsx` og `AlertList.jsx` fortsatt importerer. **Bygget er rødt fra nå
til Task 6 og Task 9 er gjort**, og det er ventet.

Dette er den ene oppgaven i planen som ikke er selvstendig committbar. Ikke prøv
å reparere bygget her — ikke kommenter ut importer, ikke la de gamle funksjonene
stå «bare til nå». Gå rett til Task 6, som retter `AlertBanner`, og commit de to
sammen der. `AlertList` rettes i Task 9; til da bygger `yarn build` fortsatt
ikke, så Task 6 sin build-sjekk begrenses til at kiosken kompilerer:

Run: `yarn test`
Expected: PASS — de rene testene rører ikke Firebase-importene.

---

### Task 6: Kiosken viser bare sin egen tavles meldinger

**Files:**
- Modify: `src/components/AlertBanner.jsx`, `src/App.jsx`

**Interfaces:**
- Consumes: `subscribeToBoardAlerts` fra `alertsRepository.js` (Task 5).
- Produces: `<AlertBanner boardId={string} />`.

- [ ] **Step 1: La `AlertBanner` ta imot `boardId`**

I `src/components/AlertBanner.jsx`, bytt importlinja:

```js
import { subscribeToBoardAlerts } from '../alerts/alertsRepository';
```

signaturen:

```js
function AlertBanner({ boardId }) {
```

og abonnementet:

```js
    useEffect(() => subscribeToBoardAlerts(boardId, setAlerts, (error) => {
        console.error('Kunne ikke hente varsler', error);
        setAlerts([]);
    }), [boardId]);
```

- [ ] **Step 2: Send `boardId` fra `App`**

I `src/App.jsx`, bytt

```jsx
                    <AlertBanner />
```

til

```jsx
                    <AlertBanner boardId={boardId} />
```

- [ ] **Step 3: Verifiser mot emulatoren**

Start emulatoren i én terminal:

```bash
yarn firebase emulators:start --only auth,firestore --project ent-tavleber-prd
```

Legg inn to tavler og to meldinger, den ene på begge tavler:

```bash
BASE="http://127.0.0.1:8080/v1/projects/ent-tavleber-prd/databases/(default)/documents"
for id in bergen-3 oslo-1; do
  curl -s -o /dev/null -X PATCH -H 'Authorization: Bearer owner' -H 'Content-Type: application/json' \
    "$BASE/boards/$id" -d "{\"fields\":{
      \"name\":{\"stringValue\":\"$id\"},\"placeName\":{\"stringValue\":\"$id\"},
      \"top\":{\"mapValue\":{\"fields\":{\"kind\":{\"stringValue\":\"logo\"}}}},
      \"middle\":{\"arrayValue\":{\"values\":[]}},\"carousel\":{\"arrayValue\":{\"values\":[]}},
      \"createdBy\":{\"stringValue\":\"test@entur.org\"},\"updatedBy\":{\"stringValue\":\"test@entur.org\"}}}"
done

curl -s -o /dev/null -X PATCH -H 'Authorization: Bearer owner' -H 'Content-Type: application/json' \
  "$BASE/alerts/bare-bergen" -d '{"fields":{
    "title":{"stringValue":"Bare Bergen"},"body":{"stringValue":"Tekst"},
    "level":{"stringValue":"information"},"startsAt":{"timestampValue":"2026-01-01T00:00:00Z"},
    "endsAt":{"nullValue":null},"enabled":{"booleanValue":true},
    "boardIds":{"arrayValue":{"values":[{"stringValue":"bergen-3"}]}},
    "createdBy":{"stringValue":"test@entur.org"},"updatedBy":{"stringValue":"test@entur.org"}}}'

curl -s -o /dev/null -X PATCH -H 'Authorization: Bearer owner' -H 'Content-Type: application/json' \
  "$BASE/alerts/begge" -d '{"fields":{
    "title":{"stringValue":"Begge tavler"},"body":{"stringValue":"Tekst"},
    "level":{"stringValue":"warning"},"startsAt":{"timestampValue":"2026-01-01T00:00:00Z"},
    "endsAt":{"nullValue":null},"enabled":{"booleanValue":true},
    "boardIds":{"arrayValue":{"values":[{"stringValue":"bergen-3"},{"stringValue":"oslo-1"}]}},
    "createdBy":{"stringValue":"test@entur.org"},"updatedBy":{"stringValue":"test@entur.org"}}}'
```

Med `yarn dev`:

1. http://localhost:3000/t/bergen-3 → **begge** meldingene står der.
2. http://localhost:3000/t/oslo-1 → **bare** «Begge tavler».

- [ ] **Step 4: Test og commit Task 5 + 6**

Run: `yarn test`
Expected: PASS.

`yarn build` er fortsatt rødt her: `AlertList.jsx` importerer `subscribeToAllAlerts`,
som ble fjernet i Task 5, og rettes først i Task 9. Det er ventet og skal ikke
lappes over. Dev-serveren kjører likevel — Vite laster bare modulene ruta faktisk
bruker, og kiosken rører ikke `AlertList`. Derfor kan Step 3 verifiseres nå.

Bygget er grønt igjen fra og med Task 9.

```bash
git add src/access/membershipsRepository.js src/boards/boardsRepository.js src/alerts/alertsRepository.js src/components/AlertBanner.jsx src/App.jsx
git commit -m "feat: meldinger og tilgang hentes per tavle"
```

---

### Task 7: Admin — dine tavler og «Ny tavle»

**Files:**
- Create: `src/admin/NewBoardForm.jsx`
- Modify: `src/admin/BoardList.jsx`, `src/admin/Admin.jsx`
- Delete: `src/admin/adminAccess.js`

**Interfaces:**
- Consumes: `fetchMyBoardIds`, `claimBoard` fra `membershipsRepository.js` (Task 5); `fetchBoard`, `createBoard` fra `boardsRepository.js`; `suggestBoardId`, `isValidBoardId` fra `boardId.js` (Task 1); `normalizeBoardConfig` fra `boardConfig.js`.
- Produces: `<BoardList userEmail />`, `<NewBoardForm userEmail onCreated onCancel />`; `Admin` uten `admins`-porten.

- [ ] **Step 1: Skriv `NewBoardForm`**

Opprett `src/admin/NewBoardForm.jsx`:

```jsx
import { useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { PrimaryButton, SecondaryButton } from '@entur/button';
import { TextField } from '@entur/form';

import { BOARD_ID_MAX_LENGTH, isValidBoardId, suggestBoardId } from '../boards/boardId';
import { NAME_MAX_LENGTH, PLACE_NAME_MAX_LENGTH, normalizeBoardConfig } from '../boards/boardConfig';
import { createBoard } from '../boards/boardsRepository';
import { claimBoard } from '../access/membershipsRepository';

/** Oppsettet en ny tavle starter med: det samme som Bergen-tavla har. */
function startConfig(id, name, placeName) {
    return normalizeBoardConfig(id, {
        name,
        placeName,
        top: { kind: 'video' },
        middle: [{ type: 'greeting', text: 'auto', staffImage: true }],
        carousel: [{ type: 'weather', name: placeName, lat: 60.39299, lng: 5.32415 }],
    });
}

function NewBoardForm({ userEmail, onCreated, onCancel }) {
    const [name, setName] = useState('');
    const [placeName, setPlaceName] = useState('');
    // Id-en følger navnet til noen rører den selv. Da slutter den å følge.
    const [id, setId] = useState('');
    const [idTouched, setIdTouched] = useState(false);
    const [errors, setErrors] = useState({});
    const [saveError, setSaveError] = useState(null);
    const [saving, setSaving] = useState(false);

    const effectiveId = idTouched ? id : suggestBoardId(name);

    async function handleSubmit(event) {
        event.preventDefault();
        setSaveError(null);

        const nextErrors = {};
        if (name.trim() === '') nextErrors.name = 'Navn er påkrevd';
        if (placeName.trim() === '') nextErrors.placeName = 'Stedsnavn er påkrevd';
        if (!isValidBoardId(effectiveId)) {
            nextErrors.id = 'Id-en kan bare inneholde små bokstaver, tall og enkle bindestreker';
        }
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        setSaving(true);
        try {
            await createBoard(startConfig(effectiveId, name, placeName), userEmail);
            // To skritt: tavla først, så kravet på den. Reglene kan ikke gi deg
            // tilgang til noe som ikke finnes ennå.
            await claimBoard(userEmail, effectiveId);
            onCreated(effectiveId);
        } catch (error) {
            if (error.message === 'id-opptatt') {
                setErrors({ id: `Id-en «${effectiveId}» er allerede i bruk` });
            } else {
                console.error('Kunne ikke opprette tavla', error);
                setSaveError('Kunne ikke opprette tavla. Prøv igjen.');
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <TextField
                label="Navn"
                value={name}
                maxLength={NAME_MAX_LENGTH}
                onChange={(event) => setName(event.target.value)}
                variant={errors.name ? 'negative' : undefined}
                feedback={errors.name ?? 'Vises bare her i admin.'}
            />
            <TextField
                label="Stedsnavn"
                value={placeName}
                maxLength={PLACE_NAME_MAX_LENGTH}
                onChange={(event) => setPlaceName(event.target.value)}
                variant={errors.placeName ? 'negative' : undefined}
                feedback={errors.placeName ?? 'Gir «Velkommen til Entur …»'}
            />
            <TextField
                label="Id"
                value={effectiveId}
                maxLength={BOARD_ID_MAX_LENGTH}
                onChange={(event) => {
                    setIdTouched(true);
                    setId(event.target.value);
                }}
                variant={errors.id ? 'negative' : undefined}
                feedback={errors.id ?? `Skjermen skal peke på /t/${effectiveId || '…'}. Kan ikke endres senere.`}
            />

            {saveError && <SmallAlertBox variant="negative">{saveError}</SmallAlertBox>}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
                <PrimaryButton type="submit" disabled={saving}>
                    {saving ? 'Oppretter …' : 'Opprett tavle'}
                </PrimaryButton>
                <SecondaryButton type="button" onClick={onCancel} disabled={saving}>Avbryt</SecondaryButton>
            </div>
        </form>
    );
}

export default NewBoardForm;
```

- [ ] **Step 2: Skriv om `BoardList` til dine tavler**

Erstatt hele `src/admin/BoardList.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { PrimaryButton } from '@entur/button';
import { Heading3, Paragraph } from '@entur/typography';

import NewBoardForm from './NewBoardForm';
import { fetchMyBoardIds } from '../access/membershipsRepository';
import { fetchBoard } from '../boards/boardsRepository';

/** Tavlene du har tilgang til. */
function BoardList({ userEmail }) {
    const [state, setState] = useState({ status: 'laster' });
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        let current = true;
        loadBoards(userEmail)
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
    }, [userEmail, creating]);

    if (creating) {
        return (
            <section>
                <Heading3>Ny tavle</Heading3>
                <NewBoardForm
                    userEmail={userEmail}
                    onCreated={(id) => {
                        window.location.href = `/admin/t/${id}`;
                    }}
                    onCancel={() => setCreating(false)}
                />
            </section>
        );
    }

    if (state.status === 'laster') {
        return <Paragraph>Henter tavler …</Paragraph>;
    }
    if (state.status === 'feil') {
        return <SmallAlertBox variant="negative">Kunne ikke hente tavlene.</SmallAlertBox>;
    }

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-start' }}>
            <Heading3>Dine tavler</Heading3>
            {state.boards.length === 0 ? (
                <Paragraph>
                    Du har ikke tilgang til noen tavler ennå. Lag din egen, eller be noen som
                    har en tavle om å gi deg tilgang.
                </Paragraph>
            ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {state.boards.map((board) => (
                        <li key={board.id}>
                            <a href={`/admin/t/${board.id}`}>{board.name || board.id}</a>
                            {' — '}
                            <a href={`/t/${board.id}`}>se tavla</a>
                        </li>
                    ))}
                </ul>
            )}
            <PrimaryButton onClick={() => setCreating(true)}>Ny tavle</PrimaryButton>
        </section>
    );
}

/**
 * Id-ene fra din egen tilgangsliste, slått opp én for én.
 *
 * En tavle som er slettet lar en id bli liggende i lista; den hoppes over her
 * framfor å vises som en død lenke.
 */
async function loadBoards(userEmail) {
    const ids = await fetchMyBoardIds(userEmail);
    const boards = await Promise.all(ids.map((id) => fetchBoard(id)));
    return boards.filter(Boolean);
}

export default BoardList;
```

- [ ] **Step 3: Fjern `admins`-porten fra `Admin.jsx`**

I `src/admin/Admin.jsx`:

1. Slett importen av `hasAdminAccess`:

```js
import { hasAdminAccess } from './adminAccess';
```

2. Slett `access`-tilstanden og effekten som setter den — hele blokka fra `const [access, setAccess] = useState('ukjent');` og `useEffect`-en som kaller `hasAdminAccess`, samt de to tidlige returene `if (access === 'ukjent' || access === 'sjekker')` og `if (access === 'nei')`.

3. Send `userEmail` til `BoardList`, og fjern meldingene fra forsiden — de bor nå på tavlesiden. Erstatt blokka som starter med `{route.kind === 'adminBoard' ? (` og ut `</main>` med:

```jsx
            {route.kind === 'adminBoard' ? (
                <div style={{ marginTop: '1.5rem' }}>
                    <BoardAdmin boardId={route.boardId} userEmail={normalizeEmail(user.email)} />
                </div>
            ) : (
                <div style={{ marginTop: '1.5rem' }}>
                    <BoardList userEmail={normalizeEmail(user.email)} />
                </div>
            )}
        </main>
    );
```

4. Endre `heading` til å skille de to sidene:

```jsx
    const heading = route.kind === 'adminBoard' ? 'Oppsett for tavla' : 'Velkomsttavler';
```

5. Fjern importene som ikke lenger brukes på denne siden: `AlertForm`, `AlertList`, `PrimaryButton`, og tilstanden `formOpen`/`editing` med tilhørende settere.

- [ ] **Step 4: Slett `adminAccess.js`**

```bash
git rm src/admin/adminAccess.js
```

Finnes det en `src/admin/adminAccess.test.mjs`, slett den også.

- [ ] **Step 5: Test**

Run: `yarn test`
Expected: PASS. `yarn build` er fortsatt rødt til Task 9 — se Task 6 Step 4.

- [ ] **Step 6: Commit**

```bash
git add src/admin/NewBoardForm.jsx src/admin/BoardList.jsx src/admin/Admin.jsx
git commit -m "feat: admin viser dine tavler og lar deg opprette nye"
```

---

### Task 8: Tilgangssiden

**Files:**
- Create: `src/admin/BoardAccess.jsx`
- Modify: `src/admin/BoardAdmin.jsx`

**Interfaces:**
- Consumes: `fetchMemberEmails`, `grantAccess`, `revokeAccess` fra `membershipsRepository.js` (Task 5); `validateGranteeEmail`, `isLastMember` fra `memberships.js` (Task 3).
- Produces: `<BoardAccess boardId userEmail />`.

- [ ] **Step 1: Skriv `BoardAccess`**

Opprett `src/admin/BoardAccess.jsx`:

```jsx
import { useCallback, useEffect, useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { PrimaryButton, TertiaryButton } from '@entur/button';
import { TextField } from '@entur/form';
import { Heading3, Paragraph } from '@entur/typography';

import { isLastMember, validateGranteeEmail } from '../access/memberships';
import { fetchMemberEmails, grantAccess, revokeAccess } from '../access/membershipsRepository';

/**
 * Hvem som har tilgang til tavla.
 *
 * Tilgang er tilgang: den som står her kan endre oppsettet, publisere meldinger
 * og gi andre tilgang. Det finnes ingen roller.
 */
function BoardAccess({ boardId, userEmail }) {
    const [members, setMembers] = useState(null);
    const [email, setEmail] = useState('');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const reload = useCallback(async () => {
        try {
            setMembers(await fetchMemberEmails(boardId));
        } catch (loadError) {
            console.error('Kunne ikke hente hvem som har tilgang', loadError);
            setMembers([]);
            setError('Kunne ikke hente hvem som har tilgang.');
        }
    }, [boardId]);

    useEffect(() => {
        reload();
    }, [reload]);

    async function handleGrant(event) {
        event.preventDefault();
        const message = validateGranteeEmail(email, members ?? []);
        setError(message);
        if (message) return;

        setBusy(true);
        try {
            await grantAccess(email, boardId);
            setEmail('');
            await reload();
        } catch (grantError) {
            console.error('Kunne ikke gi tilgang', grantError);
            setError('Kunne ikke gi tilgang. Prøv igjen.');
        } finally {
            setBusy(false);
        }
    }

    async function handleRevoke(member) {
        // Den siste kan ikke fjernes: en tavle uten noen med tilgang må ordnes
        // i Firebase-konsollet, og det skal ikke skje ved et uhell. Reglene kan
        // ikke telle medlemmer, så sperren finnes bare her.
        if (isLastMember(members, member)) {
            setError('Den siste med tilgang kan ikke fjernes. Gi noen andre tilgang først.');
            return;
        }
        const egen = member === userEmail;
        if (egen && !window.confirm('Du fjerner din egen tilgang til denne tavla. Da mister du den med én gang. Er du sikker?')) {
            return;
        }

        setBusy(true);
        try {
            await revokeAccess(member, boardId);
            if (egen) {
                window.location.href = '/admin';
                return;
            }
            await reload();
        } catch (revokeError) {
            console.error('Kunne ikke fjerne tilgang', revokeError);
            setError('Kunne ikke fjerne tilgang. Prøv igjen.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Heading3>Tilgang</Heading3>
            <Paragraph>
                Den som har tilgang kan endre oppsettet, publisere meldinger og gi andre
                tilgang. Det finnes ingen roller.
            </Paragraph>

            {members === null ? (
                <Paragraph>Henter …</Paragraph>
            ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {members.map((member) => (
                        <li key={member} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span>{member}{member === userEmail ? ' (deg)' : ''}</span>
                            <TertiaryButton onClick={() => handleRevoke(member)} disabled={busy}>
                                Fjern
                            </TertiaryButton>
                        </li>
                    ))}
                </ul>
            )}

            <form onSubmit={handleGrant} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 20rem' }}>
                    <TextField
                        label="Gi tilgang til"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        variant={error ? 'negative' : undefined}
                        feedback={error ?? 'E-postadressen til Entur-kontoen'}
                    />
                </div>
                <PrimaryButton type="submit" disabled={busy}>Gi tilgang</PrimaryButton>
            </form>
        </section>
    );
}

export default BoardAccess;
```

- [ ] **Step 2: Sett den inn i `BoardAdmin`, og legg til sletting**

I `src/admin/BoardAdmin.jsx`, legg til importene:

```jsx
import BoardAccess from './BoardAccess';
import BoardAlerts from './BoardAlerts';
import { deleteBoard, fetchBoard } from '../boards/boardsRepository';
```

(erstatt den eksisterende `fetchBoard`-importen med linja over).

Legg til `TertiaryButton` fra `@entur/button` og `Heading3` i `@entur/typography`-importen, og denne funksjonen inne i komponenten:

```jsx
    async function handleDelete() {
        // Sletting kan ikke angres og tar en skjerm ned. Navnet må skrives inn,
        // ikke bare bekreftes — en «er du sikker?» klikkes bort på refleks.
        const svar = window.prompt(
            `Sletter du tavla, viser skjermen som peker på /t/${boardId} «Fant ingen tavle».\n\n`
            + `Skriv tavlas navn for å bekrefte: ${state.board.name}`,
        );
        if (svar !== state.board.name) {
            return;
        }
        try {
            await deleteBoard(boardId);
            window.location.href = '/admin';
        } catch (error) {
            console.error('Kunne ikke slette tavla', error);
            window.alert('Kunne ikke slette tavla.');
        }
    }
```

og bytt ut linja `<BoardConfigForm board={state.board} userEmail={userEmail} />` med:

```jsx
            <section>
                <Heading3>Oppsett</Heading3>
                <BoardConfigForm board={state.board} userEmail={userEmail} />
            </section>
            <BoardAccess boardId={boardId} userEmail={userEmail} />
            <BoardAlerts boardId={boardId} userEmail={userEmail} />
            <section>
                <Heading3>Slett tavla</Heading3>
                <Paragraph>
                    Meldingene røres ikke — en melding som også står på andre tavler
                    blir stående der. Sletting kan ikke angres.
                </Paragraph>
                <TertiaryButton onClick={handleDelete}>Slett tavla</TertiaryButton>
            </section>
```

`BoardAlerts` finnes ikke ennå — den kommer i Task 9. Bygget er rødt til da.

- [ ] **Step 3: Commit sammen med Task 9**

Se Task 9 Step 6.

---

### Task 9: Meldinger på tavlesiden, med tavlevelger

**Files:**
- Create: `src/admin/BoardAlerts.jsx`, `src/admin/BoardPicker.jsx`
- Modify: `src/admin/AlertForm.jsx`, `src/admin/AlertList.jsx`

**Interfaces:**
- Consumes: `subscribeToBoardAlerts`, `deleteAlert`, `saveAlert` fra `alertsRepository.js`; `fetchMyBoardIds` fra `membershipsRepository.js`; `fetchBoard` fra `boardsRepository.js`.
- Produces: `<BoardAlerts boardId userEmail />`, `<BoardPicker boards selected onChange error />`; `AlertForm` med `boardId` og `boardIds`.

- [ ] **Step 1: Skriv `BoardPicker`**

Opprett `src/admin/BoardPicker.jsx`:

```jsx
import { SmallAlertBox } from '@entur/alert';
import { Checkbox } from '@entur/form';

/**
 * Hvilke tavler meldinga skal stå på.
 *
 * Lista er tavlene du har tilgang til, og bare dem — du skal ikke kunne hake av
 * noe som gir feil ved lagring. Reglene sjekker det samme på skrivesida, men det
 * er sikkerhetsnett, ikke noe brukeren skal møte.
 */
function BoardPicker({ boards, selected, onChange, error }) {
    function toggle(boardId, checked) {
        onChange(checked
            ? [...selected, boardId]
            : selected.filter((id) => id !== boardId));
    }

    return (
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Vises på</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {boards.map((board) => (
                    <Checkbox
                        key={board.id}
                        checked={selected.includes(board.id)}
                        onChange={(event) => toggle(board.id, event.target.checked)}
                    >
                        {board.name || board.id}
                    </Checkbox>
                ))}
            </div>
            {error && (
                <div style={{ marginTop: '0.5rem' }}>
                    <SmallAlertBox variant="negative">{error}</SmallAlertBox>
                </div>
            )}
        </fieldset>
    );
}

export default BoardPicker;
```

- [ ] **Step 2: Legg tavlevelgeren i `AlertForm`**

I `src/admin/AlertForm.jsx`:

1. Legg til importen:

```jsx
import BoardPicker from './BoardPicker';
```

2. Utvid `emptyDraft()` og `draftFrom()` med `boardIds`. `emptyDraft` tar nå tavla man står i:

```js
function emptyDraft(boardId) {
    return {
        id: null,
        title: '',
        body: '',
        level: 'information',
        // Nytt varsel starter «nå», så det slår ut med én gang man lagrer.
        startsAt: nativeDateToDateValue(new Date()),
        endsAt: null,
        enabled: true,
        boardIds: [boardId],
    };
}
```

og i `draftFrom(alert)`: `boardIds: alert.boardIds`.

3. Endre signaturen til `function AlertForm({ editing, boardId, boards, userEmail, onSaved, onCancel })` og initialiseringen til `useState(() => (editing ? draftFrom(editing) : emptyDraft(boardId)))`.

4. Ta med `boardIds: draft.boardIds` i `input`-objektet i `handleSubmit`.

5. Legg velgeren inn i skjemaet, rett over `Switch`-en for «Aktiv»:

```jsx
            <BoardPicker
                boards={boards}
                selected={draft.boardIds}
                onChange={(boardIds) => update('boardIds', boardIds)}
                error={errors.boardIds}
            />
            {draft.boardIds.length > 1 && (
                <SmallAlertBox variant="information">
                    Denne meldinga står på {draft.boardIds.length} tavler. Endrer du den her,
                    endres den alle stedene.
                </SmallAlertBox>
            )}
```

- [ ] **Step 3: La `AlertList` vise hvilke andre tavler en melding står på**

I `src/admin/AlertList.jsx`:

1. Bytt importen `subscribeToAllAlerts` til `subscribeToBoardAlerts`, og signaturen til `function AlertList({ boardId, boards, onEdit })`.

2. Bytt abonnementet:

```jsx
    useEffect(() => subscribeToBoardAlerts(boardId, setAlerts, (error) => {
        console.error('Kunne ikke hente varsler', error);
        setAlerts([]);
    }), [boardId]);
```

3. Legg en kolonne til i tabellen som sier hvor ellers meldinga står. Legg denne hjelperen øverst i filen:

```jsx
/** «Også på Oslo, Trondheim» — eller tom tekst når meldinga bare står her. */
function elsewhere(alert, boardId, boards) {
    const others = alert.boardIds.filter((id) => id !== boardId);
    if (others.length === 0) {
        return '';
    }
    const names = others.map((id) => boards.find((board) => board.id === id)?.name ?? id);
    return `Også på ${names.join(', ')}`;
}
```

og bruk den i en ny `DataCell` per rad, med en `HeaderCell` som heter «Andre tavler».

- [ ] **Step 4: Skriv `BoardAlerts`**

Opprett `src/admin/BoardAlerts.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { PrimaryButton } from '@entur/button';
import { Heading3 } from '@entur/typography';

import AlertForm from './AlertForm';
import AlertList from './AlertList';
import { fetchMyBoardIds } from '../access/membershipsRepository';
import { fetchBoard } from '../boards/boardsRepository';

/** Meldingene på én tavle, med skjema som kan publisere til flere. */
function BoardAlerts({ boardId, userEmail }) {
    const [boards, setBoards] = useState([]);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);

    // Tavlene du kan publisere til: dine egne. Hentes én gang — lista endrer
    // seg sjelden, og skjemaet skal ikke få valgene byttet mens man står i det.
    useEffect(() => {
        let current = true;
        fetchMyBoardIds(userEmail)
            .then((ids) => Promise.all(ids.map((id) => fetchBoard(id))))
            .then((loaded) => {
                if (current) setBoards(loaded.filter(Boolean));
            })
            .catch((error) => console.error('Kunne ikke hente tavlene dine', error));
        return () => {
            current = false;
        };
    }, [userEmail]);

    function close() {
        setFormOpen(false);
        setEditing(null);
    }

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Heading3>Meldinger</Heading3>
            <SmallAlertBox variant="information" title="Meldingene er offentlig lesbare">
                Tavla henter meldingene uten pålogging, så de kan leses av hvem som helst som
                finner adressen. Ikke skriv sensitiv eller intern-klassifisert informasjon her.
            </SmallAlertBox>

            {formOpen ? (
                <AlertForm
                    editing={editing}
                    boardId={boardId}
                    boards={boards}
                    userEmail={userEmail}
                    onSaved={close}
                    onCancel={close}
                />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'flex-start' }}>
                    <PrimaryButton onClick={() => { setEditing(null); setFormOpen(true); }}>
                        Ny melding
                    </PrimaryButton>
                    <AlertList
                        boardId={boardId}
                        boards={boards}
                        onEdit={(alert) => { setEditing(alert); setFormOpen(true); }}
                    />
                </div>
            )}
        </section>
    );
}

export default BoardAlerts;
```

- [ ] **Step 5: Verifiser mot emulatoren**

Start emulatoren og `yarn dev`. Logg inn (se README om Auth-emulatoren). Gjør deretter dette i rekkefølge:

1. `/admin` → «Du har ikke tilgang til noen tavler ennå» og en «Ny tavle»-knapp.
2. Opprett en tavle «Bergen 3. etasje» → id-forslaget blir `bergen-3-etasje`, og du havner på tavlesiden. **Dette tester bootstrap-trikset** — går det galt, får du en tavle du ikke kan redigere.
3. Tilbake til `/admin` → tavla står i lista.
4. Opprett en tavle til, «Oslo». Nå har du to.
5. På Bergen-tavla: legg inn en melding, huk av begge tavlene → lagres uten feil, og skjemaet sier at den står på to tavler.
6. Gå til Oslo-tavla → samme melding står i lista, med «Også på Bergen 3. etasje».
7. Åpne `/t/oslo` og `/t/bergen-3-etasje` → meldinga står på begge.
8. På Bergen-tavla: fjern avkryssingen for Oslo og lagre → meldinga forsvinner fra Oslo-tavla.
9. Prøv å fjerne deg selv fra tilgang når du er den eneste → sperren slår inn med melding.
10. Gi `kollega@entur.org` tilgang → adressen dukker opp i lista. Fjern den igjen.
11. Skriv `noen@example.com` i tilgangsfeltet → «Adressen må være en @entur.org-adresse».
12. Slett Oslo-tavla: skriv navnet når den spør → du havner på `/admin`, og tavla er borte fra lista. Åpne `/t/oslo` → «Fant ingen tavle». Meldinga som sto på begge skal fortsatt stå på Bergen-tavla.

- [ ] **Step 6: Bygg, test og commit Task 8 + 9**

Run: `yarn test && yarn test:rules && yarn build`
Expected: alle tre grønne.

```bash
git add src/admin/BoardAccess.jsx src/admin/BoardAlerts.jsx src/admin/BoardPicker.jsx src/admin/BoardAdmin.jsx src/admin/AlertForm.jsx src/admin/AlertList.jsx
git commit -m "feat: tilgangsside og meldinger per tavle i admin"
```

---

### Task 10: Migrering, CI og dokumentasjon

**Files:**
- Modify: `.github/workflows/deploy.yml`, `README.md`

**Interfaces:**
- Consumes: alt fra Task 1–9.
- Produces: regeltester i CI, migrerte data i produksjon, oppdatert README.

**Rekkefølgen er kritisk.** Reglene og appen deployes i samme kjøring ved push til `main`. Skjer merge før stegene under, mister alle med tilgang den, og meldingene forsvinner fra tavla.

- [ ] **Step 1: Legg regeltestene inn i CI**

I `.github/workflows/deploy.yml`, legg inn et Java-steg og et regeltest-steg mellom «Test» og «Build»:

```yaml
      - name: Set up Java (Firestore-emulatoren krever JVM)
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'

      - name: Test Firestore rules
        run: yarn test:rules
```

Legg også `firestore.rules.spec.mjs` til i `paths`-lista øverst, slik at en endring i regeltestene alene trigger kjøringen:

```yaml
      - firestore.rules.spec.mjs
```

- [ ] **Step 2: Migrer produksjonsdataene — før merge**

Krever `roles/datastore.user` på `ent-tavleber-prd` og et gyldig `gcloud`-token (`gcloud auth login` hvis det er utløpt).

Først: sett `boardIds` på meldingene som finnes. Uten dette forsvinner de fra tavla i det øyeblikket fase 2 er ute.

```bash
BASE='https://firestore.googleapis.com/v1/projects/ent-tavleber-prd/databases/(default)/documents'
TOKEN=$(gcloud auth print-access-token)

curl -s -H "Authorization: Bearer $TOKEN" "$BASE/alerts" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
      const docs=(JSON.parse(s).documents||[]);
      console.log(docs.length + ' meldinger:');
      docs.forEach(d=>console.log('  ' + d.name.split('/').pop() + '  boardIds=' + JSON.stringify(d.fields.boardIds||null)));
    })"
```

For hver melding som mangler `boardIds`, sett feltet med en PATCH som **bare** rører det feltet (`updateMask` er avgjørende — uten den erstattes hele dokumentet):

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X PATCH \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  "$BASE/alerts/<MELDINGS-ID>?updateMask.fieldPaths=boardIds" \
  -d '{"fields":{"boardIds":{"arrayValue":{"values":[{"stringValue":"bergen-3"}]}}}}'
```

Deretter: gi dagens `admins` tilgang til `bergen-3`. Uten dette mister de tilgangen.

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/admins" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
      (JSON.parse(s).documents||[]).forEach(d=>console.log(d.name.split('/').pop()));
    })"
```

For hver adresse i lista:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X PATCH \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  "$BASE/memberships/<E-POST>" \
  -d '{"fields":{"boards":{"arrayValue":{"values":[{"stringValue":"bergen-3"}]}}}}'
```

Kontroller til slutt at hver adresse fikk oppføringen sin, og at ingen melding står uten `boardIds`. Begge kommandoene over kan kjøres på nytt for å bekrefte.

- [ ] **Step 3: Oppdater README**

I `README.md`, erstatt hele underavsnittet «Pålogging og tilgang» med:

```markdown
### Pålogging og tilgang

`/admin` krever innlogging med Google. Siden Entur bruker Google Workspace er
det Entur-kontoen din. Både admin-siden og Firestore-reglene krever en
verifisert `@entur.org`-adresse.

**Tilgang gis per tavle, ikke globalt.** Enhver Entur-konto kan logge inn og
opprette sin egen tavle. Den som oppretter en tavle får tilgang til den, og kan
gi andre tilgang fra tavlesiden i admin.

Tilgang er tilgang: den som har den kan endre oppsettet, publisere meldinger og
gi andre tilgang. Det finnes ingen roller. Den siste med tilgang kan ikke fjerne
seg selv — da måtte tavla vært ordnet i Firebase-konsollet.

Tilgang lagres i collectionen `memberships`, med ett dokument per person og
dokument-id lik e-postadressen i **små bokstaver**. Dokumentet inneholder en
liste `boards` med tavle-id-ene personen har tilgang til.

> At tilgang ligger per bruker og ikke som en medlemsliste på tavla er ikke
> tilfeldig. En melding kan gjelde flere tavler, og reglene må avgjøre om *alle*
> tavlene i lista er dine. Med tilgang per bruker er det ett oppslag og én
> `hasOnly`. Med en medlemsliste per tavle måtte reglene iterert over lista, og
> det kan de ikke.

Har alle med tilgang til en tavle sluttet, må noen med Firebase-konsolltilgang
legge inn en ny oppføring i `memberships` for hånd.
```

Legg til et nytt underavsnitt rett etter «Meldingene er offentlig lesbare»:

```markdown
### Én melding, flere tavler

En melding har feltet `boardIds` — lista over tavlene den skal stå på. Publiserer
du den samme meldinga på tre tavler, er det **én** melding: endrer du teksten,
endres den alle stedene. Skjemaet viser bare tavlene du har tilgang til.

Reglene sjekker `boardIds` både før og etter en endring. Uten sjekken på den
gamle lista kunne man tatt en melding som står på to tavler, fjernet den ene fra
lista og skrevet om teksten — altså avpublisert fra en tavle man ikke har
tilgang til.
```

Erstatt til slutt underavsnittet «Tester» sin siste setning om at reglene ikke er dekket, med:

```markdown
Firestore-reglene har egne tester:

```bash
yarn test:rules
```

De kjøres mot Firestore-emulatoren (krever Java) via `firebase emulators:exec`,
og ligger i `firestore.rules.spec.mjs`. Filnavnet slutter bevisst på
`.rules.spec.mjs` og ikke `.test.mjs`, slik at `node --test` ikke plukker dem opp
under vanlige `yarn test` — de ville feilet uten emulator. CI kjører begge.
```

Oppdater også kommandoen for lokal utvikling som legger deg selv i `admins` — den skal nå legge deg i `memberships`:

```bash
curl -s -X POST -H 'Authorization: Bearer owner' -H 'Content-Type: application/json' \
  'http://127.0.0.1:8080/v1/projects/ent-tavleber-prd/databases/(default)/documents/memberships?documentId=din.adresse@entur.org' \
  -d '{"fields":{"boards":{"arrayValue":{"values":[{"stringValue":"bergen-3"}]}}}}'
```

Nevn samtidig at man ikke *må* gjøre dette lenger: man kan logge inn og opprette sin egen tavle.

- [ ] **Step 4: Kjør alt**

Run: `yarn test && yarn test:rules && yarn build`
Expected: alle tre grønne.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy.yml README.md
git commit -m "docs: tilgang per tavle, og regeltester i CI"
```

- [ ] **Step 6: Merge og verifiser i produksjon**

Etter merge og fullført deploy:

1. Åpne produksjons-URL-en på `/` → Bergen-tavla skal se ut som før, med meldingene sine.
2. Åpne `/admin` → tavla skal stå i «Dine tavler».
3. Åpne tavlesiden → tilgangslista skal vise dem som sto i `admins`.
4. Skjermen i resepsjonen skal være uendret. **Ikke** last den på nytt for å sjekke.

- [ ] **Step 7: Slett `admins` — etter at alt er verifisert**

Først når stegene over er bekreftet:

```bash
BASE='https://firestore.googleapis.com/v1/projects/ent-tavleber-prd/databases/(default)/documents'
TOKEN=$(gcloud auth print-access-token)
# Slett ett dokument per adresse som ble listet i Step 2
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE \
  -H "Authorization: Bearer $TOKEN" "$BASE/admins/<E-POST>"
```

Reglene avviser allerede all tilgang til `admins`, så collectionen er død kode i databasen fra og med deploy. Slettingen er opprydding, ikke en forutsetning — og den er lettere å angre hvis den gjøres sist.

---

## Etter fase 2

Fase 3 står igjen: `departures`-modulen mot Entur-APIene — stoppested, antall avganger, transportmidler og avviksinfo. Katalogen i `boardConfig.js` har allerede plassen; modulen finnes ikke.

Ikke bygg avgangsmodulen inn i fase 2 «siden vi likevel er i filen».
