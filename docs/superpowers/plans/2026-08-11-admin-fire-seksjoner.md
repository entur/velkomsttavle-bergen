# Admin-skjemaet delt i fire seksjoner — implementasjonsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dele oppsettskjemaet i admin i fire innrammede seksjoner som speiler de fire feltene på tavla, med én identisk fargevelger per seksjon som viser både navn og farge, kort for karusellmodulene, og én nedtrekksmeny for bunnstripa.

**Architecture:** `theme` med to verdier erstattes av `topSurface` og `middleSurface` fra den eksisterende seks-fargepaletten i `src/boards/surfaces.js`, slik at alle fire feltene har samme form og alle fire velgerne er samme komponent. `BoardConfigForm` blir en tynn ramme rundt fire seksjonskomponenter; draft-logikken flyttes til `src/boards/boardDraft.js` der `node --test` kan nå den.

**Tech Stack:** React 19, Vite 8, Firebase/Firestore, `@entur/*` designsystem, `node --test` for enhetstester, Firestore-emulatoren for regeltester.

Spec: [docs/superpowers/specs/2026-08-11-admin-fire-seksjoner-design.md](../specs/2026-08-11-admin-fire-seksjoner-design.md)

## Global Constraints

- **Kildekoden må holde seg innenfor nettleser-grensa.** Tavla kjører på en Samsung-skjerm med Tizen, eldre enn Chromium 93. `src/browserBaseline.test.mjs` håndhever det over all kildekode. Konkret: ikke `Object.hasOwn`, ikke `Array.prototype.at`, ikke `structuredClone`. `Array.prototype.includes` (ES2016) er greit.
- **Ingen nye avhengigheter.** `@entur/dropdown` skal ikke legges til. Designsystemet har ingen dropdown, og bunnstripa bruker et vanlig `<select>`.
- **Norsk i kode og tester.** Kommentarer, testnavn og brukertekst er på norsk, som resten av repoet. Kommentarer forklarer *hvorfor*, ikke *hva*.
- **Flatenavnene er ASCII-slugs uten æøå:** `morkebla`, `morkebla-lys`, `lavendel`, `lys-lavendel`, `hvit`, `fersken`. De lagres som verdier i Firestore og gjentas i `firestore.rules`, som ikke kan importere.
- **`node_modules` er tom i denne worktreen.** Kjør `yarn install --ignore-engines` før første test — uten `--ignore-engines` feiler installasjonen på Node-versjonen i dette repoet. Uten install feiler `test:rules` misvisende på alt.
- **Firestore-regler avgjøres mot emulatoren, ikke ved øyemål.** Hver regelendring verifiseres med `yarn test:rules`.
- **`npm run build` er en del av gaten.** Ingen av JSX-filene har enhetstester — repoet har ingen komponent-rendering i testene — så bygget og en manuell sjekk er det som dekker dem.
- **Grenen er ikke deploybar mellom Task 1 og Task 12.** Task 1 fjerner `config.theme`, og admin-skjemaet får den tilbake først i Task 12. Det er greit på en refaktoreringsgren, men ikke deploy fra midten.

### Fargeverdiene, hentet fra `@entur/tokens`

Disse brukes ordrett flere steder i planen:

| Bruk | Token | Verdi |
|---|---|---|
| Mørk blå flate | `base.light.baseColors.frame.contrast` | `#181c56` |
| Lavendel flate | `colors.brand.lavender` | `#aeb7e2` |
| Valgt fargeprøve, kantlinje | `base.light.baseColors.stroke.default` | `#181c56` |
| Uvalgt fargeprøve, kantlinje | `base.light.baseColors.stroke.subdued` | `#8284ab` |
| Seksjonsramme | `base.light.baseColors.stroke.subduedalt` | `#e3e6e8` |

---

### Task 0: Sett opp worktreen

**Files:** ingen endringer

- [ ] **Step 1: Installer avhengigheter**

Run: `yarn install --ignore-engines`
Expected: fullfører uten feil, `node_modules/` fylles.

- [ ] **Step 2: Verifiser at utgangspunktet er grønt**

Run: `npm test`
Expected: PASS, alle tester grønne.

- [ ] **Step 3: Verifiser at regeltestene er grønne**

Run: `npm run test:rules`
Expected: PASS. Krever Java og at port 8080 er ledig.

- [ ] **Step 4: Verifiser at bygget er grønt**

Run: `npm run build`
Expected: PASS.

Ingen commit — dette er bare et utgangspunkt å måle mot.

---

### Task 1: `topSurface` og `middleSurface` i datamodellen

**Files:**
- Modify: `src/boards/boardConfig.js`
- Test: `src/boards/boardConfig.test.mjs`

**Interfaces:**
- Consumes: `SURFACES` fra `src/boards/surfaces.js` (finnes fra før)
- Produces: `normalizeBoardConfig(id, data)` returnerer nå `topSurface` og `middleSurface` (strenger fra `SURFACES`) i stedet for `theme`. `toFirestoreBoard(config, userEmail)` skriver de to feltene og ikke `theme`. Ny eksport `MODULE_LABELS` (objekt: modultype → norsk etikett). `THEMES` og `DEFAULT_THEME` finnes ikke lenger.

- [ ] **Step 1: Skriv de feilende testene**

I `src/boards/boardConfig.test.mjs`: fjern `THEMES` fra import-lista øverst (linje 4–11), slett `describe('THEMES', ...)` (linje 240–244) og de to testene `'faller på det mørke temaet når theme mangler eller er ukjent'` og `'godtar det lyse temaet'` (linje 98–106). Endre linje 234 fra `assert.equal(data.theme, 'dark');` til `assert.equal(data.topSurface, 'morkebla');`.

Legg til øverst i import-lista:

```js
import {
    BOTTOM_TYPES,
    MODULE_LABELS,
    boardHeading,
    findModule,
    normalizeBoardConfig,
    toFirestoreBoard,
} from './boardConfig.js';
```

Legg så til dette nye `describe`-blokket rett etter `describe('flater', ...)`-blokket som slutter på linje 346:

```js
describe('flatene på toppen og i midten', () => {
    it('migrerer fra theme begge veier', () => {
        const mork = normalizeBoardConfig('x', { theme: 'dark' });
        assert.equal(mork.topSurface, 'morkebla');
        assert.equal(mork.middleSurface, 'morkebla');

        const lys = normalizeBoardConfig('x', { theme: 'light' });
        assert.equal(lys.topSurface, 'lavendel');
        assert.equal(lys.middleSurface, 'lavendel');
    });

    it('leser flatenavnene når de finnes', () => {
        const config = normalizeBoardConfig('x', {
            topSurface: 'fersken',
            middleSurface: 'hvit',
        });
        assert.equal(config.topSurface, 'fersken');
        assert.equal(config.middleSurface, 'hvit');
    });

    it('lar de nye feltene vinne over theme, hvert for seg', () => {
        const config = normalizeBoardConfig('x', {
            theme: 'light',
            topSurface: 'fersken',
        });
        assert.equal(config.topSurface, 'fersken');
        // middleSurface har ikke noe eget felt og skal fortsatt følge theme.
        assert.equal(config.middleSurface, 'lavendel');
    });

    it('faller på mørkeblå uten felt og for ukjente navn', () => {
        assert.equal(normalizeBoardConfig('x', {}).topSurface, 'morkebla');
        assert.equal(normalizeBoardConfig('x', {}).middleSurface, 'morkebla');
        assert.equal(normalizeBoardConfig('x', { topSurface: 'lilla' }).topSurface, 'morkebla');
        // Et theme-navn som aldri fantes i den to-verdis lista skal falle til
        // standarden, ikke lekke gjennom.
        assert.equal(normalizeBoardConfig('x', { theme: 'sunset' }).topSurface, 'morkebla');
    });

    it('slutter å eksponere theme', () => {
        assert.equal(normalizeBoardConfig('x', { theme: 'dark' }).theme, undefined);
    });

    it('skriver de nye feltene og ikke det gamle', () => {
        const config = normalizeBoardConfig('x', {
            name: 'Tavla', placeName: 'Bergen', theme: 'light',
        });
        const document = toFirestoreBoard(config, 'ola@entur.org');
        assert.equal(document.topSurface, 'lavendel');
        assert.equal(document.middleSurface, 'lavendel');
        assert.equal('theme' in document, false);
    });
});

describe('MODULE_LABELS', () => {
    it('har en etikett for hver modultype i alle tre katalogene', () => {
        for (const type of ['greeting', 'openingHours', 'weather', 'floorplan', 'departures']) {
            assert.equal(typeof MODULE_LABELS[type], 'string', type);
            assert.ok(MODULE_LABELS[type].length > 0, type);
        }
    });
});
```

- [ ] **Step 2: Kjør testene for å se dem feile**

Run: `node --test src/boards/boardConfig.test.mjs`
Expected: FAIL. `MODULE_LABELS` er `undefined`, og `topSurface` er `undefined`.

- [ ] **Step 3: Endre `boardConfig.js`**

Erstatt linje 22–23 (kommentaren om `boardTheme.js` og `export const THEMES`) med etikett-katalogen:

```js
/** Navnene modulene har i admin. Katalogen og etikettene hører sammen. */
export const MODULE_LABELS = {
    greeting: 'Hilsen',
    openingHours: 'Åpningstider',
    weather: 'Været',
    floorplan: 'Plantegning',
    departures: 'Avgangstider',
};
```

Slett `const DEFAULT_THEME = 'dark';` (linje 58).

I `normalizeBoardConfig`, bytt linje 66 (`theme: THEMES.includes(...)`) med:

```js
        topSurface: bandSurfaceFrom(source, 'topSurface'),
        middleSurface: bandSurfaceFrom(source, 'middleSurface'),
```

