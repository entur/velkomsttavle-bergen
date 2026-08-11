# Design: Sporendring, gule avvik og TravelTag i avgangsvisninga

**Dato:** 2026-08-11
**Status:** Godkjent design, klar for implementeringsplan

## Mål

Avgangsvisninga skal skille tydeligere mellom det normale og det avvikende, og
linjemerket skal bruke Enturs egen komponent i stedet for en håndlaget brikke.

- **Sporendring** utheves gult når toget går fra et annet spor enn planlagt.
- **Avviksmeldinga** får et varselikon og gul utheving i stedet for tegnet `↳`.
- **Linjemerket** blir en `TravelTag` fra `@entur/travel`, som viser
  transportmiddel-ikon og linjenummer, farget etter Bane NORs linjekategori.

## Bakgrunn / funn

- `Departures.jsx` rendrer et fire-kolonners grid: `LineBadge`, destinasjon med
  eventuell avvikstekst, spor, og en høyrekolonne med brikker og tidspunkter.
- Avviksteksten står i dag som `↳ {departure.situation}` (`Departures.jsx:107`).
  **`PageNavigationIcon` finnes ikke i repoet** — tegnet `↳` er det som byttes ut.
- `Chip` (`Departures.jsx:43`) bærer en regel som er verdt å arve: gul brukes
  som *fyll* med mørkeblå tekst, aldri som tekstfarge, fordi gul mot lys lavendel
  er kontrast 1.10.
- **Målt kontrast for canary `#ffca28` som tekst** på de flatene karusellen kan ha:
  mørk blå `#181c56` gir 10.25, lavendel `#aeb7e2` gir 1.29, lys lavendel
  `#d9dae8` gir 1.10, hvit `#ffffff` gir 1.53. Gul tekst er altså lesbar på
  mørke flater og usynlig på lyse — og `DEFAULT_CAROUSEL_SURFACE` er
  `lys-lavendel`.
- `surfacePalette` (`surfaces.js`) gir seks flater, hver med `mode` som er
  `'dark'` eller `'light'`. `Departures` forgrener seg allerede på `palette.mode`.
- **Journey Planner v3 har ikke noe felt for sporendring.** Sondering av
  `EstimatedCall`-typen i skjemaet gir hverken `platformChanged`,
  `quayChanged` eller liknende. Feltene som finnes og betyr noe her er `quay`,
  `stopPositionInPattern`, `serviceJourney`, `realtime` og `cancellation`.
- `ServiceJourney` har derimot `quays` — kvaiene i rutemønsteret, altså planverket.
  Sondert mot live-APIet (Oslo S, fem avganger, 2026-08-11) er
  `serviceJourney.quays[stopPositionInPattern].id` identisk med
  `estimatedCall.quay.id` når sporet ikke er endret. Lengden på `quays` varierer
  (6–18), og `stopPositionInPattern` peker riktig inn i den.
- `lineAppearance` (`lineAppearance.js`) gir i dag alltid et fyll: Bane NORs
  L/R/F-farger når linjekoden matcher `/^([LRF])\d+$/i`, ellers Enturs
  transportmiddel-palett, ellers en nøytral farge.
- `TravelTag` (`@entur/travel@8.0.1`) leser `--background-color` og
  `--text-color` som CSS-variabler på `.eds-travel-tag`. De kan settes inline.
  Komponenten er dimensjonert for laptop: `height: 2rem`, `font-size: 0.875rem`,
  `padding: 0.25rem 0.5rem`. Dagens `LineBadge` bruker `font-size: 1.75rem`.
### Samsung-skjermen — gjennomgang av hele kjeden

`browserBaseline.test.mjs` setter grensa til Tizen med Chromium 85. Alt under er
sondert mot pakkene i `node_modules`, ikke antatt.

**Holder uten tiltak:**

- Ingen post-85 innebygde metoder i `@entur/travel` eller `@entur/icons`.
  Sveip etter `Object.hasOwn`, `structuredClone`, `.at(`, `.findLast`,
  `.toSorted`, `Array.fromAsync` og `withResolvers` gir null treff i begge.
