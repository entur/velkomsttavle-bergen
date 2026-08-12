import { base } from '@entur/tokens';

import FormSection from './FormSection';
import SurfacePicker from './SurfacePicker';
import WeatherFields from './WeatherFields';
import { BOTTOM_TYPES, MODULE_LABELS } from '../boards/boardConfig';
import { bottomModule } from '../boards/boardDraft';

const BORDER = base.light.baseColors.stroke.subdued;

/**
 * Bunnstripa: én modul som står permanent, med sine egne innstillinger.
 *
 * Nedtrekksmenyen er et vanlig <select>. Designsystemet har ingen
 * dropdown-komponent, og å håndskrive en listboks for to valg er ikke verdt
 * det.
 *
 * Velger du en modul som også kunne stått i karusellen, forsvinner den derfra.
 * Det håndheves ikke her — `setBottomModule` i boardDraft flytter feltet, og
 * karusellkortene utledes av det samme feltet.
 */
function BottomSection({ draft, errors, update, onModuleChange }) {
    const valgt = bottomModule(draft);

    return (
        <FormSection
            title="Bunnstripa"
            help="Et lavt felt nederst på skjermen, med én modul som står der hele tiden."
        >
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '16rem' }}>
                <span style={{ fontWeight: 600 }}>Modul</span>
                <select
                    value={valgt ?? ''}
                    onChange={(event) => onModuleChange(event.target.value === '' ? null : event.target.value)}
                    style={{
                        padding: '0.5rem',
                        fontSize: '1rem',
                        borderRadius: '0.25rem',
                        border: `1px solid ${BORDER}`,
                        backgroundColor: '#ffffff',
                    }}
                >
                    <option value="">Ingen</option>
                    {BOTTOM_TYPES.map((type) => (
                        <option key={type} value={type}>{MODULE_LABELS[type]}</option>
                    ))}
                </select>
            </label>

            {valgt === 'weather' && <WeatherFields draft={draft} errors={errors} update={update} />}

            <SurfacePicker
                name="bottomSurface"
                label="Farge"
                value={draft.bottomSurface}
                onChange={(surface) => update('bottomSurface', surface)}
                error={errors.bottomSurface}
            />
        </FormSection>
    );
}

export default BottomSection;
