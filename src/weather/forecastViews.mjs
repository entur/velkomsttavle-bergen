/**
 * Avledningene begge værvisningene trenger: nå-kortet, timesstripa og dagsraden.
 *
 * Uten JSX og uten nettverk, slik at de kan testes med `node --test` — samme
 * grep som `playbackWatchdog.mjs`. Både `Weather` (karusellen) og
 * `WeatherStripe` (bunnstripa) leser de samme tre funksjonene, slik at
 * visningene ikke kan komme til å vise ulike tall for samme varsel.
 */

const WEEKDAYS = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];

/** Symbolet for en oppføring: én time først, ellers seks. */
function symbolOf(entry) {
    return entry.data.next_1_hours?.summary?.symbol_code
        || entry.data.next_6_hours?.summary?.symbol_code
        || null;
}

/** Løst fra Date-objektet til UTC-datostrengen "YYYY-MM-DD", invariant mot tidssone. */
function getUTCDateKey(date) {
    return date.toISOString().split('T')[0];
}

/**
 * Været akkurat nå, eller null når det ikke finnes data.
 *
 * Nedbør ligger bare på `next_1_hours`. Mangler den, er 0 riktigere enn
 * undefined: visningene skal vise «0 mm», ikke et tomt felt.
 */
export function nowSummary(timeseries) {
    const list = Array.isArray(timeseries) ? timeseries : [];
    const now = list[0];
    if (!now) {
        return null;
    }
    return {
        symbol: symbolOf(now),
        temperature: now.data.instant.details.air_temperature,
        wind: now.data.instant.details.wind_speed,
        precipitation: now.data.next_1_hours?.details?.precipitation_amount ?? 0,
    };
}

/** De neste timene. Inneværende time hoppes over — den dekkes av nå-kortet. */
export function hourlyForecast(timeseries, hours = 6) {
    const list = Array.isArray(timeseries) ? timeseries : [];
    return list.slice(1, 1 + hours).map((entry) => ({
        time: entry.time,
        symbol: symbolOf(entry),
        temperature: entry.data.instant.details.air_temperature,
        precipitation: entry.data.next_1_hours?.details?.precipitation_amount ?? 0,
    }));
}

/**
 * De neste dagene, gruppert per lokale dato.
 *
 * Resten av inneværende dag hoppes over — den dekkes av nå-kortet og
 * timesstripa. Sent på kvelden betyr det at lista kan bli tom, og visningene
 * må tåle det.
 *
 * `now` er en parameter og ikke `new Date()` her inne, slik at regelen over kan
 * testes uten å vente til midnatt.
 */
export function dailyForecast(timeseries, days = 4, now = new Date()) {
    const list = Array.isArray(timeseries) ? timeseries : [];
    const byDate = new Map();
    for (const entry of list) {
        const date = new Date(entry.time);
        const key = getUTCDateKey(date);
        if (!byDate.has(key)) {
            byDate.set(key, { date, entries: [] });
        }
        byDate.get(key).entries.push(entry);
    }

    const todayKey = getUTCDateKey(now);
    const result = [];
    for (const { date, entries } of byDate.values()) {
        if (getUTCDateKey(date) === todayKey) {
            continue;
        }
        const temps = entries.map((entry) => entry.data.instant.details.air_temperature);
        // Symbolet fra oppføringen nærmest kl. 12 representerer dagen bedre enn
        // den første, som ofte er natt.
        const midday = entries.reduce((best, entry) => (
            Math.abs(new Date(entry.time).getHours() - 12)
                < Math.abs(new Date(best.time).getHours() - 12) ? entry : best
        ));
        result.push({
            date,
            weekday: WEEKDAYS[date.getDay()],
            max: Math.max(...temps),
            min: Math.min(...temps),
            symbol: midday.data.next_6_hours?.summary?.symbol_code
                || midday.data.next_12_hours?.summary?.symbol_code
                || midday.data.next_1_hours?.summary?.symbol_code
                || null,
        });
        if (result.length >= days) {
            break;
        }
    }
    return result;
}
