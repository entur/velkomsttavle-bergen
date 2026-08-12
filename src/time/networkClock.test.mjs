import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
    clockOffset,
    fetchServerTime,
    networkNow,
    resetClock,
    startClockSync,
} from './networkClock.js';

beforeEach(resetClock);

/** Et minimalt Response-lignende objekt. `headers.get` er alt modulen rører. */
function svar({ ok = true, date } = {}) {
    return { ok, headers: { get: (navn) => (navn.toLowerCase() === 'date' && date ? date : null) } };
}

describe('clockOffset', () => {
    it('gir differansen når serveren er foran enheten', () => {
        const server = new Date('2026-08-12T09:05:00Z');
        const enhet = new Date('2026-08-12T09:00:00Z');
        assert.equal(clockOffset(server, enhet), 5 * 60 * 1000);
    });

    it('gir negativ differanse når enheten går for fort', () => {
        // Dette er tilfellet på skjermen i resepsjonen: enheten er fem
        // minutter foran, så offsetten som retter den opp er negativ.
        const server = new Date('2026-08-12T09:00:00Z');
        const enhet = new Date('2026-08-12T09:05:00Z');
        assert.equal(clockOffset(server, enhet), -5 * 60 * 1000);
    });

    it('gir null når en av datoene mangler eller er ubrukelig', () => {
        const gyldig = new Date('2026-08-12T09:00:00Z');
        assert.equal(clockOffset(null, gyldig), null);
        assert.equal(clockOffset(gyldig, undefined), null);
        assert.equal(clockOffset(new Date('tull'), gyldig), null);
        assert.equal(clockOffset(gyldig, new Date('tull')), null);
        assert.equal(clockOffset('2026-08-12T09:00:00Z', gyldig), null);
    });
});

describe('fetchServerTime', () => {
    it('leser Date-headeren som en dato', async () => {
        const tid = await fetchServerTime({
            fetchImpl: async () => svar({ date: 'Wed, 12 Aug 2026 07:47:05 GMT' }),
        });
        assert.ok(tid instanceof Date);
        assert.equal(tid.toISOString(), '2026-08-12T07:47:05.000Z');
    });

    it('ber om HEAD uten cache', async () => {
        // `no-store` er ikke pynt: et svar fra cache ville båret en Date som
        // blir eldre for hver henting, og offsetten ville vokst med den.
        let sett = null;
        await fetchServerTime({
            fetchImpl: async (url, opts) => { sett = { url, opts }; return svar({ date: 'Wed, 12 Aug 2026 07:47:05 GMT' }); },
        });
        assert.equal(sett.opts.method, 'HEAD');
        assert.equal(sett.opts.cache, 'no-store');
    });

    it('gir null når headeren mangler', async () => {
        assert.equal(await fetchServerTime({ fetchImpl: async () => svar({}) }), null);
    });

    it('gir null når headeren ikke lar seg tolke', async () => {
        assert.equal(await fetchServerTime({ fetchImpl: async () => svar({ date: 'i går' }) }), null);
    });

    it('gir null på feilkode', async () => {
        assert.equal(await fetchServerTime({ fetchImpl: async () => svar({ ok: false, date: 'Wed, 12 Aug 2026 07:47:05 GMT' }) }), null);
    });

    it('gir null når kallet kaster', async () => {
        // Tavla står på et nett som kan falle ut. Den skal ikke stoppe av det.
        assert.equal(await fetchServerTime({ fetchImpl: async () => { throw new Error('nede'); } }), null);
    });
});

describe('networkNow', () => {
    it('er enhetens klokke før noen synkronisering', () => {
        const avvik = Math.abs(networkNow().getTime() - Date.now());
        assert.ok(avvik < 1000, `avvik ${avvik} ms`);
    });

    it('legger til offsetten etter synkronisering', async () => {
        const stopp = startClockSync({
            fetchTime: async () => new Date(Date.now() + 5 * 60 * 1000),
            setTimer: () => 1,
            clearTimer: () => {},
        });
        await null;
        const avvik = networkNow().getTime() - Date.now();
        assert.ok(Math.abs(avvik - 5 * 60 * 1000) < 1000, `avvik ${avvik} ms`);
        stopp();
    });
});

describe('startClockSync', () => {
    it('gjentar hentingen på intervallet', async () => {
        let hentinger = 0;
        let planlagt = null;
        const stopp = startClockSync({
            fetchTime: async () => { hentinger += 1; return new Date(); },
            intervalMs: 3600000,
            setTimer: (fn, ms) => { planlagt = { fn, ms }; return 1; },
            clearTimer: () => {},
        });
        await null;
        assert.equal(hentinger, 1);
        assert.equal(planlagt.ms, 3600000);

        planlagt.fn();
        await null;
        assert.equal(hentinger, 2);
        stopp();
    });

    it('beholder forrige offset når en henting feiler', async () => {
        let svar_ = new Date(Date.now() + 5 * 60 * 1000);
        let planlagt = null;
        const stopp = startClockSync({
            fetchTime: async () => svar_,
            setTimer: (fn) => { planlagt = fn; return 1; },
            clearTimer: () => {},
        });
        await null;
        const etterFørste = networkNow().getTime() - Date.now();

        svar_ = null;
        planlagt();
        await null;
        const etterFeil = networkNow().getTime() - Date.now();

        // En mislykket henting skal ikke kaste oss tilbake til enhetsklokka.
        assert.ok(Math.abs(etterFeil - etterFørste) < 1000, `${etterFørste} -> ${etterFeil}`);
        stopp();
    });

    it('slutter å planlegge etter stopp', async () => {
        let hentinger = 0;
        let ryddet = false;
        const stopp = startClockSync({
            fetchTime: async () => { hentinger += 1; return new Date(); },
            setTimer: () => 7,
            clearTimer: (id) => { ryddet = id === 7; },
        });
        await null;
        stopp();
        assert.equal(ryddet, true);
        assert.equal(hentinger, 1);
    });
});
