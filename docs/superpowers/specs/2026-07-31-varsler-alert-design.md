# Design: Varsler (alerts) på tavla, med admin-side

**Dato:** 2026-07-31
**Status:** Godkjent design, klar for implementeringsplan

## Mål

Kunne vise tidsstyrte meldinger («varsler») øverst i det mørkeblå feltet under
videoen på velkomsttavla, og legge dem inn selv via en admin-side med
Entur-pålogging.

Hver melding har tittel, tekst, nivå (som styrer farge og ikon) og et tidsrom den
skal vises i. Meldingene lagres i Firestore i samme GCP-prosjekt som tavla
(`ent-tavleber-prd`) og slår ut på skjermen i resepsjonen uten at noen må laste
siden på nytt.

## Bakgrunn / funn

- Tavla er en ren SPA (React 19 + Vite 8), uten router, backend eller
  autentisering. Layouten i `src/App.jsx` er en flex-kolonne: video (maks 40vh) →
  mørkeblå `Contrast`-seksjon (figur + hilsen) → `Carousel` (`flex: 1`, vær og
  kontorkart).
- Firebase-prosjektet `ent-tavleber-prd` brukes i dag **kun** til Hosting. Ingen
  Firestore, ingen Authentication.
- Firestore i Entur-Firebase-prosjekter provisjoneres av app-factory via
  self-service-manifestet i `.entur/`, ikke via Terraform eller konsollet. For
  `kind: GoogleCloudFirebaseApplication` er feltet `spec.firebase.db_type`, som
  **defaulter til `firestore`** ([manifest-dok](https://github.com/entur/tf-gcp-apps/blob/main/docs/manifests/GoogleCloudFirebaseApplication.md)).
  Databasen i `ent-tavleber-prd` **finnes derfor allerede** — verifisert med
  `firebase firestore:databases:list`. Manifestet skal ikke endres.
  (`spec.appEngine` hører til `GoogleCloudApplication`, ikke Firebase-varianten.)
- Web-app-registreringen som gir `apiKey`/`appId` ligger **utenfor** app-factory:
  plattformens Terraform har `google_firebase_project`,
  `google_firebase_storage_bucket` og storage-regler, men ingen
  `google_firebase_web_app`. Den opprettes med Firebase-CLI-en.
- Plattformen eier `google_firebaserules_*` **kun for storage**, ikke for
  Firestore. Firestore-reglene er dette repoets ansvar alene.
- `@entur/alert` har `BannerAlertBox` med presis de propene vi trenger:
  `variant` (`information` | `success` | `warning` | `negative`), `title`,
  `children`. Ingen oversettelseslag mellom lagret data og komponent nødvendig.
- **Versjonsfunn:** prosjektet ligger på forrige major av Entur-designsystemet
  (`@entur/icons@9`, `@entur/tokens@3`, `@entur/typography@2`,
  `@entur/tooltip@5`). Nyeste `@entur/alert@0.20.0` og `@entur/form@10.0.0`
  krever `tokens@4` / `typography@3` / `icons@10`. Vi bruker derfor pre-major-
  versjonene, som alle ligger på `tokens@^3.24` og passer rett inn i eksisterende
  stack:

  | Pakke | Versjon | Krever |
  |---|---|---|
  | `@entur/alert` | `0.19.4` | `tokens@^3.24`, `typography@^2.1.12`, `icons@^9.0.4` |
  | `@entur/form` | `9.3.8` | samme |
  | `@entur/button` | `4.0.11` | `tokens@^3.24` |
  | `@entur/datepicker` | `11.8.1` | samme + `@internationalized/date` |
  | `@entur/table` | `4.10.16` | samme |
  | `firebase` | `12.17.0` | — |

  Å oppgradere hele designsystem-stacken til ny major er en egen, mer risikabel
  jobb og hører **ikke** hjemme i denne endringen.
- Firebase Hosting rewriter alt til `index.html` (`firebase.json`), så en
  `/admin`-URL fungerer uten ny konfigurasjon.

## Beslutninger

Alle punktene under er avklart med bruker.

| Tema | Beslutning |
|---|---|
| **Plassering** | Øverst i det mørkeblå feltet, full bredde, **over** figur og hilsen |
| **Flere aktive** | Alle vises stablet under hverandre |
| **Rekkefølge** | Alvorligste nivå øverst, deretter nyeste `startsAt` først |
| **Tidsstyring** | Fra- og til-tidspunkt, pluss en av/på-bryter. Åpen slutt tillatt |
| **Pålogging** | Firebase Auth med Google-provider, låst til `@entur.org` |
| **Tilgang** | Eksplisitt allowlist i Firestore (`admins`-collection), styrt som click-ops i konsollet. Se «Tilgangsstyring» |
| **Lesetilgang** | Offentlig lesing aksepteres. Se «Sikkerhet og personvern» |
| **Sporing** | `createdBy` / `updatedBy` lagres og vises i admin-listen. Ingen egen endringshistorikk |
| **Nivåvelger** | Fargeprøve-kort med norske etiketter, ikke rå enum-verdier |

## Arkitektur

### Oppdeling i to sider, uten router

`src/main.jsx` velger rot-komponent ut fra `location.pathname`:

- starter stien med `/admin` → `<Admin />`, lastet med `React.lazy`
- ellers → `<App />`, som i dag

Admin lastes lazy slik at kiosk-bundelen ikke drar inn `firebase/auth`,
skjema-komponentene eller datepickeren. Én router-avhengighet for to statiske
ruter er ikke verdt vekten.

### Nye moduler

| Fil | Ansvar | Avhenger av |
|---|---|---|
| `src/alerts/firebase.js` | Initialiserer Firebase-appen én gang, eksporterer `db` | `firebase/app`, `firebase/firestore` |
| `src/alerts/firebaseConfig.js` | Web-konfigen for `ent-tavleber-prd` | — |
| `src/alerts/alertsRepository.js` | Alt Firestore-snakk: `subscribeToEnabledAlerts` (tavla), `subscribeToAllAlerts` (admin), `saveAlert`, `deleteAlert` | `firebase.js`, `alertMapper.js` |
| `src/alerts/alertSchedule.js` | Ren logikk: `selectVisibleAlerts(alerts, now)` | ingenting |
| `src/alerts/alertLevels.js` | De fire nivåene med norsk etikett, hjelpetekst og sorteringsvekt | ingenting |
| `src/alerts/alertMapper.js` | Oversetter mellom Firestore-dokumenter og appens objekter (`toAlert`, `toFirestoreData`); klemmer et ukjent `level` til `information` | `alertLevels.js` |
| `src/alerts/alertValidation.js` | Ren logikk: `validateAlertInput(input)` | `alertLevels.js` |
| `src/components/AlertBanner.jsx` | Tavle-visningen | repository, schedule, `@entur/alert` |
| `src/admin/Admin.jsx` | Rot for admin: pålogging eller innhold | `adminAuth.js` |
| `src/admin/adminAuth.js` | `signIn`, `signOut`, `subscribeToUser` | `firebase/auth`, `enturAccount.js` |
| `src/admin/enturAccount.js` | Domenesjekk (`@entur.org`, verifisert e-post) og e-postnormalisering | ingenting |
| `src/admin/adminAccess.js` | Slår opp om innlogget bruker står i `admins`-allowlisten | `firebase/firestore`, `enturAccount.js` |
| `src/admin/AlertList.jsx` | Tabell over meldinger, gruppert på status | repository, `@entur/table` |
| `src/admin/AlertForm.jsx` | Skjema for ny/endret melding + forhåndsvisning | validation, `@entur/form`, `@entur/datepicker` |
| `src/admin/LevelPicker.jsx` | Fargeprøve-kortene for nivå | `alertLevels.js` |

**Tre filer importerer `firebase/firestore`:** `alertsRepository.js` (varslene
selv), `firebase.js` (initialiserer appen og eksporterer `db`) og
`adminAccess.js` (allowlist-oppslaget). Alt annet snakker med repositoryet,
ikke direkte med Firestore. Det holder Firestore-avhengigheten til noen få
filer og gjør at logikken forøvrig kan testes uten Firestore — men det er tre
filer å endre ved et bytte av lagring, ikke én.

`alertSchedule.js` og `alertValidation.js` er rene funksjoner uten React og uten
Firestore. Det er her de reelle feilene sitter, og det er derfor de er skilt ut.

### Firebase-konfig i klartekst

Firebase-web-konfigen (`apiKey`, `authDomain`, `projectId`, `appId`) er offentlig
informasjon by design — den havner i bundelen uansett, og `apiKey` er en
prosjekt-identifikator, ikke en hemmelighet. Sikkerheten ligger i
Firestore-reglene. Vi committer den derfor som en vanlig modul framfor å innføre
`.env` + GitHub-secrets for noe som ikke kan holdes skjult.

## Datamodell

Collection `alerts`, ett dokument per melding:

```js
{
  title:     string,        // påkrevd, 1–80 tegn
  body:      string,        // påkrevd, 1–400 tegn
  level:     'information' | 'success' | 'warning' | 'negative',
  startsAt:  Timestamp,     // påkrevd
  endsAt:    Timestamp | null,   // null = åpen slutt
  enabled:   boolean,
  createdAt: Timestamp,
  createdBy: string,        // e-post
  updatedAt: Timestamp,
  updatedBy: string,        // e-post
}
```

`level` lagres med Entur-variantnavnene direkte, så tavla kan sende verdien rett
inn i `<BannerAlertBox variant={level}>`.

`endsAt: null` betyr åpen slutt — meldingen vises til noen slår av `enabled`.
Dette er bevisst tillatt, for meldinger som «heisen er ute av drift» der ingen vet
når det er over.

### Nivåene

Definert i `alertLevels.js`, brukt både i nivåvelgeren og i valideringen:

| `level` | Farge | Etikett | Hjelpetekst |
|---|---|---|---|
| `information` | blå | Informasjon | Nyttig beskjed, ikke noe man må reagere på |
| `success` | grønn | Positivt | Noe er i orden igjen, eller en god nyhet |
| `warning` | gul | Advarsel | Noe man bør merke seg — heis ute av drift, endret åpningstid |
| `negative` | rød | Kritisk | Noe galt som krever handling nå |

Sorteringsvekt for stabling: `negative` (0) → `warning` (1) → `information` (2)
→ `success` (3).

## Tilgangsstyring

Å ha en `@entur.org`-konto er **ikke** nok til å legge inn meldinger. Tilgang gis
per person via en eksplisitt allowlist i Firestore.

**Collection `admins`**, ett dokument per person, der **dokument-ID-en er
e-postadressen i små bokstaver**. Innholdet i dokumentet spiller ingen rolle —
det er eksistensen som gir tilgang. I praksis lagres `addedBy` og `addedAt` som
dokumentasjon.

Å gi eller fjerne tilgang er å legge til eller slette et dokument i
Firebase-konsollet. Ingen deploy, ingen kode, ingen Terraform. Klienten kan
**ikke** skrive til collectionen i det hele tatt, og kan bare lese sitt **eget**
dokument — så en innlogget bruker kan sjekke om hen selv har tilgang, uten å
kunne liste ut hvem andre som har det.

Denne modellen ble verifisert mot Firestore-emulatoren før den ble valgt:

| Prøve | Resultat |
|---|---|
| `String.lower()` finnes i regelspråket | Virker |
| `exists()` mot `admins/{lowercased e-post}` | Virker |
| Samme oppslag med `Sturle@Entur.Org` i tokenet | Virker — normaliseringen treffer |
| Ikke-allowlistet konto skriver `alerts` | Avvist 403 |
| Lese en annens `admins`-dokument | Avvist 403 |
| Klient skriver til `admins` | Avvist 403 |

Domenesjekken på `@entur.org` beholdes i tillegg til allowlisten. Den er
strengt tatt overflødig når allowlisten bare inneholder Entur-adresser, men den
gjør at en feilskrevet oppføring — en privat Gmail-adresse, for eksempel — ikke
gir tilgang.

**Ikke valgt:** å skru av *Enable create (sign-up)* i Identity Platform. Det ville
hindret ukjente Google-kontoer fra å autentisere seg i det hele tatt, men
samspillet mellom forhåndsopprettede konsoll-brukere og føderert Google-innlogging
(kontokobling på e-post) er uforutsigbart, og allowlisten løser tilgangsspørsmålet
alene. Kan legges på senere som et ekstra forsvarslag.

## Firestore-regler

`firestore.rules`, deployes sammen med hosting:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function callerEmail() {
      return request.auth.token.email.lower();
    }

    function isEnturUser() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && callerEmail().matches('.*@entur[.]org$');
    }

    function isAdmin() {
      return isEnturUser()
        && exists(/databases/$(database)/documents/admins/$(callerEmail()));
    }

    function isValidAlert(d) {
      return d.title is string && d.title.size() > 0 && d.title.size() <= 80
        && d.body is string && d.body.size() > 0 && d.body.size() <= 400
        && d.level in ['information', 'success', 'warning', 'negative']
        && d.startsAt is timestamp
        && (d.endsAt == null || (d.endsAt is timestamp && d.endsAt > d.startsAt))
        && d.enabled is bool;
    }

    match /alerts/{alertId} {
      allow read: if true;
      allow create: if isAdmin()
        && isValidAlert(request.resource.data)
        && request.resource.data.createdBy == callerEmail()
        && request.resource.data.updatedBy == callerEmail();
      allow update: if isAdmin()
        && isValidAlert(request.resource.data)
        && request.resource.data.updatedBy == callerEmail()
        && request.resource.data.createdBy == resource.data.createdBy;
      allow delete: if isAdmin();
    }

    match /admins/{adminEmail} {
      // Man leser kun sitt eget dokument: klienten kan sjekke egen tilgang
      // uten å kunne liste ut hvem andre som har den.
      allow read: if isEnturUser() && adminEmail == callerEmail();
      // Tilgang gis og fjernes i Firebase-konsollet, aldri fra klienten.
      allow write: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Fire ting reglene gjør:

1. **Skriving krever allowlist-oppføring**, ikke bare en Entur-konto.
2. **Feltvalidering**, slik at et ugyldig dokument ikke kan velte tavla.
3. **`createdBy`/`updatedBy` må være den innloggedes e-post**, og `createdBy` kan
   ikke endres, så sporet av hvem som la inn hva ikke kan forfalskes.
4. **Alt utenfor `alerts` og `admins` er stengt**, så en framtidig collection ikke
   blir åpen ved uhell.

Valideringen finnes både i reglene og i `alertValidation.js`. Det er bevisst
duplisering: skjemaet gir god feilmelding før lagring, reglene er det som faktisk
håndhever.

## Tavla — `AlertBanner`

### Datahenting

`onSnapshot` på `query(collection(db, 'alerts'), where('enabled', '==', true))`.
Live-abonnement, ikke polling: en melding lagt inn i admin er på skjermen i
resepsjonen innen sekunder, uten reload. Det er hele poenget for en tavle som
står og går i ukevis.

### Tidsvindu-filtrering i klienten

`selectVisibleAlerts(alerts, now)` filtrerer på tidsrom og sorterer. To grunner
til at dette ikke gjøres i queryen:

- Firestore kan ikke range-filtrere på både `startsAt` og `endsAt` i samme query
  uten sammensatt indeks.
- Vi må reevaluere når klokka passerer et start- eller sluttpunkt uansett.

En `setInterval` på 30 sekunder trigger ny evaluering. Presist nok for en melding
som skal vises «fra 08:00», og billig siden det ikke medfører nettverkskall.

Funksjonssignatur:

```js
selectVisibleAlerts(alerts, now) // => Alert[], sortert
```

Regler: `enabled === true`, `startsAt <= now`, og `endsAt == null || endsAt > now`.
Sortering: nivåvekt stigende, deretter `startsAt` synkende.

### Plassering og rendring

Øverst i `<Contrast>`-blokka i `src/App.jsx`, full bredde, **over**
`StaffAndHeadings`. Én `<BannerAlertBox variant={level} title={title}>{body}</BannerAlertBox>`
per melding, stablet med mellomrom.

Ingen aktive meldinger → komponenten rendrer `null`, og feltet ser ut nøyaktig som
i dag, uten tom plass.

### Skriftstørrelse

`BannerAlertBox` er dimensjonert for en laptop, ikke en vegg-skjerm. En wrapper
skalerer opp tekst og ikon, justert mot faktisk skjerm i resepsjonen.

### Robusthet

**Tavla skal aldri gå ned på grunn av en alert-feil.** `AlertBanner` pakkes i en
error boundary. Feiler Firestore — offline, avviste regler, ugyldig dokument —
rendres ingenting og feilen logges til konsollet. Video, hilsen og karusell er
upåvirket.

**Error boundary-en må reparere seg selv.** Tavla står og går i ukevis og laster
seg aldri på nytt av seg selv, så en boundary som låser seg permanent ville tatt
varselfeltet ut av drift til noen gikk bort og lastet siden manuelt. Den nullstiller
seg derfor etter fem minutter, slik at innholdet remonteres og får et friskt
Firestore-abonnement. Er problemet fortsatt der, feiler den igjen og prøver på nytt
— og feltet kommer tilbake av seg selv når dataene er rettet.

**Et ugyldig `level` skal ikke velte de gyldige varslene.** `@entur/alert` slår opp
ikonet sitt på variantnavnet uten å sjekke, så en verdi utenfor de fire kaster og
tar med seg hele stabelen. `toAlert` klemmer derfor et ukjent `level` til
`information`. Reglene sperrer dette fra klienten, men et dokument skrevet for hånd
i konsollet — for eksempel med den norske etiketten «Kritisk» i stedet for
`negative` — går rundt reglene.

### Plassbegrensning

Siden alle aktive meldinger stables, kan feltet i prinsippet spise hele skjermen.
Tiltak:

- Det mørkeblå feltet får `maxHeight` rundt 45vh med `overflow: hidden`.
  Karusellen krymper **ikke** — den er et eget flex-element under feltet og er
  upåvirket. Det som faktisk klippes bort er stacken *inne i* feltet selv, når
  den er høyere enn 45vh: `flex-start` (ikke `center`) brukes bevisst som
  `justifyContent`, slik at overskuddet klippes **nedenfra**. Siden
  `selectVisibleAlerts` sorterer alvorligste varsel øverst, er det da hilsenen
  og de minst alvorlige varslene lengst ned i stacken som forsvinner først —
  ikke det mest alvorlige varselet, som ville skjedd med `center`.
- Admin viser en tydelig advarsel når det er mer enn tre aktive meldinger
  samtidig, og beskriver denne konsekvensen (hilsen og lavest prioriterte
  varsler klippes) framfor å peke på karusellen.

Å skjule meldinger stille ville vært verre; advarselen står der noen kan gjøre noe
med den.

## Admin-siden — `/admin`

### Uinnlogget

Entur-logo og én knapp: «Logg inn med Google». `signInWithPopup` med
`GoogleAuthProvider` og custom parameter `hd: 'entur.org'`, så man hopper rett inn
på Entur-kontoen i stedet for kontovelgeren.

Logger noen inn med en ikke-Entur-konto, logges de ut umiddelbart med en
forklarende feilmelding. Reglene ville avvist skrivingen uansett, men det er dårlig
UX å oppdage det først når man trykker lagre.

### Innlogget uten tilgang

En gyldig Entur-konto som ikke står i `admins`-allowlisten får en egen skjerm:
hvem man er innlogget som, en forklaring på at kontoen ikke har tilgang til å
legge inn meldinger, og hvem man kan kontakte for å få det. Pluss en logg
ut-knapp.

Dette er en egen tilstand, ikke en feilmelding. Reglene ville avvist skrivingen,
men å oppdage det først når man trykker lagre — etter å ha fylt ut et helt skjema
— er unødvendig frustrerende.

### Innlogget med tilgang

**Liste** over alle meldinger i `@entur/table`, gruppert som Vises nå / Planlagt /
Slått av / Utløpt. Status er selve gruppeoverskriften, ingen egen statuskolonne.
Kolonner: nivå (fargeprikk), tittel, tidsrom, lagt inn av, sist endret av.
Rediger- og slett-knapp per rad. Sletting krever bekreftelse.

**Skjema** for ny eller endret melding:

| Felt | Komponent |
|---|---|
| Tittel | `TextField` |
| Tekst | `TextArea` med tegnteller |
| Nivå | `LevelPicker` (se under) |
| Start | `DatePicker` med `showTime` og `granularity="minute"` |
| Slutt | `DatePicker` med `showTime` og `granularity="minute"`, valgfri |
| Aktiv | `Switch` |

### `LevelPicker`

Fire klikkbare kort side om side, med norsk etikett og hjelpetekst fra
`alertLevels.js`. Hvert kort inneholder en `SmallAlertBox` med sin variant, slik at
farge og ikon kommer fra designsystemet framfor å bli hardkodet — da kan de heller
ikke havne på avvei fra det tavla faktisk viser. Kompakte fargeprøver ved siden av
hverandre, så man kan sammenligne de fire visuelt framfor å velge en enum-verdi.

Under panseret vanlige `radio`-inputs (visuelt skjult, kortene er `<label>`), så
tastaturnavigasjon og skjermleser fungerer uten ekstra arbeid.

### Forhåndsvisning

Under skjemaet står den ekte `BannerAlertBox`-en i full bredde på mørkeblå
bakgrunn, med brukerens egen tittel og tekst i valgt variant. Sammen med
`LevelPicker` gir det både «hvilken farge vil jeg ha» og «hvordan blir dette på
tavla».

### Validering

`validateAlertInput(input)` kjører i skjemaet og speiler Firestore-reglene:
påkrevde felt, maks lengder, gyldig nivå, slutt etter start. Returnerer et objekt
med feilmelding per felt, vist via `FeedbackText` fra `@entur/form`.

## Sikkerhet og personvern

Tavla er en kiosk uten pålogging og må lese meldingene uautentisert. Appen ligger
på et offentlig Firebase Hosting-domene, så **meldingene kan i praksis leses av
hvem som helst som finner URL-en.**

Dette er akseptert, med den begrunnelse at innholdet uansett står på en skjerm i
resepsjonen. Konsekvenser som må følges opp:

- Admin-UI viser en tydelig merknad om at meldinger ikke skal inneholde sensitiv
  eller intern-klassifisert informasjon.
- Samme merknad i README.

Skrivetilgang krever både en verifisert `@entur.org`-konto og en oppføring i
`admins`-allowlisten, og `createdBy` / `updatedBy` gir sporbarhet på hvem som la
inn hva.

## Oppsett utenfor koden

Steg som ingen kode kan gjøre for oss, og som må være på plass før koden virker.
Disse tas med som eksplisitte steg i implementasjonsplanen.

1. **Firestore i GCP-prosjektet — ingenting å gjøre.** Databasen er allerede
   provisjonert av app-factory via `spec.firebase.db_type`-defaulten. Bekreft med
   `yarn firebase firestore:databases:list --project ent-tavleber-prd`.

   **Web-app-registreringen** er opprettet med Firebase-CLI-en, siden manifestet
   ikke dekker den: App ID `1:475486887854:web:eb13c21d24e1fe9df7323f`.

2. **Firebase Authentication.** Skrus på i Firebase-konsollet for
   `ent-tavleber-prd`, med Google som provider, og hosting-domenet lagt inn under
   «Authorized domains». Manuelt engangssteg.

3. **Første allowlist-oppføring.** `admins`-collectionen er tom til noen legger inn
   det første dokumentet. Siden reglene ikke tillater klient-skriving, må dette
   gjøres i Firebase-konsollet: opprett collection `admins`, og et dokument med
   ID-en lik e-postadressen i **små bokstaver** (f.eks.
   `sturle.tolo.nordeide@entur.org`). Feltene `addedBy` og `addedAt` er ren
   dokumentasjon. Uten dette steget kommer ingen inn i admin.

4. **Deploy av reglene.** `firebase.json` utvides med
   `"firestore": { "rules": "firestore.rules" }`, og `.github/workflows/deploy.yml`
   endres til `--only hosting,firestore:rules`.

   Dette krever at CI-tjenestekontoen kan deploye regler. Er den nødvendige
   IAM-rollen ikke på Enturs allowlist, deployer vi reglene manuelt til å begynne
   med framfor å blokkere på en plattformforespørsel.

## Testing

Prosjektet har i dag ingen React-testoppsett — bare `node --test` på
floorplan-transformen. Vi innfører ikke Vitest for denne endringen.

**Automatisk testet** med Nodes innebygde test-runner, samme mønster som
`scripts/floorplan-transform.test.mjs`:

- `selectVisibleAlerts(alerts, now)`
  - melding før `startsAt` vises ikke
  - melding etter `endsAt` vises ikke
  - `endsAt: null` filtreres **ikke** bort
  - `enabled: false` filtreres bort uansett tidsrom
  - sortering når flere nivåer er aktive samtidig
  - sortering på `startsAt` innen samme nivå
  - grensetilfeller: `startsAt == now`, `endsAt == now`
  - tidssone: `Timestamp` konverteres konsistent
- `validateAlertInput(input)`
  - påkrevde felt mangler
  - tittel/tekst over maks lengde
  - ugyldig `level`
  - slutt før eller lik start
  - tom slutt er gyldig

**Manuelt verifisert:**

- `AlertBanner` og admin-skjemaet mot Firestore-emulatoren under utvikling.
- Firestore-reglene i emulatoren: at en ikke-Entur-konto avvises, at feltvalidering
  slår inn, at `updatedBy` ikke kan settes til en annen e-post.

**Bevisst utenfor scope:** automatisk testing av Firestore-reglene med
`@firebase/rules-unit-testing`. Det krever Java og nytt CI-oppsett. Reglene er det
som faktisk beskytter skrivetilgangen, så hvis dette blir et system flere team
lener seg på, bør de testes automatisk. Notert som teknisk gjeld.

## Utenfor scope

- Gjentakende meldinger (f.eks. hver mandag morgen).
- Endringshistorikk utover `createdBy` / `updatedBy`.
- Bilder eller lenker i meldingene.
- Oppgradering av Entur-designsystemet til ny major.
- Roller eller nivåer innenfor admin — allowlisten er binær, du har tilgang eller
  ikke.
- Å administrere allowlisten fra appen. Den styres i Firebase-konsollet med vilje,
  slik at retten til å gi andre tilgang ikke ligger i en klient-app.
- Å skru av *Enable create (sign-up)* i Identity Platform. Vurdert, ikke valgt —
  se «Tilgangsstyring».
