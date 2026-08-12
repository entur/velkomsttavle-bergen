import { TertiaryButton } from '@entur/button';
import { base } from '@entur/tokens';
import { Heading4 } from '@entur/typography';

const BORDER = base.light.baseColors.stroke.subduedalt;

/**
 * Rammen rundt én modul i karusellen.
 *
 * Ett kort per modul, ikke en avkrysningsboks med felt under: kortet gjør det
 * synlig hva karusellen faktisk viser, og hvor mange slides det blir.
 */
function ModuleCard({ title, onRemove, children }) {
    return (
        <div
            style={{
                border: `1px solid ${BORDER}`,
                borderRadius: '0.25rem',
                padding: '1rem',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem' }}>
                <Heading4>{title}</Heading4>
                <TertiaryButton type="button" onClick={onRemove}>Fjern</TertiaryButton>
            </div>
            {children}
        </div>
    );
}

export default ModuleCard;
