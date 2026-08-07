import { useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { PrimaryButton, SecondaryButton } from '@entur/button';
import { TextField } from '@entur/form';

import { BOARD_ID_MAX_LENGTH, isValidBoardId, suggestBoardId } from '../boards/boardId';
import { NAME_MAX_LENGTH, PLACE_NAME_MAX_LENGTH, normalizeBoardConfig } from '../boards/boardConfig';
import { createBoard } from '../boards/boardsRepository';
import { claimBoard } from '../access/membershipsRepository';

/** Oppsettet en ny tavle starter med: det samme som Bergen-tavla har. */
function startConfig(id, name, placeName) {
    return normalizeBoardConfig(id, {
        name,
        placeName,
        top: { kind: 'video' },
        middle: [{ type: 'greeting', text: 'auto', staffImage: true }],
        carousel: [{ type: 'weather', name: placeName, lat: 60.39299, lng: 5.32415 }],
    });
}

function NewBoardForm({ userEmail, onCreated, onCancel }) {
    const [name, setName] = useState('');
    const [placeName, setPlaceName] = useState('');
    // Id-en følger navnet til noen rører den selv. Da slutter den å følge.
    const [id, setId] = useState('');
    const [idTouched, setIdTouched] = useState(false);
    const [errors, setErrors] = useState({});
    const [saveError, setSaveError] = useState(null);
    const [saving, setSaving] = useState(false);

    const effectiveId = idTouched ? id : suggestBoardId(name);

    async function handleSubmit(event) {
        event.preventDefault();
        setSaveError(null);

        const nextErrors = {};
        if (name.trim() === '') {
            nextErrors.name = 'Navn er påkrevd';
        }
        if (placeName.trim() === '') {
            nextErrors.placeName = 'Stedsnavn er påkrevd';
        }
        if (!isValidBoardId(effectiveId)) {
            nextErrors.id = 'Id-en kan bare inneholde små bokstaver, tall og enkle bindestreker';
        }
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
            return;
        }

        setSaving(true);
        try {
            await createBoard(startConfig(effectiveId, name, placeName), userEmail);
            // To skritt: tavla først, så kravet på den. Reglene kan ikke gi deg
            // tilgang til noe som ikke finnes ennå.
            await claimBoard(userEmail, effectiveId);
            onCreated(effectiveId);
        } catch (error) {
            if (error.message === 'id-opptatt') {
                setErrors({ id: `Id-en «${effectiveId}» er allerede i bruk` });
            } else {
                console.error('Kunne ikke opprette tavla', error);
                setSaveError('Kunne ikke opprette tavla. Prøv igjen.');
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <TextField
                label="Navn"
                value={name}
                maxLength={NAME_MAX_LENGTH}
                onChange={(event) => setName(event.target.value)}
                variant={errors.name ? 'negative' : undefined}
                feedback={errors.name ?? 'Vises bare her i admin.'}
            />
            <TextField
                label="Stedsnavn"
                value={placeName}
                maxLength={PLACE_NAME_MAX_LENGTH}
                onChange={(event) => setPlaceName(event.target.value)}
                variant={errors.placeName ? 'negative' : undefined}
                feedback={errors.placeName ?? 'Gir «Velkommen til Entur …»'}
            />
            <TextField
                label="Id"
                value={effectiveId}
                maxLength={BOARD_ID_MAX_LENGTH}
                onChange={(event) => {
                    setIdTouched(true);
                    setId(event.target.value);
                }}
                variant={errors.id ? 'negative' : undefined}
                feedback={errors.id ?? `Skjermen skal peke på /t/${effectiveId || '…'}. Kan ikke endres senere.`}
            />

            {saveError && <SmallAlertBox variant="negative">{saveError}</SmallAlertBox>}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
                <PrimaryButton type="submit" disabled={saving}>
                    {saving ? 'Oppretter …' : 'Opprett tavle'}
                </PrimaryButton>
                <SecondaryButton type="button" onClick={onCancel} disabled={saving}>Avbryt</SecondaryButton>
            </div>
        </form>
    );
}

export default NewBoardForm;
