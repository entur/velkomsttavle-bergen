import { doc, getDoc } from 'firebase/firestore';

import { db } from '../alerts/firebase.js';
import { isVerifiedEnturUser, normalizeEmail } from './enturAccount.js';

const COLLECTION = 'admins';

/**
 * Om brukeren står i `admins`-allowlisten.
 *
 * Dokument-ID-en er e-posten i små bokstaver; innholdet spiller ingen rolle, det
 * er eksistensen som gir tilgang. Reglene tillater bare å lese sitt eget
 * dokument, så et negativt svar kan like gjerne være «finnes ikke» som
 * «ikke lov å lese» — begge betyr ingen tilgang, og vi behandler dem likt.
 *
 * Dette er kun for å gi en tydelig skjerm tidlig. Håndhevingen ligger i
 * firestore.rules.
 */
export async function hasAdminAccess(user) {
    if (!isVerifiedEnturUser(user)) {
        return false;
    }
    try {
        const snapshot = await getDoc(doc(db, COLLECTION, normalizeEmail(user.email)));
        return snapshot.exists();
    } catch (error) {
        console.error('Kunne ikke sjekke admin-tilgang', error);
        return false;
    }
}
