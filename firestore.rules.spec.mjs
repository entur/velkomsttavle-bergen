/**
 * Tester for firestore.rules.
 *
 * Kjøres med `yarn test:rules`, som starter Firestore-emulatoren rundt dem.
 * Ligger utenfor `yarn test` med vilje — de krever emulator og Java, mens
 * `yarn test` skal kunne kjøres hvor som helst. Filnavnet slutter derfor på
 * `.rules.spec.mjs`: `node --test` globber ikke `.spec.mjs`.
 *
 * Det som testes er grensene som faktisk kan misbrukes: mellom tavler, «før og
 * etter»-sjekken på meldinger, og at ingen kan gi seg selv tilgang.
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';

let testEnv;

/** Firestore-instans for en innlogget Entur-bruker. */
function as(email) {
    return testEnv.authenticatedContext(email, { email, email_verified: true }).firestore();
}

/** Firestore-instans uten pålogging — slik kiosken leser. */
function anonymous() {
    return testEnv.unauthenticatedContext().firestore();
}

function board(overrides = {}) {
    return {
        name: 'Bergen 3. etasje',
        placeName: 'Bergen',
        theme: 'dark',
        staffImage: true,
        top: { kind: 'video' },
        middle: [],
        carousel: [],
        createdBy: 'ola@entur.org',
        updatedBy: 'ola@entur.org',
        ...overrides,
    };
}

function alert(overrides = {}) {
    return {
        title: 'Tittel',
        body: 'Tekst',
        level: 'information',
        startsAt: new Date('2026-08-03T08:00:00Z'),
        endsAt: null,
        enabled: true,
        boardIds: ['bergen-3'],
        createdBy: 'ola@entur.org',
        updatedBy: 'ola@entur.org',
        ...overrides,
    };
}

before(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: 'ent-tavleber-prd',
        firestore: {
            rules: await readFile('firestore.rules', 'utf8'),
            host: '127.0.0.1',
            port: 8080,
        },
    });
});

after(async () => {
    await testEnv.cleanup();
});

beforeEach(async () => {
    await testEnv.clearFirestore();
    // Utgangspunkt: ola eier bergen-3, kari eier oslo-1, ingen deler noe.
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'boards/bergen-3'), board());
        await setDoc(doc(db, 'boards/oslo-1'), board({ createdBy: 'kari@entur.org', updatedBy: 'kari@entur.org' }));
        await setDoc(doc(db, 'memberships/ola@entur.org'), { boards: ['bergen-3'] });
        await setDoc(doc(db, 'memberships/kari@entur.org'), { boards: ['oslo-1'] });
    });
});

describe('boards', () => {
    it('kan leses uten pålogging — kiosken har ingen', async () => {
        await assertSucceeds(getDoc(doc(anonymous(), 'boards/bergen-3')));
    });

    it('kan endres av den som har tilgang', async () => {
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({ placeName: 'Bergen sentrum' })));
    });

    it('kan ikke endres av noen uten tilgang', async () => {
        await assertFails(setDoc(doc(as('kari@entur.org'), 'boards/bergen-3'), board({ placeName: 'Kapret', updatedBy: 'kari@entur.org' })));
    });

    it('kan opprettes av enhver Entur-konto, med seg selv som createdBy', async () => {
        await assertSucceeds(setDoc(doc(as('ny@entur.org'), 'boards/ny-tavle'), board({ createdBy: 'ny@entur.org', updatedBy: 'ny@entur.org' })));
    });

    it('kan ikke opprettes i en annens navn', async () => {
        await assertFails(setDoc(doc(as('ny@entur.org'), 'boards/ny-tavle'), board({ createdBy: 'ola@entur.org', updatedBy: 'ny@entur.org' })));
    });

    it('kan ikke opprettes av en konto utenfor entur.org', async () => {
        await assertFails(setDoc(doc(as('utenfor@example.com'), 'boards/ny-tavle'), board({ createdBy: 'utenfor@example.com', updatedBy: 'utenfor@example.com' })));
    });

    it('kan ikke få createdBy overtatt ved en oppdatering', async () => {
        // Forsøk på å skrive om createdBy til en annen skal avvises …
        await assertFails(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({ createdBy: 'kari@entur.org', name: 'Nytt' })));
        // … mens den samme endringen med createdBy urørt skal gå gjennom.
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({ name: 'Nytt' })));
    });

    it('kan ikke skrives i en annens navn', async () => {
        await assertFails(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({ updatedBy: 'kari@entur.org' })));
    });

    it('avviser en tavle med ukjent tema', async () => {
        await assertFails(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({ theme: 'lilla' })));
    });

    it('avviser en tavle uten tema', async () => {
        const { theme, ...utenTema } = board();
        await assertFails(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), utenTema));
    });

    it('avviser en tavle der ansatt-illustrasjonen ikke er en boolean', async () => {
        await assertFails(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({ staffImage: 'ja' })));
    });

    it('godtar det lyse temaet', async () => {
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({ theme: 'light' })));
    });

    it('godtar begge karusell-temaene', async () => {
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({ carouselTheme: 'dark' })));
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({ carouselTheme: 'light' })));
    });

    it('godtar en tavle uten carouselTheme — feltet er nytt i fase 3', async () => {
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board()));
    });

    it('avviser et ukjent karusell-tema', async () => {
        await assertFails(setDoc(doc(as('ola@entur.org'), 'boards/bergen-3'), board({ carouselTheme: 'lilla' })));
    });

    it('kan slettes av den som har tilgang, men ikke av andre', async () => {
        await assertFails(deleteDoc(doc(as('kari@entur.org'), 'boards/bergen-3')));
        await assertSucceeds(deleteDoc(doc(as('ola@entur.org'), 'boards/bergen-3')));
    });
});

