# Varsler (alerts) på tavla — implementasjonsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vise tidsstyrte varsler øverst i det mørkeblå feltet på velkomsttavla, lagret i Firestore, med en admin-side bak Entur-pålogging der man legger dem inn.

**Architecture:** Én Vite-app med to innganger valgt på `location.pathname` i `main.jsx` — tavla på `/`, admin lazy-lastet på `/admin`. All Firestore-tilgang isoleres i `alertsRepository.js`; all logikk som kan gå galt (tidsvindu, sortering, validering, domenesjekk, datokonvertering) ligger i rene moduler uten React eller Firebase, testet med Nodes innebygde test-runner. Sikkerheten ligger i Firestore-reglene, ikke i klienten.

**Tech Stack:** React 19, Vite 8, Firebase 12 (Firestore + Auth), Entur designsystem (pre-major-linja, se Global Constraints), `node --test`.

**Spec:** [`docs/superpowers/specs/2026-07-31-varsler-alert-design.md`](../specs/2026-07-31-varsler-alert-design.md)

## Global Constraints

- **Prosjektet ligger på forrige major av Entur-designsystemet.** Bruk **kun** disse versjonene. Nyere majors krever `@entur/tokens@4` / `@entur/typography@3` / `@entur/icons@10` og vil brekke eksisterende styling:
  - `@entur/alert@0.19.4`
  - `@entur/form@9.3.8`
  - `@entur/button@4.0.11`
  - `@entur/datepicker@11.8.1`
  - `@entur/table@4.10.16`
  - `firebase@12.17.0`
- **Ikke oppgrader** `@entur/tokens`, `@entur/typography`, `@entur/icons`, `@entur/layout`, `@entur/tooltip` eller `@entur/grid`. Utenfor scope.
- **Pakkebehandler er yarn** (`yarn.lock`, `nodeLinker: node-modules`). Bruk `yarn add`, aldri `npm install`.
- **Prosjektet er ren JavaScript/JSX**, ikke TypeScript. Ingen `.ts`/`.tsx`-filer. `package.json` har `"type": "module"` — alle `.js`-filer er ESM.
- **Styling gjøres med inline-styles og Entur-tokens**, ikke Tailwind-klasser, i tråd med resten av kodebasen.
- **Nivåverdiene lagres som Entur-variantnavn:** `'information' | 'success' | 'warning' | 'negative'`. Aldri egne navn, aldri oversettelsestabell mot `BannerAlertBox`.
- **Tester bruker Nodes innebygde test-runner** (`node --test`), samme mønster som `scripts/floorplan-transform.test.mjs`. Ikke innfør Vitest, Jest eller React Testing Library.
- **Testbare moduler importerer ikke Firebase eller React.** `firebase.js` bruker `import.meta.env`, som ikke finnes under `node --test`. Alt som skal testes må ligge i moduler som er frie for slike importer.
- **All tekst mot bruker er på norsk (bokmål).**
- **Firestore-dokumenter i `alerts` er offentlig lesbare.** Meldinger skal ikke inneholde sensitiv eller intern-klassifisert informasjon. Dette skal stå både i admin-UI og i README.
- **Conventional commits** (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).

---

## Avvik fra speccen

Fem steder er planen mer presis enn speccen, etter at API-ene ble verifisert mot
de faktiske pakkene og plattform-manifestet mot `entur/tf-gcp-apps`. Alle er
forbedringer innenfor samme intensjon, men de er listet her så en gjennomgang
ikke må lete etter dem.

0. **Speccen var feil om Firestore-provisjonering, og ingenting skal gjøres.**
   Speccen sa `spec.appEngine` med `databaseType: firestore` i
   `.entur/application.yaml`, og flagget det som et åpent punkt. Feltet hører til
   `GoogleCloudApplication`; Firebase-varianten bruker `spec.firebase.db_type`, som
   defaulter til `firestore`. Firestore i `ent-tavleber-prd` er derfor **allerede
   provisjonert**, og manifestet skal ikke endres. Verifisert med
   `firestore:databases:list`.
1. **Ett dato-og-tid-felt per tidspunkt, ikke to.** Speccen skisserte
   `DatePicker` + `TimePicker`. `DatePicker` har `showTime` og
   `granularity="minute"`, så dato og klokkeslett er samme felt. Halvparten så
   mange felt, samme resultat.
2. **`alertMapper.js` er en ny modul** som ikke står i speccens modultabell.
   `alertsRepository.js` importerer `firebase/firestore` og kan derfor ikke
   testes med `node --test`. Mappingen mellom Firestore-dokument og appens
   objekter er den ene biten der som er verdt å teste, så den ligger for seg.
3. **Reglene er strammere på `createdBy`.** Speccen bandt bare `updatedBy` til
   den innloggede. Planen binder også `createdBy` ved opprettelse, og krever at
   `createdBy` er uendret ved oppdatering. Samme intensjon — sporet kan ikke
   forfalskes — men uten hull.
4. **Fire statusgrupper i admin-listen, ikke tre.** Speccen hadde Aktive /
   Planlagte / Utløpte. Et varsel som ligger innenfor tidsrommet men har
   av-bryteren slått av, hører ikke hjemme under «Aktive» når det ikke vises.
   Det får sin egen gruppe, «Slått av». Status vises dermed som gruppeoverskrift
   framfor som egen kolonne.

---

## Filstruktur

Filer som opprettes eller endres, og hva hver av dem har ansvar for.

### Rene logikk-moduler (ingen React, ingen Firebase — disse er testet)

| Fil | Ansvar |
|---|---|
| `src/alerts/alertLevels.js` | De fire nivåene: verdi, norsk etikett, hjelpetekst, sorteringsvekt |
| `src/alerts/alertSchedule.js` | `alertStatus`, `selectVisibleAlerts`, `groupAlertsByStatus` |
| `src/alerts/alertValidation.js` | `validateAlertInput`, `hasErrors`, maks-lengder |
| `src/alerts/alertMapper.js` | `toAlert` (Firestore-dokument → plain objekt med `Date`), `toFirestoreData` |
| `src/admin/enturAccount.js` | `isEnturUser` — domenesjekken |

### Firebase-lag

| Fil | Ansvar |
|---|---|
| `src/alerts/firebaseConfig.js` | Web-konfigen for `ent-tavleber-prd` |
| `src/alerts/firebase.js` | Initialiserer appen én gang, eksporterer `app` og `db`, kobler til emulator |
| `src/alerts/alertsRepository.js` | Eneste fil som importerer `firebase/firestore` |
| `src/admin/adminAuth.js` | Eneste fil som importerer `firebase/auth` |

### Komponenter

| Fil | Ansvar |
|---|---|
| `src/components/AlertBanner.jsx` | Tavle-visningen: abonnement, reevaluering, stabling |
| `src/components/ErrorBoundary.jsx` | Fanger feil så tavla ikke går ned |
| `src/admin/Admin.jsx` | Rot for admin: pålogging eller innhold |
| `src/admin/LevelPicker.jsx` | Fargeprøve-kortene for nivå |
| `src/admin/AlertForm.jsx` | Skjema + forhåndsvisning |
| `src/admin/AlertList.jsx` | Tabell gruppert på status |
| `src/admin/admin.css` | Admin-only stilimporter og `.level-option`-regler |

### Konfigurasjon

| Fil | Endring |
|---|---|
| `src/main.jsx` | Rute-splitt tavla / admin |
| `src/App.jsx` | `AlertBanner` øverst i `Contrast`, `maxHeight` på feltet |
| `src/css/main.css` | Legg til `@entur/alert/dist/styles.css` |
| `package.json` | Nye avhengigheter, `test`-script |
| `firebase.json` | `firestore.rules`, `emulators` |
| `firestore.rules` | Ny fil |
| `.gitignore` | `.firebase/`, `*-debug.log` |
| `.github/workflows/deploy.yml` | Kjør tester, deploy regler |
| `README.md` | Dokumenter varsler, admin, emulator |

---

## Task 1: Plattform- og prosjektoppsett

Dette er fundamentet alt annet står på: Firestore må eksistere, reglene må være skrevet, og emulatoren må kjøre lokalt så resten av oppgavene kan verifiseres uten å røre produksjon.

**Files:**
- Modify: `package.json`
- Modify: `firebase.json`
- Modify: `.gitignore`
- Modify: `src/css/main.css`
- Create: `firestore.rules`
- Create: `src/alerts/firebaseConfig.js`
- Create: `src/alerts/firebase.js`

**Interfaces:**
- Consumes: ingenting
- Produces:
  - `src/alerts/firebase.js` → `export const app` (FirebaseApp), `export const db` (Firestore)
  - `firestore.rules` — reglene som håndhever validering og skrivetilgang
  - `yarn test` → kjører `node --test`

- [ ] **Step 1: Bekreft at Firestore finnes — ingen manifest-endring**

**Allerede verifisert 2026-07-31: Firestore finnes.** Dette steget er dokumentert
for etterprøvbarhet, ikke arbeid som skal gjøres.

