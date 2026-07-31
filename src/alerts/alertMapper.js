/**
 * Oversettelsen mellom Firestore-dokumenter og appens egne objekter.
 *
 * Ligger i egen fil, uten Firebase-importer, slik at den kan testes med
 * `node --test`. Resten av appen jobber med JS-Date, ikke Firestore-Timestamp.
 */

/** Firestore-dokument → varsel med Date-felt. Tåler dokumenter med hull i. */
export function toAlert(id, data) {
    return {
        id,
        title: typeof data.title === 'string' ? data.title : '',
        body: typeof data.body === 'string' ? data.body : '',
        level: typeof data.level === 'string' ? data.level : 'information',
        startsAt: toDate(data.startsAt),
        endsAt: toDate(data.endsAt),
        enabled: data.enabled === true,
        createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
        updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
    };
}

/**
 * Skjemainnhold → felt som skrives til Firestore.
 *
 * createdAt/updatedAt settes av repositoryet med serverTimestamp(), og id er
 * dokumentnøkkelen, ikke et felt. Firestore-SDK-en gjør Date om til Timestamp
 * selv, så vi sender Date-objektene rett videre.
 */
export function toFirestoreData(input, userEmail) {
    return {
        title: input.title.trim(),
        body: input.body.trim(),
        level: input.level,
        startsAt: input.startsAt,
        endsAt: input.endsAt ?? null,
        enabled: input.enabled === true,
        updatedBy: userEmail,
    };
}

function toDate(value) {
    if (value && typeof value.toDate === 'function') {
        return value.toDate();
    }
    return value instanceof Date ? value : null;
}
