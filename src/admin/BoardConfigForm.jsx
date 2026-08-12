import { useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { PrimaryButton } from '@entur/button';
import { Checkbox, Radio, RadioGroup, TextField } from '@entur/form';
import { Heading3, Paragraph } from '@entur/typography';

import {
    GREETING_TEXT_MAX_LENGTH,
    NAME_MAX_LENGTH,
    PLACE_NAME_MAX_LENGTH,
} from '../boards/boardConfig';
import { SURFACES, SURFACE_LABELS } from '../boards/surfaces';
import StopPlaceField from './StopPlaceField';
import { DAY_LABELS } from '../boards/openingHours';
import { hasErrors, validateBoardInput } from '../boards/boardValidation';
import { configFrom, draftFrom } from '../boards/boardDraft';
import { saveBoardConfig } from '../boards/boardsRepository';

function BoardConfigForm({ board, userEmail }) {
    const [draft, setDraft] = useState(() => draftFrom(board));
    const [errors, setErrors] = useState({});
    const [saveError, setSaveError] = useState(null);
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);

    function update(field, value) {
        setSaved(false);
        setDraft((current) => ({ ...current, [field]: value }));
    }

    function updateDay(dayKey, changes) {
        setSaved(false);
        setDraft((current) => ({
            ...current,
            days: current.days.map((day) => (day.day === dayKey ? { ...day, ...changes } : day)),
        }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setSaveError(null);

        const validationErrors = validateBoardInput(draft);
        setErrors(validationErrors);
        if (hasErrors(validationErrors)) {
            return;
        }

        setSaving(true);
        try {
            await saveBoardConfig(configFrom(draft), userEmail);
            setSaved(true);
        } catch (error) {
            console.error('Kunne ikke lagre oppsettet', error);
            setSaveError('Kunne ikke lagre oppsettet. Prøv igjen.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 16rem' }}>
                    <TextField
                        label="Navn"
                        value={draft.name}
                        maxLength={NAME_MAX_LENGTH}
                        onChange={(event) => update('name', event.target.value)}
                        variant={errors.name ? 'negative' : undefined}
                        feedback={errors.name ?? 'Vises bare her i admin.'}
                    />
                </div>
                <div style={{ flex: '1 1 16rem' }}>
                    <TextField
                        label="Stedsnavn"
                        value={draft.placeName}
                        maxLength={PLACE_NAME_MAX_LENGTH}
                        onChange={(event) => update('placeName', event.target.value)}
                        variant={errors.placeName ? 'negative' : undefined}
                        feedback={errors.placeName ?? `Gir «Velkommen til Entur ${draft.placeName || '…'}»`}
                    />
                </div>
            </div>

            <section>
                <Heading3>Toppen</Heading3>
                <RadioGroup
                    name="topKind"
                    value={draft.topKind}
                    onChange={(event) => update('topKind', event.target.value)}
                >
                    <Radio value="video">Intro-video</Radio>
                    <Radio value="logo">Entur-logo</Radio>
                </RadioGroup>
            </section>

            <section>
                <Heading3>Farger</Heading3>
                <Paragraph>
                    Gjelder toppen og midten samlet. Logoen bytter med: hvit og koral på
                    mørkeblått, farget på lavendel.
                </Paragraph>
                <RadioGroup
                    name="theme"
                    value={draft.theme}
                    onChange={(event) => update('theme', event.target.value)}
                >
                    <Radio value="dark">Mørk blå</Radio>
                    <Radio value="light">Lavendel</Radio>
                </RadioGroup>
            </section>

            <section>
                <Heading3>Midtfeltet</Heading3>
                <Paragraph>
                    Meldinger vises alltid øverst her, og overskriften «Velkommen til Entur
                    {' '}{draft.placeName || '…'}» står der uansett hva du velger.
                </Paragraph>

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
            </section>

            <section>
                <Heading3>Karusellen</Heading3>
                <RadioGroup
                    name="carouselSurface"
                    label="Bakgrunn"
                    value={draft.carouselSurface}
                    onChange={(event) => update('carouselSurface', event.target.value)}
                >
                    {SURFACES.map((name) => (
                        <Radio key={name} value={name}>{SURFACE_LABELS[name]}</Radio>
                    ))}
                </RadioGroup>
                {errors.carouselSurface && (
                    <SmallAlertBox variant="negative">{errors.carouselSurface}</SmallAlertBox>
                )}

                <RadioGroup
                    name="weatherPlacement"
                    label="Værmelding"
                    value={draft.weatherPlacement}
                    onChange={(event) => update('weatherPlacement', event.target.value)}
                >
                    <Radio value="av">Av</Radio>
                    <Radio value="karusell">I karusellen</Radio>
                    <Radio value="stripe">I bunnstripa</Radio>
                </RadioGroup>
                {draft.weatherPlacement !== 'av' && (
                    <div style={{ margin: '0.75rem 0 1.5rem 2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 12rem' }}>
                            <TextField
                                label="Sted"
                                value={draft.weatherName}
                                onChange={(event) => update('weatherName', event.target.value)}
                                variant={errors.weatherName ? 'negative' : undefined}
                                feedback={errors.weatherName}
                            />
                        </div>
                        <div style={{ flex: '1 1 10rem' }}>
                            <TextField
                                label="Breddegrad"
                                value={draft.weatherLat}
                                onChange={(event) => update('weatherLat', event.target.value)}
                                variant={errors.weatherLat ? 'negative' : undefined}
                                feedback={errors.weatherLat}
                            />
                        </div>
                        <div style={{ flex: '1 1 10rem' }}>
                            <TextField
                                label="Lengdegrad"
                                value={draft.weatherLng}
                                onChange={(event) => update('weatherLng', event.target.value)}
                                variant={errors.weatherLng ? 'negative' : undefined}
                                feedback={errors.weatherLng}
                            />
                        </div>
                    </div>
                )}

                <Checkbox
                    checked={draft.floorplanEnabled}
                    onChange={(event) => update('floorplanEnabled', event.target.checked)}
                >
                    Plantegning
                </Checkbox>
                {draft.floorplanEnabled && (
                    <div style={{ margin: '0.75rem 0 0 2rem' }}>
                        {/* Ingen velger: repoet har nøyaktig én plantegning, og
                            synken i scripts/sync-floorplan.mjs er hardkodet mot
                            den. En velger med ett valg er bare støy. */}
                        <Paragraph>Bergen, 3. etasje — den eneste plantegningen som finnes.</Paragraph>
                        {errors.floorplan && (
                            <SmallAlertBox variant="negative">{errors.floorplan}</SmallAlertBox>
                        )}
                    </div>
                )}

                <Checkbox
                    checked={draft.departuresEnabled}
                    onChange={(event) => update('departuresEnabled', event.target.checked)}
                >
                    Avgangstider
                </Checkbox>
                {draft.departuresEnabled && (
                    <div style={{ margin: '0.75rem 0 0 2rem', maxWidth: '28rem' }}>
                        <StopPlaceField
                            value={{ id: draft.stopPlaceId, name: draft.stopPlaceName }}
                            onChange={(valgt) => {
                                setSaved(false);
                                setDraft((current) => ({ ...current, stopPlaceId: valgt.id, stopPlaceName: valgt.name }));
                            }}
                            error={errors.stopPlace}
                        />
                    </div>
                )}
            </section>

            <section>
                <Heading3>Bunnstripa</Heading3>
                <Paragraph>
                    Et lavt felt nederst på skjermen. Velg «I bunnstripa» over for å
                    vise været her i stedet for i karusellen.
                </Paragraph>
                <RadioGroup
                    name="bottomSurface"
                    label="Bakgrunn"
                    value={draft.bottomSurface}
                    onChange={(event) => update('bottomSurface', event.target.value)}
                >
                    {SURFACES.map((name) => (
                        <Radio key={name} value={name}>{SURFACE_LABELS[name]}</Radio>
                    ))}
                </RadioGroup>
                {errors.bottomSurface && (
                    <SmallAlertBox variant="negative">{errors.bottomSurface}</SmallAlertBox>
                )}
            </section>

            {saveError && <SmallAlertBox variant="negative">{saveError}</SmallAlertBox>}
            {saved && !saving && (
                <SmallAlertBox variant="success">
                    Lagret. Skjermen oppdaterer seg selv innen noen sekunder.
                </SmallAlertBox>
            )}

            <div>
                <PrimaryButton type="submit" disabled={saving}>
                    {saving ? 'Lagrer …' : 'Lagre oppsett'}
                </PrimaryButton>
            </div>
        </form>
    );
}

export default BoardConfigForm;
