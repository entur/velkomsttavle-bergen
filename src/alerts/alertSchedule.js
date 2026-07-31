import { levelWeight } from './alertLevels.js';

/**
 * Statusen til et varsel på et gitt tidspunkt.
 *
 * Tidsrommet er halvåpent, [startsAt, endsAt): et varsel med startsAt lik now
 * vises, et med endsAt lik now gjør det ikke. endsAt === null betyr åpen slutt.
 *
 * Rekkefølgen på sjekkene er meningsbærende: utløpt slår av-bryteren, fordi et
 * varsel som er ferdig er ferdig uansett om bryteren står på.
 */
export function alertStatus(alert, now) {
    const startsAt = timeOf(alert.startsAt);
    if (startsAt === null) {
        // Et dokument uten gyldig starttid kan vi ikke tidfeste. Regn det som
        // ferdig framfor å vise noe vi ikke vet rekkevidden av.
        return 'expired';
    }

    const endsAt = timeOf(alert.endsAt);
    if (endsAt !== null && endsAt <= now.getTime()) {
        return 'expired';
    }
    if (alert.enabled !== true) {
        return 'disabled';
    }
    if (startsAt > now.getTime()) {
        return 'planned';
    }
    return 'visible';
}

/** Varslene som skal stå på tavla nå, alvorligste og nyeste først. */
export function selectVisibleAlerts(alerts, now) {
    return alerts
        .filter((alert) => alertStatus(alert, now) === 'visible')
        .sort(compareAlerts);
}

/** Alle varsler fordelt på status, for admin-listen. */
export function groupAlertsByStatus(alerts, now) {
    const groups = { visible: [], planned: [], disabled: [], expired: [] };
    for (const alert of alerts) {
        groups[alertStatus(alert, now)].push(alert);
    }
    for (const key of Object.keys(groups)) {
        groups[key].sort(compareAlerts);
    }
    return groups;
}

function compareAlerts(a, b) {
    const byLevel = levelWeight(a.level) - levelWeight(b.level);
    if (byLevel !== 0) {
        return byLevel;
    }
    return (timeOf(b.startsAt) ?? 0) - (timeOf(a.startsAt) ?? 0);
}

function timeOf(value) {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        return null;
    }
    return value.getTime();
}