describe('memberships', () => {
    it('lar deg lese din egen oppføring', async () => {
        await assertSucceeds(getDoc(doc(as('ola@entur.org'), 'memberships/ola@entur.org')));
    });

    it('lar deg lese din egen oppføring selv om den ikke finnes', async () => {
        await assertSucceeds(getDoc(doc(as('ny@entur.org'), 'memberships/ny@entur.org')));
    });

    it('lar deg ikke lese oppføringen til en du ikke deler tavle med', async () => {
        await assertFails(getDoc(doc(as('ola@entur.org'), 'memberships/kari@entur.org')));
    });

    it('lar deg finne hvem som deler en tavle med deg', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'memberships/per@entur.org'), { boards: ['bergen-3'] });
        });
        const db = as('ola@entur.org');
        const treff = query(collection(db, 'memberships'), where('boards', 'array-contains', 'bergen-3'));
        await assertSucceeds(getDocs(treff));
    });

    it('lar deg ikke liste ut alle oppføringer', async () => {
        await assertFails(getDocs(collection(as('ola@entur.org'), 'memberships')));
    });

    it('lar deg gi bort en tavle du har', async () => {
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'memberships/per@entur.org'), { boards: ['bergen-3'] }));
    });

    it('lar deg ikke gi bort en tavle du ikke har', async () => {
        await assertFails(setDoc(doc(as('ola@entur.org'), 'memberships/per@entur.org'), { boards: ['oslo-1'] }));
    });

    it('lar deg ikke gi deg selv tilgang til en fremmed tavle', async () => {
        await assertFails(setDoc(doc(as('ola@entur.org'), 'memberships/ola@entur.org'), { boards: ['bergen-3', 'oslo-1'] }));
    });

    it('lar deg ikke fjerne en tavle du ikke har fra en annens liste', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'memberships/per@entur.org'), { boards: ['bergen-3', 'oslo-1'] });
        });
        // ola har bare bergen-3; å skrive lista uten oslo-1 fjerner en tilgang han ikke rår over
        await assertFails(setDoc(doc(as('ola@entur.org'), 'memberships/per@entur.org'), { boards: ['bergen-3'] }));
        // men å fjerne bergen-3 og la oslo-1 stå er lov
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'memberships/per@entur.org'), { boards: ['oslo-1'] }));
    });

    it('lar deg ikke slette en oppføring', async () => {
        await assertFails(deleteDoc(doc(as('ola@entur.org'), 'memberships/ola@entur.org')));
    });

    it('lar deg gjøre krav på en tavle du selv har opprettet', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'boards/min-nye'), board({ createdBy: 'ny@entur.org', updatedBy: 'ny@entur.org' }));
        });
        await assertSucceeds(setDoc(doc(as('ny@entur.org'), 'memberships/ny@entur.org'), {
            boards: ['min-nye'], claiming: 'min-nye',
        }));
    });

    it('lar deg ikke gjøre krav på en tavle du ikke har opprettet', async () => {
        await assertFails(setDoc(doc(as('ny@entur.org'), 'memberships/ny@entur.org'), {
            boards: ['bergen-3'], claiming: 'bergen-3',
        }));
    });

    it('lar deg ikke smugle en ekstra tavle inn sammen med et gyldig krav', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'boards/min-nye'), board({ createdBy: 'ny@entur.org', updatedBy: 'ny@entur.org' }));
        });
        await assertFails(setDoc(doc(as('ny@entur.org'), 'memberships/ny@entur.org'), {
            boards: ['min-nye', 'bergen-3'], claiming: 'min-nye',
        }));
    });

    it('lar deg ikke gjøre krav i en annens navn', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'boards/min-nye'), board({ createdBy: 'ny@entur.org', updatedBy: 'ny@entur.org' }));
        });
        await assertFails(setDoc(doc(as('ny@entur.org'), 'memberships/per@entur.org'), {
            boards: ['min-nye'], claiming: 'min-nye',
        }));
    });

    it('lar deg ikke gjøre krav på en tavle som ikke finnes', async () => {
        await assertFails(setDoc(doc(as('ny@entur.org'), 'memberships/ny@entur.org'), {
            boards: ['finnes-ikke'], claiming: 'finnes-ikke',
        }));
    });
});

