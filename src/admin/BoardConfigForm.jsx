import { useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { PrimaryButton } from '@entur/button';
import { TextField } from '@entur/form';

import BottomSection from './BottomSection';
import BrandingSection from './BrandingSection';
import CarouselSection from './CarouselSection';
import WelcomeSection from './WelcomeSection';
import { NAME_MAX_LENGTH } from '../boards/boardConfig';
import {
    addCarouselModule,
    configFrom,
    draftFrom,
    removeCarouselModule,
    setBottomModule,
} from '../boards/boardDraft';
import { hasErrors, validateBoardInput } from '../boards/boardValidation';
import { saveBoardConfig } from '../boards/boardsRepository';

/**
 * Oppsettet for én tavle, som fire seksjoner som speiler de fire feltene på
 * skjermen.
 *
 * Denne komponenten eier draften og har ingen felt selv utenom navnet.
 * Seksjonene får `draft`, `errors` og handlerne de trenger, og leser bare sine
 * egne felt. Oversettelsen til og fra config, og operasjonene på draften, bor i
 * boardDraft.js — utenfor .jsx, slik at de kan testes.
 */
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

    /** Kortoperasjonene er rene funksjoner; her sendes bare resultatet inn. */
    function apply(operation) {
        setSaved(false);
        setDraft(operation);
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
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Navnet hører ikke til noen seksjon: det er en etikett i admin og
                står ingen steder på skjermen. */}
            <div style={{ maxWidth: '20rem' }}>
                <TextField
                    label="Navn"
                    value={draft.name}
                    maxLength={NAME_MAX_LENGTH}
                    onChange={(event) => update('name', event.target.value)}
                    variant={errors.name ? 'negative' : undefined}
                    feedback={errors.name ?? 'Vises bare her i admin.'}
                />
            </div>

            <BrandingSection draft={draft} errors={errors} update={update} />

            <WelcomeSection draft={draft} errors={errors} update={update} updateDay={updateDay} />

            <CarouselSection
                draft={draft}
                errors={errors}
                update={update}
                onAdd={(type) => apply((current) => addCarouselModule(current, type))}
                onRemove={(type) => apply((current) => removeCarouselModule(current, type))}
                onStopPlaceChange={(valgt) => apply((current) => ({
                    ...current,
                    stopPlaceId: valgt.id,
                    stopPlaceName: valgt.name,
                }))}
            />

            <BottomSection
                draft={draft}
                errors={errors}
                update={update}
                onModuleChange={(type) => apply((current) => setBottomModule(current, type))}
            />

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
