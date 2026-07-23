# Pålitelig intro-video + Firebase Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gjøre intro-videoen stabil (ikke sort) ved å servere den same-origin fra Firebase Hosting med lang cache, og flytte hostingen fra gh-pages til Entur Firebase.

**Architecture:** `entur.mp4` buntes i `public/` og serveres same-origin på `/entur.mp4`. `<video>` peker på den lokale fila og looper fra nettleser-cache (satt via `immutable` Cache-Control i `firebase.json`), som fjerner de flaky nettverkskallene ved loop-restart. Firebase Hosting konfigureres for SPA med et manuelt deploy-script.

**Tech Stack:** Vite 7, React 19, Firebase Hosting (`firebase-tools`), Yarn.

## Global Constraints

- Pakkemanager er Yarn (`yarn.lock` finnes) — bruk `yarn`, ikke `npm`.
- Vite-build-kommandoen krever `--config vite.config.js` (se eksisterende scripts).
- `vite.config.js` har `base: '/'` — ikke endre; det er riktig for Firebase Hosting på rot.
- Firebase-prosjekt-ID er ikke kjent ennå: bruk placeholder `<ENTUR_FIREBASE_PROJECT_ID>` i `.firebaserc`.
- Behold eksisterende `deploy` (gh-pages)-script inntil Firebase-deploy er verifisert.
- Ingen CI/CD i denne planen — deploy kjøres manuelt.
- Videofila `entur.mp4` (8 MB) finnes hos utvikler og legges i `public/` manuelt (se Task 1 forutsetning).

---

### Task 1: Bunt videoen og pek `<video>` på den lokale fila

**Files:**
- Add (binær, manuelt): `public/entur.mp4`
- Modify: `src/App.jsx:76`

**Interfaces:**
- Consumes: ingenting fra tidligere tasks.
- Produces: en `<video>` som serveres på `/entur.mp4`. Task 2 legger cache-header på denne stien.

**Forutsetning (manuelt steg utført av utvikler):** Kopier `entur.mp4` inn i `public/`.
Verifiser før du fortsetter:

- [ ] **Step 1: Bekreft at videofila ligger i public/**

Run: `ls -la public/entur.mp4`
Expected: fila listes, størrelse ~8 MB. Hvis den mangler, stopp og be utvikler legge den inn.

- [ ] **Step 2: Bekreft at fila ikke er git-ignorert**

Run: `git check-ignore public/entur.mp4 && echo IGNORED || echo TRACKED`
Expected: `TRACKED`. (Hvis `IGNORED`: sjekk `.gitignore` og fjern regelen som treffer mp4.)

- [ ] **Step 3: Endre `<video>`-src til den lokale fila**

I `src/App.jsx`, erstatt linje 76:

```jsx
            <video src="https://image2url.com/r2/default/videos/1768552271901-e3f8da21-1c51-4edb-ba4f-b18fa5ee5237.mp4" autoPlay loop muted style={{ width: '100vw', height: 'auto', display: 'block', maxHeight: '40vh', objectFit: 'cover' }} />
```

med:

```jsx
            <video src="/entur.mp4" autoPlay loop muted playsInline preload="auto" style={{ width: '100vw', height: 'auto', display: 'block', maxHeight: '40vh', objectFit: 'cover' }} />
```

- [ ] **Step 4: Verifiser build og at fila havner i dist/**

Run: `yarn build`
Expected: build fullfører uten feil. (`yarn build` inkluderer allerede `--config vite.config.js`.)

Run: `ls -la dist/entur.mp4`
Expected: fila finnes i `dist/` (Vite kopierer `public/` til `dist/`).

- [ ] **Step 5: Verifiser avspilling lokalt**

Run: `yarn preview`
Åpne URL-en som skrives ut. Forventet: videoen øverst spiller og looper. I nettleserens Nettverk-fane: `/entur.mp4` lastes fra same-origin (ikke image2url.com), og re-leses fra `(disk cache)` ved loop uten ny 200-respons over nett. Stopp preview med Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add public/entur.mp4 src/App.jsx
git commit -m "fix: serve intro video same-origin from public/ instead of external host"
```

---

### Task 2: Firebase Hosting-konfigurasjon

**Files:**
- Create: `firebase.json`
- Create: `.firebaserc`

**Interfaces:**
- Consumes: `/entur.mp4`-stien fra Task 1 (cache-header-regelen matcher `**/*.mp4`).
- Produces: `firebase.json` med `public: "dist"`, SPA-rewrite og mp4-cache-header; `.firebaserc` med default-prosjekt. Task 3 sitt deploy-script bruker disse.

- [ ] **Step 1: Opprett `firebase.json`**

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
  }
}
```

