import ErrorBoundary from './ErrorBoundary';
import WeatherStripe from './WeatherStripe';

/**
 * Feltet nederst på tavla.
 *
 * Rendrer modulene i `bottom` eksplisitt, ikke ved å iterere over en registry —
 * samme grep som `MiddleBand` bruker for `middle`. En ny type i `BOTTOM_TYPES`
 * må derfor også legges inn her.
 *
 * Høyden er fast, ikke `flex: 1`: stripa skal være en stripe, og karusellen over
 * skal få resten. `MiddleBand` kjenner tallet gjennom `hasBottom`, ikke gjennom
 * dette tallet direkte — men taket `middleHeight` setter i MiddleBand.jsx
 * (28vh) er regnet ut fra denne høyden. Endrer du HEIGHT, se det tallet også.
 */
const HEIGHT = '16vh';

function BottomBand({ modules, palette, weather }) {
    if (modules.length === 0) {
        return null;
    }

    return (
        <div style={{ flex: `0 0 ${HEIGHT}`, width: '100vw', boxSizing: 'border-box', backgroundColor: palette.background, overflow: 'hidden' }}>
            {modules.map((module) => {
                if (module.type === 'weather') {
                    return (
                        <ErrorBoundary key="weather">
                            <WeatherStripe weather={weather} palette={palette} />
                        </ErrorBoundary>
                    );
                }
                return null;
            })}
        </div>
    );
}

export default BottomBand;
