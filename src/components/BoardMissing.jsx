import { Contrast } from '@entur/layout';
import { Heading1, Paragraph } from '@entur/typography';
import { base } from '@entur/tokens';

/**
 * Vises når tavle-id-en i URL-en ikke finnes i Firestore.
 *
 * En blank skjerm i en resepsjon forteller ingen hva som er galt. Denne sier
 * hvilken id som ble forsøkt, slik at den som satte opp skjermen ser feilen.
 */
function BoardMissing({ boardId }) {
    return (
        <Contrast style={{ minHeight: '100vh', width: '100vw', backgroundColor: base.light.baseColors.frame.contrast, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem', boxSizing: 'border-box' }}>
            <img src="/logo.svg" alt="Entur" style={{ height: '4rem' }} />
            <Heading1>Fant ingen tavle</Heading1>
            <Paragraph>Det finnes ingen tavle med id-en «{boardId}».</Paragraph>
        </Contrast>
    );
}

export default BoardMissing;
