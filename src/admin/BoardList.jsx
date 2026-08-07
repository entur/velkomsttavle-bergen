import { useEffect, useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { PrimaryButton } from '@entur/button';
import { Heading3, Paragraph } from '@entur/typography';

import NewBoardForm from './NewBoardForm';
import { fetchMyBoardIds } from '../access/membershipsRepository';
import { fetchBoard } from '../boards/boardsRepository';

/** Tavlene du har tilgang til. */
function BoardList({ userEmail }) {
    const [state, setState] = useState({ status: 'laster' });
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        let current = true;
        loadBoards(userEmail)
            .then((boards) => {
                if (current) setState({ status: 'ok', boards });
            })
            .catch((error) => {
                console.error('Kunne ikke hente tavler', error);
                if (current) setState({ status: 'feil' });
            });
        return () => {
            current = false;
        };
    }, [userEmail]);

    if (creating) {
        return (
            <section>
                <Heading3>Ny tavle</Heading3>
                <NewBoardForm
                    userEmail={userEmail}
                    onCreated={(id) => {
                        window.location.href = `/admin/t/${id}`;
                    }}
                    onCancel={() => setCreating(false)}
                />
            </section>
        );
    }

    if (state.status === 'laster') {
        return <Paragraph>Henter tavler …</Paragraph>;
    }
    if (state.status === 'feil') {
        return <SmallAlertBox variant="negative">Kunne ikke hente tavlene.</SmallAlertBox>;
    }

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-start' }}>
            <Heading3>Dine tavler</Heading3>
            {state.boards.length === 0 ? (
                <Paragraph>
                    Du har ikke tilgang til noen tavler ennå. Lag din egen, eller be noen som
                    har en tavle om å gi deg tilgang.
                </Paragraph>
            ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {state.boards.map((board) => (
                        <li key={board.id}>
                            <a href={`/admin/t/${board.id}`}>{board.name || board.id}</a>
                            {' — '}
                            <a href={`/t/${board.id}`}>se tavla</a>
                        </li>
                    ))}
                </ul>
            )}
            <PrimaryButton onClick={() => setCreating(true)}>Ny tavle</PrimaryButton>
        </section>
    );
}

/**
 * Id-ene fra din egen tilgangsliste, slått opp én for én.
 *
 * En tavle som er slettet lar en id bli liggende i lista; den hoppes over her
 * framfor å vises som en død lenke.
 */
async function loadBoards(userEmail) {
    const ids = await fetchMyBoardIds(userEmail);
    const boards = await Promise.all(ids.map((id) => fetchBoard(id)));
    return boards.filter(Boolean);
}

export default BoardList;