- [ ] **Step 2: Opprett `.firebaserc`**

```json
{
  "projects": {
    "default": "<ENTUR_FIREBASE_PROJECT_ID>"
  }
}
```

- [ ] **Step 3: Valider at JSON er gyldig**

Run: `node -e "JSON.parse(require('fs').readFileSync('firebase.json','utf8')); JSON.parse(require('fs').readFileSync('.firebaserc','utf8')); console.log('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add firebase.json .firebaserc
git commit -m "chore: add firebase hosting config with mp4 immutable cache header"
```

---

### Task 3: Deploy-script og firebase-tools

**Files:**
- Modify: `package.json` (`devDependencies` og `scripts`)

**Interfaces:**
- Consumes: `firebase.json`/`.firebaserc` fra Task 2.
- Produces: `yarn deploy:firebase`-script for manuell deploy.

- [ ] **Step 1: Legg til firebase-tools som devDependency**

Run: `yarn add -D firebase-tools`
Expected: `firebase-tools` legges til under `devDependencies` i `package.json`, `yarn.lock` oppdateres.

- [ ] **Step 2: Legg til deploy:firebase-script**

I `package.json`, legg til i `"scripts"`-blokken (behold eksisterende `deploy`):

```json
    "deploy:firebase": "vite build --config vite.config.js && firebase deploy --only hosting"
```

- [ ] **Step 3: Verifiser at firebase CLI er tilgjengelig**

Run: `yarn firebase --version`
Expected: et versjonsnummer skrives ut (f.eks. `13.x.x`).

- [ ] **Step 4: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: add firebase-tools and deploy:firebase script"
```

---

### Task 4: Dokumenter deploy og åpne punkter

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: `deploy:firebase`-scriptet fra Task 3.
- Produces: ingen kode; dokumentasjon.

- [ ] **Step 1: Legg til en deploy-seksjon i README**

Legg til nederst i `README.md`:

```markdown
## Deploy til Firebase Hosting

Forutsetning: fyll inn faktisk Entur-prosjekt-ID i `.firebaserc`
(erstatt `<ENTUR_FIREBASE_PROJECT_ID>`), og logg inn:

    yarn firebase login

Deploy:

    yarn deploy:firebase

Intro-videoen ligger i `public/entur.mp4` og serveres same-origin med
`immutable`-cache (se `firebase.json`), slik at den looper fra nettleser-cache
uten flaky nettverkskall.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document firebase deploy and video hosting"
```

---

## Manuell sluttverifisering (etter at prosjekt-ID er fylt inn)

Ikke en del av task-commits — kjøres av utvikler når faktisk Firebase-prosjekt er klart:

1. Erstatt `<ENTUR_FIREBASE_PROJECT_ID>` i `.firebaserc` med reell prosjekt-ID.
2. `yarn firebase login`
3. `yarn deploy:firebase`
4. Åpne live-URL: bekreft at videoen spiller stabilt og looper uten å bli sort over
   flere minutter, og at `/entur.mp4` i Nettverk-fanen har `Cache-Control: ...immutable`.