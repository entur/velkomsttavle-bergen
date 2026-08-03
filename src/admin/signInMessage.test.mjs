import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { signInMessage } from './signInMessage.js';

describe('signInMessage', () => {
    it('slipper gjennom egne feil uten kode', () => {
        const own = new Error('Du må logge inn med en verifisert @entur.org-konto.');
        assert.equal(signInMessage(own), 'Du må logge inn med en verifisert @entur.org-konto.');
    });

    it('forklarer blokkert innloggingsvindu', () => {
        const message = signInMessage({ code: 'auth/popup-blocked' });
        assert.match(message, /lukket eller blokkert/);
    });

    it('forklarer manglende Google-oppsett', () => {
        const message = signInMessage({ code: 'auth/operation-not-allowed' });
        assert.match(message, /ikke satt opp/);
    });

    it('forklarer ikke-godkjent domene', () => {
        const message = signInMessage({ code: 'auth/unauthorized-domain' });
        assert.match(message, /ikke godkjent/);
    });

    it('forklarer nettverksfeil', () => {
        const message = signInMessage({ code: 'auth/network-request-failed' });
        assert.match(message, /nettforbindelsen/);
    });

    it('lekker aldri en intern Firebase-melding for en ukjent kode', () => {
        const internal = {
            code: 'auth/internal-error',
            message: 'Database is closing/hidden',
        };
        const message = signInMessage(internal);
        assert.doesNotMatch(message, /Database is closing/);
        assert.match(message, /Innlogging feilet/);
    });

    it('tåler null og undefined', () => {
        assert.match(signInMessage(null), /Innlogging feilet/);
        assert.match(signInMessage(undefined), /Innlogging feilet/);
    });
});
