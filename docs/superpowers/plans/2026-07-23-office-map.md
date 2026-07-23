# Kontorkart i velkomsttavla — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vis Entur Bergen sitt kontorkart (Nøstegaten 58, 3. etasje) i en hvit seksjon mellom velkomstteksten og værmeldingen, med ukentlig automatisk sync fra `entur/plantegning`.

**Architecture:** SVG-React-komponenten `BergenThird` kopieres inn i appen som JSX sammen med utflatede romnavn-data. En wrapper `OfficeMap` rendrer den i en hvit seksjon. Et Node-script henter og transformerer kildefilene fra det private repoet `entur/plantegning`, og en GitHub Actions-workflow kjører scriptet ukentlig og åpner PR ved endring.

**Tech Stack:** Vite 7, React 19 (JSX), `@entur/*`-komponenter, Node 22 (ESM `.mjs`), Node innebygd testløper (`node --test`), GitHub Actions.

## Global Constraints

- Kun Bergen 3. etasje — ingen etasjevelger, ingen andre kontorer, ingen interaktivitet fra plantegning-appen.
- Ingen ny runtime-avhengighet i `package.json` (SVG kopieres inn, ikke importeres som pakke).
- `entur/plantegning` er **privat** — all henting krever token; default `GITHUB_TOKEN` når ikke det repoet.
- Synkede filer skrives kun til `src/floorplan/BergenThird.jsx` og `src/floorplan/bergenThirdLabels.json`.
- Appen er JSX (ikke TS) — transformert komponent må være gyldig JSX uten type-annotasjoner.
- Sync-workflow åpner **PR** ved endring, aldri direkte commit til `main`.
- Arbeidet gjøres på branch `office-map`.

---

## File Structure

- `scripts/floorplan-transform.mjs` — rene funksjoner: `transformTsxToJsx(source)` og `flattenLabels(config)`. Testbar uten nettverk.
- `scripts/floorplan-transform.test.mjs` — enhetstester (`node --test`).
- `scripts/sync-floorplan.mjs` — CLI: henter fra GitHub, bruker transform-modulen, skriver filene.
- `src/floorplan/BergenThird.jsx` — generert (synket) SVG-komponent.
- `src/floorplan/bergenThirdLabels.json` — generert (synket) romnavn-data.
- `src/floorplan/OfficeMap.jsx` — wrapper: hvit seksjon + overskrift + størrelse.
- `src/App.jsx` — layout: krymp blå seksjon, sett inn kartseksjon.
- `.github/workflows/sync-floorplan.yml` — ukentlig cron + `workflow_dispatch`, åpner PR.

---

### Task 1: Transform-modul med tester

Rene funksjoner som gjør `.tsx`→`.jsx`-transformasjon og flater ut romnavn. Dette er den eneste logikken med reell risiko, så den testes med `node --test` (ingen ny avhengighet).

**Files:**
- Create: `scripts/floorplan-transform.mjs`
- Test: `scripts/floorplan-transform.test.mjs`

**Interfaces:**
- Consumes: ingenting (rene funksjoner).
- Produces:
  - `transformTsxToJsx(source: string): string` — fjerner `import type ... FloorplanView`-linja og `: FloorplanSVGProps`-annotasjonen; kaster `Error` hvis `FloorplanSVGProps` ikke finnes i input.
  - `flattenLabels(config: {meetingRooms: object[], staticLabels: object[]}): Array<{id,name,x,y,lines?,rotation?}>`

- [ ] **Step 1: Write the failing tests**

Create `scripts/floorplan-transform.test.mjs`:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { transformTsxToJsx, flattenLabels } from './floorplan-transform.mjs'

