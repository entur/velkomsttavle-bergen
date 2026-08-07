import { useEffect, useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { SecondaryButton, TertiaryButton } from '@entur/button';
import { DataCell, HeaderCell, Table, TableBody, TableHead, TableRow } from '@entur/table';
import { Heading3, Paragraph } from '@entur/typography';

import { levelLabel } from '../alerts/alertLevels';
import { groupAlertsByStatus } from '../alerts/alertSchedule';
import { deleteAlert, subscribeToBoardAlerts } from '../alerts/alertsRepository';

const REEVALUATE_MS = 30 * 1000;

/**
 * Over dette antallet samtidige varsler begynner tavla å klippe.
 *
 * Målt på 1920×1080: tre varsler gir 584 px innhold mot feltets makshøyde på
 * 486 px, så hilsenen er allerede halvveis borte ved tre. Advarselen skal komme
 * når problemet starter, ikke etter.
 */
const CROWDED_THRESHOLD = 2;

const GROUPS = [
    { key: 'visible', heading: 'Vises nå' },
    { key: 'planned', heading: 'Planlagt' },
    { key: 'disabled', heading: 'Slått av' },
    { key: 'expired', heading: 'Utløpt' },
];

const dateFormat = new Intl.DateTimeFormat('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});

function formatRange(alert) {
    const from = alert.startsAt ? dateFormat.format(alert.startsAt) : 'ukjent';
    const to = alert.endsAt ? dateFormat.format(alert.endsAt) : 'åpen slutt';
    return `${from} – ${to}`;
}

// Fargeprikkene er dekorasjon ved siden av etiketten som allerede sier nivået,
// derfor aria-hidden og derfor greit å ha dem som faste verdier her.
const DOT_COLORS = {
    negative: '#dc2a2a',
    warning: '#f8b133',
    information: '#276fbf',
    success: '#1c8b60',
};

function LevelDot({ level }) {
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <span aria-hidden="true" style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', backgroundColor: DOT_COLORS[level] ?? '#8a8a8a' }} />
            {levelLabel(level)}
        </span>
    );
}

/**
 * «Også på Oslo, Trondheim» — eller tom tekst når meldinga bare står her.
 *
 * En id uten treff i `boards` er en tavle du ikke har tilgang til, eller en som
 * er slettet. Da viser vi id-en som den er framfor å skjule at meldinga også
 * står et annet sted.
 */
function elsewhere(alert, boardId, boards) {
    const others = alert.boardIds.filter((id) => id !== boardId);
    if (others.length === 0) {
        return '';
    }
    const names = others.map((id) => boards.find((board) => board.id === id)?.name || id);
    return `Også på ${names.join(', ')}`;
}

function AlertList({ boardId, boards, onEdit }) {
    const [alerts, setAlerts] = useState([]);
    const [now, setNow] = useState(() => new Date());
    const [loadError, setLoadError] = useState(null);

    useEffect(() => subscribeToBoardAlerts(boardId, setAlerts, (error) => {
        console.error('Kunne ikke hente varsler', error);
        setLoadError('Kunne ikke hente meldingene. Last siden på nytt.');
    }), [boardId]);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), REEVALUATE_MS);
        return () => clearInterval(interval);
    }, []);

    async function handleDelete(alert) {
        const confirmed = window.confirm(`Slette «${alert.title}»? Dette kan ikke angres.`);
        if (!confirmed) {
            return;
        }
        try {
            await deleteAlert(alert.id);
        } catch (error) {
            console.error('Kunne ikke slette varselet', error);
            window.alert('Kunne ikke slette meldingen. Prøv igjen.');
        }
    }

    if (loadError) {
        return <SmallAlertBox variant="negative">{loadError}</SmallAlertBox>;
    }

    const groups = groupAlertsByStatus(alerts, now);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {groups.visible.length > CROWDED_THRESHOLD && (
                <SmallAlertBox variant="warning" title="Mange meldinger samtidig">
                    {groups.visible.length} meldinger vises nå. Feltet har en makshøyde, så når
                    stabelen blir for høy, er det hilsenen og de minst alvorlige meldingene
                    lengst ned som blir klippet bort. Vurder å slå av noen.
                </SmallAlertBox>
            )}

            {alerts.length === 0 && <Paragraph>Ingen meldinger lagt inn ennå.</Paragraph>}

            {GROUPS.map(({ key, heading }) => {
                const group = groups[key];
                if (group.length === 0) {
                    return null;
                }
                return (
                    <section key={key}>
                        <Heading3>{`${heading} (${group.length})`}</Heading3>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <HeaderCell>Nivå</HeaderCell>
                                    <HeaderCell>Tittel</HeaderCell>
                                    <HeaderCell>Tidsrom</HeaderCell>
                                    <HeaderCell>Andre tavler</HeaderCell>
                                    <HeaderCell>Lagt inn av</HeaderCell>
                                    <HeaderCell>Sist endret av</HeaderCell>
                                    <HeaderCell aria-label="Handlinger" />
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {group.map((alert) => (
                                    <TableRow key={alert.id}>
                                        <DataCell>
                                            <LevelDot level={alert.level} />
                                        </DataCell>
                                        <DataCell>{alert.title}</DataCell>
                                        <DataCell>{formatRange(alert)}</DataCell>
                                        <DataCell>{elsewhere(alert, boardId, boards) || '–'}</DataCell>
                                        <DataCell>{alert.createdBy || '–'}</DataCell>
                                        <DataCell>{alert.updatedBy || '–'}</DataCell>
                                        <DataCell>
                                            <span style={{ display: 'flex', gap: '0.5rem' }}>
                                                <SecondaryButton onClick={() => onEdit(alert)}>
                                                    Endre
                                                </SecondaryButton>
                                                <TertiaryButton onClick={() => handleDelete(alert)}>
                                                    Slett
                                                </TertiaryButton>
                                            </span>
                                        </DataCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </section>
                );
            })}
        </div>
    );
}

export default AlertList;
