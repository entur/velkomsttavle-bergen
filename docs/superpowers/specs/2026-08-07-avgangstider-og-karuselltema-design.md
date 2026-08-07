# Design: Avgangstider og tema på karusellen

**Dato:** 2026-08-07
**Status:** Godkjent design, klar for implementeringsplan
**Fase:** 3 av 3 i [parameteriserte tavler](2026-08-06-parameteriserte-tavler-design.md)

## Mål

To ting som henger sammen fordi de treffer den samme skjermen:

1. **Avgangsmodulen.** En tavle kan vise sanntids avgangstider fra ett stoppested, med forsinkelser, innstillinger og avviksmeldinger. Driveren er billettkontor-tavla i Bergen, som skal vise avganger fra **Bergen stasjon** (`NSR:StopPlace:59983`).
2. **Tema på karusellen.** Karusellen kan settes lys eller mørk per tavle. En avgangstavle leses best på mørk bunn, og målingene under viser at mørkt tema er merkbart bedre enn dagens lyse for alle fargede elementer.

## Bakgrunn: hva som faktisk ble målt

Alt i dette avsnittet er verifisert mot levende API-er og mot `@entur/tokens`, ikke hentet fra hukommelsen.

### Entur Journey Planner v3

- **Endepunkt:** `POST https://api.entur.io/journey-planner/v3/graphql`
- **Autentisering:** ingen nøkkel. Headeren `ET-Client-Name` er påkrevd, på formen `<selskap>-<applikasjon>`. Vi bruker `entur-velkomsttavle`.
- **CORS:** `access-control-allow-origin: *` — verifisert. Kiosken kan kalle den direkte fra nettleseren, uten backend.
- **Feltnavn:** innstilling heter `cancellation`, ikke `cancelled`. Sistnevnte finnes ikke på `EstimatedCall` og gir valideringsfeil.
- **Geocoder:** `GET https://api.entur.io/geocoder/v1/autocomplete?text=<q>&layers=venue` gir NSR-id-er. Også CORS-åpen.

### Avvik kommer i tre former

| Form | Felt | Karakter |
|---|---|---|
| Forsinkelse | `expectedDepartureTime` ≠ `aimedDepartureTime` | Tall. Alltid tilgjengelig. |
| Innstilling | `cancellation: true` | Ja/nei. Krever `includeCancelledTrips: true` i spørringen. |
| Situasjon | `situations[].summary` | Fritekst av ukjent lengde, med språkkode. |

### Sanntid er ikke garantert

Feltet `realtime` var `true` for alle togavganger fra Bergen stasjon, men `false` for flere bussavganger fra Bergen busstasjon. Er det `false`, kommer klokkeslettet fra rutetabellen, og vi vet ikke om kjøretøyet faktisk går da.

### Bane NOR er ikke et alternativ

Undersøkt fordi det ble spurt om. Konklusjonen er nei, av tre uavhengige grunner:

1. **Bane NOR er en kilde *inn* i Entur.** Enturs sanntidsoversikt fører opp codespace `BNR` som «SJ Nord (via Bane Nor)». Togdataene har allerede gått gjennom Bane NOR.
2. **Feeden kan ikke leses fra en nettleser.** `https://www.banenor.no/reise-og-trafikk/trafikkmeldinger/?rss=true` svarer `200` men sender **ingen** CORS-headere — verifisert. Å bruke den ville krevd en proxy, altså en helt ny driftsflate for en app som i dag er statisk hosting pluss Firestore.
3. **Granulariteten passer ikke.** Meldingene gjelder strekninger over lange perioder («arbeid mellom Finse og Myrdal, 27. april til 29. november»), ikke enkeltavganger. Å feste dem til en rad krever en kobling fra linje til strekning som ikke finnes i dataene.

**Strekningsarbeid hører hjemme i meldingssystemet** fra fase 1 og 2 — redaksjonelt innhold noen legger inn, ikke en integrasjon.

### Linjefarger finnes ikke i API-et

`line.presentation.colour` er en **operatørfarge**, ikke en linjefarge:

| Stoppested | Linjer | Ulike farger |
|---|---|---|
| Bergen stasjon | L4, R40, F4 | 1 — alle `#FF0000` (Vy) |
| Bergen busstasjon | 19 | 4, de fleste tomme |

Feltet brukes derfor ikke. Farge settes i stedet av **linjekategori**, se «Farger».

### Karusellens ikonrad er i stykker i dag

`Carousel.jsx:56` tegner inaktive ikoner i `#ffffff` mot lavendel `#d9dae8`. Kontrast **1.39** — praktisk talt usynlig. Ikonraden er skrevet som om bakgrunnen allerede var mørk. Dette rettes som del av temaarbeidet, i begge temaer.

