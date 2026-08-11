/**
 * Flatene et felt på tavla kan ha, som en lukket liste med målt kontrast.
 *
 * Uten JSX og uten Firebase-import, slik at fargene kan kontrastmåles med
 * `node --test`. Det er ikke pynt: karusellens inaktive ikon var en gang hvitt
 * på lavendel, kontrast 1.39, altså usynlig. Testen holder den feilen borte for
 * alle seks flatene på én gang.
 *
 * Navnene er ASCII-slugs uten æøå fordi de lagres som verdier i Firestore og
 * gjentas som literal liste i firestore.rules — regler kan ikke importere.
 * Endrer du listen her, endre den der også.
 *
 * `mode` er nøkkelen til at seks farger ble billig: Weather, Departures og
 * OfficeMap forgrener seg allerede på lys/mørk, og de forgreningene overlever
 * uendret når hver flate bærer sin egen modus.
 *
 * Paletten holder seg til flater, tekst og accent. Fargen på merkene —
 * linjemerket og avviks-brikkene — eies av `categoryFill`/`badgeText` og
 * `Chip`, som begge har sin egen logikk for fyll og tekst.
 */
import { base, colors, semantic } from '@entur/tokens';

/** Rekkefølgen her er rekkefølgen i nedtrekkslistene i admin. */
export const SURFACES = [
    'morkebla',
    'morkebla-lys',
    'lavendel',
    'lys-lavendel',
    'hvit',
    'fersken',
];

export const SURFACE_LABELS = {
    'morkebla': 'Mørk blå',
    'morkebla-lys': 'Mørk blå, lysere',
    'lavendel': 'Lavendel',
    'lys-lavendel': 'Lys lavendel',
    'hvit': 'Hvit',
    'fersken': 'Fersken',
};

/**
 * Standardene er ulike med vilje: stripa ligger inntil karusellen, og to felt
 * med samme farge ville lest som ett.
 */
export const DEFAULT_CAROUSEL_SURFACE = 'lys-lavendel';
export const DEFAULT_BOTTOM_SURFACE = 'morkebla';

const WHITE = colors.brand.white;
const BLUE = colors.brand.blue;
const CORAL = base.light.baseColors.shape.highlight;

const TABLE = {
    'morkebla': {
        mode: 'dark',
        background: base.light.baseColors.frame.contrast,
    },
    'morkebla-lys': {
        mode: 'dark',
        background: base.light.baseColors.frame.contrastalt,
    },
    'lavendel': {
        mode: 'light',
        background: colors.brand.lavender,
    },
    'lys-lavendel': {
        mode: 'light',
        background: semantic.fill.background.subdued.light,
    },
    'hvit': {
        mode: 'light',
        background: WHITE,
    },
    'fersken': {
        mode: 'light',
        background: colors.brand.peach,
    },
};

/**
 * Ukjent navn gir karusellens standard, slik at en tullverdi ikke krasjer tavla.
 *
 * `SURFACES.includes`, ikke `Object.hasOwn`: tavla kjører på en Samsung-skjerm
 * med Tizen, og motoren der er flere år eldre enn Chromium 93, som er der
 * `Object.hasOwn` kom. Funksjonen kalles fra `App` sin komponentkropp, utenfor
 * enhver ErrorBoundary, så et kast her tar ned hele treet og gir en hvit skjerm
 * i resepsjonen. `includes` er ES2016 og finnes overalt der React 19 kjører.
 * Se `browserBaseline.test.mjs`, som holder resten av kildekoden innenfor
 * samme grense.
 */
export function surfacePalette(name) {
    const key = SURFACES.includes(name) ? name : DEFAULT_CAROUSEL_SURFACE;
    const { mode, background } = TABLE[key];
    return {
        name: key,
        mode,
        background,
        text: mode === 'dark' ? WHITE : BLUE,
        accent: CORAL,
    };
}
