# Design: Parameteriserte tavler med eierskap og tilgang

**Dato:** 2026-08-06
**Status:** Godkjent design, klar for implementeringsplan (fase 1)

## Mål

Gjøre velkomsttavla til noe det kan finnes flere av. I dag er det én tavle, og
alt den viser er hardkodet i `src/App.jsx`. Etter dette er innholdet beskrevet av
en config i Firestore: hva som ligger på toppen (video eller logo), hva som ligger
i det mørkeblå midtfeltet (hilsen, åpningstider), og hvilke moduler som går på
omgang i karusellen (vær med eget sted, plantegning, avgangstider).

En tavle eies av den som opprettet den. Eieren kan gi andre tilgang, og alle med
tilgang kan gjøre alt på tavla — endre oppsettet, publisere meldinger og invitere
flere. Én melding kan publiseres på flere tavler samtidig.

Den konkrete driveren er en ny tavle i **billettkontoret** i Bergen. Den
administreres av Entur, men leses av kunder, og skal vise avgangstider for et
stoppested, værmelding og åpningstider.

## Bakgrunn / funn

- `src/App.jsx` er en flex-kolonne med tre felt: `LoopingVideo` (40vh) →
  `Contrast`-seksjon (varsler + hilsen + ansatt-illustrasjon, maks 45vh) →
  `Carousel` (`flex: 1`). Alle tre er hardkodet, inkludert teksten «Velkommen til
  Entur Bergen» og `LOCATION`-konstanten for Bergen.
- `Carousel` tar allerede en `slides`-liste og er dermed nesten klar for config —
  men den krasjer på tom liste (`slides[index].node`, `Carousel.jsx:54`).
- Værpollingen ligger i `App`, ikke i `Weather`, fordi karusellen bare rendrer den
  aktive sliden og dermed avmonterer `Weather` omtrent hvert minutt
  (`App.jsx:37`). Den plasseringen må bestå.
- `justifyContent: 'flex-start'` i midtfeltet er bevisst: feltet har
  `maxHeight` + `overflow: hidden`, og med `center` ville det alvorligste varselet
  vært det første som klippes bort (`App.jsx:89`). Må bestå.
- Firestore har i dag to collections: `alerts` (offentlig lesbar, skrives av
  admins) og `admins` (allowlist, ett dokument per person, dokument-id er
  e-postadressen i små bokstaver). Reglene i `firestore.rules` har ingen
  automatiske tester; README slår fast at de bør få det hvis systemet vokser.
- `main.jsx` gjør én `pathname.startsWith('/admin')`-sjekk og laster `Admin` lazy,
  med vilje: kiosken skal ikke laste firebase/auth, skjemakomponenter eller
  datovelger den aldri bruker.
- Plantegningen synkes ukentlig av `scripts/sync-floorplan.mjs`, som er hardkodet
  mot **én** fil i `entur/plantegning` (`BergenThird.tsx` + `bergen-3.json`).
  Det finnes altså bare én plantegning i repoet.
- `public/entur.mp4` er den eneste videoen, og ligger same-origin med vilje for å
  unngå svart skjerm ved looping (se `2026-08-03-video-egress-design.md`).
- Deploy skjer automatisk ved push til `main` og tar `hosting` og
  `firestore:rules` i samme kjøring. Appen og reglene lander altså samtidig.

## Beslutninger

Disse ble avklart i brainstormingen og er premisser for resten:

| Spørsmål | Valg |
|---|---|
| Omfang | Entur-internt, 5–20 tavler. Ikke flerleietaker. |
| Hvordan skjermen vet hvem den er | URL-sti: `/t/<boardId>` |
| Roller | Ingen. Tilgang er tilgang til alt på tavla, inkludert å invitere flere. |
| Forlatt tavle | Ordnes i Firebase-konsollet. Ingen eierskapsoverføring i appen. |
| Melding på flere tavler | Én melding med en liste over tavler, ikke én kopi per tavle. |
| Hvem kan opprette tavler | Enhver `@entur.org`-konto. |
| Åpningstider | Strukturert ukeskjema, ikke fritekst. Ingen «åpent nå»-logikk. |

## Datamodell

Tre collections. Alle er **offentlig lesbare**, fordi kiosken ikke har pålogging
og må hente både oppsett og meldinger uautentisert.