test('transformTsxToJsx removes the type import line', () => {
  const src = [
    "import type { FloorplanSVGProps } from '../../components/FloorplanView'",
    '',
    'const BergenThird = ({ labels }: FloorplanSVGProps) => {',
    '  return null',
    '}',
    '',
    'export default BergenThird',
  ].join('\n')
  const out = transformTsxToJsx(src)
  assert.ok(!out.includes('import type'), 'type import should be gone')
  assert.ok(!out.includes('FloorplanSVGProps'), 'type reference should be gone')
  assert.ok(out.includes('const BergenThird = ({ labels }) => {'))
  assert.ok(out.includes('export default BergenThird'))
})

test('transformTsxToJsx throws when the expected type is missing', () => {
  assert.throws(() => transformTsxToJsx('const x = 1\n'), /FloorplanSVGProps/)
})

test('flattenLabels merges meeting rooms and static labels', () => {
  const config = {
    meetingRooms: [
      { id: 'a', name: 'RoomA', capacity: 6, labelX: 40, labelY: 510 },
      { id: 'skip', name: 'NoLabel', capacity: 2 },
      { id: 'b', name: 'RoomB', labelX: 820, labelY: 700, labelLines: ['Room', 'B'] },
    ],
    staticLabels: [
      { id: 'wc', name: 'WC', x: 45, y: 30 },
      { id: 'skap', name: 'Skap', x: 358, y: 485, rotation: -90 },
    ],
  }
  const result = flattenLabels(config)
  assert.deepEqual(result, [
    { id: 'a', name: 'RoomA', x: 40, y: 510 },
    { id: 'b', name: 'RoomB', x: 820, y: 700, lines: ['Room', 'B'] },
    { id: 'wc', name: 'WC', x: 45, y: 30 },
    { id: 'skap', name: 'Skap', x: 358, y: 485, rotation: -90 },
  ])
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/floorplan-transform.test.mjs`
Expected: FAIL — `Cannot find module './floorplan-transform.mjs'` / import error.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/floorplan-transform.mjs`:

```javascript
export function transformTsxToJsx(source) {
  if (!source.includes('FloorplanSVGProps')) {
    throw new Error(
      'Uventet BergenThird-struktur: fant ikke FloorplanSVGProps. ' +
        'Sjekk om kildefila i entur/plantegning har endret signatur.'
    )
  }
  return source
    // fjern type-import-linja (med eller uten semikolon)
    .replace(/^import type \{[^}]*\} from ['"][^'"]*FloorplanView['"];?\r?\n/m, '')
    // fjern type-annotasjonen på props
    .replace(/:\s*FloorplanSVGProps/, '')
}

export function flattenLabels(config) {
  const roomLabels = config.meetingRooms
    .filter((r) => r.labelX !== undefined && r.labelY !== undefined)
    .map((r) => ({
      id: r.id,
      name: r.name,
      x: r.labelX,
      y: r.labelY,
      ...(r.labelLines ? { lines: r.labelLines } : {}),
    }))
  const staticLabels = config.staticLabels.map((l) => ({
    id: l.id,
    name: l.name,
    x: l.x,
    y: l.y,
    ...(l.lines ? { lines: l.lines } : {}),
    ...(l.rotation !== undefined ? { rotation: l.rotation } : {}),
  }))
  return [...roomLabels, ...staticLabels]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/floorplan-transform.test.mjs`
Expected: PASS — 3 tester grønne.

- [ ] **Step 5: Commit**

```bash
git add scripts/floorplan-transform.mjs scripts/floorplan-transform.test.mjs
git commit -m "feat: add floorplan sync transform functions"
```

---

### Task 2: Sync-script (CLI)

Node-script som henter kildefilene fra `entur/plantegning` via GitHub Contents-API, kjører transformasjonen og skriver de to synkede filene.

**Files:**
- Create: `scripts/sync-floorplan.mjs`

**Interfaces:**
- Consumes: `transformTsxToJsx`, `flattenLabels` fra `./floorplan-transform.mjs`.
- Produces: skriver `src/floorplan/BergenThird.jsx` og `src/floorplan/bergenThirdLabels.json`. Leser token fra `FLOORPLAN_SYNC_TOKEN` eller `GITHUB_TOKEN`.

- [ ] **Step 1: Write the script**

Create `scripts/sync-floorplan.mjs`:

```javascript
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transformTsxToJsx, flattenLabels } from './floorplan-transform.mjs'

const REPO = 'entur/plantegning'
const TSX_PATH = 'src/assets/floorplans/BergenThird.tsx'
const LABELS_PATH = 'src/data/floorplans/bergen-3.json'

const token = process.env.FLOORPLAN_SYNC_TOKEN || process.env.GITHUB_TOKEN
if (!token) {
  console.error('Mangler token: sett FLOORPLAN_SYNC_TOKEN (eller GITHUB_TOKEN).')
  process.exit(1)
}

async function fetchRaw(path) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.raw+json',
        'User-Agent': 'velkomsttavle-bergen-sync',
      },
    }
  )
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} ${res.statusText} for ${path}`)
  }
  return await res.text()
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'src/floorplan')