Legg til denne funksjonen rett etter `carouselSurfaceFrom` (etter linje 107):

```js
/**
 * Flaten toppen eller midten står på.
 *
 * Samme mønster som `carouselSurfaceFrom`: nytt felt først, gammel plassering
 * som fallback. Dokumenter skrevet før flatetabellen har `theme` med to
 * verdier, og de to verdiene ER to av de seks flatene — samme token, ikke en
 * tilnærming — så en tavle ser identisk ut etter oppgraderingen.
 *
 * De to feltene leses hver for seg, ikke som ett valg: to seksjoner med egen
 * fargevelger er hele poenget med endringen.
 */
const THEME_TO_SURFACE = { dark: 'morkebla', light: 'lavendel' };
const DEFAULT_BAND_SURFACE = 'morkebla';

function bandSurfaceFrom(source, field) {
    if (SURFACES.includes(source[field])) {
        return source[field];
    }
    return THEME_TO_SURFACE[source.theme] ?? DEFAULT_BAND_SURFACE;
}
```

I `toFirestoreBoard`, bytt linje 137 (`theme: config.theme,`) med:

```js
        topSurface: config.topSurface,
        middleSurface: config.middleSurface,
```

- [ ] **Step 4: Kjør testene for å se dem passere**

Run: `node --test src/boards/boardConfig.test.mjs`
Expected: PASS.

- [ ] **Step 5: Sjekk at ingenting andre steder importerer `THEMES`**

Run: `grep -rn "THEMES\|DEFAULT_THEME" src/`
Expected: ingen treff.

- [ ] **Step 6: Commit**

```bash
git add src/boards/boardConfig.js src/boards/boardConfig.test.mjs
git commit -m "Toppen og midten får hver sin flate fra seks-paletten

theme erstattes av topSurface og middleSurface. Migreringen er
fargeriktig: dark er morkebla og light er lavendel, samme token, så
eksisterende tavler ser identiske ut etter oppgraderingen."
```

---

### Task 2: `logoSrcFor` erstatter `bandTheme`

**Files:**
- Modify: `src/boards/boardTheme.js`
- Test: `src/boards/boardTheme.test.mjs`

**Interfaces:**
- Produces: `logoSrcFor(mode)` → `'/logo.svg'` for `'dark'`, `'/logo-on-light.svg'` ellers. `bandTheme` finnes ikke lenger.

- [ ] **Step 1: Skriv den feilende testen**

Erstatt hele innholdet i `src/boards/boardTheme.test.mjs`:

```js
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
```

- [ ] **Step 2: Kjør testen for å se den feile**

Run: `node --test src/boards/boardTheme.test.mjs`
Expected: FAIL, `logoSrcFor is not a function`.

- [ ] **Step 3: Erstatt `boardTheme.js`**

Hele fila:

```js
/**
 * Logofila et felt skal bruke, gitt modusen flaten har.
 *
 * public/logo.svg er hvit og koral og hører til mørke flater;
 * public/logo-on-light.svg har mørkeblått ordmerke og hører til lyse. Den siste
 * lå der fra før, for admin-sidene.
 *
 * Bakgrunn, tekstfarge og Contrast-valget kom tidligere herfra også. De kommer
 * nå fra `surfacePalette()`, som bærer `mode` for hver av de seks flatene.
 * Logoen er det eneste et felt trenger som ikke kan leses ut av paletten.
 */
export function logoSrcFor(mode) {
    return mode === 'light' ? '/logo-on-light.svg' : '/logo.svg';
}
```

- [ ] **Step 4: Kjør testen for å se den passere**

Run: `node --test src/boards/boardTheme.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/boards/boardTheme.js src/boards/boardTheme.test.mjs
git commit -m "boardTheme krymper til logovalget

Bakgrunn, tekstfarge og Contrast-valget kommer nå fra surfacePalette,
som alt bærer mode. Igjen står logoen, som ikke kan leses ut av paletten."
```

---

### Task 3: `TopBand` og `MiddleBand` tar `palette`

**Files:**
- Modify: `src/components/TopBand.jsx`
- Modify: `src/components/MiddleBand.jsx:33-46,75`
- Modify: `src/App.jsx:49-50,132-142`

**Interfaces:**
- Consumes: `logoSrcFor(mode)` fra Task 2, `topSurface`/`middleSurface` fra Task 1, `surfacePalette(name)` (finnes fra før, returnerer `{ name, mode, background, text, accent }`)
- Produces: `<TopBand kind palette />` og `<MiddleBand palette ... />`. Ingen komponent tar `theme` lenger.

Ingen enhetstester her — repoet rendrer ikke komponenter i tester. `npm run build` og den manuelle sjekken i Task 13 er gaten.

- [ ] **Step 1: Endre `TopBand.jsx`**

Erstatt linje 1–2 og 18–19, og rett doc-kommentaren som snakker om «temaet»:

```jsx
import LoopingVideo from './LoopingVideo';
import { logoSrcFor } from '../boards/boardTheme';

/** Toppfeltet er 40vh i begge variantene, så resten av layouten ikke flytter seg. */
const SIZE = { width: '100vw', height: '40vh' };

/**
 * Toppen av tavla: enten intro-videoen eller Entur-logoen.
 *
 * Logofila følger flatens modus: den hvite og korale logoen på mørke flater,
 * den fargede på lyse.
 *
 * Videoen dekker hele feltet, så bakgrunnen bak den vises bare når videoen ikke
 * kan spilles av. Den følger likevel flaten, slik at fallbacket ikke blir
 * mørkeblått på en lys tavle.
 */
function TopBand({ kind, palette }) {
    const band = { ...SIZE, backgroundColor: palette.background };

    if (kind === 'logo') {
        return (
            <div style={{ ...band, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={logoSrcFor(palette.mode)} alt="Entur" style={{ maxHeight: '50%', maxWidth: '60%' }} />
            </div>
        );
    }
    return <LoopingVideo src="/entur.mp4" style={{ ...band, display: 'block', objectFit: 'cover' }} />;
}

export default TopBand;
```

- [ ] **Step 2: Endre `MiddleBand.jsx`**

Slett `import { bandTheme } from '../boards/boardTheme';` (linje 7). Bytt signaturen og de to første linjene i kroppen (linje 33–34):

```jsx
function MiddleBand({ palette, boardId, heading, greetingText, openingHoursDays, staffImageSrc, hasCarousel, hasBottom }) {
    const style = {
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        backgroundColor: palette.background,
        color: palette.text,
        flexDirection: 'column',
        padding: '1.5rem 0',
        overflow: 'hidden',
        ...middleHeight(hasCarousel, hasBottom),
    };
```

Bytt returlinja (linje 75):

```jsx
    return palette.mode === 'dark'
        ? <Contrast style={style}>{content}</Contrast>
        : <div style={style}>{content}</div>;
```

Rett også avsnittet i doc-kommentaren (linje 17–18) som sier «Det lyse temaet dropper `<Contrast>`-wrapperen» til å snakke om lyse flater:

```
 * Lyse flater dropper <Contrast>-wrapperen. Den setter både bakgrunn og hvit
 * tekstfarge, og uten den finner typografien Entur-blå selv.
```

- [ ] **Step 3: Endre `App.jsx`**

Legg til de to palettene ved linje 49–50, slik at alle fire står sammen:

```jsx
    const topPalette = config ? surfacePalette(config.topSurface) : null;
    const middlePalette = config ? surfacePalette(config.middleSurface) : null;
    const carouselPalette = config ? surfacePalette(config.carouselSurface) : null;
    const bottomPalette = config ? surfacePalette(config.bottomSurface) : null;
```

Bytt linje 132 og 134:

```jsx
            <TopBand kind={config.top.kind} palette={topPalette} />
            <MiddleBand
                palette={middlePalette}
```

- [ ] **Step 4: Sjekk at ingen `theme`-prop er igjen på de to feltene**

Run: `grep -n "theme" src/App.jsx src/components/TopBand.jsx src/components/MiddleBand.jsx`
Expected: ingen treff.

- [ ] **Step 5: Kjør bygget og hele testsuiten**

Run: `npm test && npm run build`
Expected: PASS. `browserBaseline.test.mjs` må fortsatt være grønn.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/components/TopBand.jsx src/components/MiddleBand.jsx
git commit -m "Toppen og midten rendres fra sin egen palett

Samme mønster som Weather, Departures og OfficeMap alt bruker: feltet
får en palett inn, og leser mode for logo og Contrast-wrapper."
```

---

### Task 4: `firestore.rules` godtar de to nye flatefeltene

**Files:**
- Modify: `firestore.rules:52-71`
- Test: `firestore.rules.spec.mjs:127-155`

**Interfaces:**
- Produces: regel-funksjonen `isSurface(v)`, og `isValidBoard` som godtar valgfrie `topSurface`/`middleSurface` og et valgfritt `theme`.

- [ ] **Step 1: Skriv de feilende testene**

I `firestore.rules.spec.mjs`, **inverter** den eksisterende testen på linje 131–134. Den het `'avviser en tavle uten tema'` og blir nå gal — `theme` skal være valgfritt, ellers avvises hver ny tavle. Erstatt den med:

```js
    // theme er erstattet av topSurface/middleSurface. Feltet må være valgfritt:
    // createBoard skriver uten merge, så en ny tavle har det ikke.
    it('godtar en tavle uten tema', async () => {
        const { theme, ...utenTema } = board();
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'boards/ny-tavle'), {
            ...utenTema,
            topSurface: 'morkebla',
            middleSurface: 'morkebla',
        }));
    });
