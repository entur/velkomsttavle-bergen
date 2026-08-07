import { useEffect, useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { PrimaryButton, SecondaryButton } from '@entur/button';
import { Heading1, Paragraph } from '@entur/typography';

import './admin.css';
import BoardAdmin from './BoardAdmin';
import BoardList from './BoardList';
import { signIn, signOutUser, subscribeToUser } from './adminAuth';
import { signInMessage } from './signInMessage';
import { normalizeEmail } from './enturAccount';

/**
 * Admin-sidene har hvit bakgrunn, så de bruker logo-on-light.svg med mørkeblått
 * ordmerke. public/logo.svg er hvit og koral og hører til kiosken, der den står
 * på et mørkeblått felt — den ville vært nesten usynlig her.
 */
function EnturLogo() {
    return <img src="/logo-on-light.svg" alt="Entur" style={{ height: '2.5rem', marginBottom: '2rem' }} />;
}

function Admin({ route }) {
    const [user, setUser] = useState(null);
    const [checkingSession, setCheckingSession] = useState(true);
    const [error, setError] = useState(null);
    const [signingIn, setSigningIn] = useState(false);

    useEffect(() => subscribeToUser((nextUser) => {
        setUser(nextUser);
        setCheckingSession(false);
    }), []);

    async function handleSignIn() {
        setError(null);
        setSigningIn(true);
        try {
            await signIn();
        } catch (signInError) {
            console.error('Innlogging feilet', signInError);
            setError(signInMessage(signInError));
        } finally {
            setSigningIn(false);
        }
    }

    if (checkingSession) {
        return (
            <main style={{ textAlign: 'center', margin: '4rem auto', padding: '0 1.5rem' }}>
                <Paragraph>Sjekker innlogging …</Paragraph>
            </main>
        );
    }

    if (!user) {
        return (
            <main style={{ maxWidth: '28rem', margin: '4rem auto', padding: '0 1.5rem', textAlign: 'center' }}>
                <EnturLogo />
                <Heading1>Meldinger på velkomsttavla</Heading1>
                <Paragraph>Logg inn med Entur-kontoen din for å legge inn meldinger.</Paragraph>
                {error && (
                    <div style={{ margin: '1rem 0' }}>
                        <SmallAlertBox variant="negative">{error}</SmallAlertBox>
                    </div>
                )}
                <PrimaryButton onClick={handleSignIn} disabled={signingIn}>
                    {signingIn ? 'Logger inn …' : 'Logg inn med Google'}
                </PrimaryButton>
            </main>
        );
    }

    // Ingen tilgangsport her lenger: enhver Entur-konto kommer inn og ser sine
    // egne tavler. Har du ingen, møter du en tom-tilstand med «Ny tavle» framfor
    // en avvisning. Tilgang gis per tavle, ikke globalt.
    const heading = route.kind === 'adminBoard' ? 'Oppsett for tavla' : 'Velkomsttavler';

    return (
        <main style={{ maxWidth: '60rem', margin: '2rem auto', padding: '0 1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <Heading1>{heading}</Heading1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Paragraph>{user.email}</Paragraph>
                    <SecondaryButton onClick={signOutUser}>Logg ut</SecondaryButton>
                </div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
                {route.kind === 'adminBoard' ? (
                    <BoardAdmin boardId={route.boardId} userEmail={normalizeEmail(user.email)} />
                ) : (
                    <BoardList userEmail={normalizeEmail(user.email)} />
                )}
            </div>
        </main>
    );
}

export default Admin;
