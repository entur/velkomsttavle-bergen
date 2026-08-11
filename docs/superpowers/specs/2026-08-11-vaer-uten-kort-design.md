# Design: Været uten kort

**Dato:** 2026-08-11
**Status:** Implementert

## Mål

Værvarselet dropper kortene sine. Både karusellvisningen (`Weather.jsx`) og
bunnstripa (`WeatherStripe.jsx`) tegner innholdet rett på flaten feltet har
valgt — ingen panelbakgrunn, ingen `borderRadius`, ingen skygge, og heller ikke
det mørkeblå «Nå»-kortet med gradient.

Valget gjelder alle seks flatene, ikke bare de tre der panelet var hvitt. Én
layout er lettere å holde enn en som ser ulik ut alt etter hva resepsjonen har
valgt i admin.

## Bakgrunn / funn

- Kortene var `backgroundColor: palette.panel` på fire steder: timesstripa og
  dagsraden i `Weather.jsx`, og «nå» og den vekslende siden i `WeatherStripe.jsx`.
  «Nå»-kortet i karusellen hadde i tillegg egen `linear-gradient`, `boxShadow` og
  en kant som bare ble satt i mørkt tema.
- `palette.panel` hadde ingen andre forbrukere. `OfficeMap` maler sin egen hvite
  boks med en hardkodet `#ffffff` (`OfficeMap.jsx:23`), ikke med panelfargen.
  Uten været er feltet derfor dødt.
- **Korall tåler ikke å være tekst på bakgrunnen.** Nedbørslabelen og
  «Nå»-overskriften var `palette.accent`. Målt mot det hvite panelet er den 3.08;
  mot bakgrunnen er den 1.56 på lavendel og 1.93 på fersken. Korallen måtte
  derfor ut av teksten. Den lever videre i `ProgressBar`, som er en stripe og
  dekkes av kravet `accent mot bakgrunn >= 1.5`.
- **Entur-typografien arver ikke farge.** `.eds-h3` og `.eds-label` setter
  `color: #181c56` i sin egen regel, og en arvet `color` fra en forelder taper
  mot den. Målt i nettleseren: klokkeslettene i timesstripa sto som `rgb(24, 28,
  86)` også når foreldren sa `palette.text`. Det var like galt før denne
  endringen — mørkeblå tekst på det mørkeblå panelet #393d79 — men panelet
  skjulte det aldri. Hver `Heading3` og `Label` må ha `palette.text` eksplisitt.

## Endringer

**`src/components/Weather.jsx`**

- «Nå»-blokka mister gradient, `boxShadow`, `borderRadius` og den mørk-bare
  kanten. `const dark = palette.mode === 'dark'` blir ubrukt og går ut, sammen med
  hele `base`-importen fra `@entur/tokens`.
- Timesstripa og dagsraden mister `backgroundColor` og `borderRadius`. Paddingen
  står — den er luft mellom blokkene, ikke kortkant.
- Alle `'#ffffff'` (temperatur, `DetailRow`, vind- og paraplyikon) blir
  `palette.text`. De var hvite fordi kortet var mørkeblått; nå er flaten under av
  ukjent lyshet. `DetailRow` tar `color` som prop.
- `Heading3` og `Label` får `color: palette.text` eksplisitt, av grunnen over.
- Korallen (`HIGHLIGHT`) er ikke lenger tekstfarge noe sted i filen.

**`src/components/WeatherStripe.jsx`**

- `NowCard` → `NowBlock`, og den mister `backgroundColor` og `borderRadius`.
  Samme for den vekslende høyresiden; `overflow: hidden` og padding står.
- `HourCell` mister `color: HIGHLIGHT` på nedbøren og arver `palette.text` fra
  stripa. Her holder arv: cellene bruker vanlige `<span>`, ikke Entur-typografi.
- `base`/`HIGHLIGHT`-importen går ut. `ProgressBar` er urørt.

**`src/boards/surfaces.js`**

- `panel` fjernes fra `TABLE` og fra `surfacePalette`. Paletten er nå
  `{ name, mode, background, text, accent }`.

**`src/boards/surfaces.test.mjs`**

- Panel-feltet ut av hex-sjekken, og «tekst mot både bakgrunn og panel» blir
  «tekst mot bakgrunnen». Kravet som betyr noe består: `text` mot `background`
  >= 4.5 for alle seks flatene, laveste faktiske verdi 7.97.
- Testen «gir panelet en synlig flate mot bakgrunnen» går ut med feltet den målte.
  Kommentaren der viste til nettopp de Weather-kortene som nå er slettet.
- Progress-bar-testen beholdes, med en kommentar om at grensen 1.5 er derfor
  korall ikke kan brukes som tekst.

## Verifisering

- `npm test` — 320 tester, alle grønne.
- `npm run build`.
- Visuell runde over alle seks flatene for både karusellvisningen og stripa,
  gjennom en midlertidig forhåndsvisningsside som rendret de virkelige
  komponentene med et fast varsel. Den avdekket `.eds-h3`-funnet over, og ble
  slettet etterpå. Repoet har ingen komponenttester — bare ren `.mjs`-logikk — så
  denne runden er det eneste som ser layouten.
