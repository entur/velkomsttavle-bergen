# Sporendring, gule avvik og TravelTag — implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avgangsvisninga uthever sporendring og avvik i gult, og linjemerket blir en `TravelTag` med Bane NORs linjefarger.

**Architecture:** Fire små, rene moduler uten JSX gjør jobben — sporendring utledes i `departureMapper`, den gule fargen eies av `warningStyle`, linjefargen av `categoryFill`, og transportmiddelet oversettes av `travelTagTransport`. `Departures.jsx` kobler dem sammen og eier ingen egen logikk. Alle fire kan testes med `node --test`, som er mønsteret resten av repoet følger.

**Tech Stack:** React 19, Vite 8, `@entur/travel`, `@entur/icons`, `@entur/tokens`, `node --test`.

**Spec:** `docs/superpowers/specs/2026-08-11-sporendring-og-traveltag-design.md`

## Global Constraints

Disse gjelder implisitt i **hver** oppgave under.

- **Nettlesergrense: Chromium 85.** Tavla kjører på en Samsung-skjerm med Tizen. `Object.hasOwn`, `.at(`, `.findLast`, `.toSorted`, `structuredClone`, `Array.fromAsync` og `.withResolvers(` er forbudt i kildekode som sendes til nettleseren. `src/browserBaseline.test.mjs` håndhever lista. `?.`, `??`, `Number.isInteger` og `Array.isArray` er trygge.
- **Testfiler er unntatt.** Filer som matcher `.test.` eller `.spec.` kjører i Node og står fritt.
- **Ingen JSX i moduler som skal testes.** `node --test` kjører uten JSX-transform. Ren logikk hører hjemme i `.js`-filer uten JSX; komponenter i `.jsx`.
- **Kommentarene forklarer hvorfor, ikke hva.** Repoet er skrevet på norsk, med kommentarer som begrunner valg. Følg tonen i `src/departures/lineAppearance.js` og `src/boards/surfaces.js`.
- **Kjør `npm test` før hver commit.** Alle tester skal være grønne.
- **`npm run build` skal passere** før siste commit i oppgave 6.

## Filstruktur

| Fil | Ansvar |
|---|---|
| `src/departures/enturDepartures.js` | *Endres.* GraphQL-spørringa henter planlagt kvai |
| `src/departures/departureMapper.js` | *Endres.* `isPlatformChanged` + feltet `platformChanged` |
| `src/departures/departureMapper.test.mjs` | *Endres.* Tester for sporendring |
| `src/testing/contrast.mjs` | *Ny.* WCAG-regning, delt mellom to testfiler |
| `src/boards/surfaces.test.mjs` | *Endres.* Bruker den delte hjelperen |
| `src/departures/warningStyle.js` | *Ny.* Eier den gule avviksfargen, lys og mørk |
| `src/departures/warningStyle.test.mjs` | *Ny.* Kontrastmåling mot alle seks flatene |
| `src/departures/categoryFill.js` | *Ny.* Bane NOR-fargen for L/R/F, `null` ellers |
| `src/departures/categoryFill.test.mjs` | *Ny.* |
| `src/departures/lineAppearance.js` | *Slettes i oppgave 6.* Erstattet av `categoryFill` |
| `src/departures/lineAppearance.test.mjs` | *Slettes i oppgave 6.* |
| `src/departures/travelTagTransport.js` | *Ny.* Hviteliste — krasjsperre mot `getTransportStyle` |
| `src/departures/travelTagTransport.test.mjs` | *Ny.* Rendrer `TravelTag` for hver verdi |
| `src/components/Departures.jsx` | *Endres.* Kobler modulene sammen |
| `src/css/main.css` | *Endres.* Importerer travel-stilarket, skalerer merket, dekker Tizen |

Rekkefølgen er valgt slik at oppgave 1–4 er rene moduler med egne tester, og 5–6 er koblinga. Oppgave 5 og 6 rører samme fil, men ulike deler av den, og skal gjøres i rekkefølge.

---

### Task 1: Sporendring i datalaget

Journey Planner har ikke noe felt for sporendring. Den utledes ved å sammenlikne planlagt kvai (`serviceJourney.quays[stopPositionInPattern]`) med den sanntid faktisk gir (`estimatedCall.quay`).

**Files:**
- Modify: `src/departures/enturDepartures.js:32-48` (konstanten `QUERY`)
- Modify: `src/departures/departureMapper.js:31-45` (`toDeparture`)
- Test: `src/departures/departureMapper.test.mjs`

**Interfaces:**
- Consumes: ingenting fra tidligere oppgaver.
- Produces: `isPlatformChanged(estimatedCall) → boolean`, eksportert fra `departureMapper.js`. Feltet `platformChanged: boolean` på hvert avgangsobjekt. Oppgave 5 leser feltet.

- [ ] **Step 1: Skriv de feilende testene**

Legg til i `src/departures/departureMapper.test.mjs`. Importlinja øverst utvides med `isPlatformChanged`:

```js
import { isDelayed, isPlatformChanged, situationText, toDeparture, toDepartures } from './departureMapper.js';
```

Hjelperen `call()` i samme fil gir i dag `quay: { publicCode: '1' }` og en `serviceJourney` uten `quays`. La den stå urørt — testene under sender sine egne overstyringer, og at `call()` uten `quays` gir `false` er nettopp det siste testtilfellet.

Legg dette til nederst i fila:

```js
/** En EstimatedCall der planlagt og faktisk kvai kan settes hver for seg. */
function medKvai({ planlagt, faktisk, posisjon = 1 }) {
    return call({
        stopPositionInPattern: posisjon,
        quay: { id: faktisk, publicCode: '1' },
        serviceJourney: {
            line: { publicCode: 'L4', transportMode: 'rail' },
            quays: [{ id: 'NSR:Quay:100' }, { id: planlagt }, { id: 'NSR:Quay:102' }],
        },
    });
}

describe('isPlatformChanged', () => {
    it('er sann når sanntid gir en annen kvai enn rutemønsteret', () => {
        assert.equal(isPlatformChanged(medKvai({ planlagt: 'NSR:Quay:5', faktisk: 'NSR:Quay:9' })), true);
    });

    it('er usann når kvaiene er like', () => {
        assert.equal(isPlatformChanged(medKvai({ planlagt: 'NSR:Quay:5', faktisk: 'NSR:Quay:5' })), false);
    });

    it('er usann når rutemønsteret mangler', () => {
        // En tavle som ikke vet, skal ikke rope.
        assert.equal(isPlatformChanged(call()), false);
        assert.equal(isPlatformChanged({}), false);
        assert.equal(isPlatformChanged(null), false);
    });

    it('er usann når posisjonen peker utenfor lista', () => {
        assert.equal(isPlatformChanged(medKvai({ planlagt: 'NSR:Quay:5', faktisk: 'NSR:Quay:9', posisjon: 7 })), false);
        assert.equal(isPlatformChanged(medKvai({ planlagt: 'NSR:Quay:5', faktisk: 'NSR:Quay:9', posisjon: -1 })), false);
    });

    it('er usann når posisjonen ikke er et heltall', () => {
        assert.equal(isPlatformChanged(medKvai({ planlagt: 'NSR:Quay:5', faktisk: 'NSR:Quay:9', posisjon: null })), false);
        assert.equal(isPlatformChanged(medKvai({ planlagt: 'NSR:Quay:5', faktisk: 'NSR:Quay:9', posisjon: 1.5 })), false);
    });

    it('er usann når en av kvai-id-ene er tom', () => {
        assert.equal(isPlatformChanged(medKvai({ planlagt: '', faktisk: 'NSR:Quay:9' })), false);
        assert.equal(isPlatformChanged(medKvai({ planlagt: 'NSR:Quay:5', faktisk: '' })), false);
    });
});

describe('toDeparture — sporendring', () => {
    it('legger platformChanged på avgangen', () => {
        assert.equal(toDeparture(medKvai({ planlagt: 'NSR:Quay:5', faktisk: 'NSR:Quay:9' })).platformChanged, true);
        assert.equal(toDeparture(medKvai({ planlagt: 'NSR:Quay:5', faktisk: 'NSR:Quay:5' })).platformChanged, false);
        assert.equal(toDeparture({}).platformChanged, false);
    });
});
```

- [ ] **Step 2: Kjør testene og se at de feiler**

```bash
npm test 2>&1 | grep -A3 "isPlatformChanged"
```

Forventet: FAIL — `isPlatformChanged is not a function` / `SyntaxError` fra importen som ikke finnes.

- [ ] **Step 3: Implementer `isPlatformChanged`**

Legg til i `src/departures/departureMapper.js`, rett under `isDelayed`:

```js
/**
 * Sant når toget går fra et annet spor enn planlagt.
 *
 * Journey Planner v3 har ikke noe felt for dette — hverken `platformChanged`
 * eller liknende finnes på `EstimatedCall`. Sondert mot skjemaet.
 *
 * Utledningen: `serviceJourney.quays` er kvaiene i rutemønsteret, altså
 * planverket, og `stopPositionInPattern` peker inn i den lista.
 * `estimatedCall.quay` er den sanntid faktisk gir. Er de ulike, er sporet endret.
 *
 * Ulikhet er det ENESTE som utløser gult. Mangler rutemønsteret, peker
 * posisjonen utenfor lista, eller er en av id-ene tom, er svaret `false`. En
 * tavle som ikke vet, skal ikke rope.
 *
 * Merk at sammenlikninga går på kvai-id og ikke `publicCode`: to ulike kvaier
 * kan ha samme spornummer på hvert sitt stoppested.
 */
export function isPlatformChanged(estimatedCall) {
    const quays = estimatedCall?.serviceJourney?.quays;
    const position = estimatedCall?.stopPositionInPattern;
    if (!Array.isArray(quays) || !Number.isInteger(position)) {
        return false;
    }
    const planned = asText(quays[position]?.id);
    const actual = asText(estimatedCall?.quay?.id);
    return planned !== '' && actual !== '' && planned !== actual;
}
```

Og legg feltet på avgangen i `toDeparture`, rett etter `platform`:

```js
        platform: asText(estimatedCall?.quay?.publicCode),
        platformChanged: isPlatformChanged(estimatedCall),
```

- [ ] **Step 4: Kjør testene og se at de passerer**

```bash
npm test
```

Forventet: PASS, alle.

- [ ] **Step 5: Utvid GraphQL-spørringa**

I `src/departures/enturDepartures.js`, inne i `QUERY`, endre `estimatedCalls`-blokka slik at den henter det utledningen trenger. Tre endringer: ny linje `stopPositionInPattern`, `id` lagt til på `quay`, og `quays { id }` lagt til på `serviceJourney`.

```graphql
    estimatedCalls(numberOfDepartures: $count, timeRange: $timeRange, includeCancelledTrips: true) {
      realtime
      cancellation
      aimedDepartureTime
      expectedDepartureTime
      stopPositionInPattern
      destinationDisplay { frontText }
      quay { id publicCode }
      situations { summary { value language } }
      serviceJourney {
        line { publicCode transportMode }
        quays { id }
      }
    }
```

Legg samtidig denne kommentaren rett over `const QUERY`, under den som allerede står der:

```js
// `stopPositionInPattern` og `serviceJourney.quays` henter vi bare for å kunne
// utlede sporendring: APIet har ikke noe felt for det. Se `isPlatformChanged`.
// `quays` er hele rutemønsteret, 6–18 kvaier per avgang, som er billig nok for
// seks avganger og det eneste stedet planlagt spor finnes.
```

- [ ] **Step 6: Verifiser spørringa mot det ekte APIet**

Dette er ikke en enhetstest — det er en engangssjekk på at spørringa validerer og at feltene finnes. Kjør:

```bash
curl -s -X POST https://api.entur.io/journey-planner/v3/graphql -H 'Content-Type: application/json' -H 'ET-Client-Name: entur-velkomsttavle' -d '{"query":"{ stopPlace(id:\"NSR:StopPlace:548\") { name estimatedCalls(numberOfDepartures:3, timeRange:10800, includeCancelledTrips:true) { stopPositionInPattern quay { id publicCode } serviceJourney { quays { id } } } } }"}'
```

Forventet: JSON uten `errors`-nøkkel, med `stopPositionInPattern` som tall og `quays` som liste. Kommer det `errors`, er spørringa feil — rett den før du går videre.

- [ ] **Step 7: Kjør hele testsuiten og commit**

```bash
npm test
```

Forventet: PASS. `enturDepartures.test.mjs` sjekker at spørringa ikke inneholder ordet `cancelled`; det gjør den fortsatt ikke.

```bash
git add src/departures/departureMapper.js src/departures/departureMapper.test.mjs src/departures/enturDepartures.js
git commit -m "feat: utled sporendring fra planlagt mot faktisk kvai"
```

---

### Task 2: `warningStyle` — den gule avviksfargen

Gul brukes som **tekst** på mørke flater og som **fyll** på lyse. Canary mot lys lavendel er kontrast 1.10, altså usynlig; mørkeblå på canary er 10.25.

**Files:**
- Create: `src/testing/contrast.mjs` (delt WCAG-hjelper)
- Modify: `src/boards/surfaces.test.mjs:12-23` (bruk den delte hjelperen)
- Create: `src/departures/warningStyle.js`
- Test: `src/departures/warningStyle.test.mjs`

**Interfaces:**
- Consumes: `SURFACES` og `surfacePalette` fra `src/boards/surfaces.js` (bare i testen).
- Produces: `warningStyle(theme) → { color, backgroundColor, border }`. `theme` er `'dark'` eller hva som helst annet. Oppgave 5 kaller den med `palette.mode`. Og `contrast(a, b) → number` fra `src/testing/contrast.mjs`.

- [ ] **Step 1: Trekk ut kontrasthjelperen**

`surfaces.test.mjs` har allerede WCAG-regninga. To testfiler som trenger den skal dele den, ikke ha hver sin kopi.

Opprett `src/testing/contrast.mjs`:

```js
/**
 * WCAG-kontrast mellom to hex-farger.
 *
 * Bor utenfor testfilene fordi to av dem trenger den: `surfaces.test.mjs`
 * måler de seks flatene, `warningStyle.test.mjs` måler den gule uthevinga mot
 * de samme flatene. Én formel, ett sted.
 *
 * Fila blir lest av `browserBaseline.test.mjs` som en hvilken som helst
 * kildefil, siden navnet ikke inneholder `.test.`. Det er greit — den holder
 * seg til `parseInt`, `Math` og `String.replace`, som alle er eldre enn
 * grensa. Vite bunter den ikke, for ingenting i appen importerer den.
 */
export function contrast(a, b) {
    const lum = (hex) => {
        const c = hex.replace('#', '').match(/../g)
            .map((x) => parseInt(x, 16) / 255)
            .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const [l1, l2] = [lum(a), lum(b)];
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
```

I `src/boards/surfaces.test.mjs`, slett den lokale `contrast`-funksjonen med JSDoc-kommentaren over (linje 12–23) og legg til importen i stedet, etter de andre importene:

```js
import { contrast } from '../testing/contrast.mjs';
```

Kjør `node --test src/boards/surfaces.test.mjs` og se at den fortsatt er grønn før du går videre. Blir den rød, har uttrekket endret oppførsel — rett det før du fortsetter.

- [ ] **Step 2: Skriv den feilende testen**

Opprett `src/departures/warningStyle.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { colors } from '@entur/tokens';

import { SURFACES, surfacePalette } from '../boards/surfaces.js';
import { contrast } from '../testing/contrast.mjs';
import { warningStyle } from './warningStyle.js';

describe('warningStyle', () => {
    it('er lesbar på alle seks flatene tavla kan ha', () => {
        // Dette er hele poenget med modulen. Gul tekst er 1.10 mot lys
        // lavendel; uten denne testen kommer den feilen tilbake.
        for (const name of SURFACES) {
            const palette = surfacePalette(name);
            const style = warningStyle(palette.mode);
            const bak = style.backgroundColor === 'transparent'
                ? palette.background
                : style.backgroundColor;
            const maalt = contrast(style.color, bak);
            assert.ok(maalt >= 4.5, `${name}: kontrast ${maalt.toFixed(2)}, krever 4.5`);
        }
    });

    it('bruker gul tekst uten fyll i mørkt tema', () => {
        const style = warningStyle('dark');
        assert.equal(style.color, colors.validation.canary);
        assert.equal(style.backgroundColor, 'transparent');
        assert.equal(style.border, 'none');
    });

    it('bruker gult fyll med mørkeblå tekst og kant i lyst tema', () => {
        const style = warningStyle('light');
        assert.equal(style.backgroundColor, colors.validation.canary);
        assert.equal(style.color, colors.brand.blue);
        assert.ok(style.border.startsWith('2px'));
    });

    it('faller til den lyse varianten for ukjent modus', () => {
        // Fyll med mørk tekst er lesbart mot enhver flate. Gul tekst er det
        // ikke, så det er den lyse varianten som er den trygge standarden.
        for (const ukjent of [undefined, null, '', 'lilla']) {
            assert.equal(warningStyle(ukjent).backgroundColor, colors.validation.canary);
        }
    });
});
```