const jsx = transformTsxToJsx(await fetchRaw(TSX_PATH))
const labels = flattenLabels(JSON.parse(await fetchRaw(LABELS_PATH)))

await mkdir(outDir, { recursive: true })
await writeFile(resolve(outDir, 'BergenThird.jsx'), jsx)
await writeFile(
  resolve(outDir, 'bergenThirdLabels.json'),
  `${JSON.stringify(labels, null, 2)}\n`
)
console.log('Plantegning synket til src/floorplan/.')
```

- [ ] **Step 2: Verify the script parses (no token → clean exit)**

Run: `env -u FLOORPLAN_SYNC_TOKEN -u GITHUB_TOKEN node scripts/sync-floorplan.mjs; echo "exit=$?"`
Expected: skriver "Mangler token: ..." og `exit=1` (ingen stacktrace/syntaksfeil).

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-floorplan.mjs
git commit -m "feat: add floorplan sync script"
```

---

### Task 3: Generer og commit de synkede filene

Kjør sync-scriptet én gang lokalt for å produsere `BergenThird.jsx` og `bergenThirdLabels.json`, slik at appen fungerer umiddelbart (ikke først etter neste ukentlige kjøring). Krever et token med lesetilgang til `entur/plantegning`; `gh auth token` gir dette når du er innlogget som repo-eier.

**Files:**
- Create (generert): `src/floorplan/BergenThird.jsx`
- Create (generert): `src/floorplan/bergenThirdLabels.json`

**Interfaces:**
- Consumes: `scripts/sync-floorplan.mjs`.
- Produces: `src/floorplan/BergenThird.jsx` (default export `BergenThird`, tar `{ labels }`-prop) og `src/floorplan/bergenThirdLabels.json` (array av `{id,name,x,y,lines?,rotation?}`).

- [ ] **Step 1: Kjør sync lokalt**

Run: `FLOORPLAN_SYNC_TOKEN=$(gh auth token) node scripts/sync-floorplan.mjs`
Expected: "Plantegning synket til src/floorplan/." og to nye filer i `src/floorplan/`.

- [ ] **Step 2: Verifiser generert JSX**

Run: `head -5 src/floorplan/BergenThird.jsx`
Expected: **ingen** `import type`-linje; fila starter med f.eks. `const BergenThird = ({ labels }) => {` (ev. blank linje først). Sjekk også at `grep -c FloorplanSVGProps src/floorplan/BergenThird.jsx` gir `0`.

- [ ] **Step 3: Verifiser generert JSON**

Run: `node -e "const l=require('./src/floorplan/bergenThirdLabels.json'); console.log(l.length, l[0])"`
Expected: et antall > 0 og et objekt med felt `id,name,x,y` (f.eks. `EnUlrikenTur`).

- [ ] **Step 4: Bekreft at build fortsatt går (uten at komponenten er tatt i bruk ennå)**

