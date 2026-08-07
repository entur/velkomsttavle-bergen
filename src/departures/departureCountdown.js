/**
 * Nedtelling til avgang.
 *
 * Under grensen viser tavla «om 4 min», over den bare klokkeslettet. «Om 83
 * min» er ubrukelig informasjon, mens «om 4 min» er nettopp det man vil vite
 * når man står i billettkontoret og lurer på om man rekker toget.
 *
 * Kalleren skal regne fra FORVENTET tid, ikke planlagt. Et tog som er ti
 * minutter forsinket skal si «om 13 min», ikke «om 3 min» — ellers teller
 * tavla ned til et tidspunkt som ikke finnes.
 */

export const COUNTDOWN_THRESHOLD_MINUTES = 20;

/** Hele minutter til tidspunktet, eller null om datoen ikke er brukbar. */
export function minutesUntil(expectedAt, now) {
    if (!(expectedAt instanceof Date) || Number.isNaN(expectedAt.getTime())) {
        return null;
    }
    return Math.floor((expectedAt.getTime() - now.getTime()) / 60000);
}

/** Teksten i avgangskolonnen, eller null når klokkeslettet skal stå alene. */
export function countdownLabel(expectedAt, now) {
    const minutes = minutesUntil(expectedAt, now);
    if (minutes === null || minutes < 0 || minutes > COUNTDOWN_THRESHOLD_MINUTES) {
        return null;
    }
    return minutes === 0 ? 'nå' : `om ${minutes} min`;
}
