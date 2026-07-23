# Design: Kontorkart i velkomsttavla

**Dato:** 2026-07-23
**Status:** Godkjent design, klar for implementeringsplan

## Mål

Vise et kart over Entur Bergen-kontoret (Nøstegaten 58, 3. etasje) i
velkomsttavle-appen, i en hvit seksjon mellom velkomstteksten og værmeldingen.
Kartet hentes fra `entur/plantegning` og skal holdes oppdatert automatisk via en
ukentlig sync.

## Bakgrunn / funn

- Plantegningen for Bergen ligger i `entur/plantegning` som
  `src/assets/floorplans/BergenThird.tsx` — en **selvstendig SVG-React-komponent**
  med `viewBox="0 0 910 888"` og `width/height="100%"`. Ingen bildefil, ingen
  ekstern henting, skalerer fritt.
- Komponenten tar én prop, `labels: RoomLabel[]`, for romnavn. Er lista tom,
  tegnes planen uten tekst-etiketter. Vi vil vise romnavn.
- Romnavn-dataene ligger i `entur/plantegning` som
  `src/data/floorplans/bergen-3.json` (`meetingRooms` + `staticLabels`).
  Flatingen til `RoomLabel[]` gjøres i `catalog.ts:getFloorplanLabels`.
- `entur/plantegning` er et **privat repo** (`raw.githubusercontent.com` gir 404).
  Sync må derfor autentisere seg — default `GITHUB_TOKEN` når bare eget repo.
- velkomsttavle-bergen er en Vite + React (JSX, ikke TS) app. Layouten i
  `src/App.jsx` er en flex-kolonne: video (maks 40vh) → blå `Contrast`-seksjon
  (`flex: 1`, velkomsttekst + staff-bilde) → `Weather`.
- Deploy skjer via `.github/workflows/deploy.yml` (Firebase Hosting) ved push til
  `main` som rører `src/**` m.m.

## Beslutninger

- **Integrasjon:** Kopier SVG-komponenten inn i appen (ingen ny avhengighet,
  samme origin, full styling-kontroll), med ukentlig automatisk sync.
- **Romnavn:** Vises.
- **Sync-strategi:** Workflow åpner **PR** ved endring (ikke direkte commit til
  `main`), slik at endringer får review før de deployes.

## Arkitektur

### 1. Layout-endring (`src/App.jsx`)

Ny rekkefølge i flex-kolonnen:

1. Video — uendret (maks 40vh).
2. Blå `Contrast`-seksjon — **krympes**: fjern `flex: 1` slik at seksjonen kun tar
   høyden innholdet trenger. Staff-bildet får fast maks-høyde (f.eks. `18vh`) i
   stedet for `maxHeight: '90%'`, siden seksjonen ikke lenger er høyde-styrende.
3. **Ny kartseksjon** (`OfficeMap`) — hvit bakgrunn, `flex: 1` for å fylle ledig
   plass mellom blått og været. Sentrert SVG med `max-height` slik at hele
   planløsningen alltid vises. Liten overskrift, f.eks.
   «Nøstegaten 58 — 3. etasje».
4. `Weather` — uendret.

### 2. Kopierte / genererte filer (`src/floorplan/`)

- **`BergenThird.jsx`** — kopi av `BergenThird.tsx`, transformert til JSX:
  - Fjern linja `import type { FloorplanSVGProps } from '...'`.
  - Endre `({ labels }: FloorplanSVGProps)` → `({ labels })`.
  - Resten av fila er allerede gyldig React-JSX (camelCase-attributter som
    `strokeWidth`, `strokeLinecap`, `xmlSpace`).
- **`bergenThirdLabels.json`** — romnavnene fra `bergen-3.json`, flatet ut til
  `RoomLabel`-formatet `{ id, name, x, y, lines?, rotation? }`:
  - `meetingRooms` der `labelX` og `labelY` er satt →
    `{ id, name, x: labelX, y: labelY, lines: labelLines }`.
  - `staticLabels` → `{ id, name, x, y, lines, rotation }`.
- **`OfficeMap.jsx`** — wrapper-komponent som:
  - importerer `BergenThird` og `bergenThirdLabels.json`,
  - rendrer den hvite seksjonen med overskrift,
  - begrenser SVG-størrelsen (`max-height`, sentrert),
  - sender labels-dataene inn i `BergenThird`.

### 3. Ukentlig sync

- **`scripts/sync-floorplan.mjs`** — Node-script som:
  1. henter `src/assets/floorplans/BergenThird.tsx` og
     `src/data/floorplans/bergen-3.json` fra `entur/plantegning` (GitHub
     Contents-API med token fra miljøvariabel),
  2. kjører `.tsx → .jsx`-transformasjonen (fjern type-import + annotasjon),
  3. flater ut labels til `RoomLabel[]`,
  4. skriver `src/floorplan/BergenThird.jsx` og
     `src/floorplan/bergenThirdLabels.json`.
