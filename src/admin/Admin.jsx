import { useEffect, useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { PrimaryButton, SecondaryButton } from '@entur/button';
import { Heading1, Paragraph } from '@entur/typography';

import './admin.css';
import { signIn, signOutUser, subscribeToUser } from './adminAuth';

function Admin() {
    const [user, setUser] = useState(null);
    const [checkingSession, setCheckingSession] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => subscribeToUser((nextUser) => {
        setUser(nextUser);
        setCheckingSession(false);
    }), []);

    async function handleSignIn() {
        setError(null);
        try {
            await signIn();
        } catch (signInError) {
            setError(signInError.message ?? 'Innlogging feilet. Prøv igjen.');
        }
    }

    if (checkingSession) {
        return null;
    }

    if (!user) {
        return (
            <main style={{ maxWidth: '28rem', margin: '4rem auto', padding: '0 1.5rem', textAlign: 'center' }}>
                <img src="/logo.svg" alt="Entur" style={{ height: '2.5rem', marginBottom: '2rem' }} />
                <Heading1>Varsler på velkomsttavla</Heading1>
                <Paragraph>Logg inn med Entur-kontoen din for å legge inn meldinger.</Paragraph>
                {error && (
                    <div style={{ margin: '1rem 0' }}>
                        <SmallAlertBox variant="negative">{error}</SmallAlertBox>
                    </div>
                )}
                <PrimaryButton onClick={handleSignIn}>Logg inn med Google</PrimaryButton>
            </main>
        );
    }

    return (
        <main style={{ maxWidth: '60rem', margin: '2rem auto', padding: '0 1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <Heading1>Varsler på velkomsttavla</Heading1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Paragraph>{user.email}</Paragraph>
                    <SecondaryButton onClick={signOutUser}>Logg ut</SecondaryButton>
                </div>
            </div>

            <div style={{ margin: '1.5rem 0' }}>
                <SmallAlertBox variant="information" title="Meldingene er offentlig lesbare">
                    Tavla står i resepsjonen og henter meldingene uten pålogging, så de kan
                    leses av hvem som helst som finner adressen. Ikke skriv sensitiv eller
                    intern-klassifisert informasjon her.
                </SmallAlertBox>
            </div>

            <p>Skjema og liste kommer.</p>
        </main>
    );
}

export default Admin;