```

La testene `'avviser en tavle med ukjent tema'` (linje 127–129) og `'godtar det lyse temaet'` (linje 140–142) stå — de skal fortsatt passere, siden klausulen validerer feltet når det finnes.

Legg til disse tre rett etter `'avviser ukjent flatenavn'` (som slutter på linje 191):

```js
    it('godtar de to nye flatefeltene', async () => {
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({
            topSurface: 'fersken',
            middleSurface: 'lys-lavendel',
        }), { merge: true }));
    });

    it('avviser ukjent flatenavn på toppen og i midten', async () => {
        await assertFails(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({
            topSurface: 'lilla',
        }), { merge: true }));
        await assertFails(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({
            middleSurface: 'lilla',
        }), { merge: true }));
    });

    // Gamle dokumenter beholder theme fordi saveBoardConfig skriver med merge.
    // Klausulen for feltet må bli stående — men valgfri.
    it('godtar en tavle som har både theme og de nye flatene', async () => {
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({
            theme: 'dark',
            topSurface: 'fersken',
            middleSurface: 'fersken',
        }), { merge: true }));
    });
```

- [ ] **Step 2: Kjør regeltestene for å se dem feile**

Run: `npm run test:rules`
Expected: FAIL. `'godtar en tavle uten tema'` og `'avviser ukjent flatenavn på toppen og i midten'` feiler — den første fordi `theme` fortsatt er påkrevd, den andre fordi `topSurface` ikke valideres i det hele tatt.

- [ ] **Step 3: Endre `firestore.rules`**

Legg til `isSurface` rett før `function isValidBoard(d)` (før linje 52):

```
    // Flatenavnene står også i src/boards/surfaces.js. Regler kan ikke
    // importere, så lista finnes to steder — her og der — og må endres på
    // begge samtidig. Samme duplisering som top.kind allerede har. Uten denne
    // funksjonen sto lista fire ganger i isValidBoard.
    function isSurface(v) {
      return v in ['morkebla', 'morkebla-lys', 'lavendel', 'lys-lavendel', 'hvit', 'fersken'];
    }
```

Erstatt `isValidBoard`-kroppen (linje 53–71) med:

```
    function isValidBoard(d) {
      return d.name is string && d.name.size() > 0 && d.name.size() <= 60
        && d.placeName is string && d.placeName.size() > 0 && d.placeName.size() <= 40
        // theme er erstattet av topSurface/middleSurface. Klausulen må være
        // valgfri, ellers avvises hver ny tavle — createBoard skriver uten
        // merge, så feltet er ikke der. Og den må bli stående, ellers avvises
        // hver lagring på en tavle som har feltet fra før.
        && (!d.keys().hasAny(['theme']) || d.theme in ['dark', 'light'])
        && d.staffImage is bool
        && d.top is map && d.top.kind in ['video', 'logo']
        && (!d.keys().hasAny(['carouselTheme']) || d.carouselTheme in ['light', 'dark'])
        && (!d.keys().hasAny(['topSurface']) || isSurface(d.topSurface))
        && (!d.keys().hasAny(['middleSurface']) || isSurface(d.middleSurface))
        && (!d.keys().hasAny(['carouselSurface']) || isSurface(d.carouselSurface))
        && (!d.keys().hasAny(['bottomSurface']) || isSurface(d.bottomSurface))
        && (!d.keys().hasAny(['bottom']) || (d.bottom is list && d.bottom.size() <= 5))
        && d.middle is list && d.middle.size() <= 5
        && d.carousel is list && d.carousel.size() <= 5
        && d.updatedBy == callerEmail();
    }
```

- [ ] **Step 4: Kjør regeltestene for å se dem passere**

Run: `npm run test:rules`
Expected: PASS, alle regeltester grønne.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules firestore.rules.spec.mjs
git commit -m "Reglene godtar topSurface og middleSurface

theme blir valgfritt: en ny tavle skrives uten det, og gamle dokumenter
beholder det fordi saveBoardConfig skriver med merge. Flatelista trekkes
ut i isSurface, så den ikke står fire ganger."
```

---

### Task 5: Valideringen dekker alle fire flatene

**Files:**
- Modify: `src/boards/boardValidation.js:75-81`
- Test: `src/boards/boardValidation.test.mjs:36-37,222-231`

**Interfaces:**
- Produces: `validateBoardInput(draft)` setter feilnøklene `topSurface`, `middleSurface`, `carouselSurface`, `bottomSurface`.

- [ ] **Step 1: Skriv de feilende testene**

I `validDraft()` i `src/boards/boardValidation.test.mjs`, legg til de to nye feltene ved linje 36–37:

```js
        topSurface: 'morkebla',
        middleSurface: 'morkebla',
        carouselSurface: 'lys-lavendel',
        bottomSurface: 'morkebla',
```

Utvid testen som i dag sjekker to felt (linje 222–223) til alle fire, og loopen under (linje 229–231):

```js
        assert.ok(validateBoardInput(draft({ topSurface: 'lilla' })).topSurface);
        assert.ok(validateBoardInput(draft({ middleSurface: 'lilla' })).middleSurface);
        assert.ok(validateBoardInput(draft({ carouselSurface: 'lilla' })).carouselSurface);
        assert.ok(validateBoardInput(draft({ bottomSurface: 'lilla' })).bottomSurface);
```

```js
        for (const surface of SURFACES) {
            assert.deepEqual(validateBoardInput(draft({ topSurface: surface })), {}, surface);
            assert.deepEqual(validateBoardInput(draft({ middleSurface: surface })), {}, surface);
            assert.deepEqual(validateBoardInput(draft({ carouselSurface: surface })), {}, surface);
            assert.deepEqual(validateBoardInput(draft({ bottomSurface: surface })), {}, surface);
        }
```

- [ ] **Step 2: Kjør testene for å se dem feile**

Run: `node --test src/boards/boardValidation.test.mjs`
Expected: FAIL — `topSurface`-feilen settes ikke.

- [ ] **Step 3: Endre `boardValidation.js`**

Erstatt de to `if`-ene på linje 75–81 med en løkke, og legg tabellen rett over `validateBoardInput`:

```js
/**
 * Flatefeltene og meldingen hvert av dem får. Fire felt med samme sjekk, så
 * sjekken skrives én gang.
 *
 * Feilene er i praksis uoppnåelige gjennom skjemaet, siden fargevelgeren bare
 * tilbyr gyldige verdier. De står her som speiling av firestore.rules, slik
 * resten av denne fila gjør.
 */
const SURFACE_FIELDS = [
    ['topSurface', 'Velg en farge for toppen'],
    ['middleSurface', 'Velg en farge for velkomstmeldingen'],
    ['carouselSurface', 'Velg en farge for karusellen'],
    ['bottomSurface', 'Velg en farge for bunnstripa'],
];
```

```js
    for (const [field, message] of SURFACE_FIELDS) {
        if (!SURFACES.includes(draft[field])) {
            errors[field] = message;
        }
    }
```

- [ ] **Step 4: Kjør testene for å se dem passere**

Run: `node --test src/boards/boardValidation.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/boards/boardValidation.js src/boards/boardValidation.test.mjs
git commit -m "Valideringen dekker alle fire flatefeltene

Fire felt med samme sjekk, så sjekken står én gang i en tabell."
```

---

### Task 6: Flytt draft-oversettelsen til `boardDraft.js`

**Files:**
- Create: `src/boards/boardDraft.js`
- Create: `src/boards/boardDraft.test.mjs`
- Modify: `src/admin/BoardConfigForm.jsx:1-19,21-114,117`

**Interfaces:**
- Consumes: `findModule`, `GREETING_AUTO`, `FLOORPLAN_PLANS` fra `boardConfig.js`; `normalizeDays` fra `openingHours.js`
- Produces: `draftFrom(board)` → flat draft; `configFrom(draft)` → config slik `saveBoardConfig` vil ha den. Draften har feltene: `id`, `name`, `placeName`, `topKind`, `topSurface`, `middleSurface`, `staffImage`, `greetingEnabled`, `greetingAuto`, `greetingText`, `openingHoursEnabled`, `days`, `weatherPlacement` (`'av' | 'karusell' | 'stripe'`), `weatherName`, `weatherLat`, `weatherLng`, `floorplanEnabled`, `floorplanPlan`, `departuresEnabled`, `stopPlaceId`, `stopPlaceName`, `carouselSurface`, `bottomSurface`.

- [ ] **Step 1: Skriv de feilende testene**