```
boards/{boardId}                 boardId er en slug: "bergen-3"
  name          "Bergen 3. etasje"          vises i admin
  placeName     "Bergen"                    gir «Velkommen til Entur Bergen»
  top           { kind: 'video' | 'logo' }
  middle        [ blokker, se modulkatalogen ]
  carousel      [ moduler, se modulkatalogen ]
  createdBy, createdAt, updatedBy, updatedAt

memberships/{e-post}             dokument-id er e-post i små bokstaver
  boards        ['bergen-3', 'billettkontor-bergen']

alerts/{alertId}
  boardIds      ['bergen-3', ...]           ← nytt felt
  title, body, level, startsAt, endsAt, enabled
  createdBy, createdAt, updatedBy, updatedAt
```

`memberships` er fasit for tilgang — ikke en medlemsliste på tavle-dokumentet.
Grunnen er at én melding kan gjelde flere tavler: regelen må da avgjøre om *alle*
tavlene i meldinga er dine. Med tilgang lagret per bruker er det ett oppslag og
en listesammenlikning. Med en medlemsliste per tavle ville det krevd én sjekk per
element i lista, og Firestore-regler kan ikke iterere over en liste. Admin-siden
finner hvem som har tilgang til en tavle ved å spørre `memberships` med
`array-contains`.

`boardId` er URL-en skjermen peker på og kan ikke endres etter oppretting.

## Modulkatalog

Hver modul er et objekt med `type` (eller `kind` for topp-feltet) og sine egne
parametre.

**Topp** (`top`, nøyaktig én):

| kind | Parametre | Merknad |
|---|---|---|
| `video` | ingen | `public/entur.mp4`. Opplasting av egen video er ikke med. |
| `logo` | ingen | Entur-logo på mørkeblå bakgrunn. |

**Midt** (`middle`, liste, kan være tom):

| type | Parametre |
|---|---|
| `greeting` | `text`: `'auto'` (dagens tidsstyrte hilsen) eller en fast tekst · `staffImage`: `true`/`false` |
| `openingHours` | sju dager, hver med `opens`/`closes` eller `closed: true` |

**Karusell** (`carousel`, liste, kan være tom):

| type | Parametre |
|---|---|
| `weather` | `name`, `lat`, `lng` |
| `floorplan` | `plan` — eneste lovlige verdi i dag er `'bergen-3'` |
| `departures` | `stopPlaceId`, `count`, `modes` — **fase 3** |

Regler for katalogen:

- **Varslene er ikke en modul.** De ligger alltid øverst i midtfeltet og kan ikke
  skrus av. De er hele poenget med å eie en tavle.
- **Maks én modul av hver type per tavle.** Det sparer oss for to værsteder med
  hver sin polling, og ingen har bedt om det.
- **Rekkefølgen innad i hvert felt er fast**, gitt av katalogen. Å kunne dra
  moduler rundt kan legges til senere; med to–tre moduler i karusellen er det
  ikke verdt noe nå.
- **Ukjente modultyper hoppes over.** En kiosk som ikke er lastet på nytt skal
  ikke svartne av at noen la til en modultype den ikke kjenner.

Overskriften «Velkommen til Entur `<placeName>`» vises alltid i midtfeltet, uansett
moduler.

## Kiosken

### Ruter

`main.jsx` trenger fire former i stedet for én. Parsingen legges i en egen
`parseRoute`-modul med tester, ikke som flere ad hoc-sjekker.

| Rute | Hva |
|---|---|
| `/t/<id>` | tavla |
| `/admin` | dine tavler |
| `/admin/t/<id>` | oppsett, tilgang og meldinger for én tavle |
| `/` | redirect til `bergen-3` |

Ingen router-avhengighet. Begrunnelsen i `main.jsx:6` står ved lag: kiosken skal
ikke laste noe den ikke bruker, og fire statiske former er to regexer.

Redirecten på `/` er migreringen: skjermen i Bergen peker på `/` i dag og skal
fortsette å virke uten at noen rører kiosk-oppsettet. Default-id-en er en
konstant i koden, ikke i Firestore, og skal kunne fjernes når skjermen er lagt om.

### Rendering

`App` blir en renderer over configen. Konkret for koden som finnes:

- `LOCATION`-konstanten (`App.jsx:15`) forsvinner. Værpollingen startes bare hvis
  tavla har en `weather`-modul, og bruker koordinatene derfra. Den blir liggende i
  `App` av grunnen i `App.jsx:37`.
- `getGreetingText` blir liggende, men brukes bare når `text: 'auto'`.
- `Carousel` må tåle tom liste: velger du bare video og hilsen, faller
  karusell-feltet bort og midtfeltet får plassen.

Configen abonneres på med `onSnapshot`, samme mønster som varslene. Endrer du
oppsettet i admin, endrer skjermen seg innen sekunder. Tavla laster seg fortsatt
aldri på nytt av seg selv.

### Feiltilstander

