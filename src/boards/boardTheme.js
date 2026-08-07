/**
 * Fargene de to øverste feltene kan ha.
 *
 * Uten Firebase-importer og uten JSX, slik at tabellen kan testes med
 * `node --test`.
 *
 * Det lyse temaet dropper <Contrast>-wrapperen framfor å overstyre farger inni
 * den: uten wrapperen faller @entur/typography tilbake på --primary-text-color,
 * som allerede er Entur-blå. `color` settes likevel på feltet, slik at vanlig
 * tekst uten typografi-komponent — åpningstidene — arver den samme fargen.
 */
import { base, colors } from '@entur/tokens';

const DARK = {
    background: base.light.baseColors.frame.contrast,
    color: colors.brand.white,
    logoSrc: '/logo.svg',
    contrast: true,
};

// Lavendel fra merkevaren, ikke den lysere lavendelen karusellen bruker
// (#d9dae8). De tre feltene skal fortsatt leses som tre felt.
//
// logo-on-light.svg har mørkeblått ordmerke og hører til lyse flater; den lå
// der fra før for admin-sidene.
const LIGHT = {
    background: colors.brand.lavender,
    color: colors.brand.blue,
    logoSrc: '/logo-on-light.svg',
    contrast: false,
};

/** Ukjent verdi gir det mørke temaet, som er slik tavlene så ut før valget fantes. */
export function bandTheme(theme) {
    return theme === 'light' ? LIGHT : DARK;
}
