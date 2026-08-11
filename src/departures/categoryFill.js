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
        // Kanten finnes bare i lyst tema. Der er fyllet 2.1–3.4 mot lavendel og
        // fersken, altså under 3.0 der formen skal leses. I mørkt tema er det
        // 4.3–7.4 mot flata og trenger ingen.
        border: dark ? 'none' : `2px solid ${colors.brand.blue}`,
    };
}

/**
 * Tekstfargen på linjemerket.
 *
 * Skilt fra `categoryFill` fordi regelen er den samme enten fyllet kommer fra
 * Bane NOR-kategorien eller fra `TravelTag` sin egen transportpalett. Målt over
 * hele paletten ligger kontrasten på 4.5–12.1 med denne regelen.
 *
 * Den må settes inline av kallstedet i ALLE tilfeller. Overlater vi den til
 * stilarket, kommer den fra `:where(.eds-contrast) .eds-travel-tag`, og
 * `:where()` kom i Chromium 88 — Samsung-skjermen ligger på 85 og forkaster
 * regelen. Da ville merket fått én tekstfarge på skjermen og en annen i Chrome.
 */
export function badgeText(theme) {
    return theme === 'dark' ? colors.brand.blue : '#ffffff';
}
