import { SmallAlertBox } from '@entur/alert';
import { Checkbox, Radio, RadioGroup, TextField } from '@entur/form';

import FormSection from './FormSection';
import SurfacePicker from './SurfacePicker';
import { GREETING_TEXT_MAX_LENGTH, PLACE_NAME_MAX_LENGTH } from '../boards/boardConfig';
import { DAY_LABELS } from '../boards/openingHours';

/**
 * Midtfeltet: overskriften, hilsenen, åpningstidene og illustrasjonen.
 *
 * Stedsnavnet bor her og ikke øverst i skjemaet fordi det er her overskriften
 * det lager faktisk står. Overskriften vises uansett hvilke av valgene under
 * som er på, og meldinger legger seg alltid over den.
 */
function WelcomeSection({ draft, errors, update, updateDay }) {
    return (
        <FormSection
            title="Velkomstmelding"
            help="Feltet under toppen. Meldinger vises alltid øverst her, og overskriften står der uansett hva du velger."
        >
            <div style={{ maxWidth: '20rem' }}>
                <TextField
                    label="Stedsnavn"
                    value={draft.placeName}
                    maxLength={PLACE_NAME_MAX_LENGTH}
                    onChange={(event) => update('placeName', event.target.value)}
                    variant={errors.placeName ? 'negative' : undefined}
                    feedback={errors.placeName ?? `Gir «Velkommen til Entur ${draft.placeName || '…'}»`}
                />
            </div>

            <div>
                <Checkbox
                    checked={draft.staffImage}
                    onChange={(event) => update('staffImage', event.target.checked)}
                >
                    Vis ansatt-illustrasjon
                </Checkbox>

                <Checkbox
                    checked={draft.greetingEnabled}
                    onChange={(event) => update('greetingEnabled', event.target.checked)}
                >
                    Hilsen
                </Checkbox>
                {draft.greetingEnabled && (
                    <div style={{ margin: '0.75rem 0 1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <RadioGroup
                            name="greetingAuto"
                            value={draft.greetingAuto ? 'auto' : 'fast'}
                            onChange={(event) => update('greetingAuto', event.target.value === 'auto')}
                        >
                            <Radio value="auto">Automatisk hilsen etter klokka og ukedagen</Radio>
                            <Radio value="fast">Fast tekst</Radio>
                        </RadioGroup>
                        {!draft.greetingAuto && (
                            <TextField
                                label="Tekst"
                                value={draft.greetingText}
                                maxLength={GREETING_TEXT_MAX_LENGTH}
                                onChange={(event) => update('greetingText', event.target.value)}
                                variant={errors.greetingText ? 'negative' : undefined}
                                feedback={errors.greetingText}
                            />
                        )}
                    </div>
                )}

                <Checkbox
                    checked={draft.openingHoursEnabled}
                    onChange={(event) => update('openingHoursEnabled', event.target.checked)}
                >
                    Åpningstider
                </Checkbox>
                {draft.openingHoursEnabled && (
                    <div style={{ margin: '0.75rem 0 0 2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {draft.days.map((day) => (
                            <div key={day.day} style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                <span style={{ width: '6rem' }}>{DAY_LABELS[day.day]}</span>
                                <Checkbox
                                    checked={!day.closed}
                                    onChange={(event) => updateDay(day.day, event.target.checked
                                        ? { closed: false, opens: day.opens ?? '08:00', closes: day.closes ?? '16:00' }
                                        : { closed: true })}
                                >
                                    Åpent
                                </Checkbox>
                                {!day.closed && (
                                    <>
                                        <TextField
                                            label="Fra"
                                            type="time"
                                            value={day.opens ?? ''}
                                            onChange={(event) => updateDay(day.day, { opens: event.target.value })}
                                        />
                                        <TextField
                                            label="Til"
                                            type="time"
                                            value={day.closes ?? ''}
                                            onChange={(event) => updateDay(day.day, { closes: event.target.value })}
                                        />
                                    </>
                                )}
                            </div>
                        ))}
                        {errors.openingHours && (
                            <SmallAlertBox variant="negative">{errors.openingHours}</SmallAlertBox>
                        )}
                    </div>
                )}
            </div>

            <SurfacePicker
                name="middleSurface"
                label="Farge"
                value={draft.middleSurface}
                onChange={(surface) => update('middleSurface', surface)}
                error={errors.middleSurface}
            />
        </FormSection>
    );
}

export default WelcomeSection;
