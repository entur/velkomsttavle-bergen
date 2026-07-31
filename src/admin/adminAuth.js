import {
    GoogleAuthProvider,
    connectAuthEmulator,
    getAuth,
    onAuthStateChanged,
    signInWithPopup,
    signOut,
} from 'firebase/auth';

import { app } from '../alerts/firebase.js';
import { ENTUR_DOMAIN, isEnturUser } from './enturAccount.js';

export const auth = getAuth(app);

if (import.meta.env.VITE_USE_EMULATOR === 'true') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

/**
 * Logger inn med Google. `hd` sender brukeren rett til Entur-kontoen sin i
 * stedet for kontovelgeren.
 *
 * Er kontoen ikke en Entur-konto, logges den ut igjen umiddelbart. Reglene
 * ville avvist skrivingen uansett, men det er dårlig UX å oppdage det først
 * når man trykker lagre.
 */
export async function signIn() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: ENTUR_DOMAIN });

    const result = await signInWithPopup(auth, provider);
    if (!isEnturUser(result.user)) {
        await signOut(auth);
        throw new Error(`Du må logge inn med en @${ENTUR_DOMAIN}-konto.`);
    }
    return result.user;
}

export function signOutUser() {
    return signOut(auth);
}

/** Kaller onUser med brukeren, eller null hvis ingen gyldig Entur-bruker. */
export function subscribeToUser(onUser) {
    return onAuthStateChanged(auth, (user) => onUser(isEnturUser(user) ? user : null));
}
