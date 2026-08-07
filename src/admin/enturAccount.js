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

/**
 * E-post på oppslagsform: trimmet og i små bokstaver.
 *
 * Dokument-ID-ene i `memberships` er lowercased, og firestore.rules slår opp med
 * `request.auth.token.email.lower()`. Klienten må normalisere likt, ellers
 * spriker klientens tilgangssjekk og reglenes.
 */
export function normalizeEmail(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/**
 * Om brukeren har en verifisert Entur-konto.
 *
 * `emailVerified` kreves fordi firestore.rules krever `email_verified == true`.
 * Uten den her ville klienten sluppet inn brukere som reglene avviser, og
 * feilen ville dukket opp først når man trykket lagre.
 */
export function isVerifiedEnturUser(user) {
    return isEnturUser(user) && user?.emailVerified === true;
}
