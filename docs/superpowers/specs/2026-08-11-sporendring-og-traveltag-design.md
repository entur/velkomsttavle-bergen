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
- **`@entur/travel/dist/styles.css` bruker `:where()` femten steder.**
  `browserBaseline.test.mjs` fastslår at tavla kjører på Tizen med Chromium 85;
  `:where()` kom i Chromium 88. Reglene forkastes altså på skjermen — regelvis,
  ikke hele arket. De som betyr noe for oss er `.eds-travel-tag > :where(.eds-icon)`
  (ikonets størrelse og farge) og `:where(.eds-contrast) .eds-travel-tag`
  (kontrast-temaets farger).
- `@entur/button` sender allerede 56 slike regler, men brukes bare i admin.
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
`TravelTag` sin `Transport`-union. De to listene overlapper, men ikke helt:

| `transportMode` | `Transport` | Hvorfor |
|---|---|---|
| `rail`, `bus`, `tram`, `metro`, `water`, `air`, `funicular`, `cableway`, `taxi` | uendret | Finnes i begge listene |
| `coach` | `bus` | Turbuss er buss for ikonets del |
| `trolleybus` | `bus` | Samme |
| `monorail` | `metro` | Nærmeste bane |
| `lift` | `cableway` | Nærmeste taubane |
| alt annet, tomt eller ukjent | `none` | Ingen gjetting |

### 5. Opp­skalering og Tizen i én CSS-klasse

`@entur/travel/dist/styles.css` legges til importene i `src/css/main.css`.
Klassen `.avgangstavle-traveltag` gjør to jobber samtidig:

1. **Skalerer** merket til vegg-skjerm: høyde, `font-size`, `padding`,
   `min-width`, hjørneradius.
2. **Erstatter reglene Tizen forkaster.** De samme egenskapene som
   `.eds-travel-tag > :where(.eds-icon)` setter — ikonets `font-size` og `color` —
   skrives om uten `:where()`, slik at ikonet ser likt ut på Chromium 85 og på
   utviklermaskinen.

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
- **`travelTagTransport.test.mjs`:** hver rad i tabellen over, og at ingen
  returverdi faller utenfor `Transport`-unionen.
- **`browserBaseline.test.mjs`:** kjører uendret over de nye filene og fanger
  eventuell for ny JS-syntaks.

I tillegg verifiseres `TravelTag` visuelt i preview — at merket er lesbart i
begge temaer, og at ikonet får riktig størrelse gjennom vår egen CSS-regel og
ikke gjennom `:where()`-regelen.

## Utenfor omfang

- `Innstilt`- og nedtellings-`Chip`, de overstrøkne rutetidene og
  `rutetid`-merket. Uendret.
- `TravelTag` sin egen `alert`-boble og `onClose`. Ikke etterspurt; `Chip`
  formidler allerede innstilling med ord.
- Å vise det gamle spornummeret ved siden av det nye.
- Toppfelt, bunnstripe og admin.
