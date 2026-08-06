import { memo } from 'react';
import { Heading2, LeadParagraph } from '@entur/typography';

/**
 * Hilsen-blokka: illustrasjon til venstre, overskrift og hilsen til høyre.
 *
 * Memoisert fordi teksten bare endrer seg hvert 15. minutt, mens komponenten
 * over den rendrer på hver eneste snapshot fra Firestore.
 */
const Greeting = memo(function Greeting({ heading, text, staffImageSrc }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            {staffImageSrc && (
                // Dekorativ illustrasjon: tom alt, ikke «Staff». Ingen skjermleser
                // står foran denne skjermen, og et meningsløst alt er verre enn ingen.
                <img
                    src={staffImageSrc}
                    alt=""
                    style={{ maxHeight: '18vh', maxWidth: '40%', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }}
                />
            )}
            <div style={{ marginLeft: staffImageSrc ? '2rem' : 0 }}>
                <Heading2>{heading}</Heading2>
                <LeadParagraph>{text}</LeadParagraph>
            </div>
        </div>
    );
});

export default Greeting;
