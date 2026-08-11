/**
 * Fargen på et avvik i avgangstavla — sporendring eller avviksmelding.
 *
 * Gul brukes som TEKST på mørke flater og som FYLL på lyse. Det er ikke smak:
 * canary mot lys lavendel, som er standardflata i karusellen, er kontrast 1.10.
 * Altså usynlig. Mørkeblå på canary er 10.25, og canary på mørkeblå er det samme.
 *
 * `Chip` i `Departures.jsx` har fulgt regelen lenge uten å ha navn på den. Her
 * får den navn, slik at sporet og avviksmeldinga arver den i stedet for å
 * gjenta den — og slik at kontrastkravet kan testes ett sted.
 *
 * Ukjent modus gir den lyse varianten. Fyll med mørk tekst er lesbart mot
 * enhver flate; gul tekst er det bare mot to av seks. Den trygge er standarden.
 */
import { colors } from '@entur/tokens';

export function warningStyle(theme) {
    if (theme === 'dark') {
        return {
            color: colors.validation.canary,
            backgroundColor: 'transparent',
            border: 'none',
        };
    }
    return {
        color: colors.brand.blue,
        backgroundColor: colors.validation.canary,
        border: `2px solid ${colors.brand.blue}`,
    };
}
