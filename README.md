# Velkomsttavle Bergen

Fullskjerms informasjonstavle for Entur-kontoret i Bergen. Kjører på en skjerm i
resepsjonen/kontoret og viser en velkomsthilsen, værmelding og et kart over
kontoret.

## Hva tavla viser

Skjermen er delt i tre, ovenfra og ned:

1. **Intro-video** – `public/entur.mp4` spilles av i loop øverst (lyd av, autoplay).
   Videoen serveres same-origin med `immutable`-cache (se `firebase.json`) slik at
   den looper fra nettleser-cache uten flaky nettverkskall.
2. **Velkomsthilsen** – et tilfeldig ansatt-illustrasjon (`staff_man.svg` /
   `staff_woman.svg`) ved siden av «Velkommen til Entur Bergen» og en hilsen som
   varierer med klokkeslett og ukedag (god morgen, vel hjem, god helg osv.).
   Oppdateres hvert 15. minutt.
3. **Karusell** – veksler mellom to slides hvert 30. sekund, med en progress-bar
   og en ikon-rad som viser hvilken slide som er aktiv:
   - **Vær** – værmelding for Bergen hentet direkte fra MET Norway / Yr sitt
     [locationforecast-API](https://api.met.no/weatherapi/locationforecast/2.0/).
     Viser et «Nå»-kort (temperatur, vind, nedbør), en stripe med de neste 6
     timene, og en rad med de 4 neste dagene. Værsymbolene ligger lokalt i
     `public/yrSymbols/`. Værsiden laster siden på nytt hvert 15. minutt for
     ferske data.
   - **Kontorkart** – SVG-plantegning av 3. etasje i Bergen med romnavn som
     etiketter. Plantegningen synkes automatisk fra `entur/plantegning` (se
     [Synk av plantegning](#synk-av-plantegning)).

## Teknologi

- **React 19** – UI
- **Vite 7** – bygg og dev-server
- **Entur designsystem** (`@entur/typography`, `@entur/layout`, `@entur/icons`,
  `@entur/tokens` m.fl.) – komponenter, ikoner og fargetokens
- Styling gjøres med inline-styles og Entur-tokens (ikke Tailwind-klasser).
  Koden er skrevet i JSX (ren JavaScript), med noen få `.js`/`.d.ts`-hjelpere.

## Utvikling

Installer avhengigheter og start dev-server:

```bash
yarn install
yarn dev
```

Dev-serveren kjører på http://localhost:3000.

## Bygging

Lag en produksjonsversjon:

```bash
yarn build
```

Du kan forhåndsvise produksjonsbygget med `yarn preview`.

## Deploy til Firebase Hosting

Tavla hostes på Firebase Hosting i Entur-prosjektet `ent-tavleber-prd`
(konfigurert i `.firebaserc`).

Deploy skjer **automatisk** via GitHub Actions (`.github/workflows/deploy.yml`)
ved push til `main` som endrer kildekode, `public/`, `index.html` eller
bygg-/hosting-config. Autentisering mot Google Cloud er nøkkelløs via Workload
Identity.

Manuell deploy fra egen maskin (krever `yarn firebase login`):

```bash
yarn deploy:firebase
```

## Synk av plantegning

Kontorkartet holdes oppdatert ved en ukentlig GitHub Action
(`.github/workflows/sync-floorplan.yml`, mandager kl. 06:00 UTC). Den kjører
`scripts/sync-floorplan.mjs`, som henter SVG-en og romnavnene fra
`entur/plantegning`, transformerer TSX til JSX og skriver
`src/floorplan/BergenThird.jsx` og `src/floorplan/bergenThirdLabels.json`.
Actionen oppretter en pull request kun når kilden faktisk har endret seg.

Kjøre synken lokalt (krever et GitHub-token med lesetilgang til
`entur/plantegning`):

```bash
FLOORPLAN_SYNC_TOKEN=<token> node scripts/sync-floorplan.mjs
```

Transform-logikken er dekket av tester i `scripts/floorplan-transform.test.mjs`,
som kjøres med Node sin innebygde test-runner:

```bash
node --test scripts/floorplan-transform.test.mjs
```