## Beslutninger

| Spørsmål | Valg |
|---|---|
| Antall stoppesteder per tavle | Ett |
| Datakilde | Entur Journey Planner v3. Ikke Bane NOR. |
| Antall avganger | 6, maks 3 timer fram. **Fast**, ikke konfigurerbart. |
| Transportmiddel-filter | Droppes. `modes` fra fase 1-katalogen bygges ikke. |
| Tid vises som | Nedtelling under 20 min, klokkeslett ellers |
| Innstilte avganger | Vises overstrøket, forsvinner ikke |
| Situasjonstekst | Inline i raden |
| Linjefarge | Etter kategori L/R/F, med transport-mode som fallback |
| Avviksfarge | Gul |
| Tema | Per tavle, gjelder hele karusellen |

## Datamodell

Modulen fyller plassen katalogen fra fase 1 allerede har satt av, minus `count` og `modes`:

```js
{ type: 'departures', stopPlaceId: 'NSR:StopPlace:59983', stopPlaceName: 'Bergen stasjon' }
```

Navnet lagres ved siden av id-en. Det sparer tavla for et oppslag bare for å skrive en overskrift, og gjør dokumentet leselig for et menneske — `NSR:StopPlace:59983` alene sier ingenting.

Tavla får ett nytt felt på rot:

```js
carouselTheme: 'light' | 'dark'     // default 'light'
```

Temaet ligger på tavla, ikke på modulen. En karusell som skifter bakgrunn mellom slides er ikke et design, det er en feil.

**Normalisering.** En `stopPlaceId` som ikke matcher `NSR:StopPlace:<tall>` gjør at modulen **faller bort**, på samme måte som vær uten koordinater i fase 1. En avgangsmodul som ikke kan slå opp noe har ingenting å vise, og en tom slide karusellen bruker 30 sekunder på er verre enn ingen slide. `carouselTheme` utenfor de to lovlige verdiene faller tilbake til `light`.

## Henting og oppdatering

Ett POST-kall med en konstant spørring: `numberOfDepartures: 6`, `timeRange: 10800`, `includeCancelledTrips: true`.

**Pollingen ligger i `App`, ikke i slide-komponenten.** Dette er den samme fella værmodulen allerede har en kommentar om i `App.jsx:37`: karusellen rendrer bare den aktive sliden, så en `useEffect` inne i avgangskomponenten ville hentet på nytt hver gang sliden kom tilbake. `App` står montert hele tiden.

**To takter, og bare den ene rører nettverket:**

| Hva | Hvor ofte | Nettverk |
|---|---|---|
| Hente avganger fra Entur | 60 sek | ja |
| Regne om «om 4 min» | 15 sek | nei |

Nedtellingen er ren regning på data vi allerede har. Å binde den til hentingen ville enten gitt et tall som står stille i et minutt, eller seksti ganger så mange kall som nødvendig.

**Nedtellingen regnes fra forventet tid, ikke planlagt.** Et tog som er ti minutter forsinket skal si «om 13 min», ikke «om 3 min» — ellers teller tavla ned til et tidspunkt som ikke finnes.

**Avhengighetene er primitiver.** `stopPlaceId` er en streng, så effekten kan ta den direkte. Fella fra fase 1 — der et objekt fra `onSnapshot` restartet pollingen ved hver lagring — gjelder ikke her, men mønsteret holdes likt.

## Visning

```
Avganger fra Bergen stasjon

 ┌────┐                                     ┌──────────┐
 │ L4 │  Arna               Spor 1          │ om 4 min │  10:27
 └────┘                                     └──────────┘
 ┌─────┐                                    ┌──────────┐
 │ R40 │ Myrdal             Spor 2          │ om 13 min│  10:31  10:36
 └─────┘                                    └──────────┘
 ┌────┐
 │ F4 │  Oslo S             Spor 3                        11:49
 └────┘
 ┌─────┐
 │ R40 │ Myrdal             Spor 2                        12:09
 └─────┘  ↳ Arbeid mellom Finse og Myrdal
```

Fire kolonner: **linje, destinasjon, spor, avgang.** Situasjonsteksten står som egen linje under destinasjonen, inntrukket — den er fritekst av ukjent lengde, og å presse den inn i en kolonne ville enten klippet den eller ødelagt kolonnebreddene for alle radene.