Firestore i `ent-tavleber-prd` er provisjonert av app-factory. `spec.firebase.db_type`
i [`GoogleCloudFirebaseApplication`](https://github.com/entur/tf-gcp-apps/blob/main/docs/manifests/GoogleCloudFirebaseApplication.md)
har default `firestore`, og i plattformens Terraform er `google_firestore_database`
utkommentert — databasen kommer av `google_app_engine_application.database_type`,
som settes fra `db_type`. `.entur/application.yaml` skal derfor **ikke** endres.

(Feltet `spec.appEngine` hører til `GoogleCloudApplication`, ikke Firebase-varianten.
Ikke legg det inn her.)

Bekreft med:

```bash
yarn firebase firestore:databases:list --project ent-tavleber-prd
```

Expected: én rad, `projects/ent-tavleber-prd/databases/(default)`, type `FIRESTORE_NATIVE`.

- [ ] **Step 2: Manuelt steg — skru på Firebase Authentication**

I Firebase-konsollet for prosjektet `ent-tavleber-prd`:

1. **Authentication → Get started → Sign-in method → Google → Enable.**
2. Under **Authentication → Settings → Authorized domains**, kontroller at hosting-domenet (`ent-tavleber-prd.web.app` og `ent-tavleber-prd.firebaseapp.com`) står der. `localhost` ligger der som standard.

- [ ] **Step 3: Web-appen er allerede registrert**

**Allerede gjort 2026-07-31.** Dokumentert for etterprøvbarhet.

Prosjektet hadde ingen web-app. Web-app-registreringen ligger utenfor
app-factory — plattformens Terraform har `google_firebase_project`,
`google_firebase_storage_bucket` og storage-regler, men ingen
`google_firebase_web_app` — så den opprettes med Firebase-CLI-en:

```bash
yarn firebase apps:create WEB "Velkomsttavle Bergen" --project ent-tavleber-prd
```

Resultat: App ID `1:475486887854:web:eb13c21d24e1fe9df7323f`.

Konfigen hentes med:

```bash
yarn firebase apps:sdkconfig WEB 1:475486887854:web:eb13c21d24e1fe9df7323f --project ent-tavleber-prd
```

- [ ] **Step 4: Legg inn konfigen**

Create `src/alerts/firebaseConfig.js`. Dette er de **ekte** verdiene fra
`apps:sdkconfig` — skriv dem av nøyaktig:

```js
// Firebase-web-konfigen er offentlig informasjon by design: den havner i
// klient-bundelen uansett, og apiKey er en prosjekt-identifikator, ikke en
// hemmelighet. Sikkerheten ligger i firestore.rules.
export const firebaseConfig = {
    apiKey: 'AIzaSyC1LfyEG-0OdpSQylKPbwz3AC2UM4_wL9s',
    authDomain: 'ent-tavleber-prd.firebaseapp.com',
    projectId: 'ent-tavleber-prd',
    storageBucket: 'ent-tavleber-prd.appspot.com',
    messagingSenderId: '475486887854',
    appId: '1:475486887854:web:eb13c21d24e1fe9df7323f',
};
```

- [ ] **Step 5: Installer avhengigheter**

```bash
yarn add firebase@12.17.0 @entur/alert@0.19.4 @entur/form@9.3.8 @entur/button@4.0.11 @entur/datepicker@11.8.1 @entur/table@4.10.16
```

Kontroller etterpå at `yarn.lock` **ikke** har fått inn `@entur/tokens@4`, `@entur/typography@3` eller `@entur/icons@10`:

```bash
grep -nE '"@entur/(tokens|typography|icons)@' yarn.lock | grep -vE '@\^?[39]\.'
```

Forventet: ingen treff på `tokens@4`, `typography@3` eller `icons@10`. Får du treff, er en pakkeversjon feil — gå tilbake til versjonslista i Global Constraints.

- [ ] **Step 6: Legg til test-script**

Modify `package.json` — legg `test` inn i `scripts`:

```json
"test": "node --test"
```

Nodes test-runner finner `**/*.test.{js,mjs}` rekursivt og hopper over `node_modules` av seg selv. Den plukker dermed også opp den eksisterende `scripts/floorplan-transform.test.mjs`.

- [ ] **Step 7: Verifiser at eksisterende tester fortsatt går**

Run: `yarn test`
Expected: PASS — floorplan-transform-testene kjører grønt.

- [ ] **Step 8: Legg til alert-stilene**

Modify `src/css/main.css` — legg til denne linja blant de andre importene:

```css
@import '@entur/alert/dist/styles.css';
```

Kun alert-stilene hører hjemme her. `form`, `datepicker` og `table` brukes bare av admin og importeres i `src/admin/admin.css` (Task 6), slik at kiosken ikke laster CSS den ikke bruker.

- [ ] **Step 9: Skriv Firestore-reglene**

Create `firestore.rules`:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isEnturUser() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email.matches('.*@entur[.]org$');
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
      // Tavla er en kiosk uten pålogging og må kunne lese uautentisert.
      // Konsekvens: meldingene er offentlig lesbare. Se speccen.
      allow read: if true;

      allow create: if isEnturUser()
        && isValidAlert(request.resource.data)
        && request.resource.data.createdBy == request.auth.token.email
        && request.resource.data.updatedBy == request.auth.token.email;

      allow update: if isEnturUser()
        && isValidAlert(request.resource.data)
        && request.resource.data.updatedBy == request.auth.token.email
        && request.resource.data.createdBy == resource.data.createdBy;

      allow delete: if isEnturUser();
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Tre ting reglene gjør utover å låse skriving til `@entur.org`: de validerer feltene så et ugyldig dokument ikke kan velte tavla, de binder `createdBy`/`updatedBy` til den innloggede så sporet ikke kan forfalskes, og de stenger alt utenfor `alerts`.

- [ ] **Step 10: Koble reglene og emulatoren til firebase.json**

Modify `firebase.json` — behold `hosting`-blokka uendret og legg til to nye toppnivå-nøkler:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(mp4)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      }
    ]
  },
  "firestore": {
    "rules": "firestore.rules"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": true, "port": 4000 },
    "singleProjectMode": true
  }
}
```

- [ ] **Step 11: Utvid .gitignore**

Modify `.gitignore` — legg til på slutten:

```
# Firebase
.firebase/
*-debug.log
```

- [ ] **Step 12: Verifiser at reglene kompilerer og emulatoren starter**

Firestore-emulatoren krever Java 11+. Sjekk med `java -version`; mangler den, installer via `brew install openjdk`.

Run: `yarn firebase emulators:start --only auth,firestore --project ent-tavleber-prd`
Expected: emulatoren starter, logger `✔  firestore: Firestore Emulator UI websocket is running`, og **ingen** feil om `firestore.rules`. Har reglene syntaksfeil, sier den det eksplisitt med linjenummer.

La emulatoren stå — den brukes i senere oppgaver. Stopp med `Ctrl+C`.

- [ ] **Step 13: Initialiser Firebase i appen**

Create `src/alerts/firebase.js`:

```js
import { initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig.js';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Opt-in, ikke automatisk i dev: da må man be om emulatoren eksplisitt,
// og man blir ikke overrasket over at lokale endringer treffer produksjon.
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
```

- [ ] **Step 14: Verifiser at appen fortsatt bygger**

Run: `yarn build`
Expected: bygget går gjennom. `firebase.js` er ennå ikke importert av noe, så den blir tree-shaket bort — poenget her er at avhengighetene er installert riktig og at ingenting er brekt.

- [ ] **Step 15: Commit**

```bash
git add package.json yarn.lock firebase.json firestore.rules .gitignore src/css/main.css src/alerts/firebaseConfig.js src/alerts/firebase.js
git commit -m "chore: sett opp Firestore, sikkerhetsregler og emulator"
```

---

## Task 2: Nivåer og tidsvindu-logikk

Hjertet i funksjonaliteten: hvilke varsler skal vises akkurat nå, og i hvilken rekkefølge. Ren logikk, TDD, ingen React og ingen Firebase.

**Files:**
- Create: `src/alerts/alertLevels.js`
- Create: `src/alerts/alertSchedule.js`
- Test: `src/alerts/alertSchedule.test.mjs`

**Interfaces:**
- Consumes: ingenting
- Produces:
  - `ALERT_LEVELS: Array<{ level: string, label: string, help: string, weight: number }>` — sortert med alvorligste først
  - `ALERT_LEVEL_VALUES: string[]`
  - `levelWeight(level: string): number`
  - `alertStatus(alert: Alert, now: Date): 'expired' | 'disabled' | 'planned' | 'visible'`
  - `selectVisibleAlerts(alerts: Alert[], now: Date): Alert[]`
  - `groupAlertsByStatus(alerts: Alert[], now: Date): { visible: Alert[], planned: Alert[], disabled: Alert[], expired: Alert[] }`

Der `Alert` er `{ id, title, body, level, startsAt: Date, endsAt: Date|null, enabled: boolean, createdBy, updatedBy }`.

**Semantikk som må ligge fast:** tidsrommet er halvåpent, `[startsAt, endsAt)`. Et varsel med `startsAt === now` **vises**; et med `endsAt === now` vises **ikke**. `endsAt: null` betyr åpen slutt og utløper aldri.

- [ ] **Step 1: Skriv nivå-modulen**

Denne er rene data og trenger ingen egen test — den testes indirekte gjennom sorteringen i `alertSchedule`.

Create `src/alerts/alertLevels.js`:

```js
/**
 * De fire varselnivåene, sortert med alvorligste først.
 *
 * `level` er Entur-designsystemets variantnavn, lagret som det er i Firestore,
 * slik at verdien kan sendes rett inn i <BannerAlertBox variant={...}> uten
 * oversettelsestabell.
 */
export const ALERT_LEVELS = [
    {
        level: 'negative',
        label: 'Kritisk',
        help: 'Noe galt som krever handling nå',
        weight: 0,
    },
    {
        level: 'warning',
        label: 'Advarsel',
        help: 'Noe man bør merke seg — heis ute av drift, endret åpningstid',
        weight: 1,
    },
    {
        level: 'information',
        label: 'Informasjon',
        help: 'Nyttig beskjed, ikke noe man må reagere på',
        weight: 2,
    },
    {
        level: 'success',
        label: 'Positivt',
        help: 'Noe er i orden igjen, eller en god nyhet',
        weight: 3,
    },
];

export const ALERT_LEVEL_VALUES = ALERT_LEVELS.map((entry) => entry.level);

export function levelLabel(level) {
    const entry = ALERT_LEVELS.find((candidate) => candidate.level === level);
    return entry ? entry.label : level;
}

/** Ukjente nivåer havner sist, slik at et rart dokument ikke tar toppplassen. */
export function levelWeight(level) {
    const entry = ALERT_LEVELS.find((candidate) => candidate.level === level);
    return entry ? entry.weight : Number.MAX_SAFE_INTEGER;
}
```

- [ ] **Step 2: Skriv de failende testene**

Create `src/alerts/alertSchedule.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    alertStatus,
    groupAlertsByStatus,
    selectVisibleAlerts,
} from './alertSchedule.js';

const NOW = new Date('2026-08-03T10:00:00Z');

function alert(overrides = {}) {
    return {
        id: 'a1',
        title: 'Tittel',
        body: 'Tekst',
        level: 'information',
        startsAt: new Date('2026-08-03T08:00:00Z'),
        endsAt: null,
        enabled: true,
        ...overrides,
    };
}

describe('alertStatus', () => {
    it('er visible innenfor tidsrommet', () => {
        assert.equal(alertStatus(alert(), NOW), 'visible');
    });

    it('er planned før startsAt', () => {
        const future = alert({ startsAt: new Date('2026-08-03T12:00:00Z') });
        assert.equal(alertStatus(future, NOW), 'planned');
    });

    it('er expired når endsAt har passert', () => {
        const past = alert({ endsAt: new Date('2026-08-03T09:00:00Z') });
        assert.equal(alertStatus(past, NOW), 'expired');
    });

    it('er disabled når bryteren er av, selv innenfor tidsrommet', () => {
        assert.equal(alertStatus(alert({ enabled: false }), NOW), 'disabled');
    });

    it('er expired framfor disabled når begge gjelder', () => {
        const both = alert({
            enabled: false,
            endsAt: new Date('2026-08-03T09:00:00Z'),
        });
        assert.equal(alertStatus(both, NOW), 'expired');
    });

    it('regner startsAt lik now som visible', () => {
        assert.equal(alertStatus(alert({ startsAt: NOW }), NOW), 'visible');
    });

    it('regner endsAt lik now som expired', () => {
        assert.equal(alertStatus(alert({ endsAt: NOW }), NOW), 'expired');
    });

    it('behandler manglende startsAt som expired framfor å krasje', () => {
        assert.equal(alertStatus(alert({ startsAt: null }), NOW), 'expired');
    });
});