Run: `yarn build`
Expected: build fullfører grønt (den nye fila er ikke importert ennå, men skal være gyldig JSX).

- [ ] **Step 5: Commit**

```bash
git add src/floorplan/BergenThird.jsx src/floorplan/bergenThirdLabels.json
git commit -m "chore: add generated Bergen floorplan (initial sync)"
```

---

### Task 4: OfficeMap-wrapper

Wrapper-komponent som rendrer plantegningen i en hvit seksjon med overskrift og begrenset størrelse.

**Files:**
- Create: `src/floorplan/OfficeMap.jsx`

**Interfaces:**
- Consumes: `./BergenThird` (default export), `./bergenThirdLabels.json`, `@entur/typography`.
- Produces: default export `OfficeMap` (React-komponent, ingen props).

- [ ] **Step 1: Skriv komponenten**

Create `src/floorplan/OfficeMap.jsx`:

```jsx
import { Heading3 } from '@entur/typography';
import BergenThird from './BergenThird';
import labels from './bergenThirdLabels.json';

function OfficeMap() {
    return (
        <div style={{ flex: 1, minHeight: 0, width: '100vw', backgroundColor: '#ffffff', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem 0' }}>
            <Heading3 style={{ margin: '0 0 0.5rem' }}>Nøstegaten 58 — 3. etasje</Heading3>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                <BergenThird labels={labels} />
            </div>
        </div>
    );
}

export default OfficeMap;
```

- [ ] **Step 2: Verifiser at det bygger**

Run: `yarn build`
Expected: build fullfører grønt (OfficeMap importeres ennå ikke fra App, men skal kompilere).

- [ ] **Step 3: Commit**

```bash
git add src/floorplan/OfficeMap.jsx
git commit -m "feat: add OfficeMap wrapper for Bergen floorplan"
```

---

### Task 5: Integrer i App-layouten

Krymp den blå `Contrast`-seksjonen og sett `OfficeMap` inn mellom velkomstteksten og været.

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `./floorplan/OfficeMap` (default export).
- Produces: ingen (topp-nivå layout).

- [ ] **Step 1: Importer OfficeMap**

I `src/App.jsx`, legg til import etter `import Weather from './components/Weather';`:

```jsx
import OfficeMap from './floorplan/OfficeMap';
```

- [ ] **Step 2: Gi staff-bildet fast maks-høyde**

I `StaffAndHeadings`, endre img-stilen fra `maxHeight: '90%'` til `maxHeight: '18vh'`:

```jsx
<img src={randomStaffImage} alt="Staff" style={{ maxHeight: '18vh', maxWidth: '40%', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }} />
```

- [ ] **Step 3: Krymp blå seksjon og sett inn kartet**

Erstatt `Contrast`-blokken + `Weather` i `return`-en slik at `Contrast` ikke lenger har `flex: 1`, og `OfficeMap` legges inn mellom `Contrast` og `Weather`:

```jsx
            <Contrast style={{ width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: base.light.baseColors.frame.contrast, flexDirection: 'column', padding: '1.5rem 0' }}>
                <StaffAndHeadings randomStaffImage={randomStaffImage} greeting={greeting} />
            </Contrast>
            <OfficeMap />
            <Weather location={LOCATION} date={date} />
```

- [ ] **Step 4: Bygg og kjør appen lokalt**

