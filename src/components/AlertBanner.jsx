import { useEffect, useState } from 'react';
import { BannerAlertBox } from '@entur/alert';

import { subscribeToBoardAlerts } from '../alerts/alertsRepository';
import { selectVisibleAlerts } from '../alerts/alertSchedule';

/** Hvor ofte vi sjekker om et tidsvindu har åpnet eller lukket seg. */
const REEVALUATE_MS = 30 * 1000;

/**
 * Varslene som skal stå øverst i det mørkeblå feltet.
 *
 * Live-abonnement, ikke polling: en melding lagt inn i admin er på skjermen i
 * resepsjonen innen sekunder, uten reload. Tidsvinduet reevalueres hvert 30.
 * sekund, som er presist nok for en melding som skal vises «fra 08:00» og
 * koster ingen nettverkskall.
 */
function AlertBanner({ boardId }) {
    const [alerts, setAlerts] = useState([]);
    const [now, setNow] = useState(() => new Date());

    useEffect(() => subscribeToBoardAlerts(boardId, setAlerts, (error) => {
        console.error('Kunne ikke hente varsler', error);
        setAlerts([]);
    }), [boardId]);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), REEVALUATE_MS);
        return () => clearInterval(interval);
    }, []);

    const visibleAlerts = selectVisibleAlerts(alerts, now);
    if (visibleAlerts.length === 0) {
        return null;
    }

    return (
        <div style={{ width: '100%', boxSizing: 'border-box', padding: '0 2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {visibleAlerts.map((alert) => (
                // Skaleres opp: BannerAlertBox er dimensjonert for en laptop,
                // ikke en vegg-skjerm man leser fra andre siden av rommet.
                <div key={alert.id} style={{ fontSize: '1.375rem' }}>
                    <BannerAlertBox variant={alert.level} title={alert.title}>
                        {alert.body}
                    </BannerAlertBox>
                </div>
            ))}
        </div>
    );
}

export default AlertBanner;
