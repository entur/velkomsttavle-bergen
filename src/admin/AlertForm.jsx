import { useState } from 'react';
import { BannerAlertBox, SmallAlertBox } from '@entur/alert';
import { PrimaryButton, SecondaryButton } from '@entur/button';
import { DatePicker, nativeDateToDateValue, timeOrDateValueToNativeDate } from '@entur/datepicker';
import { Switch, TextArea, TextField } from '@entur/form';
import { base } from '@entur/tokens';

import BoardPicker from './BoardPicker';
import LevelPicker from './LevelPicker';
import { saveAlert } from '../alerts/alertsRepository';
import {
    BODY_MAX_LENGTH,
    TITLE_MAX_LENGTH,
    hasErrors,
    validateAlertInput,
} from '../alerts/alertValidation';

const LOCALE = 'nb-NO';

function emptyDraft(boardId) {
    return {
        id: null,
        title: '',
        body: '',
        level: 'information',
        // Nytt varsel starter «nå», så det slår ut med én gang man lagrer.
        startsAt: nativeDateToDateValue(new Date()),
        endsAt: null,
        enabled: true,
        // Forhåndsutfylt med tavla man står i. De andre må hukes av bevisst.
        boardIds: [boardId],
    };
}

function draftFrom(alert) {
    return {
        id: alert.id,
        title: alert.title,
        body: alert.body,
        level: alert.level,
        startsAt: nativeDateToDateValue(alert.startsAt),
        endsAt: nativeDateToDateValue(alert.endsAt),
        enabled: alert.enabled,
        boardIds: alert.boardIds,
    };
}

function AlertForm({ editing, boardId, boards, userEmail, onSaved, onCancel }) {
    const [draft, setDraft] = useState(() => (editing ? draftFrom(editing) : emptyDraft(boardId)));
    const [errors, setErrors] = useState({});
    const [saveError, setSaveError] = useState(null);
    const [saving, setSaving] = useState(false);

    function update(field, value) {
        setDraft((current) => ({ ...current, [field]: value }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setSaveError(null);

        const input = {
            id: draft.id,
            title: draft.title,
            body: draft.body,
            level: draft.level,
            startsAt: timeOrDateValueToNativeDate(draft.startsAt),
            endsAt: timeOrDateValueToNativeDate(draft.endsAt),
            enabled: draft.enabled,
            boardIds: draft.boardIds,
        };

        const validationErrors = validateAlertInput(input);
        setErrors(validationErrors);
        if (hasErrors(validationErrors)) {
            return;
        }

        setSaving(true);
        try {
            await saveAlert(input, userEmail);
            onSaved();
        } catch (error) {
            console.error('Kunne ikke lagre varselet', error);
            setSaveError('Kunne ikke lagre meldingen. Prøv igjen.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <TextField
                label="Tittel"
                value={draft.title}
                maxLength={TITLE_MAX_LENGTH}
                onChange={(event) => update('title', event.target.value)}
                variant={errors.title ? 'negative' : undefined}
                feedback={errors.title}
            />

            <TextArea
                label="Tekst"
                rows={3}
                value={draft.body}
                maxLength={BODY_MAX_LENGTH}
                onChange={(event) => update('body', event.target.value)}
                variant={errors.body ? 'negative' : undefined}
                feedback={errors.body ?? `${draft.body.length}/${BODY_MAX_LENGTH} tegn`}
            />

            <div>
                <LevelPicker value={draft.level} onChange={(level) => update('level', level)} />
                {errors.level && (
                    <div style={{ marginTop: '0.5rem' }}>
                        <SmallAlertBox variant="negative">{errors.level}</SmallAlertBox>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 16rem' }}>
                    <DatePicker
                        label="Vises fra"
                        locale={LOCALE}
                        showTime
                        granularity="minute"
                        forcedReturnType="CalendarDateTime"
                        selectedDate={draft.startsAt}
                        onChange={(value) => update('startsAt', value)}
                        variant={errors.startsAt ? 'negative' : undefined}
                        feedback={errors.startsAt}
                    />
                </div>
                <div style={{ flex: '1 1 16rem' }}>
                    <DatePicker
                        label="Vises til (kan stå tom)"
                        locale={LOCALE}
                        showTime
                        granularity="minute"
                        forcedReturnType="CalendarDateTime"
                        selectedDate={draft.endsAt}
                        onChange={(value) => update('endsAt', value)}
                        variant={errors.endsAt ? 'negative' : undefined}
                        feedback={errors.endsAt ?? 'Står den tom, vises meldingen til du slår det av.'}
                    />
                </div>
            </div>

            <BoardPicker
                boards={boards}
                selected={draft.boardIds}
                onChange={(boardIds) => update('boardIds', boardIds)}
                error={errors.boardIds}
            />
            {draft.boardIds.length > 1 && (
                <SmallAlertBox variant="information">
                    Denne meldinga står på {draft.boardIds.length} tavler. Endrer du den her,
                    endres den alle stedene.
                </SmallAlertBox>
            )}

            <Switch
                checked={draft.enabled}
                onChange={(event) => update('enabled', event.target.checked)}
            >
                Aktiv
            </Switch>

            <section>
                <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Slik blir det på tavla</h2>
                <div style={{ backgroundColor: base.light.baseColors.frame.contrast, padding: '1.5rem', borderRadius: '0.25rem' }}>
                    <BannerAlertBox variant={draft.level} title={draft.title || 'Tittel'}>
                        {draft.body || 'Tekst'}
                    </BannerAlertBox>
                </div>
            </section>

            {saveError && <SmallAlertBox variant="negative">{saveError}</SmallAlertBox>}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
                <PrimaryButton type="submit" disabled={saving}>
                    {editing ? 'Lagre endringer' : 'Legg inn melding'}
                </PrimaryButton>
                <SecondaryButton type="button" onClick={onCancel} disabled={saving}>
                    Avbryt
                </SecondaryButton>
            </div>
        </form>
    );
}

export default AlertForm;