Run: `yarn build && yarn dev`
Expected: build grønn; åpne `http://localhost:3000` og bekreft visuelt:
- video på topp,
- blå seksjon **krympet** til å romme tekst + bilde,
- hvit kartseksjon med plantegning og lesbare romnavn (EnUlrikenTur, Kjøkken, WC osv.) mellom blått og været,
- værmelding nederst,
- ingenting overflyter (`overflow: hidden` på ytre `.app`).

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: show office floorplan between greeting and weather"
```

---

### Task 6: Ukentlig sync-workflow

GitHub Actions-workflow som kjører sync-scriptet ukentlig og åpner PR ved endring.

**Files:**
- Create: `.github/workflows/sync-floorplan.yml`

**Interfaces:**
- Consumes: `scripts/sync-floorplan.mjs`, secret `FLOORPLAN_SYNC_TOKEN`.
- Produces: PR mot `main` med oppdaterte filer i `src/floorplan/` (kun ved diff).

- [ ] **Step 1: Skriv workflow**

Create `.github/workflows/sync-floorplan.yml`:

```yaml
name: Sync floorplan

on:
  schedule:
    - cron: '0 6 * * 1'   # mandager 06:00 UTC
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-24.04
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Sync floorplan from entur/plantegning
        env:
          FLOORPLAN_SYNC_TOKEN: ${{ secrets.FLOORPLAN_SYNC_TOKEN }}
        run: node scripts/sync-floorplan.mjs

      - name: Create Pull Request
        uses: peter-evans/create-pull-request@v6
        with:
          commit-message: "chore: sync Bergen floorplan from entur/plantegning"
          branch: sync/floorplan
          delete-branch: true
          title: "chore: sync Bergen floorplan"
          body: |
            Automatisk ukentlig sync av plantegningen fra `entur/plantegning`.
            Opprettes kun når kilde-SVG eller romnavn har endret seg.
          add-paths: |
            src/floorplan/BergenThird.jsx
            src/floorplan/bergenThirdLabels.json
```

- [ ] **Step 2: Valider YAML-syntaks**

Run: `node -e "const fs=require('fs');const s=fs.readFileSync('.github/workflows/sync-floorplan.yml','utf8');if(!/peter-evans\/create-pull-request/.test(s)||!/workflow_dispatch/.test(s))process.exit(1);console.log('ok')"`
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/sync-floorplan.yml
git commit -m "ci: weekly floorplan sync workflow (opens PR on change)"
```

- [ ] **Step 4: Manuell oppsett (utenfor kode — noter til bruker)**

Repo-eier må legge til repository-secret `FLOORPLAN_SYNC_TOKEN` (fine-grained PAT eller GitHub App-token) med **Contents: read** på `entur/plantegning`. Deretter kan workflowen testes manuelt via **Actions → Sync floorplan → Run workflow** (`workflow_dispatch`).

---

## Self-Review

**Spec coverage:**
- Layout-endring (krymp blå, hvit kartseksjon mellom) → Task 4 + Task 5. ✓
- Kopiert/transformert `BergenThird.jsx` → Task 1 (transform) + Task 3 (generering). ✓
- Utflatede romnavn `bergenThirdLabels.json` → Task 1 (`flattenLabels`) + Task 3. ✓
- `OfficeMap.jsx`-wrapper → Task 4. ✓
- `sync-floorplan.mjs` → Task 2. ✓
- Ukentlig workflow med PR → Task 6. ✓
- Secret `FLOORPLAN_SYNC_TOKEN` → Task 6 Step 4. ✓
- Feilhåndtering (script feiler tydelig, ingen diff → ingen PR) → Task 1 (throw), Task 2 (HTTP-sjekk), Task 6 (create-pull-request no-op ved ingen diff). ✓
- Testing (transform-enhetstest, visuell verifisering, build grønn) → Task 1, Task 5 Step 4, Task 3/4 build. ✓

**Placeholder scan:** Ingen TBD/TODO; alle kodesteg har komplett kode.

**Type consistency:** `transformTsxToJsx`/`flattenLabels` definert i Task 1 og konsumert med samme navn/signatur i Task 2. `OfficeMap` default export (Task 4) importeres som default i Task 5. Synkede filnavn `src/floorplan/BergenThird.jsx` og `src/floorplan/bergenThirdLabels.json` er identiske på tvers av Task 2, 3, 4, 6.