describe('selectVisibleAlerts', () => {
    it('slipper gjennom varsel med åpen slutt', () => {
        const result = selectVisibleAlerts([alert({ endsAt: null })], NOW);
        assert.equal(result.length, 1);
    });

    it('filtrerer bort avslåtte varsler', () => {
        const result = selectVisibleAlerts([alert({ enabled: false })], NOW);
        assert.deepEqual(result, []);
    });

    it('filtrerer bort varsler som ikke har startet', () => {
        const future = alert({ startsAt: new Date('2026-08-03T12:00:00Z') });
        assert.deepEqual(selectVisibleAlerts([future], NOW), []);
    });

    it('filtrerer bort utløpte varsler', () => {
        const past = alert({ endsAt: new Date('2026-08-03T09:00:00Z') });
        assert.deepEqual(selectVisibleAlerts([past], NOW), []);
    });

    it('sorterer alvorligste nivå først', () => {
        const alerts = [
            alert({ id: 'info', level: 'information' }),
            alert({ id: 'ok', level: 'success' }),
            alert({ id: 'krit', level: 'negative' }),
            alert({ id: 'adv', level: 'warning' }),
        ];
        const order = selectVisibleAlerts(alerts, NOW).map((a) => a.id);
        assert.deepEqual(order, ['krit', 'adv', 'info', 'ok']);
    });

    it('sorterer nyeste først innenfor samme nivå', () => {
        const alerts = [
            alert({ id: 'gammel', startsAt: new Date('2026-08-01T08:00:00Z') }),
            alert({ id: 'ny', startsAt: new Date('2026-08-03T09:00:00Z') }),
        ];
        const order = selectVisibleAlerts(alerts, NOW).map((a) => a.id);
        assert.deepEqual(order, ['ny', 'gammel']);
    });

    it('sorterer et ukjent nivå sist framfor å krasje', () => {
        const alerts = [
            alert({ id: 'rart', level: 'ukjent-fra-framtida' }),
            alert({ id: 'info', level: 'information' }),
        ];
        const order = selectVisibleAlerts(alerts, NOW).map((a) => a.id);
        assert.deepEqual(order, ['info', 'rart']);
    });

    it('endrer ikke lista den får inn', () => {
        const alerts = [
            alert({ id: 'ok', level: 'success' }),
            alert({ id: 'krit', level: 'negative' }),
        ];
        selectVisibleAlerts(alerts, NOW);
        assert.deepEqual(alerts.map((a) => a.id), ['ok', 'krit']);
    });

    it('tåler tom liste', () => {
        assert.deepEqual(selectVisibleAlerts([], NOW), []);
    });
});

describe('groupAlertsByStatus', () => {
    it('fordeler varsler på de fire gruppene', () => {
        const alerts = [
            alert({ id: 'naa' }),
            alert({ id: 'senere', startsAt: new Date('2026-08-04T08:00:00Z') }),
            alert({ id: 'av', enabled: false }),
            alert({ id: 'ferdig', endsAt: new Date('2026-08-02T08:00:00Z') }),
        ];
        const groups = groupAlertsByStatus(alerts, NOW);
        assert.deepEqual(groups.visible.map((a) => a.id), ['naa']);
        assert.deepEqual(groups.planned.map((a) => a.id), ['senere']);
        assert.deepEqual(groups.disabled.map((a) => a.id), ['av']);
        assert.deepEqual(groups.expired.map((a) => a.id), ['ferdig']);
    });

    it('gir tomme grupper for tom liste', () => {
        const groups = groupAlertsByStatus([], NOW);
        assert.deepEqual(groups, {
            visible: [],
            planned: [],
            disabled: [],
            expired: [],
        });
    });

    it('sorterer innenfor hver gruppe', () => {
        const alerts = [
            alert({ id: 'ok', level: 'success' }),
            alert({ id: 'krit', level: 'negative' }),
        ];
        const groups = groupAlertsByStatus(alerts, NOW);
        assert.deepEqual(groups.visible.map((a) => a.id), ['krit', 'ok']);
    });
});
```

- [ ] **Step 3: Kjør testene for å se at de feiler**

Run: `yarn test`
Expected: FAIL — `Cannot find module '.../src/alerts/alertSchedule.js'`.

- [ ] **Step 4: Skriv implementasjonen**

Create `src/alerts/alertSchedule.js`:

```js
import { levelWeight } from './alertLevels.js';

/**
 * Statusen til et varsel på et gitt tidspunkt.
 *
 * Tidsrommet er halvåpent, [startsAt, endsAt): et varsel med startsAt lik now
 * vises, et med endsAt lik now gjør det ikke. endsAt === null betyr åpen slutt.
 *
 * Rekkefølgen på sjekkene er meningsbærende: utløpt slår av-bryteren, fordi et
 * varsel som er ferdig er ferdig uansett om bryteren står på.
 */
export function alertStatus(alert, now) {
    const startsAt = timeOf(alert.startsAt);
    if (startsAt === null) {
        // Et dokument uten gyldig starttid kan vi ikke tidfeste. Regn det som
        // ferdig framfor å vise noe vi ikke vet rekkevidden av.
        return 'expired';
    }

    const endsAt = timeOf(alert.endsAt);
    if (endsAt !== null && endsAt <= now.getTime()) {
        return 'expired';
    }
    if (alert.enabled !== true) {
        return 'disabled';
    }
    if (startsAt > now.getTime()) {
        return 'planned';
    }
    return 'visible';
}

/** Varslene som skal stå på tavla nå, alvorligste og nyeste først. */
export function selectVisibleAlerts(alerts, now) {
    return alerts
        .filter((alert) => alertStatus(alert, now) === 'visible')
        .sort(compareAlerts);
}

/** Alle varsler fordelt på status, for admin-listen. */
export function groupAlertsByStatus(alerts, now) {
    const groups = { visible: [], planned: [], disabled: [], expired: [] };
    for (const alert of alerts) {
        groups[alertStatus(alert, now)].push(alert);
    }
    for (const key of Object.keys(groups)) {
        groups[key].sort(compareAlerts);
    }
    return groups;
}

function compareAlerts(a, b) {
    const byLevel = levelWeight(a.level) - levelWeight(b.level);
    if (byLevel !== 0) {
        return byLevel;
    }
    return (timeOf(b.startsAt) ?? 0) - (timeOf(a.startsAt) ?? 0);
}

function timeOf(value) {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        return null;
    }
    return value.getTime();
}
```

`filter` gir en ny liste, så `.sort` rører ikke inndataene — det er testet eksplisitt fordi det ellers er lett å ødelegge senere.

- [ ] **Step 5: Kjør testene for å se at de passerer**

Run: `yarn test`
Expected: PASS — alle testene i `alertSchedule.test.mjs`, pluss de eksisterende floorplan-testene.

- [ ] **Step 6: Commit**

```bash
git add src/alerts/alertLevels.js src/alerts/alertSchedule.js src/alerts/alertSchedule.test.mjs
git commit -m "feat: legg til nivåer og tidsvindu-logikk for varsler"
```

---

## Task 3: Validering og Firestore-mapping

To rene moduler til: valideringen som skjemaet bruker, og oversettelsen mellom Firestore-dokumenter og appens egne objekter. Mappingen ligger i egen fil nettopp fordi `alertsRepository.js` importerer `firebase/firestore` og dermed ikke kan testes under `node --test`.

**Files:**
- Create: `src/alerts/alertValidation.js`
- Create: `src/alerts/alertMapper.js`
- Test: `src/alerts/alertValidation.test.mjs`
- Test: `src/alerts/alertMapper.test.mjs`

**Interfaces:**
- Consumes: `ALERT_LEVEL_VALUES` fra `alertLevels.js`
- Produces:
  - `TITLE_MAX_LENGTH: 80`, `BODY_MAX_LENGTH: 400`
  - `validateAlertInput(input): Record<string, string>` — feilmelding per feltnavn, tomt objekt betyr gyldig
  - `hasErrors(errors): boolean`
  - `toAlert(id, data): Alert` — `data` er et Firestore-dokument der tidsfelt har `.toDate()`
  - `toFirestoreData(input, userEmail): object` — uten `createdAt`/`updatedAt`, dem setter repositoryet

- [ ] **Step 1: Skriv de failende valideringstestene**

Create `src/alerts/alertValidation.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    BODY_MAX_LENGTH,
    TITLE_MAX_LENGTH,
    hasErrors,
    validateAlertInput,
} from './alertValidation.js';

function input(overrides = {}) {
    return {
        title: 'Heisen er ute av drift',
        body: 'Bruk trappa i mellomtiden.',
        level: 'warning',
        startsAt: new Date('2026-08-03T08:00:00Z'),
        endsAt: new Date('2026-08-04T08:00:00Z'),
        enabled: true,
        ...overrides,
    };
}

describe('validateAlertInput', () => {
    it('godtar en fullt utfylt melding', () => {
        assert.deepEqual(validateAlertInput(input()), {});
    });

    it('godtar tom slutt', () => {
        assert.deepEqual(validateAlertInput(input({ endsAt: null })), {});
    });

    it('krever tittel', () => {
        const errors = validateAlertInput(input({ title: '   ' }));
        assert.equal(errors.title, 'Tittel er påkrevd');
    });

    it('krever tekst', () => {
        const errors = validateAlertInput(input({ body: '' }));
        assert.equal(errors.body, 'Tekst er påkrevd');
    });

    it('avviser for lang tittel', () => {
        const errors = validateAlertInput(input({ title: 'a'.repeat(TITLE_MAX_LENGTH + 1) }));
        assert.equal(errors.title, `Tittel kan være maks ${TITLE_MAX_LENGTH} tegn`);
    });

    it('godtar tittel på nøyaktig maks lengde', () => {
        const errors = validateAlertInput(input({ title: 'a'.repeat(TITLE_MAX_LENGTH) }));
        assert.equal(errors.title, undefined);
    });

    it('avviser for lang tekst', () => {
        const errors = validateAlertInput(input({ body: 'a'.repeat(BODY_MAX_LENGTH + 1) }));
        assert.equal(errors.body, `Tekst kan være maks ${BODY_MAX_LENGTH} tegn`);
    });

    it('avviser ukjent nivå', () => {
        const errors = validateAlertInput(input({ level: 'katastrofe' }));
        assert.equal(errors.level, 'Velg et nivå');
    });

    it('krever starttidspunkt', () => {
        const errors = validateAlertInput(input({ startsAt: null }));
        assert.equal(errors.startsAt, 'Starttidspunkt er påkrevd');
    });

    it('avviser ugyldig dato som starttidspunkt', () => {
        const errors = validateAlertInput(input({ startsAt: new Date('tull') }));
        assert.equal(errors.startsAt, 'Starttidspunkt er påkrevd');
    });

    it('avviser slutt før start', () => {
        const errors = validateAlertInput(input({
            startsAt: new Date('2026-08-04T08:00:00Z'),
            endsAt: new Date('2026-08-03T08:00:00Z'),
        }));
        assert.equal(errors.endsAt, 'Slutt må være etter start');
    });

    it('avviser slutt lik start', () => {
        const same = new Date('2026-08-03T08:00:00Z');
        const errors = validateAlertInput(input({ startsAt: same, endsAt: same }));
        assert.equal(errors.endsAt, 'Slutt må være etter start');
    });

    it('klager ikke på rekkefølgen når start allerede er ugyldig', () => {
        const errors = validateAlertInput(input({ startsAt: null }));
        assert.equal(errors.endsAt, undefined);
    });

    it('tåler et tomt objekt', () => {
        const errors = validateAlertInput({});
        assert.equal(errors.title, 'Tittel er påkrevd');
        assert.equal(errors.body, 'Tekst er påkrevd');
        assert.equal(errors.level, 'Velg et nivå');
        assert.equal(errors.startsAt, 'Starttidspunkt er påkrevd');
    });
});

