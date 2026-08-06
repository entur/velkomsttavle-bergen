import { collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, where } from 'firebase/firestore';

import { db } from '../alerts/firebase.js';
import { normalizeEmail } from '../admin/enturAccount.js';
import { addBoard, normalizeBoards, removeBoard } from './memberships.js';

const COLLECTION = 'memberships';

/** Live-abonnement på dine egne tavler. Tom liste når oppføringen mangler. */
export function subscribeToMyBoardIds(email, onIds, onError) {
    return onSnapshot(
        doc(db, COLLECTION, normalizeEmail(email)),
        (snapshot) => onIds(snapshot.exists() ? normalizeBoards(snapshot.data().boards) : []),
        onError,
    );
}

export function fetchMyBoardIds(email) {
    return fetchBoardIdsFor(normalizeEmail(email));
}

/**
 * Hvem som har tilgang til en tavle.
 *
 * Tilgang er lagret per bruker, så dette er en spørring, ikke et oppslag.
 * `array-contains` alene trenger ingen sammensatt indeks. Reglene tillater
 * spørringen fordi hvert dokument i svaret deler en tavle med deg.
 */
export async function fetchMemberEmails(boardId) {
    const members = query(collection(db, COLLECTION), where('boards', 'array-contains', boardId));
    const snapshot = await getDocs(members);
    return snapshot.docs.map((document) => document.id);
}

/**
 * Les-så-skriv, ikke arrayUnion.
 *
 * Reglene sammenlikner hele lista før og etter, og en les-så-skriv gjør det
 * åpenbart hva som faktisk skrives. Kappløpet det åpner for — to personer som
 * gir tilgang til samme person i samme sekund — er ikke en reell risiko på
 * 5–20 tavler, og verste utfall er at den ene må gjøre det om igjen.
 */
export async function grantAccess(granteeEmail, boardId) {
    const email = normalizeEmail(granteeEmail);
    const current = await fetchBoardIdsFor(email);
    await setDoc(doc(db, COLLECTION, email), { boards: addBoard(current, boardId) }, { merge: true });
}

export async function revokeAccess(granteeEmail, boardId) {
    const email = normalizeEmail(granteeEmail);
    const current = await fetchBoardIdsFor(email);
    await setDoc(doc(db, COLLECTION, email), { boards: removeBoard(current, boardId) }, { merge: true });
}

/**
 * Gjør krav på en tavle du nettopp opprettet.
 *
 * `claiming` er feltet regelen slår opp for å bekrefte at `createdBy` på tavla
 * er deg. Uten det ville din første tavle vært umulig å få tilgang til: du har
 * ingen tavler ennå, og regelen krever at det du legger til er en du har.
 *
 * Feltet blir liggende i dokumentet etterpå. Det er ufarlig: regelen godtar bare
 * et krav på din egen oppføring, og bare når `createdBy` på den tavla er deg. En
 * gammel verdi kan derfor ikke gi noen tilgang til noe.
 */
export async function claimBoard(email, boardId) {
    const normalized = normalizeEmail(email);
    const current = await fetchBoardIdsFor(normalized);
    await setDoc(
        doc(db, COLLECTION, normalized),
        { boards: addBoard(current, boardId), claiming: boardId },
        { merge: true },
    );
}

/**
 * Andres liste kan vi bare lese når vi deler en tavle. Klarer vi ikke lese den,
 * behandler vi den som tom — reglene avviser uansett en skriving som ville lagt
 * til eller fjernet noe vi ikke rår over.
 */
async function fetchBoardIdsFor(email) {
    try {
        const snapshot = await getDoc(doc(db, COLLECTION, email));
        return snapshot.exists() ? normalizeBoards(snapshot.data().boards) : [];
    } catch (error) {
        console.warn('Kunne ikke lese tilgangslista', error);
        return [];
    }
}
