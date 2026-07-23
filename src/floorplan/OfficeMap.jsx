import BergenThird from './BergenThird';
import labels from './bergenThirdLabels.json';

function OfficeMap() {
    return (
        <div style={{ width: '100%', height: '100%', backgroundColor: 'transparent', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem 0' }}>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                <BergenThird labels={labels} />
            </div>
        </div>
    );
}

export default OfficeMap;