| Tilstand | Vises som |
|---|---|
| I rute, over 20 min | `10:57` |
| I rute, under 20 min | `om 4 min` + `10:27` |
| Forsinket | planlagt tid gjennomstreket, forventet tid ved siden av |
| Innstilt | `Innstilt` i chip, planlagt tid gjennomstreket |
| Rutetid (`realtime: false`) | ordet `rutetid` i liten, dempet skrift under klokkeslettet |

Merket for rutetid vil aldri vises på Bergen stasjon, der alt er sanntid. Det er med fordi modulen tar hvilket som helst stoppested, og på busstasjonen var over halvparten ren rutetabell. Å skrive «om 4 min» med samme selvsikkerhet i begge tilfeller er en liten løgn.

**Ingen avganger** — som klokka 02:00 — gir «Ingen avganger de neste 3 timene» framfor en tom tabell.

**Ikon i karusellens ikonrad:** `ClockIcon`. Ikke `TrainIcon` — modulen tar hvilket som helst stoppested, og et togikon ville løyet på en tavle pekt mot en bussterminal.

## Farger

Farge settes av **linjekategori**, som følger fargekodingen på Bane NORs skjermer ute på stasjonen. Poenget er at den reisende går fra billettkontoret til perrongen og møter samme kode.

| Kategori | Prefiks | Lyst tema | Mørkt tema |
|---|---|---|---|
| Lokaltog | `L` | mint `#1a8e60` | mintContrast `#5ac39a` |
| Regiontog | `R` | lava `#d31b1b` | lavaContrast `#ff9494` |
| Fjerntog | `F` | sky `#0082b9` | skyContrast `#64b3e7` |
| Uten L/R/F | — | `transport.standard[mode]` | `transport.contrast[mode]` |

Fallbacken er Enturs egen transportpalett, ikke noe vi finner på: tog `#00367f` blå, buss `#c5044e` rød, trikk `#78469a` lilla i lyst tema. Den trengs fordi modulen tar hvilket som helst stoppested, og bussruter heter «51» og «VY450».

> **Hvor grønn/rød/blå kommer fra.** Kategorifargene er observert på Bane NORs perrongskjermer og gjengitt her med de nærmeste tokenene i Entur-designsystemet. Hex-verdiene er altså våre, ikke Bane NORs. Den som en gang står foran en slik skjerm kan justere dem uten å lure på om tallene var hellige.

**Avvik:**

| Avvik | Lyst | Mørkt |
|---|---|---|
| Forsinket | canary `#ffca28`, mørkeblå tekst | samme |
| Innstilt | lava `#d31b1b`, hvit tekst | lavaContrast `#ff9494`, mørkeblå tekst |

**Gul kan aldri være tekst.** Kontrasten mot lavendel er 1.10. Som fylt chip med mørkeblå tekst er den 10.25.

**I lyst tema har merker og chips en 2px mørkeblå kantlinje.** Målingene under viser hvorfor: tre av fyllfargene ligger for nær lavendel i lyshet til at formen leses, selv om teksten inni er lesbar. Kantlinjen er én regel uten unntak. På mørkt tema trengs den ikke.

### Målte kontrastforhold

Fyll mot bakgrunn / tekst mot fyll:

| | Lyst (`#d9dae8`) | Mørkt (`#181c56`) |
|---|---|---|
| L | 2.98 / 4.13 | 7.25 / 7.25 |
| R | 3.84 / 5.33 | 7.40 / 7.40 |
| F | 3.09 / 4.29 | 6.83 / 6.83 |
| Forsinket-chip | 1.10 / 10.25 | 10.25 / 10.25 |
| Inaktivt ikon | 1.39 (i dag) | 15.68 |

Tallene under 4.5 for tekst gjelder **stor tekst**, som linjekoden er på en veggskjerm. Det er en forutsetning: krymper noen den boksen senere, ryker kontrasten.

## Tema på karusellen

Temaet endrer tre ting, og to av dem er eksisterende kode.

**`Carousel`** får bakgrunn og ikonfarger fra temaet i stedet for konstantene `LAVENDER` og `#ffffff`. Inaktivt ikon blir mørkeblått i lyst tema og hvitt i mørkt — dagens `#ffffff` i begge er feilen på 1.39.

**`Weather` må skrives om**, og det er mer enn en bakgrunn. Tre konkrete ting:

1. **Egen bakgrunn ut.** `Weather.jsx:85` setter `backgroundColor: semantic.fill.background.subdued.light` selv. På en mørk karusell blir været et lavendelpanel som svever på mørk bunn. Bakgrunnen hører til karusellen, ikke til modulen.
2. **«Nå»-kortet forsvinner.** Det er i dag en mørkeblå gradient (`frame.contrastalt` → `frame.contrast`) med hvit tekst — altså nesten nøyaktig fargen på den mørke karusellen. På mørkt tema må kortet i stedet skilles fra bakgrunnen med en lysere flate eller en kantlinje. Dette er den eneste delen av omskrivingen som ikke er et rent tokenbytte.
3. **Fersken-kortene** (`frame.highlightalt`) for time- og dagsradene er lyse med mørk tekst. På mørkt tema byttes de til en dempet mørk flate med lys tekst.

**Plantegningen røres ikke.** `BergenThird.jsx` og romfargene synkes ukentlig fra `entur/plantegning` av en GitHub Action, så en manuell restyling ville blitt overskrevet neste mandag. I stedet beholder plantegningen et **lyst panel rundt seg** også i mørkt tema. Romfargene er lyse pasteller som fungerer på hvitt, og panelet gjør at de fortsetter å gjøre det.

## Admin

Avgangsmodulen får et **søkefelt, ikke et id-felt**. Du skriver «Bergen stasjon», får en liste fra geocoderen, og velger. Under valget står id-en som ren tekst så den kan etterprøves, men den kan ikke skrives inn for hånd — `NSR:StopPlace:59983` er ikke noe et menneske skal taste.

```
Stoppested   [ Bergen stasjon                    ]
             ┌──────────────────────────────────┐
             │ Bergen stasjon, Bergen           │
             │ Arna stasjon, Bergen             │
             └──────────────────────────────────┘
             Valgt: Bergen stasjon (NSR:StopPlace:59983)
```

Temaet blir et valg i oppsettskjemaet, i seksjonen for karusellen, siden det er den det gjelder.

## Feilhåndtering

Følger værmodulen: `fetchDepartures` returnerer `{ departures: null }` ved nettverksfeil eller GraphQL-feil framfor å kaste, og kalleren beholder forrige liste. En tavle som viser avganger fra et minutt siden er langt bedre enn en tom tavle.

| Situasjon | Resultat |
|---|---|
| Nettverksfeil | Forrige liste blir stående |
| GraphQL-feil | Forrige liste blir stående, feilen logges |
| Ukjent stoppested | «Ingen avganger de neste 3 timene» — samme melding som under |
| Tom liste | «Ingen avganger de neste 3 timene» |
| Modul kaster | `ErrorBoundary` rundt hver modul, som i fase 1 |

De to første radene er slått sammen med vilje. `stopPlace: null` og
`estimatedCalls: []` blir begge en tom liste gjennom mappingen, og å skille dem
ville krevd et eget signal gjennom hele kjeden. Siden normaliseringen allerede
kaster id-er som ikke er stoppesteder, oppstår «gyldig id som ikke finnes» bare
ved feilskrevet oppsett — og da er meldingen uansett riktig.

## Testing

Ren logikk med `node --test`, som resten av kodebasen. Ingen komponenttester.

- **Mapping** fra GraphQL-svar til vår egen form: at `quay.publicCode` kan mangle, og at forsinkelse er en sammenlikning mellom to tidspunkter og ikke et felt.
- **Språkvalg i situasjoner.** `situations[].summary` er en liste av `{ value, language }`. Regelen er: første oppføring med språk `no`, `nb` eller `nn`; ellers første oppføring uansett språk; ellers ingen tekst. En situasjon uten norsk tekst skal vise engelsk framfor ingenting.
- **Nedtelling**: grensen på 20 minutter, regnet fra forventet tid, og at en avgang i fortiden ikke gir negative minutter.
- **Kategorifarge**: `L4` → mint, `R40` → lava, `F4` → sky, `51` → transport-mode, ukjent mode → nøytral. Begge temaer.
- **Normalisering**: ugyldig `stopPlaceId` dropper modulen, ugyldig `carouselTheme` faller til `light`.

Nettverkslaget testes med injisert `fetchImpl`, som `metForecast.test.js` allerede gjør.

## Avgrensninger

Utenfor omfanget, bevisst:

- **Flere stoppesteder per tavle.** Ett holder for billettkontoret.
- **Filter på transportmiddel.** Bergen stasjon har bare tog i praksis — målt: 13 avganger på fire timer, alle `rail`.
- **Konfigurerbart antall avganger og tidsvindu.** Fast på 6 og 3 timer. Ett valg ingen har bedt om er et felt alle må forholde seg til.
- **Bane NOR-integrasjon.** Se «Bakgrunn». Strekningsarbeid legges inn som melding.
- **Gangtid til perrongen.** Vi filtrerer ikke bort avganger man ikke rekker.
- **Restyling av plantegningen.** Den er generert kode.
