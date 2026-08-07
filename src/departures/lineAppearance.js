/**
 * Farge på linjemerket i avgangstavla.
 *
 * Fargen settes av linjekategori — L lokaltog, R regiontog, F fjerntog — fordi
 * det er kodingen Bane NOR bruker på perrongskjermene. Den reisende går fra
 * billettkontoret til sporet og møter samme farge.
 *
 * Enturs eget `line.presentation.colour` brukes IKKE: det er en operatørfarge,
 * ikke en linjefarge. Alle tre togene fra Bergen stasjon er Vy og får samme
 * røde, og de fleste bussrutene har feltet tomt. Verifisert mot APIet.
 *
 * Hex-verdiene for grønn, rød og blå er de nærmeste tokenene i Entur-
 * designsystemet, ikke målt på Bane NORs skjermer. De kan justeres.
 */
import { colors, transport } from '@entur/tokens';

const CATEGORY_FILLS = {
    L: { light: colors.validation.mint, dark: colors.validation.mintContrast },
    R: { light: colors.validation.lava, dark: colors.validation.lavaContrast },
    F: { light: colors.validation.sky, dark: colors.validation.skyContrast },
};

// Tallet er ikke pynt: «L4» er en kategori, «Lillestrøm» er et stedsnavn.
const CATEGORY_CODE = /^([LRF])\d+$/i;

/** Nøytral når transportmiddelet er ukjent. Må skille seg fra bakgrunnen. */
const NEUTRAL = { light: colors.brand.blue, dark: colors.blues.blue60 };

export function lineAppearance(lineCode, transportMode, theme) {
    const dark = theme === 'dark';
    return {
        fill: fillFor(lineCode, transportMode, dark),
        text: dark ? colors.brand.blue : '#ffffff',
        border: dark ? 'none' : `2px solid ${colors.brand.blue}`,
    };
}

function fillFor(lineCode, transportMode, dark) {
    const match = typeof lineCode === 'string' ? CATEGORY_CODE.exec(lineCode) : null;
    if (match) {
        const category = CATEGORY_FILLS[match[1].toUpperCase()];
        return dark ? category.dark : category.light;
    }
    const palette = dark ? transport.contrast : transport.standard;
    const byMode = typeof transportMode === 'string' ? palette[transportMode] : undefined;
    return byMode ?? (dark ? NEUTRAL.dark : NEUTRAL.light);
}
