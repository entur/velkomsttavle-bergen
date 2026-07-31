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
 * Tavla: bare varsler som er slått på. Tidsvindu-filtreringen skjer i
 * klienten, se selectVisibleAlerts — Firestore kan ikke range-filtrere på
 * både startsAt og endsAt i samme spørring uten sammensatt indeks, og vi må
 * reevaluere når klokka passerer et start- eller sluttpunkt uansett.
 */
export function subscribeToEnabledAlerts(onAlerts, onError) {
    const enabledAlerts = query(collection(db, COLLECTION), where('enabled', '==', true));
    return onSnapshot(enabledAlerts, (snapshot) => onAlerts(mapSnapshot(snapshot)), onError);
}

/** Admin: alt, uansett status. */
export function subscribeToAllAlerts(onAlerts, onError) {
    return onSnapshot(
        collection(db, COLLECTION),
        (snapshot) => onAlerts(mapSnapshot(snapshot)),
        onError,
    );
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
