# Design: Fjern gjentatt videonedlasting (411 GB/uke egress)

Dato: 2026-08-03
Status: Godkjent design
Issue: [#105](https://github.com/entur/velkomsttavle-bergen/issues/105)

## Bakgrunn og problem

Firebase Hosting rapporterer 411,62 GB nedlasting på sju dager — ~59 GB per døgn — for
én informasjonsskjerm. Til sammenligning er lagringen 107,76 MB. På Blaze-planen
tilsvarer det rundt \$263 i måneden.

`public/entur.mp4` er 8,01 MB og 30,08 sekunder, og spilles i loop fra
`src/App.jsx:76`. Ingenting annet på sida er stort nok til å forklare tallet: hele
bundelen er under 1 MB, resten er små SVG-er. Videoen er det eneste som gjentas.

Serversiden er verifisert i produksjon og er i orden:

- `cache-control: public, max-age=31536000, immutable` blir faktisk servert.
- `accept-ranges: bytes`, og `Range: bytes=0-1023` gir `206` med nøyaktig 1024 bytes.

Problemet er altså på klientsiden: nettleseren henter videoen på nytt. En observasjon
peker samme vei — på en side som hadde stått i 254 sekunder var bare 15,4 av 30
sekunder bufret, med `networkState: NETWORK_IDLE`. Chrome bufrer bevisst bare deler av
videoen, og på en enhet der mediecachen er liten eller blir evictet betyr det henting
over nettet ved hver runde.

**Dette motbeviser en antakelse i
[2026-07-23-video-og-firebase-hosting-design.md](2026-07-23-video-og-firebase-hosting-design.md).**
Den spec-en la til grunn at same-origin servering med `immutable` ville gjøre at
loop-restart leser fra cache i stedet for nettverk. Headerne er riktige, men
`<video loop>` respekterer dem ikke slik vi antok — mediecachen er ikke HTTP-cachen.
Vi må derfor ta videoen ut av nettleserens mediecache-håndtering helt.

## Mål

Egress fra Firebase Hosting skal ned fra ~59 GB/døgn til noen få MB, uten synlig
endring i hvordan tavla ser ut.

## Ikke i scope

- Service worker / Cache Storage API. HTTP-cachen med `immutable` dekker allerede
  reload av sida; problemet er loop-restart innenfor én sidevisning.
- Endring av videoen som konsept, eller øvrig UI/layout.
- Automatisert verifisering av egress. Avlesing av Hosting → Usage gjøres manuelt.

## Tiltak 1 — Hent videoen én gang og loop fra minnet

Rotårsaksfiksen. Fjerner problemet uavhengig av hva nettleserens mediecache gjør: når
`<video>` peker på en blob-URL finnes dataene i minnet, og loop-restart kan ikke
utløse et nettverkskall.

### `src/components/videoBlobLoader.mjs`

Livssyklusen legges i en ren modul uten DOM-avhengigheter, med injiserte
avhengigheter (`fetchImpl`, `createObjectURL`, `revokeObjectURL`, `delay`), slik at
den kan enhetstestes med `node --test`. Det følger repoets eksisterende mønster
(`scripts/floorplan-transform.test.mjs`) og krever ingen nye avhengigheter.

Kontrakt:

```js
const loader = createVideoBlobLoader({ src, /* valgfrie deps */ })
loader.start(onState)  // kaller onState({ status }) ved hver overgang
loader.cancel()        // aborterer pågående fetch, revoker eventuell URL
```

Tilstander: `loading` → `ready` (med `url`) eller `failed`.

Atferd:

- Nøyaktig ett vellykket fetch. Ingen videre kall etter `ready`.
- Ved feil: inntil tre forsøk med økende backoff, deretter `failed`.
- `cancel()` aborterer pågående fetch og revoker en eventuelt opprettet blob-URL.
  `onState` kalles ikke etter `cancel()`.

**Retry er et bevisst tillegg utover issue-ens forslag.** Issue-ens snippet faller rett
til direkte `src` ved feil. Den realistiske feilen på en kiosk er at skjermen booter før
wifi er oppe. Uten retry ville vi da stille falt tilbake til direktestrømming og vært
tilbake på ~59 GB/døgn, uten noe signal om det.

### `src/components/LoopingVideo.jsx`

Tynn React-wrapper. Rendrer alltid `<video loop muted playsInline>`, og velger `src`
etter loaderens tilstand:

| Tilstand | `src` | Oppførsel |
|---|---|---|
| `loading` | ingen | Plassen er reservert, `<video>` gjør ingen nettverkskall |
| `ready` | blob-URL | Looper fra minnet, null nettverkskall |
| `failed` | `/entur.mp4` | Dagens oppførsel som siste utvei |

`src/App.jsx:76` bytter fra `<video src="/entur.mp4" …>` til `<LoopingVideo …>`.

### Layout

Videoen er i dag `width:100vw, height:auto, maxHeight:40vh, objectFit:cover`. På enhver
skjerm smalere enn 2,5:1 klemmes høyden alltid til 40vh, så eksplisitt `height:40vh`
rendrer identisk. Endringen fjerner at elementet kollapser og layouten hopper mens
blobben lastes.

## Tiltak 2 — Krymp videoen

Uavhengig av tiltak 1. Etter tiltak 1 handler dette om førstelasting og
cache-vennlighet, ikke om å redde kostnaden — det gir oss råd til å prioritere
kvalitet.

8,01 MB for 30 s er 2,14 Mbps. Fila har et stereo 48 kHz AAC-lydspor som aldri høres,
siden elementet er `muted`; det er rene bortkastede bytes.

Kandidater enkodes med `ffmpeg`, alle med `-an`, `-movflags +faststart`,
`-pix_fmt yuv420p`, og vurderes visuelt før én velges.

**Utfall.** Originalen viste seg å være så ineffektivt enkodet at avveiningen mellom
kvalitet og størrelse i praksis forsvant — full 1080p i høy kvalitet ble 10,6× mindre:

| Variant | Størrelse |
|---|---|
| Original | 7824 KB |
| **Valgt: 1080p CRF 20** | **737 KB** |
| 1080p CRF 28 | 408 KB |
| 720p CRF 26 | 286 KB |
| 720p CRF 32 | 188 KB |

Alle kandidatene er verifisert med `ffprobe` til 25 fps / 751 frames / 30,04 s — ingen
droppede frames. Vi valgte 1080p CRF 20: å spare ytterligere 450 KB er uten betydning
når blob-fiksen uansett gjør at fila hentes én gang, så det er ingen grunn til å ofre
kvalitet på en veggskjerm.

Kommandoen:

```
ffmpeg -i entur.mp4 -an -c:v libx264 -preset slow -pix_fmt yuv420p \
  -movflags +faststart -crf 20 ut.mp4
```

## Verifisering

- `node --test src/components/videoBlobLoader.test.mjs` — dekker: nøyaktig ett fetch
  ved suksess, ingen kall etter `ready`, URL revoket ved `cancel()`, fetch abortert ved
  `cancel()`, retry inntil grensa og så `failed`.
- Manuelt i `npm run preview` med nettverkspanelet: `/entur.mp4` hentes én gang, og
  antall requests står stille mens videoen looper flere runder. Enhetstesten kan ikke
  dekke dette — at `<video loop>` på en blob-URL ikke gir flere requests er en
  nettlesergaranti, ikke vår kode.
- `npm run build` fullfører, og `dist/entur.mp4` finnes.
- Etter deploy: les av Hosting → Usage etter et døgn og bekreft at tallet har falt.
  Det er den eneste målingen som er til å stole på her.

### Målt resultat i `vite preview`

| | Før | Etter |
|---|---|---|
| Forespørsler mot `/entur.mp4` | — | 1 |
| Overført | 8 012 567 B | 755 030 B |
| Bufret av 30,04 s | 15,4 s (produksjon, etter 254 s) | 30,04 s umiddelbart |
| `networkState` | — | 1 (NETWORK_IDLE) |

Videoen ble deretter søkt gjennom 18–24 ganger over hele tidslinja, inkludert
loop-skjøten (29,9 s → 0). Forespørselstallet holdt seg på 1. Hadde noen del av
videoen ikke ligget i minnet, ville et søk dit utløst en range-forespørsel.

**Forbehold:** sanntids-looping lot seg ikke observere direkte — nettleserruta kjører
skjult, og Chrome pauser avspilling der. Søketesten dekker samme spørsmål strengere
(vilkårlig tilgang til alle deler av videoen uten nettverk), men den er ikke det samme
som å se tavla loope i en time. Endelig bekreftelse er avlesingen av Hosting → Usage.

## Sidefunn: bygget var allerede brutt på main

Verifiseringen avdekket at `main` ikke bygde i det hele tatt, uavhengig av denne
endringen. Floorplan-synken i 26bd7ab la inn to feil i `src/floorplan/BergenThird.jsx`:
en `} as React.CSSProperties`-assertion i en `.jsx`-fil, og en import av
`../../data/roomColors` som ikke fantes.

Dette er urelatert til #105 og ble løst separat i #103 (`82f2c88`), som denne greina er
rebaset på. To ting derfra er verdt en oppfølging:

1. **Romfargene i `data/roomColors.js` stemmer ikke med `entur/plantegning`.**
   Fila sier at verdiene speiler paletten der, men ingen av dem gjør det — for eksempel
   er `meeting` `#C5E0EC` (blå) mot `#F2E0D6` (fersken) upstream, og `landscape` er
   `#F5F0E8` mot `#CBE5FE`. `individualOffice` mangler helt. Kartet rendrer altså med
   feil farger. De faktiske verdiene ligger i `src/data/roomColors.ts` i
   `entur/plantegning`.
2. **`as`-regexen i transformen er uankret.** `/\s+as\s+[A-Za-z][A-Za-z0-9_.]*/g` matcher
   også prosa som «Rom as Noe» inne i SVG-tekst, og ville da stille fjerne « as Noe» fra
   en romtekst. Å kreve at assertionen følger en avsluttet literal — `(?<=[}\])])` — gjør
   at en form vi ikke dekker heller feiler bygget synlig.