describe('hasErrors', () => {
    it('er false for tomt objekt', () => {
        assert.equal(hasErrors({}), false);
    });

    it('er true når det finnes en feil', () => {
        assert.equal(hasErrors({ title: 'Tittel er påkrevd' }), true);
    });
});
```

- [ ] **Step 2: Kjør testene for å se at de feiler**

Run: `yarn test`
Expected: FAIL — `Cannot find module '.../src/alerts/alertValidation.js'`.

- [ ] **Step 3: Skriv valideringen**

Create `src/alerts/alertValidation.js`:

```js
import { ALERT_LEVEL_VALUES } from './alertLevels.js';

export const TITLE_MAX_LENGTH = 80;
export const BODY_MAX_LENGTH = 400;

/**
 * Validerer skjemainnholdet før lagring.
 *
 * Speiler firestore.rules med vilje: her ligger den gode feilmeldingen,
 * der ligger håndhevingen. Endrer du grensene her, endre dem der også.
 *
 * Returnerer et objekt med feilmelding per feltnavn. Tomt objekt = gyldig.
 */
export function validateAlertInput(input) {
    const errors = {};

    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (title.length === 0) {
        errors.title = 'Tittel er påkrevd';
    } else if (title.length > TITLE_MAX_LENGTH) {
        errors.title = `Tittel kan være maks ${TITLE_MAX_LENGTH} tegn`;
    }

    const body = typeof input.body === 'string' ? input.body.trim() : '';
    if (body.length === 0) {
        errors.body = 'Tekst er påkrevd';
    } else if (body.length > BODY_MAX_LENGTH) {
        errors.body = `Tekst kan være maks ${BODY_MAX_LENGTH} tegn`;
    }

    if (!ALERT_LEVEL_VALUES.includes(input.level)) {
        errors.level = 'Velg et nivå';
    }

    if (!isUsableDate(input.startsAt)) {
        errors.startsAt = 'Starttidspunkt er påkrevd';
    }

    if (input.endsAt != null) {
        if (!isUsableDate(input.endsAt)) {
            errors.endsAt = 'Sluttidspunktet er ugyldig';
        } else if (!errors.startsAt && input.endsAt.getTime() <= input.startsAt.getTime()) {
            errors.endsAt = 'Slutt må være etter start';
        }
    }

    return errors;
}

export function hasErrors(errors) {
    return Object.keys(errors).length > 0;
}

function isUsableDate(value) {
    return value instanceof Date && !Number.isNaN(value.getTime());
}
```

- [ ] **Step 4: Kjør testene for å se at de passerer**

Run: `yarn test`
Expected: PASS.

- [ ] **Step 5: Skriv de failende mapper-testene**

Create `src/alerts/alertMapper.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toAlert, toFirestoreData } from './alertMapper.js';

/** Etterlikner en Firestore-Timestamp: alt vi bruker er .toDate(). */
function timestamp(iso) {
    return { toDate: () => new Date(iso) };
}

describe('toAlert', () => {
    it('gjør Timestamp om til Date', () => {
        const alert = toAlert('abc', {
            title: 'Tittel',
            body: 'Tekst',
            level: 'warning',
            startsAt: timestamp('2026-08-03T08:00:00Z'),
            endsAt: timestamp('2026-08-04T08:00:00Z'),
            enabled: true,
            createdBy: 'a@entur.org',
            updatedBy: 'b@entur.org',
        });

        assert.equal(alert.id, 'abc');
        assert.ok(alert.startsAt instanceof Date);
        assert.equal(alert.startsAt.toISOString(), '2026-08-03T08:00:00.000Z');
        assert.equal(alert.endsAt.toISOString(), '2026-08-04T08:00:00.000Z');
        assert.equal(alert.enabled, true);
        assert.equal(alert.createdBy, 'a@entur.org');
        assert.equal(alert.updatedBy, 'b@entur.org');
    });

    it('beholder null som endsAt', () => {
        const alert = toAlert('abc', {
            title: 'Tittel',
            body: 'Tekst',
            level: 'information',
            startsAt: timestamp('2026-08-03T08:00:00Z'),
            endsAt: null,
            enabled: true,
        });
        assert.equal(alert.endsAt, null);
    });

    it('gir null når startsAt mangler framfor å krasje', () => {
        const alert = toAlert('abc', { title: 'T', body: 'B', level: 'information' });
        assert.equal(alert.startsAt, null);
        assert.equal(alert.endsAt, null);
    });

    it('regner alt annet enn true som avslått', () => {
        const alert = toAlert('abc', {
            title: 'T',
            body: 'B',
            level: 'information',
            startsAt: timestamp('2026-08-03T08:00:00Z'),
            enabled: 'ja',
        });
        assert.equal(alert.enabled, false);
    });

    it('fyller inn tomme strenger for manglende tekstfelt', () => {
        const alert = toAlert('abc', { startsAt: timestamp('2026-08-03T08:00:00Z') });
        assert.equal(alert.title, '');
        assert.equal(alert.body, '');
        assert.equal(alert.createdBy, '');
        assert.equal(alert.updatedBy, '');
    });
});

describe('toFirestoreData', () => {
    const input = {
        title: '  Heisen er ute av drift  ',
        body: '  Bruk trappa.  ',
        level: 'warning',
        startsAt: new Date('2026-08-03T08:00:00Z'),
        endsAt: new Date('2026-08-04T08:00:00Z'),
        enabled: true,
    };

    it('trimmer tittel og tekst', () => {
        const data = toFirestoreData(input, 'a@entur.org');
        assert.equal(data.title, 'Heisen er ute av drift');
        assert.equal(data.body, 'Bruk trappa.');
    });

    it('setter updatedBy til den innloggede', () => {
        const data = toFirestoreData(input, 'a@entur.org');
        assert.equal(data.updatedBy, 'a@entur.org');
    });

    it('sender Date-objekter videre urørt', () => {
        const data = toFirestoreData(input, 'a@entur.org');
        assert.ok(data.startsAt instanceof Date);
        assert.equal(data.startsAt.toISOString(), '2026-08-03T08:00:00.000Z');
    });

    it('skriver null når slutt mangler', () => {
        const data = toFirestoreData({ ...input, endsAt: undefined }, 'a@entur.org');
        assert.equal(data.endsAt, null);
    });

    it('tar ikke med id, createdAt eller updatedAt', () => {
        const data = toFirestoreData({ ...input, id: 'abc' }, 'a@entur.org');
        assert.equal(data.id, undefined);
        assert.equal(data.createdAt, undefined);
        assert.equal(data.updatedAt, undefined);
    });
});
```

- [ ] **Step 6: Kjør testene for å se at de feiler**

Run: `yarn test`
Expected: FAIL — `Cannot find module '.../src/alerts/alertMapper.js'`.

- [ ] **Step 7: Skriv mapperen**

Create `src/alerts/alertMapper.js`:

```js
/**
 * Oversettelsen mellom Firestore-dokumenter og appens egne objekter.
 *
 * Ligger i egen fil, uten Firebase-importer, slik at den kan testes med
 * `node --test`. Resten av appen jobber med JS-Date, ikke Firestore-Timestamp.
 */

/** Firestore-dokument → varsel med Date-felt. Tåler dokumenter med hull i. */
export function toAlert(id, data) {
    return {
        id,
        title: typeof data.title === 'string' ? data.title : '',
        body: typeof data.body === 'string' ? data.body : '',
        level: typeof data.level === 'string' ? data.level : 'information',
        startsAt: toDate(data.startsAt),
        endsAt: toDate(data.endsAt),
        enabled: data.enabled === true,
        createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
        updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
    };
}

/**
 * Skjemainnhold → felt som skrives til Firestore.
 *
 * createdAt/updatedAt settes av repositoryet med serverTimestamp(), og id er
 * dokumentnøkkelen, ikke et felt. Firestore-SDK-en gjør Date om til Timestamp
 * selv, så vi sender Date-objektene rett videre.
 */
export function toFirestoreData(input, userEmail) {
    return {
        title: input.title.trim(),
        body: input.body.trim(),
        level: input.level,
        startsAt: input.startsAt,
        endsAt: input.endsAt ?? null,
        enabled: input.enabled === true,
        updatedBy: userEmail,
    };
}

function toDate(value) {
    if (value && typeof value.toDate === 'function') {
        return value.toDate();
    }
    return value instanceof Date ? value : null;
}
```

- [ ] **Step 8: Kjør testene for å se at de passerer**

Run: `yarn test`
Expected: PASS — alle tre testfilene pluss floorplan-testene.

- [ ] **Step 9: Commit**

```bash
git add src/alerts/alertValidation.js src/alerts/alertValidation.test.mjs src/alerts/alertMapper.js src/alerts/alertMapper.test.mjs
git commit -m "feat: legg til validering og Firestore-mapping for varsler"
```

---

## Task 4: Firestore-repository

Eneste fil i prosjektet som snakker med `firebase/firestore`. Ingen automatisk test — den er nesten bare SDK-kall, og logikken er allerede testet i Task 2 og 3. Verifiseres mot emulatoren.

**Files:**
- Create: `src/alerts/alertsRepository.js`

**Interfaces:**
- Consumes: `db` fra `firebase.js`, `toAlert`/`toFirestoreData` fra `alertMapper.js`
- Produces:
  - `subscribeToEnabledAlerts(onAlerts: (Alert[]) => void, onError: (Error) => void): () => void`
  - `subscribeToAllAlerts(onAlerts: (Alert[]) => void, onError: (Error) => void): () => void`
  - `saveAlert(input, userEmail): Promise<string>` — oppretter når `input.id` mangler, oppdaterer ellers
  - `deleteAlert(id: string): Promise<void>`

Begge `subscribe`-funksjonene returnerer unsubscribe-funksjonen fra `onSnapshot`, slik at de kan returneres rett fra en `useEffect`.

- [ ] **Step 1: Skriv repositoryet**

Create `src/alerts/alertsRepository.js`:

```js
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';

import { db } from './firebase.js';
import { toAlert, toFirestoreData } from './alertMapper.js';

const COLLECTION = 'alerts';

/**
 * Tavla: bare varsler som er slått på. Tidsvindu-filtreringen skjer i
 * klienten, se selectVisibleAlerts — Firestore kan ikke range-filtrere på
 * både startsAt og endsAt i samme spørring uten sammensatt indeks, og vi må
 * reevaluere når klokka passerer et start- eller sluttpunkt uansett.
 */