- `build.target` er allerede `chrome85` i `vite.config.js`, så syntaks dekkes.
- CSS-variabler er Chromium 49. Definisjonene av
  `--components-travel-traveltag-*` bor i `@entur/travel/dist/styles.css` selv —
  ikke i `@entur/tokens` — under vanlige `:root` og `[data-color-mode=light]`.
  Begge parses på 85. Stilarket må derfor importeres, og det er nok.
- **Overstyringa vår vinner.** `TravelTag` bygger `style: { ...dynamicCssVars,
  ...style }`, altså spres vår `style` sist. `--background-color` og
  `--text-color` fra oss slår komponentens egne. Lest i kilden, ikke antatt.

**`:where()` — femten regler, to som betyr noe.** Selektoren kom i Chromium 88,
så reglene forkastes på skjermen. Regelvis, ikke hele arket: CSS-feilhåndtering
forkaster til blokka er slutt. Av de femten gjelder elleve `:where(.eds-contrast)`,
og de er **irrelevante her**: `Contrast` brukes bare i `MiddleBand`, mens
karusellen er et søskenfelt, så `useContrast()` gir `false` og klassen finnes
ikke over `Departures`. To til gjelder `__alert`, `__label`, `__details` og
`__close-button`, som vi ikke bruker; det samme gjelder den ene `:has()`-regelen.

Igjen står to, begge om ikonet inni merket:

| Regel | Setter |
|---|---|
| `.eds-travel-tag > :where(.eds-icon)` | `font-size: 1.5rem`, `color: var(--text-color)` |
| `.eds-travel-tag--icon-and-text > :where(.eds-icon)` | `margin-right: 0.5rem` |

**`getTransportStyle` kaster på ukjent transportmiddel.** `default:` gir
`throw Error("Please select a transport for the Travel component.")`, og
`scooter`, `bike`, `car` og `foot` kaster hver for seg som utgåtte. Enturs
`transportMode` inneholder `trolleybus`, `monorail` og `lift`, som ingen av de
25 `case`-etikettene dekker. Sendt rett inn tar de ned komponenten.
`Departures` ligger inne i `ErrorBoundary` (`App.jsx:112`), så det gir ikke hvit
skjerm — men avgangstavla forsvinner fra karusellen.

- `@entur/button` sender allerede 56 `:where()`-regler, men brukes bare i admin.
  Kiosken har ikke hatt `:where()` i CSS-en sin før.

## Løsning

### 1. Sporendring utledes fra planlagt mot faktisk kvai

Spørringa i `enturDepartures.js` utvides:

```graphql
estimatedCalls(...) {
  ...
  stopPositionInPattern
  quay { id publicCode }
  serviceJourney {
    line { publicCode transportMode }
    quays { id }
  }
}
```

`departureMapper.js` får en eksportert `isPlatformChanged(estimatedCall)`:

```
planlagt = serviceJourney.quays[stopPositionInPattern].id
faktisk  = quay.id
endret   = planlagt ≠ ''  ∧  faktisk ≠ ''  ∧  planlagt ≠ faktisk
```

Mangler `quays`, er `stopPositionInPattern` ikke et heltall, eller er en av
id-ene tom, er svaret `false`. En tavle som ikke vet, skal ikke rope. Resultatet
legges på avgangen som `platformChanged`.

`Number.isInteger` brukes til indeks-sjekken; den er ES6 og ligger godt innenfor
Chromium 85. `.at()` skal **ikke** brukes — den står på lista i
`browserBaseline.test.mjs`.

**Kjent usikkerhet.** At `serviceJourney.quays` beholder planverdien når SIRI-ET
flytter toget, er utledet av datamodellen, ikke observert. Sonderinga bekreftet
bare at de to er like når sporet *ikke* er endret. Første ekte sporendring på
Bergen stasjon er verifikasjonen. Slår antakelsen feil, viser feltet aldri gult —
det gir ikke falske utslag, fordi ulikhet er det eneste som utløser uthevingen.

