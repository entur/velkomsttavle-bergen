import { Fragment } from 'react';
import { Heading3 } from '@entur/typography';

import { formatOpeningHours } from '../boards/openingHours';

/**
 * Åpningstider i det mørkeblå feltet.
 *
 * Skaleres opp på samme måte som varslene: tavla leses fra andre siden av
 * rommet, ikke fra en laptop.
 */
function OpeningHours({ days }) {
    const rows = formatOpeningHours(days);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 2rem' }}>
            <Heading3>Åpningstider</Heading3>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', columnGap: '2.5rem', rowGap: '0.25rem', fontSize: '1.375rem' }}>
                {rows.map((row) => (
                    <Fragment key={row.key}>
                        <span>{row.label}</span>
                        <span style={{ textAlign: 'right' }}>{row.value}</span>
                    </Fragment>
                ))}
            </div>
        </div>
    );
}

export default OpeningHours;
