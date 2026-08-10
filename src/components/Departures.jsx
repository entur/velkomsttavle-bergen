import { Fragment, useEffect, useState } from 'react';
import { Heading3, Paragraph } from '@entur/typography';
import { colors } from '@entur/tokens';

import { lineAppearance } from '../departures/lineAppearance';
import { countdownLabel } from '../departures/departureCountdown';
import { isDelayed } from '../departures/departureMapper';

/**
 * Hvor ofte nedtellingen regnes om. Ingen nettverkskall — det er ren regning
 * på data vi allerede har. Å binde den til hentingen ville enten gitt et tall
 * som står stille i et minutt, eller seksti ganger så mange kall som nødvendig.
 */
const TICK_MS = 15 * 1000;

const klokke = new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit' });

function tid(date) {
    return date instanceof Date ? klokke.format(date) : '';
}

/** Merket med linjekoden. Farge fra kategori, ellers transportmiddel. */
function LineBadge({ lineCode, transportMode, theme }) {
    const { fill, text, border } = lineAppearance(lineCode, transportMode, theme);
    return (
        <span style={{
            display: 'inline-block', minWidth: '3.5rem', textAlign: 'center',
            backgroundColor: fill, color: text, border,
            borderRadius: '8px', padding: '0.25rem 0.6rem',
            fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1,
        }}>
            {lineCode || '–'}
        </span>
    );
}

/**
 * Gul brikke ved forsinkelse, rød ved innstilling.
 *
 * Aldri farget tekst: gul mot lavendel er kontrast 1.10, altså usynlig. Som
 * fylt brikke med mørkeblå tekst er den 10.25.
 */
function Chip({ label, tone, theme }) {
    const dark = theme === 'dark';
    const fill = tone === 'cancelled'
        ? (dark ? colors.validation.lavaContrast : colors.validation.lava)
        : colors.validation.canary;
    // Gul har mørk tekst i begge temaer. Rød har hvit tekst i lyst tema, der
    // fyllet er mettet, og mørk i mørkt, der fyllet er lyst.
    const text = tone === 'cancelled' && !dark ? '#ffffff' : colors.brand.blue;
    return (
        <span style={{
            backgroundColor: fill, color: text,
            border: dark ? 'none' : `2px solid ${colors.brand.blue}`,
            borderRadius: '999px', padding: '0.15rem 0.75rem',
            fontSize: '1.375rem', fontWeight: 600, whiteSpace: 'nowrap',
        }}>
            {label}
        </span>
    );
}

function Melding({ palette, children }) {
    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Paragraph style={{ color: palette.text }}>{children}</Paragraph>
        </div>
    );
}

function Departures({ departures, stopPlaceName, palette }) {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), TICK_MS);
        return () => clearInterval(id);
    }, []);

    if (departures === null) {
        return <Melding palette={palette}>Henter avganger …</Melding>;
    }
    if (departures.length === 0) {
        return <Melding palette={palette}>Ingen avganger de neste 3 timene</Melding>;
    }

    return (
        <div style={{ width: '100%', height: '100%', boxSizing: 'border-box', padding: '1.5rem 2.5rem', color: palette.text, overflow: 'hidden' }}>
            <Heading3 style={{ color: palette.text, margin: '0 0 1rem' }}>
                Avganger fra {stopPlaceName}
            </Heading3>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto auto',
                columnGap: '1.5rem', rowGap: '0.75rem',
                alignItems: 'center', fontSize: '1.75rem',
            }}>
                {departures.map((departure, index) => {
                    const nedtelling = countdownLabel(departure.expectedAt, now);
                    const forsinket = isDelayed(departure);
                    return (
                        <Fragment key={`${departure.lineCode}-${departure.aimedAt?.toISOString() ?? index}`}>
                            <LineBadge lineCode={departure.lineCode} transportMode={departure.transportMode} theme={palette.mode} />
                            <span>
                                {departure.destination}
                                {departure.situation && (
                                    <span style={{ display: 'block', fontSize: '1.25rem', opacity: 0.85 }}>
                                        ↳ {departure.situation}
                                    </span>
                                )}
                            </span>
                            <span style={{ whiteSpace: 'nowrap' }}>
                                {departure.platform ? `Spor ${departure.platform}` : ''}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                                {departure.cancelled && <Chip label="Innstilt" tone="cancelled" theme={palette.mode} />}
                                {!departure.cancelled && nedtelling && <Chip label={nedtelling} tone="delayed" theme={palette.mode} />}
                                {(departure.cancelled || forsinket) && (
                                    <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>{tid(departure.aimedAt)}</span>
                                )}
                                {!departure.cancelled && (
                                    <span style={{ fontWeight: 700 }}>{tid(departure.expectedAt)}</span>
                                )}
                                {!departure.realtime && !departure.cancelled && (
                                    <span style={{ fontSize: '1rem', opacity: 0.7 }}>rutetid</span>
                                )}
                            </span>
                        </Fragment>
                    );
                })}
            </div>
        </div>
    );
}

export default Departures;
