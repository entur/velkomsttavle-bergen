import BergenThird from './BergenThird';
import labels from './bergenThirdLabels.json';

/**
 * Plantegningen står alltid på lys flate.
 *
 * BergenThird.jsx og romfargene synkes ukentlig fra `entur/plantegning` av en
 * GitHub Action, så en restyling ville blitt overskrevet neste mandag.
 * Romfargene er lyse pasteller som fungerer på hvitt; panelet gjør at de
 * fortsetter å gjøre det også når karusellen er mørk.
 */
function OfficeMap({ palette }) {
    const dark = palette.mode === 'dark';
    return (
        <div style={{ width: '100%', height: '100%', backgroundColor: 'transparent', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem 0' }}>
            <div style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                backgroundColor: dark ? '#ffffff' : 'transparent',
                borderRadius: dark ? '16px' : 0,
                padding: dark ? '1rem' : 0,
                boxSizing: 'border-box',
            }}>
                <BergenThird labels={labels} />
            </div>
        </div>
    );
}

export default OfficeMap;
