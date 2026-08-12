import { Radio, RadioGroup } from '@entur/form';

import FormSection from './FormSection';
import SurfacePicker from './SurfacePicker';

/**
 * Toppen av tavla: intro-videoen eller logoen, og fargen bak den.
 *
 * Videoen dekker hele feltet, så fargen vises bare når videoen ikke kan spilles
 * av — men logoen bytter med modusen, og det er valget her som avgjør.
 */
function BrandingSection({ draft, errors, update }) {
    return (
        <FormSection
            title="Branding"
            help="Det øverste feltet på skjermen. Logoen følger fargen: hvit og koral på mørke flater, farget på lyse."
        >
            <RadioGroup
                name="topKind"
                label="Innhold"
                value={draft.topKind}
                onChange={(event) => update('topKind', event.target.value)}
            >
                <Radio value="video">Intro-video</Radio>
                <Radio value="logo">Entur-logo</Radio>
            </RadioGroup>

            <SurfacePicker
                name="topSurface"
                label="Farge"
                value={draft.topSurface}
                onChange={(surface) => update('topSurface', surface)}
                error={errors.topSurface}
            />
        </FormSection>
    );
}

export default BrandingSection;
