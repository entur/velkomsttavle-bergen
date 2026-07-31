import { SmallAlertBox } from '@entur/alert';
import { base } from '@entur/tokens';

import { ALERT_LEVELS } from '../alerts/alertLevels';

const SELECTED_BORDER = base.light.baseColors.frame.contrast;

/**
 * Nivåvalget som fire fargeprøver.
 *
 * Hvert kort er en ekte SmallAlertBox med sin variant, slik at farge og ikon
 * kommer fra designsystemet og ikke kan komme på avveie fra det tavla viser.
 * Under panseret er det vanlige radio-inputs — visuelt skjult, men fortsatt
 * der for tastatur og skjermleser. Fokusringen flyttes til kortet med
 * .level-option:focus-within i admin.css.
 */
function LevelPicker({ value, onChange }) {
    return (
        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Nivå</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {ALERT_LEVELS.map((level) => (
                    <label
                        key={level.level}
                        className="level-option"
                        style={{
                            flex: '1 1 14rem',
                            cursor: 'pointer',
                            borderRadius: '0.25rem',
                            padding: '0.25rem',
                            border: `2px solid ${value === level.level ? SELECTED_BORDER : 'transparent'}`,
                        }}
                    >
                        <input
                            type="radio"
                            name="alert-level"
                            value={level.level}
                            checked={value === level.level}
                            onChange={() => onChange(level.level)}
                            style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, margin: 0 }}
                        />
                        <SmallAlertBox variant={level.level} title={level.label}>
                            {level.help}
                        </SmallAlertBox>
                    </label>
                ))}
            </div>
        </fieldset>
    );
}

export default LevelPicker;
