import { Contrast } from '@entur/layout';
import { Heading1, Paragraph } from '@entur/typography';
import { base } from '@entur/tokens';

/** URL-en peker ikke på noen av rutene appen har. */
function RouteNotFound({ pathname }) {
    return (
        <Contrast style={{ minHeight: '100vh', width: '100vw', backgroundColor: base.light.baseColors.frame.contrast, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem', boxSizing: 'border-box' }}>
            <img src="/logo.svg" alt="Entur" style={{ height: '4rem' }} />
            <Heading1>Ukjent adresse</Heading1>
            <Paragraph>«{pathname}» peker ikke på noen tavle. En tavle ligger på /t/&lt;id&gt;.</Paragraph>
        </Contrast>
    );
}

export default RouteNotFound;