Tre tilfeller, alle med noe forståelig på skjermen framfor blank side:

- Tavla finnes ikke → «Fant ingen tavle med id-en `<id>`».
- Ukjent modultype → hopp over den, render resten.
- En modul kaster → `ErrorBoundary` rundt **hver enkelt modul**, ikke bare rundt
  varslene som i dag. En knekt værmodul skal ikke ta ned plantegninga.

## Admin

`/admin` beholder Google-innlogging og `@entur.org`-kravet, men **allowlisten
`admins` forsvinner**: enhver Entur-konto kommer inn og ser sine egne tavler. Er
lista tom, møter du en tom-tilstand med «Ny tavle» framfor «Ingen tilgang».

**Ny tavle** spør om navn og stedsnavn og foreslår en id ut fra navnet
(`Bergen 3. etasje` → `bergen-3`), som kan overstyres. Skjemaet sier fra om at
id-en er URL-en skjermen skal peke på og ikke kan endres etterpå. En ny tavle
starter med dagens Bergen-oppsett som utgangspunkt: video, automatisk hilsen med
illustrasjon, vær.

`/admin/t/<id>` har tre deler:

- **Oppsett** — ett skjema per felt. Topp er video eller logo. Midt og karusell er
  avkryssing per modul; huker du av en modul, folder parametrene seg ut under den.
- **Tilgang** — hvem som har tilgang, legg til på e-post, fjern. To vakter: advarsel
  hvis du fjerner deg selv, og den siste kan ikke fjernes. En tavle uten noen med
  tilgang må ordnes i konsollet, og det skal ikke skje ved et uhell.
- **Meldinger** — `AlertList` og `AlertForm` som i dag, filtrert på denne tavla.
  Skjemaet får avkryssing av tavler, forhåndsutfylt med den du står i, og **bare
  tavlene du har tilgang til** i lista — du skal ikke kunne hake av noe som gir
  feil ved lagring. Redigerer du en melding som også står på andre tavler, sier
  skjemaet det med rene ord før du lagrer.

**Å slette en tavle rører ikke meldingene.** En melding som peker på en slettet
tavle blir liggende med en id ingen renderer, og vises fortsatt på de andre
tavlene sine. Alternativet er å rydde i meldinger du kanskje ikke har tilgang til
å endre, og det er verre.

Advarselen om at innholdet er offentlig (`Admin.jsx:123`) blir stående, og gjelder
nå oppsettet også: stoppested, koordinater og åpningstider er like lesbare som
meldingene.

## Firestore-regler

Tilgangssjekken er ett oppslag, gjenbrukt overalt:

```
myBoards() = memberships/<din e-post>.boards     tom liste om dokumentet mangler
```

| Collection | Les | Skriv |
|---|---|---|
| `boards/{id}` | alle | `id` i `myBoards()`. Oppretting: enhver Entur-konto, `createdBy` må være deg. |
| `memberships/{e-post}` | egen oppføring, eller oppføringer som deler en tavle med deg | endringer må ligge innenfor `myBoards()` |
| `alerts/{id}` | alle | `boardIds` må ligge innenfor `myBoards()` — **både før og etter** endringen |

Fire ting som må være riktige:

**Å gi og fjerne tilgang uttrykkes uten løkker.** Både det som legges til og det
som fjernes må være tavler du selv har. Det følger av `hasOnly` og `concat` på
vanlige lister — ingen Cloud Function, ingen `Set`-operasjoner:

```
request.resource.data.boards.hasOnly(resource.data.boards.concat(myBoards()))
&& resource.data.boards.hasOnly(request.resource.data.boards.concat(myBoards()))
```

**«Både før og etter» på meldinger er ikke overflødig.** Sjekkes bare den nye
lista, kan jeg ta en melding som står på din tavle og min, fjerne din fra lista og
skrive om teksten — altså avpublisere fra en tavle jeg ikke har tilgang til.

**Den første tavla er et bootstrap-hull.** Du oppretter `boards/min-tavle`, men
`myBoards()` er tom, så du får ikke lagt den inn i din egen oppføring, og sitter
med en tavle du ikke kan redigere. Løsningen: klienten oppgir hvilken id den gjør
krav på i et eget felt på sin egen `memberships`-oppføring, og regelen slår opp at
`createdBy` på den tavla er deg. Ett oppslag, id-en er lesbar for regelen, og du
kan bare gjøre krav på noe du selv har laget.

**Meldinger må ha minst én tavle.** `boardIds.size() > 0`, med et øvre tak.

