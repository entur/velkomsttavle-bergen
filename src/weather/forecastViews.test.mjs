import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dailyForecast, hourlyForecast, nowSummary } from './forecastViews.mjs';

/** Én oppføring i timeseriene, med bare feltene modulen leser. */
function entry(time, { temp = 10, wind = 3, precip = 0, symbol = 'clearsky_day', next6 } = {}) {
    return {
        time,
        data: {
            instant: { details: { air_temperature: temp, wind_speed: wind } },
            next_1_hours: symbol === null
                ? undefined
                : { summary: { symbol_code: symbol }, details: { precipitation_amount: precip } },
            next_6_hours: next6 ? { summary: { symbol_code: next6 } } : undefined,
        },
    };
}

describe('nowSummary', () => {
    it('leser temperatur, vind, nedbør og symbol fra første oppføring', () => {
        const result = nowSummary([entry('2026-08-10T09:00:00Z', { temp: 18, wind: 4, precip: 0.5 })]);
        assert.deepEqual(result, {
            symbol: 'clearsky_day', temperature: 18, wind: 4, precipitation: 0.5,
        });
    });

    it('faller tilbake til seks-timers-symbolet når én time mangler', () => {
        const result = nowSummary([entry('2026-08-10T09:00:00Z', { symbol: null, next6: 'cloudy' })]);
        assert.equal(result.symbol, 'cloudy');
        // Nedbør ligger bare på next_1_hours. Uten den er 0 riktigere enn undefined:
        // stripa skal vise «0 mm», ikke et tomt felt.
        assert.equal(result.precipitation, 0);
    });

    it('gir null uten data', () => {
        assert.equal(nowSummary([]), null);
        assert.equal(nowSummary(undefined), null);
    });
});

describe('hourlyForecast', () => {
    it('hopper over inneværende time og gir så mange som bedt om', () => {
        const series = Array.from({ length: 10 }, (_, i) =>
            entry(`2026-08-10T${String(9 + i).padStart(2, '0')}:00:00Z`, { temp: i }));
        const result = hourlyForecast(series, 3);
        assert.equal(result.length, 3);
        assert.equal(result[0].time, '2026-08-10T10:00:00Z');
        assert.equal(result[0].temperature, 1);
    });

    it('gir tom liste når det bare finnes inneværende time', () => {
        assert.deepEqual(hourlyForecast([entry('2026-08-10T09:00:00Z')], 6), []);
    });
});

describe('dailyForecast', () => {
    const now = new Date('2026-08-10T09:00:00Z');

    it('hopper over resten av dagen now peker på', () => {
        const series = [
            entry('2026-08-10T12:00:00Z', { temp: 20 }),
            entry('2026-08-11T12:00:00Z', { temp: 15 }),
        ];
        const result = dailyForecast(series, 4, now);
        assert.equal(result.length, 1);
        assert.equal(result[0].max, 15);
    });

    it('gir min og max for hele dagen, og ukedagen på norsk', () => {
        const series = [
            entry('2026-08-11T06:00:00Z', { temp: 9 }),
            entry('2026-08-11T12:00:00Z', { temp: 21 }),
            entry('2026-08-11T18:00:00Z', { temp: 14 }),
        ];
        const [dag] = dailyForecast(series, 4, now);
        assert.equal(dag.min, 9);
        assert.equal(dag.max, 21);
        assert.equal(dag.weekday, 'tir');
    });

    it('respekterer antallet dager', () => {
        const series = Array.from({ length: 8 }, (_, i) =>
            entry(`2026-08-${String(11 + i).padStart(2, '0')}T12:00:00Z`));
        assert.equal(dailyForecast(series, 4, now).length, 4);
    });

    // Sent på kvelden finnes det bare data for i dag. Stripa faller da tilbake
    // til bare timesvisningen, og det er denne tomme lista som utløser det.
    it('gir tom liste når det bare finnes data for i dag', () => {
        assert.deepEqual(dailyForecast([entry('2026-08-10T23:00:00Z')], 4, now), []);
    });
});
