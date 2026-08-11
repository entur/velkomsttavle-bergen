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
        platformChanged: isPlatformChanged(estimatedCall),
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

/**
 * Sant når toget går fra et annet spor enn planlagt.
 *
 * Journey Planner v3 har ikke noe felt for dette — hverken `platformChanged`
 * eller liknende finnes på `EstimatedCall`. Sondert mot skjemaet.
 *
 * Utledningen: `serviceJourney.quays` er kvaiene i rutemønsteret, altså
 * planverket, og `stopPositionInPattern` peker inn i den lista.
 * `estimatedCall.quay` er den sanntid faktisk gir. Er de ulike, er sporet endret.
 *
 * Ulikhet er det ENESTE som utløser gult. Mangler rutemønsteret, peker
 * posisjonen utenfor lista, eller er en av id-ene tom, er svaret `false`. En
 * tavle som ikke vet, skal ikke rope.
 *
 * Merk at sammenlikninga går på kvai-id og ikke `publicCode`: to ulike kvaier
 * kan ha samme spornummer på hvert sitt stoppested.
 */
export function isPlatformChanged(estimatedCall) {
    const quays = estimatedCall?.serviceJourney?.quays;
    const position = estimatedCall?.stopPositionInPattern;
    if (!Array.isArray(quays) || !Number.isInteger(position)) {
        return false;
    }
    const planned = asText(quays[position]?.id);
    const actual = asText(estimatedCall?.quay?.id);
    return planned !== '' && actual !== '' && planned !== actual;
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