- **`.github/workflows/sync-floorplan.yml`** — workflow som:
  - kjører på cron ukentlig + `workflow_dispatch` (manuell trigger),
  - kjører sync-scriptet med `FLOORPLAN_SYNC_TOKEN` som miljøvariabel,
  - **åpner en PR hvis noe endret seg** (f.eks. via `peter-evans/create-pull-request`
    eller `gh pr create`); ingen endring → ingen PR.
- **Secret:** `FLOORPLAN_SYNC_TOKEN` — fine-grained PAT eller GitHub App-token med
  lese-tilgang til `entur/plantegning` (Contents: read). Settes opp av repo-eier.

## Dataflyt

```
entur/plantegning (privat)
   BergenThird.tsx  +  bergen-3.json
        │  (ukentlig, GitHub API + token)
        ▼
scripts/sync-floorplan.mjs  ── transform ──►  src/floorplan/BergenThird.jsx
                            ── flat labels ─►  src/floorplan/bergenThirdLabels.json
        │  (git diff?)
        ▼
   sync-floorplan.yml  ──►  PR  ──(merge)──►  deploy.yml  ──►  Firebase Hosting
```

Kjøretid i appen:
`App.jsx` → `OfficeMap.jsx` → `BergenThird.jsx` (med labels fra JSON).

## Feilhåndtering

- **Sync-script:** feiler tydelig (non-zero exit) ved manglende token, HTTP-feil,
  eller uventet filstruktur (f.eks. hvis type-annotasjonen ikke finnes å fjerne) —
  slik at workflowen slår rødt i stedet for å committe søppel.
- **Ingen endring:** hvis genererte filer er identiske med committede, opprettes
  ingen PR.
- **App-runtime:** `BergenThird` er en ren SVG uten sideeffekter; ingen spesiell
  feilhåndtering nødvendig. Tom labels-liste gir plan uten tekst (grasiøs
  degradering hvis JSON mangler/blir tom).

## Testing

- **Sync-transform:** enhetstest av transform-funksjonen — gitt kjent `.tsx`-input
  gir forventet `.jsx`-output, og gitt `bergen-3.json` gir forventet
  `RoomLabel[]`. Verifiser at scriptet feiler når annotasjonen ikke finnes.
- **Visuell verifisering:** kjør appen lokalt (`yarn dev`) og bekreft at kartet
  vises i hvit seksjon mellom velkomsttekst og vær, at romnavn er lesbare, at den
  blå seksjonen er krympet, og at ingenting overflyter på tavle-oppløsningen.
- **Build:** `yarn build` går grønt.

## Ikke i scope (YAGNI)

- Kun Bergen 3. etasje — ingen etasjevelger eller andre kontorer.
- Ingen interaktivitet (søk, romhøydepunkt, klikk) fra plantegning-appen.
- Ingen delt npm-pakke mellom repoene.

## Addendum 2026-07-23: Karusell (vær + kart)

Erstatter den opprinnelige «kart i egen hvit seksjon mellom velkomst og vær».
Værmelding og kart vises ikke lenger samtidig, men veksler i en karusell:

- **`src/components/Carousel.jsx`** — generisk karusell som tar
  `slides: Array<{ key, Icon, node }>`, bytter slide hvert **30. sekund**, og
  viser en indikator-rad **øverst**: to Entur-ikoner (`SunCloudIcon` = vær,
  `MapIcon` = kart) med aktivt ikon i **koral**
  (`base.light.baseColors.shape.highlight`, `#ff5959`) og inaktive i **hvitt**,
  og en **lineær progress-bar** under ikonene som fylles 0→100 % fram til neste
  bytte (nullstilles ved slide-bytte). Én `setInterval` (100 ms tick) driver
  både progress og bytte.
- **Felles lavendel bakgrunn** på hele karusell-området:
  `semantic.fill.background.subdued.light` (`#d9dae8`) — samme farge
  værmeldingen allerede brukte.
- **`OfficeMap`** gjøres gjennomsiktig (fyller sin slide; karusellen gir
  bakgrunnen).
- **`App.jsx`**: video + krympet blå velkomstseksjon beholdes; `OfficeMap` og
  `Weather` rendres ikke lenger direkte, men som de to slidene i `<Carousel>`.
- **Romnavn-plassering:** `entur/plantegning` setter *ingen* `text-anchor` på
  `.room-label` — labelene bruker default `text-anchor: start`, og
  label-koordinatene er laget for det. En tidlig antatt «fiks» med
  `text-anchor: middle` skjøv teksten et halvt tekstbredde mot venstre og ble
  fjernet. Vi legger derfor ingen ekstra CSS på romnavn; den kopierte SVG-en
  gjengis som i originalen.