### 2. `warningStyle(theme)` eier den gule fargen

Ny modul `src/departures/warningStyle.js`, uten JSX og uten nettverk, slik at den
kan kontrastmåles med `node --test`:

| | `theme === 'dark'` | ellers |
|---|---|---|
| `color` | canary `#ffca28` | mørkeblå `#181c56` |
| `backgroundColor` | `'transparent'` | canary `#ffca28` |
| `border` | `'none'` | `2px solid #181c56` |

På lyse flater er kontrasten mørkeblå mot canary-fyllet, altså 10.25 uansett
flate. På mørke flater er den canary mot flata selv: 10.25 mot `morkebla`
`#181c56` og 6.48 mot `morkebla-lys` `#393d79`. Begge er godt over 4.5.

Regelen er den samme `Chip` allerede følger, nå navngitt og delt. Funksjonen eier
farge, ikke form: hjørneradius og innrykk settes på kallstedet, fordi sporet er
en pille og avviksmeldinga er en boks.

### 3. Sporet og avviksmeldinga bruker den

**Spor.** Uendret spor står som i dag, `Spor {platform}` i arvet tekstfarge.
Er `platformChanged` sann, legges `warningStyle(palette.mode)` på — gul tekst på
mørk flate, gul pille med mørkeblå kant på lys. Gammelt spornummer vises ikke.

**Avvik.** `↳` erstattes med `ValidationExclamationCircleFilledIcon` fra
`@entur/icons`, og linja får `warningStyle(palette.mode)`. På lyse flater blir
ikon og setning stående i en gul boks med mørkeblå tekst — i praksis en liten
innebygd varselboks. På mørke flater er både ikon og tekst gule uten fyll.

### 4. `LineBadge` blir `TravelTag`

`lineAppearance` erstattes av `categoryFill(lineCode, theme)`, som gir Bane NORs
farge for L/R/F-koder og `null` for alt annet. `lineAppearance` og testene dens
slettes; ingen andre kaller den.

`Departures.jsx` rendrer:

```jsx
<TravelTag
    transport={travelTagTransport(departure.transportMode)}
    className="avgangstavle-traveltag"
    style={fill ? { '--background-color': fill.background, '--text-color': fill.text } : undefined}
>
    {departure.lineCode || '–'}
</TravelTag>
```

Overstyringa skjer bare når linja har L/R/F-kode. Ellers fargelegger `TravelTag`
seg selv fra transportmiddelet, som er den fargelogikken Entur allerede eier.
Ikonet forteller middelet, fargen forteller linjekategorien.

Tekstfargen på Bane NOR-fyllene følger dagens regel: mørkeblå på mørkt tema,
hvit på lyst — de tre fyllene er mettede nok til begge deler.

`travelTagTransport(transportMode)` oversetter Enturs `transportMode` til
`TravelTag` sin `Transport`. Den er en **hviteliste, ikke en passthrough** — det
er en krasjsperre, ikke pynt, fordi `getTransportStyle` kaster på alt den ikke
kjenner:

| `transportMode` | `Transport` | Hvorfor |
|---|---|---|
| `rail`, `bus`, `tram`, `metro`, `water`, `air`, `funicular`, `cableway`, `taxi` | uendret | Egen `case` i `getTransportStyle` |
| `coach` | `bus` | Turbuss er buss for ikonets del |
| `trolleybus` | `bus` | Ingen egen `case`; kaster ellers |
| `monorail` | `metro` | Ingen egen `case`; nærmeste bane |
| `lift` | `cableway` | Ingen egen `case`; nærmeste taubane |
| alt annet, tomt, `null`, ikke-streng | `none` | Egen `case` som gir tomt ikon uten å kaste |

Verdiene `scooter`, `bike`, `car` og `foot` skal **aldri** sendes: de har egne
`case`-grener som kaster med utgåtte-melding. Hvitelista utelukker dem ved å
være en oppslagstabell — det som ikke står i tabellen blir `none`.