export function subscribeToEnabledAlerts(onAlerts, onError) {
    const enabledAlerts = query(collection(db, COLLECTION), where('enabled', '==', true));
    return onSnapshot(enabledAlerts, (snapshot) => onAlerts(mapSnapshot(snapshot)), onError);
}

/** Admin: alt, uansett status. */
export function subscribeToAllAlerts(onAlerts, onError) {
    return onSnapshot(
        collection(db, COLLECTION),
        (snapshot) => onAlerts(mapSnapshot(snapshot)),
        onError,
    );
}

/** Oppretter når input.id mangler, oppdaterer ellers. Returnerer dokument-id. */
export async function saveAlert(input, userEmail) {
    const data = {
        ...toFirestoreData(input, userEmail),
        updatedAt: serverTimestamp(),
    };

    if (input.id) {
        await updateDoc(doc(db, COLLECTION, input.id), data);
        return input.id;
    }

    const created = await addDoc(collection(db, COLLECTION), {
        ...data,
        createdAt: serverTimestamp(),
        createdBy: userEmail,
    });
    return created.id;
}

export function deleteAlert(id) {
    return deleteDoc(doc(db, COLLECTION, id));
}

function mapSnapshot(snapshot) {
    return snapshot.docs.map((document) => toAlert(document.id, document.data()));
}
```

- [ ] **Step 2: Verifiser at bygget går**

Run: `yarn build`
Expected: bygget går gjennom uten importfeil.

- [ ] **Step 3: Commit**

```bash
git add src/alerts/alertsRepository.js
git commit -m "feat: legg til Firestore-repository for varsler"
```

---

## Task 5: Vis varsler på tavla

Her blir funksjonaliteten synlig. Etter denne oppgaven kan man legge et dokument inn i emulatoren og se det på tavla.

**Files:**
- Create: `src/components/ErrorBoundary.jsx`
- Create: `src/components/AlertBanner.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `subscribeToEnabledAlerts` fra `alertsRepository.js`, `selectVisibleAlerts` fra `alertSchedule.js`
- Produces: `<AlertBanner />` (default export), `<ErrorBoundary>` (default export, prop `children`)

- [ ] **Step 1: Skriv error boundary-en**

Create `src/components/ErrorBoundary.jsx`:

```jsx
import React from 'react';

/**
 * Skjuler innholdet sitt hvis det kaster, i stedet for å ta ned hele treet.
 *
 * Tavla står i resepsjonen og skal aldri bli svart fordi varselvisningen
 * feiler. Video, hilsen og karusell er upåvirket.
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { failed: false };
    }

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error) {
        console.error('Varselvisningen feilet og er skjult', error);
    }

    render() {
        return this.state.failed ? null : this.props.children;
    }
}

export default ErrorBoundary;
```

- [ ] **Step 2: Skriv AlertBanner**

Create `src/components/AlertBanner.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { BannerAlertBox } from '@entur/alert';

import { subscribeToEnabledAlerts } from '../alerts/alertsRepository';
import { selectVisibleAlerts } from '../alerts/alertSchedule';

/** Hvor ofte vi sjekker om et tidsvindu har åpnet eller lukket seg. */
const REEVALUATE_MS = 30 * 1000;

/**
 * Varslene som skal stå øverst i det mørkeblå feltet.
 *
 * Live-abonnement, ikke polling: en melding lagt inn i admin er på skjermen i
 * resepsjonen innen sekunder, uten reload. Tidsvinduet reevalueres hvert 30.
 * sekund, som er presist nok for en melding som skal vises «fra 08:00» og
 * koster ingen nettverkskall.
 */
function AlertBanner() {
    const [alerts, setAlerts] = useState([]);
    const [now, setNow] = useState(() => new Date());

    useEffect(() => subscribeToEnabledAlerts(setAlerts, (error) => {
        console.error('Kunne ikke hente varsler', error);
        setAlerts([]);
    }), []);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), REEVALUATE_MS);
        return () => clearInterval(interval);
    }, []);

    const visibleAlerts = selectVisibleAlerts(alerts, now);
    if (visibleAlerts.length === 0) {
        return null;
    }

    return (
        <div style={{ width: '100%', boxSizing: 'border-box', padding: '0 2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {visibleAlerts.map((alert) => (
                // Skaleres opp: BannerAlertBox er dimensjonert for en laptop,
                // ikke en vegg-skjerm man leser fra andre siden av rommet.
                <div key={alert.id} style={{ fontSize: '1.375rem' }}>
                    <BannerAlertBox variant={alert.level} title={alert.title}>
                        {alert.body}
                    </BannerAlertBox>
                </div>
            ))}
        </div>
    );
}

export default AlertBanner;
```

`subscribeToEnabledAlerts` returnerer unsubscribe-funksjonen fra `onSnapshot`, så den kan returneres rett fra `useEffect` som opprydding.

- [ ] **Step 3: Sett banneret inn i tavla**

Modify `src/App.jsx`.

Legg til to importer sammen med de andre:

```jsx
import AlertBanner from './components/AlertBanner';
import ErrorBoundary from './components/ErrorBoundary';
```

Bytt ut `Contrast`-blokka. Fra:

```jsx
            <Contrast style={{ width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: base.light.baseColors.frame.contrast, flexDirection: 'column', padding: '1.5rem 0' }}>
                <StaffAndHeadings randomStaffImage={randomStaffImage} greeting={greeting} />
            </Contrast>
```

Til:

```jsx
            <Contrast style={{ width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: base.light.baseColors.frame.contrast, flexDirection: 'column', padding: '1.5rem 0', maxHeight: '45vh', overflow: 'hidden' }}>
                <ErrorBoundary>
                    <AlertBanner />
                </ErrorBoundary>
                <StaffAndHeadings randomStaffImage={randomStaffImage} greeting={greeting} />
            </Contrast>
```

`maxHeight` med `overflow: hidden` er taket som gjør at mange samtidige varsler krymper karusellen framfor å skyve den ut av skjermen. Admin advarer om mer enn tre aktive (Task 9), så folk får se problemet et sted de kan gjøre noe med det.

- [ ] **Step 4: Verifiser mot emulatoren**

Terminal 1:

```bash
yarn firebase emulators:start --only auth,firestore --project ent-tavleber-prd
```

Terminal 2 — opprett `.env.local` (gitignorert av `.env.*`-regelen) med:

```
VITE_USE_EMULATOR=true
```

Så:

```bash
yarn dev
```

I emulator-UI-et på http://localhost:4000/firestore, opprett collection `alerts` med et dokument:

| Felt | Type | Verdi |
|---|---|---|
| `title` | string | `Heisen er ute av drift` |
| `body` | string | `Bruk trappa i mellomtiden.` |
| `level` | string | `warning` |
| `startsAt` | timestamp | i dag, for en time siden |
| `endsAt` | null | |
| `enabled` | boolean | `true` |

Expected på http://localhost:3000:
- Gult varsel med tittel og tekst øverst i det mørkeblå feltet, over figuren og hilsenen
- Setter du `enabled` til `false`, forsvinner det innen 30 sekunder
- Setter du `startsAt` fram i tid, forsvinner det
- Sletter du dokumentet, ser feltet ut som før, uten tom plass
- Legg inn ett `negative`- og ett `information`-varsel: det røde ligger øverst

- [ ] **Step 5: Verifiser at bygget går**

Run: `yarn build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/AlertBanner.jsx src/components/ErrorBoundary.jsx src/App.jsx
git commit -m "feat: vis varsler øverst i det mørkeblå feltet på tavla"
```

---

## Task 6: Rute-splitt og pålogging

Admin-siden får en URL og en dør. Etter denne oppgaven kan man logge inn på `/admin` og se en tom, innlogget side.

**Files:**
- Create: `src/admin/enturAccount.js`
- Test: `src/admin/enturAccount.test.mjs`
- Create: `src/admin/adminAuth.js`
- Create: `src/admin/admin.css`
- Create: `src/admin/Admin.jsx`
- Modify: `src/main.jsx`

**Interfaces:**
- Consumes: `app` fra `firebase.js`
- Produces:
  - `isEnturUser(user): boolean`
  - `signIn(): Promise<User>` — kaster med norsk melding ved feil domene
  - `signOutUser(): Promise<void>`
  - `subscribeToUser(onUser: (User|null) => void): () => void`
  - `<Admin />` (default export)

- [ ] **Step 1: Skriv de failende testene for domenesjekken**

Domenesjekken er en sikkerhetssjekk og ligger i egen modul uten Firebase-importer nettopp for å kunne testes.

Create `src/admin/enturAccount.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isEnturUser } from './enturAccount.js';

describe('isEnturUser', () => {
    it('godtar en entur.org-adresse', () => {
        assert.equal(isEnturUser({ email: 'sturle@entur.org' }), true);
    });

    it('godtar store bokstaver', () => {
        assert.equal(isEnturUser({ email: 'STURLE@ENTUR.ORG' }), true);
    });

    it('avviser et domene som bare slutter likt', () => {
        assert.equal(isEnturUser({ email: 'noen@ikkeentur.org' }), false);
    });

    it('avviser entur.org som subdomene i et annet domene', () => {
        assert.equal(isEnturUser({ email: 'noen@entur.org.example.com' }), false);
    });

    it('avviser et subdomene under entur.org', () => {
        assert.equal(isEnturUser({ email: 'noen@intern.entur.org' }), false);
    });

    it('avviser andre domener', () => {
        assert.equal(isEnturUser({ email: 'noen@gmail.com' }), false);
    });

    it('avviser bruker uten e-post', () => {
        assert.equal(isEnturUser({}), false);
    });

    it('avviser null og undefined', () => {
        assert.equal(isEnturUser(null), false);
        assert.equal(isEnturUser(undefined), false);
    });
});
```

- [ ] **Step 2: Kjør testene for å se at de feiler**

Run: `yarn test`
Expected: FAIL — `Cannot find module '.../src/admin/enturAccount.js'`.

- [ ] **Step 3: Skriv domenesjekken**

Create `src/admin/enturAccount.js`:

```js
export const ENTUR_DOMAIN = 'entur.org';

const ENTUR_SUFFIX = `@${ENTUR_DOMAIN}`;

/**
 * Om en innlogget bruker har en Entur-konto.
 *
 * Sjekken er på hele `@entur.org`-suffikset, ikke bare `entur.org`, slik at
 * verken `noen@ikkeentur.org` eller `noen@entur.org.example.com` slipper
 * gjennom. Subdomener under entur.org er også utenfor.
 *
 * Dette er kun for å gi god feilmelding tidlig — håndhevingen ligger i
 * firestore.rules, som klienten ikke kan omgå.
 */
export function isEnturUser(user) {
    const email = user?.email;
    if (typeof email !== 'string') {
        return false;
    }
    return email.toLowerCase().endsWith(ENTUR_SUFFIX);
}
```

