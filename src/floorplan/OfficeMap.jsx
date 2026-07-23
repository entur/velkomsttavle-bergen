import { Heading3 } from '@entur/typography';
import BergenThird from './BergenThird';
import labels from './bergenThirdLabels.json';

function OfficeMap() {
    return (
        <div style={{ flex: 1, minHeight: 0, width: '100vw', backgroundColor: '#ffffff', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem 0' }}>
            <Heading3 style={{ margin: '0 0 0.5rem' }}>Nøstegaten 58 — 3. etasje</Heading3>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                <BergenThird labels={labels} />
            </div>
        </div>
    );
}

export default OfficeMap;