Ny fil `src/boards/boardDraft.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { configFrom, draftFrom } from './boardDraft.js';
import { normalizeBoardConfig } from './boardConfig.js';

/** En tavle med alt påskrudd, så rundturen treffer alle grenene. */
function fullBoard() {
    return normalizeBoardConfig('bergen-3', {
        name: 'Bergen 3. etasje',
        placeName: 'Bergen',
        topSurface: 'fersken',
        middleSurface: 'lavendel',
        staffImage: true,
        top: { kind: 'logo' },
        carouselSurface: 'hvit',
        bottomSurface: 'morkebla-lys',
        middle: [
            { type: 'greeting', text: 'Hei og velkommen' },
            { type: 'openingHours', days: [{ day: 'mon', opens: '08:00', closes: '16:00' }] },
        ],
        carousel: [
            { type: 'weather', name: 'Bergen', lat: 60.39299, lng: 5.32415 },
            { type: 'floorplan', plan: 'bergen-3' },
            { type: 'departures', stopPlaceId: 'NSR:StopPlace:548', stopPlaceName: 'Bergen busstasjon' },
        ],
    });
}

describe('draftFrom', () => {
    it('leser alle feltene ut av configen', () => {
        const draft = draftFrom(fullBoard());
        assert.equal(draft.id, 'bergen-3');
        assert.equal(draft.topKind, 'logo');
        assert.equal(draft.topSurface, 'fersken');
        assert.equal(draft.middleSurface, 'lavendel');
        assert.equal(draft.carouselSurface, 'hvit');
        assert.equal(draft.bottomSurface, 'morkebla-lys');
        assert.equal(draft.staffImage, true);
        assert.equal(draft.greetingEnabled, true);
        assert.equal(draft.greetingAuto, false);
        assert.equal(draft.greetingText, 'Hei og velkommen');
        assert.equal(draft.openingHoursEnabled, true);
        assert.equal(draft.floorplanEnabled, true);
        assert.equal(draft.departuresEnabled, true);
        assert.equal(draft.stopPlaceId, 'NSR:StopPlace:548');
    });

    // Koordinatene er strenger i skjemaet: et halvskrevet «60.» er ikke et
    // tall, og feltet skal ikke hoppe mens man skriver.
    it('gjør koordinatene til strenger', () => {
        const draft = draftFrom(fullBoard());
        assert.equal(draft.weatherLat, '60.39299');
        assert.equal(draft.weatherLng, '5.32415');
    });

    it('leser automatisk hilsen som automatisk, med tom tekst', () => {
        const board = normalizeBoardConfig('x', { middle: [{ type: 'greeting', text: 'auto' }] });
        const draft = draftFrom(board);
        assert.equal(draft.greetingEnabled, true);
        assert.equal(draft.greetingAuto, true);
        assert.equal(draft.greetingText, '');
    });

    it('gir av som værplassering når været ikke finnes', () => {
        assert.equal(draftFrom(normalizeBoardConfig('x', {})).weatherPlacement, 'av');
    });

    it('leser været fra karusellen som karusell', () => {
        const board = normalizeBoardConfig('x', {
            carousel: [{ type: 'weather', name: 'Bergen', lat: 60.4, lng: 5.3 }],
        });
        assert.equal(draftFrom(board).weatherPlacement, 'karusell');
    });

    it('leser været fra bunnstripa som stripe', () => {
        const board = normalizeBoardConfig('x', {
            bottom: [{ type: 'weather', name: 'Bergen', lat: 60.4, lng: 5.3 }],
        });
        const draft = draftFrom(board);
        assert.equal(draft.weatherPlacement, 'stripe');
        assert.equal(draft.weatherName, 'Bergen');
    });
});

describe('configFrom', () => {
    it('går rundturen uten å miste noe', () => {
        const board = fullBoard();
        const rundtur = draftFrom(normalizeBoardConfig('bergen-3', configFrom(draftFrom(board))));
        assert.deepEqual(rundtur, draftFrom(board));
    });

    it('setter været i karusellen når plasseringen er karusell', () => {
        const config = configFrom(draftFrom(fullBoard()));
        assert.equal(config.carousel.filter((m) => m.type === 'weather').length, 1);
        assert.deepEqual(config.bottom, []);
    });

    it('setter været i bunnstripa når plasseringen er stripe', () => {
        const draft = { ...draftFrom(fullBoard()), weatherPlacement: 'stripe' };
        const config = configFrom(draft);
        assert.deepEqual(config.carousel.map((m) => m.type), ['floorplan', 'departures']);
        assert.equal(config.bottom.length, 1);
        assert.equal(config.bottom[0].name, 'Bergen');
    });

    it('slipper ikke været ut noe sted når plasseringen er av', () => {
        const draft = { ...draftFrom(fullBoard()), weatherPlacement: 'av' };
        const config = configFrom(draft);
        assert.equal(config.carousel.some((m) => m.type === 'weather'), false);
        assert.deepEqual(config.bottom, []);
    });

    it('gjør koordinatene til tall igjen', () => {
        const config = configFrom(draftFrom(fullBoard()));
        const weather = config.carousel.find((m) => m.type === 'weather');
        assert.equal(weather.lat, 60.39299);
        assert.equal(weather.lng, 5.32415);
    });

    it('skriver de fire flatene', () => {
        const config = configFrom(draftFrom(fullBoard()));
        assert.equal(config.topSurface, 'fersken');
        assert.equal(config.middleSurface, 'lavendel');
        assert.equal(config.carouselSurface, 'hvit');
        assert.equal(config.bottomSurface, 'morkebla-lys');
    });

    it('trimmer navn og stedsnavn', () => {
        const draft = { ...draftFrom(fullBoard()), name: '  Tavla  ', placeName: '  Bergen  ' };
        const config = configFrom(draft);
        assert.equal(config.name, 'Tavla');
        assert.equal(config.placeName, 'Bergen');
    });

    it('skriver auto som hilsen-tekst når hilsenen er automatisk', () => {
        const draft = { ...draftFrom(fullBoard()), greetingAuto: true };
        const greeting = configFrom(draft).middle.find((m) => m.type === 'greeting');
        assert.equal(greeting.text, 'auto');
    });
});
```

- [ ] **Step 2: Kjør testene for å se dem feile**

Run: `node --test src/boards/boardDraft.test.mjs`
Expected: FAIL, `Cannot find module .../boardDraft.js`.

- [ ] **Step 3: Lag `src/boards/boardDraft.js`**

Flytt `draftFrom` og `configFrom` hit fra `BoardConfigForm.jsx` (linje 21–114), med `theme` byttet ut med de to flatefeltene:

```js
/**
 * Oversettelsen mellom tavlas config og den flate formen skjemafeltene jobber
 * med, og operasjonene skjemaet gjør på draften.
 *
 * Uten JSX og uten Firebase-import, slik at den kan testes med `node --test`.
 * Logikken lå tidligere i BoardConfigForm.jsx og var derfor utestet — `node
 * --test` globber ikke `.jsx`.
 */
import {
    FLOORPLAN_PLANS,
    GREETING_AUTO,
    findModule,
} from './boardConfig.js';
import { normalizeDays } from './openingHours.js';

/** Config → den flate formen skjemafeltene jobber med. */
export function draftFrom(board) {
    const greeting = findModule(board.middle, 'greeting');
    const openingHours = findModule(board.middle, 'openingHours');
    const weather = findModule(board.carousel, 'weather');
    const bottomWeather = findModule(board.bottom, 'weather');
    const weatherModule = bottomWeather ?? weather;
    const floorplan = findModule(board.carousel, 'floorplan');
    const departures = findModule(board.carousel, 'departures');
    return {
        id: board.id,
        name: board.name,
        placeName: board.placeName,
        topKind: board.top.kind,
        topSurface: board.topSurface,
        middleSurface: board.middleSurface,
        staffImage: board.staffImage,
        greetingEnabled: Boolean(greeting),
        greetingAuto: !greeting || greeting.text === GREETING_AUTO,
        greetingText: greeting && greeting.text !== GREETING_AUTO ? greeting.text : '',
        openingHoursEnabled: Boolean(openingHours),
        days: normalizeDays(openingHours ? openingHours.days : []),
        // Været bor ett sted. Ett felt med tre verdier gjør regelen strukturell:
        // kortene i karusellen og valget i bunnstripa utledes begge av den, så
        // været kan ikke stå to steder samtidig.
        weatherPlacement: bottomWeather ? 'stripe' : (weather ? 'karusell' : 'av'),
        weatherName: weatherModule ? weatherModule.name : '',
        // Koordinatene er strenger i skjemaet: et halvskrevet «60.» er ikke et
        // tall, og feltet skal ikke hoppe mens man skriver.
        weatherLat: weatherModule ? String(weatherModule.lat) : '',
        weatherLng: weatherModule ? String(weatherModule.lng) : '',
        floorplanEnabled: Boolean(floorplan),
        floorplanPlan: floorplan ? floorplan.plan : FLOORPLAN_PLANS[0],
        departuresEnabled: Boolean(departures),
        stopPlaceId: departures ? departures.stopPlaceId : '',
        stopPlaceName: departures ? departures.stopPlaceName : '',
        carouselSurface: board.carouselSurface,
        bottomSurface: board.bottomSurface,
    };
}

/** Den flate formen → config, slik repositoryet vil ha den. */
export function configFrom(draft) {
    const middle = [];
    if (draft.greetingEnabled) {
        middle.push({
            type: 'greeting',
            text: draft.greetingAuto ? GREETING_AUTO : draft.greetingText.trim(),
        });
    }
    if (draft.openingHoursEnabled) {
        middle.push({ type: 'openingHours', days: draft.days });
    }

    // Bygges uansett plassering, også når `weatherPlacement` er 'av' — den
    // brukes bare bak de to plasseringssjekkene under, og forkastes stille
    // (Number('') === 0 slipper aldri ut, den skrives aldri til noen liste).
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
    if (draft.floorplanEnabled) {
        carousel.push({ type: 'floorplan', plan: draft.floorplanPlan });
    }
    if (draft.departuresEnabled) {
        carousel.push({
            type: 'departures',
            stopPlaceId: draft.stopPlaceId,
            stopPlaceName: draft.stopPlaceName.trim(),
        });
    }

    const bottom = draft.weatherPlacement === 'stripe' ? [weatherModule] : [];

    return {
        id: draft.id,
        name: draft.name.trim(),
        placeName: draft.placeName.trim(),
        topSurface: draft.topSurface,
        middleSurface: draft.middleSurface,
        staffImage: draft.staffImage,
        top: { kind: draft.topKind },
        carouselSurface: draft.carouselSurface,
        bottomSurface: draft.bottomSurface,
        middle,
        carousel,
        bottom,
    };
}
```

- [ ] **Step 4: Kjør testene for å se dem passere**

Run: `node --test src/boards/boardDraft.test.mjs`
Expected: PASS.

- [ ] **Step 5: Fjern dubletten fra `BoardConfigForm.jsx`**