- [ ] **Step 4: Kjør testene for å se at de passerer**

Run: `yarn test`
Expected: PASS.

- [ ] **Step 5: Skriv auth-laget**

Create `src/admin/adminAuth.js`:

```js
import {
    GoogleAuthProvider,
    connectAuthEmulator,
    getAuth,
    onAuthStateChanged,
    signInWithPopup,
    signOut,
} from 'firebase/auth';

import { app } from '../alerts/firebase.js';
import { ENTUR_DOMAIN, isEnturUser } from './enturAccount.js';

export const auth = getAuth(app);

if (import.meta.env.VITE_USE_EMULATOR === 'true') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

/**
 * Logger inn med Google. `hd` sender brukeren rett til Entur-kontoen sin i
 * stedet for kontovelgeren.
 *
 * Er kontoen ikke en Entur-konto, logges den ut igjen umiddelbart. Reglene
 * ville avvist skrivingen uansett, men det er dårlig UX å oppdage det først
 * når man trykker lagre.
 */
export async function signIn() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: ENTUR_DOMAIN });

    const result = await signInWithPopup(auth, provider);
    if (!isEnturUser(result.user)) {
        await signOut(auth);
        throw new Error(`Du må logge inn med en @${ENTUR_DOMAIN}-konto.`);
    }
    return result.user;
}

export function signOutUser() {
    return signOut(auth);
}

/** Kaller onUser med brukeren, eller null hvis ingen gyldig Entur-bruker. */
export function subscribeToUser(onUser) {
    return onAuthStateChanged(auth, (user) => onUser(isEnturUser(user) ? user : null));
}
```

- [ ] **Step 6: Skriv admin-stilene**

Create `src/admin/admin.css`:

```css
/* Importeres bare av Admin.jsx, som er lazy-lastet, slik at kiosken ikke
   laster CSS for skjemakomponenter den aldri viser. */
@import '@entur/form/dist/styles.css';
@import '@entur/datepicker/dist/styles.css';
@import '@entur/table/dist/styles.css';

/* Radioen inne i nivåkortene er visuelt skjult, så fokusringen må flyttes
   til kortet for at tastaturnavigasjon skal være synlig. */
.level-option:focus-within {
    outline: 2px solid #181c56;
    outline-offset: 2px;
}
```

- [ ] **Step 7: Skriv admin-roten med påloggingsskjerm**

Create `src/admin/Admin.jsx`. Innholdet etter pålogging kommer i Task 8 og 9 — her er plassholderen `<p>` som erstattes der, og det er den eneste midlertidige biten i planen.

```jsx
import { useEffect, useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { PrimaryButton, SecondaryButton } from '@entur/button';
import { Heading1, Paragraph } from '@entur/typography';

import './admin.css';
import { signIn, signOutUser, subscribeToUser } from './adminAuth';

function Admin() {
    const [user, setUser] = useState(null);
    const [checkingSession, setCheckingSession] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => subscribeToUser((nextUser) => {
        setUser(nextUser);
        setCheckingSession(false);
    }), []);

    async function handleSignIn() {
        setError(null);
        try {
            await signIn();
        } catch (signInError) {
            setError(signInError.message ?? 'Innlogging feilet. Prøv igjen.');
        }
    }

    if (checkingSession) {
        return null;
    }

    if (!user) {
        return (
            <main style={{ maxWidth: '28rem', margin: '4rem auto', padding: '0 1.5rem', textAlign: 'center' }}>
                <img src="/logo.svg" alt="Entur" style={{ height: '2.5rem', marginBottom: '2rem' }} />
                <Heading1>Varsler på velkomsttavla</Heading1>
                <Paragraph>Logg inn med Entur-kontoen din for å legge inn meldinger.</Paragraph>
                {error && (
                    <div style={{ margin: '1rem 0' }}>
                        <SmallAlertBox variant="negative">{error}</SmallAlertBox>
                    </div>
                )}
                <PrimaryButton onClick={handleSignIn}>Logg inn med Google</PrimaryButton>
            </main>
        );
    }

    return (
        <main style={{ maxWidth: '60rem', margin: '2rem auto', padding: '0 1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <Heading1>Varsler på velkomsttavla</Heading1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Paragraph>{user.email}</Paragraph>
                    <SecondaryButton onClick={signOutUser}>Logg ut</SecondaryButton>
                </div>
            </div>

            <div style={{ margin: '1.5rem 0' }}>
                <SmallAlertBox variant="information" title="Meldingene er offentlig lesbare">
                    Tavla står i resepsjonen og henter meldingene uten pålogging, så de kan
                    leses av hvem som helst som finner adressen. Ikke skriv sensitiv eller
                    intern-klassifisert informasjon her.
                </SmallAlertBox>
            </div>

            <p>Skjema og liste kommer.</p>
        </main>
    );
}

export default Admin;
```

- [ ] **Step 8: Del rutene i main.jsx**

Modify `src/main.jsx` — bytt hele innholdet:

```jsx
import './css/main.css';
import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Lazy: kiosken skal ikke laste firebase/auth, skjemakomponenter eller
// datovelger den aldri bruker. Én router-avhengighet for to statiske ruter er
// ikke verdt vekten.
const Admin = lazy(() => import('./admin/Admin.jsx'));

const isAdminRoute = window.location.pathname.startsWith('/admin');

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        {isAdminRoute ? (
            <Suspense fallback={null}>
                <Admin />
            </Suspense>
        ) : (
            <App />
        )}
    </React.StrictMode>
);
```

Firebase Hosting rewriter allerede alt til `index.html` (`firebase.json`), så `/admin` fungerer uten ny konfigurasjon. Vites dev-server gjør det samme for SPA-er.

- [ ] **Step 9: Verifiser påloggingen mot emulatoren**

Med emulatoren og `yarn dev` i gang (`VITE_USE_EMULATOR=true` i `.env.local`), gå til http://localhost:3000/admin.

Expected:
- Påloggingsskjermen vises med logo og «Logg inn med Google»
- Auth-emulatoren lar deg opprette en testbruker i popupen. Logg inn som `test@entur.org` → du kommer inn, e-posten står øverst, merknaden om offentlig lesing vises
- Logg inn som `test@gmail.com` → du kastes ut med «Du må logge inn med en @entur.org-konto.»
- «Logg ut» tar deg tilbake til påloggingsskjermen
- http://localhost:3000 viser tavla som før, uten påloggingsskjerm

- [ ] **Step 10: Verifiser at admin havner i egen chunk**

Run: `yarn build`
Expected: PASS, og Vite lister en egen `Admin-*.js`-chunk og en egen `Admin-*.css` i utskriften. Er admin havnet i hovedbundelen, er `lazy`-importen brutt.

- [ ] **Step 11: Commit**

```bash
git add src/admin/enturAccount.js src/admin/enturAccount.test.mjs src/admin/adminAuth.js src/admin/admin.css src/admin/Admin.jsx src/main.jsx
git commit -m "feat: legg til admin-rute med Entur-pålogging"
```

---

## Task 7: Nivåvelger

Fire fargeprøver man velger mellom, framfor en nedtrekksliste med enum-verdier.

**Files:**
- Create: `src/admin/LevelPicker.jsx`

**Interfaces:**
- Consumes: `ALERT_LEVELS` fra `alertLevels.js`
- Produces: `<LevelPicker value={string} onChange={(level: string) => void} />` (default export)

- [ ] **Step 1: Skriv nivåvelgeren**

Create `src/admin/LevelPicker.jsx`:

```jsx
import { SmallAlertBox } from '@entur/alert';
import { base } from '@entur/tokens';

import { ALERT_LEVELS } from '../alerts/alertLevels';

const SELECTED_BORDER = base.light.baseColors.frame.contrast;

/**
 * Nivåvalget som fire fargeprøver.
 *
 * Hvert kort er en ekte SmallAlertBox med sin variant, slik at farge og ikon
 * kommer fra designsystemet og ikke kan komme på avveie fra det tavla viser.
 * Under panseret er det vanlige radio-inputs — visuelt skjult, men fortsatt
 * der for tastatur og skjermleser. Fokusringen flyttes til kortet med
 * .level-option:focus-within i admin.css.
 */
function LevelPicker({ value, onChange }) {
    return (
        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Nivå</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {ALERT_LEVELS.map((level) => (
                    <label
                        key={level.level}
                        className="level-option"
                        style={{
                            flex: '1 1 14rem',
                            cursor: 'pointer',
                            borderRadius: '0.25rem',
                            padding: '0.25rem',
                            border: `2px solid ${value === level.level ? SELECTED_BORDER : 'transparent'}`,
                        }}
                    >
                        <input
                            type="radio"
                            name="alert-level"
                            value={level.level}
                            checked={value === level.level}
                            onChange={() => onChange(level.level)}
                            style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, margin: 0 }}
                        />
                        <SmallAlertBox variant={level.level} title={level.label}>
                            {level.help}
                        </SmallAlertBox>
                    </label>
                ))}
            </div>
        </fieldset>
    );
}

export default LevelPicker;
```

- [ ] **Step 2: Verifiser at bygget går**

Run: `yarn build`
Expected: PASS. Komponenten er ennå ikke i bruk; den kobles på i Task 8.

- [ ] **Step 3: Commit**

```bash
git add src/admin/LevelPicker.jsx
git commit -m "feat: legg til nivåvelger med fargeprøver"
```

---

## Task 8: Skjema med forhåndsvisning

Der meldingene faktisk legges inn. Etter denne oppgaven kan man opprette et varsel i admin og se det slå ut på tavla.

**Files:**
- Create: `src/admin/AlertForm.jsx`
- Modify: `src/admin/Admin.jsx`

**Interfaces:**
- Consumes: `validateAlertInput`/`hasErrors`/`TITLE_MAX_LENGTH`/`BODY_MAX_LENGTH` fra `alertValidation.js`, `saveAlert` fra `alertsRepository.js`, `LevelPicker`
- Produces: `<AlertForm editing={Alert|null} userEmail={string} onSaved={() => void} onCancel={() => void} />` (default export)

**Datokonvertering:** `@entur/datepicker` eksporterer sine egne hjelpere, `nativeDateToDateValue(date, noTimeOnlyDate?, timeZone?)` og `timeOrDateValueToNativeDate(value, timeZoneForCalendarDateTime?)`. Bruk dem — ikke skriv egne mot `@internationalized/date`, og ikke legg til den pakken som direkte avhengighet.

**Én DatePicker per tidspunkt, ikke DatePicker + TimePicker.** `DatePicker` har `showTime` og `granularity="minute"`, så dato og klokkeslett er samme felt. `forcedReturnType="CalendarDateTime"` gjør at `onChange` gir tilbake dato *med* tid også når feltet startet tomt — uten den får man et `CalendarDate` uten klokkeslett fra et tomt sluttfelt. (Speccen skisserte to komponenter; dette er samme resultat med halvparten så mange felt.)

- [ ] **Step 1: Skriv skjemaet**

