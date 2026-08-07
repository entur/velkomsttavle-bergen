/**
 * Oversettelsen mellom Firestore-dokumenter og appens egne objekter.
 *
 * Ligger i egen fil, uten Firebase-importer, slik at den kan testes med
 * `node --test`. Resten av appen jobber med JS-Date, ikke Firestore-Timestamp.
 */
import { ALERT_LEVEL_VALUES } from './alertLevels.js';
import { isValidBoardId } from '../boards/boardId.js';

/** Firestore-dokument → varsel med Date-felt. Tåler dokumenter med hull i. */
export function toAlert(id, data) {
    return {
        id,
        // Ugyldige id-er kastes her, ikke i komponentene: en id som ikke kan
        // være en tavle kan uansett ikke matche noen, og en liste med tull i
        // gjør bare feilsøkingen vanskeligere lenger ned.
        boardIds: Array.isArray(data.boardIds) ? data.boardIds.filter(isValidBoardId) : [],
        title: typeof data.title === 'string' ? data.title : '',
        body: typeof data.body === 'string' ? data.body : '',
        // Reglene validerer enum-verdien, men et hånd-skrevet dokument (konsoll
        // eller Admin-SDK) omgår dem. `@entur/alert` kaster hvis variant ikke
        // finnes i dens iconsMap, og det tar ned HELE varselbåndet — også
        // gyldige varsler. Derfor klemmer vi ukjente nivåer til 'information'
        // her, framfor å stole på at data alltid kommer fra skjemaet.
        level: ALERT_LEVEL_VALUES.includes(data.level) ? data.level : 'information',
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
        boardIds: Array.isArray(input.boardIds) ? input.boardIds.filter(isValidBoardId) : [],
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