- [ ] **Step 3: Kjør testen og se at den feiler**

```bash
node --test src/departures/warningStyle.test.mjs
```

Forventet: FAIL — `Cannot find module` for `./warningStyle.js`.

- [ ] **Step 4: Implementer `warningStyle`**

Opprett `src/departures/warningStyle.js`:

```js
/**
 * Fargen på et avvik i avgangstavla — sporendring eller avviksmelding.
 *
 * Gul brukes som TEKST på mørke flater og som FYLL på lyse. Det er ikke smak:
 * canary mot lys lavendel, som er standardflata i karusellen, er kontrast 1.10.
 * Altså usynlig. Mørkeblå på canary er 10.25, og canary på mørkeblå er det samme.
 *
 * `Chip` i `Departures.jsx` har fulgt regelen lenge uten å ha navn på den. Her
 * får den navn, slik at sporet og avviksmeldinga arver den i stedet for å
 * gjenta den — og slik at kontrastkravet kan testes ett sted.
 *
 * Ukjent modus gir den lyse varianten. Fyll med mørk tekst er lesbart mot
 * enhver flate; gul tekst er det bare mot to av seks. Den trygge er standarden.
 */
import { colors } from '@entur/tokens';

export function warningStyle(theme) {
    if (theme === 'dark') {
        return {
            color: colors.validation.canary,
            backgroundColor: 'transparent',
            border: 'none',
        };
    }
    return {
        color: colors.brand.blue,
        backgroundColor: colors.validation.canary,
        border: `2px solid ${colors.brand.blue}`,
    };
}
```

- [ ] **Step 5: Kjør testen og se at den passerer**

```bash
node --test src/departures/warningStyle.test.mjs
```

Forventet: PASS, fire tester.

- [ ] **Step 6: Commit**

```bash
npm test
```

Forventet: PASS på hele suiten, inkludert `surfaces.test.mjs` med den delte hjelperen.

```bash
git add src/testing/contrast.mjs src/boards/surfaces.test.mjs src/departures/warningStyle.js src/departures/warningStyle.test.mjs
git commit -m "feat: warningStyle eier den gule avviksfargen"
```

---

### Task 3: `categoryFill` erstatter `lineAppearance`

`lineAppearance` gir i dag alltid et fyll — Bane NOR for L/R/F, ellers Enturs transportpalett, ellers en nøytral. Med `TravelTag` trenger vi bare den første delen: resten fargelegger komponenten selv, og det er logikk Entur allerede eier.

**Files:**
- Create: `src/departures/categoryFill.js`
- Test: `src/departures/categoryFill.test.mjs`

`lineAppearance` blir stående til oppgave 6. Den slettes først når `Departures.jsx` har sluttet å importere den — sletter du den nå, er bygget og preview brutt gjennom oppgave 5, og da kan du ikke se på det du lager der.

**Interfaces:**
- Consumes: ingenting fra tidligere oppgaver.
- Produces: `categoryFill(lineCode, theme) → { background, text, border } | null`. `null` betyr «la TravelTag fargelegge selv». Oppgave 6 bruker den.

- [ ] **Step 1: Skriv den feilende testen**

Opprett `src/departures/categoryFill.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { colors } from '@entur/tokens';

import { categoryFill } from './categoryFill.js';

describe('categoryFill — togkategori', () => {
    it('gir lokaltog grønt, regiontog rødt og fjerntog blått i lyst tema', () => {
        assert.equal(categoryFill('L4', 'light').background, colors.validation.mint);
        assert.equal(categoryFill('R40', 'light').background, colors.validation.lava);
        assert.equal(categoryFill('F4', 'light').background, colors.validation.sky);
    });

    it('bruker kontrast-variantene i mørkt tema', () => {
        assert.equal(categoryFill('L4', 'dark').background, colors.validation.mintContrast);
        assert.equal(categoryFill('R40', 'dark').background, colors.validation.lavaContrast);
        assert.equal(categoryFill('F4', 'dark').background, colors.validation.skyContrast);
    });

    it('godtar liten forbokstav', () => {
        assert.equal(categoryFill('l4', 'light').background, colors.validation.mint);
    });
});

describe('categoryFill — når TravelTag skal fargelegge selv', () => {
    it('gir null for linjer uten kategorikode', () => {
        // «Lillestrøm» er ikke en L-kategori. Uten tallkravet ville enhver
        // linje som tilfeldigvis begynner på L blitt grønn.
        assert.equal(categoryFill('Lillestrøm', 'light'), null);
        assert.equal(categoryFill('RE', 'light'), null);
        assert.equal(categoryFill('51', 'light'), null);
        assert.equal(categoryFill('2', 'dark'), null);
    });

    it('gir null når linjekoden mangler eller ikke er en streng', () => {
        assert.equal(categoryFill(undefined, 'light'), null);
        assert.equal(categoryFill(null, 'dark'), null);
        assert.equal(categoryFill('', 'light'), null);
        assert.equal(categoryFill(4, 'light'), null);
    });
});

describe('categoryFill — tekst og kant', () => {
    it('setter hvit tekst i lyst tema og mørkeblå i mørkt', () => {
        assert.equal(categoryFill('L4', 'light').text, '#ffffff');
        assert.equal(categoryFill('L4', 'dark').text, colors.brand.blue);
    });

    it('har kant bare i lyst tema', () => {
        // I lyst tema er fyllet bare 2.1–3.4 mot lavendel og fersken, så
        // formen forsvinner uten kant. I mørkt tema er det 4.3–7.4.
        assert.ok(categoryFill('L4', 'light').border.startsWith('2px'));
        assert.equal(categoryFill('L4', 'dark').border, 'none');
    });
});
```

