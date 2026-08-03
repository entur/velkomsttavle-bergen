/**
 * Feilmelding til bruker for en innloggingsfeil.
 *
 * Firebase sine interne meldinger er ikke brukertekst — vi fikk «Database is
 * closing/hidden» rett i ansiktet i produksjon. Kjente koder får en norsk
 * forklaring; alt annet får en generisk melding, og detaljen logges av kallstedet.
 *
 * Feil vi kaster selv, som domenesjekken, har ingen `code` og slipper gjennom med
 * sin egen tekst.
 */
export function signInMessage(error) {
    if (!error?.code) {
        return error?.message ?? FALLBACK;
    }

    switch (error.code) {
        case 'auth/popup-blocked':
        case 'auth/popup-closed-by-user':
        case 'auth/cancelled-popup-request':
            return 'Innloggingsvinduet ble lukket eller blokkert. Prøv igjen.';
        case 'auth/operation-not-allowed':
        case 'auth/configuration-not-found':
            return 'Google-innlogging er ikke satt opp for denne appen. Kontakt de som drifter tavla.';
        case 'auth/unauthorized-domain':
            return 'Denne adressen er ikke godkjent for innlogging. Kontakt de som drifter tavla.';
        case 'auth/network-request-failed':
            return 'Fikk ikke kontakt med Google. Sjekk nettforbindelsen og prøv igjen.';
        case 'auth/too-many-requests':
            return 'For mange forsøk. Vent litt og prøv igjen.';
        default:
            return FALLBACK;
    }
}

const FALLBACK = 'Innlogging feilet. Prøv igjen, eller kontakt de som drifter tavla.';
