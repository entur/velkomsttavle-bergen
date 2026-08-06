import { collection, doc, getDoc, getDocs, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from '../alerts/firebase.js';
import { normalizeBoardConfig, toFirestoreBoard } from './boardConfig.js';

const COLLECTION = 'boards';

/**
 * Live-abonnement på én tavle. `onBoard` får null når dokumentet ikke finnes.
 *
 * Abonnement, ikke engangshenting: endrer noen oppsettet i admin, endrer
 * skjermen i resepsjonen seg innen sekunder, uten at noen laster siden på nytt.
 */
export function subscribeToBoard(boardId, onBoard, onError) {
    return onSnapshot(
        doc(db, COLLECTION, boardId),
        (snapshot) => onBoard(snapshot.exists() ? normalizeBoardConfig(snapshot.id, snapshot.data()) : null),
        onError,
    );
}

/** Engangshenting. Admin-skjemaet skal ikke få innholdet byttet mens noen skriver. */
export async function fetchBoard(boardId) {
    const snapshot = await getDoc(doc(db, COLLECTION, boardId));
    return snapshot.exists() ? normalizeBoardConfig(snapshot.id, snapshot.data()) : null;
}

/** Alle tavler, for oversikten i admin. */
export async function fetchBoards() {
    const snapshot = await getDocs(collection(db, COLLECTION));
    return snapshot.docs.map((document) => normalizeBoardConfig(document.id, document.data()));
}

/**
 * Lagrer oppsettet på en tavle som finnes fra før.
 *
 * `merge: true` fordi createdBy og createdAt ikke er med i skrivingen, og
 * reglene krever at createdBy står uendret. Med merge ser reglene det
 * sammenslåtte dokumentet, altså med createdBy i behold.
 *
 * Å lagre på en tavle som ikke finnes gir permission-denied: reglene krever
 * createdBy på oppretting, og det feltet skriver ikke denne funksjonen. Det er
 * med vilje — tavler opprettes ikke fra klienten i fase 1.
 */
export async function saveBoardConfig(config, userEmail) {
    await setDoc(
        doc(db, COLLECTION, config.id),
        { ...toFirestoreBoard(config, userEmail), updatedAt: serverTimestamp() },
        { merge: true },
    );
}
