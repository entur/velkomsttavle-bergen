# Design: Lyst tema, fri ansatt-illustrasjon og komprimerte åpningstider

**Dato:** 2026-08-07
**Status:** Godkjent design, klar for implementeringsplan

## Mål

De to øverste feltene på tavla — toppfeltet med video eller logo, og det mørkeblå
midtfeltet med varsler, hilsen og åpningstider — er i dag låst til mørkeblått.
Etter dette kan tavla velge mellom to farger, og tre mindre ting løsner samtidig:

- **Farge:** mørk (dagens `#181c56` med hvit og koral logo) eller lys (lavendel
  `#aeb7e2` med farget logo og Entur-blå tekst). Ett valg som gjelder begge feltene.
- **Ansatt-illustrasjonen** blir et selvstendig valg, ikke en avkryssing inni
  hilsen-modulen. En tavle med bare åpningstider kan ha illustrasjonen; en tavle
  med hilsen kan la være.
- **Åpningstidene** komprimeres: dager med samme verdi som ligger etter hverandre
  blir én rad. «Mandag–Fredag 08:00–16:00» i stedet for fem like linjer.

## Bakgrunn / funn

- `TopBand.jsx` har én `BAND`-konstant (`40vh`, `frame.contrast`) som begge
  variantene deler, nettopp for at resten av layouten ikke skal flytte seg.
  Logo-varianten bruker `/logo.svg`, som er hvit og koral.
- `public/logo-on-light.svg` finnes allerede — mørkeblått ordmerke, lagt inn for
  admin-sidene (`Admin.jsx:19`). Det er «farget logo» i denne speccen; ingen ny
  ressurs trengs.
- Midtfeltet er en `<Contrast>` fra `@entur/layout` rett i `App.jsx:113`.
  `.eds-contrast` setter `--primary-text-color` til hvit og bakgrunnen til
  `#181c56`. Uten wrapperen faller `@entur/typography` tilbake på
  `--primary-text-color`, som ellers er `#181c56` — Entur-blå tekst på lys
  bakgrunn kommer altså av seg selv for `Heading2` og `LeadParagraph`.
- `colors.brand.lavender` = `#aeb7e2` i `@entur/tokens`. Karusellen under bruker
  en lysere lavendel, `semantic.fill.background.subdued.light` = `#d9dae8`
  (`Carousel.jsx:6`). De to skal *ikke* være like — se beslutningstabellen.
- `staffImage` ligger i dag inne i greeting-modulen
  (`boardConfig.js:72`), og illustrasjonen rendres av `Greeting.jsx`. Uten hilsen
  finnes verken modulen eller bildet.
- `Greeting.jsx` eksisterer i praksis bare for å holde bilde, overskrift og tekst
  i samme rad. Det gir omveien i `App.jsx:129`: overskriften rendres av `App` når
  det ikke er noen hilsen, og av `Greeting` når det er det.
- `formatOpeningHours` (`openingHours.js:61`) gir alltid sju rader, én per dag.
  `normalizeDays` garanterer ukerekkefølge og sju oppføringer, uansett hva som lå
  i dokumentet.
- `justifyContent: 'flex-start'` og `maxHeight: 45vh` i midtfeltet er bevisst:
  feltet klippes nedenfra slik at det alvorligste varselet overlever
  (`App.jsx:99`). Må bestå.
- Firestore-reglene validerer `top.kind` mot en liste (`firestore.rules`,
  `isValidBoard`). Nye felt hører hjemme samme sted.
- Deploy tar `hosting` og `firestore:rules` i samme kjøring ved push til `main`.
  Klient og regler lander altså samtidig.

## Beslutninger

| Spørsmål | Valg |
|---|---|
| Ett fargevalg eller ett per felt | Ett felles valg for topp og midt. Feltene ligger inntil hverandre; ulike bakgrunner der ville lest som en feil. |
| Hvilken lavendel | `colors.brand.lavender` `#aeb7e2`, ikke karusellens `#d9dae8`. De tre feltene skal fortsatt leses som tre felt. |
| Hvor illustrasjonen står uten hilsen | Til venstre for innholdet, som i dag — overskrift, hilsen og åpningstider i kolonnen til høyre. |
| Komprimering av åpningstider | Alle sammenhengende dager med samme verdi slås sammen. Ingen egen mandag–fredag-regel. |

