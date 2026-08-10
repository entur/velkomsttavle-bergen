# Design: Bunnstripe og konfigurerbare flatefarger

**Dato:** 2026-08-10
**Status:** Godkjent design, klar for implementeringsplan

## Mål

Tavla får et fjerde felt nederst — en lav stripe — og fargevalget løsner fra
lys/mørk til en navngitt palett som stripa og karusellen velger fra hver for seg.

- **Bunnstripa** er et eget felt på ca. 20vh nederst på skjermen, med sin egen
  modulliste. I denne omgangen kan den vise værvarselet. Mekanismen er generisk,
  slik at flere moduler kan flytte ned senere uten ny arkitektur.
- **Stripeværet** har «nå» fast til venstre og veksler til høyre mellom de neste
  seks timene og de neste fire dagene.
- **Flatefargen** velges per felt fra seks navngitte farger, ikke fra to temaer.
  Karusellen og stripa velger uavhengig av hverandre.
- **En modul bor ett sted.** Flytter du været ned i stripa, forsvinner det fra
  karusellen. Det håndheves både i admin og i normaliseringen.

Toppfeltet og midtfeltet beholder dagens `theme` med to verdier. De ligger inntil
hverandre og skal fortsatt lese som ett felt, slik `2026-08-07-lyst-tema-og-
midtfelt-design.md` slo fast.

## Bakgrunn / funn

- `App.jsx` stabler `TopBand` (fast 40vh) → `MiddleBand` (`maxHeight: 45vh`, eller
  `flex: 1` uten karusell) → `Carousel` (`flex: 1`, `minHeight: 0`).
- Værpollingen ligger i `App.jsx:59`, ikke i `Weather`, fordi karusellen bare
  rendrer aktiv slide og dermed av- og remonterer modulen. Avhengighetene er `lat`
  og `lng` som tall, ikke modul-objektet, nettopp fordi `onSnapshot` gir et nytt
  objekt for hver lagring i admin og et objekt her ville startet ny polling mot
  api.met.no hver gang. MET sine vilkår ber om det motsatte. Dette må bestå.
- `carouselPalette(theme)` (`carouselTheme.js:25`) gir
  `{ theme, background, panel, text, iconActive, iconInactive }`. `Weather`,
  `Departures`, `OfficeMap` og `Carousel` kaller den selv med en `theme`-streng.
- `Weather.jsx:78` forgrener seg på `palette.theme === 'dark'` tre steder: kant på
  nå-kortet, bakgrunn på times- og dagskortene, og tekstfarge på de samme kortene.
  I lyst tema er kortbakgrunnen hardkodet fersken (`PEACH`, `Weather.jsx:9`).
- `iconActive` og `iconInactive` er døde felt. Ikon-raden i karusellen ble fjernet
  i 44a7074, og ingen leser dem lenger.
- **Samme commit etterlot en feil:** progress-baren ble pakket inn i
  `slides.map(() => { <div/> })` — en blokk-kropp uten `return`. Karusellen rendrer
  altså ingen progress-bar i dag (`Carousel.jsx:52`).
- `staffImageFrom` (`boardConfig.js:70`) er mønsteret for migrering av et flyttet
  felt: nytt felt leses først, gammel plassering er fallback, og
  `toFirestoreBoard` skriver bare den nye formen.
- Firestore-reglene kan ikke iterere over lister og validerer derfor bare grovformen
  på `middle` og `carousel` (`isValidBoard`). `carouselTheme` sjekkes bare når
  feltet finnes — mønsteret nye valgfrie felt skal følge.
- Fargeverdier fra `@entur/tokens`: `brand.blue #181c56`, `brand.lavender #aeb7e2`,
  `brand.peach #ffbf9e`, `brand.coral #ff5959`, `frame.contrastalt #393d79`,
  `frame.contrastalt2 #292b6a`, `frame.subdued #d9dae8`, `frame.tint #f6f6f9`.

## Beslutninger