Slett linje 21–114 (begge funksjonene og deres kommentarer) og importene som ble unødvendige. Erstatt import-blokka på linje 7–19 med:

```jsx
import {
    GREETING_TEXT_MAX_LENGTH,
    NAME_MAX_LENGTH,
    PLACE_NAME_MAX_LENGTH,
} from '../boards/boardConfig';
import { SURFACES, SURFACE_LABELS } from '../boards/surfaces';
import StopPlaceField from './StopPlaceField';
import { DAY_LABELS } from '../boards/openingHours';
import { hasErrors, validateBoardInput } from '../boards/boardValidation';
import { configFrom, draftFrom } from '../boards/boardDraft';
import { saveBoardConfig } from '../boards/boardsRepository';
```

Fila er fortsatt midlertidig ødelagt — `draft.theme`-radioen på linje ~202 peker på et felt som ikke finnes. Den ryddes i Task 9 og Task 12. Bygget skal likevel gå.

- [ ] **Step 6: Kjør alt og commit**

Run: `npm test && npm run build`
Expected: PASS.

```bash
git add src/boards/boardDraft.js src/boards/boardDraft.test.mjs src/admin/BoardConfigForm.jsx
git commit -m "Draft-oversettelsen flyttes ut av jsx-fila og får tester

draftFrom og configFrom er ren datalogikk, og var utestet fordi node
--test ikke globber .jsx. Rundturen draft til config og tilbake er nå
dekket, sammen med de tre værplasseringene."
```

---

### Task 7: Kortoperasjonene i `boardDraft.js`

**Files:**
- Modify: `src/boards/boardDraft.js`
- Test: `src/boards/boardDraft.test.mjs`

**Interfaces:**
- Consumes: `CAROUSEL_TYPES`, `FLOORPLAN_PLANS` fra `boardConfig.js`
- Produces:
  - `carouselCards(draft)` → array av modultyper som har kort, i katalogens rekkefølge
  - `availableCarouselTypes(draft)` → array av modultyper «Legg til»-raden skal tilby
  - `addCarouselModule(draft, type)` → ny draft
  - `removeCarouselModule(draft, type)` → ny draft
  - `bottomModule(draft)` → `'weather'` eller `null`
  - `setBottomModule(draft, type)` → ny draft (`type = null` for «Ingen»)

- [ ] **Step 1: Skriv de feilende testene**

Legg til i `src/boards/boardDraft.test.mjs`. Utvid import-linja øverst:

```js
import {
    addCarouselModule,
    availableCarouselTypes,
    bottomModule,
    carouselCards,
    configFrom,
    draftFrom,
    removeCarouselModule,
    setBottomModule,
} from './boardDraft.js';
```

Og legg til nederst i fila:

```js
/** En tom draft: ingen moduler noe sted. */
function tomDraft() {
    return draftFrom(normalizeBoardConfig('x', { name: 'Tavla', placeName: 'Bergen' }));
}

describe('carouselCards', () => {
    it('gir kortene i katalogens rekkefølge, ikke i draftens', () => {
        assert.deepEqual(carouselCards(draftFrom(fullBoard())), ['weather', 'floorplan', 'departures']);
    });

    it('gir tom liste når karusellen er tom', () => {
        assert.deepEqual(carouselCards(tomDraft()), []);
    });

    it('gir ikke vær-kort når været står i bunnstripa', () => {
        const draft = { ...draftFrom(fullBoard()), weatherPlacement: 'stripe' };
        assert.deepEqual(carouselCards(draft), ['floorplan', 'departures']);
    });
});

describe('availableCarouselTypes', () => {
    it('tilbyr alt på en tom karusell', () => {
        assert.deepEqual(availableCarouselTypes(tomDraft()), ['weather', 'floorplan', 'departures']);
    });

    it('tilbyr ingenting når alt er lagt til', () => {
        assert.deepEqual(availableCarouselTypes(draftFrom(fullBoard())), []);
    });

    // Været bor ett sted: står det i bunnstripa, skal det ikke kunne legges
    // til i karusellen også. Ellers ville tavla pollet api.met.no to ganger.
    it('tilbyr ikke været når det står i bunnstripa', () => {
        const draft = { ...tomDraft(), weatherPlacement: 'stripe' };
        assert.deepEqual(availableCarouselTypes(draft), ['floorplan', 'departures']);
    });
});

describe('addCarouselModule og removeCarouselModule', () => {
    it('legger til og fjerner været', () => {
        const lagtTil = addCarouselModule(tomDraft(), 'weather');
        assert.equal(lagtTil.weatherPlacement, 'karusell');
        assert.equal(removeCarouselModule(lagtTil, 'weather').weatherPlacement, 'av');
    });

    it('legger til plantegningen med den eneste planen som finnes', () => {
        const lagtTil = addCarouselModule(tomDraft(), 'floorplan');
        assert.equal(lagtTil.floorplanEnabled, true);
        assert.equal(lagtTil.floorplanPlan, 'bergen-3');
        assert.equal(removeCarouselModule(lagtTil, 'floorplan').floorplanEnabled, false);
    });

    it('legger til og fjerner avgangstidene', () => {
        const lagtTil = addCarouselModule(tomDraft(), 'departures');
        assert.equal(lagtTil.departuresEnabled, true);
        assert.equal(removeCarouselModule(lagtTil, 'departures').departuresEnabled, false);
    });

    it('rører ikke draften den fikk inn', () => {
        const draft = tomDraft();
        addCarouselModule(draft, 'weather');
        assert.equal(draft.weatherPlacement, 'av');
    });

    // Koordinatene skal ikke forsvinne av å fjerne kortet: legger du det til
    // igjen, skal stedet stå der fortsatt.
    it('beholder koordinatene når vær-kortet fjernes', () => {
        const draft = removeCarouselModule(draftFrom(fullBoard()), 'weather');
        assert.equal(draft.weatherName, 'Bergen');
        assert.equal(draft.weatherLat, '60.39299');
    });
});

describe('bottomModule og setBottomModule', () => {
    it('gir null når bunnstripa er tom', () => {
        assert.equal(bottomModule(tomDraft()), null);
        assert.equal(bottomModule(draftFrom(fullBoard())), null);
    });

    it('gir weather når været står i stripa', () => {
        assert.equal(bottomModule({ ...tomDraft(), weatherPlacement: 'stripe' }), 'weather');
    });

    it('tar været fra karusellen når stripa velger det', () => {
        const draft = setBottomModule(draftFrom(fullBoard()), 'weather');
        assert.equal(draft.weatherPlacement, 'stripe');
        assert.deepEqual(carouselCards(draft), ['floorplan', 'departures']);
    });

    it('gjør været tilgjengelig i karusellen igjen når stripa settes til ingen', () => {
        const stripe = setBottomModule(tomDraft(), 'weather');
        const ingen = setBottomModule(stripe, null);
        assert.equal(ingen.weatherPlacement, 'av');
        assert.ok(availableCarouselTypes(ingen).includes('weather'));
    });

    // «Ingen» i stripa skal bare rive ned stripa. Et vær-kort som står i
    // karusellen har ingenting med det valget å gjøre.
    it('rører ikke et vær-kort i karusellen når stripa settes til ingen', () => {
        const draft = setBottomModule(draftFrom(fullBoard()), null);
        assert.equal(draft.weatherPlacement, 'karusell');
        assert.deepEqual(carouselCards(draft), ['weather', 'floorplan', 'departures']);
    });
});
```

- [ ] **Step 2: Kjør testene for å se dem feile**

Run: `node --test src/boards/boardDraft.test.mjs`
Expected: FAIL, `carouselCards is not a function`.

- [ ] **Step 3: Legg til funksjonene i `boardDraft.js`**

Utvid import-blokka til å ta med katalogene, og legg funksjonene nederst i fila:

```js
import {
    CAROUSEL_TYPES,
    FLOORPLAN_PLANS,
    GREETING_AUTO,
    findModule,
} from './boardConfig.js';
```

```js
/**
 * Kortene karusellen viser i skjemaet, i katalogens rekkefølge.
 *
 * Rekkefølgen er katalogens og ikke draftens fordi det er rekkefølgen på
 * skjermen: `normalizeModules` i boardConfig itererer katalogen, ikke
 * dokumentet. Skjemaet skal vise den samme rekkefølgen tavla bruker.
 */
export function carouselCards(draft) {
    return CAROUSEL_TYPES.filter((type) => hasCarouselModule(draft, type));
}

/**
 * Typene «Legg til»-raden skal tilby.
 *
 * Været faller bort når det står i bunnstripa: været bor ett sted, ellers
 * poller tavla api.met.no to ganger. Regelen håndheves ikke som en validering
 * — modulen er rett og slett ikke tilgjengelig.
 */
export function availableCarouselTypes(draft) {
    return CAROUSEL_TYPES.filter((type) => (
        !hasCarouselModule(draft, type) && !(type === 'weather' && draft.weatherPlacement === 'stripe')
    ));
}

export function addCarouselModule(draft, type) {
    if (type === 'weather') {
        return { ...draft, weatherPlacement: 'karusell' };
    }
    if (type === 'floorplan') {
        // Repoet har nøyaktig én plantegning, og synken i
        // scripts/sync-floorplan.mjs er hardkodet mot den.
        return { ...draft, floorplanEnabled: true, floorplanPlan: FLOORPLAN_PLANS[0] };
    }
    return { ...draft, departuresEnabled: true };
}

/**
 * Fjerner kortet, men beholder feltene det fylte ut. Legger du kortet til
 * igjen, skal stedet og koordinatene stå der fortsatt.
 */
export function removeCarouselModule(draft, type) {
    if (type === 'weather') {
        return { ...draft, weatherPlacement: 'av' };
    }
    if (type === 'floorplan') {
        return { ...draft, floorplanEnabled: false };
    }
    return { ...draft, departuresEnabled: false };
}

/** Modulen bunnstripa viser permanent, eller null for «Ingen». */
export function bottomModule(draft) {
    return draft.weatherPlacement === 'stripe' ? 'weather' : null;
}

export function setBottomModule(draft, type) {
    if (type === 'weather') {
        return { ...draft, weatherPlacement: 'stripe' };
    }
    // «Ingen» skal bare rive ned stripa. Står været i karusellen, har det
    // ingenting med dette valget å gjøre.
    return draft.weatherPlacement === 'stripe' ? { ...draft, weatherPlacement: 'av' } : draft;
}

function hasCarouselModule(draft, type) {
    if (type === 'weather') {
        return draft.weatherPlacement === 'karusell';
    }
    if (type === 'floorplan') {
        return draft.floorplanEnabled;
    }
    return draft.departuresEnabled;
}
```

