/**
 * Fargen på et avvik i avgangstavla — sporendring eller avviksmelding.
 *
 * Gul brukes som TEKST på mørke flater og som FYLL på lyse. Det er ikke smak:
 * canary mot lys lavendel, som er standardflata i karusellen, er kontrast 1.10.
 * Altså usynlig. Mørkeblå på canary er 10.25, og canary på mørkeblå er det samme.
 *
 * `warningStyle` er en videreutvikling av prinsippet `Chip` i `Departures.jsx`
 * allerede bygger på: at gul aldri skal stå som tekst mot en lys flate. `Chip`
 * selv er bevisst latt urørt — den bruker canary som FYLL med navy tekst i
 * begge temaer, ikke gul TEKST på mørkt som her. Det betyr at en mørk flate
 * kan vise en fylt gul pille (`Chip`) og bar gul tekst (`warningStyle`) side
 * ved side i samme rad. Det er en villet inkonsekvens, ikke en glipp: sporet
 * og avviksmeldinga arver regelen herfra i stedet for å gjenta den, og
 * kontrastkravet kan testes ett sted.
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
