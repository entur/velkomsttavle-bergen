# Design: Pålitelig intro-video + flytt hosting til Entur Firebase

Dato: 2026-07-23
Status: Godkjent design (avventer spec-review)

## Bakgrunn og problem

Velkomsttavla (`velkomsttavle-bergen`) viser en Entur intro-video øverst på skjermen
(`src/App.jsx:76`). Videoen lastes i dag fra en ekstern, midlertidig fil-host
(`image2url.com`).

Observert symptom: etter en sideoppfriskning spiller videoen et par loop-runder,
og blir deretter **sort til neste refresh**. Dette er *ikke* et React-remount
(det ville gitt sort ved hvert 15-minutters `setInterval`-tick, ikke etter noen
loop-runder). Symptomet peker på at **loop-restart feiler mot den eksterne hosten**:
nettleseren re-forespør byte-ranges når `<video loop>` starter på nytt, og
`image2url.com` svarer ikke pålitelig (rate-limit / ustabil / mulig utløpende URL).
Videoen spiller så lenge den ligger i nettleser-buffer, og dør når bufferen tømmes.

Historikk: `public/entur.mp4` (8 MB) var opprinnelig buntet i appen, ble fjernet i
commit `284aa1b` til fordel for Vercel Blob, og endte til slutt på `image2url.com`.

Parallelt ønsker vi å flytte hostingen fra privat løsning (i praksis `gh-pages`,
se `package.json`) til Enturs Firebase.

## Mål

1. Videoen skal spille stabilt i loop på en kiosk-skjerm med lang oppetid, uten å bli sort.
2. Appen skal hostes på Entur Firebase Hosting i stedet for privat løsning.

## Ikke i scope (denne omgangen)

- GitHub Actions CI/CD for Firebase (deploy kjøres manuelt lokalt inntil videre).
- Endring av øvrig UI/layout.

## Valgt tilnærming

**Bunt videoen som en same-origin statisk asset servert av Firebase Hosting, med
lang cache.** Vurderte alternativer: (B) Firebase Storage med download-URL — forkastet
pga. unødig CORS/oppsett når videoen sjelden endres; (C) beholde ekstern host med
JS-watchdog — forkastet fordi det plastrer symptomet og beholder avhengigheten til en
ustabil tredjepart.

Rotårsaksfiksen er at fila serveres fra samme origin med `Cache-Control: immutable`,
slik at nettleseren laster den én gang og looper fra cache — ingen gjentatte
nettverkskall ved loop-restart.

## Del 1 — Video

Endringer:

- Legg `entur.mp4` (8 MB, finnes hos utvikler) tilbake i `public/`. Vite kopierer
  `public/` til `dist/` ved build, så fila serveres same-origin på `/entur.mp4`.
- I `src/App.jsx`: bytt `<video>`-`src` fra `https://image2url.com/...mp4` til
  `/entur.mp4`. Behold `autoPlay loop muted`. Legg til `preload="auto"` og
  `playsInline`. Style beholdes uendret (`maxHeight: '40vh'`, `objectFit: 'cover'`).
- Sikkerhetsnett (valgfritt, billig): en `ref` på `<video>` med `onStalled`/`onError`
  som kaller `videoRef.current?.play()` på nytt, i tilfelle kiosk-nettleseren pauser
  avspilling ved lange oppetider.

Forventet effekt: same-origin + `immutable`-cache gjør at loop-restart leser fra
disk/minne-cache i stedet for nettverk → ingen sort skjerm.

## Del 2 — Firebase Hosting

Nye/endrede filer:

- `firebase.json`:
  - `hosting.public: "dist"`
  - `hosting.ignore`: standard (`firebase.json`, `**/.*`, `**/node_modules/**`)
  - `hosting.rewrites`: SPA-fallback `{ "source": "**", "destination": "/index.html" }`
  - `hosting.headers`: regel for `**/*.@(mp4)` med
    `Cache-Control: public, max-age=31536000, immutable`
- `.firebaserc`:
  - `projects.default: "<ENTUR_FIREBASE_PROJECT_ID>"` (placeholder — utvikler fyller
    inn faktisk Entur-prosjekt-ID)
- `package.json`:
  - Legg til `firebase-tools` som devDependency.
  - Legg til script: `"deploy:firebase": "vite build --config vite.config.js && firebase deploy --only hosting"`.
  - Behold eksisterende `deploy` (gh-pages) inntil Firebase-deploy er verifisert; fjernes i en oppfølging.

Merk: `vite.config.js` har allerede `base: '/'`, som er riktig for Firebase Hosting
på rot — ingen endring nødvendig der.

## Verifisering

- `yarn build` produserer `dist/` med `entur.mp4` til stede.
- Lokal `yarn preview` (eller `firebase emulators:start`): videoen spiller og looper
  uten å bli sort over flere minutter; Nettverk-fanen viser at `/entur.mp4` serveres
  fra (disk) cache etter første last, ikke re-fetches ved loop.
- `firebase deploy --only hosting` (etter at prosjekt-ID er fylt inn) publiserer appen;
  live-URL viser stabil video.

## Åpne punkter

- Faktisk Entur Firebase/GCP prosjekt-ID må skaffes og settes inn i `.firebaserc`.
- CI/CD-workflow tas som et separat, senere steg.