## Configmodellen

To nye felt på toppnivå i tavle-dokumentet:

```js
{
  theme: 'dark' | 'light',   // ny — standard 'dark'
  staffImage: true | false,  // ny — flyttet ut av greeting-modulen
  top: { kind: 'video' | 'logo' },
  middle: [...],
  carousel: [...],
}
```

`theme` ligger ikke under `top`, fordi den styrer både toppfeltet og midtfeltet.
`staffImage` ligger på toppnivå og ikke som en modul i `middle`, fordi
illustrasjonen ikke er en rad i stabelen — den står ved siden av hele innholdet,
og modul-listen er definert som «rekkefølgen på skjermen».

### Migrering

`normalizeBoardConfig` leser `staffImage` slik:

1. `source.staffImage` når den er en `boolean`,
2. ellers `false` hvis `middle` har en greeting-modul med `staffImage === false`,
3. ellers `true`.

Greeting-normalisereren slutter å ta vare på feltet, og `toFirestoreBoard` skriver
begge de nye feltene. Ingen dokumenter må skrives om på forhånd: de får riktig
verdi ved første lesing, og ryddes ved første lagring fra admin. `theme` mangler i
alle eksisterende dokumenter og faller på standarden `'dark'`, som er nøyaktig
slik tavlene ser ut i dag.

## Tema

Nytt `src/boards/boardTheme.js` — uten Firebase-importer og uten JSX, slik at det
kan testes med `node --test`, på linje med resten av `src/boards/`.

```js
export const THEMES = ['dark', 'light'];
export function bandTheme(theme) // → { background, color, logoSrc, contrast }
```

| | `dark` | `light` |
|---|---|---|
| `background` | `#181c56` (`base.light.baseColors.frame.contrast`) | `#aeb7e2` (`colors.brand.lavender`) |
| `color` | `#ffffff` | `#181c56` (`colors.brand.blue`) |
| `logoSrc` | `/logo.svg` | `/logo-on-light.svg` |
| `contrast` | `true` | `false` |

`contrast` avgjør om midtfeltet pakkes i `<Contrast>`. I det lyse temaet droppes
wrapperen helt, og `color` settes eksplisitt på feltet — typografi-komponentene
finner Entur-blå selv, men de vanlige `<span>`-ene i åpningstidene arver den fra
feltet.

`TopBand` henter bakgrunn og logo-fil fra samme tabell. Video-varianten er ellers
uendret: bakgrunnen bak videoen vises bare hvis videoen ikke kan spilles av, men
den følger temaet, slik at fallbacket ikke blir mørkeblått på en lys tavle.

## Midtfeltet

Nytt `src/components/MiddleBand.jsx` eier feltet:

```
┌─ MiddleBand (bakgrunn + tema) ─────────────────┐
│  AlertBanner (full bredde)                     │
│  ┌──────────┬───────────────────────────────┐  │
│  │ ansatt-  │ Heading2: Velkommen til …     │  │
│  │ illustr. │ LeadParagraph: hilsen         │  │
│  │          │ OpeningHours                  │  │
│  └──────────┴───────────────────────────────┘  │
└────────────────────────────────────────────────┘
```

Illustrasjonen rendres når `config.staffImage` er sann, uavhengig av hva som
ligger i `middle`. Er `middle` tom, står overskriften alene i kolonnen — med eller
uten illustrasjon ved siden av.

`App.jsx` blir sittende igjen med datakoblingen: abonnementet på tavla,
værpollingen, den 15-minutters hilsen- og illustrasjonsrotasjonen, og
karusell-slidene. Værpollingens plassering i `App` og kommentaren om hvorfor den
må ligge der er uendret.

