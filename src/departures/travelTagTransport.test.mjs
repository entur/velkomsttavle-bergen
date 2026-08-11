import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TravelTag } from '@entur/travel';

import { travelTagTransport } from './travelTagTransport.js';

/** Hele TransportMode-enumet i Journey Planner v3, sondert mot skjemaet. */
const ENTUR_MODES = [
    'air', 'bus', 'cableway', 'water', 'funicular', 'lift',
    'rail', 'metro', 'taxi', 'tram', 'trolleybus', 'monorail', 'coach', 'unknown',
];

function rendrer(transport) {
    return renderToStaticMarkup(createElement(TravelTag, { transport }, '51'));
}

describe('travelTagTransport — krasjsperre', () => {
    it('gir en verdi TravelTag godtar for hver TransportMode Entur kan sende', () => {
        // Dette er hele grunnen til at modulen finnes. getTransportStyle
        // kaster på ukjente verdier, og Departures ville forsvunnet fra
        // karusellen på første regionbuss.
        for (const mode of ENTUR_MODES) {
            assert.doesNotThrow(() => rendrer(travelTagTransport(mode)), `transportMode ${mode}`);
        }
    });

    it('tåler søppel og manglende verdi', () => {
        for (const rot of ['', 'hyperloop', 'scooter', 'bike', 'car', 'foot', null, undefined, 42, {}]) {
            assert.doesNotThrow(() => rendrer(travelTagTransport(rot)), `verdi ${String(rot)}`);
        }
    });

    it('beviser at sperra faktisk sperrer', () => {
        // Negativ kontroll. Uten den er testen over verdiløs: den ville
        // passert selv om travelTagTransport var en ren passthrough.
        for (const farlig of ['coach', 'lift', 'monorail', 'trolleybus', 'unknown']) {
            assert.throws(() => rendrer(farlig), /select a transport/, `${farlig} skulle kastet urørt`);
        }
        assert.throws(() => rendrer('scooter'), /deprecated/);
    });
});

describe('travelTagTransport — oversettelsen', () => {
    it('slipper gjennom middel TravelTag kjenner fra før', () => {
        for (const mode of ['air', 'bus', 'cableway', 'water', 'funicular', 'rail', 'metro', 'taxi', 'tram']) {
            assert.equal(travelTagTransport(mode), mode);
        }
    });

    it('oversetter middel TravelTag ikke har egen sak for', () => {
        assert.equal(travelTagTransport('coach'), 'bus');
        assert.equal(travelTagTransport('trolleybus'), 'bus');
        assert.equal(travelTagTransport('monorail'), 'metro');
        assert.equal(travelTagTransport('lift'), 'cableway');
    });

    it('gir none for ukjent, tomt og ikke-streng', () => {
        assert.equal(travelTagTransport('unknown'), 'none');
        assert.equal(travelTagTransport('hyperloop'), 'none');
        assert.equal(travelTagTransport(''), 'none');
        assert.equal(travelTagTransport(null), 'none');
        assert.equal(travelTagTransport(undefined), 'none');
        assert.equal(travelTagTransport(42), 'none');
    });

    it('sender aldri de utgåtte verdiene videre', () => {
        // scooter, bike, car og foot har egne grener som kaster med
        // «deprecated». De skal aldri kunne komme ut av oppslagstabellen.
        for (const utgaatt of ['scooter', 'bike', 'car', 'foot']) {
            assert.equal(travelTagTransport(utgaatt), 'none');
        }
    });
});
