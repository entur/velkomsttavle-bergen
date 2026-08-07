import { useEffect, useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { PrimaryButton } from '@entur/button';
import { Heading3 } from '@entur/typography';

import AlertForm from './AlertForm';
import AlertList from './AlertList';
import { fetchMyBoardIds } from '../access/membershipsRepository';
import { fetchBoard } from '../boards/boardsRepository';

/** Meldingene på én tavle, med skjema som kan publisere til flere. */
function BoardAlerts({ boardId, userEmail }) {
    const [boards, setBoards] = useState([]);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);

    // Tavlene du kan publisere til: dine egne. Hentes én gang — lista endrer
    // seg sjelden, og skjemaet skal ikke få valgene byttet mens man står i det.
    useEffect(() => {
        let current = true;
        fetchMyBoardIds(userEmail)
            .then((ids) => Promise.all(ids.map((id) => fetchBoard(id))))
            .then((loaded) => {
                if (current) setBoards(loaded.filter(Boolean));
            })
            .catch((error) => console.error('Kunne ikke hente tavlene dine', error));
        return () => {
            current = false;
        };
    }, [userEmail]);

    function close() {
        setFormOpen(false);
        setEditing(null);
    }

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Heading3>Meldinger</Heading3>
            <SmallAlertBox variant="information" title="Meldingene er offentlig lesbare">
                Tavla henter meldingene uten pålogging, så de kan leses av hvem som helst som
                finner adressen. Ikke skriv sensitiv eller intern-klassifisert informasjon her.
            </SmallAlertBox>

            {formOpen ? (
                <AlertForm
                    editing={editing}
                    boardId={boardId}
                    boards={boards}
                    userEmail={userEmail}
                    onSaved={close}
                    onCancel={close}
                />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'flex-start' }}>
                    <PrimaryButton onClick={() => { setEditing(null); setFormOpen(true); }}>
                        Ny melding
                    </PrimaryButton>
                    <AlertList
                        boardId={boardId}
                        boards={boards}
                        onEdit={(alert) => { setEditing(alert); setFormOpen(true); }}
                    />
                </div>
            )}
        </section>
    );
}

export default BoardAlerts;