`BOTTOM_TYPES` importeres bevisst **ikke** hit — `BottomSection` i Task 11 henter den direkte fra `boardConfig.js`, der katalogen bor.

- [ ] **Step 4: Kjør testene for å se dem passere**

Run: `node --test src/boards/boardDraft.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/boards/boardDraft.js src/boards/boardDraft.test.mjs
git commit -m "Kortoperasjonene på draften, med tester

Været bor ett sted, og nå er det strukturelt: kortene i karusellen og
valget i bunnstripa utledes av samme felt, så tilstanden der været står
to steder kan ikke oppstå."
```

---

### Task 8: `FormSection` og `SurfacePicker`

**Files:**
- Create: `src/admin/FormSection.jsx`
- Create: `src/admin/SurfacePicker.jsx`
- Modify: `src/admin/admin.css:7-12`

**Interfaces:**
- Consumes: `SURFACES`, `SURFACE_LABELS`, `surfacePalette` fra `src/boards/surfaces`
- Produces:
  - `<FormSection title help>{children}</FormSection>` — `help` er valgfri
  - `<SurfacePicker name label value onChange error />` — `name` er radiogruppas HTML-navn (må være unikt per seksjon), `onChange` får flatenavnet som streng, `error` er valgfri feilmelding

- [ ] **Step 1: Lag `src/admin/FormSection.jsx`**

```jsx
import { base } from '@entur/tokens';
import { Heading3, Paragraph } from '@entur/typography';

const BORDER = base.light.baseColors.stroke.subduedalt;

/**
 * Rammen rundt én av de fire seksjonene i oppsettskjemaet.
 *
 * Seksjonene speiler de fire feltene på tavla og skal leses som fire ting, ikke
 * som én lang liste. Rammen er hele poenget: uten den fløt fargevelgerne og
 * modulvalgene over i hverandre.
 */
function FormSection({ title, help, children }) {
    return (
        <section
            style={{
                border: `1px solid ${BORDER}`,
                borderRadius: '0.5rem',
                padding: '1.25rem 1.5rem 1.5rem',
            }}
        >
            <Heading3>{title}</Heading3>
            {help && <Paragraph>{help}</Paragraph>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {children}
            </div>
        </section>
    );
}

export default FormSection;
```

- [ ] **Step 2: Lag `src/admin/SurfacePicker.jsx`**

```jsx
import { SmallAlertBox } from '@entur/alert';
import { base } from '@entur/tokens';

import { SURFACES, SURFACE_LABELS, surfacePalette } from '../boards/surfaces';

const SELECTED_BORDER = base.light.baseColors.stroke.default;
const UNSELECTED_BORDER = base.light.baseColors.stroke.subdued;

/**
 * Fargevalget for én flate, som seks fargeprøver.
 *
 * Hvert kort har flatens egen bakgrunn, og navnet skrevet på i flatens egen
 * tekstfarge. Kortet viser dermed alle tre tingene i én figur: navnet, fargen,
 * og at valget avgjør lys eller mørk modus — «Mørk blå» står hvitt, «Fersken»
 * står blått. Fargene kommer fra surfacePalette, samme kilde tavla rendrer
 * fra, så en prøve kan ikke komme på avveie fra det skjermen viser.
 *
 * Under panseret er det vanlige radio-inputs — visuelt skjult, men fortsatt der
 * for tastatur og skjermleser. Fokusringen flyttes til kortet med
 * .surface-option:focus-within i admin.css.
 *
 * Kantlinja er der i begge tilstandene, ikke bare den valgte: uten den
 * forsvinner den hvite flaten i admin-sidens hvite bakgrunn.
 */
function SurfacePicker({ name, label, value, onChange, error }) {
    return (
        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend style={{ marginBottom: '0.5rem', fontWeight: 600 }}>{label}</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {SURFACES.map((surface) => {
                    const palette = surfacePalette(surface);
                    const selected = value === surface;
                    return (
                        <label
                            key={surface}
                            className="surface-option"
                            style={{
                                flex: '1 1 8rem',
                                cursor: 'pointer',
                                borderRadius: '0.25rem',
                                padding: '0.75rem 0.5rem',
                                textAlign: 'center',
                                backgroundColor: palette.background,
                                color: palette.text,
                                border: `2px solid ${selected ? SELECTED_BORDER : UNSELECTED_BORDER}`,
                                fontWeight: selected ? 700 : 400,
                            }}
                        >
                            <input
                                type="radio"
                                name={name}
                                value={surface}
                                checked={selected}
                                onChange={() => onChange(surface)}
                                style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, margin: 0 }}
                            />
                            {SURFACE_LABELS[surface]}
                        </label>
                    );
                })}
            </div>
            {error && (
                <div style={{ marginTop: '0.5rem' }}>
                    <SmallAlertBox variant="negative">{error}</SmallAlertBox>
                </div>
            )}
        </fieldset>
    );
}

export default SurfacePicker;
```

- [ ] **Step 3: Utvid fokusregelen i `src/admin/admin.css`**

Erstatt linje 7–12:

```css
/* Nivåkortene og fargeprøvene har visuelt skjulte radioer, så fokusringen må
   flyttes til kortet for at tastaturnavigasjon skal være synlig. */
.level-option:focus-within,
.surface-option:focus-within {
    outline: 2px solid #181c56;
    outline-offset: 2px;
}
```

- [ ] **Step 4: Kjør bygget**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/FormSection.jsx src/admin/SurfacePicker.jsx src/admin/admin.css
git commit -m "Seksjonsramme og fargevelger som deles av alle fire seksjonene

Fargeprøven har flatens egen bakgrunn og navnet i flatens egen
tekstfarge, så kortet viser navn, farge og modus på én gang."
```

---

### Task 9: `BrandingSection` og `WelcomeSection`

**Files:**
- Create: `src/admin/BrandingSection.jsx`
- Create: `src/admin/WelcomeSection.jsx`

**Interfaces:**
- Consumes: `FormSection`, `SurfacePicker` fra Task 8; `PLACE_NAME_MAX_LENGTH`, `GREETING_TEXT_MAX_LENGTH` fra `boardConfig`; `DAY_LABELS` fra `openingHours`
- Produces:
  - `<BrandingSection draft errors update />`
  - `<WelcomeSection draft errors update updateDay />`
  - `update(field, value)` og `updateDay(dayKey, changes)` er handlerne `BoardConfigForm` gir ned (Task 12).

- [ ] **Step 1: Lag `src/admin/BrandingSection.jsx`**

```jsx
import { Radio, RadioGroup } from '@entur/form';

import FormSection from './FormSection';
import SurfacePicker from './SurfacePicker';

/**
 * Toppen av tavla: intro-videoen eller logoen, og fargen bak den.
 *
 * Videoen dekker hele feltet, så fargen vises bare når videoen ikke kan spilles
 * av — men logoen bytter med modusen, og det er valget her som avgjør.
 */
function BrandingSection({ draft, errors, update }) {
    return (
        <FormSection
            title="Branding"
            help="Det øverste feltet på skjermen. Logoen følger fargen: hvit og koral på mørke flater, farget på lyse."
        >
            <RadioGroup
                name="topKind"
                label="Innhold"
                value={draft.topKind}
                onChange={(event) => update('topKind', event.target.value)}
            >
                <Radio value="video">Intro-video</Radio>
                <Radio value="logo">Entur-logo</Radio>
            </RadioGroup>

            <SurfacePicker
                name="topSurface"
                label="Farge"
                value={draft.topSurface}
                onChange={(surface) => update('topSurface', surface)}
                error={errors.topSurface}
            />
        </FormSection>
    );
}

export default BrandingSection;
```

- [ ] **Step 2: Lag `src/admin/WelcomeSection.jsx`**

```jsx
import { SmallAlertBox } from '@entur/alert';
import { Checkbox, Radio, RadioGroup, TextField } from '@entur/form';

import FormSection from './FormSection';
import SurfacePicker from './SurfacePicker';
import { GREETING_TEXT_MAX_LENGTH, PLACE_NAME_MAX_LENGTH } from '../boards/boardConfig';
import { DAY_LABELS } from '../boards/openingHours';

/**
 * Midtfeltet: overskriften, hilsenen, åpningstidene og illustrasjonen.
 *
 * Stedsnavnet bor her og ikke øverst i skjemaet fordi det er her overskriften
 * det lager faktisk står. Overskriften vises uansett hvilke av valgene under
 * som er på, og meldinger legger seg alltid over den.
 */
