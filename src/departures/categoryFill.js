/**
 * Bane NORs farge på linjemerket, eller `null`.
 *
 * Fargen settes av linjekategori — L lokaltog, R regiontog, F fjerntog — fordi
 * det er kodingen Bane NOR bruker på perrongskjermene. Den reisende går fra
 * billettkontoret til sporet og møter samme farge.
 *
 * Enturs eget `line.presentation.colour` brukes IKKE: det er en operatørfarge,
 * ikke en linjefarge. Alle tre togene fra Bergen stasjon er Vy og får samme
 * røde, og de fleste bussrutene har feltet tomt. Verifisert mot APIet.
 *
 * Hex-verdiene er de nærmeste tokenene i Entur-designsystemet, ikke målt på
 * Bane NORs skjermer. De kan justeres.
 *
 * `null` for alt annet er et valg, ikke en mangel: da fargelegger `TravelTag`
 * seg selv fra transportmiddelet. Den logikken eier Entur allerede, og en kopi
 * her ville bare drevet fra originalen.
 */
import { colors } from '@entur/tokens';

const CATEGORY = {
    L: { light: colors.validation.mint, dark: colors.validation.mintContrast },
    R: { light: colors.validation.lava, dark: colors.validation.lavaContrast },
    F: { light: colors.validation.sky, dark: colors.validation.skyContrast },
};

// Tallet er ikke pynt: «L4» er en kategori, «Lillestrøm» er et stedsnavn.
const CATEGORY_CODE = /^([LRF])\d+$/i;

export function categoryFill(lineCode, theme) {
    const match = typeof lineCode === 'string' ? CATEGORY_CODE.exec(lineCode) : null;
    if (match === null) {
        return null;
    }
    const dark = theme === 'dark';
    return {
        background: CATEGORY[match[1].toUpperCase()][dark ? 'dark' : 'light'],
        // Kanten finnes bare i lyst tema. Mot lavendel, lys-lavendel (som er
        // DEFAULT_CAROUSEL_SURFACE) og fersken er fyllet 2.10–3.84 — på eller
        // under 3.0 for de fleste av dem, der formen ellers ville forsvunnet.
        // Mot hvit er det 4.13–5.33, og kanten er da strengt tatt ikke
        // nødvendig, men beholdes slik at merket ser likt ut på alle lyse
        // flater. I mørkt tema er fyllet 4.3–7.4 mot flata og trenger ingen.
        border: dark ? 'none' : `2px solid ${colors.brand.blue}`,
    };
}

/**
 * Tekstfargen på linjemerket.
 *
 * Skilt fra `categoryFill` fordi regelen er den samme enten fyllet kommer fra
 * Bane NOR-kategorien eller fra `TravelTag` sin egen transportpalett. Målt
 * mot Bane NOR-kategoriene ligger kontrasten på 4.13–7.40 (hvit tekst: 4.13
 * mint, 4.29 sky, 5.33 lava; navy på kontrastvariantene: 6.83–7.40). Mot
 * TravelTags egen transportpalett er den 4.53–12.12. Merket er 1.75rem/700 —
 * 28px halvfet, altså WCAG large text med grense 3.0 — så selv det laveste
 * tallet her ligger godt over kravet.
 *
 * Den må settes inline av kallstedet i ALLE tilfeller. Grunnen er IKKE at
 * `:where()`-varianter forkastes på Tizen: en regel som `:where(.eds-contrast)
 * .eds-travel-tag` krever forfaren-klassen `eds-contrast`, som denne appen
 * aldri setter — vi bruker bare `ContrastContext.Provider`, ikke `<Contrast>`
 * (se `LineBadge` i `Departures.jsx`). Den grunnen er derfor egentlig at
 * `TravelTag` selv bare setter `--text-color` når `alert === 'error'` eller
 * `transport === 'walk'`. I alle andre tilfeller, uten vår inline-verdi,
 * kommer fargen fra `.eds-travel-tag{--text-color:var(--components-travel-
 * traveltag-standard-text-default)}` = `#ffffff` — også i mørkt tema. Uten
 * denne funksjonen ville mørkt tema fått hvit tekst der den skal ha navy.
 */
export function badgeText(theme) {
    return theme === 'dark' ? colors.brand.blue : '#ffffff';
}
