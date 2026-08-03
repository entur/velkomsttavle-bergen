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

Tre kandidater enkodes med `ffmpeg`, alle med `-an`, `-movflags +faststart`,
`-pix_fmt yuv420p`:

1. 1080p, CRF 28, preset slow
2. 720p, CRF 26
3. 720p, CRF 32 (aggressiv)

Størrelsene rapporteres og kandidatene vurderes visuelt før én velges og erstatter
`public/entur.mp4`.

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
