import {
    GoogleAuthProvider,
    browserLocalPersistence,
    connectAuthEmulator,
    getAuth,
    onAuthStateChanged,
    setPersistence,
    signInWithPopup,
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
 * Dette er fiksen på den opprinnelige produksjonsfeilen: Firebase sin
 * IndexedDB-lagring nekter å åpne databasen når sida har vært skjult under
 * innloggingsflyten, og kaster «Database is closing/hidden». Google-innloggingen
 * gikk gjennom og brukeren ble opprettet, men sesjonen kunne ikke lagres, så
 * `onAuthStateChanged` fyrte aldri og man ble stående på påloggingsskjermen.
 *
 * localStorage har ingen slik vakt. Vi mister delt sesjon med service workers,
 * som vi ikke bruker.
 */
const persistenceReady = setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('Kunne ikke sette localStorage-persistens', error);
});

/**
 * Logger inn med Google. `hd` sender brukeren rett til Entur-kontoen sin i
 * stedet for kontovelgeren.
 *
 * Popup, ikke redirect — og det er et bevisst valg vi har betalt for å lære.
 * `signInWithRedirect` krever at `authDomain` ligger på samme origin som appen.
 * Vår ligger på `ent-tavleber-prd.firebaseapp.com` mens appen serveres fra
 * `ent-tavleber-prd.web.app`, og fra Chrome M115+, Firefox 109+ og Safari 16.1+
 * blokkerer nettlesere tredjeparts-lagringen den flyten er avhengig av. Den
 * feiler da *stille*: man kommer tilbake utlogget, uten feilmelding.
 * Se https://firebase.google.com/docs/auth/web/redirect-best-practices
 *
 * Å bytte til redirect krever derfor at redirect-URI-en for `web.app` først
 * registreres på OAuth-klienten i Google Cloud Console. Til det er gjort er
 * popup det som faktisk virker.
 *
 * Er kontoen ikke en verifisert Entur-konto, logges den ut igjen umiddelbart.
 * Reglene ville avvist skrivingen uansett, men det er dårlig UX å oppdage det
 * først når man trykker lagre.
 */
export async function signIn() {
    await persistenceReady;

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: ENTUR_DOMAIN });

    const result = await signInWithPopup(auth, provider);
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
