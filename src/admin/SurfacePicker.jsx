import { SmallAlertBox } from '@entur/alert';
import { base } from '@entur/tokens';

import { SURFACES, SURFACE_LABELS, surfacePalette } from '../boards/surfaces';

const SELECTED_BORDER = base.light.baseColors.stroke.default;
const UNSELECTED_BORDER = base.light.baseColors.stroke.subdued;

/**
 * Fargevalget for én flate, som seks fargeprøver.
 *
 * Hvert kort har flatens egen bakgrunn, og navnet skrevet på i flatens egen
 * tekstfarge. Kortet viser dermed alle tre tingene i én figur: navnet, fargen,
 * og at valget avgjør lys eller mørk modus — «Mørk blå» står hvitt, «Fersken»
 * står blått. Fargene kommer fra surfacePalette, samme kilde tavla rendrer
 * fra, så en prøve kan ikke komme på avveie fra det skjermen viser.
 *
 * Under panseret er det vanlige radio-inputs — visuelt skjult, men fortsatt der
 * for tastatur og skjermleser. Fokusringen flyttes til kortet med
 * .surface-option:focus-within i admin.css.
 *
 * Kantlinja er der i begge tilstandene, ikke bare den valgte: uten den
 * forsvinner den hvite flaten i admin-sidens hvite bakgrunn.
 */
function SurfacePicker({ name, label, value, onChange, error }) {
    return (
        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend style={{ marginBottom: '0.5rem', fontWeight: 600 }}>{label}</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {SURFACES.map((surface) => {
                    const palette = surfacePalette(surface);
                    const selected = value === surface;
                    return (
                        <label
                            key={surface}
                            className="surface-option"
                            style={{
                                flex: '1 1 8rem',
                                cursor: 'pointer',
                                borderRadius: '0.25rem',
                                padding: '0.75rem 0.5rem',
                                textAlign: 'center',
                                backgroundColor: palette.background,
                                color: palette.text,
                                border: `2px solid ${selected ? SELECTED_BORDER : UNSELECTED_BORDER}`,
                                fontWeight: selected ? 700 : 400,
                            }}
                        >
                            <input
                                type="radio"
                                name={name}
                                value={surface}
                                checked={selected}
                                onChange={() => onChange(surface)}
                                style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, margin: 0 }}
                            />
                            {SURFACE_LABELS[surface]}
                        </label>
                    );
                })}
            </div>
            {error && (
                <div style={{ marginTop: '0.5rem' }}>
                    <SmallAlertBox variant="negative">{error}</SmallAlertBox>
                </div>
            )}
        </fieldset>
    );
}

export default SurfacePicker;