Create `src/admin/AlertForm.jsx`:

```jsx
import { useState } from 'react';
import { BannerAlertBox, SmallAlertBox } from '@entur/alert';
import { PrimaryButton, SecondaryButton } from '@entur/button';
import { DatePicker, nativeDateToDateValue, timeOrDateValueToNativeDate } from '@entur/datepicker';
import { Switch, TextArea, TextField } from '@entur/form';
import { base } from '@entur/tokens';

import LevelPicker from './LevelPicker';
import { saveAlert } from '../alerts/alertsRepository';
import {
    BODY_MAX_LENGTH,
    TITLE_MAX_LENGTH,
    hasErrors,
    validateAlertInput,
} from '../alerts/alertValidation';

const LOCALE = 'nb-NO';

function emptyDraft() {
    return {
        id: null,
        title: '',
        body: '',
        level: 'information',
        // Nytt varsel starter «nå», så det slår ut med én gang man lagrer.
        startsAt: nativeDateToDateValue(new Date()),
        endsAt: null,
        enabled: true,
    };
}

function draftFrom(alert) {
    return {
        id: alert.id,
        title: alert.title,
        body: alert.body,
        level: alert.level,
        startsAt: nativeDateToDateValue(alert.startsAt),
        endsAt: nativeDateToDateValue(alert.endsAt),
        enabled: alert.enabled,
    };
}

function AlertForm({ editing, userEmail, onSaved, onCancel }) {
    const [draft, setDraft] = useState(() => (editing ? draftFrom(editing) : emptyDraft()));
    const [errors, setErrors] = useState({});
    const [saveError, setSaveError] = useState(null);
    const [saving, setSaving] = useState(false);

    function update(field, value) {
        setDraft((current) => ({ ...current, [field]: value }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setSaveError(null);

        const input = {
            id: draft.id,
            title: draft.title,
            body: draft.body,
            level: draft.level,
            startsAt: timeOrDateValueToNativeDate(draft.startsAt),
            endsAt: timeOrDateValueToNativeDate(draft.endsAt),
            enabled: draft.enabled,
        };

        const validationErrors = validateAlertInput(input);
        setErrors(validationErrors);
        if (hasErrors(validationErrors)) {
            return;
        }

        setSaving(true);
        try {
            await saveAlert(input, userEmail);
            onSaved();
        } catch (error) {
            console.error('Kunne ikke lagre varselet', error);
            setSaveError('Kunne ikke lagre varselet. Prøv igjen.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <TextField
                label="Tittel"
                value={draft.title}
                maxLength={TITLE_MAX_LENGTH}
                onChange={(event) => update('title', event.target.value)}
                variant={errors.title ? 'negative' : undefined}
                feedback={errors.title}
            />

            <TextArea
                label="Tekst"
                rows={3}
                value={draft.body}
                maxLength={BODY_MAX_LENGTH}
                onChange={(event) => update('body', event.target.value)}
                variant={errors.body ? 'negative' : undefined}
                feedback={errors.body ?? `${draft.body.length}/${BODY_MAX_LENGTH} tegn`}
            />

            <div>
                <LevelPicker value={draft.level} onChange={(level) => update('level', level)} />
                {errors.level && (
                    <div style={{ marginTop: '0.5rem' }}>
                        <SmallAlertBox variant="negative">{errors.level}</SmallAlertBox>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 16rem' }}>
                    <DatePicker
                        label="Vises fra"
                        locale={LOCALE}
                        showTime
                        granularity="minute"
                        forcedReturnType="CalendarDateTime"
                        selectedDate={draft.startsAt}
                        onChange={(value) => update('startsAt', value)}
                        variant={errors.startsAt ? 'negative' : undefined}
                        feedback={errors.startsAt}
                    />
                </div>
                <div style={{ flex: '1 1 16rem' }}>
                    <DatePicker
                        label="Vises til (kan stå tom)"
                        locale={LOCALE}
                        showTime
                        granularity="minute"
                        forcedReturnType="CalendarDateTime"
                        selectedDate={draft.endsAt}
                        onChange={(value) => update('endsAt', value)}
                        variant={errors.endsAt ? 'negative' : undefined}
                        feedback={errors.endsAt ?? 'Står den tom, vises varselet til du slår det av.'}
                    />
                </div>
            </div>

            <Switch
                checked={draft.enabled}
                onChange={(event) => update('enabled', event.target.checked)}
            >
                Aktiv
            </Switch>

            <section>
                <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Slik blir det på tavla</h2>
                <div style={{ backgroundColor: base.light.baseColors.frame.contrast, padding: '1.5rem', borderRadius: '0.25rem' }}>
                    <BannerAlertBox variant={draft.level} title={draft.title || 'Tittel'}>
                        {draft.body || 'Tekst'}
                    </BannerAlertBox>
                </div>
            </section>

            {saveError && <SmallAlertBox variant="negative">{saveError}</SmallAlertBox>}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
                <PrimaryButton type="submit" disabled={saving}>
                    {editing ? 'Lagre endringer' : 'Legg inn melding'}
                </PrimaryButton>
                <SecondaryButton type="button" onClick={onCancel} disabled={saving}>
                    Avbryt
                </SecondaryButton>
            </div>
        </form>
    );
}

export default AlertForm;
```

- [ ] **Step 2: Koble skjemaet inn i Admin**

Modify `src/admin/Admin.jsx`.

Legg til importer:

```jsx
import AlertForm from './AlertForm';
```

Legg til to state-variabler sammen med de andre:

```jsx
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
```

Bytt ut plassholderen:

```jsx
            <p>Skjema og liste kommer.</p>
```

med:

```jsx
            {formOpen ? (
                <AlertForm
                    editing={editing}
                    userEmail={user.email}
                    onSaved={() => {
                        setFormOpen(false);
                        setEditing(null);
                    }}
                    onCancel={() => {
                        setFormOpen(false);
                        setEditing(null);
                    }}
                />
            ) : (
                <PrimaryButton
                    onClick={() => {
                        setEditing(null);
                        setFormOpen(true);
                    }}
                >
                    Ny melding
                </PrimaryButton>
            )}
```

`editing` settes fra listen i Task 9. `PrimaryButton` er allerede importert.

- [ ] **Step 3: Verifiser hele veien mot emulatoren**

Med emulator og `yarn dev` i gang:

1. http://localhost:3000/admin, logg inn som `test@entur.org`
2. «Ny melding». Expected: skjema med tittel, tekst, fire nivåkort, to dato-og-tid-felt, aktiv-bryter og forhåndsvisning på mørkeblå bakgrunn
3. Klikk deg gjennom nivåkortene. Expected: forhåndsvisningen bytter farge og ikon, og valgt kort får ramme. Tab + piltaster skal også virke, med synlig fokusring
4. Trykk «Legg inn melding» med tomme felt. Expected: «Tittel er påkrevd» og «Tekst er påkrevd» under feltene, ingenting lagres
5. Sett «Vises til» før «Vises fra». Expected: «Slutt må være etter start»
6. Fyll ut gyldig, lagre. Expected: skjemaet lukkes
7. http://localhost:3000 i en annen fane. Expected: varselet står øverst i det mørkeblå feltet, med tittelen og teksten du skrev, i valgt farge
8. Emulator-UI-et på http://localhost:4000/firestore. Expected: dokumentet har `createdBy` og `updatedBy` lik `test@entur.org`, og `createdAt`/`updatedAt` satt

- [ ] **Step 4: Verifiser at bygget går**

Run: `yarn build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/AlertForm.jsx src/admin/Admin.jsx
git commit -m "feat: legg til skjema for varsler med forhåndsvisning"
```

---

## Task 9: Liste over meldinger

Oversikten: hva som vises nå, hva som er planlagt, hva som er slått av, hva som er ferdig — og hvem som la det inn.

**Files:**
- Create: `src/admin/AlertList.jsx`
- Modify: `src/admin/Admin.jsx`

**Interfaces:**
- Consumes: `subscribeToAllAlerts`/`deleteAlert` fra `alertsRepository.js`, `groupAlertsByStatus` fra `alertSchedule.js`, `levelLabel`/`ALERT_LEVELS` fra `alertLevels.js`
- Produces: `<AlertList onEdit={(alert: Alert) => void} />` (default export)

- [ ] **Step 1: Skriv listen**

Create `src/admin/AlertList.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { SecondaryButton, TertiaryButton } from '@entur/button';
import { DataCell, HeaderCell, Table, TableBody, TableHead, TableRow } from '@entur/table';
import { Heading3, Paragraph } from '@entur/typography';

import { levelLabel } from '../alerts/alertLevels';
import { groupAlertsByStatus } from '../alerts/alertSchedule';
import { deleteAlert, subscribeToAllAlerts } from '../alerts/alertsRepository';

const REEVALUATE_MS = 30 * 1000;

/** Over dette antallet samtidige varsler begynner tavla å bli trang. */
const CROWDED_THRESHOLD = 3;

const GROUPS = [
    { key: 'visible', heading: 'Vises nå' },
    { key: 'planned', heading: 'Planlagt' },
    { key: 'disabled', heading: 'Slått av' },
    { key: 'expired', heading: 'Utløpt' },
];

const dateFormat = new Intl.DateTimeFormat('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});

function formatRange(alert) {
    const from = alert.startsAt ? dateFormat.format(alert.startsAt) : 'ukjent';
    const to = alert.endsAt ? dateFormat.format(alert.endsAt) : 'åpen slutt';
    return `${from} – ${to}`;
}

// Fargeprikkene er dekorasjon ved siden av etiketten som allerede sier nivået,
// derfor aria-hidden og derfor greit å ha dem som faste verdier her.
const DOT_COLORS = {
    negative: '#dc2a2a',
    warning: '#f8b133',
    information: '#276fbf',
    success: '#1c8b60',
};

function LevelDot({ level }) {
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <span aria-hidden="true" style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', backgroundColor: DOT_COLORS[level] ?? '#8a8a8a' }} />
            {levelLabel(level)}
        </span>
    );
}

function AlertList({ onEdit }) {
    const [alerts, setAlerts] = useState([]);
    const [now, setNow] = useState(() => new Date());
    const [loadError, setLoadError] = useState(null);

    useEffect(() => subscribeToAllAlerts(setAlerts, (error) => {
        console.error('Kunne ikke hente varsler', error);
        setLoadError('Kunne ikke hente meldingene. Last siden på nytt.');
    }), []);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), REEVALUATE_MS);
        return () => clearInterval(interval);
    }, []);

    async function handleDelete(alert) {
        const confirmed = window.confirm(`Slette «${alert.title}»? Dette kan ikke angres.`);
        if (!confirmed) {
            return;
        }
        try {
            await deleteAlert(alert.id);
        } catch (error) {
            console.error('Kunne ikke slette varselet', error);
            window.alert('Kunne ikke slette varselet. Prøv igjen.');
        }
    }

    if (loadError) {
        return <SmallAlertBox variant="negative">{loadError}</SmallAlertBox>;
    }

    const groups = groupAlertsByStatus(alerts, now);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {groups.visible.length > CROWDED_THRESHOLD && (
                <SmallAlertBox variant="warning" title="Mange meldinger samtidig">
                    {groups.visible.length} meldinger vises nå. Tavla stabler dem alle, så
                    kartet og værmeldingen under får lite plass. Vurder å slå av noen.
                </SmallAlertBox>
            )}

            {alerts.length === 0 && <Paragraph>Ingen meldinger lagt inn ennå.</Paragraph>}

            {GROUPS.map(({ key, heading }) => {
                const group = groups[key];
                if (group.length === 0) {
                    return null;
                }
                return (
                    <section key={key}>
                        <Heading3>{`${heading} (${group.length})`}</Heading3>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <HeaderCell>Nivå</HeaderCell>
                                    <HeaderCell>Tittel</HeaderCell>
                                    <HeaderCell>Tidsrom</HeaderCell>
                                    <HeaderCell>Lagt inn av</HeaderCell>
                                    <HeaderCell>Sist endret av</HeaderCell>
                                    <HeaderCell aria-label="Handlinger" />
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {group.map((alert) => (
                                    <TableRow key={alert.id}>
                                        <DataCell>
                                            <LevelDot level={alert.level} />
                                        </DataCell>
                                        <DataCell>{alert.title}</DataCell>
                                        <DataCell>{formatRange(alert)}</DataCell>
                                        <DataCell>{alert.createdBy || '–'}</DataCell>
                                        <DataCell>{alert.updatedBy || '–'}</DataCell>
                                        <DataCell>
                                            <span style={{ display: 'flex', gap: '0.5rem' }}>
                                                <SecondaryButton onClick={() => onEdit(alert)}>
                                                    Endre
                                                </SecondaryButton>
                                                <TertiaryButton onClick={() => handleDelete(alert)}>
                                                    Slett
                                                </TertiaryButton>
                                            </span>
                                        </DataCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </section>
                );
            })}
        </div>
    );
}

export default AlertList;
```