describe('alerts', () => {
    it('kan leses uten pålogging', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'alerts/a1'), alert());
        });
        await assertSucceeds(getDoc(doc(anonymous(), 'alerts/a1')));
    });

    it('kan opprettes på en tavle du har', async () => {
        await assertSucceeds(setDoc(doc(as('ola@entur.org'), 'alerts/a1'), alert()));
    });

    it('kan ikke opprettes på en tavle du ikke har', async () => {
        await assertFails(setDoc(doc(as('ola@entur.org'), 'alerts/a1'), alert({ boardIds: ['oslo-1'] })));
    });

    it('kan ikke opprettes med en blanding av dine og andres tavler', async () => {
        await assertFails(setDoc(doc(as('ola@entur.org'), 'alerts/a1'), alert({ boardIds: ['bergen-3', 'oslo-1'] })));
    });

    it('kan ikke opprettes uten tavle', async () => {
        await assertFails(setDoc(doc(as('ola@entur.org'), 'alerts/a1'), alert({ boardIds: [] })));
    });

    it('kan ikke avpubliseres fra en tavle du ikke har', async () => {
        // Meldinga står på begge tavler. ola har bare bergen-3.
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'alerts/delt'), alert({ boardIds: ['bergen-3', 'oslo-1'] }));
        });
        // Å skrive den om til bare bergen-3 ville tatt den ned fra oslo-1.
        await assertFails(setDoc(doc(as('ola@entur.org'), 'alerts/delt'), alert({ boardIds: ['bergen-3'] })));
    });

    it('kan ikke endres når den står på en tavle du ikke har', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'alerts/delt'), alert({ boardIds: ['bergen-3', 'oslo-1'] }));
        });
        await assertFails(setDoc(doc(as('ola@entur.org'), 'alerts/delt'), alert({ boardIds: ['bergen-3', 'oslo-1'], title: 'Kapret' })));
    });

    it('kan slettes bare når alle tavlene er dine', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'alerts/min'), alert());
            await setDoc(doc(context.firestore(), 'alerts/delt'), alert({ boardIds: ['bergen-3', 'oslo-1'] }));
        });
        await assertFails(deleteDoc(doc(as('ola@entur.org'), 'alerts/delt')));
        await assertSucceeds(deleteDoc(doc(as('ola@entur.org'), 'alerts/min')));
    });

    it('kan ikke skrives i en annens navn', async () => {
        await assertFails(setDoc(doc(as('ola@entur.org'), 'alerts/a1'), alert({ updatedBy: 'kari@entur.org' })));
    });

    it('krever verifisert e-post', async () => {
        const uverifisert = testEnv.authenticatedContext('ola@entur.org', {
            email: 'ola@entur.org', email_verified: false,
        }).firestore();
        await assertFails(setDoc(doc(uverifisert, 'alerts/a1'), alert()));
    });
});

describe('admins-collectionen er borte', () => {
    it('kan verken leses eller skrives', async () => {
        await assertFails(getDoc(doc(as('ola@entur.org'), 'admins/ola@entur.org')));
        await assertFails(setDoc(doc(as('ola@entur.org'), 'admins/ola@entur.org'), { addedBy: 'meg' }));
    });
});