- [ ] **Step 2: Kjør testen og se at den feiler**

```bash
node --test src/departures/categoryFill.test.mjs
```

Forventet: FAIL — `Cannot find module` for `./categoryFill.js`.

- [ ] **Step 3: Implementer `categoryFill`**

Opprett `src/departures/categoryFill.js`:

```js
/**
 * Bane NORs farge på linjemerket, eller `null`.
 *
 * Fargen settes av linjekategori — L lokaltog, R regiontog, F fjerntog — fordi
 * det er kodingen Bane NOR bruker på perrongskjermene. Den reisende går fra
 * billettkontoret til sporet og møter samme farge.
 *
 * Enturs eget `line.presentation.colour` brukes IKKE: det er en operatørfarge,
 * ikke en linjefarge. Alle tre togene fra Bergen stasjon er Vy og får samme
 * røde, og de fleste bussrutene har feltet tomt. Verifisert mot APIet.
 *
 * Hex-verdiene er de nærmeste tokenene i Entur-designsystemet, ikke målt på
 * Bane NORs skjermer. De kan justeres.
 *
 * `null` for alt annet er et valg, ikke en mangel: da fargelegger `TravelTag`
 * seg selv fra transportmiddelet. Den logikken eier Entur allerede, og en kopi
 * her ville bare drevet fra originalen.
 */
import { colors } from '@entur/tokens';

const CATEGORY = {
    L: { light: colors.validation.mint, dark: colors.validation.mintContrast },
    R: { light: colors.validation.lava, dark: colors.validation.lavaContrast },
    F: { light: colors.validation.sky, dark: colors.validation.skyContrast },
};

// Tallet er ikke pynt: «L4» er en kategori, «Lillestrøm» er et stedsnavn.
const CATEGORY_CODE = /^([LRF])\d+$/i;

export function categoryFill(lineCode, theme) {
    const match = typeof lineCode === 'string' ? CATEGORY_CODE.exec(lineCode) : null;
    if (match === null) {
        return null;
    }
    const dark = theme === 'dark';
    return {
        background: CATEGORY[match[1].toUpperCase()][dark ? 'dark' : 'light'],
        text: dark ? colors.brand.blue : '#ffffff',
        // Kanten finnes bare i lyst tema. Der er fyllet 2.1–3.4 mot lavendel og
        // fersken, altså under 3.0 der formen skal leses. I mørkt tema er det
        // 4.3–7.4 mot flata og trenger ingen.
        border: dark ? 'none' : `2px solid ${colors.brand.blue}`,
    };
}
```

- [ ] **Step 4: Kjør testen og se at den passerer**

```bash
node --test src/departures/categoryFill.test.mjs
```

Forventet: PASS, syv tester.

- [ ] **Step 5: Kjør hele testsuiten og commit**

```bash
npm test
```

Forventet: PASS. Både `categoryFill.test.mjs` og den gamle `lineAppearance.test.mjs` kjører grønt side om side — de to modulene lever parallelt til oppgave 6.

```bash
git add src/departures/categoryFill.js src/departures/categoryFill.test.mjs
git commit -m "feat: categoryFill gir Bane NOR-farge eller null"
```

---

### Task 4: `travelTagTransport` — krasjsperre

`getTransportStyle` i `@entur/travel` **kaster** på alt den ikke kjenner. Fem av Enturs fjorten `transportMode`-verdier — `coach`, `lift`, `monorail`, `trolleybus` og `unknown` — treffer `default:` og gir `Error("Please select a transport for the Travel component.")`. `coach` er vanlig på regionbusser.

**Files:**
- Create: `src/departures/travelTagTransport.js`
- Test: `src/departures/travelTagTransport.test.mjs`

**Interfaces:**
- Consumes: ingenting fra tidligere oppgaver.
- Produces: `travelTagTransport(transportMode) → string`. Returverdien er alltid trygg å sende som `transport`-prop til `TravelTag`. Oppgave 6 bruker den.

- [ ] **Step 1: Skriv den feilende testen**

Opprett `src/departures/travelTagTransport.test.mjs`. Testen rendrer den ekte `TravelTag` med `react-dom/server`, fordi `getTransportStyle` ikke er eksportert fra pakka — komponenten er eneste vei inn til den. Ingen JSX: `createElement` direkte, siden `node --test` kjører uten transform.

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TravelTag } from '@entur/travel';

import { travelTagTransport } from './travelTagTransport.js';

/** Hele TransportMode-enumet i Journey Planner v3, sondert mot skjemaet. */
const ENTUR_MODES = [
    'air', 'bus', 'cableway', 'water', 'funicular', 'lift',
    'rail', 'metro', 'taxi', 'tram', 'trolleybus', 'monorail', 'coach', 'unknown',
];

function rendrer(transport) {
    return renderToStaticMarkup(createElement(TravelTag, { transport }, '51'));
}