- [ ] **Step 2: Koble listen inn i Admin**

Modify `src/admin/Admin.jsx`.

Legg til importen:

```jsx
import AlertList from './AlertList';
```

Bytt ut blokka fra Task 8 slik at listen står under knappen, og «Endre» åpner skjemaet med varselet:

```jsx
            {formOpen ? (
                <AlertForm
                    editing={editing}
                    userEmail={user.email}
                    onSaved={() => {
                        setFormOpen(false);
                        setEditing(null);
                    }}
                    onCancel={() => {
                        setFormOpen(false);
                        setEditing(null);
                    }}
                />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <PrimaryButton
                        onClick={() => {
                            setEditing(null);
                            setFormOpen(true);
                        }}
                    >
                        Ny melding
                    </PrimaryButton>
                    <AlertList
                        onEdit={(alert) => {
                            setEditing(alert);
                            setFormOpen(true);
                        }}
                    />
                </div>
            )}
```

- [ ] **Step 3: Verifiser mot emulatoren**

Med emulator og `yarn dev` i gang, på http://localhost:3000/admin innlogget som `test@entur.org`:

1. Legg inn fire meldinger: én som vises nå, én med `Vises fra` i morgen, én med aktiv-bryteren av, og én med `Vises til` i går
2. Expected: fire grupper — «Vises nå», «Planlagt», «Slått av», «Utløpt» — med én rad hver, riktig nivåprikk og etikett, tidsrom på norsk format, og `test@entur.org` i begge personkolonnene
3. Legg inn fire meldinger som vises nå. Expected: gul advarsel «Mange meldinger samtidig» over listen
4. «Endre» på en rad. Expected: skjemaet åpner med feltene fylt ut. Lagre en endret tittel → listen oppdaterer seg uten reload
5. «Slett» på en rad. Expected: bekreftelsesdialog. Avbryt → raden står. Bekreft → raden forsvinner, og varselet forsvinner fra tavla
6. Åpne http://localhost:3000/admin i en annen fane og lagre en endring i den ene. Expected: listen i den andre fanen oppdaterer seg av seg selv

- [ ] **Step 4: Verifiser at bygget går**

Run: `yarn build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/AlertList.jsx src/admin/Admin.jsx
git commit -m "feat: legg til liste over varsler i admin"
```

---

## Task 10: Deploy og dokumentasjon

Siste stykke: reglene må komme til produksjon, testene må faktisk kjøre i CI, og noen må kunne forstå dette om et år.

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: `yarn test` fra Task 1, `firestore.rules` fra Task 1
- Produces: ingenting kode-messig

- [ ] **Step 1: Kjør tester og deploy reglene i CI**

Modify `.github/workflows/deploy.yml`.

Legg `firestore.rules` til i `paths`-lista, etter `firebase.json`:

```yaml
      - firebase.json
      - firestore.rules
```

Legg inn et test-steg mellom «Install dependencies» og «Build»:

```yaml
      - name: Test
        run: yarn test
```

Utvid deploy-steget til også å ta reglene:

```yaml
      - name: Deploy to Firebase Hosting and Firestore rules
        run: yarn firebase deploy --only hosting,firestore:rules --project ent-tavleber-prd --non-interactive
```

- [ ] **Step 2: Vurder om CI-kontoen kan deploye regler**

Ingen konflikt med plattformen: app-factorys Terraform har `google_firebaserules_ruleset`
og `google_firebaserules_release` **kun for storage**, ikke for Firestore. Firestore-reglene
er derfor vårt repo sitt ansvar alene.

Deploy av `firestore:rules` krever `roles/firebaserules.admin` på tjenestekontoen som Workload Identity-steget autentiserer som.

Sjekk med prosjekteier eller i `#talk-utviklerplattform` om rollen er på Enturs IAM-allowlist og satt på kontoen.

Er den **ikke** det: rull tilbake endringen i deploy-steget til `--only hosting`, la test-steget og `paths`-utvidelsen stå, og deploy reglene manuelt i stedet:

```bash
yarn firebase deploy --only firestore:rules --project ent-tavleber-prd
```

Noter valget i README i neste steg, slik at neste person vet hva som faktisk gjelder.

- [ ] **Step 3: Dokumenter i README**

Modify `README.md`.

I «Hva tavla viser», utvid punkt 2 om det mørkeblå feltet med varslene. Legg til etter beskrivelsen av velkomsthilsenen:

```markdown
   Øverst i feltet, over figuren og hilsenen, vises eventuelle **varsler** fra
   Firestore — se [Varsler og admin-side](#varsler-og-admin-side).
```

Legg til en ny seksjon etter «Deploy til Firebase Hosting»:

```markdown
## Varsler og admin-side

Tavla kan vise tidsstyrte meldinger øverst i det mørkeblå feltet. Meldingene
legges inn på `/admin` og lagres i Firestore i `ent-tavleber-prd`.

Hver melding har tittel, tekst, nivå, et tidsrom og en av/på-bryter. Nivået
styrer farge og ikon, og bruker Entur-designsystemets fire varianter:
`negative` (Kritisk), `warning` (Advarsel), `information` (Informasjon) og
`success` (Positivt). Er flere meldinger aktive samtidig, stables de med
alvorligste og nyeste øverst.

Tavla abonnerer på Firestore med `onSnapshot`, så en ny melding er på skjermen
i resepsjonen innen sekunder — uten at noen må laste siden på nytt. Tidsvinduet
reevalueres hvert 30. sekund.

### Pålogging

`/admin` krever innlogging med Google. Siden Entur bruker Google Workspace er
det Entur-kontoen din. Både admin-siden og Firestore-reglene krever en
verifisert `@entur.org`-adresse. Hvem som opprettet og sist endret en melding
lagres og vises i listen.

### Meldingene er offentlig lesbare

Tavla er en kiosk uten pålogging og må lese meldingene uautentisert. Appen
ligger på et offentlig domene, så **meldingene kan leses av hvem som helst som
finner adressen.** Dette er akseptert fordi innholdet uansett står på en skjerm
i resepsjonen. **Ikke legg sensitiv eller intern-klassifisert informasjon i en
melding.**

Skrivetilgang er låst til `@entur.org` i `firestore.rules`, som også validerer
feltene og hindrer at `createdBy`/`updatedBy` settes til andre enn den
innloggede.

### Lokal utvikling mot emulator

Firestore-emulatoren krever Java 11+ (`brew install openjdk`).

Start emulatorene i én terminal:

```bash
yarn firebase emulators:start --only auth,firestore --project ent-tavleber-prd
```

Lag `.env.local` med:

```
VITE_USE_EMULATOR=true
```

Start dev-serveren i en annen terminal med `yarn dev`. Appen kobler seg da til
emulatoren i stedet for produksjon. Emulator-UI-et ligger på
http://localhost:4000, og Auth-emulatoren lar deg logge inn som en oppdiktet
`@entur.org`-bruker uten ekte Google-konto.

Uten `VITE_USE_EMULATOR=true` snakker `yarn dev` med **produksjons**-Firestore.

### Tester

```bash
yarn test
```

Kjører Nodes innebygde test-runner over logikken som kan gå galt: tidsvindu og
sortering (`src/alerts/alertSchedule.test.mjs`), validering
(`alertValidation.test.mjs`), Firestore-mapping (`alertMapper.test.mjs`) og
domenesjekken for pålogging (`src/admin/enturAccount.test.mjs`) — pluss
floorplan-transformen.

Firestore-reglene er **ikke** dekket av automatiske tester; de verifiseres
manuelt i emulatoren. Blir dette et system flere team lener seg på, bør de
testes med `@firebase/rules-unit-testing`.
```

- [ ] **Step 4: Verifiser at alt henger sammen**

```bash
yarn test && yarn build
```

Expected: alle tester PASS, bygget går gjennom, og Vite lister en egen `Admin-*.js`-chunk.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy.yml README.md
git commit -m "docs: dokumenter varsler og admin, kjør tester i CI"
```

---

## Verifisering før merge

Kjør dette til slutt, mot emulatoren, som en samlet gjennomgang:

- [ ] `yarn test` — alle tester grønne
- [ ] `yarn build` — bygget går, admin i egen chunk
- [ ] Tavla på `/` viser varsler øverst i det mørkeblå feltet, over figur og hilsen
- [ ] Tavla uten aktive varsler ser ut som før, uten tom plass
- [ ] Flere aktive varsler stables med alvorligste øverst
- [ ] Et varsel dukker opp og forsvinner av seg selv når tidsvinduet åpner og lukker
- [ ] Karusellen med vær og kart fungerer fortsatt, også med varsler oppe
- [ ] `/admin` krever innlogging, og en ikke-`@entur.org`-konto avvises
- [ ] Skjemaet validerer og forhåndsvisningen stemmer med det tavla viser
- [ ] Listen grupperer riktig og viser hvem som la inn meldingen
- [ ] Sletting krever bekreftelse
- [ ] Firestore-reglene i emulatoren avviser skriving uten pålogging
- [ ] Firestore-reglene avviser at `updatedBy` settes til en annen e-post
