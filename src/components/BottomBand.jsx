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
 * dette tallet direkte — men taket `middleHeight` setter i MiddleBand.jsx er
 * regnet ut fra denne høyden. Endrer du HEIGHT, se det tallet også.
 *
 * Piksler, ikke vh. Innholdet i stripa er fysisk: værsymboler på 44 piksler og
 * tall på rundt 1.4rem. Det trenger en bestemt høyde for å være leselig fra
 * andre siden av rommet, og den høyden er den samme uansett hva slags skjerm
 * tavla henger på. Med vh fulgte den skjermens høyde i stedet: skjermen i Bergen
 * står på høykant, og 16vh ble 307 piksler der mot 173 på en liggende 1080p —
 * altså en stripe som slukte nesten dobbelt så mye som den trengte.
 */
const HEIGHT = '180px';

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
