import { useEffect, useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { Heading3, Paragraph } from '@entur/typography';

import { fetchBoards } from '../boards/boardsRepository';

/**
 * Tavlene som finnes.
 *
 * I fase 1 er det alle: tilgang er fortsatt den globale admins-allowlisten, og
 * boards er offentlig lesbar. I fase 2 blir lista begrenset til dine egne.
 */
function BoardList() {
    const [state, setState] = useState({ status: 'laster' });

    useEffect(() => {
        let current = true;
        fetchBoards()
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
    }, []);

    if (state.status === 'laster') {
        return <Paragraph>Henter tavler …</Paragraph>;
    }
    if (state.status === 'feil') {
        return <SmallAlertBox variant="negative">Kunne ikke hente tavlene.</SmallAlertBox>;
    }
    if (state.boards.length === 0) {
        return <Paragraph>Ingen tavler er lagt inn ennå.</Paragraph>;
    }

    return (
        <section>
            <Heading3>Tavler</Heading3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {state.boards.map((board) => (
                    <li key={board.id}>
                        <a href={`/admin/t/${board.id}`}>{board.name || board.id}</a>
                        {' — '}
                        <a href={`/t/${board.id}`}>se tavla</a>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export default BoardList;
