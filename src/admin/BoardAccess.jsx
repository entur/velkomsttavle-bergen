import { useCallback, useEffect, useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { PrimaryButton, TertiaryButton } from '@entur/button';
import { TextField } from '@entur/form';
import { Heading3, Paragraph } from '@entur/typography';

import { isLastMember, validateGranteeEmail } from '../access/memberships';
import { fetchMemberEmails, grantAccess, revokeAccess } from '../access/membershipsRepository';

/**
 * Hvem som har tilgang til tavla.
 *
 * Tilgang er tilgang: den som står her kan endre oppsettet, publisere meldinger
 * og gi andre tilgang. Det finnes ingen roller.
 */
function BoardAccess({ boardId, userEmail }) {
    const [members, setMembers] = useState(null);
    const [email, setEmail] = useState('');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const reload = useCallback(async () => {
        try {
            setMembers(await fetchMemberEmails(boardId));
        } catch (loadError) {
            console.error('Kunne ikke hente hvem som har tilgang', loadError);
            setMembers([]);
            setError('Kunne ikke hente hvem som har tilgang.');
        }
    }, [boardId]);

    useEffect(() => {
        reload();
    }, [reload]);

    async function handleGrant(event) {
        event.preventDefault();
        const message = validateGranteeEmail(email, members ?? []);
        setError(message);
        if (message) {
            return;
        }

        setBusy(true);
        try {
            await grantAccess(email, boardId);
            setEmail('');
            await reload();
        } catch (grantError) {
            console.error('Kunne ikke gi tilgang', grantError);
            setError('Kunne ikke gi tilgang. Prøv igjen.');
        } finally {
            setBusy(false);
        }
    }

    async function handleRevoke(member) {
        // Den siste kan ikke fjernes: en tavle uten noen med tilgang må ordnes
        // i Firebase-konsollet, og det skal ikke skje ved et uhell. Reglene kan
        // ikke telle medlemmer, så sperren finnes bare her.
        if (isLastMember(members, member)) {
            setError('Den siste med tilgang kan ikke fjernes. Gi noen andre tilgang først.');
            return;
        }
        const egen = member === userEmail;
        if (egen && !window.confirm('Du fjerner din egen tilgang til denne tavla. Da mister du den med én gang. Er du sikker?')) {
            return;
        }

        setBusy(true);
        try {
            await revokeAccess(member, boardId);
            if (egen) {
                window.location.href = '/admin';
                return;
            }
            await reload();
        } catch (revokeError) {
            console.error('Kunne ikke fjerne tilgang', revokeError);
            setError('Kunne ikke fjerne tilgang. Prøv igjen.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Heading3>Tilgang</Heading3>
            <Paragraph>
                Den som har tilgang kan endre oppsettet, publisere meldinger og gi andre
                tilgang. Det finnes ingen roller.
            </Paragraph>

            {members === null ? (
                <Paragraph>Henter …</Paragraph>
            ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {members.map((member) => (
                        <li key={member} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span>{member}{member === userEmail ? ' (deg)' : ''}</span>
                            <TertiaryButton onClick={() => handleRevoke(member)} disabled={busy}>
                                Fjern
                            </TertiaryButton>
                        </li>
                    ))}
                </ul>
            )}

            <form onSubmit={handleGrant} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 20rem' }}>
                    <TextField
                        label="Gi tilgang til"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        variant={error ? 'negative' : undefined}
                        feedback={error ?? 'E-postadressen til Entur-kontoen'}
                    />
                </div>
                <PrimaryButton type="submit" disabled={busy}>Gi tilgang</PrimaryButton>
            </form>
        </section>
    );
}

export default BoardAccess;
