import { useEffect, useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { TertiaryButton } from '@entur/button';
import { Heading1, Heading3, Paragraph } from '@entur/typography';

import BoardAccess from './BoardAccess';
import BoardAlerts from './BoardAlerts';
import BoardConfigForm from './BoardConfigForm';
import { deleteBoard, fetchBoard } from '../boards/boardsRepository';

/**
 * Oppsettet for én tavle.
 *
 * Henter configen én gang, ikke som abonnement: skjemaet skal ikke få innholdet
 * byttet under fingrene mens noen skriver i det.
 */
function BoardAdmin({ boardId, userEmail }) {
    const [state, setState] = useState({ status: 'laster' });

    useEffect(() => {
        let current = true;
        fetchBoard(boardId)
            .then((board) => {
                if (!current) return;
                setState(board ? { status: 'ok', board } : { status: 'mangler' });
            })
            .catch((error) => {
                console.error('Kunne ikke hente tavla', error);
                if (current) setState({ status: 'feil' });
            });
        return () => {
            current = false;
        };
    }, [boardId]);

    async function handleDelete() {
        // Sletting kan ikke angres og tar en skjerm ned. Navnet må skrives inn,
        // ikke bare bekreftes — en «er du sikker?» klikkes bort på refleks.
        const svar = window.prompt(
            `Sletter du tavla, viser skjermen som peker på /t/${boardId} «Fant ingen tavle».\n\n`
            + `Skriv tavlas navn for å bekrefte: ${state.board?.name}`,
        );
        if (svar !== state.board?.name) {
            return;
        }
        try {
            await deleteBoard(boardId);
            window.location.href = '/admin';
        } catch (error) {
            console.error('Kunne ikke slette tavla', error);
            window.alert('Kunne ikke slette tavla.');
        }
    }

    if (state.status === 'laster') {
        return <Paragraph>Henter tavla …</Paragraph>;
    }
    if (state.status === 'mangler') {
        return <SmallAlertBox variant="negative">Det finnes ingen tavle med id-en «{boardId}».</SmallAlertBox>;
    }
    if (state.status === 'feil') {
        return <SmallAlertBox variant="negative">Kunne ikke hente tavla. Last siden på nytt.</SmallAlertBox>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
                <Heading1>{state.board.name || boardId}</Heading1>
                <Paragraph>
                    Skjermen skal peke på <a href={`/t/${boardId}`}>/t/{boardId}</a>. <a href="/admin">Tilbake til oversikten</a>
                </Paragraph>
            </div>
            <SmallAlertBox variant="information" title="Oppsettet er offentlig lesbart">
                Tavla henter oppsettet uten pålogging, så koordinater og åpningstider kan
                leses av hvem som helst som finner adressen.
            </SmallAlertBox>
            <section>
                <Heading3>Oppsett</Heading3>
                <BoardConfigForm board={state.board} userEmail={userEmail} />
            </section>
            <BoardAccess boardId={boardId} userEmail={userEmail} />
            <BoardAlerts boardId={boardId} userEmail={userEmail} />
            <section>
                <Heading3>Slett tavla</Heading3>
                <Paragraph>
                    Meldingene røres ikke — en melding som også står på andre tavler
                    blir stående der. Sletting kan ikke angres.
                </Paragraph>
                <TertiaryButton onClick={handleDelete}>Slett tavla</TertiaryButton>
            </section>
        </div>
    );
}

export default BoardAdmin;
