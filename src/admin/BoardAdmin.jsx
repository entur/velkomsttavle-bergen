import { useEffect, useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { Heading1, Paragraph } from '@entur/typography';

import BoardConfigForm from './BoardConfigForm';
import { fetchBoard } from '../boards/boardsRepository';

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
            <BoardConfigForm board={state.board} userEmail={userEmail} />
        </div>
    );
}

export default BoardAdmin;