`Greeting.jsx` slettes. Når kolonnen alltid finnes, rendres overskriften ubetinget
av `MiddleBand`, og hilsenen er én `LeadParagraph`. Det fjerner samtidig
`!hasGreeting &&`-omveien i `App`. Ingen andre filer bruker komponenten.

`maxHeight: 45vh`, `overflow: hidden` og `justifyContent: 'flex-start'` flyttes med
uendret, kommentaren om klipping nedenfra likeså.

## Åpningstider

`formatOpeningHours` slår sammen sammenhengende dager med samme verdi:

```
Mandag–Fredag   08:00–16:00
Lørdag–Søndag   Stengt
```

Én regel, ingen spesialtilfeller. En avvikende fredag gir «Mandag–Torsdag» +
«Fredag» av seg selv; sju like dager gir én rad «Mandag–Søndag». Sammenslåingen
forutsetter ukerekkefølge, som `normalizeDays` allerede garanterer — det skrives
som en kommentar der, siden en fremtidig endring av rekkefølgen ville gitt stille
feil grupper.

Radene får `key` fra første dag i gruppa i stedet for `day`, og `label` blir enten
`Mandag` eller `Mandag–Fredag` (tankestrek, som verdiene). `OpeningHours.jsx`
oppdateres til den nye radformen.

Admin-skjemaet redigerer fortsatt sju dager hver for seg, og bruker `DAY_LABELS`
direkte. Komprimeringen er ren visning og rører ikke det som lagres.

## Admin

- Ny seksjon **Farger** med radioknapper «Mørk blå» og «Lys lavendel», og en linje
  om at logoen bytter med valget.
- «Vis ansatt-illustrasjon» flyttes ut av hilsen-blokka og opp i **Midtfeltet**,
  over avkryssingene for hilsen og åpningstider, slik at plasseringen viser at den
  er uavhengig av begge.
- `draftFrom` og `configFrom` får `theme` og `staffImage` på toppnivå.
- Ingen ny validering i `boardValidation`: begge feltene er lukkede valg fra
  skjemaet og kan ikke få en ugyldig verdi der.

## Firestore-regler

`isValidBoard` utvides:

```
&& d.theme in ['dark', 'light']
&& d.staffImage is bool
```

Kravene gjelder skrivinger, ikke lesinger, så eksisterende dokumenter berøres
først ved lagring. Klient og regler deployes i samme kjøring, så det finnes ikke
et vindu der en gammel klient skriver uten feltene.

## Testing

`node --test` (enhet):

- `openingHours.test.mjs`: mandag–fredag like, helg stengt, sju like dager, ett
  avvik midt i uka, og en enkeltdag som ikke slås sammen med naboen.
- `boardConfig.test.mjs`: standard `theme` når feltet mangler, ugyldig `theme`
  faller på `'dark'`, `staffImage` fra toppnivå, fra en gammel greeting-modul, og
  standarden `true` når ingen av delene finnes.
- `boardTheme.test.mjs` (ny): begge temaene gir riktig bakgrunn, tekstfarge og
  logo-fil, og en ukjent verdi gir det mørke temaet.

`npm run test:rules` (emulator): tavle-fixturen får de nye feltene, og en tavle
med ugyldig `theme` eller `staffImage` av feil type avvises.

`npm run build` kjøres før PR.

Visuell kontroll i `npm run dev` av begge temaene, med og uten illustrasjon, med
og uten hilsen, og med et varsel oppe — det siste fordi `BannerAlertBox` har egne
farger og skal sjekkes mot lavendel.

## Utenfor omfanget

- Karusellen tegner inaktive ikoner i hvitt på lavendel `#d9dae8`
  (`Carousel.jsx:56`). Kontrasten er svak allerede i dag, og blir mer synlig når
  hele tavla kan være lys. Ikke rørt her; egen sak hvis det skal fikses.
- Flere farger enn de to. Valget er en lukket liste med to verdier, ikke en
  fargevelger.
- Egne farger per modul eller per karusell-slide.
