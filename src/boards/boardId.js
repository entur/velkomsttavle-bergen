/**
 * Tavle-id: den delen av URL-en skjermen peker på.
 *
 * Snevert tegnsett med vilje — id-en står i en adresse som skal tastes inn på en
 * kiosk, og en id med mellomrom eller store bokstaver er en felle. Må stemme med
 * regexen i `parseRoute`, som ellers ikke finner tavla. Det er dekket av en test.
 */

export const BOARD_ID_MAX_LENGTH = 40;

const VALID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Norske bokstaver skrives om framfor å kastes: «Tøyen» skal bli «toeyen», ikke
// «tyen». Må skje før den generelle opprydningen, som ellers spiser dem.
const TRANSLITERATIONS = [
    [/æ/g, 'ae'],
    [/ø/g, 'oe'],
    [/å/g, 'aa'],
];

export function suggestBoardId(name) {
    if (typeof name !== 'string') {
        return '';
    }

    let slug = name.toLowerCase();
    for (const [pattern, replacement] of TRANSLITERATIONS) {
        slug = slug.replace(pattern, replacement);
    }
    slug = slug
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '') // é → e
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    if (slug.length <= BOARD_ID_MAX_LENGTH) {
        return slug;
    }
    // Klipp, og fjern en bindestrek som havnet i enden av klippet.
    return slug.slice(0, BOARD_ID_MAX_LENGTH).replace(/-+$/, '');
}

export function isValidBoardId(value) {
    return typeof value === 'string'
        && value.length > 0
        && value.length <= BOARD_ID_MAX_LENGTH
        && VALID.test(value);
}
