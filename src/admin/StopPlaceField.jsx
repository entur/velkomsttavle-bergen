import { useEffect, useState } from 'react';
import { SmallAlertBox } from '@entur/alert';
import { TextField } from '@entur/form';

import { searchStopPlaces } from '../departures/stopPlaceSearch';

/** Ventetid før søket sendes. Et tastetrykk er ikke et søk. */
const DEBOUNCE_MS = 300;

/**
 * Søkefelt for stoppested.
 *
 * `NSR:StopPlace:59983` er ikke noe et menneske skal taste, så feltet søker i
 * Enturs geocoder og lar deg velge. Id-en vises under valget så den kan
 * etterprøves, men den kan ikke skrives inn.
 */
function StopPlaceField({ value, onChange, error }) {
    const [query, setQuery] = useState(value.name ?? '');
    const [treff, setTreff] = useState([]);
    const [apen, setApen] = useState(false);

    useEffect(() => {
        // Har brukeren allerede valgt noe som stemmer med teksten, skal vi ikke
        // slå opp igjen — da ville lista sprettet opp av seg selv.
        if (query.trim() === '' || query === value.name) {
            setTreff([]);
            return undefined;
        }
        let current = true;
        const timer = setTimeout(() => {
            searchStopPlaces(query).then((resultat) => {
                if (current) {
                    setTreff(resultat);
                    setApen(true);
                }
            });
        }, DEBOUNCE_MS);
        return () => {
            current = false;
            clearTimeout(timer);
        };
    }, [query, value.name]);

    function velg(stopPlace) {
        onChange({ id: stopPlace.id, name: stopPlace.label });
        setQuery(stopPlace.label);
        setApen(false);
        setTreff([]);
    }

    return (
        <div style={{ position: 'relative' }}>
            <TextField
                label="Stoppested"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                variant={error ? 'negative' : undefined}
                feedback={error ?? 'Søk på navn, og velg fra lista.'}
            />
            {apen && treff.length > 0 && (
                <ul style={{ listStyle: 'none', margin: '0.25rem 0 0', padding: 0, border: '1px solid #babbcf', borderRadius: '4px', background: '#ffffff', position: 'absolute', zIndex: 2, width: '100%' }}>
                    {treff.map((stopPlace) => (
                        <li key={stopPlace.id}>
                            <button
                                type="button"
                                onClick={() => velg(stopPlace)}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', border: 'none', background: 'none', cursor: 'pointer', font: 'inherit' }}
                            >
                                {stopPlace.label}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {value.id && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                    Valgt: {value.name} ({value.id})
                </div>
            )}
            {error && !value.id && (
                <div style={{ marginTop: '0.5rem' }}>
                    <SmallAlertBox variant="negative">{error}</SmallAlertBox>
                </div>
            )}
        </div>
    );
}

export default StopPlaceField;
