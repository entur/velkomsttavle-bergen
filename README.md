# Velkomsttavle Bergen

Fullskjerms informasjonstavle for Entur-kontoret i Bergen. Kjører på en skjerm i
resepsjonen/kontoret og viser en velkomsthilsen, værmelding og et kart over
kontoret.

## Hva tavla viser

Hva som står på en tavle bestemmes av et dokument i Firestore-collectionen
`boards`, ikke av koden. Skjermen peker på `/t/<tavle-id>`, appen abonnerer på
dokumentet, og en endring i admin slår ut på skjermen innen sekunder uten at
noen laster siden på nytt.

Layouten er den samme på alle tavler — fire felt ovenfra og ned — men innholdet
i hvert felt velges per tavle:

| Felt | Moduler |
|---|---|
| Farger | `theme`: `dark` (mørkeblått) eller `light` (lavendel) — gjelder toppen og midten samlet. Karusellen og bunnstripa velger hver sin flate fra en tabell med seks navngitte farger, se under |
| Toppen | `video` (intro-videoen) eller `logo` (Entur-logoen) |
| Midten | `greeting` (hilsen, automatisk eller fast tekst) og `openingHours` (åpningstider lagt inn dag for dag). Ansatt-illustrasjonen (`staffImage`) er et eget valg, uavhengig av begge |
| Karusellen | `weather` (værmelding for valgte koordinater), `floorplan` (plantegning) og `departures` (avgangstider fra ett stoppested) |
| Bunnstripa | `weather` i en kompakt visning — samme værmodul kan stå i karusellen eller i stripa, aldri begge på én gang |

Overskriften «Velkommen til Entur `<stedsnavn>`» og eventuelle **varsler** står
alltid i midtfeltet, uansett hvilke moduler tavla har. Ukjente modultyper hoppes
over, så en skjerm som ikke er lastet på nytt svartner ikke av at noen legger
til en modul den ikke kjenner. Er karusellen tom, faller feltet bort og
midtfeltet får plassen; er bunnstripa tom, faller den bort på samme måte.

Karusellen og bunnstripa velger hver sin **flate** fra en lukket liste med seks
navngitte farger (`carouselSurface` og `bottomSurface`) — ikke en fri
fargevelger, slik at kontrasten kan måles for alle seks på én gang. Flaten
gjelder hele feltet, ikke enkeltmoduler — et felt som skifter bakgrunn mellom
slides er en feil, ikke et design. Tabellen ligger i
[`src/boards/surfaces.js`](src/boards/surfaces.js), som har en test som
kontrastmåler seg selv.

Tavla har altså **tre uavhengige fargevalg**: `theme` for toppen og midten
([`src/boards/boardTheme.js`](src/boards/boardTheme.js)), og `carouselSurface`
og `bottomSurface` for karusellen og bunnstripa. De kom fra hver sin endring og
er ikke koblet — en tavle kan settes mørk øverst og lys i stripa. Om de bør
slås sammen til ett valg er ikke avgjort.

Modulkatalogen ligger i [`src/boards/boardConfig.js`](src/boards/boardConfig.js).
Der ligger også normaliseringen som gjør et dokument om til noe kiosken trygt
kan rendre — Firestore-reglene kan ikke iterere over en liste og validerer bare
grovformen, så det er normaliseringen som er vernet mot et dokument skrevet for
hånd i konsollet.

Modulene i detalj:

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

   **Åpningstider** (`openingHours`) er den andre modulen i midtfeltet. Sju dager
   med åpner/stenger eller «Stengt», lagt inn i et skjema. Tavla slår sammen
   dager som ligger etter hverandre og har samme verdi, slik at fem like ukedager
   blir «Mandag–Fredag 08:00–16:00». Det finnes ingen «åpent nå»-logikk.