| Spørsmål | Valg |
|---|---|
| Stripe ved siden av eller i stedet for karusellen | Egen modulliste `bottom` ved siden av `carousel`. En modul bor ett sted; karusellen kan bli tom og faller da bort som i dag. |
| Hva «konfigurerbar farge» betyr | Lukket liste med seks navngitte flater, ikke fri fargevelger. Da kan kontrasten testes, og en tavle kan ikke havne med uleselig tekst. |
| Én farge for begge feltene, eller én hver | Én hver. `carouselSurface` og `bottomSurface` er uavhengige. |
| Om topp/midt også får paletten | Nei. De beholder `theme` med to verdier. Utenfor omfanget. |
| Hvilke moduler stripa støtter nå | Bare `weather`. Katalogen er generisk, men vi designer ikke en andre kompakt visning før den første er sett på skjerm. |
| Hva stripa gjør med «nå» | Fast til venstre, alltid synlig. Bare høyre side veksler. |
| Hvordan modulene får farger | Komponentene tar imot et ferdig `palette`-objekt, ikke en tema-streng. `Weather` rendres i to felt med hver sin flate og kan ikke slå opp fargen selv. |
| Progress-bar-fargen | Koral for alle flater, med en egen kontrastgrense i testen. Én accent-farge er enklere å lese enn seks. |
| Karusell-buggen fra 44a7074 | Fikses her, som en konsekvens av at progress-baren trekkes ut til en delt komponent — ikke som en løs lapp. |

## Configmodellen

To nye felt og én ny liste på toppnivå:

```js
{
  theme: 'dark' | 'light',        // uendret — topp og midt
  carouselSurface: 'lys-lavendel', // ny — erstatter carouselTheme
  bottomSurface: 'morkebla',       // ny
  top: { kind: 'video' | 'logo' },
  middle: [...],
  carousel: [...],
  bottom: [ { type: 'weather', name, lat, lng } ],  // ny
}
```

`bottom` normaliseres med samme `normalizeModules` som de to andre listene, over en
egen katalog:

```js
export const BOTTOM_TYPES = ['weather'];
```

Værnormalisatoren gjenbrukes uendret — vær uten brukbare koordinater faller bort
før det når skjermen, uansett hvilket felt det står i.

### En modul bor ett sted

Regelen håndheves i `normalizeBoardConfig`, ikke bare i admin: etter at begge
listene er normalisert, fjernes fra `carousel` enhver type som finnes i `bottom`.
`bottom` vinner. Et dokument redigert for hånd i Firestore-konsollet kan altså ikke
gi to værmoduler og to pollinger.

### Migrering

Samme mønster som `staffImageFrom`:

1. `source.carouselSurface` når den er et kjent flatenavn,
2. ellers `source.carouselTheme` oversatt: `'dark'` → `morkebla`, `'light'` →
   `lys-lavendel`,
3. ellers standarden `lys-lavendel`.

`bottomSurface` har ingen gammel plassering og faller på standarden `morkebla` —
stripa skal skille seg fra karusellen, som oftest er lys.

`toFirestoreBoard` slutter å skrive `carouselTheme` og skriver `carouselSurface` i
stedet. Eksisterende dokumenter ser identiske ut ved lesing. Ingen batch-jobb.

Det gamle feltet blir liggende: `saveBoardConfig` bruker `{ merge: true }`, så et
felt vi slutter å skrive blir ikke slettet. Det er greit — normaliseringen leser
`carouselSurface` først, og `carouselTheme` blir da et dødt felt uten virkning. Vi
bruker ikke `deleteField()` for å rydde det; en ekstra skriveoperasjon for å fjerne
et felt ingen leser er ikke verdt risikoen. **Konsekvens for reglene:** siden feltet
blir liggende, og `request.resource.data` ved en merge-skriving er det
sammenslåtte dokumentet, må `isValidBoard` beholde dagens `carouselTheme`-klausul.
Fjernes den, avvises hver eneste lagring på en gammel tavle.

## Flatetabellen

`src/boards/surfaces.js` erstatter `carouselTheme.js` — uten JSX og uten
Firebase-import, slik at fargene kan kontrastmåles med `node --test`.

```js
export const SURFACES = ['morkebla', 'morkebla-lys', 'lavendel',
                         'lys-lavendel', 'hvit', 'fersken'];
export const DEFAULT_CAROUSEL_SURFACE = 'lys-lavendel';
export const DEFAULT_BOTTOM_SURFACE = 'morkebla';

export function surfacePalette(name)
// → { name, mode, background, panel, text, accent }
```

