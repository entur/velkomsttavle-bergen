export const ENTUR_DOMAIN = 'entur.org';

const ENTUR_SUFFIX = `@${ENTUR_DOMAIN}`;

/**
 * Om en innlogget bruker har en Entur-konto.
 *
 * Sjekken er på hele `@entur.org`-suffikset, ikke bare `entur.org`, slik at
 * verken `noen@ikkeentur.org` eller `noen@entur.org.example.com` slipper
 * gjennom. Subdomener under entur.org er også utenfor.
 *
 * Dette er kun for å gi god feilmelding tidlig — håndhevingen ligger i
 * firestore.rules, som klienten ikke kan omgå.
 */
export function isEnturUser(user) {
    const email = user?.email;
    if (typeof email !== 'string') {
        return false;
    }
    return email.toLowerCase().endsWith(ENTUR_SUFFIX);
}
