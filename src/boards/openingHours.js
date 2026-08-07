/**
 * Åpningstider: dagsnøkler, normalisering og visningsform.
 *
 * Uten Firebase-importer og uten JSX, slik at det kan testes med `node --test`.
 *
 * Åpningstidene er lagt inn i et skjema, ikke som fritekst, og tavla viser dem
 * som de står. Det finnes ingen «åpent nå»-logikk — det ville krevd at vi tok
 * stilling til tidssone og helligdager, og ingen har bedt om det.
 */

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// Nøklene her må stemme nøyaktig med DAY_KEYS. En `fre` der det skal stå `fri`
// gir `label: undefined` på fredag uten at noe annet ser galt ut.
export const DAY_LABELS = {
    mon: 'Mandag',
    tue: 'Tirsdag',
    wed: 'Onsdag',
    thu: 'Torsdag',
    fri: 'Fredag',
    sat: 'Lørdag',
    sun: 'Søndag',
};

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Om verdien er et klokkeslett på formen HH:MM innenfor døgnet. */
export function isTimeOfDay(value) {
    return typeof value === 'string' && TIME_OF_DAY.test(value);
}

/**
 * Alltid sju dager i ukerekkefølge, uansett hva som lå i dokumentet.
 *
 * Alt som ikke er en hel, gyldig åpningstid blir «stengt». Et dokument skrevet
 * for hånd i konsollet skal ikke kunne gi tavla en dag som verken er åpen eller
 * stengt — da er det bedre å vise «Stengt» enn et tomt felt.
 *
 * Sammenlikningen `opens >= closes` er tekstsammenlikning, som er riktig for
 * HH:MM med ledende null. En dag som lukker ved midnatt (`00:00`) blir dermed
 * stengt; det er en kjent begrensning, ikke en glipp.
 */
export function normalizeDays(value) {
    const list = Array.isArray(value) ? value : [];
    return DAY_KEYS.map((day) => {
        const found = list.find((entry) => entry && entry.day === day);
        if (!found || found.closed === true) {
            return { day, closed: true };
        }
        if (!isTimeOfDay(found.opens) || !isTimeOfDay(found.closes)) {
            return { day, closed: true };
        }
        if (found.opens >= found.closes) {
            return { day, closed: true };
        }
        return { day, closed: false, opens: found.opens, closes: found.closes };
    });
}

/**
 * Radene tavla viser. Dager som ligger etter hverandre og har samme verdi blir
 * én rad: «Mandag–Fredag 08:00–16:00» framfor fem like linjer.
 *
 * Sammenslåingen forutsetter at dagene står i ukerekkefølge. Det garanterer
 * normalizeDays; endres den rekkefølgen, blir gruppene stille feil.
 *
 * Tankestrek, ikke bindestrek, både mellom dagsnavnene og mellom tidene.
 */
export function formatOpeningHours(days) {
    const groups = [];
    for (const day of days) {
        const value = day.closed ? 'Stengt' : `${day.opens}–${day.closes}`;
        const previous = groups[groups.length - 1];
        if (previous && previous.value === value) {
            previous.to = day.day;
        } else {
            groups.push({ from: day.day, to: day.day, value });
        }
    }
    return groups.map((group) => ({
        key: group.from,
        label: group.from === group.to
            ? DAY_LABELS[group.from]
            : `${DAY_LABELS[group.from]}–${DAY_LABELS[group.to]}`,
        value: group.value,
    }));
}