| Navn | Etikett i admin | `background` | `mode` | `text` | `panel` |
|---|---|---|---|---|---|
| `morkebla` | Mørk blå | `#181c56` | dark | `#ffffff` | `#393d79` |
| `morkebla-lys` | Mørk blå, lysere | `#393d79` | dark | `#ffffff` | `#292b6a` |
| `lavendel` | Lavendel | `#aeb7e2` | light | `#181c56` | `#ffffff` |
| `lys-lavendel` | Lys lavendel | `#d9dae8` | light | `#181c56` | `#ffffff` |
| `hvit` | Hvit | `#ffffff` | light | `#181c56` | `#d9dae8` |
| `fersken` | Fersken | `#ffbf9e` | light | `#181c56` | `#ffffff` |

`accent` er koral `#ff5959` på alle flater.

Målt tekstkontrast mot bakgrunnen: 15,8 / 9,9 / 8,0 / 11,4 / 15,8 / 10,0. Alle godt
over 4,5.

`mode` er det som gjør utvidelsen billig. `Weather`, `Departures` og `OfficeMap`
forgrener seg allerede på lys/mørk, og de forgreningene overlever uendret når hver
flate bærer sin egen modus. Uten `mode` måtte hver av dem lært seg seks farger.

Navnene er ASCII-slugs uten æøå, fordi de lagres som verdier i Firestore og
gjentas i `firestore.rules`. Etiketten i tabellen over er det admin viser.

`iconActive` og `iconInactive` blir ikke med videre. De er døde siden 44a7074.

### Ferskenfellen

`Weather` maler i dag times- og dagskortene fersken i lyst tema. Med `fersken` som
mulig bakgrunn ville de kortene forsvinne i flaten. `PEACH` byttes derfor mot
`palette.panel`, og flatetabellen eier fargen. Det er grunnen til at `panel` har en
egen kontrastgrense mot bakgrunnen i testen, ikke bare et krav om å være ulik.

## Rendering

Feltrekkefølgen blir `TopBand` → `MiddleBand` → `Carousel` → `BottomBand`.

### Komponentene tar palett, ikke tema

`App` slår opp `surfacePalette(config.carouselSurface)` og
`surfacePalette(config.bottomSurface)` én gang, og sender palett-objektet ned.
`Weather`, `Departures`, `OfficeMap` og `Carousel` slutter å importere
`carouselPalette`. Det er ikke pynt: `Weather` rendres nå i to felt med hver sin
flate, og kan ikke lenger slå opp fargen sin selv.

### Værpollingen

Oppslaget i `App.jsx:48` må lete i `bottom` først og deretter i `carousel`, slik at
været pollet uansett hvilket felt det står i. Normaliseringen garanterer at det bare
finnes ett treff, så det blir aldri to pollinger. Avhengighetslista til `useEffect`
blir uendret — fortsatt `lat` og `lng` som tall, aldri modul-objektet, av grunnen
kommentaren over den forklarer.

### `BottomBand.jsx`

`flex: '0 0 20vh'`, full bredde, bakgrunn fra `bottomSurface`. Rendrer modulene i
`bottom` eksplisitt — samme måte som `MiddleBand` gjør for `middle`, ikke ved å
iterere over en registry. En ny type må derfor også legges inn her, og det står som
kommentar i filen slik `MIDDLE_TYPES` har det i dag.

Tom `bottom`-liste ⇒ komponenten rendrer `null` og feltet faller bort.
Innholdet pakkes i `ErrorBoundary`.

### `WeatherStripe.jsx`