describe('travelTagTransport — krasjsperre', () => {
    it('gir en verdi TravelTag godtar for hver TransportMode Entur kan sende', () => {
        // Dette er hele grunnen til at modulen finnes. getTransportStyle
        // kaster på ukjente verdier, og Departures ville forsvunnet fra
        // karusellen på første regionbuss.
        for (const mode of ENTUR_MODES) {
            assert.doesNotThrow(() => rendrer(travelTagTransport(mode)), `transportMode ${mode}`);
        }
    });

    it('tåler søppel og manglende verdi', () => {
        for (const rot of ['', 'hyperloop', 'scooter', 'bike', 'car', 'foot', null, undefined, 42, {}]) {
            assert.doesNotThrow(() => rendrer(travelTagTransport(rot)), `verdi ${String(rot)}`);
        }
    });

    it('beviser at sperra faktisk sperrer', () => {
        // Negativ kontroll. Uten den er testen over verdiløs: den ville
        // passert selv om travelTagTransport var en ren passthrough.
        for (const farlig of ['coach', 'lift', 'monorail', 'trolleybus', 'unknown']) {
            assert.throws(() => rendrer(farlig), /select a transport/, `${farlig} skulle kastet urørt`);
        }
        assert.throws(() => rendrer('scooter'), /deprecated/);
    });
});

describe('travelTagTransport — oversettelsen', () => {
    it('slipper gjennom middel TravelTag kjenner fra før', () => {
        for (const mode of ['air', 'bus', 'cableway', 'water', 'funicular', 'rail', 'metro', 'taxi', 'tram']) {
            assert.equal(travelTagTransport(mode), mode);
        }
    });

    it('oversetter middel TravelTag ikke har egen sak for', () => {
        assert.equal(travelTagTransport('coach'), 'bus');
        assert.equal(travelTagTransport('trolleybus'), 'bus');
        assert.equal(travelTagTransport('monorail'), 'metro');
        assert.equal(travelTagTransport('lift'), 'cableway');
    });

    it('gir none for ukjent, tomt og ikke-streng', () => {
        assert.equal(travelTagTransport('unknown'), 'none');
        assert.equal(travelTagTransport('hyperloop'), 'none');
        assert.equal(travelTagTransport(''), 'none');
        assert.equal(travelTagTransport(null), 'none');
        assert.equal(travelTagTransport(undefined), 'none');
        assert.equal(travelTagTransport(42), 'none');
    });

    it('sender aldri de utgåtte verdiene videre', () => {
        // scooter, bike, car og foot har egne grener som kaster med
        // «deprecated». De skal aldri kunne komme ut av oppslagstabellen.
        for (const utgaatt of ['scooter', 'bike', 'car', 'foot']) {
            assert.equal(travelTagTransport(utgaatt), 'none');
        }
    });
});
```

- [ ] **Step 2: Kjør testen og se at den feiler**

```bash
node --test src/departures/travelTagTransport.test.mjs
```

Forventet: FAIL — `Cannot find module` for `./travelTagTransport.js`.

- [ ] **Step 3: Implementer `travelTagTransport`**

Opprett `src/departures/travelTagTransport.js`:

```js
/**
 * Enturs `transportMode` oversatt til `transport`-propen på `TravelTag`.
 *
 * Dette er en krasjsperre, ikke pynt. `getTransportStyle` i `@entur/travel`
 * kaster på alt den ikke kjenner: `default:` gir «Please select a transport for
 * the Travel component», og `scooter`, `bike`, `car` og `foot` kaster hver for
 * seg som utgåtte. Fem av de fjorten verdiene i Enturs TransportMode-enum —
 * `coach`, `lift`, `monorail`, `trolleybus` og `unknown` — treffer `default:`.
 * `coach` er vanlig på regionbusser.
 *
 * `Departures` ligger inne i en `ErrorBoundary`, så et kast gir ikke hvit
 * skjerm — men avgangstavla forsvinner fra karusellen til neste henting.
 *
 * Derfor en oppslagstabell og ikke en passthrough med unntak: det som ikke står
 * her blir `none`, som `TravelTag` håndterer med et tomt ikon. En ny verdi i
 * Enturs enum gir da et merke uten ikon, ikke en tom karusellslide.
 */
const TRANSPORT = {
    air: 'air',
    bus: 'bus',
    cableway: 'cableway',
    coach: 'bus',
    funicular: 'funicular',
    lift: 'cableway',
    metro: 'metro',
    monorail: 'metro',
    rail: 'rail',
    taxi: 'taxi',
    tram: 'tram',
    trolleybus: 'bus',
    water: 'water',
};

export function travelTagTransport(transportMode) {
    if (typeof transportMode !== 'string') {
        return 'none';
    }
    return TRANSPORT[transportMode] ?? 'none';
}
```

- [ ] **Step 4: Kjør testen og se at den passerer**

```bash
node --test src/departures/travelTagTransport.test.mjs
```

Forventet: PASS, syv tester — inkludert den negative kontrollen som beviser at de fem farlige verdiene faktisk kaster urørt.

- [ ] **Step 5: Commit**

```bash
npm test
git add src/departures/travelTagTransport.js src/departures/travelTagTransport.test.mjs
git commit -m "feat: travelTagTransport sperrer mot at ukjent middel tar ned tavla"
```

---

### Task 5: Spor og avviksmelding i gult

**Files:**
- Modify: `src/components/Departures.jsx` — importlinjene, sporcella (`:111-113`), avviksmeldinga (`:105-109`)

**Interfaces:**
- Consumes: `warningStyle(theme)` fra oppgave 2, feltet `departure.platformChanged` fra oppgave 1.
- Produces: ingenting for senere oppgaver.

Ingen enhetstest her — repoet har ingen JSX-testoppsett, og komponentene verifiseres i preview. Det er mønsteret alle de andre komponentene følger.

- [ ] **Step 1: Legg til importene**

I `src/components/Departures.jsx`, utvid importblokka øverst:

```jsx
import { Fragment, useEffect, useState } from 'react';
import { Heading3, Paragraph } from '@entur/typography';
import { colors } from '@entur/tokens';
import { ValidationExclamationCircleFilledIcon } from '@entur/icons';