3. **Karusell** – veksler mellom slidene hvert 30. sekund, med en progress-bar
   og en ikon-rad som viser hvilken slide som er aktiv:
   - **Vær** – værmelding for koordinatene i oppsettet, hentet direkte fra MET Norway / Yr sitt
     [locationforecast-API](https://api.met.no/weatherapi/locationforecast/2.0/).
     Viser en «Nå»-blokk (temperatur, vind, nedbør), en stripe med de neste 6
     timene, og en rad med de 4 neste dagene — alle tre uten egen flate, rett på
     bakgrunnen feltet har valgt. Værsymbolene ligger lokalt i
     `public/yrSymbols/`. Karusellen rendrer bare den aktive sliden, så
     værkomponenten avmonteres og remonteres hvert minutt — hentingen ligger
     derfor i `App` (`src/weather/metForecast.js`), som står montert hele tiden.
     Nye data hentes tidligst hvert 15. minutt, og ellers når `Expires`-headeren
     fra MET sier at varselet er utdatert. Tavla laster seg aldri på nytt av seg
     selv.
   - **Kontorkart** – SVG-plantegning av 3. etasje i Bergen med romnavn som
     etiketter. Plantegningen synkes automatisk fra `entur/plantegning` (se
     [Synk av plantegning](#synk-av-plantegning)). Det finnes bare én
     plantegning, `bergen-3`, så `plan`-parameteren har én lovlig verdi i dag.
4. **Bunnstripe** (`bottom: weather`) – en lav stripe nederst med en kompakt
   værvisning (`WeatherStripe.jsx`). «Nå»-blokka står fast til venstre med
   symbol, temperatur, vind og nedbør; til høyre veksler feltet hvert 15.
   sekund mellom de neste seks timene og de neste fire dagene. Henter
   ingenting selv — samme polling som karusellværet over. Vekslingen
   (`src/components/rotation.mjs`) og værutregningene
   (`src/weather/forecastViews.mjs`) er delt med karusellen, som ren og
   testbar logikk uten JSX.

   Bare været har fått en kompakt visning; katalogen (`BOTTOM_TYPES` i
   `boardConfig.js`) er generisk, men ingen andre moduler har flyttet ned. En
   værmodul bor ett sted: settes den til stripa i admin, forsvinner den fra
   karusellen, og normaliseringen håndhever det samme for et dokument
   redigert for hånd i Firestore-konsollet.

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

Ruting skjer uten router-avhengighet: `parseRoute` er tre regexer, og kiosken
skal ikke laste kode den aldri bruker. Firebase Hosting rewriter allerede `**`
til `/index.html`, så dyplenker virker i produksjon uten ekstra konfigurasjon.

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
`F` fjerntog blå — fordi det er kodingen Bane NORs perrongskjermer bruker. Den
reisende går fra billettkontoret til sporet og møter samme farge. Linjer uten
kategori får farge etter transportmiddel fra Enturs egen palett.

`line.presentation.colour` fra APIet brukes **ikke**: det er en operatørfarge,
ikke en linjefarge. Alle tre togene fra Bergen stasjon er Vy og får samme røde,
og de fleste bussrutene har feltet tomt.

**Bane NORs trafikkmeldinger brukes ikke**, av tre uavhengige grunner: Bane NOR
er en kilde *inn* i Entur (codespace `BNR`), feeden deres sender ingen
CORS-headere og kan derfor ikke leses fra en nettleser uten proxy, og meldingene
gjelder strekninger over lange perioder framfor enkeltavganger. Strekningsarbeid
legges inn som en vanlig melding på tavla.

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
ved push til `main` som endrer kildekode, `public/`, `index.html`,
`firestore.rules` eller bygg-/hosting-config. Steget kjører `yarn test` før
bygg, og deployer deretter både Hosting og Firestore-reglene
(`--only hosting,firestore:rules`) i samme kjøring. Autentisering mot Google
Cloud er nøkkelløs via Workload Identity.

Dette krever at tjenestekontoen CI autentiserer som har
`roles/firebaserules.admin` på `ent-tavleber-prd`. Mangler rollen, feiler
deploy-steget synlig på neste push til `main` — det er med vilje: reglene må
nå produksjon for at varsler skal virke i det hele tatt, så det skal ikke
feile stille.

Manuell deploy fra egen maskin (krever `yarn firebase login`):

```bash
yarn deploy:firebase
```

## Varsler og admin-side

Tavla kan vise tidsstyrte meldinger øverst i midtfeltet. Meldingene
legges inn på `/admin` og lagres i Firestore i `ent-tavleber-prd`.

Hver melding har tittel, tekst, nivå, et tidsrom og en av/på-bryter. Nivået
styrer farge og ikon, og bruker Entur-designsystemets fire varianter:
`negative` (Kritisk), `warning` (Advarsel), `information` (Informasjon) og
`success` (Positivt). Er flere meldinger aktive samtidig, stables de med
alvorligste og nyeste øverst.

Tavla abonnerer på Firestore med `onSnapshot`, så en ny melding er på skjermen
i resepsjonen innen sekunder — uten at noen må laste siden på nytt. Tidsvinduet
reevalueres hvert 30. sekund.

### Pålogging og tilgang

`/admin` krever innlogging med Google. Siden Entur bruker Google Workspace er
det Entur-kontoen din. Både admin-siden og Firestore-reglene krever en
verifisert `@entur.org`-adresse. Hvem som opprettet og sist endret en melding
lagres og vises i listen.

**Tilgang gis per tavle, ikke globalt.** Enhver Entur-konto kan logge inn og
opprette sin egen tavle. Den som oppretter en tavle får tilgang til den, og kan
gi andre tilgang fra tavlesiden i admin.

Tilgang er tilgang: den som har den kan endre oppsettet, publisere meldinger og
gi andre tilgang. Det finnes ingen roller. Den siste med tilgang kan ikke fjerne
seg selv — da måtte tavla vært ordnet i Firebase-konsollet.

Tilgang lagres i collectionen `memberships`, med ett dokument per person og
dokument-id lik e-postadressen i **små bokstaver**. Dokumentet inneholder en
liste `boards` med tavle-id-ene personen har tilgang til.

> **Dokument-ID-en må være e-postadressen i små bokstaver.** Reglene slår opp med
> `request.auth.token.email.lower()`, så en ID som `Ola@Entur.org` treffer ikke.
> Dette er den enkleste feilen å gjøre i konsollet.

> At tilgang ligger per bruker og ikke som en medlemsliste på tavla er ikke
> tilfeldig. En melding kan gjelde flere tavler, og reglene må avgjøre om *alle*
> tavlene i lista er dine. Med tilgang per bruker er det ett oppslag og én
> `hasOnly`. Med en medlemsliste per tavle måtte reglene iterert over lista, og
> det kan de ikke.

Den første tavla di er et spesialtilfelle: du oppretter den, men har ingen tavler
ennå, så regelen som krever at det du legger til er noe du har, ville stoppet deg.
Klienten oppgir derfor id-en den gjør krav på i feltet `claiming`, og regelen slår
opp at `createdBy` på den tavla er deg. Kravet gjelder bare din egen oppføring.

Har alle med tilgang til en tavle sluttet, må noen med Firebase-konsolltilgang
legge inn en ny oppføring i `memberships` for hånd.

### Meldingene er offentlig lesbare

Tavla er en kiosk uten pålogging og må lese meldingene uautentisert. Appen
ligger på et offentlig domene, så **meldingene kan leses av hvem som helst som
finner adressen.** Dette er akseptert fordi innholdet uansett står på en skjerm
i resepsjonen. **Ikke legg sensitiv eller intern-klassifisert informasjon i en
melding.**

Skrivetilgang krever en verifisert `@entur.org`-konto **og** tilgang til hver av
tavlene meldinga skal stå på, se [«Pålogging og tilgang»](#pålogging-og-tilgang)
over. Reglene validerer også feltene og hindrer at `createdBy`/`updatedBy` settes
til andre enn den innloggede.

### Én melding, flere tavler

En melding har feltet `boardIds` — lista over tavlene den skal stå på. Publiserer
du den samme meldinga på tre tavler, er det **én** melding: endrer du teksten,
endres den alle stedene. Skjemaet viser bare tavlene du har tilgang til.

Reglene sjekker `boardIds` både før og etter en endring. Uten sjekken på den
gamle lista kunne man tatt en melding som står på to tavler, fjernet den ene fra
lista og skrevet om teksten — altså avpublisert fra en tavle man ikke har
tilgang til.

Sletter du en tavle, røres ikke meldingene. En melding som peker på en slettet
tavle blir liggende med en id ingen renderer, og vises fortsatt på de andre
tavlene sine.

### Lokal utvikling mot emulator

Firestore-emulatoren krever Java 11+ (`brew install openjdk`).

Start emulatorene i én terminal:

```bash
yarn firebase emulators:start --only auth,firestore --project ent-tavleber-prd
```

Lag `.env.local` med:

```
VITE_USE_EMULATOR=true
```

Start dev-serveren i en annen terminal med `yarn dev`. Appen kobler seg da til
emulatoren i stedet for produksjon. Emulator-UI-et ligger på
http://localhost:4000, og Auth-emulatoren lar deg logge inn som en oppdiktet
`@entur.org`-bruker uten ekte Google-konto.

Uten `VITE_USE_EMULATOR=true` snakker `yarn dev` med **produksjons**-Firestore.

Emulatoren starter tom, men du trenger ingen oppsett-runde: logg inn og trykk
«Ny tavle», så har du en tavle du eier. Vil du heller starte med en bestemt tavle
og tilgang til den, kan du skrive begge deler med emulatorens owner-bypass:

```bash
curl -s -X POST -H 'Authorization: Bearer owner' -H 'Content-Type: application/json' \
  'http://127.0.0.1:8080/v1/projects/ent-tavleber-prd/databases/(default)/documents/memberships?documentId=din.adresse@entur.org' \
  -d '{"fields":{"boards":{"arrayValue":{"values":[{"stringValue":"bergen-3"}]}}}}'
```

### Tester

```bash
yarn test
```

Kjører Nodes innebygde test-runner over logikken som kan gå galt: tidsvindu og
sortering (`src/alerts/alertSchedule.test.mjs`), validering
(`alertValidation.test.mjs`), Firestore-mapping (`alertMapper.test.mjs`) og
domenesjekken for pålogging (`src/admin/enturAccount.test.mjs`) — pluss
værpollingen (`src/weather/metForecast.test.js`) og floorplan-transformen.

For tavler dekkes ruteparsingen (`src/routing/parseRoute.test.mjs`),
åpningstidene (`src/boards/openingHours.test.mjs`), modulkatalogen og
normaliseringen (`src/boards/boardConfig.test.mjs`), valideringen av
oppsettskjemaet (`src/boards/boardValidation.test.mjs`), tavle-id-er
(`src/boards/boardId.test.mjs`) og tilgangslistene
(`src/access/memberships.test.mjs`).

For avganger dekkes mapping fra GraphQL-svaret
(`src/departures/departureMapper.test.mjs`), nedtellingen
(`departureCountdown.test.mjs`), linjefargene (`lineAppearance.test.mjs`),
henting og polling (`enturDepartures.test.mjs`) og stoppestedssøket
(`stopPlaceSearch.test.mjs`).

Flatetabellen (`src/boards/surfaces.test.mjs`) kontrastmåler seg selv, for alle
seks flatene på én gang. Vekslingen mellom flere
visninger — delt av karusellen og bunnstripa — er en ren funksjon
(`src/components/rotation.test.mjs`), og det samme gjelder værutregningene
begge værvisningene bygger på (`src/weather/forecastViews.test.mjs`).

Firestore-reglene har egne tester:

```bash
yarn test:rules
```

De ligger i `firestore.rules.spec.mjs` og kjøres mot Firestore-emulatoren via
`firebase emulators:exec` (krever Java). Filnavnet slutter bevisst på
`.rules.spec.mjs` og ikke `.test.mjs`, slik at `node --test` **ikke** plukker dem
opp under vanlige `yarn test` — de ville feilet uten emulator. CI kjører begge.

Testene dekker det som faktisk kan misbrukes: grensen mellom tavler, at en
melding ikke kan avpubliseres fra en tavle du ikke har tilgang til, og at ingen
kan gi seg selv tilgang. Kjører du emulatoren fra før på port 8080, må den
stoppes først — `emulators:exec` vil ha porten selv.

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

Transform-logikken er dekket av tester i `scripts/floorplan-transform.test.mjs`
(se [Tester](#tester)).
