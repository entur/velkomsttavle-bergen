import {
    GoogleAuthProvider,
    browserLocalPersistence,
    connectAuthEmulator,
    getAuth,
    getRedirectResult,
    onAuthStateChanged,
    setPersistence,
    signInWithRedirect,
    signOut,
} from 'firebase/auth';

import { app } from '../alerts/firebase.js';
import { ENTUR_DOMAIN, isVerifiedEnturUser } from './enturAccount.js';

export const auth = getAuth(app);

if (import.meta.env.VITE_USE_EMULATOR === 'true') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

/**
 * Lagre sesjonen i localStorage, ikke IndexedDB.
 *
 * Firebase sin IndexedDB-lagring nekter å åpne databasen når sida har vært
 * skjult under innloggingsflyten, og kaster «Database is closing/hidden». Det
 * traff oss i produksjon: Google-innloggingen gikk gjennom og brukeren ble
 * opprettet, men sesjonen kunne ikke lagres, så `onAuthStateChanged` fyrte
 * aldri og man ble stående på påloggingsskjermen.
 *
 * localStorage har ingen slik vakt. Vi mister muligheten for delt sesjon med
 * service workers, som vi ikke bruker.
 */
const persistenceReady = setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('Kunne ikke sette localStorage-persistens', error);
});

/**
 * Starter innlogging med Google. `hd` sender brukeren rett til Entur-kontoen sin
 * i stedet for kontovelgeren.
 *
 * Redirect, ikke popup. Popup-flyten gjør fanen bak til en skjult side mens
 * Google-vinduet har fokus, og det er nettopp det som utløste feilen over. En
 * redirect navigerer bort og tilbake, så sesjonen lagres under en helt vanlig
 * sidelast. Admin-siden mister ingenting på en full navigering.
 *
 * Returnerer ingen bruker: nettleseren navigerer bort. Resultatet plukkes opp
 * av `completeSignIn` når vi kommer tilbake.
 */
export async function signIn() {
    await persistenceReady;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: ENTUR_DOMAIN });
    await signInWithRedirect(auth, provider);
}

/**
 * Fullfører en redirect-innlogging. Kalles én gang når admin-siden lastes.
 *
 * Returnerer `null` når vi ikke kommer tilbake fra en innlogging — det vanlige
 * tilfellet. Er kontoen ikke en verifisert Entur-konto, logges den ut igjen og
 * feilen kastes; reglene ville avvist skrivingen uansett, men det er dårlig UX
 * å oppdage det først når man trykker lagre.
 */
export async function completeSignIn() {
    await persistenceReady;
    const result = await getRedirectResult(auth);
    if (!result) {
        return null;
    }
    if (!isVerifiedEnturUser(result.user)) {
        await signOut(auth);
        throw new Error(`Du må logge inn med en verifisert @${ENTUR_DOMAIN}-konto.`);
    }
    return result.user;
}

export function signOutUser() {
    return signOut(auth);
}

/** Kaller onUser med brukeren, eller null hvis ingen gyldig Entur-bruker. */
export function subscribeToUser(onUser) {
    return onAuthStateChanged(auth, (user) => onUser(isVerifiedEnturUser(user) ? user : null));
}
