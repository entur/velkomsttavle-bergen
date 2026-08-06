import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';

import { db } from './firebase.js';
import { toAlert, toFirestoreData } from './alertMapper.js';

const COLLECTION = 'alerts';

/**
 * Meldingene som gjelder én tavle.
 *
 * Ingen `enabled`-filtrering i spørringen: `array-contains` sammen med en
 * likhetstest ville krevd en sammensatt indeks, og `selectVisibleAlerts`
 * filtrerer allerede på status, som håndterer både av-bryteren og tidsvinduet.
 *
 * Tavla og admin bruker samme funksjon — tavla filtrerer med
 * `selectVisibleAlerts`, admin vil ha alt.
 */
export function subscribeToBoardAlerts(boardId, onAlerts, onError) {
    const forBoard = query(collection(db, COLLECTION), where('boardIds', 'array-contains', boardId));
    return onSnapshot(forBoard, (snapshot) => onAlerts(mapSnapshot(snapshot)), onError);
}

/** Oppretter når input.id mangler, oppdaterer ellers. Returnerer dokument-id. */
export async function saveAlert(input, userEmail) {
    const data = {
        ...toFirestoreData(input, userEmail),
        updatedAt: serverTimestamp(),
    };

    if (input.id) {
        await updateDoc(doc(db, COLLECTION, input.id), data);
        return input.id;
    }

    const created = await addDoc(collection(db, COLLECTION), {
        ...data,
        createdAt: serverTimestamp(),
        createdBy: userEmail,
    });
    return created.id;
}

export function deleteAlert(id) {
    return deleteDoc(doc(db, COLLECTION, id));
}

function mapSnapshot(snapshot) {
    return snapshot.docs.map((document) => toAlert(document.id, document.data()));
}
