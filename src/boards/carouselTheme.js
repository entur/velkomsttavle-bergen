/**
 * Fargepalett for karusellen, per tema.
 *
 * Temaet ligger på tavla og gjelder hele karusellen. En karusell som skifter
 * bakgrunn mellom slides er ikke et design, det er en feil.
 *
 * Uten JSX og uten Firebase-import, slik at palettene kan kontrastmåles med
 * `node --test`. Det er ikke pynt: dagens inaktive karusellikon er hvitt mot
 * lavendel, kontrast 1.39, altså usynlig. Testen holder den feilen borte.
 *
 * Paletten holder seg til flater, tekst og ikoner. Fargen på merkene —
 * linjemerket og avviks-brikkene — eies av `lineAppearance` og `Chip`, som
 * begge har sin egen logikk for fyll og tekst.
 */
import { base, colors, semantic } from '@entur/tokens';

export const CAROUSEL_THEMES = ['light', 'dark'];
export const DEFAULT_CAROUSEL_THEME = 'light';

const DARK_BACKGROUND = base.light.baseColors.frame.contrast;
const LIGHT_BACKGROUND = semantic.fill.background.subdued.light;
const CORAL = base.light.baseColors.shape.highlight;
const BRAND_BLUE = colors.brand.blue;

export function carouselPalette(theme) {
    const dark = theme === 'dark';
    return {
        theme: dark ? 'dark' : 'light',
        background: dark ? DARK_BACKGROUND : LIGHT_BACKGROUND,
        // Flate for moduler som trenger å skille seg fra bakgrunnen. På mørkt
        // tema er den lysere enn bakgrunnen, ellers hvit.
        panel: dark ? base.light.baseColors.frame.contrastalt : '#ffffff',
        text: dark ? '#ffffff' : BRAND_BLUE,
        iconActive: CORAL,
        iconInactive: dark ? '#ffffff' : BRAND_BLUE,
    };
}