```
┌─ BottomBand (bakgrunn fra bottomSurface) ─────────────────┐
│ ┌────────┐ ┌──────────────────────────────────────────┐  │
│ │ NÅ     │ │ ▓▓▓▓▓▓░░░░░░░░░░  (progress)             │  │
│ │ ☀ 18°  │ │ 14  15  16  17  18  19   ← veksler med → │  │
│ │ 3 m/s  │ │ ☀   ☀   ☁   ☂   ☁   ☀      tir ons tor  │  │
│ └────────┘ └──────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

Nå-kortet står fast til venstre med symbol, temperatur, vind og nedbør. Høyre side
veksler mellom `hours` (seks timer) og `days` (fire dager), 15 sekunder per visning.

15 sekunder, ikke karusellens 30: hver visning er liten og lest på tre sekunder, og
med 30 ville stripa stått stille gjennom nesten en hel karusellslide.
Tallet justeres etter visuell kontroll.

Komponenten henter ingenting selv. `weather` kommer som prop fra samme polling i
`App` som karusellværet.

**Uten data:** nå-kortet viser «–» og høyre side står tom. Feltet beholder høyden,
slik at layouten ikke hopper når varselet kommer.

**Uten dagsvarsel:** `buildDailyForecast` hopper over resten av inneværende dag, så
sent på kvelden kan lista bli tom. Da faller `days`-visningen bort, `hours` står
alene, og progress-baren rendres ikke — det er samme regel som for én slide i
karusellen.

### Delte værutregninger

`Weather` og `WeatherStripe` trenger de samme avledningene fra timeseriene.
`buildDailyForecast` (i dag en lokal funksjon i `Weather.jsx:24`) flyttes derfor
sammen med de to andre til `src/weather/forecastViews.mjs`:

```js
export function nowSummary(timeseries)
// → { symbol, temperature, wind, precipitation } | null
export function hourlyForecast(timeseries, hours = 6)
// → [{ time, symbol, temperature, precipitation }]
export function dailyForecast(timeseries, days = 4, now = new Date())
// → [{ date, weekday, max, min, symbol }]
```

`now` er en parameter og ikke `new Date()` inni funksjonen, slik at «hopp over
resten av i dag»-regelen kan testes uten å vente til midnatt.

Rene funksjoner uten JSX — det er slik `playbackWatchdog.mjs` og
`videoBlobLoader.mjs` allerede skiller testbar logikk fra komponentene i dette
repoet. `Weather` bytter til de samme funksjonene, med uendret oppførsel.

### Delt veksling

Timeren trekkes ut av `Carousel` til `src/components/rotation.mjs` som en ren
funksjon, testbar med `node --test`:

```js
export function advance({ elapsed, index }, { tick, duration, count })
// → { elapsed, index }
```

`count <= 1` gir alltid `{ elapsed: 0, index: 0 }` — ingenting å veksle mellom, og
ingen progress-bar som teller ned til et bytte som aldri kommer.

`Carousel` og `WeatherStripe` får hver sin tynne `useEffect` rundt funksjonen.
Progress-baren blir `src/components/ProgressBar.jsx` — 6px høy, `accent` på
`background` — som begge bruker. Feilen fra 44a7074 forsvinner med flyttingen.

### Høyde når alt er på

Fire felt samtidig — 40vh topp, midtfelt, karusell og 20vh stripe — er trangt.
Regelen blir:

| | `MiddleBand` | `Carousel` | `BottomBand` |
|---|---|---|---|
| Bare midt | `flex: 1` | — | — |
| + karusell | `maxHeight: 45vh` | `flex: 1` | — |
| + stripe | `flex: 1` | — | `0 0 20vh` |
| + begge | `maxHeight: 35vh` | `flex: 1` | `0 0 20vh` |

`MiddleBand` får derfor `hasBottom` ved siden av dagens `hasCarousel`. To booleanske
propper framfor en ferdig høyde, slik at regelen står ett sted — i komponenten som
eier feltet.

Midtfeltets `overflow: hidden` og `justifyContent: 'flex-start'` er uendret: feltet
klippes fortsatt nedenfra, slik at det alvorligste varselet overlever. Kommentaren
i `MiddleBand.jsx` som forklarer hvorfor, må ikke røres.

`35vh` og `20vh` er utgangspunktet, ikke fasit. Begge justeres etter visuell
kontroll mot en ekte tavle med varsel, hilsen og åpningstider oppe samtidig.

## Admin

I `BoardConfigForm.jsx`:

- **Plassering av været** styres av én `RadioGroup` med tre valg: **Av / I
  karusellen / I bunnstripa**. Regelen om at en modul bor ett sted blir da synlig i
  grensesnittet i stedet for en valideringsfeil du oppdager etter å ha trykket
  lagre. Sted og koordinater vises under, uendret, når været er på.
- **Karusellen** får `Dropdown` over de seks flatene i stedet for radioknappene for
  lys/mørk.
- Ny seksjon **Bunnstripa** med samme `Dropdown`.
- `draftFrom` og `configFrom` får `weatherPlacement`, `carouselSurface` og
  `bottomSurface`. `configFrom` legger værmodulen i `carousel` eller `bottom` etter
  plasseringen.
- `boardValidation` bytter `CAROUSEL_THEMES`-sjekken mot `SURFACES` for begge
  feltene, og koordinatkravene gjelder når været er på uansett plassering.

## Firestore-regler

`isValidBoard` utvides, alle tre valgfrie etter mønsteret `carouselTheme` bruker i
dag — feltene finnes ikke i eksisterende dokumenter:

```
&& (!d.keys().hasAny(['bottom']) || (d.bottom is list && d.bottom.size() <= 5))
&& (!d.keys().hasAny(['carouselSurface']) || d.carouselSurface in SURFACE_NAMES)
&& (!d.keys().hasAny(['bottomSurface']) || d.bottomSurface in SURFACE_NAMES)
```

Dagens `carouselTheme`-klausul blir stående, av grunnen migreringsavsnittet
forklarer: feltet ligger igjen i gamle dokumenter og er med i den sammenslåtte
`request.resource.data`.

der `SURFACE_NAMES` skrives ut som literal liste — regler kan ikke importere.
Listen finnes altså to steder, i `surfaces.js` og i `firestore.rules`. Det står som
kommentar begge steder, på linje med hvordan `theme` og `top.kind` allerede er
duplisert.

Kravene gjelder skrivinger, ikke lesinger. Klient og regler deployes i samme
kjøring ved push til `main`, så det finnes ikke et vindu der en ny klient skriver
mot gamle regler.

## Testing

`node --test`:

- **`surfaces.test.mjs`** (ny, erstatter `carouselTheme.test.mjs`) — for alle seks
  flater: `background`, `panel`, `text` og `accent` er gyldige hex, `name` er
  navnet det ble slått opp med, `text` mot `background` ≥ 4,5, `text` mot
  `panel` ≥ 4,5, `panel` mot `background` ≥ 1,2, `accent` mot `background` ≥ 1,5.
  Ukjent navn og `undefined` gir standardflaten. `mode` er `'dark'` eller
  `'light'`.
- **`rotation.test.mjs`** (ny) — vekslingen teller opp og går rundt, `count === 1`
  og `count === 0` står stille, `elapsed` nullstilles ved bytte, og en `index`
  utenfor rekkevidde faller tilbake til 0 når lista krymper.
- **`forecastViews.test.mjs`** (ny) — `nowSummary` med og uten `next_1_hours`,
  `hourlyForecast` hopper over inneværende time og respekterer antallet,
  `dailyForecast` hopper over resten av dagen `now` peker på, grupperer riktig
  min/max, og gir tom liste når det bare finnes data for i dag.
- **`boardConfig.test.mjs`** — `bottom` normaliseres som de andre listene, ukjente
  typer faller bort, vær uten koordinater faller bort, vær i både `carousel` og
  `bottom` gir bare `bottom`, migrering fra `carouselTheme` begge veier, ukjent
  flatenavn faller på standarden.
- **`boardValidation.test.mjs`** — koordinatkrav uansett plassering, ugyldig
  flatenavn gir feil.

`npm run test:rules` (emulator, usignert JWT — ikke gjetting): tavle med `bottom`
og begge `*Surface` godtas, `bottom` som ikke er liste avvises, ukjent flatenavn
avvises, og en tavle helt uten de nye feltene godtas fortsatt.

`npm run build` før PR.

Visuell kontroll i nettleseren: stripa med og uten karusell, med og uten varsel
oppe, begge vekslingene, og minst tre flatekombinasjoner — inkludert mørkeblå
karusell over lys stripe og `fersken`, som er den flaten `PEACH`-byttet handler om.
Nå-kortets mørkeblå gradient sjekkes særskilt mot `morkebla-lys`, der kortet og
bakgrunnen ligger nærmest hverandre.

## Utenfor omfanget

- Flere moduler i stripa. Katalogen er generisk, men bare `weather` får en kompakt
  visning nå.
- Plantegning i stripa. Kartet trenger høyde; etikettene blir ubrukelige på 20vh.
- Palett for toppfeltet og midtfeltet. De beholder `theme` med to verdier.
- Fri fargevelger. Valget er en lukket liste, slik at kontrasten kan testes.
- Egne farger per modul eller per karusellslide.
- Flere striper enn én.
