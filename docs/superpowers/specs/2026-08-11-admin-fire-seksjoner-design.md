# Admin-skjemaet delt i fire seksjoner

Dato: 2026-08-11

## Målet

Oppsettskjemaet i admin skal speile de fire feltene på tavla, ett for ett, med
en tydelig visuell oppdeling og én fargevelger per felt:

1. **Branding** — intro-video eller Entur-logo
2. **Velkomstmelding** — stedsnavn, illustrasjon, hilsen, åpningstider
3. **Karusellen** — ett kort per modul, som legges til og fjernes
4. **Bunnstripa** — én nedtrekksmeny for modulen som står der permanent

Alle fire fargevelgerne er samme komponent, og viser både navnet på fargen og
fargen selv. Valget avgjør samtidig om feltet blir lyst eller mørkt.

I dag deler toppen og midten én `theme` med to verdier, mens karusellen og
bunnstripa har hver sin flate fra en palett med seks. Skjemaet har tre
seksjoner uten ramme, og feltene «Navn» og «Stedsnavn» står løst over dem.

## Datamodell

`theme` erstattes av `topSurface` og `middleSurface`, slik at alle fire feltene
har samme form: ett flatenavn fra `SURFACES` i `src/boards/surfaces.js`.

```
topSurface, middleSurface, carouselSurface, bottomSurface
```

### Migreringen er fargeriktig, ikke omtrentlig

De to gamle temaene *er* to av de seks flatene — samme token, ikke en
tilnærming:

| `theme` | flate | bakgrunn |
|---|---|---|
| `dark` | `morkebla` | `base.light.baseColors.frame.contrast` |
| `light` | `lavendel` | `colors.brand.lavender` |

Tekstfargene stemmer på samme vis: mørk gir `colors.brand.white`, lys gir
`colors.brand.blue`, som er nøyaktig hva `surfacePalette` returnerer for de to
flatene. Eksisterende tavler ser derfor helt identiske ut etter oppgraderingen.

`normalizeBoardConfig` får de to nye feltene etter mønsteret
`carouselSurfaceFrom` allerede bruker: nytt felt først, `theme` som fallback,
ellers standarden.

```js
const THEME_TO_SURFACE = { dark: 'morkebla', light: 'lavendel' };
```

Standarden for begge er `morkebla`, siden `DEFAULT_THEME` er `dark` i dag. En
tavle uten noe valg ser da ut som nå.

`normalizeBoardConfig` slutter å eksponere `theme` i det normaliserte objektet,
og `toFirestoreBoard` slutter å skrive det — igjen samme mønster som
`carouselTheme`, som `boardConfig.test.mjs` alt har en test for. `THEMES` og
`DEFAULT_THEME` i `boardConfig.js` blir ubrukte og fjernes, sammen med
kommentaren som peker på `boardTheme.js`.

To andre steder skriver `theme` i dag og må skrive de to nye feltene i stedet:

- `NewBoardForm.jsx` (linje 16), som setter `theme: 'dark'` på en ny tavle.
  Den får `topSurface: 'morkebla'` og `middleSurface: 'morkebla'`, slik at en
  ny tavle ser ut som en ny tavle gjør nå. Formen skal *ikke* ha
  fargevelgere — farger settes i oppsettskjemaet etter opprettelsen, som i dag.
- `BoardConfigForm.jsx`, gjennom `draftFrom`/`configFrom` som flyttes til
  `boardDraft.js`.

### Gamle felt får ligge

`saveBoardConfig` bruker `merge: true`, så `theme` blir stående i gamle
dokumenter. Det er ufarlig: så snart `topSurface` finnes, vinner det. Dette er
samme valg som ble tatt for `carouselTheme`, som fortsatt ligger i gamle
dokumenter og fortsatt tolereres i reglene.

### `boardTheme.js` krymper

`bandTheme()` gir i dag `background`, `color`, `contrast` og `logoSrc`. De tre
første kommer nå fra `surfacePalette()`, som allerede har `mode`. Igjen står
bare logovalget, så fila reduseres til én eksport:

```js
export function logoSrcFor(mode) // 'dark' → '/logo.svg', ellers '/logo-on-light.svg'
```

`TopBand` og `MiddleBand` tar `palette` inn i stedet for `theme`, slik
`Weather`, `Departures` og `OfficeMap` allerede gjør. `MiddleBand` beslutter
`<Contrast>`-wrapperen på `palette.mode === 'dark'` i stedet for på
`bandTheme(theme).contrast`.

### `firestore.rules`

Tre endringer i `isValidBoard`:

1. `theme` blir valgfritt. I dag krever linje 55 det, og en *ny* tavle skrives
   uten det — `createBoard` bruker `setDoc` uten merge, så det ville gitt
   permission-denied.
2. `topSurface` og `middleSurface` valideres, valgfritt, som de to andre.
3. Flatelista trekkes ut i en regel-funksjon, slik at den ikke gjentas fire
   ganger:

```
function isSurface(v) {
  return v in ['morkebla', 'morkebla-lys', 'lavendel', 'lys-lavendel', 'hvit', 'fersken'];
}
```

Kommentaren over lista må rettes: etter dette står lista to steder,
`src/boards/surfaces.js` og denne funksjonen — ikke tre.

## Skjemastruktur

### Filene

Flatt i `src/admin/`, som resten av admin-koden.

| Fil | Ansvar |
|---|---|
| `BoardConfigForm.jsx` | draft-state, validering, lagring. Rammen |
| `FormSection.jsx` | den visuelle seksjonen: overskrift, hjelpetekst, innrammet boks |
| `SurfacePicker.jsx` | de seks fargeprøvene. Brukt fire ganger |
| `BrandingSection.jsx` | video/logo + farge |
| `WelcomeSection.jsx` | stedsnavn, illustrasjon, hilsen, åpningstider + farge |
| `CarouselSection.jsx` | kortene, «Legg til»-raden + farge |
| `ModuleCard.jsx` | rammen rundt ett kort: tittel, Fjern-knapp, innhold |
| `BottomSection.jsx` | modulvalg + modulens innstillinger + farge |
| `src/boards/boardDraft.js` | `draftFrom`, `configFrom` og kortoperasjonene |

`draftFrom` og `configFrom` flyttes ut av `.jsx`-fila fordi de er ren
datalogikk uten JSX, og i dag er helt utestet — `node --test` kan ikke laste en
`.jsx`. Nå som kortoperasjonene skal bo samme sted, er de verdt tester.

Ingen av filene skal over rundt 120 linjer.

### «Navn» og «Stedsnavn»

`name` blir stående øverst som skjemaets tittelfelt; det er en admin-etikett og
vises ikke på skjermen. `placeName` flyttes inn i velkomstseksjonen, rett over
hilsen — der overskriften den lager faktisk står.

### Fargeprøvene

Seks kort på rad. Hvert kort har flatens bakgrunn som bakgrunn, og navnet
skrevet på i flatens *egen* tekstfarge. Kortet viser da alle tre tingene i én
figur: navn, farge, og at valget avgjør lys eller mørk modus — «Mørk blå» står
hvitt, «Fersken» står blått.

Under hvert kort ligger en visuelt skjult radio-input, og fokusringen flyttes
til kortet med `:focus-within` i `admin.css` — samme mønster som
`LevelPicker.jsx` bruker for varselnivåene. Den hvite flaten får en tynn
kantlinje uansett, ellers forsvinner kortet i admin-sidens hvite bakgrunn.

### Karusellkortene

Ett kort per aktiv modul, i katalogens rekkefølge (`CAROUSEL_TYPES`: vær,
plantegning, avganger). Rekkefølgen på skjermen kan ikke endres — den står fast
i katalogen, og `normalizeModules` ignorerer rekkefølgen i dokumentet. Med tre
moduler i katalogen er rekkefølge-styring ikke verdt inngrepet i kioskens vern.

Hvert kort har tittel, «Fjern»-knapp og sine egne felt:

- **Været**: sted, breddegrad, lengdegrad
- **Plantegning**: setningen om at Bergen 3. etasje er den eneste som finnes
- **Avgangstider**: `StopPlaceField`

Under kortene en «Legg til»-rad med én knapp per modul som ikke er lagt til
(«+ Været», «+ Plantegning», «+ Avgangstider»). Ett klikk i stedet for tre, og
raden tømmer seg selv etter hvert. Er karusellen tom, står det at karusellen
ikke vises på skjermen — som er sant, `hasCarousel` i `App.jsx` styrer det.

### Bunnstripa

Én nedtrekksmeny, `Ingen` / `Været`, som et vanlig `<select>` med
Entur-etikett over. Designsystemet har ingen dropdown-komponent, og å
håndskrive en listboks for to valg er ikke verdt det. Velges Været, kommer
stedsnavn og koordinater rett under, i samme seksjon.

### Konfliktregelen koster ingenting

Draften beholder dagens `weatherPlacement` med tre verdier (`av`, `karusell`,
`stripe`), og kortene *utledes* av den. «Været» i bunnstripa betyr `'stripe'`,
og da finnes vær-kortet i karusellen rett og slett ikke. Regelen «været bor ett
sted» håndheves altså ikke — den er en tilstand som ikke kan oppstå.

