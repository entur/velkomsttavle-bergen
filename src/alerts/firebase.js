import { initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig.js';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Opt-in, ikke automatisk i dev: da må man be om emulatoren eksplisitt,
// og man blir ikke overrasket over at lokale endringer treffer produksjon.
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