import { lineAppearance } from '../departures/lineAppearance';
import { countdownLabel } from '../departures/departureCountdown';
import { isDelayed } from '../departures/departureMapper';
import { warningStyle } from '../departures/warningStyle';
```

`lineAppearance` står fortsatt her — den byttes i oppgave 6.

- [ ] **Step 2: Legg til `Avviksmelding`-komponenten**

Sett den rett under `Chip`, før `Melding`:

```jsx
/**
 * Avvikstekst fra Journey Planner, med varselikon.
 *
 * Formen følger `warningStyle`: gul tekst uten fyll på mørke flater, gul boks
 * med mørkeblå tekst på lyse. Ikonet arver `color`, så det bytter med teksten.
 *
 * Ingen `opacity` her, i motsetning til den gamle `↳`-linja: kontrasten er målt
 * til 10.25, og en gjennomsiktighet på 0.85 ville spist av den uten å gi noe.
 */
function Avviksmelding({ text, theme }) {
    return (
        <span style={{ display: 'block', marginTop: '0.35rem' }}>
            <span style={{
                ...warningStyle(theme),
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                borderRadius: '8px', padding: '0.1rem 0.6rem',
                fontSize: '1.25rem', lineHeight: 1.4,
            }}>
                <ValidationExclamationCircleFilledIcon aria-hidden="true" />
                {text}
            </span>
        </span>
    );
}
```

- [ ] **Step 3: Legg til `Spor`-komponenten**

Rett under `Avviksmelding`:

```jsx
/**
 * Spornummeret. Uthevet når toget er flyttet fra planlagt spor.
 *
 * Pilleformen er den samme `Chip` bruker, slik at et endret spor leses som en
 * markering og ikke som en annen skrifttype.
 */
function Spor({ platform, changed, theme }) {
    if (!platform) {
        return <span />;
    }
    if (!changed) {
        return <span style={{ whiteSpace: 'nowrap' }}>Spor {platform}</span>;
    }
    return (
        <span style={{
            ...warningStyle(theme),
            whiteSpace: 'nowrap', borderRadius: '999px',
            padding: '0.15rem 0.75rem', fontWeight: 700,
        }}>
            Spor {platform}
        </span>
    );
}
```

- [ ] **Step 4: Bruk dem i raden**

Erstatt avviks-blokka inne i destinasjonscella:

```jsx
                            <span>
                                {departure.destination}
                                {departure.situation && (
                                    <Avviksmelding text={departure.situation} theme={palette.mode} />
                                )}
                            </span>
```

Og hele sporcella:

```jsx
                            <Spor
                                platform={departure.platform}
                                changed={departure.platformChanged}
                                theme={palette.mode}
                            />
```

Merk at `<Spor>` selv er grid-cella nå — den gamle `<span style={{ whiteSpace: 'nowrap' }}>`-innpakninga skal bort, ellers får raden fem kolonner i en firekolonners grid.

- [ ] **Step 5: Verifiser i preview**

Start dev-serveren og åpne en tavle med avgangsmodulen. Sjekk begge flatetyper ved å bytte `carouselSurface` i admin, eller ved å velge en tavle som allerede har mørk flate.

Sjekkliste:
- Avviksmelding på lys flate: gul boks, mørkeblå tekst, ikon synlig.
- Avviksmelding på mørk flate: gul tekst og gult ikon, ingen boks.
- Uendret spor: vanlig tekst, ingen utheving.
- Ingen konsollfeil, og raden har fortsatt fire kolonner uten hopp.

Sporendring er sjelden i ekte data. Framtving den ved midlertidig å la `isPlatformChanged` returnere `true` i `departureMapper.js`, se på resultatet, og **rull tilbake endringen** før neste steg.

- [ ] **Step 6: Commit**

```bash
npm test
git add src/components/Departures.jsx
git commit -m "feat: gul utheving av sporendring og avviksmelding"
```

---

### Task 6: TravelTag som linjemerke

**Files:**
- Modify: `src/components/Departures.jsx` — importlinjene og `LineBadge` (`:22-35`)
- Modify: `src/css/main.css` — nytt `@import` og ny klasse
- Delete: `src/departures/lineAppearance.js`, `src/departures/lineAppearance.test.mjs`

**Interfaces:**
- Consumes: `categoryFill(lineCode, theme)` fra oppgave 3, `travelTagTransport(transportMode)` fra oppgave 4.
- Produces: ingenting for senere oppgaver.

- [ ] **Step 1: Importer travel-stilarket**

I `src/css/main.css` må det nye `@import`-et stå sammen med de andre — CSS krever at alle `@import` kommer før enhver regel. Sett det inn etter alert-linja:

```css
@import '@entur/tooltip/dist/styles.css';
@import '@entur/button/dist/styles.css';
@import '@entur/layout/dist/styles.css';
@import '@entur/loader/dist/styles.css';
@import '@entur/typography/dist/styles.css';
@import '@entur/grid/dist/styles.css';
@import '@entur/alert/dist/styles.css';
@import '@entur/travel/dist/styles.css';
@import "@entur/tokens/dist/base.css";
```

Stilarket er nødvendig av to grunner: det bærer selve komponentreglene, og det er der `--components-travel-traveltag-*` faktisk defineres. De variablene finnes ikke i `@entur/tokens`.

- [ ] **Step 2: Legg til merkeklassen**

Legg dette nederst i `src/css/main.css`:

```css
/**
 * Linjemerket i avgangstavla.
 *
 * To jobber i én klasse.
 *
 * Den ene er å skalere `TravelTag` fra laptop til vegg-skjerm. Komponenten er
 * 2rem høy med 0.875rem skrift; tavla leses fra andre siden av resepsjonen.
 * Alt her er den doble verdien, som treffer skriftstørrelsen det gamle
 * håndlagde merket hadde.
 *
 * Den andre er Samsung-skjermen. `@entur/travel` setter ikonets størrelse og
 * farge gjennom `.eds-travel-tag > :where(.eds-icon)`, og `:where()` kom i
 * Chromium 88. Skjermen kjører Tizen med Chromium 85 — se
 * `src/browserBaseline.test.mjs` — og forkaster hele regelen. De to nederste
 * reglene skriver de samme egenskapene uten `:where()`.
 *
 * Spesifisiteten er (0,2,0) mot originalens (0,1,0), siden `:where()` teller
 * null. Vår regel vinner derfor også på en motor som støtter selektoren, og
 * resultatet blir identisk begge veier. Det er poenget: ingen andre kodevei å
 * teste, ingen `@supports`-forgrening som bare den ene halvparten av verden ser.
 */