function WelcomeSection({ draft, errors, update, updateDay }) {
    return (
        <FormSection
            title="Velkomstmelding"
            help="Feltet under toppen. Meldinger vises alltid øverst her, og overskriften står der uansett hva du velger."
        >
            <div style={{ maxWidth: '20rem' }}>
                <TextField
                    label="Stedsnavn"
                    value={draft.placeName}
                    maxLength={PLACE_NAME_MAX_LENGTH}
                    onChange={(event) => update('placeName', event.target.value)}
                    variant={errors.placeName ? 'negative' : undefined}
                    feedback={errors.placeName ?? `Gir «Velkommen til Entur ${draft.placeName || '…'}»`}
                />
            </div>

            <div>
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
                {draft.greetingEnabled && (
                    <div style={{ margin: '0.75rem 0 1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
            </div>

            <SurfacePicker
                name="middleSurface"
                label="Farge"
                value={draft.middleSurface}
                onChange={(surface) => update('middleSurface', surface)}
                error={errors.middleSurface}
            />
        </FormSection>
    );
}

export default WelcomeSection;
```

- [ ] **Step 3: Kjør bygget**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/admin/BrandingSection.jsx src/admin/WelcomeSection.jsx
git commit -m "Branding- og velkomstseksjonen

Stedsnavnet flyttes hit fra toppen av skjemaet: det er her overskriften
det lager faktisk står."
```

---

### Task 10: `ModuleCard` og `CarouselSection`

**Files:**
- Create: `src/admin/ModuleCard.jsx`
- Create: `src/admin/WeatherFields.jsx`
- Create: `src/admin/CarouselSection.jsx`

**Interfaces:**
- Consumes: `carouselCards`, `availableCarouselTypes` fra Task 7; `MODULE_LABELS` fra Task 1; `FormSection`, `SurfacePicker` fra Task 8; `StopPlaceField` (finnes fra før)
- Produces:
  - `<ModuleCard title onRemove>{children}</ModuleCard>`
  - `<WeatherFields draft errors update />` — default export, egen fil fordi både karusellkortet og bunnstripa bruker den. Ingen av de to seksjonene skal importere fra den andre.
  - `<CarouselSection draft errors update onAdd onRemove onStopPlaceChange />` — `onAdd(type)`, `onRemove(type)`, `onStopPlaceChange({ id, name })`

- [ ] **Step 1: Lag `src/admin/ModuleCard.jsx`**

```jsx
import { TertiaryButton } from '@entur/button';
import { base } from '@entur/tokens';
import { Heading4 } from '@entur/typography';

const BORDER = base.light.baseColors.stroke.subduedalt;

/**
 * Rammen rundt én modul i karusellen.
 *
 * Ett kort per modul, ikke en avkrysningsboks med felt under: kortet gjør det
 * synlig hva karusellen faktisk viser, og hvor mange slides det blir.
 */
function ModuleCard({ title, onRemove, children }) {
    return (
        <div
            style={{
                border: `1px solid ${BORDER}`,
                borderRadius: '0.25rem',
                padding: '1rem',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem' }}>
                <Heading4>{title}</Heading4>
                <TertiaryButton type="button" onClick={onRemove}>Fjern</TertiaryButton>
            </div>
            {children}
        </div>
    );
}

export default ModuleCard;
```

- [ ] **Step 2: Lag `src/admin/WeatherFields.jsx`**

Egen fil, ikke en named export fra en av seksjonene: både karusellkortet og bunnstripa bruker den, og ingen av de to seksjonene skal avhenge av den andre.

```jsx
import { TextField } from '@entur/form';

/**
 * Feltene værmodulen trenger.
 *
 * Egen fil fordi været kan stå både i karusellen og i bunnstripa, og feltene er
 * identiske uansett hvor — det er de samme koordinatene som sendes til
 * api.met.no.
 */
function WeatherFields({ draft, errors, update }) {
    return (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
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
    );
}

export default WeatherFields;
```

- [ ] **Step 3: Lag `src/admin/CarouselSection.jsx`**

```jsx
import { SmallAlertBox } from '@entur/alert';
import { SecondaryButton } from '@entur/button';
import { Paragraph } from '@entur/typography';

import FormSection from './FormSection';
import ModuleCard from './ModuleCard';
import StopPlaceField from './StopPlaceField';
import SurfacePicker from './SurfacePicker';
import WeatherFields from './WeatherFields';
import { MODULE_LABELS } from '../boards/boardConfig';
import { availableCarouselTypes, carouselCards } from '../boards/boardDraft';

/**
 * Karusellen: ett kort per modul, og en rad med det som kan legges til.
 *
 * «Legg til» er én knapp per modul som ikke er lagt til, ikke en nedtrekksmeny
 * med en knapp ved siden av — det er ett klikk i stedet for tre, og raden
 * tømmer seg selv etter hvert.
 *
 * Været mangler i raden når det står i bunnstripa. Det er ikke en sperre, det
 * er `availableCarouselTypes` som ikke tilbyr det: været bor ett sted.
 */
function CarouselSection({ draft, errors, update, onAdd, onRemove, onStopPlaceChange }) {
    const cards = carouselCards(draft);
    const available = availableCarouselTypes(draft);

    return (
        <FormSection
            title="Karusellen"
            help="Feltet i midten som bytter mellom modulene. Rekkefølgen på skjermen er den kortene står i."
        >
            {cards.length === 0 && (
                <Paragraph>
                    Ingen moduler. Karusellen vises ikke på skjermen, og
                    velkomstmeldingen får plassen.
                </Paragraph>
            )}

            {cards.includes('weather') && (
                <ModuleCard title={MODULE_LABELS.weather} onRemove={() => onRemove('weather')}>
                    <WeatherFields draft={draft} errors={errors} update={update} />
                </ModuleCard>
            )}

            {cards.includes('floorplan') && (
                <ModuleCard title={MODULE_LABELS.floorplan} onRemove={() => onRemove('floorplan')}>
                    {/* Ingen velger: repoet har nøyaktig én plantegning, og
                        synken i scripts/sync-floorplan.mjs er hardkodet mot
                        den. En velger med ett valg er bare støy. */}
                    <Paragraph>Bergen, 3. etasje — den eneste plantegningen som finnes.</Paragraph>
                    {errors.floorplan && (
                        <SmallAlertBox variant="negative">{errors.floorplan}</SmallAlertBox>
                    )}
                </ModuleCard>
            )}

            {cards.includes('departures') && (
                <ModuleCard title={MODULE_LABELS.departures} onRemove={() => onRemove('departures')}>
                    <div style={{ maxWidth: '28rem' }}>
                        <StopPlaceField
                            value={{ id: draft.stopPlaceId, name: draft.stopPlaceName }}
                            onChange={onStopPlaceChange}
                            error={errors.stopPlace}
                        />
                    </div>
                </ModuleCard>
            )}

            {available.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600 }}>Legg til:</span>
                    {available.map((type) => (
                        <SecondaryButton key={type} type="button" onClick={() => onAdd(type)}>
                            {MODULE_LABELS[type]}
                        </SecondaryButton>
                    ))}
                </div>
            )}

            <SurfacePicker
                name="carouselSurface"
                label="Farge"
                value={draft.carouselSurface}
                onChange={(surface) => update('carouselSurface', surface)}
                error={errors.carouselSurface}
            />
        </FormSection>
    );
}

export default CarouselSection;
```

- [ ] **Step 4: Kjør bygget**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/ModuleCard.jsx src/admin/WeatherFields.jsx src/admin/CarouselSection.jsx
git commit -m "Karusellen som kort med legg til og fjern

Været mangler i «Legg til» når det står i bunnstripa — ikke som en
sperre, men fordi availableCarouselTypes ikke tilbyr det."
```

---

### Task 11: `BottomSection`

**Files:**
- Create: `src/admin/BottomSection.jsx`

**Interfaces:**
- Consumes: `bottomModule` fra Task 7; `BOTTOM_TYPES`, `MODULE_LABELS` fra `boardConfig`; `WeatherFields` (default export fra `./WeatherFields`) fra Task 10; `FormSection`, `SurfacePicker` fra Task 8
- Produces: `<BottomSection draft errors update onModuleChange />` — `onModuleChange(type | null)`

- [ ] **Step 1: Lag `src/admin/BottomSection.jsx`**

```jsx
import { base } from '@entur/tokens';

import FormSection from './FormSection';
import SurfacePicker from './SurfacePicker';
import WeatherFields from './WeatherFields';
import { BOTTOM_TYPES, MODULE_LABELS } from '../boards/boardConfig';
import { bottomModule } from '../boards/boardDraft';

const BORDER = base.light.baseColors.stroke.subdued;

/**
 * Bunnstripa: én modul som står permanent, med sine egne innstillinger.
 *
 * Nedtrekksmenyen er et vanlig <select>. Designsystemet har ingen
 * dropdown-komponent, og å håndskrive en listboks for to valg er ikke verdt
 * det.
 *
 * Velger du en modul som også kunne stått i karusellen, forsvinner den derfra.
 * Det håndheves ikke her — `setBottomModule` i boardDraft flytter feltet, og
 * karusellkortene utledes av det samme feltet.
 */
function BottomSection({ draft, errors, update, onModuleChange }) {
    const valgt = bottomModule(draft);

    return (
        <FormSection
            title="Bunnstripa"
            help="Et lavt felt nederst på skjermen, med én modul som står der hele tiden."
        >
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '16rem' }}>
                <span style={{ fontWeight: 600 }}>Modul</span>
                <select
                    value={valgt ?? ''}
                    onChange={(event) => onModuleChange(event.target.value === '' ? null : event.target.value)}
                    style={{
                        padding: '0.5rem',
                        fontSize: '1rem',
                        borderRadius: '0.25rem',
                        border: `1px solid ${BORDER}`,
                        backgroundColor: '#ffffff',
                    }}
                >
                    <option value="">Ingen</option>
                    {BOTTOM_TYPES.map((type) => (
                        <option key={type} value={type}>{MODULE_LABELS[type]}</option>
                    ))}
                </select>
            </label>

            {valgt === 'weather' && <WeatherFields draft={draft} errors={errors} update={update} />}

            <SurfacePicker
                name="bottomSurface"
                label="Farge"
                value={draft.bottomSurface}
                onChange={(surface) => update('bottomSurface', surface)}
                error={errors.bottomSurface}
            />
        </FormSection>
    );
}

export default BottomSection;
```

- [ ] **Step 2: Kjør bygget**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/admin/BottomSection.jsx
git commit -m "Bunnstripa som én nedtrekksmeny med modulens innstillinger"
```

---

### Task 12: Sett sammen `BoardConfigForm`, og rett `NewBoardForm`

**Files:**
- Modify: `src/admin/BoardConfigForm.jsx` (erstattes i sin helhet)
- Modify: `src/admin/NewBoardForm.jsx:16`

**Interfaces:**
- Consumes: alt fra Task 6–11
- Produces: `<BoardConfigForm board userEmail />`, uendret signatur — `BoardAdmin` trenger ingen endring.

- [ ] **Step 1: Erstatt `src/admin/BoardConfigForm.jsx`**

Hele fila:

```jsx
import { useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { PrimaryButton } from '@entur/button';
import { TextField } from '@entur/form';

import BottomSection from './BottomSection';
import BrandingSection from './BrandingSection';
import CarouselSection from './CarouselSection';
import WelcomeSection from './WelcomeSection';
import { NAME_MAX_LENGTH } from '../boards/boardConfig';
import {
    addCarouselModule,
    configFrom,
    draftFrom,
    removeCarouselModule,
    setBottomModule,
} from '../boards/boardDraft';
import { hasErrors, validateBoardInput } from '../boards/boardValidation';
import { saveBoardConfig } from '../boards/boardsRepository';

/**
 * Oppsettet for én tavle, som fire seksjoner som speiler de fire feltene på
 * skjermen.
 *
 * Denne komponenten eier draften og har ingen felt selv utenom navnet.
 * Seksjonene får `draft`, `errors` og handlerne de trenger, og leser bare sine
 * egne felt. Oversettelsen til og fra config, og operasjonene på draften, bor i
 * boardDraft.js — utenfor .jsx, slik at de kan testes.
 */
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

    /** Kortoperasjonene er rene funksjoner; her sendes bare resultatet inn. */
    function apply(operation) {
        setSaved(false);
        setDraft(operation);
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
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Navnet hører ikke til noen seksjon: det er en etikett i admin og
                står ingen steder på skjermen. */}
            <div style={{ maxWidth: '20rem' }}>
                <TextField
                    label="Navn"
                    value={draft.name}
                    maxLength={NAME_MAX_LENGTH}
                    onChange={(event) => update('name', event.target.value)}
                    variant={errors.name ? 'negative' : undefined}
                    feedback={errors.name ?? 'Vises bare her i admin.'}
                />
            </div>

            <BrandingSection draft={draft} errors={errors} update={update} />

            <WelcomeSection draft={draft} errors={errors} update={update} updateDay={updateDay} />

            <CarouselSection
                draft={draft}
                errors={errors}
                update={update}
                onAdd={(type) => apply((current) => addCarouselModule(current, type))}
                onRemove={(type) => apply((current) => removeCarouselModule(current, type))}
                onStopPlaceChange={(valgt) => apply((current) => ({
                    ...current,
                    stopPlaceId: valgt.id,
                    stopPlaceName: valgt.name,
                }))}
            />

            <BottomSection
                draft={draft}
                errors={errors}
                update={update}
                onModuleChange={(type) => apply((current) => setBottomModule(current, type))}
            />

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

- [ ] **Step 2: Rett `NewBoardForm.jsx`**

Bytt linje 16 (`theme: 'dark',`) med:

```jsx
        topSurface: 'morkebla',
        middleSurface: 'morkebla',
```

Formen har ingen fargevelgere — farger settes i oppsettskjemaet etter at tavla er opprettet, som i dag. Verdien går gjennom `normalizeBoardConfig`, så `theme: 'dark'` ville også virket via migreringsveien; poenget med endringen er at en helt ny tavle ikke skal skrives gjennom en bakoverkompatibilitetsvei.

- [ ] **Step 3: Sjekk at ingen `theme` er igjen i admin**

Run: `grep -rn "theme" src/admin/`
Expected: ingen treff.

- [ ] **Step 4: Sjekk at ingen fil ble for stor**

Run: `wc -l src/admin/*.jsx src/boards/boardDraft.js`
Expected: ingen fil over ~130 linjer.

- [ ] **Step 5: Kjør alt**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/admin/BoardConfigForm.jsx src/admin/NewBoardForm.jsx
git commit -m "BoardConfigForm blir rammen rundt de fire seksjonene

Eier draften og navnefeltet, og gir seksjonene det de trenger.
Kortoperasjonene er rene funksjoner fra boardDraft, så handlerne her
sender bare resultatet inn i setDraft."
```

---

### Task 13: Verifisering

**Files:** ingen endringer

- [ ] **Step 1: Full enhetstestkjøring**

Run: `npm test`
Expected: PASS, alle grønne. Ingen `.only` igjen, ingen hoppede tester.

- [ ] **Step 2: Regeltestene mot emulatoren**

Run: `npm run test:rules`
Expected: PASS.

- [ ] **Step 3: Bygget**

Run: `npm run build`
Expected: PASS, ingen advarsler om ubrukte importer som ble glemt.

- [ ] **Step 4: Sjekk at det gamle temanavnet er borte fra kilden**

Run: `grep -rn "bandTheme\|THEMES\|DEFAULT_THEME" src/`
Expected: ingen treff.

`grep -rn "theme" src/` skal fortsatt gi treff i `src/departures/` og `src/components/Departures.jsx` — der er `theme` navnet på `palette.mode`-argumentet til `categoryFill`, `badgeText` og `warningStyle`, og det er urørt av denne endringen.

- [ ] **Step 5: Manuell sjekk i admin**

Run: `npm run dev`

Åpne admin for en tavle og bekreft:
- fire innrammede seksjoner: Branding, Velkomstmelding, Karusellen, Bunnstripa
- hver seksjon har en fargevelger med seks prøver; navnet står i flatens egen tekstfarge, og den hvite prøven er synlig mot sidens bakgrunn
- tabulering treffer fargeprøvene, og fokusringen er synlig på kortet
- «Fjern» på et karusellkort får kortet til å forsvinne, og modulen dukker opp i «Legg til»-raden
- velger du «Været» i bunnstripa, forsvinner vær-kortet fra karusellen *og* fra «Legg til»-raden
- setter du bunnstripa til «Ingen», er «Været» tilgjengelig i karusellen igjen
- lagring virker, og «Lagret» vises

- [ ] **Step 6: Manuell sjekk på tavla**

Sett Branding til «Fersken» og Velkomstmelding til «Mørk blå», lagre, og åpne `/t/<boardId>`.

Bekreft:
- toppen er fersken med den *fargede* logoen (velg Entur-logo i stedet for video for å se den)
- midtfeltet er mørkeblått med hvit tekst
- de to feltene leses som to felt

Sett så begge til «Mørk blå» og bekreft at tavla ser ut som den gjorde før endringen.

- [ ] **Step 7: Verifiser migreringen på et gammelt dokument**

I Firestore-konsollet (eller emulatoren), finn en tavle som har `theme` men ikke `topSurface`. Åpne `/t/<boardId>` og bekreft at den ser identisk ut som før: `dark` gir mørkeblå topp og midt, `light` gir lavendel.

Dette er den ene tingen testene ikke kan bevise alene — at et *virkelig* dokument overlever oppgraderingen.

- [ ] **Step 8: Ingen commit**

Verifiseringen endrer ingen filer. Går noe galt, er det en feil å rette i tasken den hører til.

---

## Selvgjennomgang

**Spec-dekning:** Datamodell → Task 1. `boardTheme`-krympingen → Task 2. Render-siden → Task 3. `firestore.rules` med `isSurface` og valgfritt `theme` → Task 4. Valideringen over fire felt → Task 5. `boardDraft.js` med `draftFrom`/`configFrom` → Task 6. Kortoperasjonene → Task 7. `FormSection`, `SurfacePicker`, `admin.css` → Task 8. Branding og Velkomstmelding, med `placeName` flyttet → Task 9. Kort og «Legg til» → Task 10. Bunnstripas nedtrekksmeny → Task 11. Rammen og `NewBoardForm` → Task 12. `MODULE_LABELS` → Task 1, brukt i Task 10 og 11. Testlista i spec-en → Task 1, 2, 4, 5, 6, 7. Den praktiske delen (`yarn install`, `npm run build`, manuell sjekk) → Task 0 og Task 13.

**Utenfor omfanget, som i spec-en:** rekkefølge-styring, nye modultyper, egne koordinater per plassering, `@entur/dropdown`, og `BoardAccess`/`BoardAlerts`/sletting.

**Navnekonsistens:** `logoSrcFor(mode)` brukes med samme navn i Task 2 og 3. `carouselCards`, `availableCarouselTypes`, `addCarouselModule`, `removeCarouselModule`, `bottomModule`, `setBottomModule` defineres i Task 7 og konsumeres med samme navn i Task 10, 11 og 12. `WeatherFields` er en default export fra sin egen fil `src/admin/WeatherFields.jsx` (Task 10), importert av både `CarouselSection.jsx` og `BottomSection.jsx` (Task 11) — ingen av seksjonene importerer fra den andre. `MODULE_LABELS` defineres i Task 1. `SURFACE_FIELDS` er lokal i `boardValidation.js`. `bandSurfaceFrom(source, field)` er lokal i `boardConfig.js`.
