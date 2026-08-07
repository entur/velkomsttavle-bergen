/**
 * Tilgangslister: hvilke tavler én person har tilgang til.
 *
 * Tilgang lagres per bruker (`memberships/<e-post>`), ikke som en medlemsliste
 * på tavla. Grunnen er meldingene: én melding kan gjelde flere tavler, og
 * regelen må avgjøre om *alle* tavlene i lista er dine. Med tilgang lagret per
 * bruker er det ett oppslag og én listesammenlikning; med en medlemsliste per
 * tavle måtte reglene iterert over lista, og det kan de ikke.
 *
 * Uten Firebase-importer, slik at logikken kan testes med `node --test`.
 */
import { isValidBoardId } from '../boards/boardId.js';
import { ENTUR_DOMAIN, normalizeEmail } from '../admin/enturAccount.js';

/** Taket speiler firestore.rules. Endrer du det her, endre det der også. */
export const BOARDS_PER_USER_MAX = 100;

export function normalizeBoards(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const boards = [];
    for (const boardId of value) {
        if (isValidBoardId(boardId) && !boards.includes(boardId)) {
            boards.push(boardId);
        }
        if (boards.length === BOARDS_PER_USER_MAX) {
            break;
        }
    }
    return boards;
}

export function addBoard(boards, boardId) {
    if (!isValidBoardId(boardId) || boards.includes(boardId)) {
        return boards;
    }
    return [...boards, boardId];
}

export function removeBoard(boards, boardId) {
    return boards.filter((existing) => existing !== boardId);
}

/**
 * Om adressen kan gis tilgang. Returnerer feilmeldingen, eller null når alt er i
 * orden.
 *
 * Sjekken mot eksisterende medlemmer gjøres på normalisert form, slik at
 * «Kari@Entur.org» og «kari@entur.org» regnes som samme person — det er den
 * samme normaliseringen dokument-id-en og reglene bruker.
 */
export function validateGranteeEmail(email, existingMembers) {
    const normalized = normalizeEmail(email);
    if (normalized === '') {
        return 'Skriv en e-postadresse';
    }
    if (!normalized.endsWith(`@${ENTUR_DOMAIN}`)) {
        return `Adressen må være en @${ENTUR_DOMAIN}-adresse`;
    }
    if (existingMembers.some((member) => normalizeEmail(member) === normalized)) {
        return `${email} har allerede tilgang`;
    }
    return null;
}

/**
 * Om denne personen er den siste med tilgang.
 *
 * En tavle uten noen med tilgang må ordnes i Firebase-konsollet, så den siste
 * skal ikke kunne fjernes ved et uhell. Dette er kun for å gi en tydelig sperre
 * i grensesnittet — reglene kan ikke telle medlemmer, så håndhevingen finnes
 * ikke der.
 */
export function isLastMember(memberEmails, email) {
    const normalized = normalizeEmail(email);
    return memberEmails.length === 1 && normalizeEmail(memberEmails[0]) === normalized;
}