.avgangstavle-traveltag.eds-travel-tag {
    height: 4rem;
    min-width: 4rem;
    padding: 0.5rem 1rem;
    font-size: 1.75rem;
    line-height: 3rem;
    font-weight: 700;
    border-radius: 0.5rem;
}

.avgangstavle-traveltag > .eds-icon {
    font-size: 3rem;
    color: var(--text-color);
}

.avgangstavle-traveltag.eds-travel-tag--icon-and-text > .eds-icon {
    margin-right: 1rem;
}
```

- [ ] **Step 3: Bytt importene i `Departures.jsx`**

```jsx
import { Fragment, useEffect, useState } from 'react';
import { Heading3, Paragraph } from '@entur/typography';
import { colors } from '@entur/tokens';
import { TravelTag } from '@entur/travel';
import { ValidationExclamationCircleFilledIcon } from '@entur/icons';

import { categoryFill } from '../departures/categoryFill';
import { travelTagTransport } from '../departures/travelTagTransport';
import { countdownLabel } from '../departures/departureCountdown';
import { isDelayed } from '../departures/departureMapper';
import { warningStyle } from '../departures/warningStyle';
```

`lineAppearance`-importen skal være borte.

- [ ] **Step 4: Skriv om `LineBadge`**

Erstatt hele komponenten:

```jsx
/**
 * Linjemerket. Ikonet forteller transportmiddelet, fargen linjekategorien.
 *
 * Bane NOR-fargen settes som CSS-variabler og ikke som `backgroundColor`, fordi
 * det er dem `TravelTag` selv leser. Komponenten bygger sin egen stil som
 * `{ ...dynamicCssVars, ...style }` — vår `style` spres sist og vinner. Verifisert
 * i kilden til @entur/travel@8.
 *
 * Uten kategorikode sender vi ingen overstyring, og `TravelTag` fargelegger
 * etter transportmiddel. Den logikken eier Entur; vi kopierer den ikke.
 */
function LineBadge({ lineCode, transportMode, theme }) {
    const fill = categoryFill(lineCode, theme);
    return (
        <TravelTag
            className="avgangstavle-traveltag"
            transport={travelTagTransport(transportMode)}
            style={fill ? {
                '--background-color': fill.background,
                '--text-color': fill.text,
                border: fill.border,
            } : undefined}
        >
            {lineCode || '–'}
        </TravelTag>
    );
}
```

Kallstedet i raden er uendret — `<LineBadge lineCode={…} transportMode={…} theme={palette.mode} />` har samme signatur som før.

- [ ] **Step 5: Slett `lineAppearance`**

Ingen importerer den lenger.

```bash
git rm src/departures/lineAppearance.js src/departures/lineAppearance.test.mjs
```

- [ ] **Step 6: Kjør tester og bygg**

```bash
npm test && npm run build
```

Forventet: PASS på begge. Bygget er sjekken som fanger en gjenglemt `lineAppearance`-import — testene ser ikke JSX, så de ville vært grønne uansett.

- [ ] **Step 7: Verifiser i preview, inkludert Tizen-dekninga**

Start dev-serveren og åpne en tavle med avgangsmodulen.

Sjekkliste:
- Togmerkene har Bane NOR-fargene: L grønn, R rød, F blå. Ikonet er synlig oppå fyllet.
- Bussmerker har Enturs egen bussfarge, ikke en Bane NOR-farge.
- Merket er omtrent like stort som før — 1.75rem skrift.
- Kant på lys flate, ingen kant på mørk.

**Tizen-sjekken**, som er hele grunnen til CSS-klassen: åpne devtools, finn `.eds-travel-tag > :where(.eds-icon)` i Styles-panelet og skru den av. Ser merket nøyaktig likt ut med og uten, er Chromium 85 dekket. Gjør det ikke det, mangler en egenskap i `.avgangstavle-traveltag > .eds-icon` — legg den til.

- [ ] **Step 8: Commit**

```bash
git add src/components/Departures.jsx src/css/main.css src/departures/lineAppearance.js src/departures/lineAppearance.test.mjs
git commit -m "feat: TravelTag som linjemerke, med Bane NOR-farger"
```

---

## Verifisering til slutt

- [ ] `npm test` — alle grønne
- [ ] `npm run build` — passerer
- [ ] `git status` — `lineAppearance.js` og `lineAppearance.test.mjs` er borte
- [ ] Ingen `:where()`-avhengighet igjen i det som treffer avgangstavla — sjekk at `.avgangstavle-traveltag`-reglene dekker `font-size`, `color` og `margin-right` på ikonet
- [ ] Preview på både lys og mørk flate, uten konsollfeil
