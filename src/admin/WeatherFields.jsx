import { TextField } from '@entur/form';

/**
 * Feltene værmodulen trenger.
 *
 * Egen fil fordi været kan stå både i karusellen og i bunnstripa, og feltene er
 * identiske uansett hvor — det er de samme koordinatene som sendes til
 * api.met.no.
 */
function WeatherFields({ draft, errors, update }) {
    return (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
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
    );
}

export default WeatherFields;
