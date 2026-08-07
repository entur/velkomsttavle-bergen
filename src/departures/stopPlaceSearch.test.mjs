import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { searchStopPlaces } from './stopPlaceSearch.js';

function geocoderSvar(features) {
    return { ok: true, json: async () => ({ features }) };
}

function treff(id, label) {
    return { properties: { id, label } };
}

describe('searchStopPlaces', () => {
    it('gir id og etikett for hvert treff', async () => {
        const resultat = await searchStopPlaces('Bergen stasjon', {
            fetchImpl: async () => geocoderSvar([
                treff('NSR:StopPlace:59983', 'Bergen stasjon, Bergen'),
                treff('NSR:StopPlace:398', 'Arna stasjon, Bergen'),
            ]),
        });
        assert.deepEqual(resultat, [
            { id: 'NSR:StopPlace:59983', label: 'Bergen stasjon, Bergen' },
            { id: 'NSR:StopPlace:398', label: 'Arna stasjon, Bergen' },
        ]);
    });

    it('kaster treff som ikke er stoppesteder', async () => {
        const resultat = await searchStopPlaces('Bergen', {
            fetchImpl: async () => geocoderSvar([
                treff('NSR:StopPlace:59983', 'Bergen stasjon'),
                treff('NSR:Quay:1', 'En perrong'),
                treff(undefined, 'Uten id'),
            ]),
        });
        assert.equal(resultat.length, 1);
        assert.equal(resultat[0].id, 'NSR:StopPlace:59983');
    });

    it('sender ET-Client-Name og søketeksten', async () => {
        let sett = null;
        await searchStopPlaces('Bergen stasjon', {
            fetchImpl: async (url, options) => {
                sett = { url, options };
                return geocoderSvar([]);
            },
        });
        assert.match(sett.url, /geocoder\/v1\/autocomplete/);
        assert.match(sett.url, /text=Bergen%20stasjon/);
        assert.match(sett.url, /layers=venue/);
        assert.equal(sett.options.headers['ET-Client-Name'], 'entur-velkomsttavle');
    });

    it('gir tom liste for tomt søk, uten å ringe APIet', async () => {
        let kalt = false;
        const resultat = await searchStopPlaces('  ', {
            fetchImpl: async () => { kalt = true; return geocoderSvar([]); },
        });
        assert.deepEqual(resultat, []);
        assert.equal(kalt, false);
    });

    it('gir tom liste framfor å kaste når søket feiler', async () => {
        const resultat = await searchStopPlaces('Bergen', {
            fetchImpl: async () => { throw new Error('nede'); },
        });
        assert.deepEqual(resultat, []);
    });
});