Det bevarer grunnen regelen finnes for: `App.jsx` skal starte høyst én polling
mot api.met.no, slik MET sine vilkår ber om.

Datamodellen i draften er derfor uendret. `boardDraft.js` får rene funksjoner
rundt den:

```js
carouselCards(draft)            // aktive moduler, i katalogens rekkefølge
availableCarouselTypes(draft)   // typene «Legg til»-raden skal tilby
addCarouselModule(draft, type)
removeCarouselModule(draft, type)
setBottomModule(draft, type)    // type = null for «Ingen»
```

`setBottomModule(draft, 'weather')` setter `weatherPlacement` til `'stripe'`;
`null` setter den til `'av'`. `addCarouselModule(draft, 'weather')` setter den
til `'karusell'`.

## Dataflyt

`BoardConfigForm` eier draften og gir hver seksjon `draft`, `errors` og de
handlerne den trenger: `update(felt, verdi)` for feltene, `updateDay` til
åpningstidene, `onAdd`/`onRemove` til karusellen, `onModuleChange` til
bunnstripa. Seksjonene leser bare sine egne felt og har ingen egen state.

Kortoperasjonene er rene funksjoner, så `BoardConfigForm` sender bare
resultatet inn i `setDraft`.

## Feilhåndtering

`boardValidation.js` endres minimalt: sjekken som i dag står to ganger for
`carouselSurface` og `bottomSurface` blir en løkke over alle fire feltnavnene.
Feilnøklene beholder navnet sitt.

Hver seksjon rendrer sine egne feil — flatefeil under fargeprøvene, værfeil
inne i vær-kortet, åpningstidsfeil under dagsradene. Flatefeilene er i praksis
uoppnåelige gjennom skjemaet, siden velgeren bare tilbyr gyldige verdier; de
står der som speiling av reglene, slik de gjør i dag.

Lagre-knappen og meldingene om lagret/feilet blir stående nederst, utenfor
seksjonene. Lagringen selv er uendret.

## Testing

Alt med `node --test`, slik repoet gjør det.

**`boardDraft.test.mjs` (ny)**

- rundtur draft → config → draft for en tavle med alle moduler
- vær i hver av de tre plasseringene
- legg til og fjern karusellmodul
- `setBottomModule(draft, 'weather')` fjerner vær-kortet fra karusellen
- `setBottomModule(draft, null)` gjør «Været» tilgjengelig i karusellen igjen

**`boardConfig.test.mjs` (utvides)**

- `theme: 'dark'` gir `topSurface`/`middleSurface` = `morkebla`
- `theme: 'light'` gir `lavendel`
- eksplisitt `topSurface` vinner over `theme`
- tullverdi i `topSurface` faller til standarden
- `toFirestoreBoard` skriver alle fire flatene, og skriver ikke `theme`
- `normalizeBoardConfig` eksponerer ikke `theme`

De eksisterende testene på `.theme` (linje 98–105 og 234) erstattes av disse;
de tester et felt som ikke finnes lenger.

**`boardValidation.test.mjs` (utvides)**: alle fire flatefeltene.

**`boardTheme.test.mjs`**: krymper til `logoSrcFor`.

**`firestore.rules.spec.mjs`** mot emulatoren, ikke ved øyemål:

- gyldig `topSurface` slipper gjennom
- ugyldig `topSurface` avvises
- ny tavle uten `theme` slipper gjennom

**Uendret, men må fortsatt passere**: `surfaces.test.mjs` (kontrastmålingen
dekker alle seks flatene alt) og `browserBaseline.test.mjs` — den siste er
grunnen til å holde seg unna `Object.hasOwn` og nyere syntaks i den nye koden.

### Praktisk

`node_modules` er tom i worktreen, så `yarn install --ignore-engines` er første
steg — ellers feiler `test:rules` misvisende på alt.

`npm run build` kjøres før arbeidet kalles ferdig, uansett hvor grønne testene
er.

Til slutt en manuell sjekk i `npm run dev`: skjemaet med alle fire seksjonene,
og en tavle rendret med en flate som ikke fantes før — for eksempel fersken
topp — for å se at logo og tekstfarge følger modusen.

## Utenfor omfanget

- Rekkefølge-styring av karusellmodulene
- Nye moduler i noen av katalogene
- Egne koordinater for karusellvær og stripevær
- `@entur/dropdown` som ny avhengighet
- Endringer i `BoardAccess`, `BoardAlerts` eller sletting av tavla