Ingen sammensatte indekser blir nødvendige: både `boardIds` og `boards` spørres
med `array-contains` alene, og `enabled` filtreres i klienten slik tidsvinduet
allerede gjør. Deploy-steget kan stå som det er.

## Migrering

Rekkefølgen er det som kan velte skjermen i resepsjonen. Reglene og appen deployes
i samme kjøring ved push til `main`, så alt Firestore-arbeid må gjøres **før**
merge. Konsollet går utenom reglene, så stegene virker mens de gamle reglene
fortsatt er ute. Migreringen skjer i to omganger, én per fase:

**Før merge av fase 1:**

1. Opprett `boards/bergen-3` med dagens oppsett — video, automatisk hilsen med
   illustrasjon, vær for Bergen (60.39299, 5.32415), plantegning `bergen-3`.
2. Merge. `/` redirecter til `/t/bergen-3`, og skjermen står uendret på veggen.

**Før merge av fase 2:**

3. Sett `boardIds: ['bergen-3']` på meldingene som finnes. Uten dette forsvinner
   de fra tavla i det øyeblikket fase 2 er ute, siden den filtrerer på tavle.
4. Legg dagens `admins`-oppføringer inn som `memberships` med `boards: ['bergen-3']`.
   Uten dette mister de som har tilgang i dag den.
5. Merge.
6. Slett `admins`.

Volumet er noen få dokumenter. Et migreringsskript ville vært mer maskineri enn
arbeidet det gjør.

Tavla og plantegningen deler id-en `bergen-3`. Det er to uavhengige navnerom —
`boards/bergen-3` og `plan: 'bergen-3'` — og sammenfallet er tilfeldig, ikke en
kobling koden skal lene seg på.

## Faser

Hele designet i én plan blir uoverkommelig. Fase 1 gir verdi alene.

| Fase | Innhold | Tilstand etterpå |
|---|---|---|
| **1** | `boards`-collection, kiosken rendrer fra config, `/t/<id>`, modulkatalogen inkl. `logo` og `openingHours`, oppsettskjema i admin, migrering av Bergen-tavla | Tavla er parameterisert. Tilgang er fortsatt `admins`-allowlisten, meldinger er fortsatt globale — det holder så lenge det er én tavle. |
| **2** | `memberships`, `boardIds` på meldinger, nye regler med regeltester, tavleoversikt og tilgangsside i admin, `admins` fjernes | Flere tavler, eierskap og deling. Billettkontor-tavla kan settes opp. |
| **3** | `departures`-modulen mot Entur-APIene | Avgangstider med avviksinfo. |

Fase 1 innfører `/t/<id>` selv om det bare finnes én tavle. Det er med vilje —
alternativet er å legge om URL-ene i fase 2 og gjøre migreringen to ganger.

I fase 1 skrives `boards`-dokumentet av dem som står i `admins`; regelen byttes ut
med medlemskapssjekken i fase 2.

## Testing

Følger mønsteret som allerede er der: Nodes innebygde test-runner over logikken
som kan gå galt, ikke komponenttester.

Nytt som fortjener tester:

- `parseRoute` — de fire ruteformene, og det som ikke er noen av dem.
- Normalisering av en config — at ukjente modultyper faller bort, at manglende
  felt får forsvarlige verdier, at tomme lister er lovlige.
- Formatering av åpningstider.

I fase 2 kommer regeltester med `@firebase/rules-unit-testing` på toppen. Det er
begrunnelsen README allerede peker på: modellen går fra én allowlist til
eierskap, deling og et bootstrap-hull. Tilfellene som må dekkes er grensen mellom
tavler, «før og etter»-sjekken på meldinger, og at ingen kan gi seg selv tilgang.

Rules-syntaksen (`hasOnly`/`concat` på lister, oppslaget mot `memberships`)
verifiseres mot emulatoren før den skrives inn i planen — ikke ut fra hukommelse.

## Avgrensninger

Utenfor omfanget, bevisst:

- **Flere plantegninger.** `sync-floorplan.mjs` er hardkodet mot én fil i
  `entur/plantegning`. `plan`-parameteren har én lovlig verdi. Å gjøre synken
  flerplans er en egen jobb; modellen står klar.
- **Egen video per tavle.** Opplasting og lagring av video er ikke med.
  `top: video` betyr `public/entur.mp4`.
- **Roller og rettighetsnivåer.** Tilgang er tilgang.
- **Eierskapsoverføring i appen.** Ordnes i konsollet.
- **Omrokkering av moduler.** Fast rekkefølge per felt.
- **«Åpent nå»-logikk.** Åpningstidene vises som de er lagt inn.
- **Forhåndsvisning i admin.** Du ser resultatet ved å åpne `/t/<id>`.
