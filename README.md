# Tavla
This is just a simple Github Page project to host a single web-page that shows a combination of [Entur tavla](https://tavla.entur.no) and [Yr widget](https://developer.yr.no/doc/guides/available-widgets/).
The purpose of the project is just to have a screen at our office to show busses and trams and a weather-forecast so we can plan when its the best time to leave office.

## Tech Stack

This project is built with:
- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.


## Online

go to https://stunor92.github.io/entur-tavla/ or https://entur.sturle.dev/

## Deploy til Firebase Hosting

Forutsetning: fyll inn faktisk Entur-prosjekt-ID i `.firebaserc`
(erstatt `<ENTUR_FIREBASE_PROJECT_ID>`), og logg inn:

    yarn firebase login

Deploy:

    yarn deploy:firebase

Intro-videoen ligger i `public/entur.mp4` og serveres same-origin med
`immutable`-cache (se `firebase.json`), slik at den looper fra nettleser-cache
uten flaky nettverkskall.