/**
 * De fire varselnivåene, sortert med alvorligste først.
 *
 * `level` er Entur-designsystemets variantnavn, lagret som det er i Firestore,
 * slik at verdien kan sendes rett inn i <BannerAlertBox variant={...}> uten
 * oversettelsestabell.
 */
export const ALERT_LEVELS = [
    {
        level: 'negative',
        label: 'Kritisk',
        help: 'Noe galt som krever handling nå',
        weight: 0,
    },
    {
        level: 'warning',
        label: 'Advarsel',
        help: 'Noe man bør merke seg — heis ute av drift, endret åpningstid',
        weight: 1,
    },
    {
        level: 'information',
        label: 'Informasjon',
        help: 'Nyttig beskjed, ikke noe man må reagere på',
        weight: 2,
    },
    {
        level: 'success',
        label: 'Positivt',
        help: 'Noe er i orden igjen, eller en god nyhet',
        weight: 3,
    },
];

export const ALERT_LEVEL_VALUES = ALERT_LEVELS.map((entry) => entry.level);

export function levelLabel(level) {
    const entry = ALERT_LEVELS.find((candidate) => candidate.level === level);
    return entry ? entry.label : level;
}

/** Ukjente nivåer havner sist, slik at et rart dokument ikke tar toppplassen. */
export function levelWeight(level) {
    const entry = ALERT_LEVELS.find((candidate) => candidate.level === level);
    return entry ? entry.weight : Number.MAX_SAFE_INTEGER;
}
