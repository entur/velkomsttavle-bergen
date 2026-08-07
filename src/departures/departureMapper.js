/**
 * Oversettelsen fra Journey Planner v3 til appens egen form.
 *
 * Uten JSX og uten nettverk, slik at den kan testes med `node --test`.
 *
 * Tre ting her kan faktisk gå galt, og det er dem testene handler om:
 * innstilling heter `cancellation` og ikke `cancelled`, `quay.publicCode` kan
 * mangle, og forsinkelse er en SAMMENLIKNING mellom to tidspunkter — ikke et
 * felt APIet gir oss.
 */

const NORWEGIAN = ['no', 'nb', 'nn'];

/**
 * Teksten i en situasjon.
 *
 * `summary` er en liste av `{ value, language }`. Norsk foretrekkes, men en
 * situasjon som bare finnes på engelsk skal vises på engelsk framfor å
 * forsvinne — en reisende som ser en fremmed tekst er bedre stilt enn en som
 * ikke vet at noe er annerledes.
 */
export function situationText(summary) {
    if (!Array.isArray(summary)) {
        return '';
    }
    const withText = summary.filter((entry) => entry && typeof entry.value === 'string');
    const norwegian = withText.find((entry) => NORWEGIAN.includes(String(entry.language).toLowerCase()));
    return (norwegian ?? withText[0])?.value ?? '';
}

export function toDeparture(estimatedCall) {
    const line = estimatedCall?.serviceJourney?.line ?? {};
    const aimedAt = toDate(estimatedCall?.aimedDepartureTime);
    return {
        lineCode: asText(line.publicCode),
        transportMode: asText(line.transportMode),
        destination: asText(estimatedCall?.destinationDisplay?.frontText),
        platform: asText(estimatedCall?.quay?.publicCode),
        aimedAt,
        expectedAt: toDate(estimatedCall?.expectedDepartureTime) ?? aimedAt,
        realtime: estimatedCall?.realtime === true,
        cancelled: estimatedCall?.cancellation === true,
        situation: situationText(estimatedCall?.situations?.[0]?.summary),
    };
}

export function toDepartures(stopPlace) {
    const calls = stopPlace?.estimatedCalls;
    return Array.isArray(calls) ? calls.map(toDeparture) : [];
}

/** Forsinket er forventet ETTER planlagt. Et tog før tida er ikke forsinket. */
export function isDelayed(departure) {
    const { aimedAt, expectedAt } = departure;
    if (!(aimedAt instanceof Date) || !(expectedAt instanceof Date)) {
        return false;
    }
    return expectedAt.getTime() > aimedAt.getTime();
}

function toDate(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function asText(value) {
    return typeof value === 'string' ? value : '';
}