### 5. Opp­skalering og Tizen i én CSS-klasse

`@entur/travel/dist/styles.css` legges til importene i `src/css/main.css`.
Klassen `.avgangstavle-traveltag` gjør to jobber samtidig:

1. **Skalerer** merket til vegg-skjerm: høyde, `font-size`, `padding`,
   `min-width`, hjørneradius.
2. **Erstatter de to reglene Tizen forkaster**, skrevet uten `:where()`:

```css
.avgangstavle-traveltag > .eds-icon { font-size: …; color: var(--text-color); }
.avgangstavle-traveltag.eds-travel-tag--icon-and-text > .eds-icon { margin-right: …; }
```

Spesifisiteten er (0,2,0) mot originalens (0,1,0) — `:where()` teller null — så
vår regel vinner også på en motor som støtter selektoren. Resultatet blir
identisk begge veier, og det er poenget: ingen andre kodevei å teste, ingen
`@supports`-forgrening.

Dette er grunnen til at eksplisitt CSS ble valgt framfor `zoom`: `zoom` skalerer,
men reparerer ikke de forkastede reglene.

## Testing

Alt kjører under `npm test` (`node --test`), som resten av repoet.

- **`departureMapper.test.mjs`:** `platformChanged` er sann når planlagt og
  faktisk kvai-id er ulike; falsk når de er like; falsk når `quays` mangler, når
  `stopPositionInPattern` er utenfor lista eller ikke et heltall, og når en av
  id-ene er tom.
- **`warningStyle.test.mjs`:** for hver av de seks flatene i `SURFACES` er den
  effektive kontrasten minst 4.5 — tekst mot flate på mørke, tekst mot fyll på
  lyse. Samme mønster som `surfaces.test.mjs`, som allerede har en
  `contrast`-hjelper å kopiere.
- **`lineAppearance.test.mjs` → `categoryFill.test.mjs`:** L/R/F gir Bane NOR-
  fargene i begge temaer, små bokstaver godtas, `L` uten tall og bussnumre gir
  `null`.
- **`travelTagTransport.test.mjs`:** hver rad i tabellen over, og — viktigst —
  at ingen inndata i det hele tatt kan gi en verdi `getTransportStyle` kaster på.
  Testen kaller den ekte `getTransportStyle` fra `@entur/travel` med resultatet
  av `travelTagTransport` for hver `transportMode` Entur kan sende, pluss
  `scooter`, `bike`, `car`, `foot`, tom streng, `null`, `undefined` og et tall.
  Kaster den, feiler testen. Det er den eneste sjekken som faktisk beviser at
  avgangstavla ikke forsvinner på et ukjent transportmiddel.
- **`browserBaseline.test.mjs`:** kjører uendret over de nye filene og fanger
  eventuell for ny JS-syntaks.

I tillegg verifiseres `TravelTag` visuelt i preview — at merket er lesbart i
begge temaer, og at ikonet får riktig størrelse gjennom vår egen CSS-regel. Det
siste testes ved å slå av `@entur/travel`-regelen i devtools: ser merket likt ut
med og uten, er Tizen dekket.

## Utenfor omfang

- `Innstilt`- og nedtellings-`Chip`, de overstrøkne rutetidene og
  `rutetid`-merket. Uendret.
- `TravelTag` sin egen `alert`-boble og `onClose`. Ikke etterspurt; `Chip`
  formidler allerede innstilling med ord.
- Å vise det gamle spornummeret ved siden av det nye.
- Toppfelt, bunnstripe og admin.
- Å måle den faktiske Chromium-versjonen på skjermen. Grensa i
  `browserBaseline.test.mjs` er fortsatt utledet, ikke observert. Denne
  endringen holder seg under 85 uansett, så den er dekket — men neste gang noen
  vurderer et nyere API, står de på samme gjetning. Bevisst valgt bort her for å
  holde omfanget rent.
