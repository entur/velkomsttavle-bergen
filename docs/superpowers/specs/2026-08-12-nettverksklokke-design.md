# Design: Nettverksklokke for nedtelling og varselvinduer

**Dato:** 2026-08-12
**Status:** Godkjent design, klar for implementering

## Mål

Nedtellinga i avgangsvisninga og tidsvinduet for varsler skal regne fra
nettverkstid, ikke fra enhetens klokke.

## Rotårsak

Skjermen i resepsjonen har en klokke som går omtrent fem minutter for fort.

`expectedAt` er absolutt tid fra Journey Planner, mens `now` i `Departures.jsx`
er `new Date()` fra enheten. De to har altså ulike kilder, og differansen er
klokkefeilen.

Observasjonen som låser diagnosen er at nedtellinga **forsvinner**, ikke bare
blir feil. `countdownLabel` gir `null` når `minutes < 0`, altså først når
enheten tror avgangen har vært. Med klokka fem minutter for fort:

| Uttrykk | Oppførsel | Med klokke +5 min |
|---|---|---|
| `minutes === 0` → «nå» | Under ett minutt igjen | Slår inn fem minutter for tidlig |
| `minutes < 0` → `null` | Nedtellinga forsvinner | Forsvinner fem minutter før avgang |
| `tid(expectedAt)` | Formateres fra APIet | Fortsatt riktig |
| Raden i lista | Står til APIet slipper den | Står til toget faktisk går |

Alle fire stemmer med det som ble observert på tavla.

**Utelukket:** `Math.floor` i `minutesUntil` kan gi maks ett minutts avvik, ikke
fem. Feil tidssone ville flyttet klokkeslettene i hele timer, og de er riktige.

Samme rotårsak rammer `selectVisibleAlerts`, som også får `new Date()` fra
`AlertBanner`. Et varsel satt til «fra 08:00» dukker opp 07:55.

## Kilden til nettverkstid

**Ikke fra Entur.** `Date`-headeren fra Journey Planner er ikke CORS-eksponert —
svaret sender ingen `Access-Control-Expose-Headers`, og `Date` er ikke på
safelista, så nettleseren skjuler den. `serverInfo` i skjemaet har bare
`buildTime`, `gitCommitTime` og liknende, ingen nåtid. Begge sondert mot APIet.

**Fra vårt eget domene.** Tavla serveres fra Firebase Hosting, og same-origin-
svar eksponerer alle headere uten CORS-begrensning. En `HEAD`-forespørsel mot
`/` gir en `Date`-header som ble målt til å stemme på sekundet.

`cache: 'no-store'` er nødvendig: et svar fra cache ville båret den opprinnelige
`Date`-en og gitt en offset som blir eldre for hver gang.

## Løsning

Ny modul `src/time/networkClock.js`, uten JSX og uten React, med tre deler:

```
clockOffset(serverDate, deviceDate) → antall millisekunder å legge til
fetchServerTime({ fetchImpl })      → Date fra headeren, eller null
startClockSync({ ... })             → henter, setter offset, gjentar; gir stopp-funksjon
networkNow()                        → new Date(Date.now() + offset)
```

`App` starter synkroniseringa, slik den allerede eier vær- og avgangspollingen.
`Departures` og `AlertBanner` bytter `new Date()` mot `networkNow()`.

Modulnivå-tilstand framfor props: `AlertBanner` bor i `MiddleBand` og
`Departures` i karusellen, så en delt verdi måtte ellers vært tredd gjennom to
uavhengige grener. De rene delene testes hver for seg.

### Feil skal aldri stoppe tavla

- Feiler forespørselen, eller mangler headeren, beholdes forrige offset.
- Startverdien er 0, altså dagens oppførsel. En tavle uten nettverkstid teller
  som før, den blir ikke tom.
- Ingen øvre grense på offset. En enhet som står i 1970 trenger nettopp et stort
  hopp; en grense ville hindret den ene rettelsen som betyr noe.

### Hvor ofte

Ved oppstart, og deretter hver time. Klokkedrift er langsom, og forespørselen
er en `HEAD` mot eget domene. Én i timen er billigere enn ett minutt feil.

## Testing

Under `npm test`, som resten av repoet.

- **`clockOffset`:** differansen regnes riktig begge veier; ugyldig dato gir `null`.
- **`fetchServerTime`:** leser `Date`-headeren; gir `null` ved manglende header,
  ved uparsbar verdi, ved feilkode og ved kastende `fetch`. Sender `HEAD` og
  `cache: 'no-store'`.
- **`startClockSync`:** setter offset etter første henting, gjentar på intervall,
  beholder forrige verdi når en henting feiler, og stopper på stopp-funksjonen.
  Timere injiseres, slik `startDeparturePolling` allerede gjør.
- **`networkNow`:** returnerer enhetstid pluss offset.

## Utenfor omfang

- **Tidssona.** `tid()` i `Departures.jsx` bruker `Intl.DateTimeFormat` uten
  `timeZone`, så klokkeslettene følger enhetens sone. Feil sone ville gitt feil
  på hele timer, og det er ikke observert. Verdt å låse til `Europe/Oslo`
  senere, men det er en annen feil enn denne.
- **At nedtellinga forsvinner når minuttene blir negative.** Med klokka rettet
  er vinduet under ett minutt pluss reell forsinkelse, og klokkeslettet står der
  hele tida.
- Værmodulen og `getGreetingText`, som begge tåler minutters avvik.
