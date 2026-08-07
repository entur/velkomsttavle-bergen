import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ET_CLIENT_NAME, fetchDepartures, startDeparturePolling } from './enturDepartures.js';

function svar(estimatedCalls) {
    return {
        ok: true,
        json: async () => ({ data: { stopPlace: { name: 'Bergen stasjon', estimatedCalls } } }),
    };
}

const EN_AVGANG = [{
    realtime: true,
    cancellation: false,
    aimedDepartureTime: '2026-08-07T10:27:00+02:00',
    expectedDepartureTime: '2026-08-07T10:27:00+02:00',
    destinationDisplay: { frontText: 'Arna' },
    quay: { publicCode: '1' },
    situations: [],
    serviceJourney: { line: { publicCode: 'L4', transportMode: 'rail' } },
}];

describe('fetchDepartures', () => {
    it('sender ET-Client-Name, som Entur krever', async () => {
        let sett = null;
        await fetchDepartures('NSR:StopPlace:59983', {
            fetchImpl: async (url, options) => {
                sett = { url, options };
                return svar(EN_AVGANG);
            },
        });
        assert.match(sett.url, /journey-planner\/v3\/graphql$/);
        assert.equal(sett.options.method, 'POST');
        assert.equal(sett.options.headers['ET-Client-Name'], ET_CLIENT_NAME);
        assert.equal(sett.options.headers['Content-Type'], 'application/json');
    });

    it('sender stoppestedet som variabel og ber om innstilte avganger', async () => {
        let body = null;
        await fetchDepartures('NSR:StopPlace:59983', {
            fetchImpl: async (_url, options) => {
                body = JSON.parse(options.body);
                return svar(EN_AVGANG);
            },
        });
        assert.equal(body.variables.stopPlaceId, 'NSR:StopPlace:59983');
        assert.match(body.query, /includeCancelledTrips:\s*true/);
        // `cancelled` finnes ikke på EstimatedCall i v3 og gir valideringsfeil.
        assert.doesNotMatch(body.query, /\bcancelled\b/);
    });

    it('gir mappede avganger', async () => {
        const { departures } = await fetchDepartures('NSR:StopPlace:59983', {
            fetchImpl: async () => svar(EN_AVGANG),
        });
        assert.equal(departures.length, 1);
        assert.equal(departures[0].lineCode, 'L4');
        assert.equal(departures[0].destination, 'Arna');
    });

    it('gir tom liste når stoppestedet ikke finnes', async () => {
        const { departures } = await fetchDepartures('NSR:StopPlace:1', {
            fetchImpl: async () => ({ ok: true, json: async () => ({ data: { stopPlace: null } }) }),
        });
        assert.deepEqual(departures, []);
    });

    it('gir null framfor å kaste ved nettverksfeil', async () => {
        const { departures } = await fetchDepartures('NSR:StopPlace:59983', {
            fetchImpl: async () => { throw new Error('nede'); },
        });
        assert.equal(departures, null);
    });

    it('gir null ved feilkode og ved GraphQL-feil', async () => {
        const feilkode = await fetchDepartures('NSR:StopPlace:59983', {
            fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }),
        });
        assert.equal(feilkode.departures, null);

        const graphqlFeil = await fetchDepartures('NSR:StopPlace:59983', {
            fetchImpl: async () => ({ ok: true, json: async () => ({ errors: [{ message: 'nei' }] }) }),
        });
        assert.equal(graphqlFeil.departures, null);
    });

    it('avviser en id som ikke er et stoppested uten å ringe APIet', async () => {
        let kalt = false;
        const { departures } = await fetchDepartures('tull', {
            fetchImpl: async () => { kalt = true; return svar([]); },
        });
        assert.equal(departures, null);
        assert.equal(kalt, false);
    });
});

describe('startDeparturePolling', () => {
    function rigg() {
        const timers = [];
        return {
            timers,
            setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
            clearTimer: (id) => { timers[id - 1] = null; },
        };
    }

    it('henter én gang med en gang og rapporterer', async () => {
        const rapportert = [];
        const { setTimer, clearTimer } = rigg();
        startDeparturePolling({
            stopPlaceId: 'NSR:StopPlace:59983',
            onData: (d) => rapportert.push(d),
            fetchDepartures: async () => ({ departures: [{ lineCode: 'L4' }] }),
            setTimer,
            clearTimer,
        });
        await Promise.resolve();
        await Promise.resolve();
        assert.equal(rapportert.length, 1);
        assert.equal(rapportert[0][0].lineCode, 'L4');
    });

    it('planlegger neste henting etter intervallet', async () => {
        const { timers, setTimer, clearTimer } = rigg();
        startDeparturePolling({
            stopPlaceId: 'NSR:StopPlace:59983',
            onData: () => {},
            fetchDepartures: async () => ({ departures: [] }),
            intervalMs: 60000,
            setTimer,
            clearTimer,
        });
        await Promise.resolve();
        await Promise.resolve();
        assert.equal(timers[0].ms, 60000);
    });

    it('beholder forrige liste når en henting feiler', async () => {
        const rapportert = [];
        const { setTimer, clearTimer } = rigg();
        startDeparturePolling({
            stopPlaceId: 'NSR:StopPlace:59983',
            onData: (d) => rapportert.push(d),
            fetchDepartures: async () => ({ departures: null }),
            setTimer,
            clearTimer,
        });
        await Promise.resolve();
        await Promise.resolve();
        assert.equal(rapportert.length, 0);
    });

    it('stopp hindrer at en henting underveis rapporterer', async () => {
        const rapportert = [];
        const { setTimer, clearTimer } = rigg();
        const stopp = startDeparturePolling({
            stopPlaceId: 'NSR:StopPlace:59983',
            onData: (d) => rapportert.push(d),
            fetchDepartures: async () => ({ departures: [] }),
            setTimer,
            clearTimer,
        });
        stopp();
        await Promise.resolve();
        await Promise.resolve();
        assert.equal(rapportert.length, 0);
    });
});
