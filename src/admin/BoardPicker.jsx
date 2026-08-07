import { SmallAlertBox } from '@entur/alert';
import { Checkbox } from '@entur/form';

/**
 * Hvilke tavler meldinga skal stå på.
 *
 * Lista er tavlene du har tilgang til, og bare dem — du skal ikke kunne hake av
 * noe som gir feil ved lagring. Reglene sjekker det samme på skrivesida, men det
 * er sikkerhetsnett, ikke noe brukeren skal møte.
 */
function BoardPicker({ boards, selected, onChange, error }) {
    function toggle(boardId, checked) {
        onChange(checked
            ? [...selected, boardId]
            : selected.filter((id) => id !== boardId));
    }

    return (
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Vises på</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {boards.map((board) => (
                    <Checkbox
                        key={board.id}
                        checked={selected.includes(board.id)}
                        onChange={(event) => toggle(board.id, event.target.checked)}
                    >
                        {board.name || board.id}
                    </Checkbox>
                ))}
            </div>
            {error && (
                <div style={{ marginTop: '0.5rem' }}>
                    <SmallAlertBox variant="negative">{error}</SmallAlertBox>
                </div>
            )}
        </fieldset>
    );
}

export default BoardPicker;
