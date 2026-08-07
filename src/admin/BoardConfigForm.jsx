import { useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { PrimaryButton } from '@entur/button';
import { Checkbox, Radio, RadioGroup, TextField } from '@entur/form';
import { Heading3, Paragraph } from '@entur/typography';

import {
    FLOORPLAN_PLANS,
    GREETING_AUTO,
    GREETING_TEXT_MAX_LENGTH,
    NAME_MAX_LENGTH,
    PLACE_NAME_MAX_LENGTH,
    findModule,
} from '../boards/boardConfig';
import StopPlaceField from './StopPlaceField';
import { DAY_LABELS, normalizeDays } from '../boards/openingHours';
import { hasErrors, validateBoardInput } from '../boards/boardValidation';
import { saveBoardConfig } from '../boards/boardsRepository';

/** Config → den flate formen skjemafeltene jobber med. */
function draftFrom(board) {
    const greeting = findModule(board.middle, 'greeting');
    const openingHours = findModule(board.middle, 'openingHours');
    const weather = findModule(board.carousel, 'weather');
    const floorplan = findModule(board.carousel, 'floorplan');
    const departures = findModule(board.carousel, 'departures');
    return {
        id: board.id,
        name: board.name,
        placeName: board.placeName,
        topKind: board.top.kind,
        greetingEnabled: Boolean(greeting),
        greetingAuto: !greeting || greeting.text === GREETING_AUTO,
        greetingText: greeting && greeting.text !== GREETING_AUTO ? greeting.text : '',
        staffImage: greeting ? greeting.staffImage : true,
        openingHoursEnabled: Boolean(openingHours),
        days: normalizeDays(openingHours ? openingHours.days : []),
        weatherEnabled: Boolean(weather),
        weatherName: weather ? weather.name : '',
        // Koordinatene er strenger i skjemaet: et halvskrevet «60.» er ikke et
        // tall, og feltet skal ikke hoppe mens man skriver.
        weatherLat: weather ? String(weather.lat) : '',
        weatherLng: weather ? String(weather.lng) : '',
        floorplanEnabled: Boolean(floorplan),
        floorplanPlan: floorplan ? floorplan.plan : FLOORPLAN_PLANS[0],
        departuresEnabled: Boolean(departures),
        stopPlaceId: departures ? departures.stopPlaceId : '',
        stopPlaceName: departures ? departures.stopPlaceName : '',
        carouselTheme: board.carouselTheme,
    };
}

/** Den flate formen → config, slik repositoryet vil ha den. */
function configFrom(draft) {
    const middle = [];
    if (draft.greetingEnabled) {
        middle.push({
            type: 'greeting',
            text: draft.greetingAuto ? GREETING_AUTO : draft.greetingText.trim(),
            staffImage: draft.staffImage,
        });
    }
    if (draft.openingHoursEnabled) {
        middle.push({ type: 'openingHours', days: draft.days });
    }

    const carousel = [];
    if (draft.weatherEnabled) {
        carousel.push({
            type: 'weather',
            name: draft.weatherName.trim(),
            lat: Number(draft.weatherLat),
            lng: Number(draft.weatherLng),
        });
    }
    if (draft.floorplanEnabled) {
        carousel.push({ type: 'floorplan', plan: draft.floorplanPlan });
    }
    if (draft.departuresEnabled) {
        carousel.push({
            type: 'departures',
            stopPlaceId: draft.stopPlaceId,
            stopPlaceName: draft.stopPlaceName.trim(),
        });
    }

    return {
        id: draft.id,
        name: draft.name.trim(),
        placeName: draft.placeName.trim(),
        top: { kind: draft.topKind },
        carouselTheme: draft.carouselTheme,
        middle,
        carousel,
    };
}

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
                <Heading3>Midtfeltet</Heading3>
                <Paragraph>
                    Meldinger vises alltid øverst her, og overskriften «Velkommen til Entur
                    {' '}{draft.placeName || '…'}» står der uansett hva du velger.
                </Paragraph>

                <Checkbox
                    checked={draft.greetingEnabled}
                    onChange={(event) => update('greetingEnabled', event.target.checked)}
                >
                    Hilsen
                </Checkbox>
                {draft.greetingEnabled && (
                    <div style={{ margin: '0.75rem 0 1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <Checkbox
                            checked={draft.staffImage}
                            onChange={(event) => update('staffImage', event.target.checked)}
                        >
                            Vis ansatt-illustrasjon
                        </Checkbox>
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
                    name="carouselTheme"
                    label="Bakgrunn"
                    value={draft.carouselTheme}
                    onChange={(event) => update('carouselTheme', event.target.value)}
                >
                    <Radio value="light">Lys</Radio>
                    <Radio value="dark">Mørk</Radio>
                </RadioGroup>
                {errors.carouselTheme && (
                    <SmallAlertBox variant="negative">{errors.carouselTheme}</SmallAlertBox>
                )}

                <Checkbox
                    checked={draft.weatherEnabled}
                    onChange={(event) => update('weatherEnabled', event.target.checked)}
                >
                    Værmelding
                </Checkbox>
                {draft.weatherEnabled && (
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
